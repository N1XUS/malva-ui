import type { MlvTone } from '@malva-ui/cdk/utils';
import type {
  MlvDataSourceFilterOperator,
  MlvSortState,
} from '@malva-ui/cdk/data-source';

export type { MlvSearchFieldTrigger } from '@malva-ui/core/search-field';

// `MlvSortDirection`, `MlvSortState`, `MlvFilterState` and `MlvSearchState` are
// re-exported from `@malva-ui/cdk/data-source` by the star export in
// `data-source.ts`, so this module does not restate them.

/**
 * @deprecated since 0.1.12 — removed in 1.0. Use `MlvDataSourceFilterOperator`
 * from `@malva-ui/cdk/data-source`.
 */
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
/**
 * Horizontal alignment of a column's header and body cells.
 *
 * A **logical alias** that mirrors in RTL: `'left'` aligns to the inline-start
 * edge (`text-align: start`) and `'right'` to the inline-end edge
 * (`text-align: end`), so under a `[dir="rtl"]` ancestor `'left'` renders on
 * the right. The names predate the table's RTL support and are kept for
 * compatibility.
 */
export type MlvColumnAlign = 'left' | 'center' | 'right';

/**
 * Side a column can be pinned to.
 *
 * A **logical alias** that mirrors in RTL: `'left'` pins to the inline-start
 * edge and `'right'` to the inline-end edge, so under a `[dir="rtl"]` ancestor
 * a `'left'` column is rendered first — on the right — and sticks to the
 * scroller's right edge. The names predate the table's RTL support and are
 * kept for compatibility.
 */
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
  /**
   * Keys of the columns effectively pinned to the inline-start edge
   * (`pinSide: 'left'`), in their declaration order.
   */
  readonly pinnedStartColumnKeys: readonly string[];
  /**
   * Keys of the columns effectively pinned to the inline-end edge
   * (`pinSide: 'right'`), in their declaration order.
   */
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

/** Payload of `rowEditStart` and `rowEditCancel`. */
export interface MlvEditEvent<T = Record<string, unknown>> {
  /**
   * The row's working copy — a shallow clone of `sourceRow` taken when editing
   * started (same prototype), which the `mlvDataTableEditCell` templates write
   * to. Only its top-level properties are its own: a nested object is shared
   * with `sourceRow`, so replace it (`row.meta = { ...row.meta, tag }`) rather
   * than mutate it. On cancel it carries the edits being discarded.
   */
  row: T;
  /**
   * View index of the row when the event fired: its position among the rows
   * currently rendered, after sort, filter, paging and tree expansion. It is
   * not a position in the consumer's data — use `sourceRow` for that.
   */
  index: number;
  /**
   * The consumer's own row object, as supplied through `data` — the row's
   * identity key. Stable across sort, filter, paging and tree expansion, so
   * this, not `index`, is what to find the row in your data by. The table
   * never assigns its properties; a template mutating a nested object of `row`
   * in place still writes through to it. Always set by `mlv-data-table`;
   * optional only so code constructing the event type keeps compiling.
   */
  sourceRow?: T;
}

/** Payload of `rowEditSave`. */
export interface MlvEditSaveEvent<T = Record<string, unknown>> {
  /**
   * The edited row — the working copy the `mlvDataTableEditCell` templates
   * wrote to. A new object (same prototype as `sourceRow`): write it back in
   * place of `sourceRow`, or copy it onto `sourceRow`. Until you do, the row
   * renders `sourceRow`'s pre-edit values. Nested objects are shared with
   * `sourceRow` and `originalRow` (see {@link MlvEditEvent.row}).
   */
  row: T;
  /**
   * View index of the row when it was saved (see {@link MlvEditEvent.index}).
   * Not a position in the consumer's data.
   */
  index: number;
  /**
   * Shallow clone of the row taken when editing started. Its top-level values
   * are the pre-edit ones; a nested object is the same one `row` and
   * `sourceRow` hold, so an in-place nested mutation shows here too.
   */
  originalRow: T;
  /**
   * The consumer's own row object, as supplied through `data` — the row's
   * identity key and the entry to replace with `row`. Stable across sort,
   * filter, paging and tree expansion. The table never assigns its
   * properties. Always set by `mlv-data-table`; optional only so code
   * constructing the event type keeps compiling.
   */
  sourceRow?: T;
}

// ---- Row click ----------------------------------------------------------------

/** Payload of `rowClick`. */
export interface MlvRowClickEvent<T = Record<string, unknown>> {
  /** The clicked row — the consumer's own object, as supplied through `data`. */
  row: T;
  /** View index of the clicked row among the rows currently rendered. */
  index: number;
  /** The originating pointer event. */
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
