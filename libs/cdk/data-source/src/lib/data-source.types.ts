/** Direction a single sorted key is ordered in. */
export type MlvSortDirection = 'asc' | 'desc';

/** The one active sort of a data source. `null` on the source means unsorted. */
export interface MlvSortState {
  /** Row key being sorted. Ignored (treated as absent) for primitive rows. */
  key: string;
  /** Ordering applied to {@link key}. */
  direction: MlvSortDirection;
}

/**
 * Predicate operators understood by `MlvArrayDataSource` and the data table's
 * filter UI.
 *
 * Deliberately **not** named `MlvFilterOperator`: `@malva-ui/core/filter` owns
 * that name for its own, wider condition-model union, and two different public
 * types sharing one name across the family is a footgun (and an ambiguous
 * star-export in the `@malva-ui/core` root barrel).
 */
export type MlvDataSourceFilterOperator =
  | 'contains'
  | 'not-contains'
  | 'equals'
  | 'not-equals'
  | 'in'
  | 'not-in';

/**
 * One column predicate. A data source ANDs every active filter together (and
 * with the global search) before sorting and paging.
 */
export interface MlvFilterState {
  /** Row key the predicate reads. */
  key: string;
  /** Comparison applied to the key's value. */
  operator: MlvDataSourceFilterOperator;
  /**
   * Comparand. `contains`/`not-contains` stringify and normalise it (case- and
   * diacritic-insensitive); `in`/`not-in` require an array and test membership
   * by identity.
   */
  value: unknown;
}

/**
 * Global search state. `keys` lists the row keys allowed to match; an
 * **empty** `keys` array means "match against the source's natural fields"
 * — the contract option controls (`mlv-select`, `mlv-combobox`,
 * `[mlvAutocomplete]`) use, since they know no column keys.
 */
export interface MlvSearchState {
  /** User-entered query. Whitespace-only values disable search. */
  query: string;
  /** Explicit row keys that may participate in search; empty = natural fields. */
  keys: readonly string[];
}

/**
 * Serialisable snapshot of everything a data source reads to produce its slice
 * — useful for persisting table/dropdown state or restoring it after a reload.
 */
export interface MlvDataSourceState {
  /** Active sort, or `null` when unsorted. */
  sort: MlvSortState | null;
  /** Active column predicates, ANDed together. */
  filters: MlvFilterState[];
  /** Optional for compatibility with data sources written before global search. */
  search?: MlvSearchState | null;
  /** Current page, **1-based**. */
  page: number;
  /** Page size. A non-finite value (`Infinity`) disables slicing. */
  perPage: number;
}
