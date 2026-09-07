import type { ComponentFixture } from '@angular/core/testing';
import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvCalendar } from './calendar';
import {
  MlvNativeDateAdapter,
  provideMlvDateAdapter,
} from '@malva-ui/core/date';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvRtlService } from '@malva-ui/cdk/utils';

@Injectable()
class StubDateAdapter extends MlvNativeDateAdapter {
  override getDayOfWeekNames(): string[] {
    return ['SunX', 'MonX', 'TueX', 'WedX', 'ThuX', 'FriX', 'SatX'];
  }

  override getMonthYearLabel(): string {
    return 'Localized Month Label';
  }
}

describe('MlvCalendar', () => {
  let component: MlvCalendar;
  let fixture: ComponentFixture<MlvCalendar>;
  let rtlService: MlvRtlService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvCalendar],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvCalendar);
    component = fixture.componentInstance;
    rtlService = TestBed.inject(MlvRtlService);
    await fixture.whenStable();
  });

  afterEach(() => {
    scopeElement()?.removeAttribute('dir');
    rtlService?.setDirection('ltr');
    document.documentElement.removeAttribute('dir');
  });

  /** The ancestor a scoped `dir` is written on — never the calendar host itself. */
  function scopeElement(): HTMLElement | null {
    return (fixture?.nativeElement as HTMLElement | undefined)
      ?.parentElement as HTMLElement | null;
  }

  /** Scopes `dir` to an ancestor of the calendar, leaving the document alone. */
  function scopeDirection(direction: 'ltr' | 'rtl'): void {
    const scope = scopeElement();
    if (!scope)
      throw new Error('Calendar host has no parent to scope `dir` on');
    scope.setAttribute('dir', direction);
  }

  function pressKey(key: string): void {
    fixture.nativeElement.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true }),
    );
    fixture.detectChanges();
  }

  function dayButton(day: number): HTMLButtonElement {
    const button = Array.from(
      fixture.nativeElement.querySelectorAll(
        '.mlv-calendar__day:not(.mlv-calendar__day--outside)',
      ),
    ).find((candidate) => candidate.textContent?.trim() === String(day));

    if (!button) {
      throw new Error(`Could not find current-month day ${day}`);
    }

    return button as HTMLButtonElement;
  }

  function setupMarchRange(): void {
    fixture.componentRef.setInput('range', true);
    component.activeDate.set(new Date(2026, 2, 15));
    fixture.detectChanges();
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should include adjacent month days to fill the grid', () => {
    component.activeDate.set(new Date(2026, 2, 15));

    const days = component.monthDays();

    expect(days[0]?.currentMonth).toBe(false);
    expect(days[0]?.date.getMonth()).toBe(1);
    expect(days.at(-1)?.currentMonth).toBe(false);
    expect(days.at(-1)?.date.getMonth()).toBe(3);
    expect(days.length % 7).toBe(0);
  });

  it('should build a range when range mode is enabled', () => {
    fixture.componentRef.setInput('range', true);
    fixture.detectChanges();

    component.selectDate(new Date(2026, 2, 10));
    component.selectDate(new Date(2026, 2, 14));

    expect(component.rangeValue()).toEqual({
      start: new Date(2026, 2, 10),
      end: new Date(2026, 2, 14),
    });
  });

  it('should preview every date between the first selection and a later hovered date', () => {
    setupMarchRange();
    component.selectDate(new Date(2026, 2, 10));
    fixture.detectChanges();

    dayButton(14).dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();

    expect(component.rangeValue()?.end).toBeNull();
    expect(component.isRangePreviewing()).toBe(true);
    for (let day = 10; day <= 14; day++) {
      expect(dayButton(day).classList).toContain('mlv-calendar__day--in-range');
      expect(dayButton(day).classList).toContain(
        'mlv-calendar__day--range-preview',
      );
    }
    expect(dayButton(10).classList).toContain('mlv-calendar__day--range-start');
    expect(dayButton(14).classList).toContain('mlv-calendar__day--range-end');
  });

  it('should flip the selected anchor to the trailing cap when hovering before it', () => {
    setupMarchRange();
    component.selectDate(new Date(2026, 2, 14));
    fixture.detectChanges();

    dayButton(10).dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();

    expect(dayButton(10).classList).toContain('mlv-calendar__day--range-start');
    expect(dayButton(14).classList).toContain('mlv-calendar__day--range-end');
    expect(dayButton(14).classList).not.toContain(
      'mlv-calendar__day--range-start',
    );
  });

  it('should render a completed range as one primary band', () => {
    setupMarchRange();
    component.selectDate(new Date(2026, 2, 10));
    component.selectDate(new Date(2026, 2, 14));
    fixture.detectChanges();

    expect(component.hasCompletedRange()).toBe(true);
    expect(component.isRangePreviewing()).toBe(false);
    for (let day = 10; day <= 14; day++) {
      expect(dayButton(day).classList).toContain(
        'mlv-calendar__day--range-complete',
      );
    }
  });

  describe('a range that crosses a month boundary', () => {
    /**
     * March 2026 opens on a Sunday, so with a Monday week start its grid leads
     * with six February filler days (23-28) and trails with five April ones
     * (1-5). Every assertion below picks a day out of one of those two runs.
     */
    function outsideDayButton(day: number): HTMLButtonElement {
      const button = Array.from(
        fixture.nativeElement.querySelectorAll<HTMLButtonElement>(
          '.mlv-calendar__day--outside',
        ),
      ).find((candidate) => candidate.textContent?.trim() === String(day));

      if (!button) {
        throw new Error(`Could not find adjacent-month day ${day}`);
      }

      return button;
    }

    /** The `role="gridcell"` wrapping a day button. */
    function cellOf(button: HTMLButtonElement): HTMLElement {
      const cell = button.closest<HTMLElement>('[role="gridcell"]');
      if (!cell) throw new Error('Day button has no gridcell');
      return cell;
    }

    /** Range-related modifiers currently on a day button. */
    function rangeClasses(button: HTMLButtonElement): string[] {
      return Array.from(button.classList)
        .filter((name) => name.startsWith('mlv-calendar__day--'))
        .map((name) => name.replace('mlv-calendar__day--', ''))
        .filter((name) => name.includes('range'))
        .sort();
    }

    beforeEach(() => {
      fixture.componentRef.setInput('range', true);
      // The grid must stay on March while the range sits in a neighbouring
      // month, the way `mlv-date-range-picker` pins each of its two panels.
      fixture.componentRef.setInput('followSelection', false);
      component.activeDate.set(new Date(2026, 2, 15));
      fixture.detectChanges();
    });

    it('paints no band on the adjacent-month days a range spills onto', () => {
      // #149 review: `isInDisplayRange` is date-based, so a range reaching back
      // into February repainted a detached fragment of the band across March's
      // leading filler — a band the neighbouring month's own grid already
      // draws, floating inside a month it has nothing to do with.
      component.rangeValue.set({
        start: new Date(2026, 1, 20),
        end: new Date(2026, 2, 5),
      });
      fixture.detectChanges();

      for (const day of [23, 24, 25, 26, 27, 28]) {
        expect(rangeClasses(outsideDayButton(day))).toEqual([]);
      }
    });

    it('paints no band on the adjacent-month days after the month either', () => {
      component.rangeValue.set({
        start: new Date(2026, 2, 25),
        end: new Date(2026, 3, 3),
      });
      fixture.detectChanges();

      // April 3 is the range end and keeps its endpoint marker; the two days
      // before it carry only the band, so they lose everything.
      for (const day of [1, 2]) {
        expect(rangeClasses(outsideDayButton(day))).toEqual([]);
      }
      expect(rangeClasses(outsideDayButton(3))).toEqual(['range-end']);
    });

    it('caps the band where the paint starts, not at the raw row edge', () => {
      // Dropping the fill from filler must not leave the band with a squared
      // edge butting into a blank cell: March 1 is the only painted cell in a
      // row that opens with six February days, so it takes both caps.
      component.rangeValue.set({
        start: new Date(2026, 1, 20),
        end: new Date(2026, 2, 5),
      });
      fixture.detectChanges();

      expect(rangeClasses(dayButton(1))).toContain('range-row-start');
      expect(rangeClasses(dayButton(1))).toContain('range-row-end');
    });

    it('caps the band where the paint ends, not at the raw row edge', () => {
      component.rangeValue.set({
        start: new Date(2026, 2, 25),
        end: new Date(2026, 3, 3),
      });
      fixture.detectChanges();

      expect(rangeClasses(dayButton(31))).toContain('range-row-end');
    });

    it('keeps the endpoint marker on an adjacent-month day that is an endpoint', () => {
      // The band is an interval and does not belong on filler. An endpoint is a
      // point on one real, visible, clickable day — the same thing
      // `--selected` marks in single mode — so it stays, and the day does not
      // read as out of range while remaining selectable.
      component.rangeValue.set({
        start: new Date(2026, 1, 10),
        end: new Date(2026, 1, 25),
      });
      fixture.detectChanges();

      expect(rangeClasses(outsideDayButton(25))).toEqual(['range-end']);
      expect(cellOf(outsideDayButton(25)).getAttribute('aria-selected')).toBe(
        'true',
      );
    });

    it('reports aria-selected on adjacent-month days as what they paint', () => {
      component.rangeValue.set({
        start: new Date(2026, 1, 20),
        end: new Date(2026, 2, 5),
      });
      fixture.detectChanges();

      // Mid-range filler paints nothing, so it must not announce itself as
      // selected either.
      expect(cellOf(outsideDayButton(24)).getAttribute('aria-selected')).toBe(
        'false',
      );
      // The owning month still reports the same date as selected.
      expect(cellOf(dayButton(3)).getAttribute('aria-selected')).toBe('true');
    });

    it('still paints the band inside the month itself', () => {
      component.rangeValue.set({
        start: new Date(2026, 1, 20),
        end: new Date(2026, 2, 5),
      });
      fixture.detectChanges();

      for (const day of [1, 2, 3, 4, 5]) {
        expect(rangeClasses(dayButton(day))).toContain('in-range');
        expect(rangeClasses(dayButton(day))).toContain('range-complete');
      }
    });
  });

  it('should clear an incomplete range preview when the pointer leaves the grid', () => {
    setupMarchRange();
    component.selectDate(new Date(2026, 2, 10));
    fixture.detectChanges();
    dayButton(14).dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();

    const grid = fixture.nativeElement.querySelector(
      '.mlv-calendar__days',
    ) as HTMLElement;
    grid.dispatchEvent(new MouseEvent('mouseleave'));
    fixture.detectChanges();

    expect(component.isRangePreviewing()).toBe(false);
    expect(
      fixture.nativeElement.querySelector('.mlv-calendar__day--range-preview'),
    ).toBeNull();
  });

  it('should switch to the selected month when a month button is clicked', () => {
    component.activeDate.set(new Date(2026, 2, 15));
    component.currentView.set('year');
    fixture.detectChanges();

    const monthButtons = Array.from(
      fixture.nativeElement.querySelectorAll('.mlv-calendar__selection-button'),
    ) as HTMLButtonElement[];
    const februaryButton = monthButtons[1];

    februaryButton.click();
    fixture.detectChanges();

    expect(component.currentView()).toBe('month');
    expect(component.isCurrentMonthIndex(1)).toBe(true);
    expect(component.headerLabel()).toContain('2026');
  });

  it('should render a valid grid: week rows of gridcells, day buttons without gridcell role', () => {
    component.activeDate.set(new Date(2026, 2, 15));
    fixture.detectChanges();

    const grid = fixture.nativeElement.querySelector('.mlv-calendar__month');
    expect(grid.getAttribute('role')).toBe('grid');

    const weekRows = Array.from(
      grid.querySelectorAll('.mlv-calendar__week'),
    ) as HTMLElement[];
    expect(weekRows.length).toBeGreaterThanOrEqual(4);
    for (const row of weekRows) {
      expect(row.getAttribute('role')).toBe('row');
      expect(row.querySelectorAll('[role="gridcell"]').length).toBe(7);
    }

    // The button itself must keep native button semantics (no gridcell role).
    const dayButton = grid.querySelector('.mlv-calendar__day');
    expect(dayButton.getAttribute('role')).toBeNull();
  });

  it('should not make the calendar host focusable (roving tabindex owns focus)', () => {
    expect(fixture.nativeElement.getAttribute('tabindex')).toBeNull();
  });

  it('should apply roving tabindex — only the active day button is tabbable', () => {
    component.activeDate.set(new Date(2026, 2, 15));
    fixture.detectChanges();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('.mlv-calendar__day'),
    ) as HTMLButtonElement[];
    const tabbable = buttons.filter((b) => b.getAttribute('tabindex') === '0');
    expect(tabbable.length).toBe(1);
    expect(tabbable[0].classList).toContain('mlv-calendar__day--active');
    expect(
      buttons.filter((b) => b.getAttribute('tabindex') === '-1').length,
    ).toBe(buttons.length - 1);
  });

  it('should move the active date and roving tabindex with ArrowRight', () => {
    component.activeDate.set(new Date(2026, 2, 15));
    fixture.detectChanges();

    fixture.nativeElement.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    fixture.detectChanges();

    expect(component.activeDate().getDate()).toBe(16);
    const active = fixture.nativeElement.querySelector(
      '.mlv-calendar__day--active',
    );
    expect(active.getAttribute('tabindex')).toBe('0');
  });

  it('should mirror horizontal date navigation without changing vertical navigation in RTL', () => {
    rtlService.setDirection('rtl');
    component.activeDate.set(new Date(2026, 2, 15));
    fixture.detectChanges();

    fixture.nativeElement.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }),
    );
    fixture.detectChanges();
    expect(component.activeDate().getDate()).toBe(16);

    fixture.nativeElement.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }),
    );
    fixture.detectChanges();
    expect(component.activeDate().getDate()).toBe(9);
  });

  it('should mirror day navigation inside a scoped [dir="rtl"] subtree while the document stays LTR', async () => {
    scopeDirection('rtl');
    component.activeDate.set(new Date(2026, 2, 15));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(rtlService.direction()).toBe('ltr');
    expect(document.documentElement.getAttribute('dir')).not.toBe('rtl');

    pressKey('ArrowLeft');
    expect(component.activeDate().getDate()).toBe(16);

    pressKey('ArrowRight');
    expect(component.activeDate().getDate()).toBe(15);

    // Block axis and paging never mirror.
    pressKey('ArrowUp');
    expect(component.activeDate().getDate()).toBe(8);

    pressKey('ArrowDown');
    expect(component.activeDate().getDate()).toBe(15);

    pressKey('Home');
    expect(component.activeDate().getDate()).toBe(1);

    pressKey('End');
    expect(component.activeDate().getDate()).toBe(31);

    pressKey('PageUp');
    expect(component.activeDate().getMonth()).toBe(1);

    pressKey('PageDown');
    expect(component.activeDate().getMonth()).toBe(2);
  });

  it('should mirror month navigation in the year view inside a scoped [dir="rtl"] subtree', async () => {
    scopeDirection('rtl');
    component.activeDate.set(new Date(2026, 2, 15));
    component.currentView.set('year');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(rtlService.direction()).toBe('ltr');

    pressKey('ArrowLeft');
    expect(component.activeDate().getMonth()).toBe(3);

    pressKey('ArrowRight');
    expect(component.activeDate().getMonth()).toBe(2);

    pressKey('ArrowDown');
    expect(component.activeDate().getMonth()).toBe(6);
  });

  it('should mirror year navigation in the multi-year view inside a scoped [dir="rtl"] subtree', async () => {
    scopeDirection('rtl');
    component.activeDate.set(new Date(2026, 2, 15));
    component.currentView.set('multi-year');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(rtlService.direction()).toBe('ltr');

    pressKey('ArrowLeft');
    expect(component.activeDate().getFullYear()).toBe(2027);

    pressKey('ArrowRight');
    expect(component.activeDate().getFullYear()).toBe(2026);

    pressKey('ArrowDown');
    expect(component.activeDate().getFullYear()).toBe(2030);
  });

  it('should leave a scoped [dir="ltr"] island unmirrored while the document is RTL', async () => {
    rtlService.setDirection('rtl');
    scopeDirection('ltr');
    component.activeDate.set(new Date(2026, 2, 15));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(rtlService.direction()).toBe('rtl');

    pressKey('ArrowLeft');
    expect(component.activeDate().getDate()).toBe(14);

    pressKey('ArrowRight');
    expect(component.activeDate().getDate()).toBe(15);
  });

  it('should use roving tabindex and drop listitem roles in the year view', () => {
    component.activeDate.set(new Date(2026, 2, 15));
    component.currentView.set('year');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="list"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="listitem"]')).toBeNull();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('.mlv-calendar__selection-button'),
    ) as HTMLButtonElement[];
    for (const b of buttons) {
      expect(b.getAttribute('role')).toBeNull();
    }
    const tabbable = buttons.filter((b) => b.getAttribute('tabindex') === '0');
    expect(tabbable.length).toBe(1);
    expect(tabbable[0].classList).toContain(
      'mlv-calendar__selection-button--current',
    );
  });

  it('should use roving tabindex and drop listitem roles in the multi-year view', () => {
    component.activeDate.set(new Date(2026, 2, 15));
    component.currentView.set('multi-year');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="listitem"]')).toBeNull();
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('.mlv-calendar__selection-button'),
    ) as HTMLButtonElement[];
    const tabbable = buttons.filter((b) => b.getAttribute('tabindex') === '0');
    expect(tabbable.length).toBe(1);
    expect(tabbable[0].classList).toContain(
      'mlv-calendar__selection-button--current',
    );
  });

  it('should expose a focus() entry point that focuses the active day cell', () => {
    component.activeDate.set(new Date(2026, 2, 15));
    fixture.detectChanges();

    component.focus();

    const active = fixture.nativeElement.querySelector(
      '.mlv-calendar__day--active',
    );
    expect(document.activeElement).toBe(active);
  });

  it('should keep navigated month in range mode when using previous and next buttons', () => {
    fixture.componentRef.setInput('range', true);
    fixture.componentRef.setInput('rangeValue', {
      start: new Date(2026, 2, 10),
      end: new Date(2026, 2, 14),
    });
    fixture.detectChanges();

    const prevButton = fixture.nativeElement.querySelector(
      'button[aria-label="Previous period"]',
    ) as HTMLButtonElement | null;
    const nextButton = fixture.nativeElement.querySelector(
      'button[aria-label="Next period"]',
    ) as HTMLButtonElement | null;

    expect(prevButton).toBeTruthy();
    expect(nextButton).toBeTruthy();

    prevButton?.click();
    fixture.detectChanges();
    expect(component.headerLabel()).toContain('February');

    nextButton?.click();
    fixture.detectChanges();
    expect(component.headerLabel()).toContain('March');
  });
});

describe('MlvCalendar with custom date adapter', () => {
  let component: MlvCalendar;
  let fixture: ComponentFixture<MlvCalendar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvCalendar],
      providers: [
        provideMlvI18nTesting(),
        ...provideMlvDateAdapter(StubDateAdapter),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvCalendar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should use the injected adapter for localized labels', () => {
    expect(component.weekdays()[0]).toBe('MonX');
    expect(component.headerLabel()).toBe('Localized Month Label');
  });
});

// ---------------------------------------------------------------------------
// followSelection (#138)
// ---------------------------------------------------------------------------

describe('MlvCalendar — followSelection', () => {
  const monthOf = (fixture: ComponentFixture<MlvCalendar<Date>>): number =>
    fixture.componentInstance.activeDate().getMonth();

  const create = async () => {
    await TestBed.configureTestingModule({
      imports: [MlvCalendar],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    const fixture = TestBed.createComponent(MlvCalendar<Date>);
    fixture.componentRef.setInput('range', true);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  };

  it('anchors activeDate on the range endpoint by default', async () => {
    const fixture = await create();

    fixture.componentRef.setInput('rangeValue', {
      start: new Date(2026, 8, 20),
      end: new Date(2026, 9, 4),
    });
    fixture.detectChanges();
    await fixture.whenStable();

    // `end ?? start`, so October.
    expect(monthOf(fixture)).toBe(9);
  });

  it('leaves activeDate alone when a parent is coordinating it', async () => {
    const fixture = await create();
    fixture.componentRef.setInput('followSelection', false);
    fixture.componentRef.setInput('activeDate', new Date(2026, 8, 1));
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentRef.setInput('rangeValue', {
      start: new Date(2026, 8, 20),
      end: new Date(2026, 9, 4),
    });
    fixture.detectChanges();
    await fixture.whenStable();

    // Without the opt-out this would snap to October and overwrite the
    // parent's binding — which is what made both `mlv-date-range-picker`
    // panels paint the same month.
    expect(monthOf(fixture)).toBe(8);
  });

  it('anchors activeDate on the value in single mode by default', async () => {
    await TestBed.configureTestingModule({
      imports: [MlvCalendar],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    const fixture = TestBed.createComponent(MlvCalendar<Date>);
    fixture.componentRef.setInput('value', new Date(2026, 9, 4));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.activeDate().getMonth()).toBe(9);
  });

  it('leaves activeDate alone in single mode when a parent is coordinating it', async () => {
    await TestBed.configureTestingModule({
      imports: [MlvCalendar],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    const fixture = TestBed.createComponent(MlvCalendar<Date>);
    fixture.componentRef.setInput('followSelection', false);
    fixture.componentRef.setInput('activeDate', new Date(2026, 8, 1));
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentRef.setInput('value', new Date(2026, 9, 4));
    fixture.detectChanges();
    await fixture.whenStable();

    // `followSelection` gates both re-anchor effects, not just the range one.
    expect(fixture.componentInstance.activeDate().getMonth()).toBe(8);
  });

  it('still navigates while followSelection is false', async () => {
    const fixture = await create();
    fixture.componentRef.setInput('followSelection', false);
    fixture.componentRef.setInput('activeDate', new Date(2026, 8, 1));
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.navigateNext();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(monthOf(fixture)).toBe(9);
  });
});

/**
 * Accessibility sweeps — `mlv-calendar`.
 *
 * Every sweep is rooted at the component host, which is the ancestor of the
 * `role="grid"` / `role="group"` container each view renders. That matters
 * here more than usual: the month view is a full grid tree — `grid` owning a
 * header `row` of `columnheader`s and a `rowgroup` of `row`s of `gridcell`s —
 * and `aria-required-children` / `aria-required-parent` are evaluated on the
 * container, so a sweep rooted at a day button would pass without ever asking
 * whether the structure holds.
 *
 * The three views are three different renderings, not three skins, and the
 * range mode changes `aria-selected` on cells, so each is swept in turn.
 */
describe('MlvCalendar accessibility', () => {
  let a11yFixture: ComponentFixture<MlvCalendar>;

  beforeEach(async () => {
    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [MlvCalendar],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    a11yFixture = TestBed.createComponent(MlvCalendar);
    await a11yFixture.whenStable();
  });

  /** Renders the current inputs and returns the host element. */
  async function render(): Promise<HTMLElement> {
    a11yFixture.detectChanges();
    await a11yFixture.whenStable();
    return a11yFixture.nativeElement as HTMLElement;
  }

  it('has no axe violations in the month view grid', async () => {
    const host = await render();

    // State: the whole grid tree — one labelled grid, one header row of
    // columnheaders, and one gridcell per rendered day, each holding a named
    // button with a roving tabindex.
    const grid = host.querySelector('[role="grid"]') as HTMLElement;
    expect(grid.getAttribute('aria-label')).toBeTruthy();
    expect(grid.querySelectorAll('[role="columnheader"]')).toHaveLength(7);
    expect(
      grid.querySelectorAll('[role="gridcell"]').length,
    ).toBeGreaterThanOrEqual(28);
    expect(
      host.querySelectorAll('.mlv-calendar__day[tabindex="0"]'),
    ).toHaveLength(1);

    await expectNoAxeViolations(host);
  });

  it('has no axe violations with a selection and disabled days', async () => {
    a11yFixture.componentRef.setInput('value', new Date(2026, 0, 15));
    a11yFixture.componentRef.setInput('min', new Date(2026, 0, 10));
    a11yFixture.componentRef.setInput('max', new Date(2026, 0, 20));
    const host = await render();

    // State: some day buttons are natively disabled and mirror it in ARIA, and
    // one gridcell reports `aria-selected="true"`.
    expect(
      host.querySelectorAll('.mlv-calendar__day[disabled]').length,
    ).toBeGreaterThan(0);
    expect(host.querySelectorAll('[aria-selected="true"]')).toHaveLength(1);

    await expectNoAxeViolations(host);
  });

  it('has no axe violations with a completed range', async () => {
    a11yFixture.componentRef.setInput('range', true);
    a11yFixture.componentRef.setInput('rangeValue', {
      start: new Date(2026, 0, 10),
      end: new Date(2026, 0, 20),
    });
    const host = await render();

    // State: the range band paints across many cells and both endpoints are
    // reported as selected.
    expect(
      host.querySelectorAll('.mlv-calendar__day--in-range').length,
    ).toBeGreaterThan(0);
    expect(
      host.querySelectorAll('[aria-selected="true"]').length,
    ).toBeGreaterThanOrEqual(2);

    await expectNoAxeViolations(host);
  });

  it('has no axe violations in the year view', async () => {
    // `startView` seeds `currentView` in a field initializer, so it is read at
    // construction and a later `setInput` would not switch the view.
    a11yFixture.componentInstance.currentView.set('year');
    const host = await render();

    // State: a labelled `role="group"` of twelve month toggles, exactly one of
    // which is pressed and in the tab order.
    const group = host.querySelector('[role="group"]') as HTMLElement;
    expect(group.getAttribute('aria-label')).toBeTruthy();
    expect(group.querySelectorAll('button')).toHaveLength(12);
    expect(group.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);
    expect(host.querySelector('[role="grid"]')).toBeNull();

    await expectNoAxeViolations(host);
  });

  it('has no axe violations in the multi-year view', async () => {
    a11yFixture.componentInstance.currentView.set('multi-year');
    const host = await render();

    // State: the same `role="group"` shell over year toggles.
    const group = host.querySelector('[role="group"]') as HTMLElement;
    expect(group.querySelectorAll('button').length).toBeGreaterThan(1);
    expect(group.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);

    await expectNoAxeViolations(host);
  });
});
