import { InjectionToken } from '@angular/core';
import type { ScaleRequest, ScaleResponse } from './backend/scale-protocol';

/**
 * Where the `data-at-scale` dataset actually lives and where its sort, filter
 * and page work actually runs.
 *
 * `'worker'` is the real thing the showcase is about — a dedicated thread the
 * main thread never blocks on. `'main-thread'` is the honest fallback for a
 * runtime that exposes no `Worker` constructor at all — jsdom specs, and
 * browsers or extensions that block workers: the same engine, the same results,
 * but the numbers on the page are no longer a proof of off-main-thread work and
 * the UI must say so.
 */
export type ScaleBackendKind = 'worker' | 'main-thread';

/**
 * The minimal `postMessage` surface {@link ScaleDataSource} needs.
 *
 * It exists so the data source can be unit-tested without a `Worker` — jsdom
 * has none — and so the showcase can degrade to the main thread instead of
 * failing to render.
 */
export interface ScaleBackend {
  /** Where the work runs. Surface this in the UI; do not let it be inferred. */
  readonly kind: ScaleBackendKind;
  /** Sends one request. Responses arrive through {@link subscribe}, never as a return value. */
  post(request: ScaleRequest): void;
  /** Registers a response listener and returns its unsubscribe function. */
  subscribe(listener: (response: ScaleResponse) => void): () => void;
  /**
   * Registers a listener for a failure that no request will ever answer, and
   * returns its unsubscribe function.
   *
   * A dedicated channel rather than an error-shaped {@link ScaleResponse}
   * because these failures carry no request id: a worker that is killed for
   * allocating a million rows, or whose module URL 404s, takes every in-flight
   * request down with it. Without this the source would wait forever and the
   * table would show its loading overlay with no way out but a reload.
   *
   * Optional: a backend whose transport cannot fail independently of a request
   * — the main-thread one, and the fakes in the specs — may leave it out, and
   * {@link ScaleDataSource}'s own watchdog still bounds every request.
   */
  subscribeError?(listener: (reason: string) => void): () => void;
  /** Releases the backing thread or timers. Safe to call more than once. */
  terminate(): void;
}

/** Creates one backend instance. One per `ScaleDataSource`. */
export type ScaleBackendFactory = () => ScaleBackend;

/**
 * How the showcase route obtains its backend.
 *
 * Deliberately declared with **no** default factory: the browser factory lives
 * in `scale-worker-backend.ts` because that file contains the literal
 * `new Worker(new URL(...), { type: 'module' })` the Angular build rewrites, and
 * a spec must be able to reach this token without pulling that module in. The
 * showcase component injects it `{ optional: true }` and falls back to
 * `createScaleBackend()`; specs override it with a fake.
 */
export const SCALE_BACKEND_FACTORY = new InjectionToken<ScaleBackendFactory>(
  'SCALE_BACKEND_FACTORY',
);
