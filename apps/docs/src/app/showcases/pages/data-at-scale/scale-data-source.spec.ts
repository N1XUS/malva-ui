import { describe, expect, it } from 'vitest';
import type { MlvDataSource } from '@malva-ui/cdk/data-source';
import { buildScaleDataset } from './backend/scale-dataset';
import { runScaleQuery } from './backend/scale-engine';
import { SCALE_ALL_ROWS, absoluteNow } from './backend/scale-protocol';
import type {
  ScaleQueryRequest,
  ScaleQueryState,
  ScaleRequest,
  ScaleResponse,
  ScaleRow,
} from './backend/scale-protocol';
import type { ScaleBackend } from './scale-backend';
import { createMainThreadScaleBackend } from './scale-main-thread-backend';
import { ScaleDataSource } from './scale-data-source';

const CONFIG = { seed: 4242, rowCount: 400, tree: false } as const;
const DATASET = buildScaleDataset(CONFIG).rows;

const baseState = (patch: Partial<ScaleQueryState> = {}): ScaleQueryState => ({
  sort: null,
  filters: [],
  search: null,
  page: 1,
  perPage: 10,
  ...patch,
});

/** Lets a microtask-coalesced dispatch run before the assertion reads it. */
async function microtasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

/** Waits for the real, timer-driven backend to settle the in-flight request. */
async function settle(source: ScaleDataSource): Promise<void> {
  for (let attempt = 0; attempt < 100 && source.loading(); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

interface ManualBackend {
  readonly backend: ScaleBackend;
  /** Every request the source posted, in order. */
  readonly requests: ScaleRequest[];
  /** Only the query requests, for coalescing assertions. */
  queries(): ScaleQueryRequest[];
  /** Delivers every queued response in the order it was produced. */
  flush(): void;
  /** Delivers exactly one queued response, so ordering can be inverted. */
  release(index: number): void;
  /** Reports a fatal transport failure, the way a dying worker's `error` does. */
  fail(reason: string): void;
  /** How many responses are waiting. */
  pending(): number;
  isTerminated(): boolean;
}

/**
 * A backend that runs the real engine but hands nothing back until the test
 * says so — which is what makes coalescing, stale-response and loading-flag
 * assertions deterministic instead of timing-dependent.
 */
function createManualBackend(): ManualBackend {
  const listeners = new Set<(response: ScaleResponse) => void>();
  const errorListeners = new Set<(reason: string) => void>();
  const requests: ScaleRequest[] = [];
  const queued: ScaleResponse[] = [];
  let rows: readonly ScaleRow[] = [];
  let terminated = false;

  const emit = (response: ScaleResponse): void => {
    for (const listener of [...listeners]) listener(response);
  };

  const backend: ScaleBackend = {
    kind: 'main-thread',
    post(request) {
      requests.push(request);
      if (request.type === 'init') {
        const built = buildScaleDataset(request.config);
        rows = built.rows;
        queued.push({
          type: 'ready',
          config: request.config,
          topLevelRows: built.rows.length,
          totalRows: built.totalRows,
          generateMs: 1.5,
          sentAt: absoluteNow(),
        });
        return;
      }
      const result = runScaleQuery(rows, request.state);
      queued.push({
        type: 'result',
        id: request.id,
        rows: result.rows,
        total: result.total,
        computeMs: result.computeMs,
        latencyMs: request.latencyMs,
        sentAt: absoluteNow(),
      });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    subscribeError(listener) {
      errorListeners.add(listener);
      return () => {
        errorListeners.delete(listener);
      };
    },
    terminate() {
      terminated = true;
      listeners.clear();
      errorListeners.clear();
    },
  };

  return {
    backend,
    requests,
    queries: () =>
      requests.filter((r): r is ScaleQueryRequest => r.type === 'query'),
    flush() {
      for (const response of queued.splice(0)) emit(response);
    },
    release(index) {
      const [response] = queued.splice(index, 1);
      if (response) emit(response);
    },
    fail(reason) {
      for (const listener of [...errorListeners]) listener(reason);
    },
    pending: () => queued.length,
    isTerminated: () => terminated,
  };
}

function createSource(
  manual: ManualBackend,
  latencyMs = 0,
  timeoutMs?: number,
): ScaleDataSource {
  return new ScaleDataSource(manual.backend, {
    config: CONFIG,
    latencyMs,
    timeoutMs,
  });
}

describe('ScaleDataSource — initial load', () => {
  it('generates the dataset in the backend and asks for the first slice', async () => {
    const manual = createManualBackend();
    const source = createSource(manual);
    source.setPerPage(10);
    await microtasks();

    expect(manual.requests[0]).toEqual({ type: 'init', config: CONFIG });
    expect(manual.queries()).toHaveLength(1);
    expect(manual.queries()[0].state).toEqual(baseState());
    source.destroy();
  });

  it('is loading from construction until the first response lands', async () => {
    const manual = createManualBackend();
    const source = createSource(manual);
    expect(source.loading()).toBe(true);
    expect(source.connect()()).toEqual([]);
    expect(source.totalItems()).toBe(0);

    await microtasks();
    expect(source.loading()).toBe(true);

    manual.flush();
    expect(source.loading()).toBe(false);
    source.destroy();
  });

  it('publishes the first page and the pre-paging total', async () => {
    const manual = createManualBackend();
    const source = createSource(manual);
    source.setPerPage(25);
    await microtasks();
    manual.flush();

    expect(
      source
        .connect()()
        .map((row) => row.id),
    ).toEqual(
      runScaleQuery(DATASET, baseState({ perPage: 25 })).rows.map((r) => r.id),
    );
    expect(source.connect()()).toHaveLength(25);
    expect(source.totalItems()).toBe(400);
    source.destroy();
  });

  it('publishes the dataset report from the ready message', async () => {
    const manual = createManualBackend();
    const source = createSource(manual);
    await microtasks();
    manual.flush();

    expect(source.dataset()).toEqual({
      config: CONFIG,
      topLevelRows: 400,
      totalRows: 400,
      generateMs: 1.5,
    });
    source.destroy();
  });
});

describe('ScaleDataSource — server-side query state', () => {
  it('sends paging to the backend and swaps in the returned slice', async () => {
    const manual = createManualBackend();
    const source = createSource(manual);
    source.setPerPage(10);
    await microtasks();
    manual.flush();

    source.setPage(3);
    await microtasks();
    manual.flush();

    expect(manual.queries().at(-1)?.state.page).toBe(3);
    expect(
      source
        .connect()()
        .map((row) => row.id),
    ).toEqual(
      runScaleQuery(DATASET, baseState({ page: 3 })).rows.map((r) => r.id),
    );
    expect(source.totalItems()).toBe(400);
    source.destroy();
  });

  it('sends the sort to the backend and returns globally sorted rows', async () => {
    const manual = createManualBackend();
    const source = createSource(manual);
    source.setPerPage(10);
    await microtasks();
    manual.flush();

    source.setSort({ key: 'arr', direction: 'desc' });
    await microtasks();
    manual.flush();

    const expected = runScaleQuery(
      DATASET,
      baseState({ sort: { key: 'arr', direction: 'desc' } }),
    ).rows;
    expect(manual.queries().at(-1)?.state.sort).toEqual({
      key: 'arr',
      direction: 'desc',
    });
    expect(
      source
        .connect()()
        .map((row) => row.arr),
    ).toEqual(expected.map((row) => row.arr));
    expect(source.connect()()[0].arr).toBe(
      Math.max(...DATASET.map((row) => row.arr)),
    );
    source.destroy();
  });

  it('narrows totalItems when a filter is applied', async () => {
    const manual = createManualBackend();
    const source = createSource(manual);
    source.setPerPage(10);
    await microtasks();
    manual.flush();
    expect(source.totalItems()).toBe(400);

    source.setFilters([{ key: 'region', operator: 'equals', value: 'APAC' }]);
    await microtasks();
    manual.flush();

    const expected = DATASET.filter((row) => row.region === 'APAC').length;
    expect(expected).toBeGreaterThan(0);
    expect(expected).toBeLessThan(400);
    expect(source.totalItems()).toBe(expected);
    expect(
      source
        .connect()()
        .every((row) => row.region === 'APAC'),
    ).toBe(true);
    source.destroy();
  });

  it('forwards search with its column keys', async () => {
    const manual = createManualBackend();
    const source = createSource(manual);
    source.setPerPage(10);
    await microtasks();
    manual.flush();

    source.setSearch({ query: 'Cobalt', keys: ['account'] });
    await microtasks();
    manual.flush();

    expect(manual.queries().at(-1)?.state.search).toEqual({
      query: 'Cobalt',
      keys: ['account'],
    });
    expect(source.totalItems()).toBe(
      DATASET.filter((row) => row.account.includes('Cobalt')).length,
    );
    source.destroy();
  });

  it('returns the whole result set for the page size the table forces in virtual mode', async () => {
    const manual = createManualBackend();
    const source = createSource(manual);
    source.setPerPage(SCALE_ALL_ROWS);
    await microtasks();
    manual.flush();

    expect(manual.queries().at(-1)?.state.perPage).toBe(SCALE_ALL_ROWS);
    expect(source.connect()()).toHaveLength(400);
    expect(source.totalItems()).toBe(400);
    source.destroy();
  });
});

describe('ScaleDataSource — page size and dataset switches', () => {
  it('drops the delivered rows in the same synchronous step as the new size', async () => {
    const manual = createManualBackend();
    const source = createSource(manual);
    source.setPerPage(SCALE_ALL_ROWS);
    await microtasks();
    manual.flush();
    expect(source.connect()()).toHaveLength(400);

    source.switchPageSize(25);

    // Nothing awaited. The table flips out of virtual scroll in the change
    // detection pass that follows this call, and would otherwise render all 400
    // — at the sizes this showcase demonstrates, 100,000 — unvirtualised rows.
    expect(source.connect()()).toEqual([]);
    expect(source.loading()).toBe(true);

    await microtasks();
    manual.flush();

    expect(manual.queries().at(-1)?.state.perPage).toBe(25);
    expect(source.connect()()).toHaveLength(25);
    source.destroy();
  });

  it('supersedes a request already in flight when the size changes', async () => {
    const manual = createManualBackend();
    const source = createSource(manual);
    source.setPerPage(SCALE_ALL_ROWS);
    await microtasks();
    expect(manual.queries()).toHaveLength(1);
    expect(source.loading()).toBe(true);

    source.switchPageSize(25);
    await microtasks();

    // Both answers are queued now; the unpaged one is stale and must not reach
    // a table that has stopped virtualising.
    manual.flush();

    expect(source.connect()()).toHaveLength(25);
    expect(source.loading()).toBe(false);
    source.destroy();
  });

  it('leaves the page alone and issues nothing when the size does not change', async () => {
    const manual = createManualBackend();
    const source = createSource(manual);
    source.setPerPage(25);
    await microtasks();
    manual.flush();
    const before = manual.queries().length;

    // Exactly what MlvDataTable's paging effects re-run on every `virtualScroll`
    // flip: the same page, then the same size. Re-asking for the slice already
    // on screen would put a second round trip — and its latency — inside the
    // interaction the benchmark panel is timing.
    source.setPage(1);
    source.setPerPage(25);
    await microtasks();

    expect(manual.queries()).toHaveLength(before);
    expect(source.loading()).toBe(false);
    source.destroy();
  });

  it('drops the delivered rows while a new dataset is generated', async () => {
    const manual = createManualBackend();
    const source = createSource(manual);
    source.setPerPage(SCALE_ALL_ROWS);
    await microtasks();
    manual.flush();
    expect(source.connect()()).toHaveLength(400);

    source.configure({ rowCount: 40 });

    // Those rows describe a dataset that no longer exists. Keeping them on the
    // main thread until the replacement arrives means holding two full datasets
    // at once, and showing a total that belongs to neither.
    expect(source.connect()()).toEqual([]);
    expect(source.totalItems()).toBe(0);
    source.destroy();
  });

  it('still re-queries when an unchanged size has to reset the page', async () => {
    const manual = createManualBackend();
    const source = createSource(manual);
    source.setPerPage(25);
    await microtasks();
    manual.flush();
    source.setPage(3);
    await microtasks();
    manual.flush();

    source.setPerPage(25);
    await microtasks();
    manual.flush();

    expect(source.page()).toBe(1);
    expect(manual.queries().at(-1)?.state.page).toBe(1);
    source.destroy();
  });
});

describe('ScaleDataSource — request discipline', () => {
  it('coalesces the burst of setter calls the table fires into one request', async () => {
    const manual = createManualBackend();
    const source = createSource(manual);
    // Exactly what MlvDataTable's five constructor effects do on first run.
    source.setSort(null);
    source.setFilters([]);
    source.setSearch(null);
    source.setPage(1);
    source.setPerPage(50);
    await microtasks();

    expect(manual.queries()).toHaveLength(1);
    expect(manual.queries()[0].state.perPage).toBe(50);
    source.destroy();
  });

  it('never fetches from connect(), which the table reads inside a computed', async () => {
    const manual = createManualBackend();
    const source = createSource(manual);
    await microtasks();
    manual.flush();
    const before = manual.requests.length;

    source.connect()();
    source.connect()();
    source.connect()();
    await microtasks();

    expect(manual.requests).toHaveLength(before);
    expect(source.loading()).toBe(false);
    source.destroy();
  });

  it('ignores a stale response that arrives after a newer one', async () => {
    const manual = createManualBackend();
    const source = createSource(manual);
    source.setPerPage(10);
    await microtasks();
    manual.flush();

    source.setPage(2);
    await microtasks();
    source.setPage(4);
    await microtasks();
    expect(manual.pending()).toBe(2);

    // Newest first, stale second — the out-of-order delivery a slow worker
    // round trip produces in the wild.
    manual.release(1);
    manual.release(0);

    expect(
      source
        .connect()()
        .map((row) => row.id),
    ).toEqual(
      runScaleQuery(DATASET, baseState({ page: 4 })).rows.map((r) => r.id),
    );
    expect(source.loading()).toBe(false);
    source.destroy();
  });

  it('stays loading while a newer request is still outstanding', async () => {
    const manual = createManualBackend();
    const source = createSource(manual);
    await microtasks();
    manual.flush();

    source.setPage(2);
    await microtasks();
    source.setPage(3);
    await microtasks();

    manual.release(0);
    expect(source.loading()).toBe(true);
    manual.release(0);
    expect(source.loading()).toBe(false);
    source.destroy();
  });

  it('passes the configured artificial latency to the backend', async () => {
    const manual = createManualBackend();
    const source = createSource(manual, 250);
    await microtasks();
    expect(manual.queries()[0].latencyMs).toBe(250);

    source.setLatency(0);
    source.refresh();
    await microtasks();
    expect(manual.queries().at(-1)?.latencyMs).toBe(0);
    source.destroy();
  });
});

describe('ScaleDataSource — row identity', () => {
  it('hands back the same row object for a row id across refetches', async () => {
    const manual = createManualBackend();
    const source = createSource(manual);
    source.setPerPage(10);
    await microtasks();
    manual.flush();
    const first = source.connect()()[0];

    source.setSort({ key: 'ref', direction: 'asc' });
    await microtasks();
    manual.flush();
    const again = source
      .connect()()
      .find((row) => row.id === first.id);

    expect(again).toBe(first);
    source.destroy();
  });

  it('keeps child rows identical too, so tree expansion survives a refetch', async () => {
    const manual = createManualBackend();
    const source = new ScaleDataSource(manual.backend, {
      config: { seed: 4242, rowCount: 400, tree: true },
      latencyMs: 0,
    });
    source.setPerPage(SCALE_ALL_ROWS);
    await microtasks();
    manual.flush();

    const parent = source
      .connect()()
      .find((row) => (row._mlvChildren?.length ?? 0) > 0);
    expect(parent).toBeDefined();

    source.setSort({ key: 'arr', direction: 'desc' });
    await microtasks();
    manual.flush();

    const again = source
      .connect()()
      .find((row) => row.id === parent?.id);
    expect(again).toBe(parent);
    expect(again?._mlvChildren?.[0]).toBe(parent?._mlvChildren?.[0]);
    source.destroy();
  });

  it('drops cached identities when the dataset is regenerated', async () => {
    const manual = createManualBackend();
    const source = createSource(manual);
    source.setPerPage(10);
    await microtasks();
    manual.flush();
    const first = source.connect()()[0];

    source.configure({ seed: 777 });
    await microtasks();
    manual.flush();
    const replacement = source.connect()()[0];

    expect(replacement.id).toBe(first.id);
    expect(replacement).not.toBe(first);
    expect(source.dataset()?.config.seed).toBe(777);
    source.destroy();
  });

  it('re-fetches and reports the new size when the row count changes', async () => {
    const manual = createManualBackend();
    const source = createSource(manual);
    await microtasks();
    manual.flush();

    source.configure({ rowCount: 1200 });
    await microtasks();
    manual.flush();

    expect(source.totalItems()).toBe(1200);
    expect(source.dataset()?.topLevelRows).toBe(1200);
    source.destroy();
  });
});

describe('ScaleDataSource — metrics and teardown', () => {
  it('reports a decomposed cost for the last query', async () => {
    const manual = createManualBackend();
    const source = createSource(manual, 120);
    await microtasks();
    manual.flush();

    const metrics = source.metrics();
    expect(metrics).not.toBeNull();
    expect(metrics?.requestId).toBe(1);
    expect(metrics?.total).toBe(400);
    expect(metrics?.rowsReturned).toBe(source.connect()().length);
    expect(metrics?.latencyMs).toBe(120);
    expect(metrics?.computeMs).toBeGreaterThanOrEqual(0);
    expect(metrics?.transferMs).toBeGreaterThanOrEqual(0);
    expect(metrics?.identifyMs).toBeGreaterThanOrEqual(0);
    // The identity pass runs on the main thread between the message arriving
    // and the rows being published, so the round trip has to end after it —
    // otherwise a 250,000-row walk lands in no published number at all.
    expect(metrics?.roundTripMs ?? 0).toBeGreaterThanOrEqual(
      (metrics?.transferMs ?? 0) + (metrics?.identifyMs ?? 0),
    );
    source.destroy();
  });

  it('reports unpaged from the page size that was requested, not the rows that came back', async () => {
    const manual = createManualBackend();
    const source = createSource(manual);
    source.setPerPage(50);
    await microtasks();
    manual.flush();
    expect(source.metrics()?.unpaged).toBe(false);

    // A filter narrow enough to fit inside one page must still read as paged.
    source.setFilters([
      { key: 'ref', operator: 'equals', value: 'ACC-000001' },
    ]);
    await microtasks();
    manual.flush();
    expect(source.connect()()).toHaveLength(1);
    expect(source.totalItems()).toBe(1);
    expect(source.metrics()?.unpaged).toBe(false);

    source.setFilters([]);
    source.setPerPage(SCALE_ALL_ROWS);
    await microtasks();
    manual.flush();
    expect(source.metrics()?.unpaged).toBe(true);
    source.destroy();
  });

  it('terminates the backend and stops applying responses after destroy', async () => {
    const manual = createManualBackend();
    const source = createSource(manual);
    await microtasks();
    manual.flush();
    const rows = source.connect()();

    source.destroy();
    expect(manual.isTerminated()).toBe(true);

    source.setPage(5);
    await microtasks();
    expect(manual.queries()).toHaveLength(1);
    expect(source.connect()()).toBe(rows);
    source.destroy();
  });
});

describe('ScaleDataSource — backend failure', () => {
  it('ends the request and reports why when the backend dies', async () => {
    const manual = createManualBackend();
    const source = createSource(manual);
    await microtasks();
    expect(source.loading()).toBe(true);
    expect(source.error()).toBeNull();

    manual.fail('The worker stopped before it could answer.');

    // Without this the loading overlay is permanent: nothing else ever clears
    // it, because no response carrying the request id will arrive.
    expect(source.loading()).toBe(false);
    expect(source.error()).toBe('The worker stopped before it could answer.');
    source.destroy();
  });

  it('ends a request that nothing answers within the watchdog', async () => {
    const manual = createManualBackend();
    const source = createSource(manual, 0, 10);
    await microtasks();
    expect(manual.pending()).toBe(2);
    expect(source.loading()).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(source.loading()).toBe(false);
    expect(source.error()).toContain('did not answer');
    source.destroy();
  });

  it('keeps the watchdog disarmed while responses keep arriving', async () => {
    const manual = createManualBackend();
    const source = createSource(manual, 0, 10);
    await microtasks();
    manual.flush();
    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(source.loading()).toBe(false);
    expect(source.error()).toBeNull();
    expect(source.connect()()).not.toHaveLength(0);
    source.destroy();
  });

  it('clears the error once a response finally lands', async () => {
    const manual = createManualBackend();
    const source = createSource(manual);
    await microtasks();
    manual.fail('The worker stopped before it could answer.');
    expect(source.error()).not.toBeNull();

    source.refresh();
    await microtasks();
    manual.flush();

    expect(source.error()).toBeNull();
    expect(source.loading()).toBe(false);
    expect(source.connect()()).not.toHaveLength(0);
    source.destroy();
  });

  it('raises nothing after destroy, so a dying backend cannot write to a dead source', async () => {
    const manual = createManualBackend();
    const source = createSource(manual, 0, 10);
    await microtasks();
    source.destroy();

    manual.fail('The worker stopped before it could answer.');
    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(source.error()).toBeNull();
    source.destroy();
  });
});

describe('ScaleDataSource — against the shipped main-thread backend', () => {
  it('completes a real init/query round trip', async () => {
    const backend = createMainThreadScaleBackend();
    const source = new ScaleDataSource(backend, {
      config: { seed: 1, rowCount: 500, tree: false },
      latencyMs: 0,
    });
    source.setPerPage(20);
    await settle(source);

    expect(backend.kind).toBe('main-thread');
    expect(source.loading()).toBe(false);
    expect(source.connect()()).toHaveLength(20);
    expect(source.totalItems()).toBe(500);
    expect(source.dataset()?.totalRows).toBe(500);
    source.destroy();
  });

  it('honours the artificial latency it is given', async () => {
    const backend = createMainThreadScaleBackend();
    const source = new ScaleDataSource(backend, {
      config: { seed: 1, rowCount: 200, tree: false },
      latencyMs: 60,
    });
    const started = Date.now();
    await settle(source);

    expect(Date.now() - started).toBeGreaterThanOrEqual(50);
    expect(source.metrics()?.latencyMs).toBe(60);
    source.destroy();
  });
});

describe('ScaleDataSource — data table contract', () => {
  it('satisfies the row shape mlv-data-table binds its [data] input to', () => {
    // Structural stand-in for the table's non-exported `MlvDataRow`.
    type TableRow = object & { _mlvChildren?: readonly TableRow[] };
    const manual = createManualBackend();
    const source = createSource(manual);
    const asTableSource: MlvDataSource<TableRow> = source;

    expect(asTableSource.connect()()).toEqual([]);
    expect(asTableSource.totalItems()).toBe(0);
    source.destroy();
  });
});
