import type { ElementRef, Signal } from '@angular/core';
import { InjectionToken } from '@angular/core';
import type { MlvItemsMoreItem } from './item/item';

/**
 * The contract `mlv-items-more` publishes to the things that drive it —
 * `[mlvItemsMoreTrigger]` above all — so a trigger never has to import the
 * component class.
 */
export interface MlvItemsMoreAccessor {
  /**
   * Items currently withheld from the row, in declaration order. Empty while
   * everything fits, which is the signal a consumer-placed trigger reads to
   * decide whether to render itself at all.
   */
  readonly hiddenItems: Signal<readonly MlvItemsMoreItem[]>;

  /** Whether the overflow panel is open. */
  readonly panelOpened: Signal<boolean>;

  /**
   * DOM id of the overflow panel. Stable for the component's lifetime, so a
   * trigger can point `aria-controls` at it — while the panel is open, since
   * the panel does not exist in the DOM before that.
   */
  readonly panelId: string;

  /**
   * Opens the panel, anchoring the overlay on `origin` and remembering it as
   * the element to return focus to when the panel closes.
   */
  openPanel(origin: ElementRef<HTMLElement>): void;

  /** Closes the panel and returns focus to the element that opened it. */
  closePanel(): void;

  /** {@link openPanel} or {@link closePanel}, whichever the state calls for. */
  togglePanel(origin: ElementRef<HTMLElement>): void;
}

/**
 * Exposes the nearest `mlv-items-more` to its descendants.
 *
 * A trigger rendered *outside* the component — the case
 * `[mlvItemsMoreTrigger]` exists for — cannot reach this, which is why the
 * directive also accepts the component as an input value.
 */
export const MLV_ITEMS_MORE = new InjectionToken<MlvItemsMoreAccessor>(
  'MLV_ITEMS_MORE',
);
