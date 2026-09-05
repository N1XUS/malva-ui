/// The `data-at-scale` fake backend.
///
/// This module is a Web Worker entry point. The Angular build detects the
/// literal `new Worker(new URL('./backend/scale.worker', import.meta.url),
/// { type: 'module' })` in `scale-worker-backend.ts` and bundles this file as a
/// separate chunk with a **plugin-less** esbuild pass — so nothing reachable
/// from here may import a TypeScript path alias (`@malva-ui/*`). Relative
/// imports only.
///
/// It owns the dataset. The main thread never holds it, never sorts it and
/// never filters it; that is the entire point of the showcase, and the reason
/// its scroll-FPS number means anything.

import { buildScaleDataset } from './scale-dataset';
import { runScaleQuery } from './scale-engine';
import { absoluteNow } from './scale-protocol';
import type { ScaleRequest, ScaleResponse, ScaleRow } from './scale-protocol';

/** @private The generated dataset. Replaced wholesale by every `init` request. */
let dataset: readonly ScaleRow[] = [];

/** @private Sends one response back to the page. */
function reply(response: ScaleResponse): void {
  postMessage(response);
}

/** @private Generates a dataset and reports what it cost. */
function handleInit(request: Extract<ScaleRequest, { type: 'init' }>): void {
  const startedAt = absoluteNow();
  const built = buildScaleDataset(request.config);
  dataset = built.rows;
  reply({
    type: 'ready',
    config: request.config,
    topLevelRows: built.rows.length,
    totalRows: built.totalRows,
    generateMs: absoluteNow() - startedAt,
    sentAt: absoluteNow(),
  });
}

/**
 * @private Runs one query, then holds the answer back for the configured
 * artificial latency.
 *
 * Order matters: the compute is measured and finished **before** the delay
 * starts, so the tunable "network" latency can never inflate the number the
 * page publishes as worker compute cost.
 */
function handleQuery(request: Extract<ScaleRequest, { type: 'query' }>): void {
  const result = runScaleQuery(dataset, request.state);
  const send = (): void =>
    reply({
      type: 'result',
      id: request.id,
      rows: result.rows,
      total: result.total,
      computeMs: result.computeMs,
      latencyMs: request.latencyMs,
      sentAt: absoluteNow(),
    });
  if (request.latencyMs > 0) {
    setTimeout(send, request.latencyMs);
    return;
  }
  send();
}

addEventListener('message', (event: MessageEvent<ScaleRequest>) => {
  const request = event.data;
  if (request.type === 'init') {
    handleInit(request);
    return;
  }
  handleQuery(request);
});
