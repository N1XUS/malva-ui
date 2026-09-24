import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { OverlayContainer } from '@angular/cdk/overlay';
import { Subject } from 'rxjs';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
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
  groupClickCount = 0;
  overflowClickCount = 0;

  onGroupClick(members: MlvAvatarGroupMember[]): void {
    this.lastGroupClick = members;
    this.groupClickCount++;
  }

  onOverflowClick(members: MlvAvatarGroupMember[]): void {
    this.lastOverflowClick = members;
    this.overflowClickCount++;
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

function getAction(fixture: ComponentFixture<unknown>): HTMLElement | null {
  return fixture.nativeElement.querySelector('.mlv-avatar-group__action');
}

function dispatchKeydown(el: HTMLElement, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  });
  el.dispatchEvent(event);
  return event;
}

/**
 * What a browser does for Enter / Space on a native `<button>`: the keydown
 * reaches every listener, and — unless one cancels it — the button then
 * fires a `click` of its own. jsdom synthesises no click for a scripted key,
 * so the spec dispatches it by hand, which is also what makes a handler that
 * acts on the keydown **and** the click visible as a double emission (#299).
 */
function press(el: HTMLElement, key: 'Enter' | ' '): void {
  const keydown = dispatchKeydown(el, key);
  if (!keydown.defaultPrevented) {
    el.click();
  }
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

    it('should render the overflow counter as a native button', async () => {
      const { fixture, host } = await setupBasicFixture();
      host.members.set(MEMBERS_7);
      fixture.detectChanges();
      simulateWidth(136, fixture);
      const overflow = getOverflow(fixture) as HTMLElement;
      expect(overflow.tagName).toBe('BUTTON');
      expect(overflow.getAttribute('type')).toBe('button');
      // A native button is a tab stop and a button of its own; the old
      // `div` carried both by hand.
      expect(overflow.hasAttribute('role')).toBe(false);
      expect(overflow.hasAttribute('tabindex')).toBe(false);
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

    it('should keep role="group" on an interactive host and act through an inner button', async () => {
      const { fixture, host } = await setupBasicFixture();
      host.interactive.set(true);
      fixture.detectChanges();
      simulateWidth(9999, fixture);

      const el = getHost(fixture);
      expect(el.getAttribute('role')).toBe('group');
      expect(el.getAttribute('aria-label')).toBe('3 members');
      expect(el.hasAttribute('tabindex')).toBe(false);

      const action = getAction(fixture) as HTMLElement;
      expect(action.tagName).toBe('BUTTON');
      expect(action.getAttribute('type')).toBe('button');
      expect(action.getAttribute('aria-label')).toBe('3 members');
      expect(action.querySelectorAll('.mlv-avatar-group__item')).toHaveLength(
        3,
      );
    });

    it('should render the group action and the overflow counter as sibling buttons', async () => {
      const { fixture, host } = await setupBasicFixture();
      host.interactive.set(true);
      host.members.set(MEMBERS_7);
      fixture.detectChanges();
      simulateWidth(136, fixture);

      const el = getHost(fixture);
      const action = getAction(fixture) as HTMLElement;
      const overflow = getOverflow(fixture) as HTMLElement;

      // The host names the group and is no control itself.
      expect(el.getAttribute('role')).toBe('group');
      expect(el.getAttribute('aria-label')).toBe('7 members, 3 shown');
      expect(el.hasAttribute('tabindex')).toBe(false);

      // Two buttons, neither inside the other (#328): `button` has
      // presentational children, so a nested one is flattened away for AT.
      expect(action.tagName).toBe('BUTTON');
      expect(overflow.tagName).toBe('BUTTON');
      expect(action.contains(overflow)).toBe(false);
      expect(overflow.contains(action)).toBe(false);
      expect(action.getAttribute('aria-label')).toBe('7 members, 3 shown');
      expect(overflow.getAttribute('aria-label')).toBe('+4 more members');
      expect(action.querySelectorAll('.mlv-avatar-group__item')).toHaveLength(
        3,
      );
    });

    it('should render no action button for a group that is not interactive', async () => {
      const { fixture } = await setupBasicFixture();
      simulateWidth(9999, fixture);

      expect(getAction(fixture)).toBeNull();
      expect(getAvatarItems(fixture)).toHaveLength(3);
    });

    it('should keep an empty interactive group out of the tab order', async () => {
      const { fixture, host } = await setupBasicFixture();
      host.interactive.set(true);
      host.members.set([]);
      fixture.detectChanges();

      // An action with nothing to act on would be a named tab stop that does
      // nothing, since `groupClick` is suppressed for an empty group.
      expect(getHost(fixture).hasAttribute('tabindex')).toBe(false);
      expect(getAction(fixture)).toBeNull();
      expect(getHost(fixture).querySelector('button')).toBeNull();
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

    it('should emit groupClick once when the interactive action button is clicked', async () => {
      const { fixture, host } = await setupBasicFixture();
      host.interactive.set(true);
      host.members.set(MEMBERS_7);
      fixture.detectChanges();
      simulateWidth(136, fixture);

      (getAction(fixture) as HTMLElement).click();

      expect(host.groupClickCount).toBe(1);
      expect(host.lastGroupClick).toEqual(MEMBERS_7);
      expect(host.overflowClickCount).toBe(0);
    });

    it('should still emit groupClick for a click elsewhere on an interactive host', async () => {
      const { fixture, host } = await setupBasicFixture();
      host.interactive.set(true);
      fixture.detectChanges();
      simulateWidth(9999, fixture);

      getHost(fixture).click();

      expect(host.groupClickCount).toBe(1);
      expect(host.lastGroupClick).toEqual(MEMBERS_3);
    });

    it('should emit only overflowClick for the counter of an interactive group', async () => {
      const { fixture, host } = await setupBasicFixture();
      host.interactive.set(true);
      host.members.set(MEMBERS_7);
      fixture.detectChanges();
      simulateWidth(136, fixture);

      (getOverflow(fixture) as HTMLElement).click();

      expect(host.overflowClickCount).toBe(1);
      expect(host.lastOverflowClick).toEqual(MEMBERS_7.slice(3));
      expect(host.groupClickCount).toBe(0);
    });
  });

  describe('Keyboard interaction', () => {
    it.each(['Enter', ' '] as const)(
      'should emit groupClick once on %s on the interactive action button',
      async (key) => {
        const { fixture, host } = await setupBasicFixture();
        host.interactive.set(true);
        fixture.detectChanges();
        simulateWidth(9999, fixture);

        press(getAction(fixture) as HTMLElement, key);

        expect(host.groupClickCount).toBe(1);
        expect(host.lastGroupClick).toEqual(MEMBERS_3);
      },
    );

    it('should not act on an activation keydown on the host itself', async () => {
      const { fixture, host } = await setupBasicFixture();
      host.interactive.set(true);
      fixture.detectChanges();

      // The host is a group, not a control: only the inner button's own
      // click — which the browser fires for Enter / Space — emits.
      dispatchKeydown(getHost(fixture), 'Enter');
      dispatchKeydown(getAction(fixture) as HTMLElement, ' ');

      expect(host.groupClickCount).toBe(0);
    });

    it('should ignore activation keys when not interactive', async () => {
      const { fixture, host } = await setupBasicFixture();

      dispatchKeydown(getHost(fixture), 'Enter');

      expect(host.lastGroupClick).toBeNull();
    });

    it.each(['Enter', ' '] as const)(
      'should emit overflowClick once on %s on the overflow button',
      async (key) => {
        const { fixture, host } = await setupBasicFixture();
        host.members.set(MEMBERS_7);
        fixture.detectChanges();
        simulateWidth(136, fixture);

        press(getOverflow(fixture) as HTMLElement, key);

        expect(host.overflowClickCount).toBe(1);
        expect(host.lastOverflowClick).toEqual(MEMBERS_7.slice(3));
        expect(host.groupClickCount).toBe(0);
      },
    );

    it('should leave the overflow keydown to the native button', async () => {
      const { fixture, host } = await setupBasicFixture();
      host.members.set(MEMBERS_7);
      fixture.detectChanges();
      simulateWidth(136, fixture);

      // No keydown handler: the button's own click is the one emission, and
      // a native button scrolls nothing on Space, so nothing is cancelled.
      const space = dispatchKeydown(getOverflow(fixture) as HTMLElement, ' ');

      expect(space.defaultPrevented).toBe(false);
      expect(host.overflowClickCount).toBe(0);
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

/**
 * The member popup opens on hover and focus of the `+N` counter and has no
 * backdrop, so it is dismissed by a document-level click listener. The
 * counter is a native `<button>`: Enter / Space on it fire a `click`, and a
 * click on the counter would count as "outside" the panel unless the popup
 * lists the counter in `dismissExcludeElements` — activating the focused
 * counter would then collapse the preview it just announced as expanded, and
 * a second press would never bring it back (#328 review F1).
 */
describe('MlvAvatarGroup member popup — activation keeps it open', () => {
  let overlayContainer: OverlayContainer;

  afterEach(() => overlayContainer?.ngOnDestroy());

  /** Waits for the deferred (`setTimeout(0)`) document click listener. */
  const nextMacrotask = (): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, 5));

  async function setupOverflowing(): Promise<{
    fixture: ComponentFixture<BasicTestHost>;
    host: BasicTestHost;
    counter: HTMLElement;
  }> {
    const { fixture, host } = await setupBasicFixture();
    overlayContainer = TestBed.inject(OverlayContainer);
    host.members.set(MEMBERS_7);
    fixture.detectChanges();
    simulateWidth(136, fixture);
    await fixture.whenStable();
    return { fixture, host, counter: getOverflow(fixture) as HTMLElement };
  }

  async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await nextMacrotask();
  }

  it.each(['Enter', ' '] as const)(
    'keeps the popup expanded when %s activates the focused counter',
    async (key) => {
      const { fixture, host, counter } = await setupOverflowing();

      counter.focus();
      await settle(fixture);
      expect(counter.getAttribute('aria-expanded')).toBe('true');

      press(counter, key);
      fixture.detectChanges();
      press(counter, key);
      fixture.detectChanges();

      expect(counter.getAttribute('aria-expanded')).toBe('true');
      expect(host.overflowClickCount).toBe(2);
    },
  );

  it('keeps the hover-opened popup expanded on a pointer click on the counter', async () => {
    const { fixture, host, counter } = await setupOverflowing();

    counter.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
    await settle(fixture);
    expect(counter.getAttribute('aria-expanded')).toBe('true');

    counter.click();
    fixture.detectChanges();

    expect(counter.getAttribute('aria-expanded')).toBe('true');
    expect(host.overflowClickCount).toBe(1);
  });

  it('still closes the popup on a click outside the counter and the panel', async () => {
    const { fixture, counter } = await setupOverflowing();

    counter.focus();
    await settle(fixture);
    expect(counter.getAttribute('aria-expanded')).toBe('true');

    document.body.click();
    fixture.detectChanges();

    expect(counter.getAttribute('aria-expanded')).toBe('false');
  });
});

/**
 * Accessibility sweep.
 *
 * The group's markup is not one shape but several, and most of them only
 * exist in some state: under `interactive` the visible avatars move into an
 * inner action `<button>` inside the `role="group"` host, an overflowing
 * group adds the `+N` counter as a second, separately-named `<button>` —
 * beside the action button, never inside it (#328) — and the member popup, a
 * `role="list"` portaled into the CDK overlay container, outside
 * `fixture.nativeElement` entirely, only exists while open. A sweep of the
 * default render sees none of that, so each is swept in the state that
 * produces it.
 */
describe('MlvAvatarGroup accessibility', () => {
  let overlayContainer: OverlayContainer;

  afterEach(() => overlayContainer?.ngOnDestroy());

  it('has no axe violations for a plain group that fits', async () => {
    const { fixture } = await setupBasicFixture();
    overlayContainer = TestBed.inject(OverlayContainer);
    simulateWidth(9999, fixture);
    await fixture.whenStable();

    // State: three avatars, no overflow counter, host named by total count.
    expect(getAvatarItems(fixture)).toHaveLength(3);
    expect(getOverflow(fixture)).toBeNull();
    expect(getHost(fixture).getAttribute('role')).toBe('group');
    expect(getHost(fixture).getAttribute('aria-label')).toBe('3 members');

    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });

  it('has no axe violations for an interactive group', async () => {
    const { fixture, host } = await setupBasicFixture();
    overlayContainer = TestBed.inject(OverlayContainer);
    host.interactive.set(true);
    fixture.detectChanges();
    simulateWidth(9999, fixture);
    await fixture.whenStable();

    // State: the host stays a named group and the avatars sit inside a named
    // action button — the one tab stop.
    const el = getHost(fixture);
    expect(el.getAttribute('role')).toBe('group');
    expect(el.hasAttribute('tabindex')).toBe(false);
    expect(el.getAttribute('aria-label')).toBe('3 members');
    expect(getAction(fixture)?.tagName).toBe('BUTTON');
    expect(getAction(fixture)?.getAttribute('aria-label')).toBe('3 members');

    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });

  it('has no axe violations for an interactive group with the +N counter', async () => {
    const { fixture, host } = await setupBasicFixture();
    overlayContainer = TestBed.inject(OverlayContainer);
    host.interactive.set(true);
    host.members.set(MEMBERS_7);
    fixture.detectChanges();
    simulateWidth(136, fixture);
    await fixture.whenStable();

    // State (#328): the shape docs example 4 documents. Before, the counter
    // was a `role="button"` inside a `role="button"` host, which raised
    // `nested-interactive`; now the two are sibling buttons in a group.
    const action = getAction(fixture) as HTMLElement;
    const overflow = getOverflow(fixture) as HTMLElement;
    expect(getHost(fixture).getAttribute('role')).toBe('group');
    expect(getHost(fixture).getAttribute('aria-label')).toBe(
      '7 members, 3 shown',
    );
    expect(action.tagName).toBe('BUTTON');
    expect(overflow.tagName).toBe('BUTTON');
    expect(action.contains(overflow)).toBe(false);
    expect(getOverflowInitials(fixture)).toBe('+4');

    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });

  it('has no axe violations for an empty group', async () => {
    resizeSubject = new Subject<ResizeObserverEntry[]>();
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
    overlayContainer = TestBed.inject(OverlayContainer);

    const fixture = TestBed.createComponent(EmptyTestHost);
    fixture.detectChanges();
    await fixture.whenStable();

    // State: no avatars at all, and the host still carries a name rather than
    // an empty `aria-label`.
    expect(getAvatarItems(fixture)).toHaveLength(0);
    expect(getHost(fixture).getAttribute('aria-label')).toBe('No members');

    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });

  it('has no axe violations with the +N counter rendered', async () => {
    const { fixture, host } = await setupBasicFixture();
    overlayContainer = TestBed.inject(OverlayContainer);
    host.members.set(MEMBERS_7);
    fixture.detectChanges();
    simulateWidth(136, fixture);
    await fixture.whenStable();

    // State: three visible avatars plus a named counter `<button>` that is a
    // tab stop of its own inside the group.
    const overflow = getOverflow(fixture) as HTMLElement;
    expect(getAvatarItems(fixture)).toHaveLength(3);
    expect(getOverflowInitials(fixture)).toBe('+4');
    expect(overflow.tagName).toBe('BUTTON');
    expect(overflow.getAttribute('aria-label')).toBeTruthy();

    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });

  it('has no axe violations with the member popup open', async () => {
    const { fixture, host } = await setupBasicFixture();
    overlayContainer = TestBed.inject(OverlayContainer);
    const overlayEl = overlayContainer.getContainerElement();

    host.members.set(MEMBERS_7);
    fixture.detectChanges();
    simulateWidth(136, fixture);
    await fixture.whenStable();

    // `triggerOn` is `['hover', 'focus']`, so a pointer entering the counter
    // is what a user does to reveal the hidden members.
    (getOverflow(fixture) as HTMLElement).dispatchEvent(
      new MouseEvent('mouseenter', { bubbles: false }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // State: the popup is attached and lists ALL seven members, not just the
    // hidden four. It lives in the overlay container, so the fixture root
    // cannot see it — sweep the document.
    const list = overlayEl.querySelector('[role="list"]') as HTMLElement;
    expect(list).toBeTruthy();
    expect(list.querySelectorAll('[role="listitem"]')).toHaveLength(7);
    expect(list.getAttribute('aria-label')).toBeTruthy();

    await expectNoAxeViolations(document.body);
  });
});
