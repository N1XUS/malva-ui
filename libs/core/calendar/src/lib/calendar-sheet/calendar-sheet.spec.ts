import { Component, signal, viewChild } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MlvCalendarSheet } from './calendar-sheet';
import type { MlvCalendarRangeValue } from '../calendar/calendar';
import { MlvNativeDateAdapter } from '@malva-ui/core/date';

@Component({
  imports: [MlvCalendarSheet],
  template: `
    <mlv-calendar-sheet
      [(value)]="value"
      [(rangeValue)]="rangeValue"
      [range]="range()"
      [min]="min()"
      [max]="max()"
      [windowMonths]="windowMonths()"
      [yearRange]="2"
    />
  `,
})
class SheetHost {
  readonly sheet = viewChild.required(MlvCalendarSheet);
  readonly value = signal<Date | null>(new Date(2026, 0, 15));
  readonly rangeValue = signal<MlvCalendarRangeValue<Date> | null>(null);
  readonly range = signal(false);
  readonly min = signal<Date | null>(null);
  readonly max = signal<Date | null>(null);
  readonly windowMonths = signal(2);
}

/**
 * Narrows a query result, failing with the selector rather than a bare
 * `TypeError` when the element is not there. Kept in place of a `!` assertion,
 * which the workspace's lint config forbids.
 */
function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`expected ${what} to be rendered`);
  }
  return value;
}

describe('MlvCalendarSheet', () => {
  let fixture: ComponentFixture<SheetHost>;
  let host: SheetHost;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SheetHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(SheetHost);
    host = fixture.componentInstance;
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  /** The `YYYY-M` keys of the month sections currently rendered, in DOM order. */
  function monthKeys(): string[] {
    return Array.from(
      root.querySelectorAll<HTMLElement>('[data-month]'),
      (el) => el.dataset['month'] as string,
    );
  }

  /** The cell wrapper for an ISO date, whether or not it holds a button. */
  function cell(iso: string): HTMLElement {
    const found = root.querySelector<HTMLElement>(`[data-date="${iso}"]`);
    if (!found) throw new Error(`No cell rendered for ${iso}`);
    return found;
  }

  /** The selectable day button for an ISO date. */
  function dayButton(iso: string): HTMLButtonElement {
    const button = cell(iso).querySelector<HTMLButtonElement>(
      '.mlv-calendar-sheet__day',
    );
    if (!button) throw new Error(`No day button rendered for ${iso}`);
    return button;
  }

  /** Dispatches a keydown on the month scroller, which owns the key handler. */
  function press(key: string): void {
    must(
      root.querySelector('.mlv-calendar-sheet__months'),
      'the month list',
    ).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    fixture.detectChanges();
  }

  /** The ISO date of the single roving tab stop. */
  function activeDate(): string | null {
    const active = root.querySelector<HTMLElement>(
      '.mlv-calendar-sheet__day[tabindex="0"]',
    );
    return active?.closest('[data-date]')?.getAttribute('data-date') ?? null;
  }

  describe('month window', () => {
    it('seeds a window of windowMonths on each side of the selection', () => {
      expect(monthKeys()).toEqual([
        '2025-10',
        '2025-11',
        '2026-0',
        '2026-1',
        '2026-2',
      ]);
    });

    it('re-seeds around today when there is no selection', async () => {
      host.value.set(null);
      fixture.detectChanges();
      await fixture.whenStable();

      const today = new Date();
      expect(monthKeys()).toContain(
        `${today.getFullYear()}-${today.getMonth()}`,
      );
    });

    it('clamps the window start to the month containing min', async () => {
      host.min.set(new Date(2025, 11, 5));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(monthKeys()[0]).toBe('2025-11');
    });

    it('clamps the window end to the month containing max', async () => {
      host.max.set(new Date(2026, 1, 20));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(monthKeys().at(-1)).toBe('2026-1');
    });
  });

  describe('pending selection', () => {
    it('writes the tapped day to the two-way value model', () => {
      dayButton('2026-01-07').click();
      fixture.detectChanges();

      expect(host.value()?.toDateString()).toBe(
        new Date(2026, 0, 7).toDateString(),
      );
    });

    it('marks the selected day and only that day', () => {
      dayButton('2026-01-07').click();
      fixture.detectChanges();

      const selected = Array.from(
        root.querySelectorAll<HTMLElement>(
          '.mlv-calendar-sheet__day--selected',
        ),
      ).map((el) => el.closest('[data-date]')?.getAttribute('data-date'));

      expect(selected).toEqual(['2026-01-07']);
    });

    it('leaves a lone selection free of the endpoint markers', () => {
      // #149: a range endpoint drops the radius facing into the range so it
      // meets the band as one shape. A lone selection has no band to meet —
      // `mlv-day-picker`'s sheet renders only these — and stays a full circle
      // by carrying neither endpoint class. The corner arithmetic itself is in
      // `calendar-sheet-styles.spec.ts`; this is the half that keeps the
      // classes off the element in the first place.
      const selected = dayButton('2026-01-15');

      expect(
        selected.classList.contains('mlv-calendar-sheet__day--selected'),
      ).toBe(true);
      expect(
        Array.from(selected.classList).filter((name) =>
          name.startsWith('mlv-calendar-sheet__day--range-'),
        ),
      ).toEqual([]);
    });

    it('refuses a keyboard commit on a day outside min/max', async () => {
      // The pointer never reaches `_selectDate` here: the button carries
      // `disabled`, so the click is swallowed before the handler runs, and a
      // spec that clicks it is really testing the sibling assertion below. The
      // roving focus is the way in — `_moveActive` only refuses to leave the
      // *months* `min`/`max` allow, so ArrowUp lands the tab stop on the 8th,
      // inside January but before `min`. `_selectDate`'s own guard is then the
      // only thing between a disabled day and the model.
      host.min.set(new Date(2026, 0, 10));
      fixture.detectChanges();
      await fixture.whenStable();

      press('ArrowUp');
      press('Enter');

      expect(activeDate()).toBe('2026-01-08');
      expect(host.value()?.toDateString()).toBe(
        new Date(2026, 0, 15).toDateString(),
      );
    });

    it('disables day buttons outside min/max', async () => {
      host.min.set(new Date(2026, 0, 10));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(dayButton('2026-01-07').disabled).toBe(true);
      expect(dayButton('2026-01-10').disabled).toBe(false);
    });

    it('gives the month list a role that carries its label', async () => {
      // `aria-label` on a generic element is not exposed: ARIA does not support
      // naming the `generic` role, so the label is dropped and the scroller is
      // announced as nothing. `group` is what the anchored calendar wraps its
      // own grid in.
      const list = root.querySelector('.mlv-calendar-sheet__months');
      expect(list?.getAttribute('role')).toBe('group');
      expect(list?.getAttribute('aria-label')).toBeTruthy();
    });

    it('mirrors the disabled state into aria-disabled', async () => {
      // `.claude/rules/accessibility.md`: a native control carries both, the
      // way `mlv-calendar`'s own day button does. The native attribute alone
      // leaves assistive tech that reads the ARIA state announcing the day as
      // available.
      host.min.set(new Date(2026, 0, 10));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(dayButton('2026-01-07').getAttribute('aria-disabled')).toBe(
        'true',
      );
      expect(dayButton('2026-01-10').getAttribute('aria-disabled')).toBe(
        'false',
      );
    });
  });

  describe('range highlighting across a month boundary', () => {
    beforeEach(async () => {
      host.range.set(true);
      host.rangeValue.set({
        start: new Date(2025, 11, 29),
        end: new Date(2026, 0, 3),
      });
      fixture.detectChanges();
      await fixture.whenStable();
    });

    /**
     * The cell an ISO date's **own** month renders it in.
     *
     * A date within a week of a month boundary is in the DOM twice — once as
     * its own month's day and once as the neighbour's adjacent-month filler —
     * and the shared `cell()` helper returns whichever comes first in document
     * order. Range painting is now a property of the owning cell only, so these
     * assertions have to name it rather than take the first match.
     */
    function ownCell(iso: string): HTMLElement {
      const [year, month] = iso.split('-');
      const key = `${Number(year)}-${Number(month) - 1}`;
      const section = must(
        root.querySelector(`[data-month="${key}"]`),
        `the ${key} section`,
      );
      return must(
        section.querySelector<HTMLElement>(
          `[data-date="${iso}"]:not(.mlv-calendar-sheet__cell--adjacent)`,
        ),
        `an own-month cell for ${iso}`,
      );
    }

    function inRange(iso: string): boolean {
      return ownCell(iso).classList.contains(
        'mlv-calendar-sheet__cell--in-range',
      );
    }

    it('paints both endpoints and the days between them', () => {
      expect([
        inRange('2025-12-29'),
        inRange('2025-12-31'),
        inRange('2026-01-01'),
        inRange('2026-01-03'),
      ]).toEqual([true, true, true, true]);
    });

    it('does not paint days outside the range', () => {
      expect([inRange('2025-12-28'), inRange('2026-01-04')]).toEqual([
        false,
        false,
      ]);
    });

    /**
     * January's grid opens with the last few days of December, rendered as
     * adjacent-month filler. They are the same dates December's own grid
     * already showed.
     */
    function januaryLeadingFiller(): HTMLElement[] {
      const cells = Array.from(
        must(
          root.querySelector('[data-month="2026-0"]'),
          'the January 2026 section',
        ).querySelectorAll<HTMLElement>('.mlv-calendar-sheet__cell--adjacent'),
      ).filter((el) => (el.dataset['date'] ?? '') < '2026-01-01');
      expect(cells.length).toBeGreaterThan(0);
      return cells;
    }

    it("leaves January's leading adjacent-month cells unpainted", () => {
      // #149 review: these cells hold no day button — the template stamps one
      // only `@if (cell.currentMonth)` — so a fill on them is a band with
      // nothing under it, repeating December's tail as a detached pill inside
      // January's grid. The owner screenshotted a 15–31 December range
      // reappearing across January's leading blanks. The band still crosses the
      // section boundary: the month label carries its own in-range state, which
      // spans the full width and is asserted directly below.
      expect(
        januaryLeadingFiller().some((el) =>
          el.classList.contains('mlv-calendar-sheet__cell--in-range'),
        ),
      ).toBe(false);
    });

    it('does not announce an empty adjacent-month cell as selected', () => {
      // The same defect in the a11y tree: `aria-selected="true"` on a gridcell
      // that renders nothing and cannot be selected. Absent, not `"false"` —
      // an adjacent cell is not a selectable thing in either state.
      expect(
        januaryLeadingFiller().map((el) => el.getAttribute('aria-selected')),
      ).toEqual(januaryLeadingFiller().map(() => null));
    });

    /** The week-row cap modifiers on the cell that owns `iso`. */
    function caps(iso: string): string[] {
      return Array.from(ownCell(iso).classList)
        .filter((name) =>
          name.startsWith('mlv-calendar-sheet__cell--range-row'),
        )
        .map((name) => name.replace('mlv-calendar-sheet__cell--range-row-', ''))
        .sort();
    }

    it('caps the band where the paint starts and ends in each week row', () => {
      // #149: the sheet has to round its week-row edges exactly as
      // `mlv-calendar` does — a range spanning several rows is a stack of
      // pills, not a block with sheared corners, and the two calendars are one
      // design (`calendar-sheet-styles.spec.ts` compares their radii).
      //
      // December 29–31 close out December's last row; January's first row opens
      // with three days of December filler, so the paint there starts at
      // January 1 rather than at the row's first cell. Both ends of both runs
      // are capped; the day in the middle is not.
      expect(caps('2025-12-29')).toEqual(['start']);
      expect(caps('2025-12-31')).toEqual(['end']);
      expect(caps('2026-01-01')).toEqual(['start']);
      expect(caps('2026-01-02')).toEqual([]);
      expect(caps('2026-01-03')).toEqual(['end']);
    });

    /** The endpoint modifiers on the day button the cell owning `iso` holds. */
    function endpoints(iso: string): string[] {
      const button = must(
        ownCell(iso).querySelector<HTMLElement>('.mlv-calendar-sheet__day'),
        `a day button for ${iso}`,
      );
      return Array.from(button.classList)
        .filter((name) => name.startsWith('mlv-calendar-sheet__day--range-'))
        .map((name) => name.replace('mlv-calendar-sheet__day--range-', ''))
        .sort();
    }

    it('marks only the chronological endpoints of the range', () => {
      // #149: these are the two cells that flatten the side facing into the
      // range, so the endpoint is the band's cap rather than a circle floating
      // inside it. Every cell between them keeps its resting circle and shows
      // only the cell's pale fill.
      expect(endpoints('2025-12-29')).toEqual(['start']);
      expect(endpoints('2025-12-31')).toEqual([]);
      expect(endpoints('2026-01-01')).toEqual([]);
      expect(endpoints('2026-01-03')).toEqual(['end']);
    });

    it('marks a one-day range as both endpoints, which is a full circle again', async () => {
      // The state a careless flattening breaks. `start === end` is its own
      // start *and* end, so both flattenings apply and cancel: the day resolves
      // back to `--mlv-radius-full` on all four corners
      // (`calendar-sheet-styles.spec.ts` does that arithmetic). Were only one
      // of the two classes stamped, the day would render as a half-pill with a
      // squared side facing nothing.
      host.rangeValue.set({
        start: new Date(2026, 0, 12),
        end: new Date(2026, 0, 12),
      });
      fixture.detectChanges();
      await fixture.whenStable();

      expect(endpoints('2026-01-12')).toEqual(['end', 'start']);
      expect(caps('2026-01-12')).toEqual(['end', 'start']);
    });

    it('reads the endpoints chronologically when the range is stored backwards', async () => {
      // `_displayRange` normalises, so the flat side always faces the days in
      // between whichever way round the model holds the pair.
      host.rangeValue.set({
        start: new Date(2026, 0, 16),
        end: new Date(2026, 0, 12),
      });
      fixture.detectChanges();
      await fixture.whenStable();

      expect(endpoints('2026-01-12')).toEqual(['start']);
      expect(endpoints('2026-01-16')).toEqual(['end']);
    });

    it('never caps an adjacent-month cell', () => {
      // The caps must not become a second route back to the bleed the guard
      // above removed: a cap on unpainted filler is a stray rounded corner
      // sitting in a month the range has nothing to do with.
      expect(
        januaryLeadingFiller().flatMap((el) =>
          Array.from(el.classList).filter((name) => name.includes('range-row')),
        ),
      ).toEqual([]);
    });

    it("paints January's month label so the band crosses the section header", () => {
      const label = root.querySelector(
        '[data-month="2026-0"] .mlv-calendar-sheet__month-label',
      );

      expect(
        label?.classList.contains('mlv-calendar-sheet__month-label--in-range'),
      ).toBe(true);
    });

    it('leaves a month label outside the range unpainted', () => {
      const label = root.querySelector(
        '[data-month="2026-1"] .mlv-calendar-sheet__month-label',
      );

      expect(
        label?.classList.contains('mlv-calendar-sheet__month-label--in-range'),
      ).toBe(false);
    });

    it('extends the pending range from a single anchor on the next tap', async () => {
      host.rangeValue.set({ start: new Date(2026, 0, 5), end: null });
      fixture.detectChanges();
      await fixture.whenStable();

      dayButton('2026-01-09').click();
      fixture.detectChanges();

      expect([
        host.rangeValue()?.start?.toDateString(),
        host.rangeValue()?.end?.toDateString(),
      ]).toEqual([
        new Date(2026, 0, 5).toDateString(),
        new Date(2026, 0, 9).toDateString(),
      ]);
    });
  });

  describe('keyboard navigation', () => {
    it('starts with the selected day as the only tab stop', () => {
      expect(activeDate()).toBe('2026-01-15');
      expect(
        root.querySelectorAll('.mlv-calendar-sheet__day[tabindex="0"]').length,
      ).toBe(1);
    });

    it('moves one day per horizontal arrow', () => {
      press('ArrowRight');
      expect(activeDate()).toBe('2026-01-16');
      press('ArrowLeft');
      expect(activeDate()).toBe('2026-01-15');
    });

    it('moves one week per vertical arrow', () => {
      press('ArrowDown');
      expect(activeDate()).toBe('2026-01-22');
      press('ArrowUp');
      expect(activeDate()).toBe('2026-01-15');
    });

    it('crosses the month boundary forwards and focuses the next month cell', async () => {
      host.value.set(new Date(2026, 0, 31));
      fixture.detectChanges();
      await fixture.whenStable();

      press('ArrowRight');
      await fixture.whenStable();

      expect(activeDate()).toBe('2026-02-01');
      expect(
        document.activeElement
          ?.closest('[data-date]')
          ?.getAttribute('data-date'),
      ).toBe('2026-02-01');
    });

    it('crosses the month boundary backwards', async () => {
      host.value.set(new Date(2026, 0, 1));
      fixture.detectChanges();
      await fixture.whenStable();

      press('ArrowLeft');
      await fixture.whenStable();

      expect(activeDate()).toBe('2025-12-31');
    });

    it('extends the window when navigation walks past its edge', async () => {
      // March 2026 is already inside the seeded window, so moving the selection
      // there does not re-seat it — the window still ends at March.
      host.value.set(new Date(2026, 2, 31));
      fixture.detectChanges();
      await fixture.whenStable();
      expect(monthKeys().at(-1)).toBe('2026-2');

      for (let i = 0; i < 45; i++) press('PageDown');
      await fixture.whenStable();

      expect(monthKeys()).toContain('2029-11');
    });

    it('jumps a month per Page key', () => {
      press('PageDown');
      expect(activeDate()).toBe('2026-02-15');
      press('PageUp');
      expect(activeDate()).toBe('2026-01-15');
    });

    it('moves to the first and last day of the month with Home and End', () => {
      press('Home');
      expect(activeDate()).toBe('2026-01-01');
      press('End');
      expect(activeDate()).toBe('2026-01-31');
    });

    it('refuses to walk the caret out of the months min allows', async () => {
      // The window is clamped to the month containing `min`, so a caret that
      // walked past it would sit on a section that is never rendered and the
      // grid would be left with no tab stop at all. `_moveActive` refuses the
      // move instead — the caret stays put and PageUp is simply inert.
      host.min.set(new Date(2026, 0, 10));
      fixture.detectChanges();
      await fixture.whenStable();

      press('PageUp');
      await fixture.whenStable();

      expect(monthKeys()[0]).toBe('2026-0');
      expect(activeDate()).toBe('2026-01-15');
    });

    it('refuses to walk the caret out of the months max allows', async () => {
      host.max.set(new Date(2026, 0, 20));
      fixture.detectChanges();
      await fixture.whenStable();

      press('PageDown');
      await fixture.whenStable();

      expect(monthKeys().at(-1)).toBe('2026-0');
      expect(activeDate()).toBe('2026-01-15');
    });

    it('selects the active day with Enter', () => {
      press('ArrowRight');
      press('Enter');

      expect(host.value()?.toDateString()).toBe(
        new Date(2026, 0, 16).toDateString(),
      );
    });
  });

  describe('accessibility', () => {
    it('renders each month as a labelled grid', () => {
      const grids = root.querySelectorAll('[role="grid"]');

      expect(grids.length).toBe(monthKeys().length);
      expect(
        Array.from(grids).every((grid) =>
          Boolean(grid.getAttribute('aria-labelledby')),
        ),
      ).toBe(true);
    });

    it('associates a column header row with every grid', () => {
      const grid = must(root.querySelector('[role="grid"]'), 'a month grid');
      const headers = grid.querySelectorAll(
        ':scope > [role="row"] > [role="columnheader"]',
      );

      expect(headers.length).toBe(7);
    });

    it('hides the fixed weekday strip from assistive technology', () => {
      const strip = root.querySelector('.mlv-calendar-sheet__weekdays');

      expect(strip?.getAttribute('aria-hidden')).toBe('true');
    });

    it('gives every day cell an accessible name', () => {
      const named = Array.from(
        root.querySelectorAll<HTMLElement>('.mlv-calendar-sheet__day'),
      ).every((el) => (el.getAttribute('aria-label') ?? '').length > 0);

      expect(named).toBe(true);
    });

    it('marks the selected day with aria-selected on its gridcell', () => {
      expect(cell('2026-01-15').getAttribute('aria-selected')).toBe('true');
      expect(cell('2026-01-16').getAttribute('aria-selected')).toBe('false');
    });

    it('labels the month list region', () => {
      const list = root.querySelector('.mlv-calendar-sheet__months');

      expect(list?.getAttribute('aria-label')).toBe('Calendar months');
    });
  });

  describe('localisation through the date adapter', () => {
    // Asserting against `Intl.DateTimeFormat(undefined, …)` would prove
    // nothing: the test environment resolves `undefined` to en-US, so a
    // hardcoded English month table passes such a spec unchanged. Moving the
    // adapter's locale is what makes the claim testable — every name the sheet
    // paints has to follow it.
    const LOCALE = 'de-DE';

    beforeEach(async () => {
      // The sheet falls back to the root `MlvNativeDateAdapter` when no
      // `MLV_DATE_ADAPTER` is provided, so this is the instance it reads.
      TestBed.inject(MlvNativeDateAdapter).setLocale(LOCALE);
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('renders month names from the adapter, not hardcoded English', () => {
      const label = root.querySelector(
        '[data-month="2026-0"] .mlv-calendar-sheet__month-label',
      );

      expect(label?.textContent?.trim()).toBe(
        new Intl.DateTimeFormat(LOCALE, { month: 'long' }).format(
          new Date(2026, 0, 1),
        ),
      );
    });

    it('renders weekday abbreviations from the adapter, rotated by firstDayOfWeek', () => {
      const rendered = Array.from(
        root.querySelectorAll('.mlv-calendar-sheet__weekday'),
        (el) => el.textContent?.trim(),
      );
      // 2020-11-01 was a Sunday, so this walks one whole week in order.
      const names = Array.from({ length: 7 }, (_, i) =>
        new Intl.DateTimeFormat(LOCALE, { weekday: 'short' }).format(
          new Date(2020, 10, 1 + i),
        ),
      );

      expect(rendered).toEqual([...names.slice(1), names[0]]);
    });

    it("renders the grids' column headers from the adapter", () => {
      const rendered = Array.from(
        root.querySelectorAll(
          '[data-month="2026-0"] .mlv-calendar-sheet__columnheader',
        ),
        (el) => el.textContent?.trim(),
      );
      const names = Array.from({ length: 7 }, (_, i) =>
        new Intl.DateTimeFormat(LOCALE, { weekday: 'long' }).format(
          new Date(2020, 10, 1 + i),
        ),
      );

      expect(rendered).toEqual([...names.slice(1), names[0]]);
    });

    it('names day cells through the adapter', () => {
      expect(dayButton('2026-01-15').getAttribute('aria-label')).toBe(
        new Intl.DateTimeFormat(LOCALE, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }).format(new Date(2026, 0, 15)),
      );
    });
  });

  afterEach(() => {
    fixture.destroy();
  });
});
