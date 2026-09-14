import { Directive, ElementRef, inject, input } from '@angular/core';
import type { MlvItemsMoreItem } from './item/item';

/**
 * @internal The box one item renders into inside the row.
 *
 * Exists so that a measured box names its own item. Pairing
 * `viewChildren('slotRef')` with `visibleItems()` by index is only correct
 * while the query and the split describe the same render — and a resize
 * notification can arrive after a split is committed but before the row has
 * re-rendered, when index `i` in one is a different item from index `i` in
 * the other. A width cached against the wrong item is a wrong answer that no
 * later measurement corrects until that item happens to resize.
 *
 * Not exported from the package barrel: nothing outside `mlv-items-more`'s
 * own template has a reason to write it.
 */
@Directive({ selector: '[mlvItemsMoreSlot]' })
export class MlvItemsMoreSlot {
  /** The item this box renders. */
  readonly item = input.required<MlvItemsMoreItem>({
    alias: 'mlvItemsMoreSlot',
  });

  /** The box itself — what the row measures. */
  readonly elementRef = inject(ElementRef<HTMLElement>);
}
