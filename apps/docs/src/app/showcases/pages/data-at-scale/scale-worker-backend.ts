import type { ScaleResponse } from './backend/scale-protocol';
import type { ScaleBackend } from './scale-backend';
import { createMainThreadScaleBackend } from './scale-main-thread-backend';

/**
 * Creates the Web Worker backend the showcase is actually about.
 *
 * The `new Worker(new URL('<string literal>', import.meta.url), …)` form below
 * is load bearing and must stay literal: the Angular build's web-worker
 * transformer only rewrites that exact shape. A computed path, a variable, or a
 * helper that returns the URL falls through unrewritten and 404s at runtime,
 * with no build error.
 *
 * Both of the worker's failure channels are wired, because both are otherwise
 * silent. `error` fires when the worker throws at top level or the browser
 * kills it — an unrewritten URL that 404s, or an out-of-memory kill while it
 * allocates a million rows. `messageerror` fires when a message arrives that
 * cannot be deserialised. Neither carries a request id, so both are reported on
 * the backend's error channel and the data source fails the outstanding request
 * with them instead of waiting forever.
 *
 * This module is deliberately separate from `scale-backend.ts` so specs can
 * import the token and the interface without dragging a `new Worker(...)` into
 * a jsdom environment that has no `Worker` at all.
 */
export function createWorkerScaleBackend(): ScaleBackend {
  const worker = new Worker(new URL('./backend/scale.worker', import.meta.url), {
    type: 'module',
  });
  const listeners = new Set<(response: ScaleResponse) => void>();
  const errorListeners = new Set<(reason: string) => void>();

  const onMessage = (event: MessageEvent<ScaleResponse>): void => {
    for (const listener of [...listeners]) listener(event.data);
  };
  const fail = (reason: string): void => {
    for (const listener of [...errorListeners]) listener(reason);
  };
  // A worker that never loaded reports an empty message, so the fallback text
  // has to stand on its own.
  const onError = (event: ErrorEvent): void => {
    fail(
      event.message ||
        'The worker stopped before it could answer. It either failed to load or the browser ended it.',
    );
  };
  const onMessageError = (): void => {
    fail('The worker sent a message this page could not deserialise.');
  };

  worker.addEventListener('message', onMessage);
  worker.addEventListener('error', onError);
  worker.addEventListener('messageerror', onMessageError);

  return {
    kind: 'worker',
    post(request) {
      worker.postMessage(request);
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
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      worker.removeEventListener('messageerror', onMessageError);
      listeners.clear();
      errorListeners.clear();
      worker.terminate();
    },
  };
}

/**
 * The worker when the runtime has one, the main thread otherwise.
 *
 * The fallback exists for a runtime that exposes no `Worker` constructor at
 * all: the jsdom environment the specs run in, and browsers or extensions that
 * block workers outright. It is not a silent downgrade — the returned backend
 * reports `kind: 'main-thread'`, and the showcase is expected to tell the
 * visitor that the numbers on screen are no longer off-main-thread
 * measurements.
 */
export function createScaleBackend(): ScaleBackend {
  return typeof Worker === 'undefined'
    ? createMainThreadScaleBackend()
    : createWorkerScaleBackend();
}
