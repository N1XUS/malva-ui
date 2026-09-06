import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { OverlayContainer } from '@angular/cdk/overlay';
import axe from 'axe-core';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { MlvListItem } from '@malva-ui/core/list';
import { MlvMenu } from './menu';
import { MlvMenuItem } from './menu-item';
import { MlvMenuSeparator } from './menu-separator';
import {
  MlvContextMenuTrigger,
  mlvClaimContextMenuKey,
  mlvIsContextMenuKey,
} from './context-menu-trigger';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Builds a `contextmenu` event that looks like a real right-click. */
function rightClick(x: number, y: number): MouseEvent {
  return new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 2,
    buttons: 2,
    detail: 0,
  });
}

/**
 * Builds the `contextmenu` event browsers synthesise for the ContextMenu key
 * and Shift+F10 — no click count, and no cursor to report.
 */
function keyboardContextMenu(): MouseEvent {
  return new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX: 0,
    clientY: 0,
    button: 0,
    buttons: 0,
    detail: 0,
  });
}

/**
 * Builds the `contextmenu` event macOS dispatches for Ctrl+click and Android
 * for a touch long-press: a real pointer gesture that nonetheless reports
 * `button: 0`, which is why the button is not what tells the two apart.
 */
function ctrlClick(x: number, y: number): MouseEvent {
  return new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0,
    buttons: 0,
    detail: 1,
    ctrlKey: true,
  });
}

/**
 * The `keydown` a browser delivers for Shift+F10 — on macOS the only thing it
 * delivers, since Chromium and WebKit there synthesise no `contextmenu` from
 * the keyboard at all.
 */
function shiftF10(init: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key: 'F10',
    shiftKey: true,
    bubbles: true,
    cancelable: true,
    ...init,
  });
}

/** The `keydown` of the dedicated ContextMenu (Menu / Application) key. */
function contextMenuKey(): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key: 'ContextMenu',
    bubbles: true,
    cancelable: true,
  });
}

/** Waits for the macrotask queue so `setTimeout(…, 0)` focus hops settle. */
function flushTimers(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ─── Test host components ─────────────────────────────────────────────────────

@Component({
  imports: [
    MlvMenu,
    MlvMenuItem,
    MlvMenuSeparator,
    MlvContextMenuTrigger,
    MlvListItem,
  ],
  template: `
    <div
      data-target
      [mlvContextMenuTrigger]="menu"
      [contextMenuDisabled]="disabled()"
      (menuOpened)="openedCount = openedCount + 1"
      (menuClosed)="closedCount = closedCount + 1"
    >
      Right-click me
    </div>
    <mlv-menu #menu>
      <mlv-list-item mlvMenuItem (itemClick)="onEdit()">Edit</mlv-list-item>
      <mlv-menu-separator />
      <mlv-list-item mlvMenuItem (itemClick)="onDelete()">Delete</mlv-list-item>
    </mlv-menu>
  `,
})
class TargetedHost {
  readonly disabled = signal(false);
  openedCount = 0;
  closedCount = 0;
  editCalled = false;
  deleteCalled = false;
  onEdit() {
    this.editCalled = true;
  }
  onDelete() {
    this.deleteCalled = true;
  }
}

@Component({
  imports: [MlvMenu, MlvMenuItem, MlvContextMenuTrigger, MlvListItem],
  template: `
    <div data-target [mlvContextMenuTrigger]="menu" global>Anywhere</div>
    <div data-outside>Outside the trigger</div>
    <input data-field />
    <mlv-menu #menu>
      <mlv-list-item mlvMenuItem>Edit</mlv-list-item>
    </mlv-menu>
  `,
})
class GlobalHost {}

@Component({
  imports: [MlvMenu, MlvMenuItem, MlvContextMenuTrigger, MlvListItem],
  template: `
    <div data-page [mlvContextMenuTrigger]="pageMenu" global>
      <div data-card [mlvContextMenuTrigger]="cardMenu">Card</div>
    </div>
    <mlv-menu #cardMenu label="Card">
      <mlv-list-item mlvMenuItem>Rename</mlv-list-item>
    </mlv-menu>
    <mlv-menu #pageMenu label="Page">
      <mlv-list-item mlvMenuItem>Reload</mlv-list-item>
    </mlv-menu>
  `,
})
class NestedGlobalHost {}

@Component({
  imports: [MlvMenu, MlvMenuItem, MlvContextMenuTrigger, MlvListItem],
  template: `
    <div data-page [mlvContextMenuTrigger]="pageMenu">
      <div data-card [mlvContextMenuTrigger]="cardMenu">Card</div>
    </div>
    <mlv-menu #cardMenu label="Card">
      <mlv-list-item mlvMenuItem>Rename</mlv-list-item>
    </mlv-menu>
    <mlv-menu #pageMenu label="Page">
      <mlv-list-item mlvMenuItem>Reload</mlv-list-item>
    </mlv-menu>
  `,
})
class NestedTargetedHost {}

@Component({
  imports: [MlvMenu, MlvMenuItem, MlvContextMenuTrigger, MlvListItem],
  template: `
    <div data-target role="button" tabindex="0" [mlvContextMenuTrigger]="menu">
      Widget host
    </div>
    <mlv-menu #menu>
      <mlv-list-item mlvMenuItem>Edit</mlv-list-item>
    </mlv-menu>
  `,
})
class WidgetHost {}

@Component({
  imports: [MlvMenu, MlvMenuItem, MlvContextMenuTrigger, MlvListItem],
  template: `
    <div dir="rtl">
      <div data-target [mlvContextMenuTrigger]="menu">Right-click me</div>
    </div>
    <mlv-menu #menu>
      <mlv-list-item mlvMenuItem>Edit</mlv-list-item>
    </mlv-menu>
  `,
})
class ScopedRtlHost {}

/**
 * One trigger shared by many elements: the host element never sees a
 * right-click itself, and the owner hands `openAt` / `openFromEvent` the row
 * that was actually right-clicked. Row B sits in its own `[dir]` scope so the
 * pane's direction proves which element the panel resolved against.
 */
@Component({
  imports: [MlvMenu, MlvMenuItem, MlvContextMenuTrigger, MlvListItem],
  template: `
    <span data-trigger hidden [mlvContextMenuTrigger]="menu"></span>
    <div data-row-a tabindex="0">Row A</div>
    <div dir="rtl">
      <div data-row-b tabindex="0">Row B</div>
    </div>
    <mlv-menu #menu>
      <mlv-list-item mlvMenuItem>Edit</mlv-list-item>
    </mlv-menu>
  `,
})
class SharedTriggerHost {}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MlvContextMenuTrigger', () => {
  let overlayContainer: OverlayContainer;
  let overlayContainerEl: HTMLElement;
  let rtlService: MlvRtlService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        TargetedHost,
        GlobalHost,
        NestedGlobalHost,
        NestedTargetedHost,
        WidgetHost,
        ScopedRtlHost,
        SharedTriggerHost,
      ],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);
    overlayContainerEl = overlayContainer.getContainerElement();
    rtlService = TestBed.inject(MlvRtlService);
  });

  afterEach(() => {
    rtlService.setDirection('ltr');
    overlayContainer.ngOnDestroy();
  });

  /** Creates a `TargetedHost` fixture and returns it with its trigger element. */
  async function createTargeted() {
    const fixture = TestBed.createComponent(TargetedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const target = fixture.debugElement.query(By.css('[data-target]'))
      .nativeElement as HTMLElement;
    return { fixture, target };
  }

  /**
   * The overlay pane. With `withFlexibleDimensions(false)` CDK takes its exact
   * -position path, which writes the resolved coordinates onto the pane itself
   * and leaves the bounding box filling the viewport.
   */
  function pane(): HTMLElement | null {
    return overlayContainerEl.querySelector('.cdk-overlay-pane');
  }

  /**
   * The connected-position bounding box — the overlay *host*, which is where
   * `OverlayRef.setDirection` writes `dir`.
   */
  function boundingBox(): HTMLElement | null {
    return overlayContainerEl.querySelector(
      '.cdk-overlay-connected-position-bounding-box',
    );
  }

  /**
   * Closes an open panel the way a user would and lets the overlay tear down.
   * jsdom fires no real `animationend`, so the leave animation is completed by
   * hand — the same pattern the rest of the menu suite uses.
   */
  async function pressEscape(
    fixture: { detectChanges(): void; whenStable(): Promise<unknown> },
    panel: HTMLElement,
  ): Promise<void> {
    panel.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    overlayContainerEl
      .querySelector('.mlv-popup--leave')
      ?.dispatchEvent(new Event('animationend', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  // ─── Trigger ──────────────────────────────────────────────────────────────

  it('opens the bound menu panel on right-click', async () => {
    const { fixture, target } = await createTargeted();

    target.dispatchEvent(rightClick(120, 90));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(overlayContainerEl.querySelector('[role="menu"]')).toBeTruthy();
    expect(
      overlayContainerEl.querySelectorAll('[role="menuitem"]').length,
    ).toBe(2);
  });

  it('suppresses the native browser context menu while active', async () => {
    const { fixture, target } = await createTargeted();

    const event = rightClick(120, 90);
    target.dispatchEvent(event);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(event.defaultPrevented).toBe(true);
  });

  it('does not open or suppress the native menu when disabled', async () => {
    const { fixture, target } = await createTargeted();
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const event = rightClick(120, 90);
    target.dispatchEvent(event);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(overlayContainerEl.querySelector('[role="menu"]')).toBeNull();
    expect(event.defaultPrevented).toBe(false);
  });

  it('emits menuOpened when it opens and menuClosed when it closes', async () => {
    const { fixture, target } = await createTargeted();

    target.dispatchEvent(rightClick(120, 90));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.openedCount).toBe(1);

    const panel = overlayContainerEl.querySelector(
      '[role="menu"]',
    ) as HTMLElement;
    await pressEscape(fixture, panel);

    expect(fixture.componentInstance.closedCount).toBe(1);
  });

  // ─── Positioning ──────────────────────────────────────────────────────────

  it('anchors the panel at the cursor position, not at the trigger box', async () => {
    const { fixture, target } = await createTargeted();

    target.dispatchEvent(rightClick(150, 220));
    fixture.detectChanges();
    await fixture.whenStable();

    // The trigger's own box is at the jsdom origin (0, 0); the panel must not
    // be, or it is anchored to the element rather than to the pointer.
    expect(target.getBoundingClientRect().left).toBe(0);
    expect(pane()?.style.left).toBe('150px');
    expect(pane()?.style.top).toBe('220px');
  });

  it('re-anchors to the new cursor position on a second right-click', async () => {
    const { fixture, target } = await createTargeted();

    target.dispatchEvent(rightClick(150, 220));
    fixture.detectChanges();
    await fixture.whenStable();

    target.dispatchEvent(rightClick(310, 45));
    fixture.detectChanges();
    await fixture.whenStable();

    // Still exactly one panel — a second right-click moves it, never stacks it.
    expect(overlayContainerEl.querySelectorAll('[role="menu"]').length).toBe(1);
    expect(pane()?.style.left).toBe('310px');
    expect(pane()?.style.top).toBe('45px');
  });

  // ─── Keyboard ─────────────────────────────────────────────────────────────

  it('closes on Escape', async () => {
    const { fixture, target } = await createTargeted();

    target.dispatchEvent(rightClick(120, 90));
    fixture.detectChanges();
    await fixture.whenStable();

    const panel = overlayContainerEl.querySelector(
      '[role="menu"]',
    ) as HTMLElement;
    await pressEscape(fixture, panel);

    expect(overlayContainerEl.querySelector('[role="menu"]')).toBeNull();
  });

  it('anchors to the trigger element and focuses the first item for a keyboard-initiated context menu', async () => {
    const { fixture, target } = await createTargeted();
    target.tabIndex = 0;
    target.focus();

    target.dispatchEvent(keyboardContextMenu());
    fixture.detectChanges();
    await fixture.whenStable();
    await flushTimers();
    fixture.detectChanges();
    await fixture.whenStable();

    const items = overlayContainerEl.querySelectorAll('[role="menuitem"]');
    expect(document.activeElement).toBe(items[0]);
  });

  // ─── Keyboard keys handled by the directive itself ────────────────────────

  it('opens anchored to the host with the first item focused on the Shift+F10 keydown, without waiting for a synthesised contextmenu', async () => {
    const { fixture, target } = await createTargeted();
    target.tabIndex = 0;
    target.focus();

    const event = shiftF10();
    target.dispatchEvent(event);
    fixture.detectChanges();
    await fixture.whenStable();
    await flushTimers();
    fixture.detectChanges();
    await fixture.whenStable();

    // Prevented, so a browser that would synthesise `contextmenu` from this
    // keydown (Windows, Linux) no longer does — one open, not two.
    expect(event.defaultPrevented).toBe(true);
    expect(overlayContainerEl.querySelector('[role="menu"]')).toBeTruthy();
    // Element-anchored: the host box, not a cursor point.
    expect(pane()?.style.left).toBe('0px');
    expect(document.activeElement).toBe(
      overlayContainerEl.querySelector('[role="menuitem"]'),
    );
  });

  it('opens on the ContextMenu key', async () => {
    const { fixture, target } = await createTargeted();
    target.tabIndex = 0;
    target.focus();

    const event = contextMenuKey();
    target.dispatchEvent(event);
    fixture.detectChanges();
    await fixture.whenStable();
    await flushTimers();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(
      overlayContainerEl.querySelector('[role="menuitem"]'),
    );
  });

  it('ignores a plain F10, a differently modified Shift+F10 and any other key', async () => {
    const { fixture, target } = await createTargeted();

    for (const event of [
      shiftF10({ shiftKey: false }),
      shiftF10({ ctrlKey: true }),
      shiftF10({ altKey: true }),
      shiftF10({ metaKey: true }),
      new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      }),
    ]) {
      target.dispatchEvent(event);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(event.defaultPrevented).toBe(false);
      expect(overlayContainerEl.querySelector('[role="menu"]')).toBeNull();
    }
  });

  it('leaves the Shift+F10 keydown alone while disabled', async () => {
    const { fixture, target } = await createTargeted();
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const event = shiftF10();
    target.dispatchEvent(event);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(event.defaultPrevented).toBe(false);
    expect(overlayContainerEl.querySelector('[role="menu"]')).toBeNull();
  });

  it('re-anchors to the host and focuses the first item on Shift+F10 while the panel is open', async () => {
    const { fixture, target } = await createTargeted();
    target.tabIndex = 0;

    target.dispatchEvent(rightClick(150, 220));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(pane()?.style.left).toBe('150px');

    target.dispatchEvent(shiftF10());
    fixture.detectChanges();
    await fixture.whenStable();
    await flushTimers();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(overlayContainerEl.querySelectorAll('[role="menu"]').length).toBe(1);
    expect(pane()?.style.left).toBe('0px');
    expect(document.activeElement).toBe(
      overlayContainerEl.querySelector('[role="menuitem"]'),
    );
  });

  it('opens from a Shift+F10 keydown anywhere in the document in global mode', async () => {
    const fixture = TestBed.createComponent(GlobalHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const outside = fixture.debugElement.query(By.css('[data-outside]'))
      .nativeElement as HTMLElement;
    const event = shiftF10();
    outside.dispatchEvent(event);
    fixture.detectChanges();
    await fixture.whenStable();
    await flushTimers();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(
      overlayContainerEl.querySelector('[role="menuitem"]'),
    );
  });

  it('leaves a text field its own native menu on Shift+F10 in global mode', async () => {
    const fixture = TestBed.createComponent(GlobalHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const field = fixture.debugElement.query(By.css('[data-field]'))
      .nativeElement as HTMLElement;
    const event = shiftF10();
    field.dispatchEvent(event);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(event.defaultPrevented).toBe(false);
    expect(overlayContainerEl.querySelector('[role="menu"]')).toBeNull();
  });

  it('opens only the nearest panel on Shift+F10 when a targeted trigger sits inside a global one', async () => {
    const fixture = TestBed.createComponent(NestedGlobalHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const card = fixture.debugElement.query(By.css('[data-card]'))
      .nativeElement as HTMLElement;
    card.dispatchEvent(shiftF10());
    fixture.detectChanges();
    await fixture.whenStable();

    const menus = overlayContainerEl.querySelectorAll('[role="menu"]');
    expect(menus.length).toBe(1);
    expect(menus[0].getAttribute('aria-label')).toBe('Card');
  });

  it('claims the ContextMenu key keyup — the event Windows synthesises contextmenu from — once, after it opened on the keydown', async () => {
    const { fixture, target } = await createTargeted();
    target.tabIndex = 0;
    target.focus();

    target.dispatchEvent(contextMenuKey());
    fixture.detectChanges();
    await fixture.whenStable();
    await flushTimers();
    fixture.detectChanges();
    await fixture.whenStable();

    // Focus has moved into the panel by the time the key is released, so the
    // keyup lands on a menu item, not on the host.
    const item = document.activeElement as HTMLElement;
    expect(item.getAttribute('role')).toBe('menuitem');
    const keyup = new KeyboardEvent('keyup', {
      key: 'ContextMenu',
      bubbles: true,
      cancelable: true,
    });
    item.dispatchEvent(keyup);
    expect(keyup.defaultPrevented).toBe(true);

    // The guard is one press long: a later ContextMenu keyup with no claimed
    // keydown before it is the browser's again.
    const later = new KeyboardEvent('keyup', {
      key: 'ContextMenu',
      bubbles: true,
      cancelable: true,
    });
    item.dispatchEvent(later);
    expect(later.defaultPrevented).toBe(false);
  });

  it('claims a held key’s repeats without re-opening or moving focus again', async () => {
    const { fixture, target } = await createTargeted();
    target.tabIndex = 0;
    target.focus();

    target.dispatchEvent(shiftF10());
    fixture.detectChanges();
    await fixture.whenStable();
    await flushTimers();
    fixture.detectChanges();
    await fixture.whenStable();

    const items =
      overlayContainerEl.querySelectorAll<HTMLElement>('[role="menuitem"]');
    items[1].focus();
    expect(document.activeElement).toBe(items[1]);

    const repeat = shiftF10({ repeat: true });
    target.dispatchEvent(repeat);
    fixture.detectChanges();
    await fixture.whenStable();
    await flushTimers();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(repeat.defaultPrevented).toBe(true);
    expect(overlayContainerEl.querySelectorAll('[role="menu"]').length).toBe(1);
    expect(document.activeElement).toBe(items[1]);
  });

  it('opens only the nearest panel on Shift+F10 when a targeted trigger sits inside another targeted one', async () => {
    const fixture = TestBed.createComponent(NestedTargetedHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const card = fixture.debugElement.query(By.css('[data-card]'))
      .nativeElement as HTMLElement;
    card.dispatchEvent(shiftF10());
    fixture.detectChanges();
    await fixture.whenStable();

    const menus = overlayContainerEl.querySelectorAll('[role="menu"]');
    expect(menus.length).toBe(1);
    expect(menus[0].getAttribute('aria-label')).toBe('Card');
  });

  it('opens only the nearest panel on a right-click when a targeted trigger sits inside another targeted one', async () => {
    const fixture = TestBed.createComponent(NestedTargetedHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const card = fixture.debugElement.query(By.css('[data-card]'))
      .nativeElement as HTMLElement;
    card.dispatchEvent(rightClick(40, 50));
    fixture.detectChanges();
    await fixture.whenStable();

    const menus = overlayContainerEl.querySelectorAll('[role="menu"]');
    expect(menus.length).toBe(1);
    expect(menus[0].getAttribute('aria-label')).toBe('Card');
  });

  it('mlvClaimContextMenuKey prevents the keydown, guards one ContextMenu keyup, and arms nothing for a repeat', () => {
    const f10 = shiftF10();
    mlvClaimContextMenuKey(f10, document);
    expect(f10.defaultPrevented).toBe(true);
    // Shift+F10 is synthesised from the keydown only; no keyup guard.
    const f10Up = new KeyboardEvent('keyup', { key: 'F10', cancelable: true });
    document.dispatchEvent(f10Up);
    expect(f10Up.defaultPrevented).toBe(false);

    const repeat = new KeyboardEvent('keydown', {
      key: 'ContextMenu',
      repeat: true,
      cancelable: true,
    });
    mlvClaimContextMenuKey(repeat, document);
    expect(repeat.defaultPrevented).toBe(true);
    const unguarded = new KeyboardEvent('keyup', {
      key: 'ContextMenu',
      cancelable: true,
    });
    document.dispatchEvent(unguarded);
    expect(unguarded.defaultPrevented).toBe(false);

    const press = contextMenuKey();
    mlvClaimContextMenuKey(press, document);
    mlvClaimContextMenuKey(press, document); // a second claim of the same press
    const guarded = new KeyboardEvent('keyup', {
      key: 'ContextMenu',
      cancelable: true,
    });
    document.dispatchEvent(guarded);
    expect(guarded.defaultPrevented).toBe(true);
    const next = new KeyboardEvent('keyup', {
      key: 'ContextMenu',
      cancelable: true,
    });
    document.dispatchEvent(next);
    expect(next.defaultPrevented).toBe(false);
  });

  it('mlvIsContextMenuKey recognises exactly Shift+F10 and the ContextMenu key', () => {
    expect(mlvIsContextMenuKey(shiftF10())).toBe(true);
    expect(mlvIsContextMenuKey(contextMenuKey())).toBe(true);
    expect(mlvIsContextMenuKey(shiftF10({ shiftKey: false }))).toBe(false);
    expect(mlvIsContextMenuKey(shiftF10({ ctrlKey: true }))).toBe(false);
    expect(mlvIsContextMenuKey(shiftF10({ altKey: true }))).toBe(false);
    expect(mlvIsContextMenuKey(shiftF10({ metaKey: true }))).toBe(false);
    expect(
      mlvIsContextMenuKey(new KeyboardEvent('keydown', { key: 'Escape' })),
    ).toBe(false);
  });

  // ─── Global mode ──────────────────────────────────────────────────────────

  it('opens from a right-click anywhere in the document in global mode', async () => {
    const fixture = TestBed.createComponent(GlobalHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const outside = fixture.debugElement.query(By.css('[data-outside]'))
      .nativeElement as HTMLElement;
    outside.dispatchEvent(rightClick(200, 140));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(overlayContainerEl.querySelector('[role="menu"]')).toBeTruthy();
    expect(pane()?.style.left).toBe('200px');
  });

  it('leaves the native context menu alone inside its own open panel in global mode', async () => {
    const fixture = TestBed.createComponent(GlobalHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const outside = fixture.debugElement.query(By.css('[data-outside]'))
      .nativeElement as HTMLElement;
    outside.dispatchEvent(rightClick(200, 140));
    fixture.detectChanges();
    await fixture.whenStable();

    const panel = overlayContainerEl.querySelector(
      '[role="menu"]',
    ) as HTMLElement;
    const event = rightClick(210, 150);
    panel.dispatchEvent(event);
    fixture.detectChanges();
    await fixture.whenStable();

    // The panel is portaled to <body>; a document listener must not treat a
    // right-click inside it as a fresh open request.
    expect(event.defaultPrevented).toBe(false);
    expect(pane()?.style.left).toBe('200px');
  });

  // ─── Backdrop ─────────────────────────────────────────────────────────────

  it('opens without a CDK backdrop so later right-clicks still reach the page', async () => {
    const { fixture, target } = await createTargeted();

    target.dispatchEvent(rightClick(120, 90));
    fixture.detectChanges();
    await fixture.whenStable();

    // The CDK backdrop is `inset: 0` with `pointer-events: auto`, so it would
    // hit-test every later right-click before the trigger — and a right-click
    // fires no `click`, so it would not dismiss the panel in exchange. The
    // native browser menu would open over an unmovable panel.
    expect(
      overlayContainerEl.querySelector('.cdk-overlay-backdrop'),
    ).toBeNull();
  });

  it('still closes on a left-click outside without a backdrop', async () => {
    const { fixture, target } = await createTargeted();

    target.dispatchEvent(rightClick(120, 90));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(overlayContainerEl.querySelector('[role="menu"]')).toBeTruthy();

    // `MlvPopupService` defers its document listener by a macrotask so the
    // opening interaction cannot immediately dismiss the panel.
    await flushTimers();
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    overlayContainerEl
      .querySelector('.mlv-popup--leave')
      ?.dispatchEvent(new Event('animationend', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(overlayContainerEl.querySelector('[role="menu"]')).toBeNull();
  });

  // ─── Composition ──────────────────────────────────────────────────────────

  it('opens only the nearest panel when a targeted trigger sits inside a global one', async () => {
    const fixture = TestBed.createComponent(NestedGlobalHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const card = fixture.debugElement.query(By.css('[data-card]'))
      .nativeElement as HTMLElement;
    card.dispatchEvent(rightClick(140, 60));
    fixture.detectChanges();
    await fixture.whenStable();

    // The event still bubbles to the document after the host handler runs, so
    // without a `defaultPrevented` guard the global trigger would stack a
    // second panel at the same point.
    const panels = overlayContainerEl.querySelectorAll('[role="menu"]');
    expect(panels.length).toBe(1);
    expect(panels[0].getAttribute('aria-label')).toBe('Card');
  });

  it('opens the global panel for a right-click outside the nested trigger', async () => {
    const fixture = TestBed.createComponent(NestedGlobalHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const page = fixture.debugElement.query(By.css('[data-page]'))
      .nativeElement as HTMLElement;
    page.dispatchEvent(rightClick(140, 60));
    fixture.detectChanges();
    await fixture.whenStable();

    const panels = overlayContainerEl.querySelectorAll('[role="menu"]');
    expect(panels.length).toBe(1);
    expect(panels[0].getAttribute('aria-label')).toBe('Page');
  });

  it('leaves a text field its own native menu in global mode', async () => {
    const fixture = TestBed.createComponent(GlobalHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const field = fixture.debugElement.query(By.css('[data-field]'))
      .nativeElement as HTMLElement;
    const event = rightClick(60, 30);
    field.dispatchEvent(event);
    fixture.detectChanges();
    await fixture.whenStable();

    // Spell-check / paste / undo beat an application menu.
    expect(event.defaultPrevented).toBe(false);
    expect(overlayContainerEl.querySelector('[role="menu"]')).toBeNull();
  });

  // ─── Pointer-vs-keyboard detection ────────────────────────────────────────

  it('treats a macOS Ctrl+click as a pointer gesture, not a keyboard one', async () => {
    const { fixture, target } = await createTargeted();

    // `button` is 0 here even though this is a real pointer gesture, which is
    // why the button cannot be what separates pointer from keyboard.
    target.dispatchEvent(ctrlClick(210, 180));
    fixture.detectChanges();
    await fixture.whenStable();
    await flushTimers();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(pane()?.style.left).toBe('210px');
    expect(pane()?.style.top).toBe('180px');
    // A pointer open must not steal focus into the panel.
    expect(document.activeElement).not.toBe(
      overlayContainerEl.querySelector('[role="menuitem"]'),
    );
  });

  it('re-anchors to the host and focuses the first item when ContextMenu is pressed on an open panel', async () => {
    const { fixture, target } = await createTargeted();
    target.tabIndex = 0;

    target.dispatchEvent(rightClick(150, 220));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(pane()?.style.left).toBe('150px');

    target.dispatchEvent(keyboardContextMenu());
    fixture.detectChanges();
    await fixture.whenStable();
    await flushTimers();
    fixture.detectChanges();
    await fixture.whenStable();

    // Closing first would not work: close() only starts the leave animation and
    // leaves isOpen true, so the following open() would bail and the panel
    // would simply vanish.
    expect(overlayContainerEl.querySelectorAll('[role="menu"]').length).toBe(1);
    // Re-anchored to the host box (0,0 in jsdom), not left at the old cursor.
    expect(pane()?.style.left).toBe('0px');
    expect(document.activeElement).toBe(
      overlayContainerEl.querySelector('[role="menuitem"]'),
    );
  });

  // ─── Accessibility ────────────────────────────────────────────────────────

  it('has no aria-allowed-attr violations on a roleless host', async () => {
    const { fixture, target } = await createTargeted();
    target.dispatchEvent(rightClick(120, 90));
    fixture.detectChanges();
    await fixture.whenStable();

    const results = await axe.run(fixture.nativeElement as HTMLElement, {
      runOnly: { type: 'rule', values: ['aria-allowed-attr'] },
    });
    expect(results.violations).toEqual([]);
  });

  it('omits aria-expanded on a roleless host but keeps it on a widget host', async () => {
    const { target } = await createTargeted();

    // `aria-haspopup` is global and allowed anywhere; `aria-expanded` is not
    // allowed on role="generic", which is what a bare <div> resolves to.
    expect(target.getAttribute('aria-haspopup')).toBe('menu');
    expect(target.getAttribute('aria-expanded')).toBeNull();

    const widgetFixture = TestBed.createComponent(WidgetHost);
    widgetFixture.detectChanges();
    await widgetFixture.whenStable();
    const widget = widgetFixture.debugElement.query(By.css('[data-target]'))
      .nativeElement as HTMLElement;

    expect(widget.getAttribute('aria-expanded')).toBe('false');

    widget.dispatchEvent(rightClick(120, 90));
    widgetFixture.detectChanges();
    await widgetFixture.whenStable();

    const panelId = overlayContainerEl
      .querySelector('[role="menu"]')
      ?.getAttribute('id');
    expect(widget.getAttribute('aria-expanded')).toBe('true');
    expect(widget.getAttribute('aria-controls')).toBe(panelId);
  });

  // ─── RTL ──────────────────────────────────────────────────────────────────

  it('gives the portaled pane the direction scoped to its trigger', async () => {
    const fixture = TestBed.createComponent(ScopedRtlHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const target = fixture.debugElement.query(By.css('[data-target]'))
      .nativeElement as HTMLElement;
    target.dispatchEvent(rightClick(120, 90));
    fixture.detectChanges();
    await fixture.whenStable();

    // The document stays LTR — only the `[dir="rtl"]` ancestor scopes it.
    expect(rtlService.direction()).toBe('ltr');
    expect(boundingBox()?.getAttribute('dir')).toBe('rtl');
  });

  // ─── Anchored opens (one trigger, many elements) ──────────────────────────

  describe('anchored opens', () => {
    async function createShared() {
      const fixture = TestBed.createComponent(SharedTriggerHost);
      fixture.detectChanges();
      await fixture.whenStable();
      const trigger = fixture.debugElement
        .query(By.directive(MlvContextMenuTrigger))
        .injector.get(MlvContextMenuTrigger);
      const rowA = fixture.debugElement.query(By.css('[data-row-a]'))
        .nativeElement as HTMLElement;
      const rowB = fixture.debugElement.query(By.css('[data-row-b]'))
        .nativeElement as HTMLElement;
      return { fixture, trigger, rowA, rowB };
    }

    it('openFromEvent suppresses the native menu and opens at the cursor for a pointer event', async () => {
      const { fixture, trigger, rowA } = await createShared();

      const event = rightClick(120, 90);
      trigger.openFromEvent(event, rowA);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(event.defaultPrevented).toBe(true);
      expect(overlayContainerEl.querySelector('[role="menu"]')).toBeTruthy();
      expect(pane()?.style.left).toBe('120px');
      expect(pane()?.style.top).toBe('90px');
    });

    it('openFromEvent anchors to the element and focuses the first item for a keyboard event, then returns focus to that element', async () => {
      const { fixture, trigger, rowA } = await createShared();
      rowA.focus();

      trigger.openFromEvent(keyboardContextMenu(), rowA);
      fixture.detectChanges();
      await fixture.whenStable();
      await flushTimers();
      fixture.detectChanges();
      await fixture.whenStable();

      const panel =
        overlayContainerEl.querySelector<HTMLElement>('[role="menu"]');
      expect(panel).toBeTruthy();
      expect(document.activeElement).toBe(
        overlayContainerEl.querySelector('[role="menuitem"]'),
      );

      await pressEscape(fixture, panel as HTMLElement);

      // Focus restoration targets the anchor, not the hidden trigger host.
      expect(document.activeElement).toBe(rowA);
    });

    it('openFromEvent opens anchored to the element for a Shift+F10 keydown and ignores any other keydown', async () => {
      const { fixture, trigger, rowA } = await createShared();
      rowA.focus();

      const other = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      });
      trigger.openFromEvent(other, rowA);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(other.defaultPrevented).toBe(false);
      expect(overlayContainerEl.querySelector('[role="menu"]')).toBeNull();

      const event = shiftF10();
      trigger.openFromEvent(event, rowA);
      fixture.detectChanges();
      await fixture.whenStable();
      await flushTimers();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(event.defaultPrevented).toBe(true);
      const panel =
        overlayContainerEl.querySelector<HTMLElement>('[role="menu"]');
      expect(panel).toBeTruthy();
      expect(document.activeElement).toBe(
        overlayContainerEl.querySelector('[role="menuitem"]'),
      );

      await pressEscape(fixture, panel as HTMLElement);
      expect(document.activeElement).toBe(rowA);
    });

    it('resolves the pane direction from the anchor, not from the trigger host', async () => {
      const { fixture, trigger, rowB } = await createShared();

      trigger.openAt(40, 40, rowB);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(rtlService.direction()).toBe('ltr');
      expect(boundingBox()?.getAttribute('dir')).toBe('rtl');
    });

    it('moves an open panel to the new anchor on a second anchored open instead of stacking', async () => {
      const { fixture, trigger, rowA, rowB } = await createShared();

      trigger.openAt(40, 40, rowA);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(boundingBox()?.getAttribute('dir')).toBe('ltr');

      trigger.openAt(200, 200, rowB);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(overlayContainerEl.querySelectorAll('[role="menu"]').length).toBe(
        1,
      );
      // A move re-anchors the overlay; direction follows the new anchor too.
      expect(boundingBox()?.getAttribute('dir')).toBe('rtl');
      // CDK writes a `start`-aligned overlay's inline offset as `right` once
      // the pane is RTL, so the block offset moved and the inline one changed
      // hands — both only happen if the position was recomputed against the
      // new anchor's direction.
      expect(pane()?.style.top).toBe('200px');
      expect(pane()?.style.left).toBe('');
      expect(pane()?.style.right).not.toBe('');
    });
  });
});
