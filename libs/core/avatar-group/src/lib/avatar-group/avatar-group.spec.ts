import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { MlvResizeObserverService } from '@malva-ui/cdk/utils';
import { MlvAvatarGroup } from './avatar-group';
import type { MlvAvatarGroupMember } from './avatar-group';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

const MEMBERS_3: MlvAvatarGroupMember[] = [
  { name: 'Alice Johnson' },
  { name: 'Bob Martinez' },
  { name: 'Carol White' },
];

const MEMBERS_7: MlvAvatarGroupMember[] = [
  { name: 'Alice Johnson' },
  { name: 'Bob Martinez' },
  { name: 'Carol White' },
  { name: 'David Kim' },
  { name: 'Eva Brown' },
  { name: 'Frank Lee' },
  { name: 'Grace Chen' },
];

// ── Width helpers for size 'm' (avatarPx=40, overlapPx=8, effectivePx=32) ──
//
//  maxFit = floor((containerWidth - 40) / 32) + 1
//
//  W=9999 → maxFit=∞  → show all, no overflow
//  W=136  → maxFit=4  → visible=3, overflow=members[3..] (hidden count = 4)
//  W=168  → maxFit=5  → visible=4, overflow=members[4..] (hidden count = 3)

let resizeSubject: Subject<ResizeObserverEntry[]>;

function makeResizeEntry(width: number): ResizeObserverEntry[] {
  return [{ contentRect: { width } as DOMRectReadOnly } as ResizeObserverEntry];
}

// ── Host components ────────────────────────────────────────────────────────────

@Component({
  imports: [MlvAvatarGroup],
  template: `
    <mlv-avatar-group
      [members]="members()"
      [size]="size()"
      [shape]="shape()"
      [interactive]="interactive()"
      (groupClick)="onGroupClick($event)"
      (overflowClick)="onOverflowClick($event)"
    />
  `,
})
class BasicTestHost {
  members = signal<MlvAvatarGroupMember[]>(MEMBERS_3);
  size = signal<'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl'>('m');
  shape = signal<'circle' | 'square'>('circle');
  interactive = signal(false);

  lastGroupClick: MlvAvatarGroupMember[] | null = null;
  lastOverflowClick: MlvAvatarGroupMember[] | null = null;

  onGroupClick(members: MlvAvatarGroupMember[]): void {
    this.lastGroupClick = members;
  }

  onOverflowClick(members: MlvAvatarGroupMember[]): void {
    this.lastOverflowClick = members;
  }
}

@Component({
  imports: [MlvAvatarGroup],
  template: `<mlv-avatar-group [members]="[]" />`,
})
class EmptyTestHost {}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getHost(fixture: ComponentFixture<unknown>): HTMLElement {
  return fixture.nativeElement.querySelector('mlv-avatar-group') as HTMLElement;
}

function getAvatarItems(
  fixture: ComponentFixture<unknown>,
): NodeListOf<Element> {
  return fixture.nativeElement.querySelectorAll('.mlv-avatar-group__item');
}

function getOverflow(fixture: ComponentFixture<unknown>): HTMLElement | null {
  return fixture.nativeElement.querySelector('.mlv-avatar-group__overflow');
}

function getOverflowInitials(
  fixture: ComponentFixture<unknown>,
): string | null {
  const el = fixture.nativeElement.querySelector(
    '.mlv-avatar-group__overflow mlv-avatar .mlv-avatar__initials',
  );
  return el?.textContent?.trim() ?? null;
}

function dispatchKeydown(el: HTMLElement, key: string): void {
  el.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
  );
}

async function setupBasicFixture(): Promise<{
  fixture: ComponentFixture<BasicTestHost>;
  host: BasicTestHost;
}> {
  resizeSubject = new Subject<ResizeObserverEntry[]>();
  await TestBed.configureTestingModule({
    imports: [BasicTestHost],
    providers: [
      provideMlvI18nTesting(),
      {
        provide: MlvResizeObserverService,
        useValue: { observe: () => resizeSubject.asObservable() },
      },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(BasicTestHost);
  const host = fixture.componentInstance;
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, host };
}

function simulateWidth(
  width: number,
  fixture: ComponentFixture<unknown>,
): void {
  resizeSubject.next(makeResizeEntry(width));
  fixture.detectChanges();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MlvAvatarGroup', () => {
  describe('Creation', () => {
    it('should create the component', async () => {
      const { fixture } = await setupBasicFixture();
      expect(getHost(fixture)).toBeTruthy();
    });

    it('should apply the mlv-avatar-group block class', async () => {
      const { fixture } = await setupBasicFixture();
      expect(getHost(fixture).classList).toContain('mlv-avatar-group');
    });
  });

  describe('Visible avatar rendering', () => {
    it('should render all members when all fit in the container', async () => {
      const { fixture } = await setupBasicFixture();
      simulateWidth(9999, fixture); // unconstrained → all 3 visible
      expect(getAvatarItems(fixture).length).toBe(3);
    });

    it('should render visible subset when container is constrained (7 members, W=136)', async () => {
      const { fixture, host } = await setupBasicFixture();
      host.members.set(MEMBERS_7);
      fixture.detectChanges();
      // W=136: maxFit=4 → visible=3, overflow slot=1
      simulateWidth(136, fixture);
      expect(getAvatarItems(fixture).length).toBe(3);
    });

    it('should render at least 1 visible avatar in very small containers', async () => {
      const { fixture, host } = await setupBasicFixture();
      host.members.set(MEMBERS_7);
      fixture.detectChanges();
      simulateWidth(10, fixture);
      expect(getAvatarItems(fixture).length).toBeGreaterThanOrEqual(1);
    });

    it('should set aria-label on each visible avatar', async () => {
      const { fixture } = await setupBasicFixture();
      simulateWidth(9999, fixture);
      const avatars = fixture.nativeElement.querySelectorAll(
        '.mlv-avatar-group__item mlv-avatar',
      );
      expect(avatars[0].getAttribute('aria-label')).toBe('Alice Johnson');
      expect(avatars[1].getAttribute('aria-label')).toBe('Bob Martinez');
    });
  });

  describe('Overflow counter avatar', () => {
    it('should NOT render overflow when all members fit', async () => {
      const { fixture } = await setupBasicFixture();
      simulateWidth(9999, fixture);
      expect(getOverflow(fixture)).toBeNull();
    });

    it('should render overflow avatar when members exceed container capacity', async () => {
      const { fixture, host } = await setupBasicFixture();
      host.members.set(MEMBERS_7);
      fixture.detectChanges();
      simulateWidth(136, fixture); // maxFit=4 → overflow exists
      expect(getOverflow(fixture)).toBeTruthy();
    });

    it('should display "+N" initials in the overflow avatar', async () => {
      const { fixture, host } = await setupBasicFixture();
      host.members.set(MEMBERS_7);
      fixture.detectChanges();
      simulateWidth(136, fixture); // visible=3, hidden=4 → "+4"
      expect(getOverflowInitials(fixture)).toBe('+4');
    });

    it('should set aria-label on the overflow wrapper', async () => {
      const { fixture, host } = await setupBasicFixture();
      host.members.set(MEMBERS_7);
      fixture.detectChanges();
      simulateWidth(136, fixture);
      expect(getOverflow(fixture)?.getAttribute('aria-label')).toBe(
        '+4 more members',
      );
    });

    it('should have role="button" on the overflow wrapper', async () => {
      const { fixture, host } = await setupBasicFixture();
      host.members.set(MEMBERS_7);
      fixture.detectChanges();
      simulateWidth(136, fixture);
      expect(getOverflow(fixture)?.getAttribute('role')).toBe('button');
    });

    it('should update overflow count when container width changes', async () => {
      const { fixture, host } = await setupBasicFixture();
      host.members.set(MEMBERS_7);
      fixture.detectChanges();

      simulateWidth(168, fixture); // maxFit=5 → visible=4, hidden=3 → "+3"
      expect(getOverflowInitials(fixture)).toBe('+3');

      simulateWidth(136, fixture); // maxFit=4 → visible=3, hidden=4 → "+4"
      expect(getOverflowInitials(fixture)).toBe('+4');
    });

    it('should remove overflow when members are removed', async () => {
      const { fixture, host } = await setupBasicFixture();
      host.members.set(MEMBERS_7);
      fixture.detectChanges();
      simulateWidth(136, fixture);
      expect(getOverflow(fixture)).toBeTruthy();

      host.members.set(MEMBERS_3);
      fixture.detectChanges();
      expect(getOverflow(fixture)).toBeNull();
    });
  });

  describe('Host classes', () => {
    it('should apply default size modifier mlv-avatar-group--size-m', async () => {
      const { fixture } = await setupBasicFixture();
      expect(getHost(fixture).classList).toContain('mlv-avatar-group--size-m');
    });

    it('should apply correct size modifier when size changes', async () => {
      const { fixture, host } = await setupBasicFixture();
      host.size.set('l');
      fixture.detectChanges();
      const el = getHost(fixture);
      expect(el.classList).toContain('mlv-avatar-group--size-l');
      expect(el.classList).not.toContain('mlv-avatar-group--size-m');
    });

    it('should NOT apply interactive class by default', async () => {
      const { fixture } = await setupBasicFixture();
      expect(getHost(fixture).classList).not.toContain(
        'mlv-avatar-group--interactive',
      );
    });

    it('should apply interactive class when interactive=true', async () => {
      const { fixture, host } = await setupBasicFixture();
      host.interactive.set(true);
      fixture.detectChanges();
      expect(getHost(fixture).classList).toContain(
        'mlv-avatar-group--interactive',
      );
    });

    it('should support all size variants', async () => {
      const { fixture, host } = await setupBasicFixture();
      const sizes = ['xs', 's', 'm', 'l', 'xl', 'xxl'] as const;
      for (const size of sizes) {
        host.size.set(size);
        fixture.detectChanges();
        expect(getHost(fixture).classList).toContain(
          `mlv-avatar-group--size-${size}`,
        );
      }
    });
  });

  describe('Accessibility — host ARIA', () => {
    it('should have role="group" on the host', async () => {
      const { fixture } = await setupBasicFixture();
      expect(getHost(fixture).getAttribute('role')).toBe('group');
    });

    it('should expose an interactive group as a tabbable button', async () => {
      const { fixture, host } = await setupBasicFixture();
      host.interactive.set(true);
      fixture.detectChanges();

      expect(getHost(fixture).getAttribute('role')).toBe('button');
      expect(getHost(fixture).getAttribute('tabindex')).toBe('0');
    });

    it('should keep an empty interactive group out of the tab order', async () => {
      const { fixture, host } = await setupBasicFixture();
      host.interactive.set(true);
      host.members.set([]);
      fixture.detectChanges();

      expect(getHost(fixture).hasAttribute('tabindex')).toBe(false);
    });

    it('should compute aria-label with total count (no overflow)', async () => {
      const { fixture } = await setupBasicFixture();
      simulateWidth(9999, fixture);
      expect(getHost(fixture).getAttribute('aria-label')).toBe('3 members');
    });

    it('should compute aria-label as singular for 1 member', async () => {
      const { fixture, host } = await setupBasicFixture();
      host.members.set([{ name: 'Alice' }]);
      fixture.detectChanges();
      simulateWidth(9999, fixture);
      expect(getHost(fixture).getAttribute('aria-label')).toBe('1 member');
    });

    it('should include visible count in aria-label when overflow exists', async () => {
      const { fixture, host } = await setupBasicFixture();
      host.members.set(MEMBERS_7);
      fixture.detectChanges();
      simulateWidth(136, fixture); // visible=3
      expect(getHost(fixture).getAttribute('aria-label')).toBe(
        '7 members, 3 shown',
      );
    });

    it('should set aria-label to "No members" for empty list', async () => {
      const { fixture, host } = await setupBasicFixture();
      host.members.set([]);
      fixture.detectChanges();
      expect(getHost(fixture).getAttribute('aria-label')).toBe('No members');
    });
  });

  describe('Empty state', () => {
    it('should render with empty members without errors', async () => {
      resizeSubject = new Subject();
      await TestBed.configureTestingModule({
        imports: [EmptyTestHost],
        providers: [
          provideMlvI18nTesting(),
          {
            provide: MlvResizeObserverService,
            useValue: { observe: () => resizeSubject.asObservable() },
          },
        ],
      }).compileComponents();

      const fixture = TestBed.createComponent(EmptyTestHost);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(
        fixture.nativeElement.querySelector('mlv-avatar-group'),
      ).toBeTruthy();
      expect(
        fixture.nativeElement.querySelectorAll('.mlv-avatar-group__item')
          .length,
      ).toBe(0);
      expect(
        fixture.nativeElement.querySelector('.mlv-avatar-group__overflow'),
      ).toBeNull();
    });
  });

  describe('Outputs', () => {
    it('should emit groupClick with all members on host click', async () => {
      const { fixture, host } = await setupBasicFixture();
      host.members.set(MEMBERS_7);
      fixture.detectChanges();
      simulateWidth(9999, fixture);
      getHost(fixture).click();
      expect(host.lastGroupClick).toEqual(MEMBERS_7);
    });

    it('should NOT emit groupClick when members list is empty', async () => {
      const { fixture, host } = await setupBasicFixture();
      host.members.set([]);
      fixture.detectChanges();
      getHost(fixture).click();
      expect(host.lastGroupClick).toBeNull();
    });

    it('should emit overflowClick with hidden members on overflow counter click', async () => {
      const { fixture, host } = await setupBasicFixture();
      host.members.set(MEMBERS_7);
      fixture.detectChanges();
      simulateWidth(136, fixture); // visible=3, hidden=MEMBERS_7.slice(3)
      const overflow = getOverflow(fixture) as HTMLElement;
      overflow.click();
      expect(host.lastOverflowClick).toEqual(MEMBERS_7.slice(3));
    });

    it('should NOT fire groupClick when overflow counter is clicked', async () => {
      const { fixture, host } = await setupBasicFixture();
      host.members.set(MEMBERS_7);
      fixture.detectChanges();
      simulateWidth(136, fixture);
      const overflow = getOverflow(fixture) as HTMLElement;
      overflow.click();
      expect(host.lastGroupClick).toBeNull();
    });
  });

  describe('Keyboard interaction', () => {
    it.each(['Enter', ' '])(
      'should emit groupClick on %s when interactive',
      async (key) => {
        const { fixture, host } = await setupBasicFixture();
        host.interactive.set(true);
        fixture.detectChanges();

        dispatchKeydown(getHost(fixture), key);

        expect(host.lastGroupClick).toEqual(MEMBERS_3);
      },
    );

    it('should ignore activation keys when not interactive', async () => {
      const { fixture, host } = await setupBasicFixture();

      dispatchKeydown(getHost(fixture), 'Enter');

      expect(host.lastGroupClick).toBeNull();
    });

    it('should emit overflowClick on Enter on overflow element', async () => {
      const { fixture, host } = await setupBasicFixture();
      host.members.set(MEMBERS_7);
      fixture.detectChanges();
      simulateWidth(136, fixture);
      const overflow = getOverflow(fixture) as HTMLElement;
      dispatchKeydown(overflow, 'Enter');
      expect(host.lastOverflowClick).toEqual(MEMBERS_7.slice(3));
    });

    it('should emit overflowClick on Space on overflow element', async () => {
      const { fixture, host } = await setupBasicFixture();
      host.members.set(MEMBERS_7);
      fixture.detectChanges();
      simulateWidth(136, fixture);
      const overflow = getOverflow(fixture) as HTMLElement;
      dispatchKeydown(overflow, ' ');
      expect(host.lastOverflowClick).toEqual(MEMBERS_7.slice(3));
    });

    it('should prevent default on Space keydown (avoid page scroll)', async () => {
      const { fixture, host } = await setupBasicFixture();
      host.members.set(MEMBERS_7);
      fixture.detectChanges();
      simulateWidth(136, fixture);
      const overflow = getOverflow(fixture) as HTMLElement;
      const spaceEvent = new KeyboardEvent('keydown', {
        key: ' ',
        bubbles: true,
        cancelable: true,
      });
      overflow.dispatchEvent(spaceEvent);
      expect(spaceEvent.defaultPrevented).toBe(true);
    });
  });

  describe('Popup member list', () => {
    it('should render mlv-popup when overflow exists', async () => {
      const { fixture, host } = await setupBasicFixture();
      host.members.set(MEMBERS_7);
      fixture.detectChanges();
      simulateWidth(136, fixture);
      expect(fixture.nativeElement.querySelector('mlv-popup')).toBeTruthy();
    });

    it('should NOT render mlv-popup when no overflow', async () => {
      const { fixture } = await setupBasicFixture();
      simulateWidth(9999, fixture);
      expect(fixture.nativeElement.querySelector('mlv-popup')).toBeNull();
    });
  });

  describe('Reactive updates', () => {
    it('should show overflow when container shrinks', async () => {
      const { fixture, host } = await setupBasicFixture();
      host.members.set(MEMBERS_7);
      fixture.detectChanges();

      simulateWidth(9999, fixture);
      expect(getOverflow(fixture)).toBeNull();

      simulateWidth(136, fixture);
      expect(getOverflow(fixture)).toBeTruthy();
    });

    it('should remove overflow when container grows', async () => {
      const { fixture, host } = await setupBasicFixture();
      host.members.set(MEMBERS_7);
      fixture.detectChanges();

      simulateWidth(136, fixture);
      expect(getOverflow(fixture)).toBeTruthy();

      simulateWidth(9999, fixture);
      expect(getOverflow(fixture)).toBeNull();
    });

    it('should update size class reactively', async () => {
      const { fixture, host } = await setupBasicFixture();
      host.size.set('xl');
      fixture.detectChanges();
      expect(getHost(fixture).classList).toContain('mlv-avatar-group--size-xl');

      host.size.set('xs');
      fixture.detectChanges();
      expect(getHost(fixture).classList).toContain('mlv-avatar-group--size-xs');
    });
  });
});
