import type { Signal } from '@angular/core';
import { signal } from '@angular/core';
import type {
  MlvFilterState,
  MlvSearchState,
  MlvSortState,
} from './data-source.types';

/**
 * Abstract base class for data sources consumed by `mlv-data-table` and the
 * option controls (`mlv-select`, `mlv-combobox`, `[mlvAutocomplete]`).
 * Extend it to implement custom fetching, server-side search, pagination, etc.
 *
 * Contract for `connect()`: it emits the **current page's slice**. Consumers
 * that page lazily (dropdowns) accumulate slices themselves.
 */
export abstract class MlvDataSource<T> {
  /** @protected Current sort state; `null` when unsorted. Reset page to 1 via `setSort`. */
  protected readonly _sort = signal<MlvSortState | null>(null);
  /** @protected Active filter list applied by subclasses. Reset page to 1 via `setFilters`. */
  protected readonly _filters = signal<MlvFilterState[]>([]);
  /** @protected Global query and the explicit keys it is allowed to search. */
  protected readonly _search = signal<MlvSearchState | null>(null);
  /** @protected Current 1-based page number. */
  protected readonly _page = signal(1);
  /** @protected Number of items shown per page. */
  protected readonly _perPage = signal(10);
  /**
   * @protected Whether the source is fetching. Subclasses flip it
   * **synchronously** when a request starts and back when it settles, so
   * consumers can distinguish "empty" from "not yet loaded".
   */
  protected readonly _loading = signal(false);

  /** Current sort state; `null` when unsorted. */
  readonly sort = this._sort.asReadonly();
  /** Active filter list. */
  readonly filters = this._filters.asReadonly();
  /** Active global search state; `null` when search is off. */
  readonly search = this._search.asReadonly();
  /** Current 1-based page number. */
  readonly page = this._page.asReadonly();
  /** Number of items per page. */
  readonly perPage = this._perPage.asReadonly();
  /** `true` while the source is fetching — drives loading affordances in consumers. */
  readonly loading = this._loading.asReadonly();

  /** Total number of items (after filtering). Paged remote sources return the server total. */
  abstract readonly totalItems: Signal<number>;

  /** The currently visible slice of data (current page). */
  abstract connect(): Signal<T[]>;

  /** Sets the active sort state and returns to page one. */
  setSort(sort: MlvSortState | null): void {
    this._sort.set(sort);
    this._page.set(1);
  }

  /** Replaces the active filter list and returns to page one. */
  setFilters(filters: MlvFilterState[]): void {
    this._filters.set(filters);
    this._page.set(1);
  }

  /** Sets global search independently from column filters and returns to page one. */
  setSearch(search: MlvSearchState | null): void {
    this._search.set(
      search ? { query: search.query, keys: [...search.keys] } : null,
    );
    this._page.set(1);
  }

  /** Moves to the given 1-based page. */
  setPage(page: number): void {
    this._page.set(page);
  }

  /** Sets the page size and returns to page one. */
  setPerPage(perPage: number): void {
    this._perPage.set(perPage);
    this._page.set(1);
  }
}
