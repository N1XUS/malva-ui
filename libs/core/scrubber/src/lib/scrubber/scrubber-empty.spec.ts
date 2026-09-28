import { Component, signal } from '@angular/core';
import {
  ComponentFixtureAutoDetect,
  TestBed,
  type ComponentFixture,
} from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvScrubber } from './scrubber';

/**
 * A `null` `selectedValue` means **no selection** (#348).
 *
 * `mlv-time-picker` renders an empty value as empty drums, so the strip has to
 * be able to hold nothing. Two things make `null` more than "an item that is
 * not in the list": the strip must not scroll programmatically when the
 * selection goes away — a scroll-driven read-back would select whatever the
 * drum lands on, 150ms later, with no user input — and activating an item must
 * emit it even when it is the one aria already has active.
 */

/** Stubbed rendered block extent of one item; jsdom has no layout. */
const ITEM_PX = 36;

/** Debounce the scrubber applies before reading the scroll position back. */
const SCROLL_DEBOUNCE_MS = 150;

@Component({
  imports: [MlvScrubber],
  template: `
    <mlv-scrubber
      label="Minutes"
      [items]="items"
      [selectedValue]="selected()"
      (valueChange)="onValueChange($event)"
    />
  `,
})
class EmptyHost {
  readonly items = [0, 1, 2, 3, 4, 5, 6, 7];
  readonly selected = signal<number | null>(null);
  readonly emitted = signal<number[]>([]);

  onValueChange(value: number): void {
    this.emitted.update((all) => [...all, value]);
    this.selected.set(value);
  }
}

interface ScrollToCall {
  readonly top?: number;
  readonly behavior?: ScrollBehavior;
}

interface Harness {
  fixture: ComponentFixture<EmptyHost>;
  host: EmptyHost;
  root: HTMLElement;
  listEl: HTMLElement;
  scrollToCalls: ScrollToCall[];
  setScrollTop: (value: number) => void;
}

async function waitFor(predicate: () => boolean, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function createHarness(initial: number | null): Promise<Harness> {
  TestBed.configureTestingModule({
    providers: [{ provide: ComponentFixtureAutoDetect, useValue: true }],
  });

  const fixture = TestBed.createComponent(EmptyHost);
  fixture.componentInstance.selected.set(initial);
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
      get: () => ITEM_PX,
      configurable: true,
    });
  }

  let scrollTop = 0;
  Object.defineProperty(listEl, 'scrollTop', {
    get: () => scrollTop,
    set: (value: number) => void (scrollTop = value),
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
    root,
    listEl,
    scrollToCalls,
    setScrollTop: (value) => void (scrollTop = value),
  };
}

function selectedOptions(root: HTMLElement): string[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>('[role="option"][aria-selected="true"]'),
  ).map((el) => el.textContent?.trim() ?? '');
}

describe('MlvScrubber — null selection (#348)', () => {
  let h: Harness;

  afterEach(() => {
    if (!h.fixture.componentRef.hostView.destroyed) h.fixture.destroy();
  });

  describe('rendered empty', () => {
    beforeEach(async () => {
      h = await createHarness(null);
    });

    it('marks no option selected, and selects none on its own', () => {
      // aria's default-state pass selects the first item of an empty
      // `'follow'` listbox until it is focused — which would emit it.
      expect(h.host.emitted()).toEqual([]);
      expect(selectedOptions(h.root)).toEqual([]);
      expect(
        h.root.querySelectorAll('.mlv-scrubber__item--selected'),
      ).toHaveLength(0);
    });

    it('still gives the listbox an active descendant to navigate from', () => {
      const active = h.listEl.getAttribute('aria-activedescendant');
      const options = Array.from(
        h.root.querySelectorAll<HTMLElement>('[role="option"]'),
      );
      expect(options.findIndex((el) => el.id === active)).toBe(0);
    });

    it('emits the active item when it is activated', async () => {
      // Home lands on index 0 — the item aria already has active. With a
      // value this would be a no-op echo; with none it is a choice. Focus
      // first, as a keyboard user has: focus is what turns Arrow / Home into
      // selecting keys (`_selectionMode`).
      h.listEl.focus();
      await h.fixture.whenStable();
      expect(h.host.emitted()).toEqual([]);
      h.listEl.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Home', bubbles: true }),
      );
      await h.fixture.whenStable();
      expect(h.host.emitted()).toEqual([0]);
      expect(selectedOptions(h.root)).toEqual(['0']);
    });

    it('emits a clicked option, including the resting one', async () => {
      const first = h.root.querySelector<HTMLElement>('[role="option"]');
      first?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await h.fixture.whenStable();
      expect(h.host.emitted()).toEqual([0]);
      expect(selectedOptions(h.root)).toEqual(['0']);
    });

    it('emits the item a user scroll settles on', async () => {
      h.setScrollTop(3 * ITEM_PX);
      h.listEl.dispatchEvent(new Event('scroll'));
      await waitFor(() => h.host.emitted().length > 0);
      await h.fixture.whenStable();
      expect(h.host.emitted()).toEqual([3]);
    });

    it('scrolls to a value that arrives later', async () => {
      h.host.selected.set(5);
      await h.fixture.whenStable();
      expect(h.scrollToCalls.at(-1)?.top).toBe(5 * ITEM_PX);
      expect(selectedOptions(h.root)).toEqual(['5']);
    });

    it('has no axe violations', async () => {
      await expectNoAxeViolations(h.root);
    });
  });

  describe('selection removed', () => {
    beforeEach(async () => {
      h = await createHarness(4);
      h.setScrollTop(4 * ITEM_PX);
    });

    it('clears aria-selected and the selected modifier', async () => {
      expect(selectedOptions(h.root)).toEqual(['4']);
      h.host.selected.set(null);
      await h.fixture.whenStable();
      expect(selectedOptions(h.root)).toEqual([]);
      expect(
        h.root.querySelectorAll('.mlv-scrubber__item--selected'),
      ).toHaveLength(0);
    });

    it('leaves the strip where it is instead of scrolling it back to the start', async () => {
      // A programmatic scroll would come back through the debounced read-back
      // and select the item it lands on — a value nobody chose.
      const before = h.scrollToCalls.length;
      h.host.selected.set(null);
      await h.fixture.whenStable();
      await new Promise((resolve) =>
        setTimeout(resolve, SCROLL_DEBOUNCE_MS * 3),
      );
      expect(h.scrollToCalls.slice(before)).toEqual([]);
      expect(h.listEl.scrollTop).toBe(4 * ITEM_PX);
      expect(h.host.emitted()).toEqual([]);
    });

    it('drops a scroll read-back still pending when the selection goes away', async () => {
      // A flick, then a form reset inside the 150ms debounce: the read-back
      // scheduled by the flick must not commit the landed item after the
      // reset emptied the strip.
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      try {
        h.setScrollTop(6 * ITEM_PX);
        h.listEl.dispatchEvent(new Event('scroll'));
        h.host.selected.set(null);
        h.fixture.detectChanges();
        vi.advanceTimersByTime(SCROLL_DEBOUNCE_MS * 3);
      } finally {
        vi.useRealTimers();
      }
      await h.fixture.whenStable();
      expect(h.host.emitted()).toEqual([]);
      expect(selectedOptions(h.root)).toEqual([]);
    });
  });
});
