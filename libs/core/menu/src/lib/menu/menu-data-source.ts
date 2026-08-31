import { DestroyRef, computed, inject, signal } from '@angular/core';
import type { Signal } from '@angular/core';
import { MlvDataSource } from '@malva-ui/cdk/data-source';
import type { Subscription } from 'rxjs';
import type { MlvMenuDataSource, MlvMenuItemData } from './menu-data.types';

/** Internal adapter that normalizes arrays and `MlvDataSource` instances. */
export class MlvMenuDataSourceAdapter<T> {
  /** @private The current source identity the adapter exposes. */
  private readonly _source = signal<MlvMenuDataSource<T>>([]);
  /** @private Memoized `connect()` signals keyed by data-source identity. */
  private readonly _connected = new Map<MlvDataSource<T>, Signal<T[]>>();

  /** Current top-level menu items for the active source. */
  readonly items = computed<T[]>(() => {
    const source = this._source();

    if (source instanceof MlvDataSource) {
      const items = this._connected.get(source);
      return items ? items() : [];
    }

    return source;
  });

  readonly loading = computed(() => {
    const source = this._source();
    return source instanceof MlvDataSource ? source.loading() : false;
  });

  /** Replaces the active source, connecting data sources once per identity. */
  setSource(source: MlvMenuDataSource<T>): void {
    if (source instanceof MlvDataSource && !this._connected.has(source)) {
      this._connected.set(source, source.connect());
    }

    this._source.set(source);
  }
}

/** Internal lazy loader for submenu children streams. */
export class MlvMenuChildrenDataSource<T = unknown> {
  /** @private Destroy hook used to tear down the child subscription. */
  private readonly _destroyRef = inject(DestroyRef);
  /** @private Latest emitted child items. */
  private readonly _items = signal<MlvMenuItemData<T>[]>([]);
  /** @private Loading state for the first child request. */
  private readonly _loading = signal(false);
  /** @private Guards the one-time lazy subscription. */
  private _loaded = false;
  private _destroyed = false;
  /** @private Active child-stream subscription, if loading has started. */
  private _subscription: Subscription | null = null;

  /** Latest child items emitted by the submenu stream. */
  readonly items = this._items.asReadonly();
  /** Whether the first child payload is still pending. */
  readonly loading = this._loading.asReadonly();

  constructor(private readonly _children?: MlvMenuItemData<T>['children']) {
    this._destroyRef.onDestroy(() => this._subscription?.unsubscribe());
  }

  /** Starts the lazy child subscription the first time a submenu is opened. */
  ensureLoaded(): void {
    if (this._destroyed || this._loaded || !this._children) return;

    this._loaded = true;
    this._loading.set(true);
    this._subscription = this._children.subscribe({
      next: (items) => {
        this._items.set(items);
        this._loading.set(false);
      },
      error: () => {
        this._items.set([]);
        this._loading.set(false);
      },
    });
  }

  /** Stops the child stream when its owning row changes source identity. */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this._subscription?.unsubscribe();
    this._subscription = null;
  }
}
