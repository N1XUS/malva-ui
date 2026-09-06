import { DOCUMENT } from '@angular/common';
import {
  DestroyRef,
  Directive,
  ElementRef,
  Renderer2,
  ViewContainerRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import type { ConnectedPosition } from '@angular/cdk/overlay';
import {
  MlvMenuOverlayController,
  type MlvMenuOverlayTarget,
} from './menu-overlay-controller';

/** Viewport point a context menu panel is anchored to. */
interface MlvContextMenuPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Firefox's `MouseEvent.mozInputSource` value for an event synthesised from the
 * keyboard (`MOZ_SOURCE_KEYBOARD`). Firefox is the one engine that reports the
 * input device directly; everything else has to be inferred.
 * @private
 */
const MOZ_SOURCE_KEYBOARD = 6;

/**
 * Elements whose own context menu (spell-check, cut/copy/paste, undo) is more
 * useful than an application menu, so `global` mode leaves them to the browser.
 * @private
 */
const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable]';

/**
 * ARIA states that a `role="generic"` element may not carry.
 *
 * `aria-haspopup` is global and allowed anywhere, but `aria-expanded` and
 * `aria-controls` are not: axe's `aria-allowed-attr` rule fails a plain
 * `<div aria-expanded="false">`, and this directive's whole point is that it
 * goes on arbitrary elements. They are emitted only once the host declares a
 * role that can own them.
 * @private
 */
function hostOwnsExpandedState(element: HTMLElement): boolean {
  return element.hasAttribute('role');
}

/**
 * Ordered CDK positions for a menu panel anchored to a **cursor point**.
 *
 * Deliberately hand-written rather than resolved from `POPUP_POSITION_MAP`:
 * every entry in that map carries the 8px trigger gap, which is correct beside
 * an element and wrong at a pointer — a context menu's corner sits exactly on
 * the cursor. All four offsets are therefore zero.
 *
 * The origin is a zero-size point, so `start`/`end` and `top`/`bottom` collapse
 * to the same coordinate on the origin side; the mirroring that matters is on
 * the overlay side, where `overlayX: 'start'` grows the panel toward the inline
 * end — rightward in LTR, leftward in RTL.
 *
 * @private Local to this trigger. Not exported: there is no input that takes a
 * position list, so nothing outside can meaningfully reference it.
 */
const CONTEXT_MENU_POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom' },
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top' },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom' },
];

/**
 * Opens an existing `mlv-menu` panel at the pointer on right-click.
 *
 * The panel, its items, keyboard model and ARIA come from `mlv-menu` unchanged
 * — this directive only replaces the *trigger* half of `MlvMenuTrigger`:
 * `contextmenu` instead of `click`, and a cursor point instead of the trigger's
 * bounding box. Everything `mlv-menu` already does keeps working: Escape and
 * Tab close, click-outside closes, submenus, disabled items, separators and
 * router-link items behave exactly as they do under a normal menu trigger.
 *
 * ## Keyboard access
 *
 * Right-click is a pointer-only gesture, but browsers dispatch the same
 * `contextmenu` event for the **ContextMenu key** and **Shift+F10**, so keyboard
 * users reach the menu through this directive too — provided the host is
 * focusable. Put the directive on a natively focusable element, or give it a
 * `tabindex`. A keyboard-initiated open carries no cursor, so the panel anchors
 * to the host element and focus moves straight to the first item.
 *
 * That covers WCAG 2.1.1 on its own. A visible affordance (an ellipsis button
 * using the regular `[mlvMenuTrigger]` on the same `mlv-menu`) is still the
 * friendlier pattern for discoverability, and is recommended whenever the
 * context menu holds actions available nowhere else.
 *
 * ## One panel, many elements
 *
 * A list whose every row opens the same menu does not need a trigger per row:
 * put the directive on one hidden element beside the panel and forward each
 * row's `contextmenu` event to `openFromEvent(event, row)`. The row becomes
 * the **anchor** — a keyboard-initiated open positions against it, its
 * `[dir]` scope decides the panel's direction, and focus returns to it when
 * the panel closes. `@malva-ui/scheduler` drives its cell and event menus
 * this way.
 *
 * @example Targeted — right-click one element
 * ```html
 * <div [mlvContextMenuTrigger]="rowMenu" tabindex="0">Right-click this row</div>
 * <mlv-menu #rowMenu>
 *   <mlv-list-item mlvMenuItem (itemClick)="rename()">Rename</mlv-list-item>
 *   <mlv-menu-separator />
 *   <mlv-list-item mlvMenuItem (itemClick)="remove()">Delete</mlv-list-item>
 * </mlv-menu>
 * ```
 *
 * @example Global — right-click anywhere on the page
 * ```html
 * <div [mlvContextMenuTrigger]="pageMenu" global tabindex="0"></div>
 * <mlv-menu #pageMenu>
 *   <mlv-list-item mlvMenuItem (itemClick)="reload()">Reload</mlv-list-item>
 * </mlv-menu>
 * ```
 */
@Directive({
  selector: '[mlvContextMenuTrigger]',
  host: {
    '[attr.aria-haspopup]': '"menu"',
    '[attr.aria-expanded]': '_ownsExpandedState ? _isOpen() : null',
    '[attr.aria-controls]':
      '_ownsExpandedState && _isOpen() ? mlvContextMenuTrigger().panelId : null',
    '(contextmenu)': '_onHostContextMenu($event)',
  },
})
export class MlvContextMenuTrigger {
  // ─── Injected services ────────────────────────────────────────────────────

  /** @private Host element — the direction and focus anchor for the panel. */
  private readonly _elementRef = inject(ElementRef<HTMLElement>);

  /** @private Document the global-mode listener is attached to. */
  private readonly _document = inject(DOCUMENT);

  /** @private Used to attach the global-mode listener without a raw addEventListener. */
  private readonly _renderer = inject(Renderer2);

  /** @private Owns teardown of the global-mode listener. */
  private readonly _destroyRef = inject(DestroyRef);

  // ─── Inputs ───────────────────────────────────────────────────────────────

  /** The `mlv-menu` panel to open at the pointer. Required. */
  readonly mlvContextMenuTrigger = input.required<MlvMenuOverlayTarget>();

  /** When `true`, right-clicking does nothing and the native menu is left alone. */
  readonly contextMenuDisabled = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * When `true`, listens for `contextmenu` on the document instead of on the
   * host element, so a right-click anywhere on the page opens the menu.
   *
   * Three kinds of right-click are left to the browser: those inside an open
   * overlay panel (the menu's own panel is portaled to `<body>`, outside the
   * host's subtree, and must not re-open the menu on top of itself); those on
   * a text field, where spell-check and paste beat an application menu; and
   * those a nearer trigger already handled, so a targeted trigger nested inside
   * a global one opens one panel rather than two.
   *
   * Direction and focus restoration still come from the host element, so keep
   * the directive on an element inside the region it serves — and give that
   * element a `tabindex` if focus should return somewhere sensible on close.
   *
   * With more than one global trigger on a page, every one of them responds to
   * the same right-click; scope them with `contextMenuDisabled` instead of
   * relying on registration order.
   */
  readonly global = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  // ─── Outputs ──────────────────────────────────────────────────────────────

  /** Emits when the menu panel opens. */
  readonly menuOpened = output<void>();

  /** Emits when the menu panel closes. */
  readonly menuClosed = output<void>();

  // ─── Internal state ───────────────────────────────────────────────────────

  /**
   * @private Viewport point the panel is anchored to, or `null` for a
   * keyboard-initiated open, which anchors to the host element instead.
   */
  private readonly _point = signal<MlvContextMenuPoint | null>(null);

  /**
   * @private Element the current open was anchored to through the `anchor`
   * argument of `openAt` / `openFromKeyboard` / `openFromEvent`; `null` when
   * the host itself is the anchor. Reset when the panel closes.
   */
  private _anchor: HTMLElement | null = null;

  /**
   * @private The controller's origin: a real `ElementRef` whose
   * `nativeElement` resolves lazily to the current anchor, falling back to the
   * host. Everything the controller derives from its origin — the panel's
   * direction, the element a keyboard-initiated open positions against, the
   * element focus returns to on close — therefore follows the anchor.
   *
   * A real `ElementRef` instance, not a plain object of the same shape: CDK's
   * position strategy only reads a bounding box from an origin that passes
   * `instanceof ElementRef` (see `menu-data-item.ts` for the same trick).
   */
  private readonly _origin: ElementRef<HTMLElement> = Object.defineProperty(
    new ElementRef<HTMLElement>(this._elementRef.nativeElement),
    'nativeElement',
    {
      configurable: true,
      get: (): HTMLElement => this._anchor ?? this._elementRef.nativeElement,
    },
  );

  /** @private Shared overlay lifecycle, reused verbatim from `MlvMenuTrigger`. */
  private readonly _overlayController = new MlvMenuOverlayController({
    getMenu: () => this.mlvContextMenuTrigger(),
    origin: this._origin,
    getPositionOrigin: () => this._point() ?? undefined,
    getPositions: () =>
      this._point() ? CONTEXT_MENU_POSITIONS : /* element-anchored */ undefined,
    // The CDK backdrop is `inset: 0` with `pointer-events: auto`, so it would
    // become the hit-test target for every later right-click — the trigger
    // would never see one, nothing would call `preventDefault()`, and the
    // native browser menu would open over the panel. A right-click fires no
    // `click`, so the backdrop would not even dismiss the panel in exchange.
    // `MlvPopupService` keeps click-outside dismissal via its document listener.
    getHasBackdrop: () => false,
    vcr: inject(ViewContainerRef),
    parentMenu: null,
    menubar: null,
    isSubmenu: () => false,
    isMenubarChild: false,
    isDisabled: () => this.contextMenuDisabled(),
    getMenubarItem: () => {
      throw new Error(
        '[MlvContextMenuTrigger] is never a menubar item; getMenubarItem must not be called.',
      );
    },
    requestClose: () => this.close(),
    onOpened: () => this.menuOpened.emit(),
    onClosed: () => {
      // Every open sets the anchor again, so this only stops a detached row
      // from being retained between opens. Focus was already restored to it
      // when the menu requested to close, before the leave animation.
      this._anchor = null;
      this.menuClosed.emit();
    },
  });

  /** @protected Whether the menu overlay is currently open. */
  protected readonly _isOpen = this._overlayController.isOpen;

  /**
   * @protected Whether the host may carry `aria-expanded` / `aria-controls`.
   *
   * Read once: a host's role is part of how the consumer wrote the element, not
   * something that changes while the page runs.
   */
  protected readonly _ownsExpandedState = hostOwnsExpandedState(
    this._elementRef.nativeElement,
  );

  /** @private Teardown for the document listener installed by `global` mode. */
  private _globalCleanup: (() => void) | null = null;

  constructor() {
    // `global` is an input, so the listener has to follow it rather than being
    // installed once in the constructor.
    effect(() => {
      const isGlobal = this.global();
      this._removeGlobalListener();
      if (!isGlobal) return;
      this._globalCleanup = this._renderer.listen(
        this._document,
        'contextmenu',
        (event: MouseEvent) => this._onGlobalContextMenu(event),
      );
    });

    this._destroyRef.onDestroy(() => this._removeGlobalListener());
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Opens the menu at a viewport point, as a right-click would.
   *
   * Moves an already-open panel to the new point rather than stacking a second
   * one. No-op while `contextMenuDisabled` is set.
   *
   * `anchor` is the element the open speaks for when it is not the host — a
   * row, a cell, one item of a list that shares a single panel. Its `[dir]`
   * scope resolves the panel's direction and it receives focus when the panel
   * closes; omitted, the host plays that part.
   */
  openAt(x: number, y: number, anchor?: HTMLElement): void {
    if (this.contextMenuDisabled()) return;
    this._anchor = anchor ?? null;
    this._point.set({ x, y });
    if (this._isOpen()) {
      this._overlayController.updatePositionOrigin();
      return;
    }
    this._overlayController.open();
  }

  /**
   * Opens the menu anchored to the host element and focuses its first item —
   * the keyboard equivalent of a right-click.
   *
   * No-op while `contextMenuDisabled` is set.
   *
   * With `anchor`, the panel positions against that element instead of the
   * host, resolves its direction from it and returns focus to it on close.
   */
  openFromKeyboard(anchor?: HTMLElement): void {
    if (this.contextMenuDisabled()) return;
    this._anchor = anchor ?? null;
    this._point.set(null);

    // Already open (a right-click focused the host, then ContextMenu was
    // pressed): re-anchor in place and move focus in. Closing first would not
    // work — `close()` only starts the leave animation and leaves `isOpen`
    // true until it finishes, so the immediately following `open()` would bail
    // and the panel would just disappear.
    if (this._isOpen()) {
      this._overlayController.updatePositionOrigin();
      this.mlvContextMenuTrigger().focusFirstItem();
      return;
    }

    this._overlayController.openWithFirstItemFocused();
  }

  /**
   * Opens the menu from a `contextmenu` event that reached the page somewhere
   * other than the host, suppressing the native menu exactly as the host's
   * own listener does: at the cursor for a pointer-initiated event, anchored
   * to `anchor` (else the host) with the first item focused for a
   * keyboard-initiated one (ContextMenu key, Shift+F10).
   *
   * For one panel shared by many elements — a table's rows, a calendar's
   * cells — where a trigger per element would be waste: put the directive on
   * a hidden element next to the panel and forward each element's event here
   * with the element as `anchor`, so direction and focus restoration still
   * come from the element that was right-clicked.
   *
   * No-op while `contextMenuDisabled` is set; the native menu is then left
   * alone.
   */
  openFromEvent(event: MouseEvent, anchor?: HTMLElement): void {
    if (this.contextMenuDisabled()) return;

    event.preventDefault();

    if (this._isKeyboardInitiated(event)) {
      this.openFromKeyboard(anchor);
    } else {
      this.openAt(event.clientX, event.clientY, anchor);
    }
  }

  /** Closes the menu overlay. No-op if it is not open. */
  close(): void {
    this._overlayController.close();
  }

  // ─── Protected host event handlers ───────────────────────────────────────

  /**
   * @protected `contextmenu` on the host element (targeted mode).
   *
   * Skipped in `global` mode, where the document listener already sees this
   * event as it bubbles — handling both would open twice for one right-click.
   */
  protected _onHostContextMenu(event: MouseEvent): void {
    if (this.global()) return;
    this._handleContextMenu(event);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * @private `contextmenu` anywhere in the document (global mode).
   *
   * Right-clicks inside a CDK overlay pane are left to the browser: the menu's
   * own panel lives there, and a right-click on a menu item should not re-open
   * the menu on top of itself.
   */
  private _onGlobalContextMenu(event: MouseEvent): void {
    // A nearer trigger already claimed this right-click. The event still
    // bubbles to the document afterwards — the propagation path is fixed at
    // dispatch — so without this a targeted trigger nested inside a global one
    // would open both panels, stacked at the same point, for one right-click.
    if (event.defaultPrevented) return;

    const target = event.target;
    if (target instanceof Element) {
      // The menu's own panel is portaled to `<body>`, outside the host's
      // subtree; a right-click on a menu item must not re-open the menu on top
      // of itself.
      if (target.closest('.cdk-overlay-container') !== null) return;
      // A text field's own menu (spell-check, paste, undo) beats an
      // application menu. Without this, one global trigger removes it from
      // every input on the page.
      if (target.closest(EDITABLE_SELECTOR) !== null) return;
    }

    this._handleContextMenu(event);
  }

  /**
   * @private Suppresses the native menu and opens the panel — at the cursor for
   * a pointer-initiated event, at the host element for a keyboard-initiated one.
   */
  private _handleContextMenu(event: MouseEvent): void {
    this.openFromEvent(event);
  }

  /**
   * @private Whether a `contextmenu` event came from the keyboard rather than a
   * pointer, so the panel anchors to the host and takes focus instead of
   * appearing at the reported coordinates.
   *
   * `event.button === 2` is **not** the test, even though it looks like the
   * obvious one: macOS dispatches `contextmenu` for Ctrl+click with `button: 0`,
   * and Android does the same for a touch long-press, so a button check sends
   * two ordinary pointer gestures down the keyboard path — anchoring the panel
   * to the element instead of the finger and stealing focus.
   *
   * What actually separates them is the input device. Firefox reports it
   * outright. Elsewhere, a keyboard-synthesised event has no click count and no
   * cursor to report, so it arrives at the viewport origin — the one false
   * positive being a genuine right-click on the exact top-left pixel, which
   * falls back to a usable element-anchored menu.
   */
  private _isKeyboardInitiated(event: MouseEvent): boolean {
    const mozInputSource = (event as MouseEvent & { mozInputSource?: number })
      .mozInputSource;

    if (mozInputSource !== undefined) {
      return mozInputSource === MOZ_SOURCE_KEYBOARD;
    }

    return event.detail === 0 && event.clientX === 0 && event.clientY === 0;
  }

  /** @private Detaches the document listener, if one is installed. */
  private _removeGlobalListener(): void {
    this._globalCleanup?.();
    this._globalCleanup = null;
  }
}
