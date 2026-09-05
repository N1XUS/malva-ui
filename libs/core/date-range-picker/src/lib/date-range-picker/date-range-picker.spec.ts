import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { Component, signal, type WritableSignal } from '@angular/core';
import { MlvBreakpointService, type MlvBreakpoint } from '@malva-ui/cdk/utils';
import { By } from '@angular/platform-browser';
import { MlvPopup } from '@malva-ui/core/popup';
import { MlvDateRangePicker } from './date-range-picker';
import type { MlvDateRangePickerValue } from './date-range-picker';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as Sass from 'sass';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';

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
// Breakpoint stub
// ---------------------------------------------------------------------------

/**
 * Stubs {@link MlvBreakpointService} so the sheet/dropdown switch can be driven
 * from the spec. jsdom's `matchMedia` never matches a `min-width` query, so the
 * real service is pinned to `'sm'` and `isFullscreen()` is stuck `true` — which
 * cannot prove anything about the anchored dropdown. Since #130 the two modes
 * render different templates rather than the same one styled two ways, so
 * **every** suite that opens the popup has to say which one it means.
 */
class FakeBreakpointService {
  readonly down: WritableSignal<boolean> = signal(false);
  isDown(_bp: MlvBreakpoint): WritableSignal<boolean> {
    return this.down;
  }
  isUp(_bp: MlvBreakpoint): WritableSignal<boolean> {
    return signal(false);
  }
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
      providers: [
        provideMlvI18nTesting(),
        // These are claims about the *anchored dropdown*'s two panels, and
        // since #130 the sheet renders a different template with no
        // `mlv-calendar` in it at all. Left to jsdom's `matchMedia`, the popup
        // would be full-screen and every one of them would read an empty DOM.
        { provide: MlvBreakpointService, useClass: FakeBreakpointService },
      ],
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

// ---------------------------------------------------------------------------
// Stylesheet — compiled once; assertions read declarations by selector.
// ---------------------------------------------------------------------------

// `sass` is a Node-only dependency; loading it through `createRequire` keeps
// it out of the browser-ish module graph vitest builds for this project.
const nodeRequire = createRequire(import.meta.url);
const sass = nodeRequire('sass') as typeof Sass;

/**
 * Declarations of every emitted rule whose selector list contains exactly
 * `selector`, joined. Sass splits a block around a nested rule and emits
 * shared declarations under one comma-separated selector list, so one
 * selector can own several blocks and share others.
 */
function cssRule(css: string, selector: string): string {
  const bodies: string[] = [];
  for (const [, head, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = head
      .trim()
      .split(/,\s*/)
      .map((candidate) => candidate.trim());
    if (selectors.includes(selector)) bodies.push(body);
  }
  expect(bodies.length, `rule "${selector}" is emitted`).toBeGreaterThan(0);
  return bodies.join('\n');
}

describe('MlvDateRangePicker stylesheet', () => {
  const css = stripCssLayersFromText(
    sass.compile(
      resolve(
        dirname(fileURLToPath(import.meta.url)),
        'date-range-picker.scss',
      ),
    ).css,
  );

  // A control with no value shows its `placeholder` as a rendered span where
  // an input shows it through `::placeholder`. Both are placeholder text and
  // read the same token — `--mlv-text-tertiary`, the placeholder/disabled step
  // of the text ramp that mlv-input, mlv-textarea and mlv-number-input use —
  // so a form that mixes the controls shows one placeholder grey, not two.
  it('paints the placeholder with the shared placeholder token', () => {
    expect(cssRule(css, '.mlv-date-range-picker__placeholder')).toContain(
      'color: var(--mlv-text-tertiary)',
    );
  });
});

// ---------------------------------------------------------------------------
// MlvDateRangePicker — mobile full-screen sheet (#130)
// ---------------------------------------------------------------------------

describe('MlvDateRangePicker (mobile full-screen sheet)', () => {
  let component: MlvDateRangePicker<Date>;
  let fixture: ComponentFixture<MlvDateRangePicker<Date>>;
  let hostEl: HTMLElement;
  let breakpoint: FakeBreakpointService;

  /** The panel element, which the popup renders into a CDK overlay. */
  const panel = (): HTMLElement | null =>
    document.getElementById(component.panelId());

  /** The trigger's `aria-expanded`, i.e. whether the popup is open to a user. */
  const expanded = (): string | null =>
    hostEl
      .querySelector('.mlv-date-range-picker__trigger')
      ?.getAttribute('aria-expanded') ?? null;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvDateRangePicker],
      providers: [
        provideMlvI18nTesting(),
        { provide: MlvBreakpointService, useClass: FakeBreakpointService },
      ],
    }).compileComponents();

    breakpoint = TestBed.inject(
      MlvBreakpointService,
    ) as unknown as FakeBreakpointService;

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

  /** Opens the popup so the panel is stamped into the overlay. */
  async function open(): Promise<void> {
    component.toggleDropdown();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  /**
   * The sheet header's dismiss control. `mlv-button-close` puts the click
   * handler on its own host, so either the host or its inner `<button>`
   * dismisses; the inner one is what a user actually hits.
   */
  const sheetCloseButton = (): HTMLElement => {
    const host = document.querySelector<HTMLElement>('.mlv-popup__close');
    if (!host) throw new Error('the sheet header renders no close button');
    return host.querySelector('button') ?? host;
  };

  /** The sheet's day button for an ISO date, if the month list renders it. */
  const sheetDay = (iso: string): HTMLButtonElement => {
    const button = panel()?.querySelector<HTMLButtonElement>(
      `[data-date="${iso}"] .mlv-calendar-sheet__day`,
    );
    if (!button) throw new Error(`sheet renders no day button for ${iso}`);
    return button;
  };

  /** Clicks a sheet day and flushes. */
  const clickSheetDay = async (iso: string): Promise<void> => {
    sheetDay(iso).click();
    fixture.detectChanges();
    await fixture.whenStable();
  };

  /** `YYYY-MM-DD` for a date, matching the adapter's `data-date` hook. */
  const iso = (date: Date): string =>
    `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;

  it('renders the calendar sheet instead of the two anchored panels', async () => {
    // The sheet is not the dropdown with one month hidden — it is a different
    // body. #121 hid `--end` with `display: none`; #130 stops rendering the row
    // at all, which is what lets a cross-month range be visible end to end.
    breakpoint.down.set(true);
    await open();

    expect(panel()?.querySelectorAll('mlv-calendar-sheet').length).toBe(1);
    expect(
      panel()?.querySelectorAll('.mlv-date-range-picker__calendar').length,
    ).toBe(0);
    expect(panel()?.querySelectorAll('mlv-calendar').length).toBe(0);
  });

  it('leaves the anchored dropdown on the two-panel body', async () => {
    breakpoint.down.set(false);
    await open();

    expect(panel()?.querySelectorAll('mlv-calendar-sheet').length).toBe(0);
    expect(
      panel()?.querySelectorAll('.mlv-date-range-picker__calendar').length,
    ).toBe(2);
    expect(
      panel()?.querySelectorAll('.mlv-date-range-picker__calendar--end').length,
    ).toBe(1);
  });

  it('marks the panel as a sheet when the popup goes full-screen', async () => {
    breakpoint.down.set(true);
    await open();
    expect(
      panel()?.classList.contains('mlv-date-range-picker__panel--sheet'),
    ).toBe(true);
  });

  it('leaves the anchored dropdown unmarked', async () => {
    // The modifier no longer hides anything; it hands the sheet body the height
    // the popup resolved. An anchored pane is sized to its content, so it must
    // not claim `height: 100%` against an ancestor chain that has no definite
    // height to give.
    breakpoint.down.set(false);
    await open();
    expect(
      panel()?.classList.contains('mlv-date-range-picker__panel--sheet'),
    ).toBe(false);
  });

  it('swaps the body when the breakpoint changes while the popup is open', async () => {
    // The *panel contents* follow the breakpoint mid-open, because the `@if`
    // and the modifier both read `isFullscreen()` on every pass.
    // `MlvPopupContainer` does not: it snapshots `fullscreen` once at attach, so
    // the pane's position strategy, fullscreen pane class, backdrop and scroll
    // strategy all stay as they were when it opened — see #144. This asserts
    // the half that works; do not read it as proof the popup becomes a real
    // sheet here.
    breakpoint.down.set(false);
    await open();
    expect(panel()?.querySelectorAll('mlv-calendar-sheet').length).toBe(0);

    breakpoint.down.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(
      panel()?.classList.contains('mlv-date-range-picker__panel--sheet'),
    ).toBe(true);
    expect(panel()?.querySelectorAll('mlv-calendar-sheet').length).toBe(1);
  });

  it('assembles a cross-month range without leaving the scroll', async () => {
    // The claim the sheet exists for. #121's one-month panel could only reach a
    // second month by navigating away from the first; the continuous list has
    // both on screen, so the two endpoints are two taps in the same scroll.
    breakpoint.down.set(true);
    await open();

    // Derived, not literals: this suite does not fake the clock. Both months
    // sit well inside the sheet's default ±12-month window.
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth() + 1, 20);
    const end = new Date(today.getFullYear(), today.getMonth() + 2, 15);

    await clickSheetDay(iso(start));
    await clickSheetDay(iso(end));

    expect(component.canApply()).toBe(true);
    // Both endpoints are rendered at once — the assertion the one-month panel
    // could not make, because only the start month was ever on screen.
    expect(sheetDay(iso(start)).isConnected).toBe(true);
    expect(sheetDay(iso(end)).isConnected).toBe(true);
  });

  it('confirms the pending range through the header Done action', async () => {
    breakpoint.down.set(true);
    await open();

    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth() + 1, 10);
    const end = new Date(today.getFullYear(), today.getMonth() + 2, 4);

    await clickSheetDay(iso(start));
    await clickSheetDay(iso(end));
    // A tap is pending only: nothing is committed until Done.
    expect(component.value()).toBeNull();

    const done = document.querySelector<HTMLButtonElement>(
      '.mlv-date-range-picker__done',
    );
    if (!done) throw new Error('the sheet header renders no Done action');
    done.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.value()?.start?.getMonth()).toBe(start.getMonth());
    expect(component.value()?.end?.getMonth()).toBe(end.getMonth());
    expect(expanded()).toBe('false');
  });

  it('discards the pending range when the sheet is dismissed', async () => {
    breakpoint.down.set(true);
    await open();

    const today = new Date();
    await clickSheetDay(
      iso(new Date(today.getFullYear(), today.getMonth() + 1, 10)),
    );
    await clickSheetDay(
      iso(new Date(today.getFullYear(), today.getMonth() + 1, 18)),
    );

    sheetCloseButton().click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.value()).toBeNull();
    expect(expanded()).toBe('false');
  });

  it('keeps Done out of the anchored dropdown, which confirms in its footer', async () => {
    breakpoint.down.set(false);
    await open();

    expect(
      document.querySelectorAll('.mlv-date-range-picker__done').length,
    ).toBe(0);
    expect(
      panel()?.querySelectorAll('.mlv-date-range-picker__apply-btn').length,
    ).toBe(1);
  });

  it('leaves the focus trap to the popup in the sheet', async () => {
    // The panel is only part of the sheet: the popup's own header row — with
    // the Done action and the dismiss button — sits outside it. A trap on the
    // panel would fence Tab inside the month list and put both of those out of
    // keyboard reach, so the sheet hands trapping to `mlv-popup`, which wraps
    // the whole surface.
    //
    // A disabled `cdkTrapFocus` keeps its anchors in the DOM and strips their
    // `tabindex` instead of removing them, so the attribute is what says
    // whether the trap is live (`FocusTrap._toggleAnchorTabIndex`).
    breakpoint.down.set(true);
    await open();

    const anchors = Array.from(
      panel()?.parentElement?.querySelectorAll<HTMLElement>(
        '.cdk-focus-trap-anchor',
      ) ?? [],
    );

    expect(anchors.length).toBeGreaterThan(0);
    expect(anchors.map((a) => a.getAttribute('tabindex'))).toEqual(
      anchors.map(() => null),
    );
  });

  it('keeps the focus trap on the anchored dropdown', async () => {
    // The dropdown is the whole surface, so it traps for itself.
    breakpoint.down.set(false);
    await open();

    const anchors = Array.from(
      panel()?.parentElement?.querySelectorAll<HTMLElement>(
        '.cdk-focus-trap-anchor',
      ) ?? [],
    );

    expect(anchors.length).toBeGreaterThan(0);
    expect(anchors.map((a) => a.getAttribute('tabindex'))).toEqual(
      anchors.map(() => '0'),
    );
  });

  it("lands focus on the sheet's day grid, not the year strip", async () => {
    // The year strip's listbox is the first tabbable node in the sheet, so the
    // generic first-tabbable scan would leave a keyboard user on the year
    // scrubber with the calendar untouched.
    breakpoint.down.set(true);
    await open();

    (component as unknown as { _onPanelOpened(): void })._onPanelOpened();

    expect(
      document.activeElement?.classList.contains('mlv-calendar-sheet__day'),
    ).toBe(true);
  });

  it('announces no month group in the sheet', async () => {
    // "Start month" / "End month" name the two panels apart. The sheet has one
    // continuous list, so there is nothing to tell apart and the labels would
    // announce a structure that is not there.
    //
    // Scoped to the panel wrappers that carry those names rather than to every
    // `role="group"`: the sheet's own scrolling month list is a labelled group
    // too, and it is the one thing here that should be announced.
    breakpoint.down.set(true);
    await open();

    expect(
      panel()?.querySelectorAll('.mlv-date-range-picker__calendar').length,
    ).toBe(0);
    expect(
      panel()?.querySelectorAll('.mlv-date-range-picker__calendars').length,
    ).toBe(0);
  });

  it('still names both month groups in the anchored dropdown', async () => {
    breakpoint.down.set(false);
    await open();

    const groups = Array.from(
      panel()?.querySelectorAll('.mlv-date-range-picker__calendar') ?? [],
    ).map((g) => [g.getAttribute('role'), g.getAttribute('aria-label')]);

    expect(groups.length).toBe(2);
    expect(groups[0][0]).toBe('group');
    expect(groups[0][1]).toBeTruthy();
    expect(groups[1][0]).toBe('group');
    expect(groups[1][1]).toBeTruthy();
    expect(groups[0][1]).not.toBe(groups[1][1]);
  });

  it('renders the same sheet body in RTL', async () => {
    // Which body the panel gets is a breakpoint question, not a direction one.
    // The sheet mirrors inside itself (see `calendar-sheet-rtl.spec.ts`); a
    // mirrored document must not change what is rendered.
    document.documentElement.setAttribute('dir', 'rtl');
    try {
      breakpoint.down.set(true);
      await open();
      expect(
        panel()?.classList.contains('mlv-date-range-picker__panel--sheet'),
      ).toBe(true);
      expect(panel()?.querySelectorAll('mlv-calendar-sheet').length).toBe(1);
      expect(
        panel()?.querySelectorAll('.mlv-date-range-picker__calendar').length,
      ).toBe(0);
    } finally {
      document.documentElement.removeAttribute('dir');
    }
  });
});
