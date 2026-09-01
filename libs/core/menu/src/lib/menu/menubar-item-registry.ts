import { InjectionToken, signal } from '@angular/core';
import type { ElementRef, Signal } from '@angular/core';
import type { MlvMenubarItem } from './menubar.types';

interface MlvOrderedMenubarItem extends MlvMenubarItem {
  readonly _elementRef?: ElementRef<HTMLElement>;
}

/** Internal ordered item collection consumed by `mlv-menubar`. */
export interface MlvMenubarItemRegistry {
  readonly items: Signal<readonly MlvMenubarItem[]>;
  register(item: MlvMenubarItem): void;
  unregister(item: MlvMenubarItem): void;
  resync(): void;
  syncOrder(items: readonly MlvMenubarItem[]): void;
}

/** Injection token for the nearest `mlv-menubar` item registry. */
export const MLV_MENUBAR_ITEM_REGISTRY =
  new InjectionToken<MlvMenubarItemRegistry>('MLV_MENUBAR_ITEM_REGISTRY');

/** Container every top-level menubar item lives under. */
const MLV_MENUBAR_CONTAINER_SELECTOR = 'mlv-menubar';

/**
 * Nodes whose insertion or removal can change registry ordering: a projected
 * `[mlvMenuTrigger]` top-level item (`role="menuitem"`, applied by the trigger)
 * or a generated data-driven row host. Anything else observed under the menubar
 * (text nodes, icon swaps, label re-renders, badge counters) leaves the item
 * order untouched and must not trigger a sort.
 */
const MLV_MENUBAR_ITEM_MUTATION_SELECTOR =
  '[role="menuitem"], mlv-menu-data-item';

/** Signal-backed ordered item registry used by `mlv-menubar`. */
export class MlvMenubarItemRegistryStore implements MlvMenubarItemRegistry {
  private readonly _items = signal<readonly MlvMenubarItem[]>([]);
  private _mutationObserver: MutationObserver | null = null;
  private _observedContainer: HTMLElement | null = null;

  readonly items = this._items.asReadonly();

  register(item: MlvMenubarItem): void {
    this._items.update((items) =>
      items.includes(item) ? items : [...items, item],
    );
    this._syncObservedContainer();
    this._resyncItems();
  }

  unregister(item: MlvMenubarItem): void {
    this._items.update((items) => {
      const nextItems = items.filter((candidate) => candidate !== item);
      return nextItems.length === items.length ? items : nextItems;
    });

    this._syncObservedContainer();
    this._resyncItems();
  }

  resync(): void {
    this._syncObservedContainer();
    this._resyncItems();
  }

  syncOrder(items: readonly MlvMenubarItem[]): void {
    this._items.update((currentItems) => {
      if (mlvMenubarItemsMatchSequence(items, currentItems)) {
        return currentItems;
      }

      const orderedItems = items.filter((item) => currentItems.includes(item));
      const unorderedItems = currentItems.filter(
        (item) => !orderedItems.includes(item),
      );
      const nextItems = [
        ...orderedItems,
        ...mlvSortMenubarItemsByDomOrder(unorderedItems),
      ];

      return mlvMenubarItemsMatchOrder(currentItems, nextItems)
        ? currentItems
        : nextItems;
    });
    this._syncObservedContainer();
  }

  private _syncObservedContainer(): void {
    const nextContainer = mlvGetSharedMenubarContainer(this._items());

    if (nextContainer === this._observedContainer) {
      return;
    }

    this._mutationObserver?.disconnect();
    this._observedContainer = nextContainer;

    if (!nextContainer) {
      this._mutationObserver = null;
      return;
    }

    this._mutationObserver = new MutationObserver((records) => {
      if (mlvMenubarMutationsAffectItemOrder(records)) {
        this._resyncItems();
      }
    });
    this._mutationObserver.observe(nextContainer, {
      childList: true,
      subtree: true,
    });
  }

  private _resyncItems(): void {
    this._items.update((items) => {
      if (items.length < 2) {
        return items;
      }

      const nextItems = mlvSortMenubarItemsByDomOrder(items);
      return mlvMenubarItemsMatchOrder(items, nextItems) ? items : nextItems;
    });
  }
}

/**
 * Sorts top-level items into DOM order.
 *
 * Unlike `mlv-menu`, a menubar's items are never resolved against a
 * container's row list — the comparator is a plain `compareDocumentPosition`,
 * so a comparison is already constant work with no DOM query. There is
 * therefore nothing to precompute here; the cost this registry needed to shed
 * is the indiscriminate resync, handled by
 * {@link mlvMenubarMutationsAffectItemOrder}.
 */
function mlvSortMenubarItemsByDomOrder(
  items: readonly MlvMenubarItem[],
): MlvMenubarItem[] {
  return [...items].sort(mlvCompareMenubarItemsByDomOrder);
}

function mlvCompareMenubarItemsByDomOrder(
  a: MlvMenubarItem,
  b: MlvMenubarItem,
): number {
  const aEl = (a as MlvOrderedMenubarItem)._elementRef?.nativeElement;
  const bEl = (b as MlvOrderedMenubarItem)._elementRef?.nativeElement;

  if (!aEl || !bEl || aEl === bEl) {
    return 0;
  }

  const position = aEl.compareDocumentPosition(bEl);
  if (position & Node.DOCUMENT_POSITION_DISCONNECTED) {
    return 0;
  }
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
  if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  return 0;
}

/**
 * Whether an observed mutation batch can change item ordering. Only added or
 * removed elements that are (or contain) a top-level menubar item qualify;
 * content churn inside an existing item is skipped without touching the sort.
 */
function mlvMenubarMutationsAffectItemOrder(
  records: readonly MutationRecord[],
): boolean {
  for (const record of records) {
    if (
      mlvNodesContainMenubarItem(record.addedNodes) ||
      mlvNodesContainMenubarItem(record.removedNodes)
    ) {
      return true;
    }
  }

  return false;
}

/** Whether any node in the list is, or contains, a top-level menubar item. */
function mlvNodesContainMenubarItem(nodes: NodeList): boolean {
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index];
    if (
      node instanceof Element &&
      (node.matches(MLV_MENUBAR_ITEM_MUTATION_SELECTOR) ||
        node.querySelector(MLV_MENUBAR_ITEM_MUTATION_SELECTOR) !== null)
    ) {
      return true;
    }
  }

  return false;
}

function mlvGetSharedMenubarContainer(
  items: readonly MlvMenubarItem[],
): HTMLElement | null {
  const containers = items
    .map((item) =>
      (item as MlvOrderedMenubarItem)._elementRef?.nativeElement.closest(
        MLV_MENUBAR_CONTAINER_SELECTOR,
      ),
    )
    .filter(
      (container): container is HTMLElement => container instanceof HTMLElement,
    );

  if (containers.length === 0) {
    return null;
  }

  const [firstContainer, ...restContainers] = containers;
  return restContainers.every((container) => container === firstContainer)
    ? firstContainer
    : null;
}

/**
 * Whether two item sequences are element-wise identical, length included.
 *
 * Guards the no-change case in {@link MlvMenubarItemRegistryStore.syncOrder}.
 * When `items` already equals the registry's order, the rest of that update is
 * provably a no-op: every element of `items` is then in `currentItems`, so
 * `orderedItems` is `items` in order, `unorderedItems` is empty, `nextItems` is
 * sequence-equal to `currentItems`, {@link mlvMenubarItemsMatchOrder} returns
 * `true`, and the update returns `currentItems` unchanged. Detecting that in one
 * pass skips two `includes`-inside-`filter` scans, a spread and a sort — the
 * settled projection previously paid all of them only to conclude nothing moved.
 *
 * Comparing length as well as elements is load-bearing, and is why this is not
 * {@link mlvMenubarItemsMatchOrder}: that check is deliberately length-blind, so
 * on its own it would also accept an `items` carrying a duplicate, whose
 * `orderedItems` is *longer* than `currentItems` and therefore not a no-op.
 */
function mlvMenubarItemsMatchSequence(
  items: readonly MlvMenubarItem[],
  currentItems: readonly MlvMenubarItem[],
): boolean {
  if (items.length !== currentItems.length) {
    return false;
  }

  for (let index = 0; index < items.length; index++) {
    if (items[index] !== currentItems[index]) {
      return false;
    }
  }

  return true;
}

function mlvMenubarItemsMatchOrder(
  currentItems: readonly MlvMenubarItem[],
  nextItems: readonly MlvMenubarItem[],
): boolean {
  return currentItems.every((item, index) => item === nextItems[index]);
}
