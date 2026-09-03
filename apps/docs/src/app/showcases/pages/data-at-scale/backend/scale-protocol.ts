/**
 * Wire contract shared by the `data-at-scale` showcase and its Web Worker
 * backend.
 *
 * The Angular build bundles a worker entry point with a nested, plugin-less
 * esbuild pass, so TypeScript path aliases (`@malva-ui/*`) are **not**
 * resolvable from anything reachable by `scale.worker.ts`. Every type in
 * `backend/` is therefore declared locally, even where `@malva-ui/cdk/data-source`
 * already ships an identical shape. The declarations are kept structurally
 * compatible with `MlvSortState`, `MlvFilterState`, `MlvSearchState` and
 * `MlvDataSourceState` on purpose, so `ScaleDataSource` can forward the
 * library's own values across `postMessage` without translating them.
 *
 * Everything here must also be structured-cloneable: plain data, no class
 * instances, no functions.
 */

/** Direction a single sorted key is ordered in. Mirrors `MlvSortDirection`. */
export type ScaleSortDirection = 'asc' | 'desc';

/** The one active sort of a query. Mirrors `MlvSortState`. */
export interface ScaleSortState {
  readonly key: string;
  readonly direction: ScaleSortDirection;
}

/** Predicate operators the engine understands. Mirrors `MlvDataSourceFilterOperator`. */
export type ScaleFilterOperator =
  | 'contains'
  | 'not-contains'
  | 'equals'
  | 'not-equals'
  | 'in'
  | 'not-in';

/** One column predicate. Mirrors `MlvFilterState`. */
export interface ScaleFilterState {
  readonly key: string;
  readonly operator: ScaleFilterOperator;
  readonly value: unknown;
}

/**
 * Global search state. `keys` lists the row keys allowed to match; an empty
 * list means "no search" here — unlike `MlvArrayDataSource`, this backend never
 * needs the natural-field mode because the table always passes its `searchable`
 * column keys.
 */
export interface ScaleSearchState {
  readonly query: string;
  readonly keys: readonly string[];
}

/** Everything the engine reads to produce one slice. Mirrors `MlvDataSourceState`. */
export interface ScaleQueryState {
  readonly sort: ScaleSortState | null;
  readonly filters: readonly ScaleFilterState[];
  readonly search: ScaleSearchState | null;
  /** 1-based page number. */
  readonly page: number;
  /** Page size. {@link SCALE_ALL_ROWS} or any non-finite value disables slicing. */
  readonly perPage: number;
}

/**
 * One generated enterprise account (or, when nested under `_mlvChildren`, one
 * workspace belonging to an account).
 *
 * `_mlvChildren` is the data table's tree-row marker, so a child row carries
 * exactly the same fields as its parent and renders in the same columns.
 */
export interface ScaleRow {
  /** Stable, dataset-unique identity. Top-level rows take `1..rowCount`; children continue above that. */
  readonly id: number;
  /** Human-facing reference code, e.g. `ACC-000042` or `ACC-000042-W2`. */
  readonly ref: string;
  readonly account: string;
  readonly owner: string;
  readonly region: string;
  readonly industry: string;
  readonly plan: string;
  readonly status: string;
  readonly seats: number;
  /** Annual recurring revenue in whole units of currency. */
  readonly arr: number;
  /** Health score, 0-100. */
  readonly health: number;
  /** Renewal day as `YYYY-MM-DD`. Derived from a fixed anchor, never from `Date.now()`. */
  readonly renewalDate: string;
  /**
   * Child rows, present only when the dataset was generated in tree mode.
   *
   * Deliberately a **mutable** array type: `mlv-data-table` declares its own
   * tree marker as `_mlvChildren?: MlvDataRow[]`, and a `readonly` element type
   * here would make `MlvDataSource<ScaleRow>` unassignable to the table's
   * `[data]` input.
   */
  readonly _mlvChildren?: ScaleRow[];
}

/** The three inputs that fully determine a dataset. */
export interface ScaleDatasetConfig {
  /** PRNG seed. The same seed yields byte-identical rows on every machine. */
  readonly seed: number;
  /** Number of **top-level** rows to generate. */
  readonly rowCount: number;
  /** Whether accounts get `_mlvChildren` workspaces. */
  readonly tree: boolean;
}

/** Asks the worker to (re)generate its dataset. Answered with {@link ScaleReadyResponse}. */
export interface ScaleInitRequest {
  readonly type: 'init';
  readonly config: ScaleDatasetConfig;
}

/** Asks the worker to run one sort/filter/search/page pass. Answered with {@link ScaleResultResponse}. */
export interface ScaleQueryRequest {
  readonly type: 'query';
  /** Monotonic request id; the source drops any response that is not the newest. */
  readonly id: number;
  readonly state: ScaleQueryState;
  /** Artificial round-trip delay, applied **after** the compute is measured. */
  readonly latencyMs: number;
}

/** Anything the main thread sends to the backend. */
export type ScaleRequest = ScaleInitRequest | ScaleQueryRequest;

/** Emitted once per `init`, when the dataset exists. */
export interface ScaleReadyResponse {
  readonly type: 'ready';
  readonly config: ScaleDatasetConfig;
  /** Number of top-level rows — equals `config.rowCount`. */
  readonly topLevelRows: number;
  /** Top-level rows plus every nested child. */
  readonly totalRows: number;
  /** Wall-clock cost of generating the dataset, in the backend's context. */
  readonly generateMs: number;
  /** Absolute epoch milliseconds at send time — see {@link absoluteNow}. */
  readonly sentAt: number;
}

/** Emitted once per `query`. */
export interface ScaleResultResponse {
  readonly type: 'result';
  /** Echoes {@link ScaleQueryRequest.id}. */
  readonly id: number;
  /** The requested slice — the whole result set when the query was unpaged. */
  readonly rows: readonly ScaleRow[];
  /** Rows matching search + filters, **before** paging. */
  readonly total: number;
  /** Cost of the sort/filter/page pass alone; excludes {@link latencyMs} and transfer. */
  readonly computeMs: number;
  /** The artificial delay that was applied, echoed so the UI can subtract it. */
  readonly latencyMs: number;
  /** Absolute epoch milliseconds at send time — see {@link absoluteNow}. */
  readonly sentAt: number;
}

/** Anything the backend sends to the main thread. */
export type ScaleResponse = ScaleReadyResponse | ScaleResultResponse;

/**
 * The page size `mlv-data-table` forces onto its source in virtual-scroll and
 * infinite modes. The engine reads it as "return the whole result set" instead
 * of slicing a 100k array for nothing.
 */
export const SCALE_ALL_ROWS = Number.MAX_SAFE_INTEGER;

/** Whether a page size means "no slicing". */
export function isUnpaged(perPage: number): boolean {
  return !Number.isFinite(perPage) || perPage >= SCALE_ALL_ROWS;
}

/**
 * Milliseconds since the Unix epoch, measured on the monotonic clock.
 *
 * A worker and its page have different `performance.timeOrigin`s, so
 * `performance.now()` is not comparable across them. Adding the origin makes
 * both sides speak absolute time, which is what lets the source attribute the
 * `postMessage` structured-clone cost separately from worker compute.
 */
export function absoluteNow(): number {
  return typeof performance === 'undefined'
    ? Date.now()
    : performance.timeOrigin + performance.now();
}
