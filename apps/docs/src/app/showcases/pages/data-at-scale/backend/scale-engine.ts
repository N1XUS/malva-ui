import { normalizeScaleText } from './scale-normalize';
import { isUnpaged } from './scale-protocol';
import type {
  ScaleFilterState,
  ScaleQueryState,
  ScaleRow,
} from './scale-protocol';

/**
 * The pure search -> filter -> sort -> page pipeline the worker runs.
 *
 * It intentionally reproduces `MlvArrayDataSource`'s semantics (OR across
 * search keys, AND across filters, `Intl.Collator` with `numeric: true` for
 * strings, numeric compare for number pairs, total counted before paging), so
 * the showcase demonstrates moving the *same* work off the main thread rather
 * than running different work.
 *
 * Like `MlvArrayDataSource`, tree children are **not** filtered or sorted:
 * predicates apply to top-level rows, and a surviving row carries its
 * `_mlvChildren` along untouched.
 *
 * Extracted from `scale.worker.ts` so it is directly unit-testable — jsdom has
 * no `Worker`, so a spec can never load the worker itself.
 */

/**
 * @private One collator for every string comparison.
 * `String.prototype.localeCompare` builds a fresh collator per call, which
 * would make locale resolution O(n log n) per sort on a 100k dataset.
 */
const SCALE_COLLATOR = new Intl.Collator(undefined, { numeric: true });

/** What one pass of {@link runScaleQuery} produced. */
export interface ScaleQueryResult {
  /** The requested slice — the whole result set when the query was unpaged. */
  readonly rows: ScaleRow[];
  /** Rows matching search and filters, **before** paging. */
  readonly total: number;
  /** Wall-clock cost of this pass. Excludes artificial latency and transfer. */
  readonly computeMs: number;
}

/** @private A filter plus the one comparand normalisation its operator needs. */
interface PreparedFilter {
  /** The filter exactly as configured. */
  readonly state: ScaleFilterState;
  /** Populated only for `contains` / `not-contains`; an unread `''` otherwise. */
  readonly normalizedValue: string;
}

/** @private Reads one column off a row without widening `ScaleRow` with an index signature. */
function read(row: ScaleRow, key: string): unknown {
  return (row as unknown as Record<string, unknown>)[key];
}

/** @private Hoists a filter's comparand normalisation out of the row loop. */
function prepare(filter: ScaleFilterState): PreparedFilter {
  const normalizes =
    filter.operator === 'contains' || filter.operator === 'not-contains';
  return {
    state: filter,
    normalizedValue: normalizes
      ? normalizeScaleText(String(filter.value ?? ''))
      : '',
  };
}

/** @private Evaluates one prepared filter against a row. */
function passesFilter(row: ScaleRow, filter: PreparedFilter): boolean {
  const value = read(row, filter.state.key);
  const comparand = filter.state.value;
  switch (filter.state.operator) {
    case 'equals':
      return value === comparand;
    case 'not-equals':
      return value !== comparand;
    case 'contains':
      return normalizeScaleText(String(value ?? '')).includes(
        filter.normalizedValue,
      );
    case 'not-contains':
      return !normalizeScaleText(String(value ?? '')).includes(
        filter.normalizedValue,
      );
    case 'in':
      return Array.isArray(comparand) && comparand.includes(value);
    case 'not-in':
      return Array.isArray(comparand) && !comparand.includes(value);
    default:
      return true;
  }
}

/** @private Whether any searched key of a row contains the normalised query. */
function matchesQuery(
  row: ScaleRow,
  keys: readonly string[],
  normalizedQuery: string,
): boolean {
  for (const key of keys) {
    if (
      normalizeScaleText(String(read(row, key) ?? '')).includes(normalizedQuery)
    ) {
      return true;
    }
  }
  return false;
}

/** @private Orders two column values, numerically when both sides are numbers. */
function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return SCALE_COLLATOR.compare(String(a ?? ''), String(b ?? ''));
}

/**
 * Runs one query against an in-memory dataset.
 *
 * @param rows - The full dataset. Never mutated; sorting works on a copy.
 * @param state - Sort, filters, search, page and page size.
 */
export function runScaleQuery(
  rows: readonly ScaleRow[],
  state: ScaleQueryState,
): ScaleQueryResult {
  const started = typeof performance === 'undefined' ? 0 : performance.now();

  const normalizedQuery = normalizeScaleText(state.search?.query.trim() ?? '');
  const searchKeys = state.search?.keys ?? [];
  const searching = normalizedQuery.length > 0 && searchKeys.length > 0;
  const filters = state.filters.map(prepare);

  const matched: readonly ScaleRow[] =
    !searching && filters.length === 0
      ? rows
      : rows.filter(
          (row) =>
            (!searching || matchesQuery(row, searchKeys, normalizedQuery)) &&
            filters.every((filter) => passesFilter(row, filter)),
        );

  const total = matched.length;
  const sort = state.sort;

  let ordered: readonly ScaleRow[];
  if (!sort) {
    ordered = matched;
  } else {
    // Decorate-sort-undecorate: `read` runs once per row instead of twice per
    // comparison — O(n) reads rather than O(n log n) on a 100k dataset.
    // `Array.prototype.sort` is stable, so equal keys keep dataset order.
    const decorated = matched.map((row) => ({
      row,
      value: read(row, sort.key),
    }));
    const descending = sort.direction === 'desc';
    decorated.sort((a, b) => {
      const cmp = compareValues(a.value, b.value);
      return descending ? -cmp : cmp;
    });
    ordered = decorated.map((entry) => entry.row);
  }

  // Slicing a page already produces a fresh array, and so does sorting; the
  // only branch that would otherwise hand back the caller's own array is an
  // unpaged, unsorted, unfiltered query, so that is the only branch that pays
  // for a copy. Copying before the slice instead would duplicate the whole
  // dataset on every page click and throw the duplicate away one line later.
  const start = Math.max(0, (state.page - 1) * state.perPage);
  const paged: ScaleRow[] = !isUnpaged(state.perPage)
    ? ordered.slice(start, start + state.perPage)
    : ordered === rows
      ? rows.slice()
      : (ordered as ScaleRow[]);

  const finished = typeof performance === 'undefined' ? 0 : performance.now();
  return { rows: paged, total, computeMs: finished - started };
}
