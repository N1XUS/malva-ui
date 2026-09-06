import { describe, expect, it } from 'vitest';
import {
  SCALE_LONG_FRAME_MS,
  measureAfterPaint,
  prefersReducedMotion,
  runScrollBenchmark,
  summarizeFrameTimestamps,
  type ScaleFrameScheduler,
} from './data-at-scale.metrics';

/**
 * Runs `body` with `globalThis.matchMedia` replaced, then puts back exactly
 * what was there — including its absence, which is the case jsdom itself may
 * or may not present depending on its version.
 */
function withMatchMedia(
  stub: ((query: string) => { matches: boolean }) | null,
  body: () => void,
): void {
  const global = globalThis as unknown as Record<string, unknown>;
  const original = Object.getOwnPropertyDescriptor(globalThis, 'matchMedia');
  try {
    if (stub === null) delete global['matchMedia'];
    else
      Object.defineProperty(globalThis, 'matchMedia', {
        configurable: true,
        writable: true,
        value: stub,
      });
    body();
  } finally {
    if (original) Object.defineProperty(globalThis, 'matchMedia', original);
    else delete global['matchMedia'];
  }
}

/** A clock and frame scheduler that advance by a scripted list of frame gaps. */
function scriptedFrames(gaps: readonly number[]): {
  now: () => number;
  requestFrame: ScaleFrameScheduler;
  readonly elapsed: () => number;
} {
  let clock = 1000;
  let index = 0;
  return {
    now: () => clock,
    elapsed: () => clock,
    requestFrame: (callback) => {
      clock += gaps[Math.min(index, gaps.length - 1)];
      index++;
      callback(clock);
    },
  };
}

describe('summarizeFrameTimestamps', () => {
  it('describes nothing from fewer than two intervals', () => {
    expect(summarizeFrameTimestamps([])).toBeNull();
    expect(summarizeFrameTimestamps([0, 16])).toBeNull();
    // Three timestamps that only advance once still yield a single interval.
    expect(summarizeFrameTimestamps([0, 16, 16])).toBeNull();
  });

  it('reports the frame rate, its spread, and the observed ceiling', () => {
    // 16 ms frames with one 60 ms stall: 5 intervals over 124 ms.
    const sample = summarizeFrameTimestamps([0, 16, 32, 48, 108, 124]);

    expect(sample).not.toBeNull();
    expect(sample?.frames).toBe(5);
    expect(sample?.durationMs).toBe(124);
    expect(sample?.fps).toBeCloseTo((5 * 1000) / 124, 5);
    expect(sample?.meanFrameMs).toBeCloseTo(124 / 5, 5);
    expect(sample?.longestFrameMs).toBe(60);
    expect(sample?.p95FrameMs).toBe(60);
    expect(sample?.longFrames).toBe(1);
    // The quickest frame is 16 ms — a ~62 fps bound this run did not beat,
    // published as an observation rather than as the display's specification.
    expect(sample?.fastestFrameMs).toBe(16);
    expect(sample?.displayCapHz).toBeCloseTo(1000 / 16, 5);
    expect(sample?.displayCapHz ?? 0).toBeGreaterThanOrEqual(sample?.fps ?? 0);
  });

  it('counts only frames slower than the jank threshold', () => {
    const belowThreshold = summarizeFrameTimestamps([
      0,
      SCALE_LONG_FRAME_MS,
      SCALE_LONG_FRAME_MS * 2,
      SCALE_LONG_FRAME_MS * 3,
    ]);

    expect(belowThreshold?.longFrames).toBe(0);
  });

  it('ignores frames that did not advance the clock', () => {
    const sample = summarizeFrameTimestamps([0, 16, 16, 32, 48]);

    expect(sample?.frames).toBe(3);
  });
});

describe('runScrollBenchmark', () => {
  it('scrolls the target every frame and reverses at the far edge', async () => {
    const element = { scrollTop: 0, scrollHeight: 1000, clientHeight: 900 };
    const frames = scriptedFrames([10]);

    const sample = await runScrollBenchmark({
      element,
      durationMs: 50,
      stepPx: 40,
      now: frames.now,
      requestFrame: frames.requestFrame,
    });

    // Max scroll is 100px, so the run walks 40 → 80 → 100 (clamped, reversed)
    // → 60 → 20 rather than running off the end and sampling a frozen surface.
    expect(element.scrollTop).toBe(20);
    expect(sample).not.toBeNull();
    expect(sample?.frames).toBe(4);
    expect(sample?.fps).toBeCloseTo(100, 5);
  });

  it('still samples frames when the target cannot scroll', async () => {
    const element = { scrollTop: 0, scrollHeight: 0, clientHeight: 0 };
    const frames = scriptedFrames([16]);

    const sample = await runScrollBenchmark({
      element,
      durationMs: 64,
      now: frames.now,
      requestFrame: frames.requestFrame,
    });

    expect(element.scrollTop).toBe(0);
    // Four 16 ms frames fit inside 64 ms, which is three measurable intervals.
    expect(sample?.frames).toBe(3);
  });

  it('reads the scrollable extent once, not on every frame', async () => {
    // `scrollHeight` and `clientHeight` force a synchronous layout, and the
    // previous frame wrote `scrollTop`. Reading them per frame would make the
    // instrument pay for a layout inside every interval it publishes as the
    // table's scroll cost.
    let layoutReads = 0;
    const element = {
      scrollTop: 0,
      get scrollHeight() {
        layoutReads++;
        return 1000;
      },
      get clientHeight() {
        layoutReads++;
        return 900;
      },
    };
    const frames = scriptedFrames([10]);

    const sample = await runScrollBenchmark({
      element,
      durationMs: 50,
      stepPx: 40,
      now: frames.now,
      requestFrame: frames.requestFrame,
    });

    expect(sample?.frames).toBe(4);
    expect(layoutReads).toBe(2);
  });

  it('resolves with what it sampled when the run is aborted', async () => {
    const element = { scrollTop: 0, scrollHeight: 100_000, clientHeight: 500 };
    const controller = new AbortController();
    let framesRequested = 0;
    // Aborts on the fourth frame, mid-run: the component does this on destroy.
    const requestFrame: ScaleFrameScheduler = (callback) => {
      framesRequested++;
      if (framesRequested === 4) controller.abort();
      callback(1000 + framesRequested * 16);
    };

    const sample = await runScrollBenchmark({
      element,
      durationMs: 10_000,
      now: () => 1000 + framesRequested * 16,
      requestFrame,
      signal: controller.signal,
    });

    // The run stopped where it was told to rather than scrolling a detached
    // element for the rest of its duration.
    expect(framesRequested).toBe(4);
    expect(sample?.frames).toBe(2);
    const scrolledAtAbort = element.scrollTop;
    await Promise.resolve();
    expect(element.scrollTop).toBe(scrolledAtAbort);
  });

  it('reports nothing when the run is too short to describe', async () => {
    const element = { scrollTop: 0, scrollHeight: 1000, clientHeight: 100 };
    const frames = scriptedFrames([16]);

    const sample = await runScrollBenchmark({
      element,
      durationMs: 0,
      now: frames.now,
      requestFrame: frames.requestFrame,
    });

    expect(sample).toBeNull();
  });
});

describe('prefersReducedMotion', () => {
  it('reads the reduce preference when the runtime can answer', () => {
    withMatchMedia(
      (query) => ({ matches: query === '(prefers-reduced-motion: reduce)' }),
      () => expect(prefersReducedMotion()).toBe(true),
    );
    withMatchMedia(
      () => ({ matches: false }),
      () => expect(prefersReducedMotion()).toBe(false),
    );
  });

  it('treats a runtime with no matchMedia as expressing no preference', () => {
    // jsdom has none. A missing media-query API must not throw, and must not
    // be read as "reduce" — that would disable the benchmark in every spec.
    withMatchMedia(null, () => expect(prefersReducedMotion()).toBe(false));
  });
});

describe('measureAfterPaint', () => {
  it('reports the clock reading of the frame after the current one', () => {
    const frames = scriptedFrames([16]);
    let paintedAt = 0;

    measureAfterPaint(
      (value) => (paintedAt = value),
      frames.requestFrame,
      frames.now,
    );

    expect(paintedAt).toBe(1016);
  });
});
