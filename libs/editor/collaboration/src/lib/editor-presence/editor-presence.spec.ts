import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { MLV_EDITOR_I18N } from '@malva-ui/i18n';
import { enLanguage as en } from '@malva-ui/i18n/en';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import type { MlvEditorCollaboration } from '../collaboration';
import type {
  MlvEditorCollaborationPeer,
  MlvEditorCollaborationStatus,
} from '../collaboration.types';
import { MlvEditorPresence } from './editor-presence';

/*
 * F-D19: `mlv-editor-presence` over a stub directive, so every status and
 * peer shape is reachable without a transport. The two-editor integration
 * lives in `editor-presence-live.spec.ts`.
 */

/** The two signals the component reads, writable. */
function stubCollaboration() {
  return {
    status: signal<MlvEditorCollaborationStatus>('idle'),
    peers: signal<readonly MlvEditorCollaborationPeer[]>([]),
  };
}

@Component({
  selector: 'mlv-presence-host',
  imports: [MlvEditorPresence],
  template: `<mlv-editor-presence
    [collaboration]="collaboration"
    [showStatus]="showStatus()"
  />`,
})
class PresenceHost {
  readonly stub = stubCollaboration();
  readonly collaboration = this.stub as unknown as MlvEditorCollaboration;
  readonly showStatus = signal(true);
}

const ada: MlvEditorCollaborationPeer = {
  clientId: 1,
  id: 'ada',
  name: 'Ada Lovelace',
  color: '#4387e4',
  mode: 'editing',
};
const grace: MlvEditorCollaborationPeer = {
  clientId: 2,
  id: 'grace',
  name: 'Grace',
  color: '#000000',
  mode: 'viewing',
};

describe('MlvEditorPresence (F-D19)', () => {
  let fixture: ComponentFixture<PresenceHost>;
  let host: PresenceHost;

  async function mount(providers: unknown[] = []) {
    await TestBed.configureTestingModule({
      imports: [PresenceHost],
      providers: [provideMlvI18nTesting(), ...(providers as never[])],
    }).compileComponents();
    fixture = TestBed.createComponent(PresenceHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const render = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };

  const presence = () =>
    (fixture.nativeElement as HTMLElement).querySelector(
      'mlv-editor-presence',
    ) as HTMLElement;
  const statusText = () =>
    presence().querySelector('.mlv-editor-presence__status-text')
      ?.textContent ?? null;
  const tone = () =>
    [
      ...(presence().querySelector('mlv-status-indicator')?.classList ?? []),
    ].find((name) => name.startsWith('mlv-status-indicator--tone-')) ?? null;
  const avatarNames = () =>
    [...presence().querySelectorAll('mlv-avatar[role="img"]')].map((avatar) =>
      avatar.getAttribute('aria-label'),
    );
  const hiddenCount = () =>
    presence().querySelector('.cdk-visually-hidden')?.textContent ?? null;

  it('is a named group that renders no peers and no text while idle', async () => {
    await mount();
    host.stub.peers.set([ada]);
    await render();
    expect([
      presence().getAttribute('role'),
      presence().getAttribute('aria-label'),
      presence().textContent?.trim(),
      presence().querySelector('mlv-avatar-group'),
    ]).toEqual(['group', 'Collaborators', '', null]);
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });

  it.each([
    ['connecting', 'Connecting…', 'warning', null],
    ['syncing', 'Syncing…', 'warning', null],
    ['synced', 'All changes synced', 'success', null],
    [
      'offline',
      'Offline. Changes will sync when you reconnect.',
      'warning',
      'mlv-editor-presence--offline',
    ],
    [
      'closed',
      'Collaboration ended. The document is read-only.',
      'danger',
      'mlv-editor-presence--closed',
    ],
    [
      'failed',
      'Collaboration failed. The document is read-only.',
      'danger',
      'mlv-editor-presence--failed',
    ],
  ] as const)(
    'shows the %s status with its text, dot tone and modifier',
    async (status, text, expectedTone, modifier) => {
      await mount();
      host.stub.status.set(status);
      host.stub.peers.set([ada, grace]);
      await render();
      expect([statusText(), tone()]).toEqual([
        text,
        `mlv-status-indicator--tone-${expectedTone}`,
      ]);
      const modifiers = [...presence().classList].filter((name) =>
        name.startsWith('mlv-editor-presence--'),
      );
      expect(modifiers).toEqual(modifier ? [modifier] : []);
      await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
    },
  );

  it('lists peers, names viewers, tints avatars and counts peers', async () => {
    await mount();
    host.stub.status.set('synced');
    host.stub.peers.set([ada, grace]);
    await render();
    expect(avatarNames()).toEqual(['Ada Lovelace', 'Grace (viewing)']);
    const initials = [
      ...presence().querySelectorAll('.mlv-avatar__initials'),
    ].map((node) => node.textContent?.trim());
    expect(initials).toEqual(['AL', 'G']);
    // 75% toward white: #4387e4 → #d0e1f8, #000000 → #bfbfbf.
    const backgrounds = [
      ...presence().querySelectorAll<HTMLElement>(
        '[style*="background-color"]',
      ),
    ].map((node) => node.style.backgroundColor);
    expect(backgrounds).toEqual(['rgb(208, 225, 248)', 'rgb(191, 191, 191)']);
    expect(hiddenCount()).toBe('2 other people here');

    host.stub.peers.set([ada]);
    await render();
    expect(hiddenCount()).toBe('1 other person here');

    host.stub.peers.set([]);
    await render();
    expect([
      hiddenCount(),
      presence().querySelector('mlv-avatar-group'),
    ]).toEqual(['0 other people here', null]);
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });

  it('hides the status with showStatus off, keeping the peers', async () => {
    await mount();
    host.stub.status.set('offline');
    host.stub.peers.set([ada]);
    host.showStatus.set(false);
    await render();
    expect([statusText(), avatarNames()]).toEqual([null, ['Ada Lovelace']]);
  });

  it('reads the language pack, with English for a missing key', async () => {
    await mount([
      {
        provide: MLV_EDITOR_I18N,
        useValue: signal({
          ...en.editor,
          collaborationPresenceLabel: 'Collaborateurs',
          collaborationViewing: '{name} (lecture)',
          collaborationSynced: undefined,
        }),
      },
    ]);
    host.stub.status.set('synced');
    host.stub.peers.set([grace]);
    await render();
    expect([
      presence().getAttribute('aria-label'),
      avatarNames(),
      statusText(),
    ]).toEqual(['Collaborateurs', ['Grace (lecture)'], 'All changes synced']);
  });
});
