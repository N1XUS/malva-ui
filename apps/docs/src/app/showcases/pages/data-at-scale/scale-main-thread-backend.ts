import { buildScaleDataset } from './backend/scale-dataset';
import { runScaleQuery } from './backend/scale-engine';
import { absoluteNow } from './backend/scale-protocol';
import type { ScaleResponse, ScaleRow } from './backend/scale-protocol';
import type { ScaleBackend } from './scale-backend';

/**
 * A {@link ScaleBackend} that runs the dataset and the query engine on the
 * calling thread.
 *
 * This is the fallback for a runtime that exposes no `Worker` constructor —
 * the jsdom environment the specs run in, and browsers or extensions that block
 * workers — and the backend the data-source specs run against. It is
 * intentionally *not* the default in the browser: the whole point of the
 * showcase is that the main thread does not do this work, so `kind` reports
 * `'main-thread'` and the page is expected to say so rather than quietly
 * publish main-thread numbers as worker numbers.
 *
 * Responses are still delivered asynchronously (through a timer, honouring the
 * request's artificial latency), so a consumer cannot accidentally depend on a
 * synchronous answer that the real worker will never give.
 */
export function createMainThreadScaleBackend(): ScaleBackend {
  const listeners = new Set<(response: ScaleResponse) => void>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let rows: readonly ScaleRow[] = [];
  let disposed = false;

  const emit = (response: ScaleResponse): void => {
    if (disposed) return;
    for (const listener of [...listeners]) listener(response);
  };

  const later = (delayMs: number, run: () => void): void => {
    const timer = setTimeout(
      () => {
        timers.delete(timer);
        run();
      },
      Math.max(0, delayMs),
    );
    timers.add(timer);
  };

  return {
    kind: 'main-thread',
    post(request) {
      if (disposed) return;
      if (request.type === 'init') {
        const startedAt = absoluteNow();
        const built = buildScaleDataset(request.config);
        rows = built.rows;
        const generateMs = absoluteNow() - startedAt;
        later(0, () =>
          emit({
            type: 'ready',
            config: request.config,
            topLevelRows: built.rows.length,
            totalRows: built.totalRows,
            generateMs,
            sentAt: absoluteNow(),
          }),
        );
        return;
      }
      // Compute first, delay second — the artificial latency must never leak
      // into the measured compute cost.
      const result = runScaleQuery(rows, request.state);
      later(request.latencyMs, () =>
        emit({
          type: 'result',
          id: request.id,
          rows: result.rows,
          total: result.total,
          computeMs: result.computeMs,
          latencyMs: request.latencyMs,
          sentAt: absoluteNow(),
        }),
      );
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    terminate() {
      disposed = true;
      listeners.clear();
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
    },
  };
}
