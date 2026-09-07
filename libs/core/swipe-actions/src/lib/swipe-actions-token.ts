import { InjectionToken } from '@angular/core';

/**
 * The inline side a swipe row reveals: `'start'` is the inline-start edge
 * (left in LTR, right in RTL), `'end'` the inline-end edge. Logical on
 * purpose — the same markup mirrors under `dir="rtl"`.
 */
export type MlvSwipeActionsSide = 'start' | 'end';

/**
 * What a swipe action needs from the row it lives in: a way to close it once
 * the action has been activated. Provided by `mlv-swipe-actions` under
 * {@link MLV_SWIPE_ACTIONS}, so `[mlvSwipeAction]` never imports the
 * component class.
 */
export interface MlvSwipeActionsHost {
  /** Scrolls the row back onto its content. A no-op while already closed. */
  close(): void;
}

/** Injection token through which `[mlvSwipeAction]` reaches its row. */
export const MLV_SWIPE_ACTIONS = new InjectionToken<MlvSwipeActionsHost>(
  'MLV_SWIPE_ACTIONS',
);
