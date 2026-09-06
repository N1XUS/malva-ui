import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MlvCalendarSheet } from './calendar-sheet';

/**
 * Specs for the two coupled scroll surfaces — the horizontal year strip and the
 * vertical month list.
 *
 * jsdom has no layout, so `offsetTop`, `clientHeight`, `scrollHeight` and
 * `scrollTo` are stubbed the way `scrubber.spec.ts` stubs the drum's metrics.
 * Every scroll here is a **native** `scroll` event dispatched at the element
 * that really scrolls, so the listener wiring is under test and not just the
 * handler body.
 */

/** Stubbed rendered height of one month section. */
const MONTH_HEIGHT = 300;

/** Stubbed height of the month list's viewport. */
const VIEWPORT_HEIGHT = 400;

/** Debounce the sheet applies before reading the scroll position back. */
const SCROLL_DEBOUNCE_MS = 150;

@Component({
  imports: [MlvCalendarSheet],
  template: `
    <mlv-calendar-sheet
      [(value)]="value"
      [min]="min()"
      [max]="max()"
      [windowMonths]="2"
      [maxMonths]="maxMonths()"
      [yearRange]="3"
    />
  `,
})
class ScrollHost {
  readonly value = signal<Date | null>(new Date(2026, 5, 15));
  readonly min = signal<Date | null>(null);
  readonly max = signal<Date | null>(null);
  readonly maxMonths = signal(121);
}

interface Harness {
  fixture: ComponentFixture<ScrollHost>;
  host: ScrollHost;
  root: HTMLElement;
  monthsEl: HTMLElement;
  /** Current stubbed scroll offset of the month list. */
  scrollTop: () => number;
  /** Moves the stubbed offset and dispatches a native scroll event. */
  scrollTo: (top: number) => void;
  /** Dispatches a native scroll event without moving the offset. */
  emitScroll: () => void;
  /** Every `scrollTo()` the component has requested, in order. */
  scrollRequests: ScrollToOptions[];
  /** Dispatches a keydown at the month list, which owns the key handler. */
  press: (key: string) => void;
  /** The `YYYY-M` keys of the rendered month sections, in DOM order. */
  monthKeys: () => string[];
  /** The year currently centred in the strip. */
  stripYear: () => number;
}

/**
 * `offsetTop` is stubbed on the prototype rather than per element: window
 * extension creates sections after the harness has been built, and the
 * component measures them from an `afterNextRender` the spec cannot hook.
 * Restored in `afterEach`.
 */
const originalOffsetTop = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'offsetTop',
);
const originalOffsetHeight = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'offsetHeight',
);

/** Stubbed rendered height of one day button. */
const DAY_HEIGHT = 40;

/**
 * Offset of a day button inside its own month section. Any value inside the
 * section works; this one sits below the section header so a cell is never
 * confused with the section's own top edge.
 */
const DAY_OFFSET_IN_MONTH = 100;

function stubMonthOffsets(): void {
  Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
    configurable: true,
    get(this: HTMLElement) {
      const section = this.hasAttribute('data-month')
        ? this
        : this.closest<HTMLElement>('[data-month]');
      if (!section) return 0;
      const siblings = Array.from(
        section.parentElement?.querySelectorAll('[data-month]') ?? [],
      );
      const sectionTop = siblings.indexOf(section) * MONTH_HEIGHT;
      // Day buttons sit inside their section; every other node is measured as
      // the section itself, which is all the component asks for.
      return this === section ? sectionTop : sectionTop + DAY_OFFSET_IN_MONTH;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.hasAttribute('data-month') ? MONTH_HEIGHT : DAY_HEIGHT;
    },
  });
}

function restoreMonthOffsets(): void {
  for (const [name, original] of [
    ['offsetTop', originalOffsetTop],
    ['offsetHeight', originalOffsetHeight],
  ] as const) {
    if (original) {
      Object.defineProperty(HTMLElement.prototype, name, original);
    } else {
      delete (HTMLElement.prototype as unknown as Record<string, unknown>)[
        name
      ];
    }
  }
}

/** Polls instead of sleeping a fixed span, so the debounce cannot flake. */
async function waitFor(
  predicate: () => boolean,
  timeoutMs = 4000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/** Fixed wait past the debounce, used only where the expectation is "nothing happened". */
const settle = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, SCROLL_DEBOUNCE_MS * 3));

async function createHarness(): Promise<Harness> {
  await TestBed.configureTestingModule({
    imports: [ScrollHost],
    providers: [provideMlvI18nTesting()],
  }).compileComponents();

  const fixture = TestBed.createComponent(ScrollHost);
  const host = fixture.componentInstance;
  const root = fixture.nativeElement as HTMLElement;
  fixture.detectChanges();
  await fixture.whenStable();

  const monthsEl = root.querySelector<HTMLElement>(
    '.mlv-calendar-sheet__months',
  ) as HTMLElement;
  expect(monthsEl).toBeTruthy();

  const monthEls = (): HTMLElement[] =>
    Array.from(root.querySelectorAll<HTMLElement>('[data-month]'));

  let top = 0;
  Object.defineProperty(monthsEl, 'scrollTop', {
    get: () => top,
    set: (value: number) => {
      top = value;
    },
    configurable: true,
  });
  Object.defineProperty(monthsEl, 'clientHeight', {
    get: () => VIEWPORT_HEIGHT,
    configurable: true,
  });
  Object.defineProperty(monthsEl, 'scrollHeight', {
    get: () => monthEls().length * MONTH_HEIGHT,
    configurable: true,
  });
  // Stands in for a smooth programmatic scroll that has been *requested* but
  // has not moved the offset yet — the case the echo guard exists for.
  const scrollRequests: ScrollToOptions[] = [];
  monthsEl.scrollTo = ((options: ScrollToOptions) => {
    scrollRequests.push(options);
  }) as typeof monthsEl.scrollTo;

  const emitScroll = (): void => {
    monthsEl.dispatchEvent(new Event('scroll'));
  };

  return {
    fixture,
    host,
    root,
    monthsEl,
    scrollTop: () => top,
    scrollTo: (value: number) => {
      top = value;
      emitScroll();
    },
    emitScroll,
    scrollRequests,
    press: (key: string) => {
      monthsEl.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true }),
      );
      fixture.detectChanges();
    },
    monthKeys: () => monthEls().map((el) => el.dataset['month'] as string),
    stripYear: () =>
      Number(
        root
          .querySelector('.mlv-scrubber__item--selected')
          ?.textContent?.trim(),
      ),
  };
}

/** The year strip's option for a given year, failing loudly when absent. */
function yearOption(harness: Harness, year: number): HTMLElement {
  const option = Array.from(
    harness.root.querySelectorAll<HTMLElement>('.mlv-scrubber__item'),
  ).find((el) => el.textContent?.trim() === String(year));
  if (!option) throw new Error(`the year strip renders no option for ${year}`);
  return option;
}

describe('MlvCalendarSheet scroll coupling', () => {
  let h: Harness;

  beforeEach(async () => {
    stubMonthOffsets();
    h = await createHarness();
  });

  afterEach(() => {
    h.fixture.destroy();
    restoreMonthOffsets();
  });

  it('seeds the strip on the year of the selection', () => {
    expect(h.stripYear()).toBe(2026);
  });

  it('drives the year strip from the month list scroll position', async () => {
    // The window runs Apr 2026 … Aug 2026; scroll to the last section.
    expect(h.monthKeys()).toEqual([
      '2026-3',
      '2026-4',
      '2026-5',
      '2026-6',
      '2026-7',
    ]);

    h.host.value.set(new Date(2025, 11, 15));
    h.fixture.detectChanges();
    await h.fixture.whenStable();

    // Oct 2025 … Feb 2026: the fourth section is January 2026.
    expect(h.monthKeys()).toEqual([
      '2025-9',
      '2025-10',
      '2025-11',
      '2026-0',
      '2026-1',
    ]);

    h.scrollTo(3 * MONTH_HEIGHT);
    await waitFor(() => h.stripYear() === 2026);
    h.fixture.detectChanges();

    expect(h.stripYear()).toBe(2026);

    h.scrollTo(0);
    await waitFor(() => h.stripYear() === 2025);
    h.fixture.detectChanges();

    expect(h.stripYear()).toBe(2025);
  });

  it('scrolls the month list to January when a year is scrubbed', async () => {
    const requested: number[] = [];
    h.monthsEl.scrollTo = ((options: ScrollToOptions) => {
      requested.push(options.top ?? 0);
    }) as HTMLElement['scrollTo'];

    expect(h.root.querySelector('.mlv-scrubber__list')).toBeTruthy();

    yearOption(h, 2027).click();
    h.fixture.detectChanges();
    await h.fixture.whenStable();

    expect(h.stripYear()).toBe(2027);
    // The window has to be re-seated on 2027 for January to exist in it.
    expect(h.monthKeys()).toContain('2027-0');
    expect(requested.length).toBeGreaterThan(0);
    expect(requested.at(-1)).toBe(
      h.monthKeys().indexOf('2027-0') * MONTH_HEIGHT,
    );
  });

  it('does not let its own programmatic scroll echo back into the strip', async () => {
    yearOption(h, 2027).click();
    h.fixture.detectChanges();
    await h.fixture.whenStable();
    expect(h.stripYear()).toBe(2027);

    // The stubbed `scrollTo` never moved the offset, so a settle that ignored
    // the programmatic flag would read the old position and drag the strip back.
    h.emitScroll();
    await settle();
    h.fixture.detectChanges();

    expect(h.stripYear()).toBe(2027);
  });

  it('resumes following the month list after the programmatic scroll settles', async () => {
    yearOption(h, 2027).click();
    h.fixture.detectChanges();
    await h.fixture.whenStable();

    h.emitScroll();
    await settle();

    const januaryIndex = h.monthKeys().indexOf('2027-0');
    const decemberIndex = h.monthKeys().indexOf('2026-11');
    expect(decemberIndex).toBeGreaterThanOrEqual(0);
    expect(januaryIndex).toBeGreaterThan(decemberIndex);

    h.scrollTo(decemberIndex * MONTH_HEIGHT);
    await waitFor(() => h.stripYear() === 2026);
    h.fixture.detectChanges();

    expect(h.stripYear()).toBe(2026);
  });

  it('extends the window when the user scrolls to the trailing edge', async () => {
    const before = h.monthKeys();
    h.scrollTo(before.length * MONTH_HEIGHT - VIEWPORT_HEIGHT);
    h.fixture.detectChanges();
    await h.fixture.whenStable();

    expect(h.monthKeys().length).toBeGreaterThan(before.length);
    expect(h.monthKeys().at(-1)).toBe('2026-9');
    expect(h.monthKeys()[0]).toBe(before[0]);
  });

  it('extends the window and compensates the offset at the leading edge', async () => {
    h.scrollTo(1);
    h.fixture.detectChanges();
    await h.fixture.whenStable();

    expect(h.monthKeys()[0]).toBe('2026-1');
    // Two months were prepended, so holding the visible month still means
    // pushing the offset down by their height.
    expect(h.scrollTop()).toBe(1 + 2 * MONTH_HEIGHT);
  });

  it('never extends past the month containing min', async () => {
    h.host.min.set(new Date(2026, 2, 10));
    h.fixture.detectChanges();
    await h.fixture.whenStable();
    // `min` only stops further growth; it does not widen a window that already
    // starts after it.
    expect(h.monthKeys()[0]).toBe('2026-3');

    h.scrollTo(1);
    h.fixture.detectChanges();
    await h.fixture.whenStable();
    expect(h.monthKeys()[0]).toBe('2026-2');

    const bounded = h.monthKeys();
    h.scrollTo(1);
    h.fixture.detectChanges();
    await h.fixture.whenStable();

    expect(h.monthKeys()).toEqual(bounded);
  });

  it('never extends past the month containing max', async () => {
    h.host.max.set(new Date(2026, 6, 10));
    h.fixture.detectChanges();
    await h.fixture.whenStable();
    expect(h.monthKeys().at(-1)).toBe('2026-6');

    h.scrollTo(h.monthKeys().length * MONTH_HEIGHT);
    h.fixture.detectChanges();
    await h.fixture.whenStable();

    expect(h.monthKeys().at(-1)).toBe('2026-6');
  });

  it('stops extending once the window reaches maxMonths', async () => {
    // `min` / `max` are the only other bound, and both are optional — an
    // unrestricted picker would otherwise accumulate months for as long as the
    // user keeps reaching an edge, rebuilding every existing month on each
    // growth. Long-distance navigation is the year strip's job, which reseeds
    // the window rather than extending it.
    h.host.maxMonths.set(7);
    h.fixture.detectChanges();
    await h.fixture.whenStable();

    for (let i = 0; i < 5; i++) {
      h.scrollTo(h.monthKeys().length * MONTH_HEIGHT - VIEWPORT_HEIGHT);
      h.fixture.detectChanges();
      await h.fixture.whenStable();
    }

    expect(h.monthKeys().length).toBe(7);
  });

  it('does not extend the window while its own scroll is in flight', async () => {
    // A scrub reseeds the window centred on the target, so nothing needs to
    // grow while the smooth scroll runs. Growing anyway would write `scrollTop`
    // directly to compensate a prepend, which cancels the in-flight smooth
    // scroll and strands the list away from the year the strip now shows.
    yearOption(h, 2027).click();
    h.fixture.detectChanges();
    await h.fixture.whenStable();

    const seeded = h.monthKeys();

    // The animation passes near the leading edge on its way to the target.
    h.scrollTo(1);
    h.fixture.detectChanges();
    await h.fixture.whenStable();

    expect(h.monthKeys()).toEqual(seeded);
  });

  it('grows by one chunk per edge, not once per scroll event', async () => {
    // A fling fires many `scroll` events before the prepended months render, so
    // every one of them still reads the pre-growth `scrollHeight`. Without a
    // guard each event grows the window again and a single fling adds several
    // chunks at once.
    const before = h.monthKeys().length;

    h.scrollTo(before * MONTH_HEIGHT - VIEWPORT_HEIGHT);
    h.emitScroll();
    h.emitScroll();
    h.fixture.detectChanges();
    await h.fixture.whenStable();

    expect(h.monthKeys().length).toBe(before + 2);
  });

  it('scrolls the caret’s cell into view when the keyboard leaves the viewport', async () => {
    // Movement is continuous across month boundaries, so the caret can walk
    // clean out of the visible window. Without this the roving tab stop would
    // be focused on a cell nobody can see, and the list would sit where the
    // last scroll left it.
    expect(h.scrollTop()).toBe(0);

    h.press('PageDown');
    h.press('PageDown');
    await h.fixture.whenStable();

    expect(h.scrollTop()).toBeGreaterThan(0);
  });

  it('leaves the offset alone when the caret is already in view', async () => {
    // June is the third section, so its cells sit at 600 + 100. Parked there,
    // a one-day move stays inside the viewport and must not jog the list.
    h.scrollTo(700);
    h.fixture.detectChanges();
    await h.fixture.whenStable();

    h.press('ArrowRight');
    await h.fixture.whenStable();

    expect(h.scrollTop()).toBe(700);
  });

  it('asks for a smooth scroll when a year is scrubbed', async () => {
    h.scrollRequests.length = 0;
    yearOption(h, 2027).click();
    h.fixture.detectChanges();
    await h.fixture.whenStable();

    expect(h.scrollRequests.at(-1)?.behavior).toBe('smooth');
  });

  it('asks for an instant scroll under prefers-reduced-motion', async () => {
    // Per CSSOM-View an explicit `behavior` passed to `scrollTo()` overrides
    // the computed `scroll-behavior`, so the stylesheet's reduced-motion rule
    // cannot stop this animation on its own — the component has to resolve the
    // preference itself.
    const original = window.matchMedia;
    window.matchMedia = ((query: string) =>
      ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList) as typeof window.matchMedia;

    try {
      h.scrollRequests.length = 0;
      yearOption(h, 2027).click();
      h.fixture.detectChanges();
      await h.fixture.whenStable();

      expect(h.scrollRequests.at(-1)?.behavior).toBe('instant');
    } finally {
      window.matchMedia = original;
    }
  });

  it('bounds the year strip by min and max when they are set', async () => {
    h.host.min.set(new Date(2025, 0, 1));
    h.host.max.set(new Date(2027, 11, 31));
    h.fixture.detectChanges();
    await h.fixture.whenStable();

    const years = Array.from(
      h.root.querySelectorAll<HTMLElement>('.mlv-scrubber__item'),
      (el) => Number(el.textContent?.trim()),
    );

    expect(years).toEqual([2025, 2026, 2027]);
  });
});
