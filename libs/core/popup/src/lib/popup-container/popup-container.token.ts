import type { ElementRef } from '@angular/core';
import { InjectionToken } from '@angular/core';

/**
 * Interface implemented by {@link MlvPopupContainer}.
 *
 * Injected by {@link MlvPopupTrigger} when it detects a parent container,
 * enabling the trigger to delegate lifecycle management without needing an explicit
 * `[mlvPopupTrigger]` binding.
 */
export interface MlvPopupContainerRef {
  /** Open the popup. */
  open(): void;
  /** Close the popup. */
  close(): void;
  /** Toggle the popup open/closed. */
  toggle(): void;
  /** Returns whether the popup is currently open. */
  isOpen?(): boolean;
  /**
   * Called by a child `MlvPopupTrigger` to register its host element as the
   * visual anchor for the overlay and to indicate whether a backdrop should be used.
   * The latest registration wins — with two live triggers, the one that
   * registered last, not the one the user activated (#282). Re-registering an
   * element moves it to the top.
   * `MlvPopupContainer` keeps every distinct element until it is unregistered
   * or the container is destroyed.
   *
   * @param origin     — The trigger element used as the CDK overlay origin.
   * @param hasBackdrop — `false` for hover triggers (no transparent backdrop needed).
   */
  registerTrigger(origin: ElementRef, hasBackdrop: boolean): void;
  /**
   * Withdraws a registration made by `registerTrigger`, so the next open falls
   * back to the registration before it, or to the container's defaults.
   * `MlvPopupTrigger` calls it when it is destroyed.
   *
   * Optional so an existing implementation of this interface keeps compiling;
   * one that omits it keeps a destroyed trigger's registration in force.
   *
   * @param origin — The registered element, matched by `nativeElement`.
   */
  unregisterTrigger?(origin: ElementRef): void;
}

/**
 * Injection token for the nearest `MlvPopupContainer`.
 *
 * Used by `MlvPopupTrigger` to detect container mode and delegate
 * open/close/toggle calls without creating a conflicting overlay.
 */
export const POPUP_CONTAINER = new InjectionToken<MlvPopupContainerRef>(
  'POPUP_CONTAINER',
);
