/**
 * Framework-free measurement helpers for the `data-at-scale` showcase.
 *
 * Every number this showcase publishes is taken live, in the visitor's own
 * browser, on the visitor's own hardware — so the helpers here are deliberately
 * small, explicit about what they include, and free of Angular imports so they
 * can be unit-tested without a component.
 *
 * Two environment facts shape the API:
 *
 * 1. `requestAnimationFrame` only exists in a *visual* environment. jsdom — the
 *    environment the specs run in — has none, so every entry point takes an
 *    injectable frame scheduler that falls back to a timer. The fallback keeps
 *    the code running; it never runs in the browser, where the real callback is
 *    the one tied to a presented frame.
 * 2. A frame rate is capped by the display. 60 fps on a 60 Hz panel is the
 *    ceiling, not a mediocre result, so {@link summarizeFrameTimestamps} also
 *    reports the fastest frame it saw as an observed cap.
 */

/** A frame slower than this is counted as a jank frame. */
export const SCALE_LONG_FRAME_MS = 50;

/** Default duration of one scroll sample. */
export const SCALE_SCROLL_SAMPLE_MS = 2000;

/** Pixels the scroll benchmark advances the scroller by on each frame. */
export const SCALE_SCROLL_STEP_PX = 40;

/** Schedules a callback for the next animation frame. */
export type ScaleFrameScheduler = (callback: (timestamp: number) => void) => void;

/** Reads a monotonic clock in milliseconds. */
export type ScaleClock = () => number;

/** What one run of the scroll benchmark observed. */
export interface ScaleFrameSample {
  /** Frames presented during the run. */
  readonly frames: number;
  /** Wall-clock span between the first and last sampled frame. */
  readonly durationMs: number;
  /** Frames per second across the run. Capped by the display refresh rate. */
  readonly fps: number;
  /** Mean interval between consecutive frames. */
  readonly meanFrameMs: number;
  /** 95th-percentile frame interval — the number a stutter shows up in. */
  readonly p95FrameMs: number;
  /** Slowest single frame interval of the run. */
  readonly longestFrameMs: number;
  /** Fastest single frame interval of the run. */
  readonly fastestFrameMs: number;
  /** Frames slower than {@link SCALE_LONG_FRAME_MS}. */
  readonly longFrames: number;
  /**
   * Frame rate implied by {@link fastestFrameMs}.
   *
   * An **observed** upper bound, not a display specification: no frame in this
   * run beat it, and on an idle page it lands close to the panel's refresh rate.
   * It is the ceiling {@link fps} should be read against — sampling jitter means
   * it can sit a little above the true rate, so it is reported as "about".
   */
  readonly displayCapHz: number;
}

/** The scrollable surface the benchmark drives. Structural, so a spec can fake it. */
export interface ScaleScrollTarget {
  scrollTop: number;
  readonly scrollHeight: number;
  readonly clientHeight: number;
}

/** Inputs of one scroll benchmark run. */
export interface ScaleScrollBenchmarkOptions {
  /** The element that actually scrolls — the virtual viewport, or the table wrapper. */
  readonly element: ScaleScrollTarget;
  /** How long to sample for. */
  readonly durationMs: number;
  /** Distance to advance per frame. */
  readonly stepPx?: number;
  /** Monotonic clock; defaults to `performance.now()`. */
  readonly now?: ScaleClock;
  /** Frame scheduler; defaults to `requestAnimationFrame` with a timer fallback. */
  readonly requestFrame?: ScaleFrameScheduler;
  /**
   * Ends the run early.
   *
   * A run is two seconds of frame callbacks that each write `scrollTop`. Left
   * unbounded, navigating away mid-run keeps scrolling a detached element for
   * the remainder and then resolves into a destroyed caller, so the caller
   * passes the signal it aborts on teardown. Whatever was sampled before the
   * abort is still summarised — a short run is a real measurement, an
   * abandoned promise is not.
   */
  readonly signal?: AbortSignal;
}

/**
 * Whether the visitor has asked their system to reduce motion.
 *
 * `matchMedia` is absent in jsdom, so the check has to survive not being able
 * to ask. Absent means "no preference expressed": specs keep exercising the
 * benchmark, and no environment refuses an action because it could not read a
 * media query.
 */
export function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** @private Reads the highest-resolution clock the runtime offers. */
function defaultNow(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

/**
 * The runtime's frame scheduler.
 *
 * Outside a visual environment — jsdom, where the specs run — there is no
 * `requestAnimationFrame`; a ~60 Hz timer stands in so the measurement code
 * still completes instead of hanging. A timer is not a presented frame, so this
 * fallback is a test affordance, never the source of a published number.
 */
export function defaultFrameScheduler(): ScaleFrameScheduler {
  if (typeof requestAnimationFrame === 'function') {
    return (callback) => {
      requestAnimationFrame(callback);
    };
  }
  return (callback) => {
    setTimeout(() => callback(defaultNow()), 16);
  };
}

/** @private Linear-interpolation-free percentile over an ascending array. */
function percentile(ascending: readonly number[], fraction: number): number {
  if (ascending.length === 0) return 0;
  const index = Math.min(
    ascending.length - 1,
    Math.max(0, Math.ceil(fraction * ascending.length) - 1),
  );
  return ascending[index];
}

/**
 * Turns a list of frame timestamps into a readable sample.
 *
 * Intervals — not timestamps — are the unit: `frames` counts the intervals
 * actually observed, so a run that produced a single timestamp yields `null`
 * rather than a fabricated "1 frame at 0 ms".
 *
 * @param timestamps - Frame timestamps in milliseconds, in order.
 */
export function summarizeFrameTimestamps(
  timestamps: readonly number[],
): ScaleFrameSample | null {
  if (timestamps.length < 3) return null;
  const deltas: number[] = [];
  for (let index = 1; index < timestamps.length; index++) {
    const delta = timestamps[index] - timestamps[index - 1];
    if (delta > 0) deltas.push(delta);
  }
  if (deltas.length < 2) return null;

  const durationMs = deltas.reduce((total, delta) => total + delta, 0);
  const ascending = [...deltas].sort((a, b) => a - b);
  const meanFrameMs = durationMs / deltas.length;

  return {
    frames: deltas.length,
    durationMs,
    fps: (deltas.length * 1000) / durationMs,
    meanFrameMs,
    p95FrameMs: percentile(ascending, 0.95),
    longestFrameMs: ascending[ascending.length - 1],
    fastestFrameMs: ascending[0],
    longFrames: deltas.filter((delta) => delta > SCALE_LONG_FRAME_MS).length,
    displayCapHz: 1000 / ascending[0],
  };
}

/**
 * Scrolls `element` frame by frame for `durationMs` and reports what the
 * browser managed to present.
 *
 * The scroll is driven from the frame callback itself, so every sampled
 * interval contains exactly the work one real scroll step costs: the virtual
 * scroller recycling its rows, Angular re-rendering the recycled cells, and the
 * browser laying out and painting them. It reverses at both ends so a short
 * scroller still produces movement for the whole run.
 *
 * The furthest scrollable offset is read **once**, before the first frame.
 * `scrollHeight` and `clientHeight` are forced-layout reads, and reading them
 * inside a loop that wrote `scrollTop` on the previous frame would make the
 * instrument pay for a synchronous layout on every frame it publishes as the
 * table's scroll cost. The result set does not change during a run, so the
 * offset does not either.
 *
 * @returns The sample, or `null` when too few frames were presented to describe.
 */
export function runScrollBenchmark(
  options: ScaleScrollBenchmarkOptions,
): Promise<ScaleFrameSample | null> {
  const now = options.now ?? defaultNow;
  const requestFrame = options.requestFrame ?? defaultFrameScheduler();
  const stepPx = options.stepPx ?? SCALE_SCROLL_STEP_PX;
  const element = options.element;
  const signal = options.signal;
  const maxScroll = Math.max(0, element.scrollHeight - element.clientHeight);

  return new Promise((resolve) => {
    const timestamps: number[] = [];
    const startedAt = now();
    let direction = 1;

    const step = (): void => {
      if (signal?.aborted) {
        resolve(summarizeFrameTimestamps(timestamps));
        return;
      }
      const timestamp = now();
      timestamps.push(timestamp);

      if (maxScroll > 0) {
        let next = element.scrollTop + direction * stepPx;
        if (next >= maxScroll) {
          next = maxScroll;
          direction = -1;
        } else if (next <= 0) {
          next = 0;
          direction = 1;
        }
        element.scrollTop = next;
      }

      if (timestamp - startedAt >= options.durationMs) {
        resolve(summarizeFrameTimestamps(timestamps));
        return;
      }
      requestFrame(step);
    };

    requestFrame(step);
  });
}

/**
 * Runs `measure` on the frame after the current one, which is the first frame
 * whose presentation includes whatever was just written to the DOM.
 *
 * Call it from an Angular `afterNextRender` callback: that hook already runs
 * after the DOM write for the current change-detection pass, so one further
 * frame hop lands after the browser has painted it.
 *
 * @param measure - Receives the clock reading taken on that frame.
 * @param requestFrame - Frame scheduler; defaults to the runtime's.
 * @param now - Clock; defaults to `performance.now()`.
 */
export function measureAfterPaint(
  measure: (paintedAt: number) => void,
  requestFrame: ScaleFrameScheduler = defaultFrameScheduler(),
  now: ScaleClock = defaultNow,
): void {
  requestFrame(() => measure(now()));
}

/** What started a query, for labelling its measurement. */
export type ScaleInteraction =
  | 'load'
  | 'dataset'
  | 'filter'
  | 'search'
  | 'sort'
  | 'page'
  | 'query';

/** User-facing name of each tracked interaction. */
export const SCALE_INTERACTION_LABELS: Readonly<
  Record<ScaleInteraction, string>
> = {
  load: 'first load',
  dataset: 'dataset change',
  filter: 'filter',
  search: 'search',
  sort: 'sort',
  page: 'page size',
  query: 'background query',
};

/**
 * One measured query, decomposed by where the time was actually spent.
 *
 * The parts are published separately rather than summed, because the claim the
 * page makes is about *which thread* paid for what: `computeMs` never ran on
 * the main thread, `identifyMs` and `renderMs` only ever did, and `transferMs`
 * is the structured clone that crosses between them.
 */
export interface ScaleQuerySample {
  /** What started the query. */
  readonly interaction: ScaleInteraction;
  /** Rows in the delivered slice. */
  readonly rowsReturned: number;
  /** Rows matching search and filters, before paging. */
  readonly total: number;
  /** Sort/filter/page cost inside the backend. */
  readonly computeMs: number;
  /** The artificial delay that was dialled in. */
  readonly latencyMs: number;
  /** `postMessage` structured clone plus scheduling, up to the arrival of the message. */
  readonly transferMs: number;
  /**
   * Main-thread walk of the delivered rows that restores their identity, run
   * between the arrival of the message and the rows being published.
   *
   * Reported rather than folded into transfer or render: it is main-thread work
   * proportional to the delivered slice, which in virtual-scroll mode is the
   * whole result set.
   */
  readonly identifyMs: number;
  /** Rows-on-main-thread to painted frame: change detection, DOM, layout, paint. */
  readonly renderMs: number;
  /** Interaction to painted frame; `null` when no interaction was being tracked. */
  readonly commitToPaintMs: number | null;
  /** Whether the whole result set was transferred (the table's virtual-scroll mode). */
  readonly unpaged: boolean;
}

/** The first painted frame after a dataset was generated. */
export interface ScaleRenderSample {
  /** Rows in the first delivered slice. */
  readonly rowsReturned: number;
  /** Rows the backend generated, including tree children. */
  readonly datasetRows: number;
  /** Cost of generating the dataset inside the backend. */
  readonly generateMs: number;
  /** Rows-on-main-thread to painted frame. */
  readonly renderMs: number;
  /** Dataset request to painted frame: generate, query, latency, transfer and render. */
  readonly endToEndMs: number;
}
