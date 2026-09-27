import { Component, signal } from '@angular/core';
import {
  ComponentFixtureAutoDetect,
  TestBed,
  type ComponentFixture,
} from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { MlvScrubber } from './scrubber';

/**
 * Direction specs for the scrubber.
 *
 * The vertical drum this was extracted from never needed any of these: the
 * block axis does not mirror. A **horizontal** strip is on the inline axis, so
 * every physical quantity it touches has to be converted once at the boundary —
 * `scrollLeft` is physical (0 at the inline-start edge and **negative** toward
 * the end under `dir="rtl"`, per CSSOM-View), while the CSS that positions the
 * stripe and the snap port is logical and mirrors on its own.
 */

/**
 * Stubbed rendered extents of one item; jsdom has no layout.
 *
 * The two are **deliberately different**. One shared constant behind both
 * `offsetWidth` and `offsetHeight` makes the axis branch in `_itemSize()`
 * unobservable: measuring a horizontal strip along the block axis reads the
 * same number, and every assertion in this file still passes. With 80 x 36, a
 * strip that measured the wrong axis divides a `scrollLeft` of 320 by 36 and
 * selects index 9 instead of 4, and scrolls to 108px instead of 240px —
 * parking the strip between items with the centre stripe over nothing.
 */
const ITEM_INLINE_PX = 80;
const ITEM_BLOCK_PX = 36;

/** Debounce the scrubber applies before reading the scroll position back. */
const SCROLL_DEBOUNCE_MS = 150;

const ITEMS = [0, 1, 2, 3, 4, 5, 6, 7];

@Component({
  imports: [MlvScrubber],
  template: `
    <div [attr.dir]="scopeDir()">
      <mlv-scrubber
        label="Year"
        [items]="items"
        [selectedValue]="selected()"
        [orientation]="orientation()"
        (valueChange)="onValueChange($event)"
      />
    </div>
  `,
})
class DirectionHost {
  readonly items = ITEMS;
  readonly selected = signal(0);
  readonly orientation = signal<'vertical' | 'horizontal'>('horizontal');
  readonly scopeDir = signal<string | null>(null);
  readonly emitted = signal<number[]>([]);

  onValueChange(value: number): void {
    this.emitted.update((all) => [...all, value]);
    this.selected.set(value);
  }
}

interface ScrollToCall {
  readonly top?: number;
  readonly left?: number;
  readonly behavior?: ScrollBehavior;
}

interface Harness {
  fixture: ComponentFixture<DirectionHost>;
  host: DirectionHost;
  listEl: HTMLElement;
  /** Every `scrollTo` the component issued, oldest first. */
  scrollToCalls: ScrollToCall[];
  setScroll: (axis: 'top' | 'left', value: number) => void;
  scroll: () => void;
}

async function waitFor(predicate: () => boolean, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

const settleDebounce = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, SCROLL_DEBOUNCE_MS * 3));

async function createHarness(): Promise<Harness> {
  TestBed.configureTestingModule({
    providers: [{ provide: ComponentFixtureAutoDetect, useValue: true }],
  });

  const fixture = TestBed.createComponent(DirectionHost);
  fixture.detectChanges();
  await fixture.whenStable();

  const root: HTMLElement = fixture.nativeElement;
  const listEl = root.querySelector<HTMLElement>(
    '.mlv-scrubber__list',
  ) as HTMLElement;

  for (const item of Array.from(
    root.querySelectorAll<HTMLElement>('.mlv-scrubber__item'),
  )) {
    Object.defineProperty(item, 'offsetHeight', {
      get: () => ITEM_BLOCK_PX,
      configurable: true,
    });
    Object.defineProperty(item, 'offsetWidth', {
      get: () => ITEM_INLINE_PX,
      configurable: true,
    });
  }

  let scrollTop = 0;
  let scrollLeft = 0;
  Object.defineProperty(listEl, 'scrollTop', {
    get: () => scrollTop,
    set: (value: number) => void (scrollTop = value),
    configurable: true,
  });
  Object.defineProperty(listEl, 'scrollLeft', {
    get: () => scrollLeft,
    set: (value: number) => void (scrollLeft = value),
    configurable: true,
  });

  const scrollToCalls: ScrollToCall[] = [];
  (listEl as HTMLElement & { scrollTo: (o: ScrollToCall) => void }).scrollTo = (
    options: ScrollToCall,
  ) => {
    scrollToCalls.push(options);
  };

  return {
    fixture,
    host: fixture.componentInstance,
    listEl,
    scrollToCalls,
    setScroll: (axis, value) => {
      if (axis === 'top') scrollTop = value;
      else scrollLeft = value;
    },
    scroll: () => listEl.dispatchEvent(new Event('scroll')),
  };
}

describe('MlvScrubber — horizontal scroll maths', () => {
  let h: Harness;
  let rtl: MlvRtlService;

  beforeEach(async () => {
    h = await createHarness();
    rtl = TestBed.inject(MlvRtlService);
  });

  afterEach(() => {
    rtl.setDirection('ltr');
    if (!h.fixture.componentRef.hostView.destroyed) h.fixture.destroy();
  });

  it('reads scrollLeft, not scrollTop, when horizontal', async () => {
    // The vertical original read `scrollTop` unconditionally. A horizontal
    // strip that kept doing so never changes value however far it is scrolled.
    h.setScroll('left', 4 * ITEM_INLINE_PX);
    h.scroll();

    await waitFor(() => h.host.emitted().length > 0);
    await h.fixture.whenStable();

    expect(h.host.emitted()).toEqual([4]);
  });

  it('measures the item along the scroll axis, not the cross axis', async () => {
    // The axis branch in `_itemSize()`. Items here are 80 wide and 36 tall, so
    // a strip that measured `offsetHeight` would divide this offset by 36,
    // round to 9 and clamp to the last item — and `_scrollToIndex` would write
    // 108px where 240px is wanted, parking the strip between two items with
    // the centre stripe over nothing. This is the axis the whole extraction
    // exists for, so it gets its own name.
    h.setScroll('left', 3 * ITEM_INLINE_PX);
    h.scroll();

    await waitFor(() => h.host.emitted().length > 0);
    await h.fixture.whenStable();

    expect(h.host.emitted()).toEqual([3]);
    expect(Math.round((3 * ITEM_INLINE_PX) / ITEM_BLOCK_PX)).not.toBe(3);
  });

  it('maps a negative RTL scrollLeft onto the same logical index', async () => {
    // Per CSSOM-View, an RTL scroller's `scrollLeft` is 0 at the inline-start
    // (right) edge and goes negative toward the end. Read raw, index 4 would
    // come out as -4 and clamp to 0 — i.e. the strip would appear stuck on the
    // first item however far the user scrolled.
    rtl.setDirection('rtl');
    await h.fixture.whenStable();

    h.setScroll('left', -(4 * ITEM_INLINE_PX));
    h.scroll();

    await waitFor(() => h.host.emitted().length > 0);
    await h.fixture.whenStable();

    expect(h.host.emitted()).toEqual([4]);
  });

  it('follows a [dir] scope on an ancestor while the document stays LTR', async () => {
    h.host.scopeDir.set('rtl');
    await h.fixture.whenStable();
    expect(rtl.direction()).toBe('ltr');

    h.setScroll('left', -(3 * ITEM_INLINE_PX));
    h.scroll();

    await waitFor(() => h.host.emitted().length > 0);
    await h.fixture.whenStable();

    expect(h.host.emitted()).toEqual([3]);
  });

  it('keeps reading scrollTop when vertical, in either direction', async () => {
    h.host.orientation.set('vertical');
    rtl.setDirection('rtl');
    await h.fixture.whenStable();

    h.setScroll('left', -(5 * ITEM_INLINE_PX));
    h.setScroll('top', 2 * ITEM_BLOCK_PX);
    h.scroll();

    await waitFor(() => h.host.emitted().length > 0);
    await h.fixture.whenStable();

    // The block axis never mirrors, and a vertical strip must ignore the
    // inline-axis offset entirely.
    expect(h.host.emitted()).toEqual([2]);
  });
});

describe('MlvScrubber — programmatic scroll', () => {
  let h: Harness;
  let rtl: MlvRtlService;

  beforeEach(async () => {
    h = await createHarness();
    rtl = TestBed.inject(MlvRtlService);
  });

  afterEach(() => {
    rtl.setDirection('ltr');
    if (!h.fixture.componentRef.hostView.destroyed) h.fixture.destroy();
  });

  it('scrolls along the inline axis when horizontal', async () => {
    h.scrollToCalls.length = 0;
    h.host.selected.set(3);
    await h.fixture.whenStable();

    const last = h.scrollToCalls.at(-1);
    expect(last?.left).toBe(3 * ITEM_INLINE_PX);
    expect(last?.top).toBeUndefined();
  });

  it('negates the offset in RTL so the target lands on the stripe', async () => {
    rtl.setDirection('rtl');
    await h.fixture.whenStable();

    h.scrollToCalls.length = 0;
    h.host.selected.set(3);
    await h.fixture.whenStable();

    const last = h.scrollToCalls.at(-1);
    expect(last?.left).toBe(-(3 * ITEM_INLINE_PX));
  });

  it('re-aligns the scroll offset when the direction flips underneath it', async () => {
    // Mirroring moves the content without resizing it, so no ResizeObserver
    // fires and no query changes — nothing else would tell the strip that its
    // physical offset now points at the wrong item.
    h.host.selected.set(2);
    await h.fixture.whenStable();

    h.scrollToCalls.length = 0;
    rtl.setDirection('rtl');
    await h.fixture.whenStable();

    const last = h.scrollToCalls.at(-1);
    expect(last?.left).toBe(-(2 * ITEM_INLINE_PX));
  });

  it('still scrolls along the block axis when vertical', async () => {
    h.host.orientation.set('vertical');
    await h.fixture.whenStable();

    h.scrollToCalls.length = 0;
    h.host.selected.set(3);
    await h.fixture.whenStable();

    const last = h.scrollToCalls.at(-1);
    expect(last?.top).toBe(3 * ITEM_BLOCK_PX);
    expect(last?.left).toBeUndefined();
  });
});

describe('MlvScrubber — horizontal arrow keys', () => {
  let h: Harness;
  let rtl: MlvRtlService;

  /** Index of the option `aria-activedescendant` currently points at. */
  function activeIndex(): number {
    const active = h.listEl.getAttribute('aria-activedescendant');
    return Array.from(
      h.listEl.querySelectorAll<HTMLElement>('[role="option"]'),
    ).findIndex((el) => el.id === active);
  }

  function press(key: string): void {
    h.listEl.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true }),
    );
  }

  beforeEach(async () => {
    h = await createHarness();
    rtl = TestBed.inject(MlvRtlService);
    h.host.selected.set(3);
    await h.fixture.whenStable();
  });

  afterEach(() => {
    rtl.setDirection('ltr');
    if (!h.fixture.componentRef.hostView.destroyed) h.fixture.destroy();
  });

  it('moves next on ArrowRight in LTR', async () => {
    press('ArrowRight');
    await h.fixture.whenStable();
    expect(activeIndex()).toBe(4);
  });

  it('mirrors the horizontal pair under a global RTL direction', async () => {
    // Not evidence for the scoped `Directionality` provider: `MlvRtlService`
    // writes the document `dir` and syncs the *root* CDK `Directionality` here,
    // so aria reads `'rtl'` either way and this passes with the provider
    // removed. The scoped-`[dir]` case below is the only one that proves it.
    rtl.setDirection('rtl');
    await h.fixture.whenStable();

    press('ArrowLeft');
    await h.fixture.whenStable();
    expect(activeIndex()).toBe(4);
  });

  it('mirrors the horizontal pair under a scoped [dir="rtl"] ancestor', async () => {
    // A CDK `Directionality` injected from the root reports the *document*
    // direction, so without a scope-aware one the strip's keyboard and its
    // scroll maths disagree the moment a `[dir]` wrapper is the only thing that
    // is RTL. **This is the one spec that pins the provider**: ablate
    // `providers: [provideMlvScopedDirectionality()]` and this
    // fails alone (`expected 2 to be 4` — ArrowLeft moved to the previous item
    // because aria still thought the page was LTR), while every other spec in
    // this file, the global-RTL case above included, stays green.
    h.host.scopeDir.set('rtl');
    await h.fixture.whenStable();
    expect(rtl.direction()).toBe('ltr');

    press('ArrowLeft');
    await h.fixture.whenStable();
    expect(activeIndex()).toBe(4);
  });

  it('leaves the vertical pair alone in RTL', async () => {
    h.host.orientation.set('vertical');
    rtl.setDirection('rtl');
    await h.fixture.whenStable();

    press('ArrowDown');
    await h.fixture.whenStable();
    expect(activeIndex()).toBe(4);
  });
});

describe('MlvScrubber — direction teardown', () => {
  it('leaves the document direction as it found it', async () => {
    const h = await createHarness();
    const rtl = TestBed.inject(MlvRtlService);
    rtl.setDirection('rtl');
    expect(document.documentElement.dir).toBe('rtl');
    rtl.setDirection('ltr');
    await settleDebounce();
    h.fixture.destroy();
    expect(document.documentElement.dir).toBe('ltr');
  });
});
