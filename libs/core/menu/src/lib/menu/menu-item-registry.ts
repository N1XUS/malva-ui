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
        ...[...unorderedItems].sort(mlvCompareMenuItemsByDomOrder),
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

    this._mutationObserver = new MutationObserver(() => this._resyncItems());
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

      const nextItems = [...items].sort(mlvCompareMenuItemsByDomOrder);
      return mlvMenuItemsMatchOrder(items, nextItems) ? items : nextItems;
    });
  }
}

function mlvCompareMenuItemsByDomOrder(a: MenuKeyItem, b: MenuKeyItem): number {
  const aEl = a._elementRef?.nativeElement;
  const bEl = b._elementRef?.nativeElement;

  if (!aEl || !bEl || aEl === bEl) {
    return 0;
  }

  const panelContainer = mlvGetSharedMenuItemContainer(
    aEl,
    bEl,
    '[role="menu"]',
  );
  if (panelContainer) {
    return mlvCompareWithinContainer(
      panelContainer,
      '[role="menuitem"]',
      aEl,
      bEl,
    );
  }

  const hostContainer = mlvGetSharedMenuItemContainer(aEl, bEl, 'mlv-menu');
  if (hostContainer) {
    return mlvCompareWithinContainer(
      hostContainer,
      'mlv-list-item[mlvMenuItem]',
      aEl,
      bEl,
    );
  }

  const position = aEl.compareDocumentPosition(bEl);
  if (position & Node.DOCUMENT_POSITION_DISCONNECTED) {
    return 0;
  }
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
  if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  return 0;
}

function mlvGetSharedMenuContainer(
  items: readonly MenuKeyItem[],
): HTMLElement | null {
  const containers = items
    .map((item) => item._elementRef?.nativeElement)
    .filter((element): element is HTMLElement => element instanceof HTMLElement)
    .map(
      (element) =>
        element.closest('[role="menu"]') ?? element.closest('mlv-menu'),
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

function mlvGetSharedMenuItemContainer(
  aEl: HTMLElement,
  bEl: HTMLElement,
  selector: string,
): HTMLElement | null {
  const aContainer = mlvAsHtmlElement(aEl.closest(selector));
  const bContainer = mlvAsHtmlElement(bEl.closest(selector));

  return aContainer && aContainer === bContainer ? aContainer : null;
}

function mlvAsHtmlElement(element: Element | null): HTMLElement | null {
  return element instanceof HTMLElement ? element : null;
}

function mlvCompareWithinContainer(
  container: HTMLElement,
  itemSelector: string,
  aEl: HTMLElement,
  bEl: HTMLElement,
): number {
  const orderedItems = Array.from(
    container.querySelectorAll<HTMLElement>(itemSelector),
  );
  const aIndex = orderedItems.indexOf(aEl);
  const bIndex = orderedItems.indexOf(bEl);

  if (aIndex === -1 || bIndex === -1 || aIndex === bIndex) {
    return 0;
  }

  return aIndex < bIndex ? -1 : 1;
}
