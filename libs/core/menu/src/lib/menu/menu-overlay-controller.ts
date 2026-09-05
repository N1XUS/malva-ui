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
import type { MlvSubmenuAimState } from './submenu-aim';
import { isCursorHeadingToSubmenu } from './submenu-aim';

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
      onPositionChange: (change) =>
        popup.updateArrowFromPosition(change.connectionPair),
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
    if (!this.isOpen()) {
      this.open();
    }
  }

  /** Handles pointer exit for submenu triggers using triangle intent. */
  onMouseLeave(event: MouseEvent): void {
    if (!this._config.isSubmenu()) return;

    if (this._triangleState?.cursorEnteredSubmenu) {
      const overlayElement = this._overlayRef?.overlayRef.overlayElement;
      const entered = event.relatedTarget;
      const intoSubmenu =
        entered instanceof Node && !!overlayElement?.contains(entered);

      if (!intoSubmenu) this._scheduleClose();
      return;
    }

    if (this._triangleState) {
      const heading = isCursorHeadingToSubmenu(
        event.clientX,
        event.clientY,
        this._triangleState,
      );
      if (heading) return;
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
      this._triangleState = {
        lastX: 0,
        lastY: 0,
        submenuRect: overlayElement.getBoundingClientRect(),
        side: 'right',
        cursorEnteredSubmenu: false,
      };
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
      if (!this._triangleState || !this.isOpen()) return;
      if (this._triangleState.cursorEnteredSubmenu) return;

      if (this._config.origin.nativeElement.contains(event.target as Node)) {
        this._clearCloseTimer();
        return;
      }

      if (this._isPointerOnSiblingItem(event.target)) {
        this._ngZone.run(() => this._config.requestClose?.() ?? this.close());
        return;
      }

      const { clientX, clientY } = event;
      const state = this._triangleState;
      const heading = isCursorHeadingToSubmenu(clientX, clientY, state);

      state.lastX = clientX;
      state.lastY = clientY;

      if (heading) {
        this._clearCloseTimer();
      } else if (this._overlayRef) {
        state.submenuRect =
          this._overlayRef.overlayRef.overlayElement.getBoundingClientRect();
        if (!isCursorHeadingToSubmenu(clientX, clientY, state)) {
          this._scheduleClose();
        }
      }
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
  }

  private _scheduleClose(): void {
    this._clearCloseTimer();
    this._closeTimer = setTimeout(() => {
      this._ngZone.run(() => this._config.requestClose?.() ?? this.close());
    }, 150);
  }

  private _clearCloseTimer(): void {
    if (this._closeTimer !== null) {
      clearTimeout(this._closeTimer);
      this._closeTimer = null;
    }
  }
}
