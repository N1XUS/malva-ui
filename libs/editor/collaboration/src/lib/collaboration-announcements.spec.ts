import { LiveAnnouncer } from '@angular/cdk/a11y';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MLV_EDITOR_I18N, type MlvEditorI18n } from '@malva-ui/i18n';
import { enLanguage as en } from '@malva-ui/i18n/en';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import {
  CollaborationRig,
  CollaborationTestEditor,
  configureCollaborationTestBed,
} from './testing/collaboration-harness';

/*
 * F-D19: connection changes reach AT through the editor's live announcer,
 * politely, without `mlv-editor-presence` on the page. The initial connect
 * and peer joins and leaves stay silent.
 */

describe('MlvEditorCollaboration — announcements (F-D19)', () => {
  let rig: CollaborationRig;
  let spoken: string[];

  const spyAnnouncer = () => {
    spoken = [];
    const announcer = TestBed.inject(LiveAnnouncer);
    vi.spyOn(announcer, 'announce').mockImplementation((message) => {
      spoken.push(String(message));
      return Promise.resolve();
    });
  };

  afterEach(() => rig.destroy());

  describe('with the English pack', () => {
    beforeEach(async () => {
      await configureCollaborationTestBed();
      rig = new CollaborationRig();
      spyAnnouncer();
    });

    it('says nothing for the initial connect, first sync or a peer joining and leaving', async () => {
      const hub = rig.hub('server');
      await rig.mount({
        transport: hub.endpoint(),
        initialContent: '<p>A</p>',
      });
      await rig.sync(hub);
      const peer = await rig.mount({ transport: hub.endpoint() });
      await rig.sync(hub);
      rig.fixtures.splice(rig.fixtures.indexOf(peer), 1);
      peer.destroy();
      await rig.sync(hub);
      expect(spoken).toEqual([]);
    });

    it('announces a synced session going offline, then coming back', async () => {
      const hub = rig.hub('server');
      const transport = hub.endpoint();
      await rig.mount({ transport, initialContent: '<p>A</p>' });
      await rig.sync(hub);

      transport.goOffline();
      await rig.settle();
      expect(spoken).toEqual([
        'Offline. Changes will sync when you reconnect.',
      ]);

      transport.goOnline();
      await rig.sync(hub);
      expect(spoken).toEqual([
        'Offline. Changes will sync when you reconnect.',
        'Back online. Changes synced.',
      ]);
    });

    it('announces a closed and a failed session', async () => {
      const hub = rig.hub('server');
      const closing = hub.endpoint();
      const failing = hub.endpoint();
      await rig.mount({ transport: closing, initialContent: '<p>A</p>' });
      await rig.mount({ transport: failing, initialContent: '<p>A</p>' });
      await rig.sync(hub);

      closing.complete();
      await rig.settle();
      failing.error(new Error('boom'));
      await rig.settle();
      expect(spoken).toEqual([
        'Collaboration ended. The document is read-only.',
        'Collaboration failed. The document is read-only.',
      ]);
    });

    it('announces the first-sync timeout once, then the sync that follows', async () => {
      const hub = rig.hub('server', { autoConnect: false });
      const transport = hub.endpoint();
      await rig.mount({ transport, syncTimeout: 20 });
      await new Promise((resolve) => setTimeout(resolve, 60));
      await rig.settle();
      expect(spoken).toEqual([
        'The document has not synced yet. Editing starts once it does.',
      ]);

      transport.goOnline();
      await rig.sync(hub);
      expect(spoken).toEqual([
        'The document has not synced yet. Editing starts once it does.',
        'Back online. Changes synced.',
      ]);
    });
  });

  describe('with a pack overriding the copy', () => {
    const pack = signal<MlvEditorI18n>({
      ...en.editor,
      collaborationOffline: 'Hors ligne (test).',
      collaborationAnonymous: 'Inconnu',
    });

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [CollaborationTestEditor],
        providers: [
          provideMlvI18nTesting(),
          { provide: MLV_EDITOR_I18N, useValue: pack },
        ],
      }).compileComponents();
      rig = new CollaborationRig();
      spyAnnouncer();
    });

    it('announces and names peers from the active pack', async () => {
      const hub = rig.hub('server');
      const transport = hub.endpoint();
      const a = await rig.mount({ transport, initialContent: '<p>A</p>' });
      await rig.mount({ transport: hub.endpoint() });
      await rig.sync(hub);
      const collaboration = a.componentInstance.collaboration();
      expect(collaboration.peers().map((peer) => peer.name)).toEqual([
        'Inconnu',
      ]);
      expect(collaboration.self()?.name).toBe('Inconnu');

      transport.goOffline();
      await rig.settle();
      expect(spoken).toEqual(['Hors ligne (test).']);
    });

    it('falls back to English for a key the pack leaves out', async () => {
      const partial = { ...en.editor } as Record<string, unknown>;
      delete partial['collaborationBackOnline'];
      pack.set(partial as unknown as MlvEditorI18n);
      const hub = rig.hub('server');
      const transport = hub.endpoint();
      await rig.mount({ transport, initialContent: '<p>A</p>' });
      await rig.sync(hub);
      transport.goOffline();
      await rig.settle();
      transport.goOnline();
      await rig.sync(hub);
      expect(spoken.at(-1)).toBe('Back online. Changes synced.');
    });
  });
});
