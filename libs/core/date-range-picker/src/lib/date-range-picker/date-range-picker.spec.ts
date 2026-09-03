import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { MlvPopup } from '@malva-ui/core/popup';
import { MlvDateRangePicker } from './date-range-picker';
import type { MlvDateRangePickerValue } from './date-range-picker';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

// ---------------------------------------------------------------------------
// Reactive-forms host wrapper
// ---------------------------------------------------------------------------

@Component({
  imports: [MlvDateRangePicker, ReactiveFormsModule],
  template: `<mlv-date-range-picker [formControl]="ctrl" />`,
})
class ReactiveFormHostComponent {
  ctrl = new FormControl<MlvDateRangePickerValue<Date> | null>(null);
}

// ---------------------------------------------------------------------------
// MlvDateRangePicker — basic creation & internal state
// ---------------------------------------------------------------------------

describe('MlvDateRangePicker', () => {
  let component: MlvDateRangePicker<Date>;
  let fixture: ComponentFixture<MlvDateRangePicker<Date>>;
  let hostEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvDateRangePicker],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvDateRangePicker<Date>);
    component = fixture.componentInstance;
    hostEl = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  // -------------------------------------------------------------------------
  // Creation
  // -------------------------------------------------------------------------

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('maps signal-form range constraints onto calendar boundary dates', () => {
    const start = new Date(2026, 6, 1);
    const end = new Date(2026, 6, 31);
    const constraint: MlvDateRangePickerValue<Date> = { start, end };

    fixture.componentRef.setInput('min', constraint);
    fixture.componentRef.setInput('max', constraint);
    fixture.detectChanges();

    expect(component.min()).toBe(start);
    expect(component.max()).toBe(end);
  });

  it('opts the range popup into auto mobile fullscreen mode', () => {
    const popup = fixture.debugElement.query(By.directive(MlvPopup))
      .componentInstance as MlvPopup;
    expect(popup.mobileMode()).toBe('auto');
  });

  // -------------------------------------------------------------------------
  // Host classes
  // -------------------------------------------------------------------------

  describe('host classes', () => {
    it('should always have mlv-date-range-picker class', () => {
      expect(hostEl.classList).toContain('mlv-date-range-picker');
    });

    it('should have mlv-date-range-picker--state-default class by default', () => {
      expect(hostEl.classList).toContain(
        'mlv-date-range-picker--state-default',
      );
    });

    it('should not have disabled class by default', () => {
      expect(hostEl.classList).not.toContain('mlv-date-range-picker--disabled');
    });

    it('should not have open class by default', () => {
      expect(hostEl.classList).not.toContain('mlv-date-range-picker--open');
    });

    it('should add disabled class when disabled input is true', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      expect(hostEl.classList).toContain('mlv-date-range-picker--disabled');
    });

    it('should add state class matching the state input', () => {
      fixture.componentRef.setInput('state', 'error');
      fixture.detectChanges();
      expect(hostEl.classList).toContain('mlv-date-range-picker--state-error');
      expect(hostEl.classList).not.toContain(
        'mlv-date-range-picker--state-default',
      );
    });
  });

  // -------------------------------------------------------------------------
  // _open() / _close() equivalents via toggleDropdown / closeDropdown
  // -------------------------------------------------------------------------

  describe('open / close state', () => {
    it('toggleDropdown() sets _isOpen to true when closed', () => {
      expect(
        (component as unknown as { _isOpen: { (): boolean } })._isOpen(),
      ).toBe(false);
      component.toggleDropdown();
      fixture.detectChanges();
      expect(
        (component as unknown as { _isOpen: { (): boolean } })._isOpen(),
      ).toBe(true);
    });

    it('closeDropdown() sets _isOpen to false', () => {
      component.toggleDropdown();
      fixture.detectChanges();
      expect(
        (component as unknown as { _isOpen: { (): boolean } })._isOpen(),
      ).toBe(true);

      component.closeDropdown();
      fixture.detectChanges();
      expect(
        (component as unknown as { _isOpen: { (): boolean } })._isOpen(),
      ).toBe(false);
    });

    it('toggleDropdown() is a no-op when disabled', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      component.toggleDropdown();
      fixture.detectChanges();
      expect(
        (component as unknown as { _isOpen: { (): boolean } })._isOpen(),
      ).toBe(false);
    });

    it('should add open class to host when popup is open', () => {
      component.toggleDropdown();
      fixture.detectChanges();
      expect(hostEl.classList).toContain('mlv-date-range-picker--open');
    });

    it('should remove open class from host when popup is closed', () => {
      component.toggleDropdown();
      fixture.detectChanges();
      component.closeDropdown();
      fixture.detectChanges();
      expect(hostEl.classList).not.toContain('mlv-date-range-picker--open');
    });
  });

  // -------------------------------------------------------------------------
  // Signal model writes
  // -------------------------------------------------------------------------

  describe('value model', () => {
    it('should populate rangeValue with the given MlvDateRangePickerValue', () => {
      const start = new Date(2024, 0, 10); // Jan 10
      const end = new Date(2024, 0, 20); // Jan 20
      component.value.set({ start, end });
      fixture.detectChanges();

      const val = component.rangeValue();
      expect(val).not.toBeNull();
      expect(val?.start).toEqual(start);
      expect(val?.end).toEqual(end);
    });

    it('should set rangeValue to null when the model is cleared', () => {
      component.value.set({ start: new Date(), end: new Date() });
      component.value.set(null);
      fixture.detectChanges();
      expect(component.rangeValue()).toBeNull();
    });

    it('should reflect start date in startDisplayValue after a model write', () => {
      const start = new Date(2024, 2, 15); // Mar 15
      component.value.set({ start, end: null });
      fixture.detectChanges();
      expect(component.startDisplayValue).not.toBe('');
    });

    it('should reflect end date in endDisplayValue after a model write', () => {
      const end = new Date(2024, 2, 25); // Mar 25
      component.value.set({ start: new Date(2024, 2, 15), end });
      fixture.detectChanges();
      expect(component.endDisplayValue).not.toBe('');
    });

    it('should return empty string from startDisplayValue when start is null', () => {
      component.value.set({ start: null, end: null });
      fixture.detectChanges();
      expect(component.startDisplayValue).toBe('');
    });

    it('should return empty string from endDisplayValue when end is null', () => {
      component.value.set({ start: null, end: null });
      fixture.detectChanges();
      expect(component.endDisplayValue).toBe('');
    });
  });

  // -------------------------------------------------------------------------
  // Signal model changes
  // -------------------------------------------------------------------------

  describe('value changes', () => {
    it('should update the model when applySelection is called', () => {
      const start = new Date(2024, 3, 1);
      const end = new Date(2024, 3, 15);

      // Open popup and set a pending range
      component.toggleDropdown();
      component.onRangeChanged({ start, end });
      component.applySelection();
      fixture.detectChanges();

      expect(component.value()?.start).toEqual(start);
      expect(component.value()?.end).toEqual(end);
    });

    it('should set the model to null when clearSelection is called', () => {
      component.value.set({ start: new Date(), end: new Date() });

      component.clearSelection();
      fixture.detectChanges();

      expect(component.value()).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Disabled input
  // -------------------------------------------------------------------------

  describe('disabled', () => {
    it('should add disabled class when disabled', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      expect(hostEl.classList).toContain('mlv-date-range-picker--disabled');
    });

    it('should remove disabled class after enabling', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      fixture.componentRef.setInput('disabled', false);
      fixture.detectChanges();
      expect(hostEl.classList).not.toContain('mlv-date-range-picker--disabled');
    });

    it('should prevent toggleDropdown() from opening when disabled', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      component.toggleDropdown();
      fixture.detectChanges();
      expect(
        (component as unknown as { _isOpen: { (): boolean } })._isOpen(),
      ).toBe(false);
    });

    it('should set tabindex=-1 on the trigger when disabled', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      const trigger = hostEl.querySelector(
        '.mlv-date-range-picker__trigger',
      ) as HTMLElement;
      expect(trigger?.getAttribute('tabindex')).toBe('-1');
    });
  });

  // -------------------------------------------------------------------------
  // applySelection
  // -------------------------------------------------------------------------

  describe('applySelection()', () => {
    it('should commit pending range and close the popup', () => {
      const start = new Date(2024, 5, 1);
      const end = new Date(2024, 5, 30);

      component.toggleDropdown();
      fixture.detectChanges();

      component.onRangeChanged({ start, end });
      fixture.detectChanges();

      expect(component.canApply()).toBe(true);

      component.applySelection();
      fixture.detectChanges();

      expect(
        (component as unknown as { _isOpen: { (): boolean } })._isOpen(),
      ).toBe(false);
      expect(component.rangeValue()?.start).toEqual(start);
      expect(component.rangeValue()?.end).toEqual(end);
    });

    it('should update the model with the committed range on apply', () => {
      const start = new Date(2024, 6, 1);
      const end = new Date(2024, 6, 15);

      component.toggleDropdown();
      component.onRangeChanged({ start, end });
      component.applySelection();
      fixture.detectChanges();

      expect(component.value()?.start).toEqual(start);
      expect(component.value()?.end).toEqual(end);
    });
  });

  // -------------------------------------------------------------------------
  // canApply computed
  // -------------------------------------------------------------------------

  describe('canApply()', () => {
    it('should be false when no pending range is set', () => {
      expect(component.canApply()).toBe(false);
    });

    it('should be false when only start date is set', () => {
      component.toggleDropdown();
      component.onRangeChanged({ start: new Date(), end: null });
      fixture.detectChanges();
      expect(component.canApply()).toBe(false);
    });

    it('should be true when both start and end are set', () => {
      component.toggleDropdown();
      component.onRangeChanged({
        start: new Date(2024, 0, 1),
        end: new Date(2024, 0, 31),
      });
      fixture.detectChanges();
      expect(component.canApply()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // clearSelection
  // -------------------------------------------------------------------------

  describe('clearSelection()', () => {
    it('should reset rangeValue to null', () => {
      component.value.set({ start: new Date(), end: new Date() });
      component.clearSelection();
      fixture.detectChanges();
      expect(component.rangeValue()).toBeNull();
    });

    it('should reset display values to empty strings', () => {
      component.value.set({
        start: new Date(2024, 0, 5),
        end: new Date(2024, 0, 15),
      });
      component.clearSelection();
      fixture.detectChanges();
      expect(component.startDisplayValue).toBe('');
      expect(component.endDisplayValue).toBe('');
    });
  });
});

// ---------------------------------------------------------------------------
// MlvDateRangePicker — Reactive Forms integration
// ---------------------------------------------------------------------------

describe('MlvDateRangePicker (Reactive Forms)', () => {
  let fixture: ComponentFixture<ReactiveFormHostComponent>;
  let host: ReactiveFormHostComponent;
  let hostEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReactiveFormHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ReactiveFormHostComponent);
    host = fixture.componentInstance;
    hostEl = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should reflect FormControl value when set programmatically', () => {
    const start = new Date(2024, 8, 1);
    const end = new Date(2024, 8, 30);
    host.ctrl.setValue({ start, end });
    fixture.detectChanges();

    const picker = hostEl.querySelector('mlv-date-range-picker') as HTMLElement;
    // The trigger should now show start/end display values (not placeholder)
    const placeholder = picker.querySelector(
      '.mlv-date-range-picker__placeholder',
    );
    expect(placeholder).toBeNull();
  });

  it('should disable the trigger when FormControl is disabled', () => {
    host.ctrl.disable();
    fixture.detectChanges();

    const picker = hostEl.querySelector('mlv-date-range-picker') as HTMLElement;
    expect(picker.classList).toContain('mlv-date-range-picker--disabled');
  });

  it('should re-enable the trigger when FormControl is enabled', () => {
    host.ctrl.disable();
    fixture.detectChanges();
    host.ctrl.enable();
    fixture.detectChanges();

    const picker = hostEl.querySelector('mlv-date-range-picker') as HTMLElement;
    expect(picker.classList).not.toContain('mlv-date-range-picker--disabled');
  });
});

// ---------------------------------------------------------------------------
// MlvDateRangePicker — popup focus management
// ---------------------------------------------------------------------------

describe('MlvDateRangePicker (focus management)', () => {
  let component: MlvDateRangePicker<Date>;
  let fixture: ComponentFixture<MlvDateRangePicker<Date>>;
  let hostEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvDateRangePicker],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvDateRangePicker<Date>);
    component = fixture.componentInstance;
    hostEl = fixture.nativeElement;
    document.body.appendChild(hostEl);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    hostEl.remove();
  });

  it('moves focus into the popup panel when it opens', async () => {
    component.toggleDropdown();
    fixture.detectChanges();
    await fixture.whenStable();

    (component as unknown as { _onPanelOpened(): void })._onPanelOpened();

    const panel = document.getElementById(component.panelId());
    expect(panel).not.toBeNull();
    expect(panel?.contains(document.activeElement)).toBe(true);
  });

  it('returns focus to the trigger when the popup closes', async () => {
    const trigger = hostEl.querySelector(
      '.mlv-date-range-picker__trigger',
    ) as HTMLElement;
    trigger.focus();

    component.toggleDropdown();
    fixture.detectChanges();
    await fixture.whenStable();

    (component as unknown as { _onPanelClosed(): void })._onPanelClosed();
    fixture.detectChanges();

    expect(document.activeElement).toBe(trigger);
  });
});

// ---------------------------------------------------------------------------
// Two-panel month coordination (#138)
// ---------------------------------------------------------------------------

describe('MlvDateRangePicker — the two panels show consecutive months', () => {
  let component: MlvDateRangePicker<Date>;
  let fixture: ComponentFixture<MlvDateRangePicker<Date>>;

  /**
   * The month label each panel paints, in DOM order.
   *
   * Read from the rendered header rather than from either calendar's
   * `activeDate`, because the defect this covers was precisely that the
   * parent's computed said one thing and the panel painted another.
   */
  const panelMonths = (): string[] =>
    Array.from(document.querySelectorAll('mlv-calendar')).map(
      (el) =>
        el.querySelector('.mlv-calendar__header-button')?.textContent?.trim() ??
        '(none)',
    );

  const setRange = async (start: Date | null, end: Date | null) => {
    component.onRangeChanged({ start, end });
    fixture.detectChanges();
    await fixture.whenStable();
  };

  /** Clicks a day cell by its visible number, the way a user selects a date. */
  const clickDay = async (panelIndex: number, day: number) => {
    const panel = document.querySelectorAll('mlv-calendar')[panelIndex];
    const cell = Array.from(
      panel.querySelectorAll<HTMLElement>('.mlv-calendar__day'),
    ).find((e) => e.textContent?.trim() === String(day));
    expect(cell).toBeTruthy();
    cell?.click();
    fixture.detectChanges();
    await fixture.whenStable();
  };

  /** The day number each panel currently marks as active (roving tabindex). */
  const activeDays = (): string[] =>
    Array.from(document.querySelectorAll('mlv-calendar')).map(
      (c) =>
        c
          .querySelector('.mlv-calendar__day[tabindex="0"]')
          ?.textContent?.trim() ?? '(none)',
    );

  const pressKey = async (panelIndex: number, key: string) => {
    const panel = document.querySelectorAll('mlv-calendar')[panelIndex];
    const grid = panel.querySelector('[role="grid"]') ?? panel;
    grid.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
  };

  /**
   * Clicks a panel's "next period" chevron.
   *
   * `mlv-calendar` renders both chevrons with the same
   * `.mlv-calendar__nav-button` class and no direction modifier, so they are
   * told apart by DOM order: previous first, next second.
   */
  const navigateNext = async (panelIndex: number) => {
    const panel = document.querySelectorAll('mlv-calendar')[panelIndex];
    const navButtons = panel.querySelectorAll<HTMLButtonElement>(
      '.mlv-calendar__nav-button',
    );
    expect(navButtons.length).toBe(2);
    navButtons[1].click();
    fixture.detectChanges();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvDateRangePicker],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvDateRangePicker<Date>);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    component.toggleDropdown();
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('paints two different months with nothing selected', () => {
    const [left, right] = panelMonths();

    // Before #138 both panels defaulted to `today` independently, so the
    // second panel was a redundant copy of the first.
    expect(left).not.toBe(right);
  });

  it('paints the anchor month and the month after it', async () => {
    // Asserted against literals rather than against the component's own
    // computeds: comparing the DOM to the computeds only proves the two agree,
    // which is exactly what was already true before #138 -- both were correct
    // and neither reached the template.
    await setRange(new Date(2026, 0, 15), null);

    expect(panelMonths()).toEqual(['January 2026', 'February 2026']);
  });

  it('keeps the offset once a start date is picked', async () => {
    await setRange(new Date(2026, 8, 20), null);

    expect(panelMonths()).toEqual(['September 2026', 'October 2026']);
  });

  it('keeps the left panel on the start month once the range spans two months', async () => {
    await setRange(new Date(2026, 8, 20), new Date(2026, 9, 4));

    // `MlvCalendar`'s range effect anchors on `end ?? start`. Both panels are
    // handed the same `rangeValue`, so before #138 both self-snapped onto the
    // end month and the picker painted "October 2026" twice -- losing the very
    // month the user picked the start date in.
    expect(panelMonths()).toEqual(['September 2026', 'October 2026']);
  });

  it('moves both panels when the left one navigates forward', async () => {
    await setRange(new Date(2026, 8, 20), null);
    await navigateNext(0);

    expect(panelMonths()).toEqual(['October 2026', 'November 2026']);
  });

  it('moves both panels when the right one navigates forward', async () => {
    await setRange(new Date(2026, 8, 20), null);
    await navigateNext(1);

    // The panels are locked one month apart, so navigating either moves both
    // and the left can never overtake the right.
    expect(panelMonths()).toEqual(['October 2026', 'November 2026']);
  });

  it('never lets the two panels land on the same month across a year boundary', async () => {
    await setRange(new Date(2026, 11, 15), null);

    expect(panelMonths()).toEqual(['December 2026', 'January 2027']);
  });
  it('shifts both panels forward when the start is picked in the right panel', async () => {
    // Derived from the rendered months rather than asserted against literals:
    // with nothing selected the anchor is `today`, and this describe block
    // does not fake the clock.
    const [leftBefore, rightBefore] = panelMonths();

    // Nothing selected yet, so the anchor follows the range start. Clicking in
    // the right panel makes that day the start, which legitimately moves the
    // anchor a month forward -- the pair goes from M / M+1 to M+1 / M+2.
    await clickDay(1, 15);

    const [leftAfter, rightAfter] = panelMonths();
    expect(leftAfter).toBe(rightBefore);
    expect(leftAfter).not.toBe(leftBefore);
    expect(rightAfter).not.toBe(rightBefore);
  });

  it('leaves both panels in place when the end is picked in the right panel', async () => {
    await setRange(new Date(2026, 8, 20), null);

    await clickDay(1, 31);

    // A start already exists, so this click sets the *end*. The anchor still
    // reads the start, so neither month moves.
    expect(panelMonths()).toEqual(['September 2026', 'October 2026']);
  });

  it('keeps the focus ring on the clicked day in the right panel', async () => {
    await setRange(new Date(2026, 8, 20), null);
    await clickDay(1, 31);

    // The anchor round-trips through `addCalendarMonths(-1)` / `(+1)`, which
    // clamps: anchoring on a raw `activeDate` turned 31 Oct into 30 Oct and
    // left the focus ring on a different cell than the one clicked.
    expect(panelMonths()).toEqual(['September 2026', 'October 2026']);
    expect(activeDays()[1]).toBe('31');
  });

  it('reaches the last day of a 31-day month from the keyboard', async () => {
    await setRange(new Date(2026, 8, 20), null);
    await clickDay(1, 1);
    await pressKey(1, 'End');

    // Clamping made 31 October unreachable: `End` landed on the 30th and
    // ArrowRight could not move past it.
    expect(activeDays()[1]).toBe('31');
    expect(panelMonths()).toEqual(['September 2026', 'October 2026']);
  });

  it('reaches the last day of March, whose predecessor is the shortest month', async () => {
    await setRange(new Date(2026, 1, 10), null);
    await clickDay(1, 1);
    await pressKey(1, 'End');

    // The worst case: 31 Mar -> 28 Feb -> 28 Mar, three days lost.
    expect(activeDays()[1]).toBe('31');
    expect(panelMonths()).toEqual(['February 2026', 'March 2026']);
  });

  it('does not move the panels when a day inside the shown month is clicked', async () => {
    await setRange(new Date(2026, 8, 20), null);
    await clickDay(0, 3);

    expect(panelMonths()).toEqual(['September 2026', 'October 2026']);
  });

  it('keeps following the selection after a day click that changed no month', async () => {
    await setRange(new Date(2026, 8, 20), null);
    await clickDay(0, 3);

    // A day-level move must not pin the anchor. If it did, the panels would
    // stop following the selection for the rest of the session -- the next
    // range set from outside would leave them stranded on September.
    await setRange(new Date(2026, 11, 2), null);

    expect(panelMonths()).toEqual(['December 2026', 'January 2027']);
  });

  it('reopens on the selection rather than where navigation left it', async () => {
    await setRange(new Date(2026, 8, 20), null);
    await navigateNext(0);
    expect(panelMonths()).toEqual(['October 2026', 'November 2026']);

    component.toggleDropdown();
    fixture.detectChanges();
    await fixture.whenStable();
    component.toggleDropdown();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(panelMonths()).toEqual(['September 2026', 'October 2026']);
  });
});
