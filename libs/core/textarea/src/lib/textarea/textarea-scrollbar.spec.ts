import { Component, signal } from '@angular/core';
import {
  ComponentFixtureAutoDetect,
  TestBed,
  type ComponentFixture,
} from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvTextarea } from './textarea';

/**
 * Regression specs for issue #90 — "overflowing content scrolls with no visible
 * scrollbar at all".
 *
 * The `<textarea>` is an `overflow: auto` box sized by `rows`, so it absorbs its
 * own overflow: the `mlv-scrollbar` that used to *wrap* it could never overflow
 * and both its tracks stayed `--hidden` with a 0px box, while
 * `scrollbar-width: none` suppressed the field's own native bar. The fix points
 * the scrollbar at the field with `[scroller]`, so the field stays the scroller
 * and the tracks are drawn over it.
 *
 * These assert on **rendered state** — the track's `--hidden` class and the
 * thumb's inline geometry — because every unit test on the measurement path
 * passed while the affordance was missing.
 *
 * The scroll dispatches go to the `<textarea>`, the element that really
 * scrolls. `scroll` does not bubble, so a dispatch at the `mlv-scrollbar` host
 * would pass vacuously; that negative is asserted too.
 */

/** Mock ResizeObserver — jsdom has none, and nothing here should depend on it. */
const resizeCallbacks: ResizeObserverCallback[] = [];

globalThis.ResizeObserver = class implements ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallbacks.push(callback);
  }
  readonly observe = vi.fn();
  readonly unobserve = vi.fn();
  readonly disconnect = vi.fn();
};

/** Field scroll state stubbed onto the real element (jsdom performs no layout). */
interface FieldState {
  clientHeight: number;
  scrollHeight: number;
  scrollTop: number;
  clientWidth: number;
  scrollWidth: number;
  scrollLeft: number;
}

const TRACK_PADDING_PX = 4;
const TRACK_EXTENT_PX = 200;
/** Field height in the stub — three rows' worth. */
const FIELD_CLIENT_HEIGHT = 100;

@Component({
  imports: [MlvTextarea],
  template: `<mlv-textarea
    label="Notes"
    [rows]="3"
    [autoResize]="autoResize()"
    [(value)]="text"
  />`,
})
class TextareaHost {
  readonly text = signal('');
  readonly autoResize = signal(false);
}

interface Harness {
  fixture: ComponentFixture<TextareaHost>;
  host: TextareaHost;
  /** The native `<textarea>` — the real scroller. */
  fieldEl: HTMLTextAreaElement;
  /** The `mlv-scrollbar` host element. */
  scrollbarEl: HTMLElement;
  /** The scrollbar's own, now inert, viewport `<div>`. */
  viewportEl: HTMLElement;
  trackV: HTMLElement;
  thumbV: HTMLElement;
  state: FieldState;
  /** Simulates the user typing: sets the element's value and fires `input`. */
  type: (value: string, scrollHeight: number) => Promise<void>;
  settle: () => Promise<void>;
}

async function createHarness(autoResize = false): Promise<Harness> {
  resizeCallbacks.length = 0;
  TestBed.resetTestingModule();

  TestBed.configureTestingModule({
    providers: [
      provideMlvI18nTesting(),
      { provide: ComponentFixtureAutoDetect, useValue: true },
    ],
  });

  const fixture = TestBed.createComponent(TextareaHost);
  fixture.componentInstance.autoResize.set(autoResize);
  fixture.detectChanges();
  await fixture.whenStable();

  const root: HTMLElement = fixture.nativeElement;
  const fieldEl = root.querySelector(
    '.mlv-textarea__field',
  ) as HTMLTextAreaElement;
  const scrollbarEl = root.querySelector(
    '.mlv-textarea__scrollbar',
  ) as HTMLElement;
  const viewportEl = root.querySelector(
    '.mlv-scrollbar__viewport',
  ) as HTMLElement;
  const trackV = root.querySelector(
    '.mlv-scrollbar__track--vertical',
  ) as HTMLElement;
  const thumbV = trackV.querySelector('.mlv-scrollbar__thumb') as HTMLElement;

  expect(fieldEl).toBeTruthy();
  expect(scrollbarEl).toBeTruthy();
  expect(trackV).toBeTruthy();

  trackV.style.padding = `${TRACK_PADDING_PX}px 0`;
  Object.defineProperty(trackV, 'offsetHeight', {
    get: () =>
      trackV.classList.contains('mlv-scrollbar__track--hidden')
        ? 0
        : TRACK_EXTENT_PX,
    configurable: true,
  });

  const state: FieldState = {
    clientHeight: FIELD_CLIENT_HEIGHT,
    scrollHeight: FIELD_CLIENT_HEIGHT,
    scrollTop: 0,
    clientWidth: 220,
    scrollWidth: 220,
    scrollLeft: 0,
  };
  for (const key of Object.keys(state) as (keyof FieldState)[]) {
    Object.defineProperty(fieldEl, key, {
      get: () => state[key],
      set: (value: number) => {
        state[key] = value;
      },
      configurable: true,
    });
  }

  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
  };

  await settle();

  return {
    fixture,
    host: fixture.componentInstance,
    fieldEl,
    scrollbarEl,
    viewportEl,
    trackV,
    thumbV,
    state,
    type: async (value: string, scrollHeight: number) => {
      fieldEl.value = value;
      state.scrollHeight = scrollHeight;
      fieldEl.dispatchEvent(new Event('input'));
      await settle();
    },
    settle,
  };
}

const hidden = (el: HTMLElement): boolean =>
  el.classList.contains('mlv-scrollbar__track--hidden');
const px = (value: string): number => Number(value.replace('px', ''));

describe('MlvTextarea — visible scrollbar track (issue #90)', () => {
  let h: Harness;

  afterEach(() => {
    h?.fixture.destroy();
  });

  // -------------------------------------------------------------------------
  // 1. Wiring — the field is the scroller, not a wrapper viewport
  // -------------------------------------------------------------------------

  describe('wiring', () => {
    beforeEach(async () => {
      h = await createHarness();
    });

    it('points the scrollbar at the <textarea> itself', () => {
      expect(h.scrollbarEl.classList).toContain('mlv-scrollbar--external');
    });

    it('never disables the scrollbar — the track must work in both modes', () => {
      expect(h.scrollbarEl.classList).not.toContain('mlv-scrollbar--disabled');
    });

    it('adds no second named or tabbable region around the field', () => {
      expect(h.viewportEl.hasAttribute('tabindex')).toBe(false);
      expect(h.viewportEl.hasAttribute('role')).toBe(false);
      expect(h.viewportEl.hasAttribute('aria-label')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 2. The bug — typing must produce a rendered track
  // -------------------------------------------------------------------------

  describe('typing', () => {
    beforeEach(async () => {
      h = await createHarness();
    });

    it('starts with no track while the content fits', () => {
      expect(hidden(h.trackV)).toBe(true);
    });

    it('renders a track with a non-zero box once typed content overflows', async () => {
      // No scroll event, no resize: a textarea's border box does not change
      // when a line of text is added, and it has no observable child. Before
      // the fix nothing at all was notified and the track stayed hidden.
      await h.type('line\n'.repeat(40), 400);

      expect(hidden(h.trackV)).toBe(false);
      expect(px(h.thumbV.style.height)).toBeGreaterThan(0);

      // The pass that flipped the overflow measured the track while it was
      // still `display: none`, so it cached nothing. The next keystroke sizes
      // the thumb off the now-visible track: (200 - 2×4) × 100/400 = 48.
      await h.type('line\n'.repeat(41), 400);

      expect(hidden(h.trackV)).toBe(false);
      expect(px(h.thumbV.style.height)).toBe(48);
    });

    it('hides the track again when the content is deleted', async () => {
      await h.type('line\n'.repeat(40), 400);
      expect(hidden(h.trackV)).toBe(false);

      await h.type('', FIELD_CLIENT_HEIGHT);

      expect(hidden(h.trackV)).toBe(true);
    });

    it('renders the track for a value set programmatically, not only typed', async () => {
      // NB: this cannot discriminate `afterRenderEffect` from a plain `effect`
      // — jsdom lays nothing out, so `scrollHeight` is a stub that does not
      // depend on the DOM value having been written yet. The hook choice rests
      // on ordering (a component `effect` runs *before* the template's update
      // pass writes `[value]`, which is the shape of issue #78), not on this
      // assertion. What this does prove is that the programmatic path reaches
      // `remeasure()` at all.
      h.state.scrollHeight = 400;
      h.host.text.set('line\n'.repeat(40));
      await h.settle();

      expect(hidden(h.trackV)).toBe(false);
      expect(px(h.thumbV.style.height)).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Auto-resize mode — the `[disabled]` binding used to switch the track off
  // -------------------------------------------------------------------------

  describe('auto-resize mode', () => {
    beforeEach(async () => {
      h = await createHarness(true);
    });

    it('renders the track once the clamped field overflows', async () => {
      await h.type('line\n'.repeat(40), 400);

      expect(h.scrollbarEl.classList).not.toContain('mlv-scrollbar--disabled');
      expect(hidden(h.trackV)).toBe(false);
      expect(px(h.thumbV.style.height)).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Scrolling the field moves the thumb (`scroll` does not bubble)
  // -------------------------------------------------------------------------

  describe('scrolling', () => {
    beforeEach(async () => {
      h = await createHarness();
      await h.type('line\n'.repeat(40), 400);
      await h.type('line\n'.repeat(41), 400);
    });

    it('moves the thumb from a native scroll dispatched at the <textarea>', async () => {
      const before = px(h.thumbV.style.top);

      h.state.scrollTop = 150;
      h.fieldEl.dispatchEvent(new Event('scroll'));
      await h.settle();

      expect(px(h.thumbV.style.top)).toBeGreaterThan(before);
    });

    it('does not react to a scroll dispatched at the mlv-scrollbar host', async () => {
      h.state.scrollTop = 150;
      h.scrollbarEl.dispatchEvent(new Event('scroll'));
      await h.settle();

      expect(h.scrollbarEl.classList).not.toContain('mlv-scrollbar--scrolling');
    });
  });
});
