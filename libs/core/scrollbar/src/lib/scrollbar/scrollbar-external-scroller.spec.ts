import { Component, viewChild } from '@angular/core';
import {
  ComponentFixtureAutoDetect,
  TestBed,
  type ComponentFixture,
} from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvScrollbar } from './scrollbar';

/**
 * Specs for the external-scroller mode (`[scroller]`), issue #90.
 *
 * The mode exists for a control that cannot delegate scrolling to an ancestor —
 * a `<textarea>` is an `overflow: auto` box sized by `rows`, so it absorbs its
 * own overflow and a wrapping viewport never overflows at all. Here the
 * component keeps the decorated element as the scroller and renders nothing but
 * the tracks over it.
 *
 * Every scroll dispatch below is a **native** event at the element that really
 * scrolls. `scroll` does not bubble, so a dispatch at the host — or at the now
 * inert internal viewport — must do nothing; both negatives are asserted,
 * because `dispatchEvent` runs a node's own listeners regardless of bubbling
 * and a test that dispatches at the wrong node passes vacuously (issue #73).
 */

/** Mock ResizeObserver — jsdom has none. Observed targets are recorded. */
const resizeCallbacks: ResizeObserverCallback[] = [];
const observedTargets: Element[] = [];

globalThis.ResizeObserver = class implements ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallbacks.push(callback);
  }
  readonly observe = vi.fn((target: Element) => {
    observedTargets.push(target);
  });
  readonly unobserve = vi.fn();
  readonly disconnect = vi.fn();
};

/** Scroll state stubbed onto a real element (jsdom performs no layout). */
interface ScrollState {
  clientHeight: number;
  scrollHeight: number;
  scrollTop: number;
  clientWidth: number;
  scrollWidth: number;
  scrollLeft: number;
}

const TRACK_PADDING_PX = 4;
const TRACK_EXTENT_PX = 200;

@Component({
  imports: [MlvScrollbar],
  template: `
    <mlv-scrollbar
      [scroller]="fieldEl"
      [viewportTabIndex]="0"
      ariaLabel="Should never reach the DOM"
    >
      <textarea #fieldEl></textarea>
    </mlv-scrollbar>
  `,
})
class ExternalScrollerHost {
  readonly scrollbar = viewChild.required(MlvScrollbar);
}

@Component({
  imports: [MlvScrollbar],
  template: `<mlv-scrollbar><div>content</div></mlv-scrollbar>`,
})
class InternalScrollerHost {
  readonly scrollbar = viewChild.required(MlvScrollbar);
}

/** Installs a mutable scroll-state stub over an element's layout getters. */
function stubScrollState(
  el: HTMLElement,
  initial: Partial<ScrollState> = {},
): ScrollState {
  const state: ScrollState = {
    clientHeight: 100,
    scrollHeight: 100,
    scrollTop: 0,
    clientWidth: 100,
    scrollWidth: 100,
    scrollLeft: 0,
    ...initial,
  };
  for (const key of Object.keys(state) as (keyof ScrollState)[]) {
    Object.defineProperty(el, key, {
      get: () => state[key],
      set: (value: number) => {
        state[key] = value;
      },
      configurable: true,
    });
  }
  return state;
}

/**
 * Makes a track measurable, returning `0` while it carries `--hidden` — exactly
 * as a `display: none` element does in a browser.
 */
function stubTrackExtent(track: HTMLElement): void {
  track.style.padding = `${TRACK_PADDING_PX}px 0`;
  Object.defineProperty(track, 'offsetHeight', {
    get: () =>
      track.classList.contains('mlv-scrollbar__track--hidden')
        ? 0
        : TRACK_EXTENT_PX,
    configurable: true,
  });
}

interface Harness {
  fixture: ComponentFixture<ExternalScrollerHost>;
  component: MlvScrollbar;
  /** The decorated `<textarea>` — the element that really scrolls. */
  fieldEl: HTMLTextAreaElement;
  /** The component's own (now inert) viewport `<div>`. */
  viewportEl: HTMLElement;
  hostEl: HTMLElement;
  trackV: HTMLElement;
  thumbV: HTMLElement;
  state: ScrollState;
  settle: () => Promise<void>;
}

async function createHarness(): Promise<Harness> {
  resizeCallbacks.length = 0;
  observedTargets.length = 0;
  TestBed.resetTestingModule();

  TestBed.configureTestingModule({
    providers: [
      provideMlvI18nTesting(),
      { provide: ComponentFixtureAutoDetect, useValue: true },
    ],
  });

  const fixture = TestBed.createComponent(ExternalScrollerHost);
  fixture.detectChanges();
  await fixture.whenStable();

  const root: HTMLElement = fixture.nativeElement;
  const hostEl = root.querySelector<HTMLElement>(
    'mlv-scrollbar',
  ) as HTMLElement;
  const fieldEl = root.querySelector('textarea') as HTMLTextAreaElement;
  const viewportEl = root.querySelector<HTMLElement>(
    '.mlv-scrollbar__viewport',
  ) as HTMLElement;
  const trackV = root.querySelector<HTMLElement>(
    '.mlv-scrollbar__track--vertical',
  ) as HTMLElement;
  const thumbV = trackV.querySelector<HTMLElement>(
    '.mlv-scrollbar__thumb',
  ) as HTMLElement;

  expect(fieldEl).toBeTruthy();
  expect(viewportEl).toBeTruthy();
  expect(trackV).toBeTruthy();

  stubTrackExtent(trackV);
  // The inert viewport reports no overflow of its own, so a track that appears
  // can only have come from the decorated element's metrics.
  stubScrollState(viewportEl);
  const state = stubScrollState(fieldEl);

  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
  };

  await settle();

  return {
    fixture,
    component: fixture.componentInstance.scrollbar(),
    fieldEl,
    viewportEl,
    hostEl,
    trackV,
    thumbV,
    state,
    settle,
  };
}

describe('MlvScrollbar — external scroller', () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  afterEach(() => {
    h.fixture.destroy();
  });

  // -------------------------------------------------------------------------
  // 1. Identity — which element the component treats as the scroller
  // -------------------------------------------------------------------------

  describe('resolution', () => {
    it('exposes the decorated element as viewportElement, not the inner div', () => {
      expect(h.component.viewportElement).toBe(h.fieldEl);
      expect(h.component.viewportElement).not.toBe(h.viewportEl);
    });

    it('marks the host with the --external modifier', () => {
      expect(h.hostEl.classList).toContain('mlv-scrollbar--external');
    });

    it('observes the decorated element as well as its own viewport', () => {
      expect(observedTargets).toContain(h.fieldEl);
      expect(observedTargets).toContain(h.viewportEl);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Accessibility — the decorated element owns its own semantics
  // -------------------------------------------------------------------------

  describe('viewport semantics', () => {
    it('emits no tabindex, role or aria-label even with viewportTabIndex=0 and an ariaLabel', () => {
      expect(h.viewportEl.hasAttribute('tabindex')).toBe(false);
      expect(h.viewportEl.hasAttribute('role')).toBe(false);
      expect(h.viewportEl.hasAttribute('aria-label')).toBe(false);
    });

    it('leaves the decorated element untouched', () => {
      expect(h.fieldEl.hasAttribute('tabindex')).toBe(false);
      expect(h.fieldEl.hasAttribute('role')).toBe(false);
      expect(h.fieldEl.hasAttribute('aria-label')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Scroll wiring — `scroll` does not bubble
  // -------------------------------------------------------------------------

  describe('scroll wiring', () => {
    beforeEach(async () => {
      // Give the decorated element overflow so the thumb has somewhere to go.
      h.state.scrollHeight = 400;
      h.component.remeasure();
      await h.settle();
      h.component.remeasure();
      await h.settle();
    });

    it('moves the thumb from a native scroll dispatched at the decorated element', async () => {
      const before = Number(h.thumbV.style.top.replace('px', ''));

      h.state.scrollTop = 150;
      h.fieldEl.dispatchEvent(new Event('scroll'));
      await h.settle();

      expect(Number(h.thumbV.style.top.replace('px', ''))).toBeGreaterThan(
        before,
      );
    });

    it('does not react to a scroll dispatched at the mlv-scrollbar host', async () => {
      h.state.scrollTop = 150;
      // `scroll` does not bubble, so the host never sees the field's event —
      // a listener bound there would be silent in a browser.
      h.hostEl.dispatchEvent(new Event('scroll'));
      await h.settle();

      expect(h.hostEl.classList).not.toContain('mlv-scrollbar--scrolling');
    });

    it('does not react to a scroll dispatched at its own inert viewport', async () => {
      h.state.scrollTop = 150;
      h.viewportEl.dispatchEvent(new Event('scroll'));
      await h.settle();

      expect(h.hostEl.classList).not.toContain('mlv-scrollbar--scrolling');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Rendered track — the affordance issue #90 is about
  // -------------------------------------------------------------------------

  describe('rendered track', () => {
    it('hides the track while the decorated element does not overflow', () => {
      expect(h.trackV.classList).toContain('mlv-scrollbar__track--hidden');
    });

    it('renders a visible track with a non-zero thumb once it overflows', async () => {
      h.state.scrollHeight = 400;

      // No scroll event and no resize: content growing inside a textarea moves
      // nothing the observer can see. `remeasure()` is the whole contract.
      h.component.remeasure();
      await h.settle();

      expect(h.trackV.classList).not.toContain('mlv-scrollbar__track--hidden');
      expect(Number(h.thumbV.style.height.replace('px', ''))).toBeGreaterThan(
        0,
      );

      // The first pass measured the track while it was still `display: none`,
      // so it deliberately cached nothing; the next read sizes the thumb from
      // the now-visible track: (200 - 2×4) × 100/400 = 48.
      h.component.remeasure();
      await h.settle();

      expect(h.thumbV.style.height).toBe('48px');
    });

    it('hides the track again when the overflow goes away', async () => {
      h.state.scrollHeight = 400;
      h.component.remeasure();
      await h.settle();
      expect(h.trackV.classList).not.toContain('mlv-scrollbar__track--hidden');

      h.state.scrollHeight = 100;
      h.component.remeasure();
      await h.settle();

      expect(h.trackV.classList).toContain('mlv-scrollbar__track--hidden');
    });

    it('keeps the +1 sub-pixel tolerance — a 1px excess is not overflow', async () => {
      h.state.scrollHeight = 101;
      h.component.remeasure();
      await h.settle();

      expect(h.trackV.classList).toContain('mlv-scrollbar__track--hidden');

      h.state.scrollHeight = 102;
      h.component.remeasure();
      await h.settle();

      expect(h.trackV.classList).not.toContain('mlv-scrollbar__track--hidden');
    });
  });
});

// ---------------------------------------------------------------------------
// 5. The default path must be untouched
// ---------------------------------------------------------------------------

describe('MlvScrollbar — no scroller (default path unchanged)', () => {
  let fixture: ComponentFixture<InternalScrollerHost>;

  beforeEach(async () => {
    resizeCallbacks.length = 0;
    observedTargets.length = 0;

    TestBed.configureTestingModule({
      providers: [
        provideMlvI18nTesting(),
        { provide: ComponentFixtureAutoDetect, useValue: true },
      ],
    });

    fixture = TestBed.createComponent(InternalScrollerHost);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('defaults scroller to null', () => {
    expect(fixture.componentInstance.scrollbar().scroller()).toBeNull();
  });

  it('does not carry the --external modifier', () => {
    const hostEl = (fixture.nativeElement as HTMLElement).querySelector(
      'mlv-scrollbar',
    ) as HTMLElement;
    expect(hostEl.classList).not.toContain('mlv-scrollbar--external');
  });

  it('still returns its own viewport as viewportElement', () => {
    const viewportEl = (fixture.nativeElement as HTMLElement).querySelector(
      '.mlv-scrollbar__viewport',
    );
    expect(fixture.componentInstance.scrollbar().viewportElement).toBe(
      viewportEl,
    );
  });

  it('observes only its own viewport and content wrapper', () => {
    const root: HTMLElement = fixture.nativeElement;
    const viewportEl = root.querySelector('.mlv-scrollbar__viewport');
    const contentEl = root.querySelector('.mlv-scrollbar__content');

    expect(observedTargets).toEqual([viewportEl, contentEl]);
  });
});

// ---------------------------------------------------------------------------
// 6. remeasure() lifecycle guard
// ---------------------------------------------------------------------------

describe('MlvScrollbar — remeasure() guard', () => {
  it('measures nothing before the first render', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideMlvI18nTesting()] });

    // No change detection yet, so `afterNextRender` has not run. The guard is
    // what keeps `remeasure()` off the DOM in that window — and, because
    // `afterNextRender` never runs on the server at all, it is also the whole
    // SSR guard for the only DOM reads in the component that are not already
    // behind one.
    const fixture = TestBed.createComponent(MlvScrollbar);
    const viewportEl = (fixture.nativeElement as HTMLElement).querySelector(
      '.mlv-scrollbar__viewport',
    ) as HTMLElement;
    expect(viewportEl).toBeTruthy();
    stubScrollState(viewportEl, { scrollHeight: 400 });

    fixture.componentInstance.remeasure();

    const overflow = (
      fixture.componentInstance as unknown as Record<string, () => boolean>
    )['_hasVerticalOverflow'];
    expect(overflow()).toBe(false);

    fixture.destroy();
  });

  it('still works when the environment has no ResizeObserver', async () => {
    const originalRO = globalThis.ResizeObserver;
    // `remeasure()` is precisely the fallback for an environment that cannot
    // observe anything, so it must not be gated behind the observer.
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = undefined;

    try {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideMlvI18nTesting(),
          { provide: ComponentFixtureAutoDetect, useValue: true },
        ],
      });

      const fixture = TestBed.createComponent(ExternalScrollerHost);
      fixture.detectChanges();
      await fixture.whenStable();

      const root: HTMLElement = fixture.nativeElement;
      const fieldEl = root.querySelector('textarea') as HTMLTextAreaElement;
      const trackV = root.querySelector<HTMLElement>(
        '.mlv-scrollbar__track--vertical',
      ) as HTMLElement;
      stubTrackExtent(trackV);
      const state = stubScrollState(fieldEl);

      state.scrollHeight = 400;
      fixture.componentInstance.scrollbar().remeasure();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(trackV.classList).not.toContain('mlv-scrollbar__track--hidden');

      fixture.destroy();
    } finally {
      globalThis.ResizeObserver = originalRO;
    }
  });
});

// ---------------------------------------------------------------------------
// 7. Listener registration target
// ---------------------------------------------------------------------------

describe('MlvScrollbar — scroll listener target', () => {
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

  it('registers the passive scroll listener on the decorated element, not the viewport', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideMlvI18nTesting(),
        { provide: ComponentFixtureAutoDetect, useValue: true },
      ],
    });
    const fixture = TestBed.createComponent(ExternalScrollerHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const root: HTMLElement = fixture.nativeElement;
    const fieldEl = root.querySelector('textarea');
    const viewportEl = root.querySelector('.mlv-scrollbar__viewport');

    expect(scrollRegistrations).toHaveLength(1);
    expect(scrollRegistrations[0].target).toBe(fieldEl);
    expect(scrollRegistrations[0].target).not.toBe(viewportEl);
    expect(scrollRegistrations[0].options).toEqual({ passive: true });

    fixture.destroy();
  });
});
