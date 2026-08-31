import type { MlvTone } from '@malva-ui/cdk/utils';
import type {
  MlvDataSourceFilterOperator,
  MlvSortState,
} from '@malva-ui/cdk/data-source';

export type { MlvSearchFieldTrigger } from '@malva-ui/core/search-field';

// `MlvSortDirection`, `MlvSortState`, `MlvFilterState` and `MlvSearchState` are
// re-exported from `@malva-ui/cdk/data-source` by the star export in
// `data-source.ts`, so this module does not restate them.

/** @deprecated Use `MlvDataSourceFilterOperator` from `@malva-ui/cdk/data-source`. */
export type MlvDataTableFilterOperator = MlvDataSourceFilterOperator;

export interface MlvDataTableFilterOption {
  label: string;
  value: unknown;
}

/** Where filter controls are presented by the data table. */
export type MlvFilterDisplay = 'toolbar' | 'column' | 'none';

export interface MlvColumnFilterConfig {
  options?: MlvDataTableFilterOption[];
  operators?: MlvDataSourceFilterOperator[];
}

export type MlvColumnResponsive = Record<string | number, 'hidden' | 'visible'>;
export type MlvColumnAlign = 'left' | 'center' | 'right';

/** Side a column can be pinned to. */
export type MlvPinSide = 'left' | 'right';

/**
 * Maps raw cell values to human-readable labels for a column's default cell
 * renderer. Either an object keyed by the stringified raw value, or the same
 * `{ label, value }` option list already used by `filterConfig.options`.
 */
export type MlvColumnValueLabels =
  | Record<string, string>
  | ReadonlyArray<MlvDataTableFilterOption>;

/**
 * Resolves the semantic tone of one row so a column's default cell can render a
 * toned `mlv-badge`. Returning `null`/`undefined` falls back to plain text.
 *
 * Declared through the method-syntax bivariance form so a column list authored
 * against a concrete row type (`MlvDataTableColumn<User>[]`) stays assignable to
 * the table's `MlvDataTableColumn[]` input.
 */
export type MlvColumnToneFn<T = unknown> = {
  bivarianceHack(row: T): MlvTone | null | undefined;
}['bivarianceHack'];

export interface MlvDataTableColumn<T = unknown> {
  key: string;
  title?: string;
  sortable?: boolean;
  /** Include this column in the table's global search. */
  searchable?: boolean;
  filterable?: boolean;
  /**
   * Controls whether the user can toggle the pin state via the header pin button, and which sides are allowed.
   * - `true` — both sides allowed (clicking opens a popup with Pin Left / Pin Right / Unpin options).
   * - `'left'` / `'right'` — only the given side is allowed; clicking the pin button toggles directly.
   * - `['left', 'right']` — explicit list of allowed sides. A single-element list behaves like the direct-toggle string form; a multi-element list opens the popup.
   * - `false` / `undefined` — the column cannot be user-pinned (it may still be pinned at load time via `pinned`/`pinSide`).
   */
  pinnable?: boolean | MlvPinSide | MlvPinSide[];
  pinned?: boolean;
  pinSide?: MlvPinSide;
  hideable?: boolean;
  align?: MlvColumnAlign;
  resizable?: boolean;
  width?: string;
  minWidth?: string;
  /** Maximum width allowed while resizing. Pixel and percentage values are resolved to rendered CSS pixels. */
  maxWidth?: string;
  responsive?: MlvColumnResponsive;
  filterConfig?: MlvColumnFilterConfig;
  /**
   * Human-readable labels for the raw values of this column, used by the
   * **default** cell renderer only (a `mlvDataTableCell` template still wins).
   * Accepts a `Record<rawValue, label>` or a `{ label, value }` list.
   *
   * When omitted, the table falls back to `filterConfig.options`, so a column
   * that already declares option filters renders its option labels for free.
   */
  valueLabels?: MlvColumnValueLabels;
  /**
   * Semantic tone for the default cell renderer. When set (either a fixed
   * {@link MlvTone} or a per-row resolver), the default cell renders the value
   * as a muted `mlv-badge` instead of plain text. A resolver returning
   * `null`/`undefined` renders that row's cell as plain text.
   *
   * Ignored when a `mlvDataTableCell` template is provided for the column.
   */
  tone?: MlvTone | MlvColumnToneFn<T>;
}

/** Interaction that committed a user-controlled column width. */
export type MlvColumnResizeSource = 'pointer' | 'keyboard' | 'reset';

/** Payload emitted after a column width is committed or reset. */
export interface MlvColumnResizeEvent {
  /** Key of the resized column. */
  key: string;
  /**
   * Committed width in CSS pixels. `null` means the user override was removed
   * and the column returned to its declared/default width.
   */
  width: number | null;
  /** Interaction that committed the change. */
  source: MlvColumnResizeSource;
}

/**
 * Durable user-controlled presentation settings for an `mlv-data-table`.
 * Search, filters, selection, the current page, and loading state are
 * deliberately excluded because they are transient or application-owned.
 */
export interface MlvDataTablePresentationState {
  /** Active column sort, or `null` when no sort is applied. */
  readonly sort: MlvSortState | null;
  /** Visible column keys in their declaration order. */
  readonly visibleColumnKeys: readonly string[];
  /** Effectively left-pinned column keys in their declaration order. */
  readonly pinnedStartColumnKeys: readonly string[];
  /** Effectively right-pinned column keys in their declaration order. */
  readonly pinnedEndColumnKeys: readonly string[];
  /** Committed user width overrides in CSS pixels, keyed by column. */
  readonly columnWidths: Readonly<Record<string, number>>;
  /** Current items-per-page setting. */
  readonly perPage: number;
}

// ---- Column groups (multi-row headers) ----------------------------------------

export interface MlvDataTableColumnGroup {
  /** Display title for the group header cell. */
  title: string;
  /** Column keys this group spans. */
  columns: string[];
  /** Optional alignment for the group header cell. */
  align?: MlvColumnAlign;
}

// ---- Editable mode ------------------------------------------------------------

export type MlvEditMode = 'row' | 'cell';

export interface MlvEditEvent<T = Record<string, unknown>> {
  row: T;
  index: number;
}

export interface MlvEditSaveEvent<T = Record<string, unknown>> {
  row: T;
  index: number;
  originalRow: T;
}

// ---- Row click ----------------------------------------------------------------

export interface MlvRowClickEvent<T = Record<string, unknown>> {
  row: T;
  index: number;
  event: MouseEvent;
}

// ---- Row selection ------------------------------------------------------------

export type MlvSelectableMode = 'single' | 'multi' | false;

export interface MlvSelectionChangeEvent<T = Record<string, unknown>> {
  selectedRows: Set<T>;
  row?: T;
}

// ---- Pagination ---------------------------------------------------------------

/** Pagination strategy for the data table. `'paged'` renders the classic paginator footer; `'infinite'` hides it and emits `loadMore` as the user scrolls near the bottom. */
export type MlvPaginationMode = 'paged' | 'infinite';

/** Payload emitted by the data table when infinite scroll crosses the threshold. */
export interface MlvLoadMoreEvent {
  /** Next page the consumer should request (1-based). */
  page: number;
  /** Items-per-page configured on the table. */
  perPage: number;
  /** Distance in px from the bottom of the scroll container when the event fired. */
  distance: number;
}
