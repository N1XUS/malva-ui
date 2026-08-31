import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { OverlayContainer } from '@angular/cdk/overlay';
import { MlvMenubar } from './menubar';
import { MlvMenu } from './menu';
import { MlvMenuItem } from './menu-item';
import { MlvMenuTrigger } from './menu-trigger';
import { MlvListItem } from '@malva-ui/core/list';

// Key codes CDK's ListKeyManager reads from `event.keyCode`.
const KEY = { left: 37, up: 38, right: 39, down: 40, home: 36, end: 35 };

/**
 * Dispatches a keydown whose `keyCode` is set (jsdom leaves it `0` otherwise),
 * which CDK's `FocusKeyManager` requires for arrow / Home / End navigation.
 */
function fireKey(el: Element, key: string, keyCode?: number): void {
  const event = new KeyboardEvent('keydown', { key, bubbles: true });
  if (keyCode !== undefined) {
    Object.defineProperty(event, 'keyCode', { get: () => keyCode });
  }
  el.dispatchEvent(event);
}

@Component({
  imports: [MlvMenubar, MlvMenu, MlvMenuItem, MlvMenuTrigger, MlvListItem],
  template: `
    <mlv-menubar aria-label="Main">
      <button #fileBtn [mlvMenuTrigger]="fileMenu">File</button>
      <button #editBtn [mlvMenuTrigger]="editMenu">Edit</button>
      <button #viewBtn [mlvMenuTrigger]="viewMenu">View</button>
    </mlv-menubar>

    <mlv-menu #fileMenu label="File">
      <mlv-list-item mlvMenuItem (itemClick)="pick('New')">New</mlv-list-item>
      <mlv-list-item mlvMenuItem (itemClick)="pick('Open')">Open</mlv-list-item>
    </mlv-menu>

    <mlv-menu #editMenu label="Edit">
      <mlv-list-item mlvMenuItem (itemClick)="pick('Undo')">Undo</mlv-list-item>
      <mlv-list-item mlvMenuItem (itemClick)="pick('Redo')">Redo</mlv-list-item>
    </mlv-menu>

    <mlv-menu #viewMenu label="View">
      <mlv-list-item mlvMenuItem (itemClick)="pick('Zoom')"
        >Zoom In</mlv-list-item
      >
      <mlv-list-item
        mlvMenuItem
        [mlvMenuTrigger]="moreMenu"
        [isSubmenuTrigger]="true"
      >
        More
      </mlv-list-item>
    </mlv-menu>

    <mlv-menu #moreMenu label="More">
      <mlv-list-item mlvMenuItem (itemClick)="pick('Fullscreen')"
        >Fullscreen</mlv-list-item
      >
    </mlv-menu>
  `,
})
class MenubarHost {
  picked = '';
  pick(value: string): void {
    this.picked = value;
  }
}

describe('MlvMenubar', () => {
  let overlayContainer: OverlayContainer;
  let overlayContainerEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MenubarHost],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);
    overlayContainerEl = overlayContainer.getContainerElement();
  });

  afterEach(() => {
    overlayContainer.ngOnDestroy();
  });

  function createHost() {
    const fixture = TestBed.createComponent(MenubarHost);
    fixture.detectChanges();
    fixture.detectChanges();
    const bar = fixture.debugElement.query(By.css('.mlv-menubar'))
      .nativeElement as HTMLElement;
    const buttons = fixture.debugElement
      .queryAll(By.css('.mlv-menubar button'))
      .map((d) => d.nativeElement as HTMLButtonElement);
    return { fixture, bar, buttons };
  }

  async function openViaClick(
    fixture: ReturnType<typeof createHost>['fixture'],
    btn: HTMLElement,
  ) {
    btn.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  // ─── Roles & structure ───────────────────────────────────────────────────

  it('renders role="menubar" with horizontal orientation and aria-label', () => {
    const { bar } = createHost();
    expect(bar.getAttribute('role')).toBe('menubar');
    expect(bar.getAttribute('aria-orientation')).toBe('horizontal');
    expect(bar.getAttribute('aria-label')).toBe('Main');
  });

  it('assigns role="menuitem" and aria-haspopup="menu" to every top-level trigger', () => {
    const { buttons } = createHost();
    expect(buttons.length).toBe(3);
    for (const btn of buttons) {
      expect(btn.getAttribute('role')).toBe('menuitem');
      expect(btn.getAttribute('aria-haspopup')).toBe('menu');
    }
  });

  // ─── Roving tabindex ─────────────────────────────────────────────────────

  it('places only the first top-level item in the tab order (roving tabindex)', () => {
    const { buttons } = createHost();
    expect(buttons[0].getAttribute('tabindex')).toBe('0');
    expect(buttons[1].getAttribute('tabindex')).toBe('-1');
    expect(buttons[2].getAttribute('tabindex')).toBe('-1');
  });

  // ─── Arrow / Home / End navigation ───────────────────────────────────────

  it('moves the roving tabindex with ArrowRight and wraps from last to first', () => {
    const { fixture, buttons } = createHost();

    fireKey(buttons[0], 'ArrowRight', KEY.right);
    fixture.detectChanges();
    expect(buttons[1].getAttribute('tabindex')).toBe('0');
    expect(buttons[0].getAttribute('tabindex')).toBe('-1');

    fireKey(buttons[1], 'ArrowRight', KEY.right);
    fireKey(buttons[2], 'ArrowRight', KEY.right);
    fixture.detectChanges();
    // Wrapped back to the first item.
    expect(buttons[0].getAttribute('tabindex')).toBe('0');
  });

  it('moves the roving tabindex with ArrowLeft (wrapping) and Home/End', () => {
    const { fixture, buttons } = createHost();

    // ArrowLeft from the first item wraps to the last.
    fireKey(buttons[0], 'ArrowLeft', KEY.left);
    fixture.detectChanges();
    expect(buttons[2].getAttribute('tabindex')).toBe('0');

    fireKey(buttons[2], 'Home', KEY.home);
    fixture.detectChanges();
    expect(buttons[0].getAttribute('tabindex')).toBe('0');

    fireKey(buttons[0], 'End', KEY.end);
    fixture.detectChanges();
    expect(buttons[2].getAttribute('tabindex')).toBe('0');
  });

  it('type-ahead moves the roving tabindex to the matching top-level item', async () => {
    const { fixture, buttons } = createHost();

    fireKey(buttons[0], 'v');
    // Type-ahead is debounced (200 ms default).
    await new Promise((resolve) => setTimeout(resolve, 250));
    fixture.detectChanges();

    // "View" is the third item.
    expect(buttons[2].getAttribute('tabindex')).toBe('0');
    expect(buttons[0].getAttribute('tabindex')).toBe('-1');
  });

  // ─── Opening ─────────────────────────────────────────────────────────────

  it('opens the focused item menu on ArrowDown', async () => {
    const { fixture, buttons } = createHost();

    fireKey(buttons[0], 'ArrowDown', KEY.down);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(buttons[0].getAttribute('aria-expanded')).toBe('true');
    expect(
      overlayContainerEl.querySelector('[role="menu"][aria-label="File"]'),
    ).toBeTruthy();
  });

  it('opens the menu and marks aria-expanded on click', async () => {
    const { fixture, buttons } = createHost();
    await openViaClick(fixture, buttons[1]);

    expect(buttons[1].getAttribute('aria-expanded')).toBe('true');
    expect(
      overlayContainerEl.querySelector('[role="menu"][aria-label="Edit"]'),
    ).toBeTruthy();
  });

  it('opens the focused item menu on Enter', async () => {
    const { fixture, buttons } = createHost();

    fireKey(buttons[1], 'Enter');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(buttons[1].getAttribute('aria-expanded')).toBe('true');
    expect(
      overlayContainerEl.querySelector('[role="menu"][aria-label="Edit"]'),
    ).toBeTruthy();
  });

  it('opens the focused item menu on Space', async () => {
    const { fixture, buttons } = createHost();

    fireKey(buttons[2], ' ');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(buttons[2].getAttribute('aria-expanded')).toBe('true');
    expect(
      overlayContainerEl.querySelector('[role="menu"][aria-label="View"]'),
    ).toBeTruthy();
  });

  it('opens the focused item menu on ArrowUp (last item focused)', async () => {
    const { fixture, buttons } = createHost();

    fireKey(buttons[0], 'ArrowUp', KEY.up);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(buttons[0].getAttribute('aria-expanded')).toBe('true');
    expect(
      overlayContainerEl.querySelector('[role="menu"][aria-label="File"]'),
    ).toBeTruthy();
  });

  // ─── Hover-follow (only while a menu is already open) ─────────────────────

  it('does NOT open a menu on hover when the bar is fully closed', () => {
    const { fixture, buttons } = createHost();

    buttons[0].dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    fixture.detectChanges();

    expect(overlayContainerEl.querySelector('[role="menu"]')).toBeNull();
    expect(buttons[0].getAttribute('aria-expanded')).toBe('false');
  });

  it('switches menus when hovering a sibling while a menu is open (hover-follow)', async () => {
    const { fixture, buttons } = createHost();
    await openViaClick(fixture, buttons[0]);
    expect(
      overlayContainerEl.querySelector('[role="menu"][aria-label="File"]'),
    ).toBeTruthy();

    buttons[1].dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // The Edit menu is now open.
    expect(buttons[1].getAttribute('aria-expanded')).toBe('true');
    expect(
      overlayContainerEl.querySelector('[role="menu"][aria-label="Edit"]'),
    ).toBeTruthy();
  });

  // ─── In-menu ArrowRight / ArrowLeft cross to sibling menubar menus ────────

  it('crosses to the next menubar menu on ArrowRight inside an open dropdown', async () => {
    const { fixture, buttons } = createHost();
    await openViaClick(fixture, buttons[0]);

    const panel = overlayContainerEl.querySelector(
      '[role="menu"][aria-label="File"]',
    ) as HTMLElement;
    fireKey(panel, 'ArrowRight', KEY.right);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      overlayContainerEl.querySelector('[role="menu"][aria-label="Edit"]'),
    ).toBeTruthy();
  });

  it('crosses to the previous menubar menu on ArrowLeft inside an open dropdown (wraps)', async () => {
    const { fixture, buttons } = createHost();
    await openViaClick(fixture, buttons[0]);

    const panel = overlayContainerEl.querySelector(
      '[role="menu"][aria-label="File"]',
    ) as HTMLElement;
    fireKey(panel, 'ArrowLeft', KEY.left);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // Wraps from the first item (File) to the last (View).
    expect(
      overlayContainerEl.querySelector('[role="menu"][aria-label="View"]'),
    ).toBeTruthy();
  });

  it('opens a submenu (not a sibling) on ArrowRight over a submenu-trigger item — submenu wins', async () => {
    const { fixture, buttons } = createHost();
    await openViaClick(fixture, buttons[2]); // View menu

    const moreItem = Array.from(
      overlayContainerEl.querySelectorAll('[role="menuitem"]'),
    ).find((el) => el.textContent?.trim() === 'More') as HTMLElement;
    expect(moreItem).toBeTruthy();

    fireKey(moreItem, 'ArrowRight', KEY.right);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // The View submenu ("More") opened; no sibling menubar menu was crossed to.
    expect(
      overlayContainerEl.querySelector('[role="menu"][aria-label="More"]'),
    ).toBeTruthy();
    expect(
      overlayContainerEl.querySelector('[role="menu"][aria-label="Edit"]'),
    ).toBeNull();
  });

  // ─── Escape ──────────────────────────────────────────────────────────────

  it('closes the open menu on Escape and restores aria-expanded', async () => {
    const { fixture, buttons } = createHost();
    await openViaClick(fixture, buttons[0]);

    const panel = overlayContainerEl.querySelector(
      '[role="menu"][aria-label="File"]',
    ) as HTMLElement;
    fireKey(panel, 'Escape');
    fixture.detectChanges();
    await fixture.whenStable();

    // Simulate the CSS leave animation completing (jsdom fires no animationend).
    overlayContainerEl
      .querySelector('.mlv-popup--leave')
      ?.dispatchEvent(new Event('animationend', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(
      overlayContainerEl.querySelector('[role="menu"][aria-label="File"]'),
    ).toBeNull();
    expect(buttons[0].getAttribute('aria-expanded')).toBe('false');
  });
});
