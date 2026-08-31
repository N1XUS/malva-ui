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
      const orderedItems = items.filter((item) => currentItems.includes(item));
      const unorderedItems = currentItems.filter(
        (item) => !orderedItems.includes(item),
      );
      const nextItems = [
        ...orderedItems,
        ...[...unorderedItems].sort(mlvCompareMenubarItemsByDomOrder),
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

      const nextItems = [...items].sort(mlvCompareMenubarItemsByDomOrder);
      return mlvMenubarItemsMatchOrder(items, nextItems) ? items : nextItems;
    });
  }
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

function mlvGetSharedMenubarContainer(
  items: readonly MlvMenubarItem[],
): HTMLElement | null {
  const containers = items
    .map((item) =>
      (item as MlvOrderedMenubarItem)._elementRef?.nativeElement.closest(
        'mlv-menubar',
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

function mlvMenubarItemsMatchOrder(
  currentItems: readonly MlvMenubarItem[],
  nextItems: readonly MlvMenubarItem[],
): boolean {
  return currentItems.every((item, index) => item === nextItems[index]);
}
