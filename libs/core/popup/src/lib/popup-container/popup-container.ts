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

/** One live `registerTrigger` call: the anchor and the backdrop it asked for. */
interface TriggerRegistration {
  /** The element the overlay anchors to while this registration is on top. */
  readonly origin: ElementRef;
  /** Backdrop preference used while this registration is on top. */
  readonly hasBackdrop: boolean;
}

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

  /**
   * @private Live trigger registrations, oldest first; the last entry governs
   * the next attach.
   *
   * A stack rather than a single slot so that an unregister can hand control
   * back to whatever registered before — two triggers in one container, one of
   * them inside an `@if` — instead of resetting to defaults or, as the single
   * slot did, keeping the departed trigger's element and backdrop forever
   * (#230). At most one entry per element: see {@link registerTrigger}.
   *
   * **Nothing is pruned.** Every distinct element stays here — referenced, even
   * once it has left the document — until it is unregistered or the container
   * is destroyed. Dropping disconnected entries is not safe: a view that is
   * alive but detached (an inactive tab panel, a CDK virtual-scroll view cache)
   * registered once and never registers again, and would lose its anchor. So
   * a caller that registers re-created elements owns the unregister; the single
   * slot this replaced held only the latest element, whatever the caller did.
   *
   * A plain array, not a signal: it is read only while an overlay is being
   * attached, and making it reactive would subscribe the attach effect to
   * every registration change for no benefit.
   */
  private _registrations: TriggerRegistration[] = [];

  readonly popup = contentChild.required(MlvPopup);

  /**
   * Registers `origin` as the visual anchor for the CDK overlay, and
   * `hasBackdrop` as the backdrop to use when `MlvPopup.hasBackdrop` is
   * unset. Called by a child {@link MlvPopupTrigger} in container mode.
   *
   * The latest registration wins — with two live triggers that is the one
   * that registered last, not the one the user activated (#282). Registering
   * an element that is already
   * registered moves it to the top with the new `hasBackdrop` rather than
   * adding a second entry, so a trigger that re-registers when its inputs
   * change cannot leave a stale copy of itself underneath.
   *
   * Pair every call whose `origin` can be destroyed before the container with
   * {@link unregisterTrigger}; `MlvPopupTrigger` does so from its `DestroyRef`.
   * Every distinct element registered stays referenced until then, or until
   * the container is destroyed — a caller registering a freshly created
   * element per open that never unregisters grows the stack by one each time.
   *
   * A registration is resolved when an overlay is attached, so neither call
   * re-anchors an overlay that is already open. An open overlay whose origin
   * element is then destroyed keeps that origin: CDK re-measures the detached
   * node on its next reposition (scroll, resize), which answers an all-zero
   * rect and moves the panel to the viewport's top-left corner. That predates
   * #230 and is tracked in #283.
   *
   * @param origin      — The element used as the CDK overlay origin. Matched
   *                      by `nativeElement`, not by `ElementRef` identity.
   * @param hasBackdrop — `false` for hover triggers (no transparent backdrop).
   */
  registerTrigger(origin: ElementRef, hasBackdrop: boolean): void {
    this._removeRegistration(origin);
    this._registrations.push({ origin, hasBackdrop });
  }

  /**
   * Withdraws a registration made by {@link registerTrigger}, releasing the
   * container's reference to `origin`'s element.
   *
   * If it was the latest registration, the next open falls back to the one
   * before it — its origin and its backdrop — or, with none left, to the
   * container host and a backdrop. Withdrawing an earlier registration leaves
   * the latest one in charge. Unregistering an element that is not registered
   * is a no-op, so teardown may call it unconditionally.
   *
   * @param origin — The registered element. Matched by `nativeElement`, so a
   *                 different `ElementRef` wrapping the same node matches.
   */
  unregisterTrigger(origin: ElementRef): void {
    this._removeRegistration(origin);
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
    // Releases elements a caller registered and never withdrew. A destroyed
    // container can itself stay referenced — a template reference or a
    // `viewChild` result held by something longer-lived — and would otherwise
    // keep every one of them alive with it.
    this._registrations = [];
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
      hasBackdrop: popup.hasBackdrop() ?? this._resolveBackdrop(),
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
   * @private The element this open anchors to: the latest registration's
   * origin when it is still in the document, otherwise the container host.
   *
   * A registration can outlive its element's presence in the document — a
   * caller that never unregisters, or an element removed from the DOM without
   * destroying the view that registered it. A detached element does not throw
   * when CDK measures it — `getBoundingClientRect()` answers all zeros — so
   * `FlexibleConnectedPositionStrategy` resolves a position against 0,0 and
   * puts the panel in the top-left corner of the viewport, silently (#225).
   * Falling back keeps the panel on its container instead.
   *
   * Only the latest registration is consulted — a detached top entry falls
   * back to the host, not to an earlier registration — so origin and backdrop
   * are always read from the same entry (see {@link _resolveBackdrop}).
   *
   * The predicate is `isConnected` — still in the **document**, not still
   * rendered. A trigger hidden with `display: none` on itself or an ancestor
   * stays connected and still measures an all-zero rect, so the fallback does
   * not fire for it. That is deliberate: widening the test to
   * `getClientRects().length > 0` would silently relocate panels anchored to
   * intentionally 0×0 elements, which is an established positioning pattern.
   */
  private _resolveOrigin(): ElementRef {
    const trigger = this._latestRegistration()?.origin;
    const el = trigger?.nativeElement as Element | undefined;
    return trigger && el?.isConnected ? trigger : this._elementRef;
  }

  /**
   * @private The backdrop preference of the latest registration, or `true`
   * when nothing is registered — the same default a click trigger registers.
   * Consulted only when `MlvPopup.hasBackdrop` is unset.
   */
  private _resolveBackdrop(): boolean {
    return this._latestRegistration()?.hasBackdrop ?? true;
  }

  /** @private The registration that governs the next attach, if any. */
  private _latestRegistration(): TriggerRegistration | undefined {
    return this._registrations[this._registrations.length - 1];
  }

  /**
   * @private Removes the registration for `origin`'s element, wherever it sits
   * in the stack. Matching is by `nativeElement` because a view query can hand
   * out a fresh `ElementRef` wrapper for the same node.
   */
  private _removeRegistration(origin: ElementRef): void {
    const el: unknown = origin.nativeElement;
    this._registrations = this._registrations.filter(
      (entry) => entry.origin.nativeElement !== el,
    );
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
