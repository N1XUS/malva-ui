import type { OnDestroy } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewContainerRef,
  ViewEncapsulation,
  contentChild,
  effect,
  inject,
} from '@angular/core';
import type { Subscription } from 'rxjs';
import { MlvPopup, POPUP_DETACH_WATCHDOG_MS } from '../popup/popup';
import type { MlvPopupHandle } from '../popup.service';
import { MlvPopupService } from '../popup.service';
import type { MlvPopupContainerRef } from './popup-container.token';
import { POPUP_CONTAINER } from './popup-container.token';

@Component({
  selector: 'mlv-popup-container',
  template: `<ng-content />`,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: POPUP_CONTAINER, useExisting: MlvPopupContainer }],
})
export class MlvPopupContainer implements OnDestroy, MlvPopupContainerRef {
  /** @private Low-level popup overlay service used to open/close the CDK overlay. */
  private readonly _popupService = inject(MlvPopupService);

  /** @private View container used as the anchor for the popup's template portal. */
  private readonly _vcr = inject(ViewContainerRef);

  /** @private Host element reference, used as the overlay origin when no trigger is registered. */
  private readonly _elementRef = inject(ElementRef);

  /** @private Handle to the currently-open overlay, or `null` when closed. */
  private _handle: MlvPopupHandle | null = null;

  /** @private True while the leave animation is playing, before the overlay detaches. */
  private _closing = false;

  /** @private Subscription to the popup's leave-animation-done stream. */
  private _leaveSubscription: Subscription | null = null;

  /**
   * @private Last-resort timer that force-detaches an overlay whose leave never
   * completed. The popup's own animation fallback normally gets there first;
   * this one also covers a lost `animationState` write, which would otherwise
   * latch `_closing` with no path back to a detach.
   */
  private _detachWatchdog: ReturnType<typeof setTimeout> | null = null;

  /** @private Origin registered by a child `MlvPopupTrigger`, if any. */
  private _triggerOrigin: ElementRef | null = null;
  /** @private Backdrop preference registered by a child `MlvPopupTrigger`. */
  private _hasBackdrop = true;

  readonly popup = contentChild.required(MlvPopup);

  /**
   * Called by a child {@link MlvPopupTrigger} to register its host element
   * as the visual anchor for the CDK overlay.
   */
  registerTrigger(origin: ElementRef, hasBackdrop: boolean): void {
    this._triggerOrigin = origin;
    this._hasBackdrop = hasBackdrop;
  }

  constructor() {
    effect(() => {
      const popup = this.popup();
      const isOpen = popup.opened();
      if (isOpen && !this._handle) {
        this._attachOverlay();
      } else if (!isOpen && this._handle && !this._closing) {
        this._startLeaveAnimation();
      }
    });
  }

  open(): void {
    if (this._handle) return;
    this.popup().opened.set(true);
  }

  close(): void {
    this.popup().opened.set(false);
  }

  toggle(): void {
    if (this._handle) {
      this.close();
    } else {
      this.open();
    }
  }

  /** Returns whether the popup is currently open. */
  isOpen(): boolean {
    return this.popup().opened();
  }

  ngOnDestroy(): void {
    this._cleanupSubscription();
    this._clearDetachWatchdog();
    this._detachOverlay();
  }

  /** @private Opens the CDK overlay for the popup and subscribes to its leave-animation completion. */
  private _attachOverlay(): void {
    if (this._handle) return;

    const popup = this.popup();
    popup.animationState.set('idle');

    this._handle = this._popupService.open({
      origin: this._resolveOrigin(),
      template: popup.popupTemplate(),
      vcr: this._vcr,
      positions: popup.resolvedPositions(),
      size: popup.buildSizeConfig(),
      // Fixes the mode for this open. The same read drives the overlay's
      // position strategy, pane class, backdrop and scroll lock *and* the
      // panel's own chrome, so a breakpoint crossed mid-open cannot desync the
      // two halves — and the backdrop, at least, could not follow it anyway
      // (CDK can only detach a scrim, never attach one after `attach()`).
      fullscreen: popup.lockFullscreenForOpen(),
      hasBackdrop: popup.hasBackdrop() ?? this._hasBackdrop,
      scrollStrategy: popup.scrollStrategy(),
      flexibleDimensions: popup.flexibleDimensions(),
      dismissExcludeElements: popup.dismissExcludeElements(),
      onPositionChange: (change, direction) =>
        popup.updateArrowFromPosition(change.connectionPair, direction),
      onClose: () => {
        this._clearDetachWatchdog();
        this._handle = null;
        this._closing = false;
        popup.animationState.set('idle');
        popup.opened.set(false);
        popup.afterClosed.emit();
        // Released last, after `afterClosed`: through the leave animation the
        // panel is still on screen and keeps the chrome it opened with, and
        // `afterClosed` still belongs to that open — a consumer handler that
        // branches on `isFullscreen()` (e.g. `mlv-combobox._onPopupClosed`)
        // must see the mode the popup was actually rendering, not the mode a
        // viewport change during the open would now resolve to.
        popup.releaseFullscreenLock();
      },
      onRequestClose: () => this.close(),
    });

    this._cleanupSubscription();
    this._leaveSubscription = popup.leaveAnimationDone$.subscribe(() => {
      this._detachOverlay();
    });

    // Deferred so the panel is in the DOM before the enter keyframes start;
    // `beginEnterAnimation()` refuses to overwrite a close that beat it here.
    queueMicrotask(() => popup.beginEnterAnimation());

    popup.afterOpened.emit();
  }

  /**
   * @private The element this open anchors to: the registered trigger when it
   * is still in the document, otherwise the container host.
   *
   * `registerTrigger` has no unregister, so a stale origin outlives the trigger
   * that registered it. A detached element does not throw when CDK measures it
   * — `getBoundingClientRect()` answers all zeros — so
   * `FlexibleConnectedPositionStrategy` resolves a position against 0,0 and
   * puts the panel in the top-left corner of the viewport, silently (#225).
   * Falling back keeps the panel on its container instead.
   *
   * The predicate is `isConnected` — still in the **document**, not still
   * rendered. A trigger hidden with `display: none` on itself or an ancestor
   * stays connected and still measures an all-zero rect, so the fallback does
   * not fire for it. That is deliberate: widening the test to
   * `getClientRects().length > 0` would silently relocate panels anchored to
   * intentionally 0×0 elements, which is an established positioning pattern.
   */
  private _resolveOrigin(): ElementRef {
    const trigger = this._triggerOrigin;
    const el = trigger?.nativeElement as Element | undefined;
    return trigger && el?.isConnected ? trigger : this._elementRef;
  }

  /** @private Marks the container as closing and triggers the popup's leave animation. */
  private _startLeaveAnimation(): void {
    if (!this._handle) return;
    this._closing = true;
    this.popup().animationState.set('leave');
    this._armDetachWatchdog();
  }

  /** @private Cleans up subscriptions, timers, and closes the overlay handle. */
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
   * still end in a detach or the container latches permanently.
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

  /** @private Unsubscribes from and clears the leave-animation subscription. */
  private _cleanupSubscription(): void {
    this._leaveSubscription?.unsubscribe();
    this._leaveSubscription = null;
  }
}
