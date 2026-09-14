import { Injectable, computed, signal } from '@angular/core';
import type { MlvItemsMoreItem } from './item/item';

/**
 * Registry and split state for one `mlv-items-more`.
 *
 * Scoped to the component, never `providedIn: 'root'` — two rows on a page
 * are two independent registries, exactly as two `mlv-tab-group`s are.
 */
@Injectable()
export class MlvItemsMoreService {
  /** Every registered item, in declaration order. */
  readonly items = signal<readonly MlvItemsMoreItem[]>([]);

  /**
   * @private The committed split. A `Set` rather than a count because a
   * pinned item may sit anywhere in the row, so "what is withheld" is not
   * expressible as "everything past index N".
   */
  private readonly _hidden = signal<ReadonlySet<MlvItemsMoreItem>>(new Set());

  /** Items rendered in the row, in declaration order. */
  readonly visibleItems = computed(() => {
    const hidden = this._hidden();
    return hidden.size === 0
      ? this.items()
      : this.items().filter((item) => !hidden.has(item));
  });

  /** Items withheld from the row, in declaration order. */
  readonly hiddenItems = computed(() => {
    const hidden = this._hidden();
    return hidden.size === 0
      ? []
      : this.items().filter((item) => hidden.has(item));
  });

  /** The committed split, for the component's own hysteresis input. */
  readonly hidden = this._hidden.asReadonly();

  /**
   * Commits a split. Writes nothing when the set is equivalent to the current
   * one — the row is re-evaluated on every resize notification, and an
   * unconditional `set()` of a fresh `Set` would invalidate `visibleItems` /
   * `hiddenItems` on each of them, re-rendering a row that did not change.
   */
  commit(hidden: ReadonlySet<MlvItemsMoreItem>): void {
    const current = this._hidden();
    if (current.size === hidden.size) {
      let same = true;
      for (const item of hidden) {
        if (!current.has(item)) {
          same = false;
          break;
        }
      }
      if (same) return;
    }
    this._hidden.set(hidden);
  }

  /**
   * Registers an item **in DOM order**, not in registration order.
   *
   * `ngOnInit` order is declaration order only while every item is created in
   * one pass. An item behind an `@if` that becomes true later initializes
   * last, and appending it would put it at the end of the row and at the end
   * of the panel — visibly reordering an interface because a condition
   * flipped. `compareDocumentPosition` answers the question the row is
   * actually asking, and `mlv-items-more` projects its definition nodes into
   * a hidden slot precisely so that they have a position to compare with. A
   * node that is still not comparable — disconnected, or in another document
   * — falls through to the end rather than throwing.
   */
  register(item: MlvItemsMoreItem): void {
    this.items.update((items) => {
      const node = item.elementRef.nativeElement;
      const index = items.findIndex((existing) => {
        const relation =
          existing.elementRef.nativeElement.compareDocumentPosition(node);
        if ((relation & Node.DOCUMENT_POSITION_DISCONNECTED) !== 0)
          return false;
        return (relation & Node.DOCUMENT_POSITION_PRECEDING) !== 0;
      });
      if (index < 0) return [...items, item];
      return [...items.slice(0, index), item, ...items.slice(index)];
    });
  }

  /**
   * Drops an item from the registry and from the split. Leaving a destroyed
   * item in the hidden set would keep the panel counting an entry it can no
   * longer render, and would retain the component instance.
   */
  unregister(item: MlvItemsMoreItem): void {
    this.items.update((items) => items.filter((i) => i !== item));
    const hidden = this._hidden();
    if (hidden.has(item)) {
      const next = new Set(hidden);
      next.delete(item);
      this._hidden.set(next);
    }
  }
}
