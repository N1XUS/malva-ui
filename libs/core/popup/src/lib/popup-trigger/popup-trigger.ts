import type { OnDestroy } from '@angular/core';
import {
  computed,
  Directive,
  ElementRef,
  NgZone,
  ViewContainerRef,
  effect,
  inject,
  input,
} from '@angular/core';
import { Subscription, fromEvent } from 'rxjs';
import type { MlvPopup } from '../popup/popup';
import { POPUP_DETACH_WATCHDOG_MS } from '../popup/popup';
import type { MlvPopupHandle } from '../popup.service';
import { MlvPopupService } from '../popup.service';
import { POPUP_CONTAINER } from '../popup-container/popup-container.token';

export type MlvPopupTriggerType = 'click' | 'hover' | 'focus';

const HOVER_CLOSE_DELAY = 20;

@Directive({
  selector: '[mlvPopupTrigger]',
  host: {
    '[attr.aria-expanded]': '_isOpen()',
    '[attr.aria-haspopup]': 'ariaHasPopup()',
    '(click)': 'onClick()',
    '(mouseenter)': 'onMouseEnter()',
    '(mouseleave)': 'onMouseLeave()',
    '(focus)': 'onFocus()',
    '(blur)': 'onBlur()',
  },
  exportAs: 'mlvPopupTrigger',
})
export class MlvPopupTrigger implements OnDestroy {
  /** @private Low-level overlay API used in standalone mode. */
  private readonly _popupService = inject(MlvPopupService);
  /** @private Host element ref used as the overlay anchor. */
  private readonly _elementRef = inject(ElementRef);
  /** @private View container used to instantiate the popup template portal. */
  private readonly _vcr = inject(ViewContainerRef);
  /** @private Zone used to re-enter Angular after out-of-zone hover timers. */
  private readonly _ngZone = inject(NgZone);

  /**
   * Optional injection of a parent {@link MlvPopupContainer}.
   *
   * When present the trigger operates in **container mode**: it delegates
   * open/close/toggle to the container instead of creating its own overlay,
   * and registers its host element as the visual anchor.
   *
   * When absent the trigger operates in **standalone mode** and manages the
   * overlay lifecycle itself (legacy behaviour).
   */
  private readonly _container = inject(POPUP_CONTAINER, { optional: true });

  /** @private The active overlay handle in standalone mode, or `null` when closed. */
  private _handle: MlvPopupHandle | null = null;
  /** @private Guards against re-triggering the leave animation while already closing. */
  private _closing = false;
  /** @private Subscription to the popup's leave-animation-done stream. */
  private _leaveSubscription: Subscription | null = null;
  /** @private Pending hover-close timer handle, or `null` when none is scheduled. */
  private _hoverCloseTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * @private Last-resort timer that force-detaches an overlay whose leave never
   * completed — without it a lost `animationState` write latches `_closing`
   * with no path back to a detach.
   */
  private _detachWatchdog: ReturnType<typeof setTimeout> | null = null;
  /** @private Teardown callbacks for the overlay hover mouse listeners. */
  private _overlayMouseListeners = new Subscription();

  /**
   * The `MlvPopup` to control.
   *
   * **Standalone mode** (no parent `mlv-popup-container`): must be bound to the
   * target `<mlv-popup>` element: `[mlvPopupTrigger]="myPopup"`.
   *
   * **Container mode** (inside `mlv-popup-container`): can be used as a bare
   * attribute (`mlvPopupTrigger`) without a value — the container already holds
   * the popup reference and orchestrates the overlay. The empty-string value from
   * the bare attribute is coerced to `undefined` by the transform.
   */
  readonly mlvPopupTrigger = input<
    MlvPopup | undefined,
    MlvPopup | string | undefined
  >(undefined, {
    transform: (v): MlvPopup | undefined =>
      typeof v === 'string' ? undefined : v,
  });

  /** One or more event types that open the popup. Defaults to `'click'`. */
  readonly triggerOn = input<MlvPopupTriggerType | MlvPopupTriggerType[]>(
    'click',
  );

  /**
   * Value applied to the trigger's `aria-haspopup` attribute. Should match the
   * semantic role of the popup panel's content — e.g. `'menu'` for a menu
   * flyout, `'listbox'` for a select, `'dialog'` for a modal surface. Defaults
   * to `'dialog'` for backwards compatibility. Set to `null` to omit the
   * attribute entirely (e.g. for a tooltip-only popup).
   */
  readonly ariaHasPopup = input<string | null>('dialog');

  /** @protected Whether the associated popup is currently open. */
  protected readonly _isOpen = computed(() => {
    const popup = this.mlvPopupTrigger();
    if (popup) return popup.opened();
    if (this._container) return this._container.isOpen?.() ?? false;
    return false;
  });

  constructor() {
    if (this._container) {
      // ── Container mode ──────────────────────────────────────────────────
      // Register this element as the overlay anchor. Re-runs if triggerOn changes
      // so the container can update its backdrop preference accordingly.
      const container = this._container;
      effect(() => {
        container.registerTrigger(this._elementRef, !this.hasTrigger('hover'));
      });
    } else {
      // ── Standalone mode ─────────────────────────────────────────────────
      // Watch the popup's opened signal and manage the CDK overlay ourselves.
      effect(() => {
        const popup = this.mlvPopupTrigger();
        if (!popup) return;
        const isOpen = popup.opened();
        if (isOpen && !this._handle) {
          this._attachOverlay();
        } else if (!isOpen && this._handle && !this._closing) {
          this._startLeaveAnimation();
        }
      });
    }
  }

  open(): void {
    if (this._container) {
      this._container.open();
    } else {
      this.mlvPopupTrigger()?.opened.set(true);
    }
  }

  close(): void {
    if (this._container) {
      this._container.close();
    } else {
      this.mlvPopupTrigger()?.opened.set(false);
    }
  }

  toggle(): void {
    if (this._container) {
      this._container.toggle();
    } else if (this._handle) {
      this.close();
    } else {
      this.open();
    }
  }

  ngOnDestroy(): void {
    this._clearHoverTimer();
    this._clearDetachWatchdog();
    this._removeOverlayMouseListeners();
    this._cleanupSubscription();
    this._detachOverlay();
  }

  onClick(): void {
    if (this.hasTrigger('click')) {
      this.toggle();
    }
  }

  onMouseEnter(): void {
    if (this.hasTrigger('hover')) {
      this._clearHoverTimer();
      this.open();
    }
  }

  onMouseLeave(): void {
    if (this.hasTrigger('hover')) {
      this._scheduleHoverClose();
    }
  }

  onFocus(): void {
    if (this.hasTrigger('focus')) {
      this.open();
    }
  }

  onBlur(): void {
    if (this.hasTrigger('focus')) {
      this.close();
    }
  }

  hasTrigger(type: MlvPopupTriggerType): boolean {
    const trigger = this.triggerOn();
    return Array.isArray(trigger) ? trigger.includes(type) : trigger === type;
  }

  /** @private Schedules a delayed close after the pointer leaves the trigger. */
  private _scheduleHoverClose(): void {
    this._clearHoverTimer();
    this._hoverCloseTimer = setTimeout(() => {
      this._hoverCloseTimer = null;
      this._ngZone.run(() => this.close());
    }, HOVER_CLOSE_DELAY);
  }

  /** @private Cancels any pending hover-close timer. */
  private _clearHoverTimer(): void {
    if (this._hoverCloseTimer !== null) {
      clearTimeout(this._hoverCloseTimer);
      this._hoverCloseTimer = null;
    }
  }

  /** @private Creates the CDK overlay and plays the enter animation (standalone mode). */
  private _attachOverlay(): void {
    if (this._handle) return;

    const popup = this.mlvPopupTrigger();
    if (!popup) return;

    popup.animationState.set('idle');

    const isHover = this.hasTrigger('hover');

    this._handle = this._popupService.open({
      origin: this._elementRef,
      template: popup.popupTemplate(),
      vcr: this._vcr,
      positions: popup.resolvedPositions(),
      size: popup.buildSizeConfig(),
      // Fixes the mode for this open — see the identical read in
      // `MlvPopupContainer._attachOverlay()`.
      fullscreen: popup.lockFullscreenForOpen(),
      hasBackdrop: popup.hasBackdrop() ?? !isHover,
      scrollStrategy: popup.scrollStrategy(),
      onPositionChange: (change, direction) =>
        popup.updateArrowFromPosition(change.connectionPair, direction),
      onClose: () => {
        this._removeOverlayMouseListeners();
        this._clearHoverTimer();
        this._clearDetachWatchdog();
        this._handle = null;
        this._closing = false;
        popup.animationState.set('idle');
        popup.opened.set(false);
        popup.afterClosed.emit();
        // Released last, after `afterClosed` — see `MlvPopupContainer`'s
        // `onClose` for why that handler still belongs to the finished open.
        popup.releaseFullscreenLock();
      },
      onRequestClose: () => this.close(),
    });

    if (isHover) {
      this._addOverlayMouseListeners();
    }

    this._cleanupSubscription();
    this._leaveSubscription = popup.leaveAnimationDone$.subscribe(() => {
      this._detachOverlay();
    });

    // Deferred so the panel is in the DOM before the enter keyframes start;
    // `beginEnterAnimation()` refuses to overwrite a close that beat it here.
    queueMicrotask(() => popup.beginEnterAnimation());

    popup.afterOpened.emit();
  }

  /** @private Wires hover enter/leave listeners on the overlay panel to keep it open on hover. */
  private _addOverlayMouseListeners(): void {
    if (!this._handle) return;
    const overlayEl = this._handle.overlayRef.overlayElement;

    const onEnter = () => this._clearHoverTimer();
    const onLeave = () => this._scheduleHoverClose();

    // Bound to the overlay element of this open and released by
    // `_removeOverlayMouseListeners()`, which runs from the popup's `onClose`
    // and from `ngOnDestroy`. `_attachOverlay` returns early while a handle
    // exists, so exactly one pair is live at a time; `takeUntilDestroyed`
    // would instead keep one pair per open alive.
    this._overlayMouseListeners = new Subscription();
    this._overlayMouseListeners.add(
      fromEvent(overlayEl, 'mouseenter').subscribe(onEnter),
    );
    this._overlayMouseListeners.add(
      fromEvent(overlayEl, 'mouseleave').subscribe(onLeave),
    );
  }

  /**
   * @private Removes the overlay hover listeners. Idempotent: `unsubscribe()`
   * on an already-closed `Subscription` is a no-op, and the field is replaced
   * with a fresh one so a later open starts from an empty teardown set.
   */
  private _removeOverlayMouseListeners(): void {
    this._overlayMouseListeners.unsubscribe();
    this._overlayMouseListeners = new Subscription();
  }

  /** @private Triggers the popup leave animation before detaching the overlay. */
  private _startLeaveAnimation(): void {
    if (!this._handle) return;
    this._closing = true;
    this.mlvPopupTrigger()?.animationState.set('leave');
    this._armDetachWatchdog();
  }

  /** @private Tears down the overlay, its subscriptions, and pending timers. */
  private _detachOverlay(): void {
    this._cleanupSubscription();
    this._clearDetachWatchdog();
    if (this._handle) {
      this._handle.close();
    }
  }

  /**
   * @private Arms the force-detach timer for the pending leave. Detaching is
   * what resets `_closing` and `_handle`, so a leave that never completes must
   * still end in a detach or the trigger latches permanently.
   */
  private _armDetachWatchdog(): void {
    this._clearDetachWatchdog();
    this._detachWatchdog = setTimeout(() => {
      this._detachWatchdog = null;
      if (this._closing && this._handle) {
        this._detachOverlay();
      }
    }, POPUP_DETACH_WATCHDOG_MS);
  }

  /** @private Cancels a pending force-detach timer. */
  private _clearDetachWatchdog(): void {
    if (this._detachWatchdog !== null) {
      clearTimeout(this._detachWatchdog);
      this._detachWatchdog = null;
    }
  }

  /** @private Unsubscribes from the leave-animation-done stream. */
  private _cleanupSubscription(): void {
    this._leaveSubscription?.unsubscribe();
    this._leaveSubscription = null;
  }
}
