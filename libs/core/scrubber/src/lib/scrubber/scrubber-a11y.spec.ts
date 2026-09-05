import {
  Component,
  signal,
  viewChild,
  viewChildren,
  type AfterViewInit,
} from '@angular/core';
import {
  ComponentFixtureAutoDetect,
  TestBed,
  type ComponentFixture,
} from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MlvScrubber } from './scrubber';

/**
 * The guarantees the primitive owns on its own account, each of which used to be
 * covered only by `mlv-time-picker` — the consumer #129 is moving away from.
 *
 * 1. **Unique option ids across instances.** Before the extraction the ids were
 *    `tp-col-item-<labelKey>-<value>` and got uniqueness from the label key for
 *    free. A generic `T` cannot serve as an id, so it now comes from a
 *    per-instance prefix, and `@angular/aria` only validates ids *within* one
 *    listbox — three sibling strips colliding is invisible to it.
 * 2. **The seeded active descendant.** aria's `setDefaultState` is skipped once
 *    the listbox has been interacted with, and a `focusin` counts.
 * 3. **Reduced motion.** `mixins.reduced-motion` emits `scroll-behavior: auto`,
 *    which an explicit `behavior` passed to `scrollTo()` overrides.
 */

const ITEMS = [0, 1, 2, 3, 4, 5];

@Component({
  imports: [MlvScrubber],
  template: `
    <mlv-scrubber label="Hours" [items]="items" [selectedValue]="hour()" />
    <mlv-scrubber label="Minutes" [items]="items" [selectedValue]="minute()" />
    <mlv-scrubber label="Seconds" [items]="items" [selectedValue]="second()" />
  `,
})
class ThreeStripHost {
  readonly strips = viewChildren(MlvScrubber);
  readonly items = ITEMS;
  readonly hour = signal(0);
  readonly minute = signal(2);
  readonly second = signal(4);
}

/**
 * Focuses the strip from the host's **own** `ngAfterViewInit` — mid change
 * detection, before aria's `setDefaultStateEffect` has flushed. That is what
 * `mlv-time-picker` does through the popup's open handler, and it is the only
 * ordering in which the seed is load-bearing: with it ablated, this host lands
 * on `aria-activedescendant` unset and the first ArrowDown navigating from
 * index −1 to 0.
 */
@Component({
  imports: [MlvScrubber],
  template: `
    <mlv-scrubber label="Hours" [items]="items" [selectedValue]="selected()" />
  `,
})
class FocusOnInitHost implements AfterViewInit {
  readonly strip = viewChild.required(MlvScrubber);
  readonly items = ITEMS;
  readonly selected = signal(3);

  ngAfterViewInit(): void {
    this.strip().focusList();
  }
}

@Component({
  imports: [MlvScrubber],
  template: `
    <mlv-scrubber label="Hours" [items]="items" [selectedValue]="selected()" />
  `,
})
class SingleStripHost {
  readonly items = ITEMS;
  readonly selected = signal(0);
}

function listboxes(fixture: ComponentFixture<unknown>): HTMLElement[] {
  return Array.from(
    (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
      '[role="listbox"]',
    ),
  );
}

function options(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[role="option"]'));
}

function activeIndex(list: HTMLElement): number {
  const active = list.getAttribute('aria-activedescendant');
  return options(list).findIndex((el) => el.id === active);
}

// ---------------------------------------------------------------------------
// 1. Option-id uniqueness
// ---------------------------------------------------------------------------

describe('MlvScrubber — option ids are unique across instances', () => {
  let fixture: ComponentFixture<ThreeStripHost>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [{ provide: ComponentFixtureAutoDetect, useValue: true }],
    });
    fixture = TestBed.createComponent(ThreeStripHost);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => fixture.destroy());

  it('gives three sibling strips three disjoint id spaces', () => {
    const ids = options(fixture.nativeElement as HTMLElement).map(
      (el) => el.id,
    );
    expect(ids).toHaveLength(3 * ITEMS.length);
    expect(ids.every((id) => id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('resolves each aria-activedescendant inside its own listbox', () => {
    // The consequence a duplicate id has for a screen reader, rather than the
    // id string itself: `getElementById` returns the *first* match in the
    // document, so with a shared prefix every strip's active descendant would
    // resolve into the hours column and all three would announce the same row.
    const lists = listboxes(fixture);
    expect(lists).toHaveLength(3);

    for (const list of lists) {
      const active = list.getAttribute('aria-activedescendant');
      expect(active, 'no active descendant was seeded').toBeTruthy();
      const target = document.getElementById(active as string);
      expect(target, `\`${active}\` resolves to nothing`).not.toBeNull();
      expect(
        list.contains(target),
        `\`${active}\` resolves outside its own listbox`,
      ).toBe(true);
    }
  });

  it('points each strip at its own selected value', () => {
    const lists = listboxes(fixture);
    expect(lists.map(activeIndex)).toEqual([0, 2, 4]);
  });
});

// ---------------------------------------------------------------------------
// 2. The seeded active descendant
// ---------------------------------------------------------------------------

describe('MlvScrubber — seeds aria’s active item past a focus on open', () => {
  let fixture: ComponentFixture<FocusOnInitHost>;
  let list: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [{ provide: ComponentFixtureAutoDetect, useValue: true }],
    });
    fixture = TestBed.createComponent(FocusOnInitHost);
    fixture.detectChanges();
    await fixture.whenStable();
    list = listboxes(fixture)[0];
  });

  afterEach(() => fixture.destroy());

  it('starts on the selected value, not on nothing', () => {
    expect(activeIndex(list)).toBe(3);
  });

  it('navigates from the selected value on the first arrow key', async () => {
    // The user-visible shape of the bug: `mlv-time-picker` opened on 10:00 and
    // one ArrowDown produced 01, not 11.
    list.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    await fixture.whenStable();

    expect(activeIndex(list)).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// 3. Reduced motion
// ---------------------------------------------------------------------------

describe('MlvScrubber — reduced motion', () => {
  let restoreMatchMedia: (() => void) | undefined;
  let behaviors: (ScrollBehavior | undefined)[];

  /**
   * Installs a `matchMedia` reporting `prefers-reduced-motion` as `reduce` or
   * `no-preference`. This project ships no stub of its own, so the "motion is
   * fine" case has to be installed too rather than left to the default —
   * without any `matchMedia` at all the component's SSR guard short-circuits
   * and the control case would pass for the wrong reason.
   */
  function stubMatchMedia(reduced: boolean): void {
    const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query: string): MediaQueryList =>
        ({
          matches: /prefers-reduced-motion: reduce/.test(query) && reduced,
          media: query,
          onchange: null,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          addListener: () => undefined,
          removeListener: () => undefined,
          dispatchEvent: () => false,
        }) as unknown as MediaQueryList,
    });
    restoreMatchMedia = () => {
      if (original) Object.defineProperty(window, 'matchMedia', original);
      else delete (window as { matchMedia?: unknown }).matchMedia;
    };
  }

  async function scrollTo(
    value: number,
  ): Promise<ComponentFixture<SingleStripHost>> {
    TestBed.configureTestingModule({
      providers: [{ provide: ComponentFixtureAutoDetect, useValue: true }],
    });
    const fixture = TestBed.createComponent(SingleStripHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const listEl = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLElement>('.mlv-scrubber__list') as HTMLElement & {
      scrollTo: (options: ScrollToOptions) => void;
    };
    listEl.scrollTo = (options: ScrollToOptions) =>
      void behaviors.push(options.behavior);

    fixture.componentInstance.selected.set(value);
    await fixture.whenStable();
    return fixture;
  }

  beforeEach(() => {
    behaviors = [];
  });

  afterEach(() => restoreMatchMedia?.());

  it('animates a value change when motion is welcome', async () => {
    stubMatchMedia(false);
    const fixture = await scrollTo(3);
    expect(behaviors.at(-1)).toBe('smooth');
    fixture.destroy();
  });

  it('jumps instead of animating under prefers-reduced-motion', async () => {
    // `@include mixins.reduced-motion($block)` emits
    // `scroll-behavior: auto !important` on the strip, but per CSSOM-View an
    // explicit `behavior` argument **overrides** the computed property — the
    // property is only consulted for `behavior: 'auto'`. So the stylesheet
    // alone leaves a reduced-motion user with a fully animated drum, and the
    // media query has to be resolved at the call site.
    stubMatchMedia(true);
    const fixture = await scrollTo(3);
    expect(behaviors.at(-1)).toBe('instant');
    fixture.destroy();
  });
});
