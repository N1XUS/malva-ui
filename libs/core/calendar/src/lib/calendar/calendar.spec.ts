import type { ComponentFixture } from '@angular/core/testing';
import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MlvCalendar } from './calendar';
import { MlvNativeDateAdapter } from '../date-provider/native-date-adapter';
import { provideMlvDateAdapter } from '../date-provider/date-adapter';
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

  afterEach(() => rtlService?.setDirection('ltr'));

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
    // parent's binding -- which is what made both `mlv-date-range-picker`
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
