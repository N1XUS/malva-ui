import { signal } from '@angular/core';
import type { Signal } from '@angular/core';
import { MlvDataSource } from '@malva-ui/cdk/data-source';
import type {
  MlvFilterState,
  MlvSearchState,
  MlvSortState,
} from '@malva-ui/cdk/data-source';
import { absoluteNow, isUnpaged } from './backend/scale-protocol';
import type {
  ScaleDatasetConfig,
  ScaleQueryState,
  ScaleResponse,
  ScaleRow,
} from './backend/scale-protocol';
import type { ScaleBackend } from './scale-backend';

/** What the backend reported about the generated dataset. */
export interface ScaleDatasetReport {
  /** The config that produced it — seed, top-level row count, tree mode. */
  readonly config: ScaleDatasetConfig;
  /** Number of top-level rows. */
  readonly topLevelRows: number;
  /** Top-level rows plus every nested child. */
  readonly totalRows: number;
  /** Cost of generating the dataset inside the backend. */
  readonly generateMs: number;
}

/**
 * The decomposed cost of the most recent query.
 *
 * Kept split rather than reduced to one "latency" number because the showcase's
 * whole claim rests on which part of the round trip happened where: `computeMs`
 * is off-main-thread work, `latencyMs` is the artificial delay the visitor dialled
 * in, and `transferMs` is the structured clone that unavoidably lands on the
 * main thread.
 */
export interface ScaleQueryMetrics {
  /** Monotonic id of the query these numbers came from. */
  readonly requestId: number;
  /** Rows in the delivered slice. */
  readonly rowsReturned: number;
  /** Rows matching search and filters, before paging. */
  readonly total: number;
  /** Sort/filter/page cost inside the backend. Excludes latency and transfer. */
  readonly computeMs: number;
  /** The artificial delay that was applied. */
  readonly latencyMs: number;
  /**
   * Send-to-receive gap: the `postMessage` structured clone plus scheduling.
   *
   * Measured to the *arrival* of the message, before anything is done with it,
   * so it describes the transport alone. The main-thread work that follows the
   * arrival is {@link identifyMs}.
   */
  readonly transferMs: number;
  /**
   * Cost of the identity pass {@link ScaleDataSource} runs over the delivered
   * rows before publishing them.
   *
   * A full walk of the slice with a `Map` lookup per row, on the main thread —
   * so it is one of the numbers this showcase exists to account for, not an
   * implementation detail to hide. In virtual-scroll mode the "slice" is every
   * matching row, which is what makes it worth measuring separately.
   */
  readonly identifyMs: number;
  /**
   * Dispatch-to-published gap: `computeMs + latencyMs + transferMs +
   * identifyMs` plus queueing.
   *
   * Ends after the identity pass, not at the arrival of the message, so no
   * main-thread work between the two disappears from every published number.
   * It stops short of change detection, layout and paint — those are the
   * showcase's separately measured render cost.
   */
  readonly roundTripMs: number;
  /** Whether the slice is the whole result set (the table's virtual-scroll mode). */
  readonly unpaged: boolean;
}

/**
 * How long a request may go unanswered before it is declared failed, on top of
 * whatever artificial latency was dialled in.
 *
 * Generously long on purpose: generating a million rows is seconds of honest
 * work in a healthy worker, and a watchdog that fires on a slow machine would
 * be a worse bug than the one it guards against. It exists for the failures
 * that produce no event at all — a worker killed mid-allocation on a
 * memory-constrained device is not guaranteed to fire `error` first.
 */
export const SCALE_REQUEST_TIMEOUT_MS = 30_000;

/** Construction options for {@link ScaleDataSource}. */
export interface ScaleDataSourceOptions {
  /** Seed, top-level row count and tree mode of the dataset to generate. */
  readonly config: ScaleDatasetConfig;
  /** Artificial per-query delay, so loading affordances are actually visible. */
  readonly latencyMs: number;
  /**
   * Watchdog budget on top of {@link latencyMs}. Defaults to
   * {@link SCALE_REQUEST_TIMEOUT_MS}; specs shorten it.
   */
  readonly timeoutMs?: number;
}

/**
 * An `MlvDataSource` whose sort, filter, search and paging all happen in a
 * {@link ScaleBackend} — in the showcase, a Web Worker.
 *
 * Three details of `MlvDataTable`'s contract shape this class:
 *
 * 1. **`connect()` is read from a `computed`**, so it must be pure. It returns
 *    a signal created once in the field initialiser and never fetches, never
 *    writes. (Writing a signal there is `NG0600`.)
 * 2. **The table drives the source from five independent `effect()`s**, so a
 *    single interaction produces up to five setter calls in one turn. Every
 *    setter therefore only *schedules*; one request per microtask goes out.
 * 3. **Row identity is object identity.** `selectedRows` is a `Set<row>` and
 *    tree expansion is a `Set<row>`, so rows arriving as fresh structured
 *    clones on every fetch would silently clear selection and collapse every
 *    expanded node. {@link _identify} returns the first instance seen for a row
 *    id — including for nested `_mlvChildren` — so both survive a refetch.
 *
 * A fourth detail is the backend's, not the table's: a Web Worker can die
 * without answering anything — killed for allocating a million rows, or never
 * loaded at all. Every request is therefore watched by a timer as well as by
 * the backend's error channel, and either one ends the request, clears
 * {@link loading} and publishes {@link error}. Without that the table shows its
 * loading overlay forever with no way out but a reload.
 *
 * The source **owns** the backend it is given: {@link destroy} terminates it.
 */
export class ScaleDataSource extends MlvDataSource<ScaleRow> {
  /** @private The delivered slice. Written only from a settled, non-stale response. */
  private readonly _rows = signal<ScaleRow[]>([]);

  /**
   * @private The exact signal {@link connect} hands out, created once.
   *
   * `connect()` is called from inside `MlvDataTable.displayRows`, a `computed`
   * that re-runs on every dependency change; building a new signal per call
   * would churn the reactive graph for nothing.
   */
  private readonly _rowsReadonly = this._rows.asReadonly();

  /** @private Rows matching search and filters, before paging — the paginator's total. */
  private readonly _total = signal(0);

  /** @private Last `ready` report; `null` until the backend has generated a dataset. */
  private readonly _dataset = signal<ScaleDatasetReport | null>(null);

  /** @private Cost breakdown of the most recent applied response. */
  private readonly _metrics = signal<ScaleQueryMetrics | null>(null);

  /**
   * @private First-seen row instance per row id, so repeated fetches of the
   * same logical row hand back one object. Cleared whenever the dataset is
   * regenerated, because ids are reused with different content.
   */
  private readonly _identity = new Map<number, ScaleRow>();

  /** @private The transport. Terminated by {@link destroy}. */
  private readonly _backend: ScaleBackend;

  /** @private Why the last request failed; `null` while nothing has failed. */
  private readonly _error = signal<string | null>(null);

  /** @private Detaches the response listener. */
  private readonly _unsubscribe: () => void;

  /**
   * @private Detaches the backend's failure listener, when it offers one.
   *
   * `subscribeError` is optional on {@link ScaleBackend}: only the worker has a
   * transport that can fail independently of a request.
   */
  private readonly _unsubscribeError: () => void;

  /** @private Watchdog budget on top of the artificial latency. */
  private readonly _timeoutMs: number;

  /** @private The dataset currently requested from the backend. */
  private _config: ScaleDatasetConfig;

  /** @private Artificial per-query delay sent with every request. */
  private _latencyMs: number;

  /** @private Monotonic request counter; ids start at 1. */
  private _lastRequestId = 0;

  /** @private Id of the newest dispatched request. Older responses are dropped. */
  private _currentRequestId = 0;

  /** @private Whether a dispatch is already queued for this microtask. */
  private _scheduled = false;

  /** @private Absolute time the newest request was posted, for `roundTripMs`. */
  private _dispatchedAt = 0;

  /**
   * @private Page size the newest request went out with.
   *
   * `metrics.unpaged` reads this rather than comparing the returned row count
   * against the total: a filtered result that happens to fit in one page would
   * otherwise be reported as a full-result transfer.
   */
  private _dispatchedPerPage = 0;

  /** @private Watchdog for the newest request; `null` when nothing is in flight. */
  private _watchdog: ReturnType<typeof setTimeout> | null = null;

  /** @private Set by {@link destroy}; every callback becomes a no-op afterwards. */
  private _destroyed = false;

  /** Rows matching search and filters, before paging. Bound to the paginator. */
  readonly totalItems: Signal<number> = this._total.asReadonly();

  /** What the backend generated; `null` until the first `ready` message lands. */
  readonly dataset = this._dataset.asReadonly();

  /** Cost breakdown of the most recent query; `null` before the first response. */
  readonly metrics = this._metrics.asReadonly();

  /**
   * Why the last request failed, or `null` while nothing has failed.
   *
   * Set when the backend reports a fatal failure or when a request goes
   * unanswered past its watchdog, and cleared by the next response that
   * actually lands. Bind it to `mlv-data-table`'s `[error]` so a dead backend
   * reads as a failure rather than as a table that is still loading.
   */
  readonly error = this._error.asReadonly();

  constructor(backend: ScaleBackend, options: ScaleDataSourceOptions) {
    super();
    this._backend = backend;
    this._config = options.config;
    this._latencyMs = options.latencyMs;
    this._timeoutMs = options.timeoutMs ?? SCALE_REQUEST_TIMEOUT_MS;
    this._unsubscribe = backend.subscribe((response) =>
      this._onResponse(response),
    );
    this._unsubscribeError =
      backend.subscribeError?.((reason) => this._fail(reason)) ?? (() => undefined);
    // `postMessage` preserves order, so the query queued below is always
    // processed after the dataset exists — no readiness handshake needed.
    backend.post({ type: 'init', config: this._config });
    this._schedule();
  }

  /** Where the work runs. Surface it — main-thread numbers are not worker numbers. */
  get backendKind(): ScaleBackend['kind'] {
    return this._backend.kind;
  }

  /** The current slice. Pure: it never fetches and never writes a signal. */
  connect(): Signal<ScaleRow[]> {
    return this._rowsReadonly;
  }

  override setSort(sort: MlvSortState | null): void {
    super.setSort(sort);
    this._schedule();
  }

  override setFilters(filters: MlvFilterState[]): void {
    super.setFilters(filters);
    this._schedule();
  }

  override setSearch(search: MlvSearchState | null): void {
    super.setSearch(search);
    this._schedule();
  }

  /**
   * Requests a page.
   *
   * A call that changes nothing is not a fetch. `MlvDataTable` re-runs both of
   * its paging effects whenever `virtualScroll` flips, so without this test
   * every mode switch would issue a second, identical query — and pay its
   * artificial latency again — inside the very interaction the benchmark panel
   * is timing.
   */
  override setPage(page: number): void {
    const unchanged = page === this.page();
    super.setPage(page);
    if (!unchanged) this._schedule();
  }

  /**
   * Requests a page size. {@link SCALE_ALL_ROWS} means "the whole result set".
   *
   * The page is part of the no-op test because the base class resets it to 1:
   * re-applying the current page size while on page 3 *is* a state change.
   */
  override setPerPage(perPage: number): void {
    const unchanged = perPage === this.perPage() && this.page() === 1;
    super.setPerPage(perPage);
    if (!unchanged) this._schedule();
  }

  /**
   * Applies a new page size **and drops the rows the previous one delivered**,
   * in one synchronous step.
   *
   * This exists because of a sharp edge in how `MlvDataTable` reaches its data
   * source. `virtualScroll` is an input, but the `perPage` it implies is pushed
   * onto the source from an `effect()` — which runs in a change detection pass,
   * after the binding has already flipped. Leaving virtual scroll therefore
   * opens a window in which the table is no longer virtualising while the
   * source still holds the *unpaged* answer: every matching row. At the dataset
   * sizes this showcase exists to demonstrate, rendering that window's contents
   * is a frozen tab, not a slow frame.
   *
   * Clearing the rows closes the window synchronously — the table renders
   * nothing beneath the overlay `[loading]="source.loading()"` already shows,
   * until an answer shaped for the new mode lands. The dispatch also supersedes
   * any request still in flight, so an unpaged answer already on its way is
   * dropped rather than arriving into a paged table.
   *
   * @param perPage - The new page size; {@link SCALE_ALL_ROWS} for "no paging".
   */
  switchPageSize(perPage: number): void {
    if (this._destroyed) return;
    this._rows.set([]);
    super.setPerPage(perPage);
    this._schedule();
  }

  /**
   * Regenerates the dataset from a changed seed, row count or tree mode, then
   * re-queries.
   *
   * The delivered rows go first, for the same reason {@link switchPageSize}
   * clears them: they describe a dataset that no longer exists, and at these
   * sizes leaving them on screen while the new one is generated means holding
   * two full datasets on the main thread at once. Row identities go with them —
   * the same id describes a different account after a reseed, so a cached
   * instance would show stale content.
   *
   * @param patch - Fields to change; everything omitted is kept.
   */
  configure(patch: Partial<ScaleDatasetConfig>): void {
    if (this._destroyed) return;
    this._config = { ...this._config, ...patch };
    this._identity.clear();
    this._rows.set([]);
    this._total.set(0);
    this._backend.post({ type: 'init', config: this._config });
    this._page.set(1);
    this._schedule();
  }

  /** Sets the artificial per-query delay applied to every subsequent request. */
  setLatency(latencyMs: number): void {
    this._latencyMs = Math.max(0, latencyMs);
  }

  /** Re-runs the current query without changing it — used by the benchmark panel. */
  refresh(): void {
    this._schedule();
  }

  /** Detaches from the backend and terminates it. Safe to call more than once. */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this._clearWatchdog();
    this._unsubscribeError();
    this._unsubscribe();
    this._backend.terminate();
  }

  /**
   * @private Marks the source busy immediately and queues **one** dispatch for
   * the current microtask.
   *
   * `_loading` is set synchronously so `[loading]="source.loading()"` flips in
   * the same change-detection pass as the interaction, rather than a frame
   * later. Coalescing is what keeps the table's five init effects — and the
   * five setter calls every sort or filter produces — down to one round trip.
   */
  private _schedule(): void {
    if (this._destroyed) return;
    this._loading.set(true);
    if (this._scheduled) return;
    this._scheduled = true;
    queueMicrotask(() => {
      this._scheduled = false;
      this._dispatch();
    });
  }

  /** @private Posts the current query state under a fresh request id. */
  private _dispatch(): void {
    if (this._destroyed) return;
    const state = this._queryState();
    this._lastRequestId += 1;
    this._currentRequestId = this._lastRequestId;
    this._dispatchedAt = absoluteNow();
    this._dispatchedPerPage = state.perPage;
    this._armWatchdog(this._currentRequestId);
    this._backend.post({
      type: 'query',
      id: this._currentRequestId,
      state,
      latencyMs: this._latencyMs,
    });
  }

  /**
   * @private Starts the timer that ends a request nothing ever answers.
   *
   * Armed per dispatch and disarmed by the matching response, so only the
   * newest request is ever being watched — a superseded one is already dropped
   * on arrival and must not raise an error of its own.
   */
  private _armWatchdog(requestId: number): void {
    this._clearWatchdog();
    this._watchdog = setTimeout(
      () => {
        this._watchdog = null;
        if (this._currentRequestId !== requestId) return;
        this._fail(
          'The backend did not answer. It may have run out of memory generating this many rows.',
        );
      },
      this._timeoutMs + this._latencyMs,
    );
  }

  /** @private Disarms the watchdog, if one is running. */
  private _clearWatchdog(): void {
    if (this._watchdog === null) return;
    clearTimeout(this._watchdog);
    this._watchdog = null;
  }

  /**
   * @private Ends the outstanding request as failed.
   *
   * Clearing `loading` is the load-bearing half: `mlv-data-table` suppresses a
   * previous error while a refetch is in flight, so an error published without
   * it would still render as a loading overlay.
   */
  private _fail(reason: string): void {
    if (this._destroyed) return;
    this._clearWatchdog();
    this._error.set(reason);
    this._loading.set(false);
  }

  /**
   * @private Snapshots the base class's state as a structured-cloneable
   * payload. Arrays are copied so a later mutation on the table's side cannot
   * reach into a request already in flight.
   */
  private _queryState(): ScaleQueryState {
    const search = this.search();
    return {
      sort: this.sort(),
      filters: this.filters().map((filter) => ({
        key: filter.key,
        operator: filter.operator,
        value: filter.value,
      })),
      search: search ? { query: search.query, keys: [...search.keys] } : null,
      page: this.page(),
      perPage: this.perPage(),
    };
  }

  /** @private Applies a backend message, dropping anything stale. */
  private _onResponse(response: ScaleResponse): void {
    if (this._destroyed) return;
    const receivedAt = absoluteNow();

    if (response.type === 'ready') {
      this._dataset.set({
        config: response.config,
        topLevelRows: response.topLevelRows,
        totalRows: response.totalRows,
        generateMs: response.generateMs,
      });
      return;
    }

    // A superseded response must not overwrite newer rows, and must not clear
    // `loading` while the newer request is still outstanding.
    if (response.id !== this._currentRequestId) return;

    this._clearWatchdog();
    // The identity pass is real main-thread work — a walk of every delivered
    // row with a `Map` lookup each, and in virtual-scroll mode "every delivered
    // row" is the whole result set. Timing it here is what keeps it out of the
    // gap between `transferMs`, which ends at the arrival of the message, and
    // the render measurement, which starts once the rows have been published.
    const rows = this._identify(response.rows);
    const identifiedAt = absoluteNow();
    this._rows.set(rows);
    this._total.set(response.total);
    this._metrics.set({
      requestId: response.id,
      rowsReturned: response.rows.length,
      total: response.total,
      computeMs: response.computeMs,
      latencyMs: response.latencyMs,
      transferMs: Math.max(0, receivedAt - response.sentAt),
      identifyMs: Math.max(0, identifiedAt - receivedAt),
      roundTripMs: Math.max(0, identifiedAt - this._dispatchedAt),
      unpaged: isUnpaged(this._dispatchedPerPage),
    });
    this._error.set(null);
    this._loading.set(false);
  }

  /** @private Replaces cloned rows with the first instance seen for each id. */
  private _identify(rows: readonly ScaleRow[]): ScaleRow[] {
    const result: ScaleRow[] = new Array(rows.length);
    for (let index = 0; index < rows.length; index++) {
      result[index] = this._identifyRow(rows[index]);
    }
    return result;
  }

  /**
   * @private Returns the canonical instance for one row, recursing into
   * `_mlvChildren` so an expanded tree node keeps its identity as well.
   */
  private _identifyRow(row: ScaleRow): ScaleRow {
    const cached = this._identity.get(row.id);
    if (cached) return cached;
    const children = row._mlvChildren;
    const canonical: ScaleRow = children?.length
      ? { ...row, _mlvChildren: children.map((child) => this._identifyRow(child)) }
      : row;
    this._identity.set(row.id, canonical);
    return canonical;
  }
}
