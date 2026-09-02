import type { MlvTone } from '@malva-ui/cdk/utils';
import type {
  MlvDataTableColumn,
  MlvDataTablePresentationState,
  MlvFilterState,
} from '@malva-ui/core/data-table';
import type { MlvViewVariant } from '@malva-ui/core/view-variant';
import {
  SCALE_INDUSTRIES,
  SCALE_PLANS,
  SCALE_REGIONS,
  SCALE_STATUSES,
} from './backend/scale-dataset';
import type { ScaleRow } from './backend/scale-protocol';

/** How the table reads the worker-held dataset. */
export type ScaleTableMode = 'paged' | 'virtual';

/**
 * The durable state one saved view restores.
 *
 * Deliberately **not** including the dataset controls (size, tree mode,
 * latency, table mode): a saved view is a way of looking at data, and mixing
 * the benchmark's own knobs into it would let selecting a view silently
 * regenerate 250k rows.
 */
export interface ScaleViewState {
  /** Applied global search string. */
  readonly search: string;
  /** Applied column predicates, in a stable order. */
  readonly filters: readonly MlvFilterState[];
  /** Sort, column visibility, pinning, widths and page size. */
  readonly table: MlvDataTablePresentationState;
}

/** One selectable dataset size. */
export interface ScaleDatasetSize {
  /** Number of top-level rows to generate. */
  readonly rows: number;
  /** Human label for the select option. */
  readonly label: string;
}

/**
 * Seed every visitor's dataset is generated from.
 *
 * Fixed on purpose: the same seed produces byte-identical rows in every
 * browser, on every machine and across reloads, so two people comparing numbers
 * are looking at the same 100,000 accounts.
 */
export const SCALE_SEED = 20260901;

/** Dataset sizes offered by the size control. The first one is the default. */
export const SCALE_DATASET_SIZES: readonly ScaleDatasetSize[] = [
  { rows: 100_000, label: '100,000 rows' },
  { rows: 250_000, label: '250,000 rows' },
  { rows: 500_000, label: '500,000 rows' },
  { rows: 1_000_000, label: '1,000,000 rows' },
];

/** Default artificial per-query backend delay, in milliseconds. */
export const SCALE_DEFAULT_LATENCY_MS = 120;

/**
 * Row height in CSS pixels at `comfortable` density (`--mlv-dt-row-height`,
 * `3.75rem`).
 *
 * Virtual scroll positions rows from this number, so it must match what the
 * table actually renders. The showcase pins the table to `comfortable` rather
 * than inheriting the docs-wide density control for exactly that reason.
 */
export const SCALE_ROW_HEIGHT_PX = 60;

/** Height of the table's scroll surface — the virtual viewport in virtual mode. */
export const SCALE_TABLE_HEIGHT = '34rem';

/**
 * The tallest element a browser will actually scroll, in CSS pixels.
 *
 * Chromium clamps a scroll container's height to 2^24 − 2 px; Firefox stops a
 * little higher and WebKit higher still, so this is the smallest of the three
 * and the one worth designing against. It is not an `mlv-data-table` limit and
 * not a CDK limit — it is the DOM's.
 */
export const SCALE_MAX_SCROLLABLE_PX = 16_777_214;

/**
 * Rows above which one fixed-height virtual scroller stops working.
 *
 * `cdk-virtual-scroll-viewport` sizes its spacer at `rowHeight × rowCount`, so
 * past this many rows the spacer is taller than {@link SCALE_MAX_SCROLLABLE_PX},
 * the browser silently clamps it, and the rendered range lands outside the
 * visible window — an empty table, with no error anywhere. The showcase falls
 * back to server-side paging above it and says why, because "your data no
 * longer fits in one scroller" is exactly the point at which paging stops being
 * a preference.
 */
export const SCALE_MAX_VIRTUAL_ROWS = Math.floor(
  SCALE_MAX_SCROLLABLE_PX / SCALE_ROW_HEIGHT_PX,
);

/** @private Turns a string pool into the option list a filterable column takes. */
function optionsOf(values: readonly string[]): { label: string; value: string }[] {
  return values.map((value) => ({ label: value, value }));
}

/** Lifecycle labels shown in the Status column instead of the raw stored value. */
export const SCALE_STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  trial: 'Trial',
  pending: 'Pending',
  churned: 'Churned',
};

/** Semantic tone of one account's lifecycle status. */
export function scaleStatusTone(row: ScaleRow): MlvTone {
  switch (row.status) {
    case 'active':
      return 'success';
    case 'trial':
      return 'info';
    case 'churned':
      return 'danger';
    default:
      return 'warning';
  }
}

/**
 * Column definitions.
 *
 * `searchable` is load bearing: the table only forwards a search to its data
 * source for columns that declare it, so a column without the flag is invisible
 * to the worker's search pass. Likewise `filterable` + `filterConfig.options`
 * is what turns a column into a predicate the worker can run.
 */
export const SCALE_COLUMNS: MlvDataTableColumn<ScaleRow>[] = [
  {
    key: 'ref',
    title: 'Reference',
    sortable: true,
    searchable: true,
    pinned: true,
    pinSide: 'left',
    pinnable: true,
    width: '9.5rem',
  },
  {
    key: 'account',
    title: 'Account',
    sortable: true,
    searchable: true,
    pinnable: true,
    width: '17rem',
  },
  {
    key: 'owner',
    title: 'Owner',
    sortable: true,
    searchable: true,
    hideable: true,
    width: '11rem',
  },
  {
    key: 'region',
    title: 'Region',
    sortable: true,
    filterable: true,
    hideable: true,
    width: '10rem',
    filterConfig: { options: optionsOf(SCALE_REGIONS) },
  },
  {
    key: 'industry',
    title: 'Industry',
    sortable: true,
    filterable: true,
    hideable: true,
    width: '11rem',
    filterConfig: { options: optionsOf(SCALE_INDUSTRIES) },
  },
  {
    key: 'plan',
    title: 'Plan',
    sortable: true,
    filterable: true,
    hideable: true,
    width: '8.5rem',
    filterConfig: { options: optionsOf(SCALE_PLANS) },
  },
  {
    key: 'status',
    title: 'Status',
    sortable: true,
    filterable: true,
    hideable: true,
    width: '8.5rem',
    valueLabels: SCALE_STATUS_LABELS,
    tone: scaleStatusTone,
    filterConfig: {
      options: SCALE_STATUSES.map((value) => ({
        label: SCALE_STATUS_LABELS[value],
        value,
      })),
    },
  },
  {
    key: 'seats',
    title: 'Seats',
    sortable: true,
    hideable: true,
    align: 'right',
    width: '7rem',
  },
  {
    key: 'arr',
    title: 'ARR',
    sortable: true,
    hideable: true,
    align: 'right',
    pinnable: 'right',
    width: '9rem',
  },
  {
    key: 'health',
    title: 'Health',
    sortable: true,
    hideable: true,
    align: 'right',
    width: '7rem',
  },
  {
    key: 'renewalDate',
    title: 'Renewal',
    sortable: true,
    hideable: true,
    width: '9.5rem',
  },
];

/** Every column key, in declaration order. */
const ALL_COLUMN_KEYS = SCALE_COLUMNS.map((column) => column.key);

/** @private Builds a presentation state from the two things views actually vary. */
function tableState(
  sort: MlvDataTablePresentationState['sort'],
  perPage = 25,
): MlvDataTablePresentationState {
  return {
    sort,
    visibleColumnKeys: [...ALL_COLUMN_KEYS],
    pinnedStartColumnKeys: ['ref'],
    pinnedEndColumnKeys: [],
    columnWidths: {},
    perPage,
  };
}

/** Presentation the page starts from, and the one the "All accounts" view restores. */
export const SCALE_DEFAULT_TABLE_STATE = tableState({
  key: 'ref',
  direction: 'asc',
});

/** @private Read-only system views expose clone; the personal view can be updated. */
function capabilities(editable: boolean) {
  return {
    clone: !editable,
    update: editable,
    rename: false,
    delete: false,
    share: false,
  };
}

/**
 * Saved views over the worker-held dataset.
 *
 * `resultCount` is intentionally absent: the row count of a view is whatever
 * the worker reports for it, and printing a hard-coded number next to a live
 * total would be the one dishonest label on a page about honest numbers.
 */
export const SCALE_VIEW_VARIANTS: readonly MlvViewVariant<ScaleViewState>[] = [
  {
    id: 'all-accounts',
    name: 'All accounts',
    scope: 'system',
    locked: true,
    capabilities: capabilities(false),
    state: {
      search: '',
      filters: [],
      table: SCALE_DEFAULT_TABLE_STATE,
    },
  },
  {
    id: 'enterprise-by-arr',
    name: 'Enterprise by ARR',
    scope: 'system',
    locked: true,
    capabilities: capabilities(false),
    state: {
      search: '',
      filters: [{ key: 'plan', operator: 'equals', value: 'Enterprise' }],
      table: tableState({ key: 'arr', direction: 'desc' }),
    },
  },
  {
    id: 'emea-apac-trials',
    name: 'EMEA & APAC trials',
    scope: 'system',
    locked: true,
    capabilities: capabilities(false),
    state: {
      search: '',
      filters: [
        { key: 'region', operator: 'in', value: ['EMEA', 'APAC'] },
        { key: 'status', operator: 'equals', value: 'trial' },
      ],
      table: tableState({ key: 'renewalDate', direction: 'asc' }),
    },
  },
  {
    id: 'churn-watch',
    name: 'Churn watch',
    scope: 'personal',
    capabilities: capabilities(true),
    state: {
      search: '',
      filters: [{ key: 'status', operator: 'equals', value: 'churned' }],
      table: tableState({ key: 'health', direction: 'asc' }, 50),
    },
  },
];

/** The view the route falls back to for an unknown or missing `?view=` value. */
export const SCALE_DEFAULT_VIEW = SCALE_VIEW_VARIANTS[0];

/**
 * The predicate the "Measure filter latency" button toggles.
 *
 * A single equality against a low-cardinality column keeps the measurement
 * about the round trip rather than about how expensive one particular predicate
 * happens to be.
 */
export const SCALE_BENCHMARK_FILTER: MlvFilterState = {
  key: 'status',
  operator: 'equals',
  value: 'active',
};
