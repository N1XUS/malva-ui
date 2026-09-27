import { DestroyRef, NgZone, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Subscription, fromEvent } from 'rxjs';
import type {
  ElementRef,
  OutputEmitterRef,
  Signal,
  ViewContainerRef,
  WritableSignal,
} from '@angular/core';
import type {
  ConnectedPosition,
  FlexibleConnectedPositionStrategyOrigin,
} from '@angular/cdk/overlay';
import type { MlvPopup, MlvPopupHandle } from '@malva-ui/core/popup';
import {
  MENU_POSITIONS,
  MlvPopupService,
  SUBMENU_POSITIONS,
} from '@malva-ui/core/popup';
import type { MlvMenuAccessor } from './menu.types';
import type { MlvMenubarAccessor, MlvMenubarItem } from './menubar.types';
import type { MlvMenubarMenuController } from './menubar.types';
import type { MlvSubmenuAimPoint, MlvSubmenuAimState } from './submenu-aim';
import { isPointerInSafeTriangle } from './submenu-aim';

/**
 * How long, in milliseconds, a submenu survives once hover intent says it
 * should close — and how long the pointer has to rest on another row of the
 * parent menu, inside the safe triangle, before that row wins.
 */
const SUBMENU_CLOSE_DELAY = 150;

/**
 * Submenu controllers currently tracking a pointer on its way to their panel,
 * keyed by the parent menu panel (`[role="menu"]`) their trigger row sits in.
 *
 * A sibling submenu trigger in the same panel reads it on hover: while the
 * pointer crosses that row inside the open submenu's safe triangle, opening the
 * sibling would stack a second panel over the rows the pointer is heading for,
 * so it waits for the aiming controller's verdict instead. One entry per panel
 * is enough — only one submenu of a panel can be open, and so aiming, at once.
 * A `WeakMap` so a panel removed with an entry still set is not retained.
 */
const aimingSubmenus = new WeakMap<Element, MlvMenuOverlayController>();

/**
 * Structural menu surface required by the overlay controller.
 *
 * Keeping the overlay contract structural lets `MlvMenuTrigger` accept menus
 * with any data item type without making the trigger itself generic.
 */
export interface MlvMenuOverlayTarget extends MlvMenuAccessor {
  readonly _popup: Signal<MlvPopup>;
  readonly _isOpen: WritableSignal<boolean>;
  readonly closed: OutputEmitterRef<void>;
  readonly panelId: string;
  registerParentMenu(parentMenu: MlvMenuAccessor | null): void;
  registerMenubarController(controller: MlvMenubarMenuController | null): void;
  focusFirstItem(): void;
  focusLastItem(): void;
}

/** Configuration used by the shared menu overlay controller. */
export interface MlvMenuOverlayControllerConfig {
  /** Resolves the menu panel opened by this controller. */
  readonly getMenu: () => MlvMenuOverlayTarget;
  /** Element from which the popup is positioned and to which focus returns. */
  readonly origin: ElementRef<HTMLElement>;
  /**
   * Overrides what the popup is *positioned* against, resolved at each open.
   * `origin` keeps direction resolution and focus restoration.
   *
   * Returning a `{ x, y }` point anchors the panel to the cursor — how
   * `MlvContextMenuTrigger` opens a menu at a right-click. Omit (or return
   * `undefined`) for the default element-anchored behaviour.
   */
  readonly getPositionOrigin?: () =>
    | FlexibleConnectedPositionStrategyOrigin
    | undefined;
  /**
   * Overrides the CDK position list, resolved at each open. Omit to use the
   * `MENU_POSITIONS` / `SUBMENU_POSITIONS` pair chosen from `isSubmenu()`.
   */
  readonly getPositions?: () => ConnectedPosition[] | undefined;
  /**
   * Overrides whether the overlay creates a CDK backdrop. Omit for the default,
   * which is a backdrop for everything except submenus and menubar children.
   *
   * `false` is required by any trigger that must keep seeing pointer events on
   * the page while its panel is open: the backdrop is `inset: 0` with
   * `pointer-events: auto`, so it becomes the hit-test target for the whole
   * viewport. A right-click also fires no `click`, so the backdrop would not
   * even close the panel — it would only swallow the event and let the native
   * browser menu through. `MlvPopupService` keeps click-outside dismissal
   * working without a backdrop via its document listener.
   */
  readonly getHasBackdrop?: () => boolean | undefined;
  /** View container used to instantiate the menu popup portal. */
  readonly vcr: ViewContainerRef;
  /** Parent menu accessor for submenu registration. */
  readonly parentMenu: MlvMenuAccessor | null;
  /** Parent menubar accessor for top-level coordination. */
  readonly menubar: MlvMenubarAccessor | null;
  /** Whether the current trigger is configured as a submenu trigger. */
  readonly isSubmenu: () => boolean;
  /** Whether the current trigger is a direct child of a menubar. */
  readonly isMenubarChild: boolean;
  /** Resolves the current disabled state. */
  readonly isDisabled: () => boolean;
  /** Returns the menubar item represented by the trigger. */
  readonly getMenubarItem: () => MlvMenubarItem;
  /** Requests closure through the owning trigger façade when available. */
  readonly requestClose?: () => void;
  /** Called after the popup has been opened. */
  readonly onOpened?: () => void;
  /** Called after the popup has been fully closed. */
  readonly onClosed?: () => void;
}

/**
 * Owns the common popup, focus restoration, and submenu hover-intent lifecycle
 * used by explicit and data-generated menu triggers.
 */
export class MlvMenuOverlayController {
  /** Whether the controlled menu overlay is currently open. */
  readonly isOpen = signal(false);

  private readonly _popupService: MlvPopupService;
  private readonly _ngZone: NgZone;
  private readonly _destroyRef = inject(DestroyRef);

  /**
   * @private The document the submenu hover-intent listener is bound to.
   * Injected rather than the ambient global: under server rendering the two
   * are different objects and the global is defined, so an ambient `document`
   * binds to a process-wide object no teardown reaches.
   */
  private readonly _document = inject(DOCUMENT);

  private _overlayRef: MlvPopupHandle | null = null;
  private _openSubscriptions: Array<{ unsubscribe(): void }> = [];
  private _triangleState: MlvSubmenuAimState | null = null;
  private _closeTimer: ReturnType<typeof setTimeout> | null = null;
  private _mousemoveCleanup: (() => void) | null = null;

  /**
   * @private The parent menu panel this controller is registered under in
   * `aimingSubmenus` while its hover-intent listener runs, so the entry can be
   * removed even after the trigger row has left that panel.
   */
  private _aimPanel: Element | null = null;

  /**
   * @private A sibling submenu trigger whose hover arrived while the pointer
   * crossed its row inside this submenu's safe triangle. It opens when this
   * submenu closes for hover intent — the pointer rested on its row, or left
   * the triangle while on it — and is dropped once the pointer moves off its
   * row, reaches this panel, or this submenu closes any other way.
   */
  private _deferredSibling: MlvMenuOverlayController | null = null;

  private _destroyed = false;

  constructor(
    private readonly _config: MlvMenuOverlayControllerConfig,
    dependencies?: {
      readonly popupService?: MlvPopupService;
      readonly ngZone?: NgZone;
    },
  ) {
    this._popupService = dependencies?.popupService ?? inject(MlvPopupService);
    this._ngZone = dependencies?.ngZone ?? inject(NgZone);
    this._destroyRef.onDestroy(() => this.destroy());
  }

  /** Opens the menu overlay unless it is already open or disabled. */
  open(): void {
    if (this._destroyed || this.isOpen() || this._config.isDisabled()) return;

    const menu = this._config.getMenu();
    const popup = menu._popup();
    const isSubmenu = this._config.isSubmenu();
    const isMenubarChild = this._config.isMenubarChild;
    const positions =
      this._config.getPositions?.() ??
      (isSubmenu ? SUBMENU_POSITIONS : MENU_POSITIONS);

    menu.registerParentMenu(isSubmenu ? this._config.parentMenu : null);
    menu.registerMenubarController(
      isMenubarChild && this._config.menubar
        ? {
            openNextItemMenu: () =>
              this._config.menubar?.openAdjacentItemMenu(
                this._config.getMenubarItem(),
                1,
              ),
            openPreviousItemMenu: () =>
              this._config.menubar?.openAdjacentItemMenu(
                this._config.getMenubarItem(),
                -1,
              ),
          }
        : null,
    );
    popup.animationState.set('idle');

    this._overlayRef = this._popupService.open({
      origin: this._config.origin,
      positionOrigin: this._config.getPositionOrigin?.(),
      template: popup.popupTemplate(),
      vcr: this._config.vcr,
      positions,
      // Takes the per-open full-screen lock like the other two overlay owners
      // (`MlvPopupContainer`, `MlvPopupTrigger`), so the flag the overlay is
      // created with and the value `popup.isFullscreen()` reports are the same
      // read. `mlv-menu`'s own popup never sets `mobileMode`, so this resolves
      // `false` today — but the invariant is "every attach latches", and
      // leaving the one owner that skips it would make #126 reappear silently
      // the day a mobile menu opts in.
      fullscreen: popup.lockFullscreenForOpen(),
      hasBackdrop:
        this._config.getHasBackdrop?.() ?? (!isSubmenu && !isMenubarChild),
      dismissExcludeElements:
        isMenubarChild && this._config.menubar
          ? [this._config.menubar.hostElement]
          : undefined,
      onClose: () => {
        this._overlayRef = null;
        this.isOpen.set(false);
        popup.animationState.set('idle');
        popup.opened.set(false);
        menu._isOpen.set(false);
        // Released after the state writes above, matching the other owners:
        // the lock covers exactly the window in which an overlay is attached.
        popup.releaseFullscreenLock();
        this._openSubscriptions.forEach((subscription) =>
          subscription.unsubscribe(),
        );
        this._openSubscriptions = [];
        this._triangleState = null;
        this._removeMousemoveListener();
        this._config.onClosed?.();
        if (isMenubarChild) {
          this._config.menubar?.notifyItemClosed(this._config.getMenubarItem());
        }
      },
      onRequestClose: () => menu.close(),
      onPositionChange: (change, direction) =>
        popup.updateArrowFromPosition(change.connectionPair, direction),
    });

    popup.opened.set(true);
    menu._isOpen.set(true);
    this.isOpen.set(true);
    this._config.onOpened?.();
    if (isMenubarChild) {
      this._config.menubar?.notifyItemOpened(this._config.getMenubarItem());
    }

    const leaveSubscription = popup.leaveAnimationDone$.subscribe(() => {
      this._overlayRef?.close();
    });
    this._openSubscriptions.push(leaveSubscription);

    const closedSubscription = menu.closed.subscribe(() => {
      this._restoreFocusToTrigger();
      if (this._overlayRef) {
        popup.animationState.set('leave');
      }
    });
    this._openSubscriptions.push(closedSubscription);

    queueMicrotask(() => popup.beginEnterAnimation());

    if (isSubmenu) {
      this._setupSubmenuTracking();
    }
  }

  /** Closes the menu overlay when it is open. */
  close(): void {
    if (!this.isOpen()) return;
    this._closeOverlay();
  }

  /**
   * Re-reads `getPositionOrigin` / `getPositions` and moves an open overlay to
   * the result, falling back to the `origin` element when the config currently
   * supplies no point.
   *
   * The positions travel with the origin because the two can change kind
   * together: a context menu re-anchored from its host element to a cursor must
   * also drop the 8px element gap the element-anchored list carries.
   *
   * No-op when the overlay is closed. Used by point-anchored triggers whose
   * anchor moves while the panel is open — a second right-click moves the
   * context menu rather than stacking one.
   */
  updatePositionOrigin(): void {
    if (!this.isOpen()) return;
    const origin = this._config.getPositionOrigin?.() ?? this._config.origin;
    this._overlayRef?.setPositionOrigin(
      origin,
      this._config.getPositions?.() ??
        (this._config.isSubmenu() ? SUBMENU_POSITIONS : MENU_POSITIONS),
    );
  }

  /** Toggles the controlled menu overlay. */
  toggle(): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  /** Opens the menu and focuses its first enabled item. */
  openWithFirstItemFocused(): void {
    this.open();
    if (this.isOpen()) {
      setTimeout(() => this._config.getMenu().focusFirstItem(), 0);
    }
  }

  /** Opens the menu and focuses its last enabled item. */
  openWithLastItemFocused(): void {
    this.open();
    if (this.isOpen()) {
      setTimeout(() => this._config.getMenu().focusLastItem(), 0);
    }
  }

  /** Handles pointer entry for menubar and submenu triggers. */
  onMouseEnter(): void {
    if (this._config.isMenubarChild) {
      if (this._config.isDisabled()) return;
      this._config.menubar?.onItemPointerEnter(this._config.getMenubarItem());
      return;
    }
    if (!this._config.isSubmenu() || this._config.isDisabled()) return;
    this._clearCloseTimer();
    if (this.isOpen()) return;

    // A sibling submenu is open and the pointer may be crossing this row on
    // its way there: let that submenu's safe triangle decide. Its next
    // `mousemove` either opens this one at once (the pointer left the
    // triangle) or after the pointer rests here.
    const aiming = this._findAimingSibling();
    if (aiming) {
      aiming._deferredSibling = this;
      return;
    }
    this.open();
  }

  /** Handles pointer exit for submenu triggers using triangle intent. */
  onMouseLeave(event: MouseEvent): void {
    if (!this._config.isSubmenu()) return;

    const state = this._triangleState;
    if (state?.cursorEnteredSubmenu) {
      const overlayElement = this._overlayRef?.overlayRef.overlayElement;
      const entered = event.relatedTarget;
      const intoSubmenu =
        entered instanceof Node && !!overlayElement?.contains(entered);

      if (!intoSubmenu) this._scheduleClose();
      return;
    }

    if (state) {
      const point = { x: event.clientX, y: event.clientY };
      // Left before any move over the row reached the tracker: the exit point
      // is the best apex there is.
      state.anchor ??= point;
      if (this._isInSafeTriangle(point)) return;
    }

    this._scheduleClose();
  }

  /** Cleans up listeners and disposes the controlled overlay. */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this._clearCloseTimer();
    this._removeMousemoveListener();
    this._overlayRef?.close();
    this._overlayRef = null;
  }

  private _restoreFocusToTrigger(): void {
    const overlayElement = this._overlayRef?.overlayRef.overlayElement;
    const active = this._document.activeElement;
    if (overlayElement && active && overlayElement.contains(active)) {
      this._config.origin.nativeElement.focus();
    }
  }

  private _closeOverlay(): void {
    if (!this._overlayRef) return;
    this._config.getMenu()._popup().animationState.set('leave');
  }

  private _setupSubmenuTracking(): void {
    setTimeout(() => {
      if (this._destroyed || !this._overlayRef || !this.isOpen()) return;
      const overlayElement = this._overlayRef.overlayRef.overlayElement;
      // No side and no rect here: the pane is measured at each decision, and
      // the side falls out of where it is relative to the apex (see
      // `isPointerInSafeTriangle`), so a submenu CDK flips to its fallback
      // side, mirrors in a `[dir="rtl"]` scope or repositions while open is
      // judged against the panel as it now stands.
      this._triangleState = { anchor: null, cursorEnteredSubmenu: false };
      this._installMousemoveListener();
      this._installSubmenuOverlayListeners(overlayElement);
    }, 0);
  }

  private _installSubmenuOverlayListeners(overlayElement: HTMLElement): void {
    const onEnter = () => {
      if (this._triangleState) {
        this._triangleState.cursorEnteredSubmenu = true;
      }
      this._clearCloseTimer();
      this._removeMousemoveListener();
    };

    const onLeave = () => this._scheduleClose();

    // Bound to the overlay element of *this* open and released by the
    // `_openSubscriptions` entry when the popup closes — the controller
    // outlives any number of opens, so `takeUntilDestroyed` would accumulate
    // one pair per open, each on an overlay element that no longer exists.
    this._ngZone.runOutsideAngular(() => {
      const subscription = new Subscription();
      subscription.add(
        fromEvent(overlayElement, 'mouseenter').subscribe(onEnter),
      );
      subscription.add(
        fromEvent(overlayElement, 'mouseleave').subscribe(onLeave),
      );
      this._openSubscriptions.push(subscription);
    });
  }

  private _installMousemoveListener(): void {
    this._removeMousemoveListener();

    const handler = (event: MouseEvent) => {
      const state = this._triangleState;
      if (!state || !this.isOpen() || state.cursorEnteredSubmenu) return;

      const target = event.target;
      const point = { x: event.clientX, y: event.clientY };

      // A deferred sibling is held only while the pointer is on its row.
      const deferredOrigin =
        this._deferredSibling?._config.origin.nativeElement;
      if (
        deferredOrigin &&
        !(target instanceof Node && deferredOrigin.contains(target))
      ) {
        this._deferredSibling = null;
      }

      if (this._config.origin.nativeElement.contains(target as Node)) {
        // Still on the row that owns the panel: re-base the apex here.
        state.anchor = point;
        this._clearCloseTimer();
        return;
      }

      const onSibling = this._isPointerOnSiblingItem(target);
      if (this._isInSafeTriangle(point)) {
        // On the way to the panel. Over another row of the parent menu that
        // lasts only while the pointer keeps moving: every move restarts the
        // delay, so resting on the row hands it the hover.
        if (onSibling) {
          this._scheduleClose();
        } else {
          this._clearCloseTimer();
        }
        return;
      }

      if (onSibling) {
        this._closeForHoverIntent();
        return;
      }
      this._scheduleClose();
    };

    // `{ capture: true }` is load-bearing: the hover-intent tracker has to
    // see the move before a menu item's own handlers can stop it. `fromEvent`
    // forwards the options object to the identical `addEventListener` call, so
    // the phase and the order among capture listeners are unchanged.
    //
    // The subscription belongs to one submenu-open generation and is released
    // by `_removeMousemoveListener()`, called from the popup's `onClose` and
    // from `destroy()` (wired to `DestroyRef.onDestroy`), so the injected
    // document keeps nothing after either.
    this._ngZone.runOutsideAngular(() => {
      const subscription = fromEvent<MouseEvent>(this._document, 'mousemove', {
        capture: true,
      }).subscribe(handler);
      this._mousemoveCleanup = () => subscription.unsubscribe();
    });

    // Registered for exactly as long as the listener runs, so sibling triggers
    // defer to this submenu only while its triangle is being evaluated.
    const panel = this._ownPanel();
    if (panel) {
      aimingSubmenus.set(panel, this);
      this._aimPanel = panel;
    }
  }

  /**
   * @private Whether `point` is inside this submenu's safe triangle, measuring
   * the pane now — it can move while open (a reposition, a scroll).
   */
  private _isInSafeTriangle(point: MlvSubmenuAimPoint): boolean {
    const state = this._triangleState;
    const overlayElement = this._overlayRef?.overlayRef.overlayElement;
    if (!state?.anchor || !overlayElement) return false;
    return isPointerInSafeTriangle(
      point,
      state.anchor,
      overlayElement.getBoundingClientRect(),
    );
  }

  /** @private The parent menu panel (`[role="menu"]`) the trigger row sits in. */
  private _ownPanel(): Element | null {
    return this._config.origin.nativeElement.closest('[role="menu"]');
  }

  /**
   * @private The open submenu of the same parent panel whose safe triangle is
   * being tracked, if it is not this one.
   */
  private _findAimingSibling(): MlvMenuOverlayController | null {
    const panel = this._ownPanel();
    const aiming = panel ? aimingSubmenus.get(panel) : undefined;
    return aiming && aiming !== this && aiming.isOpen() ? aiming : null;
  }

  /**
   * @private Closes this submenu because the pointer settled somewhere else,
   * then opens the sibling submenu whose hover was held for it, if any — in
   * that order: this panel starts its leave animation first, which may still
   * be playing while the held one enters.
   */
  private _closeForHoverIntent(): void {
    const sibling = this._deferredSibling;
    this._clearCloseTimer();
    this._removeMousemoveListener();
    this._ngZone.run(() => {
      if (this._config.requestClose) {
        this._config.requestClose();
      } else {
        this.close();
      }
      sibling?.open();
    });
  }

  private _isPointerOnSiblingItem(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;

    const item = target.closest('[role="menuitem"]');
    if (!item || item === this._config.origin.nativeElement) return false;

    const panel = this._config.origin.nativeElement.closest('[role="menu"]');
    return !!panel?.contains(item);
  }

  private _removeMousemoveListener(): void {
    if (this._mousemoveCleanup) {
      this._mousemoveCleanup();
      this._mousemoveCleanup = null;
    }
    if (this._aimPanel && aimingSubmenus.get(this._aimPanel) === this) {
      aimingSubmenus.delete(this._aimPanel);
    }
    this._aimPanel = null;
    this._deferredSibling = null;
  }

  private _scheduleClose(): void {
    this._clearCloseTimer();
    this._closeTimer = setTimeout(
      () => this._closeForHoverIntent(),
      SUBMENU_CLOSE_DELAY,
    );
  }

  private _clearCloseTimer(): void {
    if (this._closeTimer !== null) {
      clearTimeout(this._closeTimer);
      this._closeTimer = null;
    }
  }
}
