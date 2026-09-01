import { Component, afterEveryRender, signal, viewChild } from '@angular/core';
import {
  ComponentFixtureAutoDetect,
  TestBed,
  type ComponentFixture,
} from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MlvTimePickerColumn } from './time-picker-column';

/**
 * Specs for the drum-roll column's scroll listener, which is registered
 * imperatively (`addEventListener`, `{ passive: true }`, torn down from
 * `DestroyRef`) rather than through a `(scroll)` binding in the template.
 *
 * Every one of these dispatches a **native** scroll event at the `<ul>` that
 * really scrolls, so the wiring is under test and not just `_onScroll`'s body.
 */

/** Rendered height of one drum-roll item; jsdom has no layout, so it is stubbed. */
const ITEM_HEIGHT_PX = 36;

/** Debounce the column applies before reading the scroll position back. */
const SCROLL_DEBOUNCE_MS = 150;

const ITEMS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

@Component({
  imports: [MlvTimePickerColumn],
  template: `
    <mlv-time-picker-column
      label="Hours"
      [items]="items()"
      [selectedValue]="selected()"
      [disabled]="disabled()"
      (valueChange)="onValueChange($event)"
    />
  `,
})
class ColumnHost {
  readonly column = viewChild.required(MlvTimePickerColumn);
  readonly items = signal<number[]>(ITEMS);
  readonly selected = signal(0);
  readonly disabled = signal(false);
  readonly emitted = signal<number[]>([]);

  /** Incremented once per real change-detection pass. */
  renders = 0;

  constructor() {
    afterEveryRender(() => {
      this.renders++;
    });
  }

  onValueChange(value: number): void {
    this.emitted.update((all) => [...all, value]);
    this.selected.set(value);
  }
}

interface Harness {
  fixture: ComponentFixture<ColumnHost>;
  host: ColumnHost;
  listEl: HTMLElement;
  /** Sets the stubbed scroll offset without going through layout. */
  setScrollTop: (value: number) => void;
  /** Dispatches a native scroll event at the `<ul>`. */
  scroll: () => void;
}

/**
 * Fixed wait, comfortably past the debounce, for asserting that nothing
 * happened. Only used where the expected outcome is "no effect".
 */
const settleDebounce = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, SCROLL_DEBOUNCE_MS * 3));

/**
 * Polls for an expected outcome instead of sleeping a fixed span, so a loaded
 * machine cannot turn the 150 ms debounce into a flake.
 */
async function waitFor(
  predicate: () => boolean,
  timeoutMs = 4000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function createHarness(): Promise<Harness> {
  TestBed.configureTestingModule({
    providers: [{ provide: ComponentFixtureAutoDetect, useValue: true }],
  });

  const fixture = TestBed.createComponent(ColumnHost);
  fixture.detectChanges();
  await fixture.whenStable();

  const root: HTMLElement = fixture.nativeElement;
  const listEl = root.querySelector<HTMLElement>(
    '.mlv-time-picker-column__list',
  ) as HTMLElement;
  expect(listEl).toBeTruthy();

  // The column measures item height from the first rendered `<li>`.
  for (const item of Array.from(
    root.querySelectorAll<HTMLElement>('.mlv-time-picker-column__item'),
  )) {
    Object.defineProperty(item, 'offsetHeight', {
      get: () => ITEM_HEIGHT_PX,
      configurable: true,
    });
  }

  let scrollTop = 0;
  Object.defineProperty(listEl, 'scrollTop', {
    get: () => scrollTop,
    set: (value: number) => {
      scrollTop = value;
    },
    configurable: true,
  });

  return {
    fixture,
    host: fixture.componentInstance,
    listEl,
    setScrollTop: (value) => {
      scrollTop = value;
    },
    scroll: () => listEl.dispatchEvent(new Event('scroll')),
  };
}

describe('MlvTimePickerColumn scroll listener', () => {
  let h: Harness;

  afterEach(() => {
    if (!h.fixture.componentRef.hostView.destroyed) {
      h.fixture.destroy();
    }
  });

  beforeEach(async () => {
    h = await createHarness();
  });

  // -------------------------------------------------------------------------
  // 1. Wiring
  // -------------------------------------------------------------------------

  it('syncs the selected value from a native scroll dispatched at the list', async () => {
    expect(h.host.emitted()).toEqual([]);

    h.setScrollTop(4 * ITEM_HEIGHT_PX);
    h.scroll();

    // Debounced: nothing may have happened yet.
    expect(h.host.emitted()).toEqual([]);

    await waitFor(() => h.host.emitted().length > 0);
    await h.fixture.whenStable();

    expect(h.host.emitted()).toEqual([4]);
    expect(h.host.selected()).toBe(4);
  });

  it('does not react to a scroll dispatched at the column host', async () => {
    const columnHost = (
      h.fixture.nativeElement as HTMLElement
    ).querySelector<HTMLElement>('mlv-time-picker-column');
    expect(columnHost).not.toBe(h.listEl);

    h.setScrollTop(4 * ITEM_HEIGHT_PX);
    // `scroll` does not bubble, so the host never sees the list's event.
    columnHost?.dispatchEvent(new Event('scroll'));

    await settleDebounce();
    await h.fixture.whenStable();

    expect(h.host.emitted()).toEqual([]);
  });

  it('ignores scroll while the column is disabled', async () => {
    h.host.disabled.set(true);
    h.fixture.detectChanges();
    await h.fixture.whenStable();

    h.setScrollTop(4 * ITEM_HEIGHT_PX);
    h.scroll();
    await settleDebounce();
    await h.fixture.whenStable();

    expect(h.host.emitted()).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // 2. Teardown
  // -------------------------------------------------------------------------

  it('stops reacting to scroll after the fixture is destroyed', async () => {
    // The handler's whole effect is arming the debounce timer, so that is what
    // is watched here. `valueChange` cannot serve: an `output()` is torn down
    // with its component, so a leaked listener would emit into the void and the
    // recorded emissions would look clean either way.
    const internals = h.host.column() as unknown as { _scrollTimer: unknown };

    h.setScrollTop(3 * ITEM_HEIGHT_PX);
    h.scroll();
    expect(internals._scrollTimer).not.toBeNull();
    await waitFor(() => h.host.emitted().length > 0);
    await h.fixture.whenStable();
    expect(h.host.emitted()).toEqual([3]);

    const armedTimer = internals._scrollTimer;
    h.fixture.destroy();

    h.setScrollTop(7 * ITEM_HEIGHT_PX);
    expect(() => h.scroll()).not.toThrow();

    // A live listener would have replaced the timer with a fresh one.
    expect(internals._scrollTimer).toBe(armedTimer);
    await settleDebounce();
    expect(h.host.emitted()).toEqual([3]);
  });

  // -------------------------------------------------------------------------
  // 3. Change-detection pass count
  // -------------------------------------------------------------------------

  it('runs no change-detection pass for a burst of scrolls', async () => {
    // The handler resets a debounce timer and nothing else — it writes no
    // reactive state, so a burst that never lets the timer elapse must produce
    // no change-detection work whatsoever.
    const SCROLLS = 20;
    const before = h.host.renders;
    for (let i = 0; i < SCROLLS; i++) {
      h.setScrollTop(i);
      h.scroll();
      await h.fixture.whenStable();
    }
    const passes = h.host.renders - before;

    // Bound: ZERO. A template `(scroll)` binding runs Angular's listener
    // wrapper, which calls `markViewDirty` and notifies the change-detection
    // scheduler unconditionally — one pass per event, 20.
    expect(passes).toBe(0);
    expect(passes).toBeLessThan(SCROLLS);
  });
});

// ---------------------------------------------------------------------------
// 4. Passive registration
// ---------------------------------------------------------------------------

describe('MlvTimePickerColumn scroll listener registration', () => {
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

  it('registers the list scroll listener as passive', async () => {
    TestBed.configureTestingModule({
      providers: [{ provide: ComponentFixtureAutoDetect, useValue: true }],
    });
    const fixture = TestBed.createComponent(ColumnHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const listEl = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLElement>('.mlv-time-picker-column__list');

    expect(scrollRegistrations).toHaveLength(1);
    expect(scrollRegistrations[0].target).toBe(listEl);
    expect(scrollRegistrations[0].options).toEqual({ passive: true });

    fixture.destroy();
  });
});
