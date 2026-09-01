import { Component, afterEveryRender, viewChild } from '@angular/core';
import {
  ComponentFixtureAutoDetect,
  TestBed,
  type ComponentFixture,
} from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvScrollbar } from './scrollbar';

/**
 * Specs for the viewport scroll listener, which is registered outside the
 * template as `fromEvent(…, 'scroll', { passive: true })` and torn down with
 * `takeUntilDestroyed(destroyRef)`, rather than through a `(scroll)` binding.
 *
 * Every one of these dispatches a **native** scroll event at the real
 * scrolling element, `.mlv-scrollbar__viewport`, so the wiring itself is under
 * test and not just `_onScroll`'s body.
 */

/** Mock ResizeObserver — jsdom has none. Callbacks are kept so geometry can be driven. */
const resizeCallbacks: ResizeObserverCallback[] = [];

globalThis.ResizeObserver = class implements ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallbacks.push(callback);
  }
  readonly observe = vi.fn();
  readonly unobserve = vi.fn();
  readonly disconnect = vi.fn();
};

/** Viewport scroll state stubbed onto the real element (jsdom has no layout). */
interface ViewportState {
  clientHeight: number;
  scrollHeight: number;
  scrollTop: number;
  clientWidth: number;
  scrollWidth: number;
  scrollLeft: number;
}

@Component({
  imports: [MlvScrollbar],
  template: `<mlv-scrollbar><div>content</div></mlv-scrollbar>`,
})
class ScrollbarHost {
  readonly scrollbar = viewChild.required(MlvScrollbar);

  /** Incremented once per real change-detection pass. */
  renders = 0;

  constructor() {
    afterEveryRender(() => {
      this.renders++;
    });
  }
}

interface Harness {
  fixture: ComponentFixture<ScrollbarHost>;
  host: ScrollbarHost;
  viewportEl: HTMLElement;
  state: ViewportState;
  /** Reads a private thumb signal. */
  thumb: (name: '_thumbTop' | '_thumbHeight') => number;
  /** Reads the private `_isScrolling` signal. */
  isScrolling: () => boolean;
  /** Dispatches a native scroll event at the viewport. */
  scroll: () => void;
}

const TRACK_PADDING_PX = 4;
const TRACK_EXTENT_PX = 200;

async function createHarness(): Promise<Harness> {
  resizeCallbacks.length = 0;

  TestBed.configureTestingModule({
    providers: [
      provideMlvI18nTesting(),
      { provide: ComponentFixtureAutoDetect, useValue: true },
    ],
  });

  const fixture = TestBed.createComponent(ScrollbarHost);
  fixture.detectChanges();
  await fixture.whenStable();

  const root: HTMLElement = fixture.nativeElement;
  const viewportEl = root.querySelector<HTMLElement>(
    '.mlv-scrollbar__viewport',
  ) as HTMLElement;
  const trackV = root.querySelector<HTMLElement>(
    '.mlv-scrollbar__track--vertical',
  ) as HTMLElement;
  expect(viewportEl).toBeTruthy();
  expect(trackV).toBeTruthy();

  trackV.style.padding = `${TRACK_PADDING_PX}px 0`;
  Object.defineProperty(trackV, 'offsetHeight', {
    get: () =>
      trackV.classList.contains('mlv-scrollbar__track--hidden')
        ? 0
        : TRACK_EXTENT_PX,
    configurable: true,
  });

  const state: ViewportState = {
    clientHeight: 100,
    scrollHeight: 400,
    scrollTop: 0,
    clientWidth: 100,
    scrollWidth: 100,
    scrollLeft: 0,
  };
  for (const key of Object.keys(state) as (keyof ViewportState)[]) {
    Object.defineProperty(viewportEl, key, {
      get: () => state[key],
      set: (value: number) => {
        state[key] = value;
      },
      configurable: true,
    });
  }

  // Replay the component's ResizeObserver callback → real `_updateGeometry`,
  // which is what makes the stubbed overflow visible to the component.
  resizeCallbacks.at(-1)?.([], {} as ResizeObserver);
  fixture.detectChanges();
  await fixture.whenStable();

  const instance = fixture.componentInstance.scrollbar() as unknown as Record<
    string,
    () => unknown
  >;

  return {
    fixture,
    host: fixture.componentInstance,
    viewportEl,
    state,
    thumb: (name) => instance[name]() as number,
    isScrolling: () => instance['_isScrolling']() as boolean,
    scroll: () => viewportEl.dispatchEvent(new Event('scroll')),
  };
}

describe('MlvScrollbar viewport scroll listener', () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.fixture.destroy();
  });

  // -------------------------------------------------------------------------
  // 1. Wiring
  // -------------------------------------------------------------------------

  it('moves the thumb from a native scroll dispatched at the viewport', () => {
    const before = h.thumb('_thumbTop');

    h.state.scrollTop = 150;
    h.scroll();

    expect(h.thumb('_thumbTop')).toBeGreaterThan(before);
    expect(h.thumb('_thumbHeight')).toBeGreaterThan(0);
  });

  it('sets the scrolling state from a native scroll at the viewport', async () => {
    expect(h.isScrolling()).toBe(false);

    h.scroll();

    expect(h.isScrolling()).toBe(true);
    await h.fixture.whenStable();
    expect(
      (h.fixture.nativeElement as HTMLElement).querySelector('mlv-scrollbar')
        ?.classList,
    ).toContain('mlv-scrollbar--scrolling');
  });

  it('does not react to a scroll dispatched at the mlv-scrollbar host', () => {
    const scrollbarHost = (
      h.fixture.nativeElement as HTMLElement
    ).querySelector<HTMLElement>('mlv-scrollbar');
    expect(scrollbarHost).not.toBe(h.viewportEl);

    h.state.scrollTop = 150;
    // `scroll` does not bubble, so the host never sees the viewport's event.
    scrollbarHost?.dispatchEvent(new Event('scroll'));

    expect(h.isScrolling()).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 2. Teardown
  // -------------------------------------------------------------------------

  it('stops reacting to scroll after the fixture is destroyed', () => {
    h.state.scrollTop = 150;
    h.scroll();
    const top = h.thumb('_thumbTop');
    expect(top).toBeGreaterThan(0);

    h.fixture.destroy();

    h.state.scrollTop = 300;
    expect(() => h.scroll()).not.toThrow();
    expect(h.thumb('_thumbTop')).toBe(top);
  });

  // -------------------------------------------------------------------------
  // 3. Change-detection pass count
  // -------------------------------------------------------------------------

  it('runs no change-detection pass for a burst of no-op scrolls', async () => {
    // First scroll reaches steady state: `_isScrolling` is already true and the
    // thumb already sits at this offset, so re-scrolling to the same position
    // writes no signal at all.
    h.state.scrollTop = 150;
    h.scroll();
    await h.fixture.whenStable();

    const SCROLLS = 20;
    const before = h.host.renders;
    for (let i = 0; i < SCROLLS; i++) {
      h.scroll();
      await h.fixture.whenStable();
    }
    const passes = h.host.renders - before;

    // Bound: the burst moves no signal, so a correct implementation runs ZERO
    // passes; allow one for the 150 ms idle timer if it happens to elapse
    // mid-burst. A template `(scroll)` binding runs Angular's listener wrapper,
    // which calls `markViewDirty` and notifies the change-detection scheduler
    // unconditionally — one pass per event, 20.
    expect(passes).toBeLessThanOrEqual(1);
    expect(passes).toBeLessThan(SCROLLS);
  });
});

// ---------------------------------------------------------------------------
// 4. Passive registration
// ---------------------------------------------------------------------------

describe('MlvScrollbar scroll listener registration', () => {
  interface Registration {
    target: EventTarget;
    options: boolean | AddEventListenerOptions | undefined;
  }

  let original: typeof EventTarget.prototype.addEventListener;
  let scrollRegistrations: Registration[];

  beforeEach(() => {
    scrollRegistrations = [];
    original = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (
      this: EventTarget,
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ): void {
      if (type === 'scroll') {
        scrollRegistrations.push({ target: this, options });
      }
      return original.call(this, type, listener, options);
    } as typeof EventTarget.prototype.addEventListener;
  });

  afterEach(() => {
    EventTarget.prototype.addEventListener = original;
  });

  it('registers the viewport scroll listener as passive', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideMlvI18nTesting(),
        { provide: ComponentFixtureAutoDetect, useValue: true },
      ],
    });
    const fixture = TestBed.createComponent(ScrollbarHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const viewportEl = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLElement>('.mlv-scrollbar__viewport');

    expect(scrollRegistrations).toHaveLength(1);
    expect(scrollRegistrations[0].target).toBe(viewportEl);
    expect(scrollRegistrations[0].options).toEqual({ passive: true });

    fixture.destroy();
  });
});
