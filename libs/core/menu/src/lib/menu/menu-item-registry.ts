import { InjectionToken, signal } from '@angular/core';
import type { ElementRef, Signal, WritableSignal } from '@angular/core';

/** Internal item shape the menu key manager navigates across. */
export interface MenuKeyItem {
  readonly disabledBoolean: boolean;
  readonly _tabIndex: WritableSignal<number>;
  readonly _elementRef?: ElementRef<HTMLElement>;
  focus(): void;
  getLabel(): string;
}

/** Internal ordered item collection consumed by `mlv-menu`. */
export interface MlvMenuItemRegistry {
  readonly items: Signal<readonly MenuKeyItem[]>;
  register(item: MenuKeyItem): void;
  unregister(item: MenuKeyItem): void;
  resync(): void;
  syncOrder(items: readonly MenuKeyItem[]): void;
}

/** Injection token for the nearest `mlv-menu` item registry. */
export const MLV_MENU_ITEM_REGISTRY = new InjectionToken<MlvMenuItemRegistry>(
  'MLV_MENU_ITEM_REGISTRY',
);

/**
 * Container an open menu panel renders into — the `mlv-list[listRole="menu"]`
 * inside the CDK overlay.
 */
const MLV_MENU_PANEL_CONTAINER_SELECTOR = '[role="menu"]';

/** Row selector used to read DOM order inside an open menu panel. */
const MLV_MENU_PANEL_ITEM_SELECTOR = '[role="menuitem"]';

/** Container a not-yet-portaled menu's projected rows still live under. */
const MLV_MENU_HOST_CONTAINER_SELECTOR = 'mlv-menu';

/** Row selector used to read DOM order inside a `mlv-menu` host. */
const MLV_MENU_HOST_ITEM_SELECTOR = 'mlv-list-item[mlvMenuItem]';

/**
 * Nodes whose insertion or removal can change registry ordering. Anything else
 * observed under the menu container (text nodes, icon swaps, label re-renders,
 * badge counters) leaves the item order untouched and must not trigger a sort.
 */
const MLV_MENU_ITEM_MUTATION_SELECTOR = `${MLV_MENU_PANEL_ITEM_SELECTOR}, ${MLV_MENU_HOST_ITEM_SELECTOR}`;

/** Signal-backed ordered item registry used by `mlv-menu`. */
export class MlvMenuItemRegistryStore implements MlvMenuItemRegistry {
  private readonly _items = signal<readonly MenuKeyItem[]>([]);
  private _mutationObserver: MutationObserver | null = null;
  private _observedContainer: HTMLElement | null = null;

  readonly items = this._items.asReadonly();

  register(item: MenuKeyItem): void {
    this._items.update((items) =>
      items.includes(item) ? items : [...items, item],
    );
    this._syncObservedContainer();
    this._resyncItems();
  }

  unregister(item: MenuKeyItem): void {
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

  syncOrder(items: readonly MenuKeyItem[]): void {
    this._items.update((currentItems) => {
      const orderedItems = items.filter((item) => currentItems.includes(item));
      const unorderedItems = currentItems.filter(
        (item) => !orderedItems.includes(item),
      );
      const nextItems = [
        ...orderedItems,
        ...mlvSortMenuItemsByDomOrder(unorderedItems),
      ];

      return mlvMenuItemsMatchOrder(currentItems, nextItems)
        ? currentItems
        : nextItems;
    });
    this._syncObservedContainer();
  }

  private _syncObservedContainer(): void {
    const nextContainer = mlvGetSharedMenuContainer(this._items());

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
      if (mlvMenuMutationsAffectItemOrder(records)) {
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

      const nextItems = mlvSortMenuItemsByDomOrder(items);
      return mlvMenuItemsMatchOrder(items, nextItems) ? items : nextItems;
    });
  }
}

/**
 * Per-item DOM-order facts, resolved once per sort instead of once per
 * comparison. `panelIndex`/`hostIndex` mirror the `indexOf` result of the old
 * per-comparison `querySelectorAll` scan — `-1` means "not found", which makes
 * the pair compare equal.
 */
interface MlvMenuItemOrderEntry {
  readonly element: HTMLElement;
  readonly panelContainer: HTMLElement | null;
  readonly hostContainer: HTMLElement | null;
  panelIndex: number;
  hostIndex: number;
}

/**
 * Sorts items into DOM order using a single pass of container resolution and
 * one `querySelectorAll` per distinct container, rather than a fresh DOM query
 * inside every comparison. Ordering is identical to a pairwise comparison of
 * container membership → container index → `compareDocumentPosition`.
 */
function mlvSortMenuItemsByDomOrder(
  items: readonly MenuKeyItem[],
): MenuKeyItem[] {
  const orderIndex = mlvBuildMenuItemOrderIndex(items);
  return [...items].sort(mlvCreateMenuDomOrderComparator(orderIndex));
}

/**
 * Resolves each item's panel/host container and its index within that
 * container. Container row order is queried at most once per container, and
 * only for containers holding at least two of the items being sorted — a
 * container holding a single item can never be the *shared* container of a
 * pair, so its index is never read.
 */
function mlvBuildMenuItemOrderIndex(
  items: readonly MenuKeyItem[],
): ReadonlyMap<MenuKeyItem, MlvMenuItemOrderEntry> {
  const entries = new Map<MenuKeyItem, MlvMenuItemOrderEntry>();
  const panelCounts = new Map<HTMLElement, number>();
  const hostCounts = new Map<HTMLElement, number>();

  for (const item of items) {
    const element = item._elementRef?.nativeElement;
    if (!element) {
      continue;
    }

    const panelContainer = mlvAsHtmlElement(
      element.closest(MLV_MENU_PANEL_CONTAINER_SELECTOR),
    );
    const hostContainer = mlvAsHtmlElement(
      element.closest(MLV_MENU_HOST_CONTAINER_SELECTOR),
    );

    mlvCountContainer(panelCounts, panelContainer);
    mlvCountContainer(hostCounts, hostContainer);

    entries.set(item, {
      element,
      panelContainer,
      hostContainer,
      panelIndex: -1,
      hostIndex: -1,
    });
  }

  const panelOrders = mlvBuildContainerOrders(
    panelCounts,
    MLV_MENU_PANEL_ITEM_SELECTOR,
  );
  const hostOrders = mlvBuildContainerOrders(
    hostCounts,
    MLV_MENU_HOST_ITEM_SELECTOR,
  );

  for (const entry of entries.values()) {
    entry.panelIndex = mlvLookupContainerIndex(
      panelOrders,
      entry.panelContainer,
      entry.element,
    );
    entry.hostIndex = mlvLookupContainerIndex(
      hostOrders,
      entry.hostContainer,
      entry.element,
    );
  }

  return entries;
}

/**
 * Builds the comparator used for a single sort. Every branch is an identity
 * check or a `Map` read, so a comparison costs O(1) and touches no DOM.
 */
function mlvCreateMenuDomOrderComparator(
  orderIndex: ReadonlyMap<MenuKeyItem, MlvMenuItemOrderEntry>,
): (a: MenuKeyItem, b: MenuKeyItem) => number {
  return (a, b) => {
    const entryA = orderIndex.get(a);
    const entryB = orderIndex.get(b);

    if (!entryA || !entryB || entryA.element === entryB.element) {
      return 0;
    }

    if (
      entryA.panelContainer &&
      entryA.panelContainer === entryB.panelContainer
    ) {
      return mlvCompareOrderIndices(entryA.panelIndex, entryB.panelIndex);
    }

    if (entryA.hostContainer && entryA.hostContainer === entryB.hostContainer) {
      return mlvCompareOrderIndices(entryA.hostIndex, entryB.hostIndex);
    }

    return mlvCompareDocumentOrder(entryA.element, entryB.element);
  };
}

/** Increments the item count for a resolved container, ignoring `null`. */
function mlvCountContainer(
  counts: Map<HTMLElement, number>,
  container: HTMLElement | null,
): void {
  if (container) {
    counts.set(container, (counts.get(container) ?? 0) + 1);
  }
}

/**
 * Reads DOM row order for every container shared by at least two of the sorted
 * items — one `querySelectorAll` per container, never per comparison.
 */
function mlvBuildContainerOrders(
  counts: ReadonlyMap<HTMLElement, number>,
  itemSelector: string,
): ReadonlyMap<HTMLElement, ReadonlyMap<Element, number>> {
  const orders = new Map<HTMLElement, ReadonlyMap<Element, number>>();

  for (const [container, count] of counts) {
    if (count < 2) {
      continue;
    }

    const order = new Map<Element, number>();
    container
      .querySelectorAll(itemSelector)
      .forEach((element, index) => order.set(element, index));
    orders.set(container, order);
  }

  return orders;
}

/** Index of `element` within its container's row order, or `-1` when absent. */
function mlvLookupContainerIndex(
  orders: ReadonlyMap<HTMLElement, ReadonlyMap<Element, number>>,
  container: HTMLElement | null,
  element: HTMLElement,
): number {
  if (!container) {
    return -1;
  }

  return orders.get(container)?.get(element) ?? -1;
}

/** Orders two container indices, treating a missing row (`-1`) as equal. */
function mlvCompareOrderIndices(aIndex: number, bIndex: number): number {
  if (aIndex === -1 || bIndex === -1 || aIndex === bIndex) {
    return 0;
  }

  return aIndex < bIndex ? -1 : 1;
}

/** Document-position fallback for items that share no menu container. */
function mlvCompareDocumentOrder(aEl: HTMLElement, bEl: HTMLElement): number {
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
 * removed elements that are (or contain) a menu row qualify; content churn
 * inside an existing row is skipped without touching the sort.
 */
function mlvMenuMutationsAffectItemOrder(
  records: readonly MutationRecord[],
): boolean {
  for (const record of records) {
    if (
      mlvNodesContainMenuItem(record.addedNodes) ||
      mlvNodesContainMenuItem(record.removedNodes)
    ) {
      return true;
    }
  }

  return false;
}

/** Whether any node in the list is, or contains, a menu row element. */
function mlvNodesContainMenuItem(nodes: NodeList): boolean {
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index];
    if (
      node instanceof Element &&
      (node.matches(MLV_MENU_ITEM_MUTATION_SELECTOR) ||
        node.querySelector(MLV_MENU_ITEM_MUTATION_SELECTOR) !== null)
    ) {
      return true;
    }
  }

  return false;
}

function mlvGetSharedMenuContainer(
  items: readonly MenuKeyItem[],
): HTMLElement | null {
  const containers = items
    .map((item) => item._elementRef?.nativeElement)
    .filter((element): element is HTMLElement => element instanceof HTMLElement)
    .map(
      (element) =>
        element.closest(MLV_MENU_PANEL_CONTAINER_SELECTOR) ??
        element.closest(MLV_MENU_HOST_CONTAINER_SELECTOR),
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

function mlvMenuItemsMatchOrder(
  currentItems: readonly MenuKeyItem[],
  nextItems: readonly MenuKeyItem[],
): boolean {
  return currentItems.every((item, index) => item === nextItems[index]);
}

function mlvAsHtmlElement(element: Element | null): HTMLElement | null {
  return element instanceof HTMLElement ? element : null;
}
