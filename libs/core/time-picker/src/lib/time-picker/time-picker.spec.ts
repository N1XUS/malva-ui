import { Component, DOCUMENT, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { By } from '@angular/platform-browser';
import { MlvPopup } from '@malva-ui/core/popup';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { MlvTimePicker } from './time-picker';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

// ---------------------------------------------------------------------------
// Host wrapper for interaction tests
// ---------------------------------------------------------------------------

@Component({
  imports: [MlvTimePicker, ReactiveFormsModule],
  template: `
    <mlv-time-picker
      [label]="label()"
      [hint]="hint()"
      [message]="message()"
      [state]="state()"
      [mode]="mode()"
      [showSeconds]="showSeconds()"
      [disabled]="disabled()"
      [ariaLabel]="ariaLabel()"
    />
  `,
})
class HostComponent {
  label = signal('');
  hint = signal('');
  message = signal('');
  state = signal<'default' | 'success' | 'info' | 'warning' | 'error'>(
    'default',
  );
  mode = signal<'24h' | '12h'>('24h');
  showSeconds = signal(false);
  disabled = signal(false);
  ariaLabel = signal('Time picker');
}

@Component({
  imports: [MlvTimePicker, ReactiveFormsModule],
  template: `<mlv-time-picker
    [formControl]="ctrl"
    [mode]="mode()"
    [showSeconds]="showSeconds()"
  />`,
})
class ReactiveFormHostComponent {
  ctrl = new FormControl<string>('', { nonNullable: true });
  mode = signal<'24h' | '12h'>('24h');
  showSeconds = signal(false);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTrigger(el: HTMLElement): HTMLElement {
  return el.querySelector('.mlv-time-picker__trigger') as HTMLElement;
}

function getWrapper(el: HTMLElement): HTMLElement {
  return el.querySelector('mlv-form-control-wrapper') as HTMLElement;
}

function openPopup(el: HTMLElement, fixture: ComponentFixture<unknown>): void {
  const trigger = getTrigger(el);
  trigger.click();
  fixture.detectChanges();
}

function getAllListboxes(overlay: HTMLElement): NodeListOf<HTMLElement> {
  return overlay.querySelectorAll<HTMLElement>('[role="listbox"]');
}

function getListbox(overlay: HTMLElement, index: number): HTMLElement {
  return getAllListboxes(overlay)[index] as HTMLElement;
}

function getSelectedOption(listbox: HTMLElement): HTMLElement | null {
  return listbox.querySelector<HTMLElement>('[aria-selected="true"]');
}

// ---------------------------------------------------------------------------
// MlvTimePicker — basic creation
// ---------------------------------------------------------------------------

describe('MlvTimePicker', () => {
  let component: MlvTimePicker;
  let fixture: ComponentFixture<MlvTimePicker>;
  let hostEl: HTMLElement;
  let overlayContainerEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvTimePicker],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvTimePicker);
    component = fixture.componentInstance;
    hostEl = fixture.nativeElement;
    overlayContainerEl = TestBed.inject(OverlayContainer).getContainerElement();
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('opts the time popup into auto mobile fullscreen mode', () => {
    const popup = fixture.debugElement.query(By.directive(MlvPopup))
      .componentInstance as MlvPopup;
    expect(popup.mobileMode()).toBe('auto');
  });

  // ---------------------------------------------------------------------------
  // Host classes
  // ---------------------------------------------------------------------------

  describe('host classes', () => {
    it('should always have mlv-time-picker class', () => {
      expect(hostEl.classList).toContain('mlv-time-picker');
    });

    it('should not have disabled class by default', () => {
      expect(hostEl.classList).not.toContain('mlv-time-picker--disabled');
    });

    it('should add disabled class when disabled input is true', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      expect(hostEl.classList).toContain('mlv-time-picker--disabled');
    });

    it('should add 12h class when mode is 12h', () => {
      fixture.componentRef.setInput('mode', '12h');
      fixture.detectChanges();
      expect(hostEl.classList).toContain('mlv-time-picker--12h');
    });

    it('should add with-seconds class when showSeconds is true', () => {
      fixture.componentRef.setInput('showSeconds', true);
      fixture.detectChanges();
      expect(hostEl.classList).toContain('mlv-time-picker--with-seconds');
    });

    it('should add open class when popup is open', () => {
      openPopup(hostEl, fixture);
      expect(hostEl.classList).toContain('mlv-time-picker--open');
    });

    it('should add state class to host matching the state input', () => {
      fixture.componentRef.setInput('state', 'error');
      fixture.detectChanges();
      expect(hostEl.classList).toContain('mlv-time-picker--error');
    });

    it('should have default state class by default', () => {
      expect(hostEl.classList).toContain('mlv-time-picker--default');
    });
  });

  // ---------------------------------------------------------------------------
  // Form control wrapper integration
  // ---------------------------------------------------------------------------

  describe('form control wrapper', () => {
    it('should have state-default class on wrapper by default', () => {
      const wrapper = getWrapper(hostEl);
      expect(wrapper.classList).toContain(
        'mlv-form-control-wrapper--state-default',
      );
    });

    it('should apply state class to wrapper matching the state input', () => {
      fixture.componentRef.setInput('state', 'error');
      fixture.detectChanges();
      const wrapper = getWrapper(hostEl);
      expect(wrapper.classList).toContain(
        'mlv-form-control-wrapper--state-error',
      );
    });

    it('should add focused class to wrapper when popup is open', () => {
      openPopup(hostEl, fixture);
      const wrapper = getWrapper(hostEl);
      expect(wrapper.classList).toContain('mlv-form-control-wrapper--focused');
    });

    it('should add focused class to wrapper when trigger is focused', () => {
      const trigger = getTrigger(hostEl);
      trigger.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
      fixture.detectChanges();
      const wrapper = getWrapper(hostEl);
      expect(wrapper.classList).toContain('mlv-form-control-wrapper--focused');
    });

    it('should remove focused class from wrapper when trigger loses focus', () => {
      const trigger = getTrigger(hostEl);
      trigger.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
      fixture.detectChanges();
      trigger.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
      fixture.detectChanges();
      const wrapper = getWrapper(hostEl);
      expect(wrapper.classList).not.toContain(
        'mlv-form-control-wrapper--focused',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Trigger display
  // ---------------------------------------------------------------------------

  describe('trigger display', () => {
    it('should render trigger with combobox role', () => {
      const trigger = getTrigger(hostEl);
      expect(trigger.getAttribute('role')).toBe('combobox');
    });

    it('should show formatted time value in trigger', () => {
      component.value.set('14:30');
      fixture.detectChanges();
      const value = hostEl.querySelector(
        '.mlv-time-picker__value',
      ) as HTMLElement;
      expect(value.textContent?.trim()).toBe('14:30');
    });

    it('should show AM/PM suffix in 12h mode', () => {
      fixture.componentRef.setInput('mode', '12h');
      fixture.detectChanges();
      component.value.set('15:00');
      fixture.detectChanges();
      const value = hostEl.querySelector(
        '.mlv-time-picker__value',
      ) as HTMLElement;
      expect(value.textContent?.trim()).toBe('03:00 PM');
    });

    it('should show 12:00 AM for midnight in 12h mode', () => {
      fixture.componentRef.setInput('mode', '12h');
      fixture.detectChanges();
      component.value.set('00:00');
      fixture.detectChanges();
      const value = hostEl.querySelector(
        '.mlv-time-picker__value',
      ) as HTMLElement;
      expect(value.textContent?.trim()).toBe('12:00 AM');
    });

    it('should show 12:00 PM for noon in 12h mode', () => {
      fixture.componentRef.setInput('mode', '12h');
      fixture.detectChanges();
      component.value.set('12:00');
      fixture.detectChanges();
      const value = hostEl.querySelector(
        '.mlv-time-picker__value',
      ) as HTMLElement;
      expect(value.textContent?.trim()).toBe('12:00 PM');
    });

    it('should show seconds in trigger when showSeconds is true', () => {
      fixture.componentRef.setInput('showSeconds', true);
      fixture.detectChanges();
      component.value.set('14:30:45');
      fixture.detectChanges();
      const value = hostEl.querySelector(
        '.mlv-time-picker__value',
      ) as HTMLElement;
      expect(value.textContent?.trim()).toBe('14:30:45');
    });

    it('should render clock icon', () => {
      const icon = hostEl.querySelector(
        '.mlv-time-picker__icon svg',
      ) as SVGElement;
      expect(icon).toBeTruthy();
    });

    it('should have aria-expanded=false when popup is closed', () => {
      const trigger = getTrigger(hostEl);
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });

    it('should have aria-expanded=true when popup is open', () => {
      openPopup(hostEl, fixture);
      const trigger = getTrigger(hostEl);
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });

    it('should apply ariaLabel to the trigger', () => {
      fixture.componentRef.setInput('ariaLabel', 'Custom label');
      fixture.detectChanges();
      const trigger = getTrigger(hostEl);
      expect(trigger.getAttribute('aria-label')).toBe('Custom label');
    });

    it('should set aria-disabled on trigger when disabled', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      const trigger = getTrigger(hostEl);
      expect(trigger.getAttribute('aria-disabled')).toBe('true');
    });

    it('should have aria-haspopup="dialog" on trigger', () => {
      const trigger = getTrigger(hostEl);
      expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    });

    it('should set tabindex=-1 on trigger when disabled', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      const trigger = getTrigger(hostEl);
      expect(trigger.getAttribute('tabindex')).toBe('-1');
    });

    it('should set tabindex=0 on trigger when not disabled', () => {
      const trigger = getTrigger(hostEl);
      expect(trigger.getAttribute('tabindex')).toBe('0');
    });
  });

  // ---------------------------------------------------------------------------
  // Popup structure — 24h mode
  // ---------------------------------------------------------------------------

  describe('popup structure (24h default)', () => {
    beforeEach(() => {
      openPopup(hostEl, fixture);
    });

    it('should render panel with role=group', () => {
      const panel = overlayContainerEl.querySelector(
        '.mlv-time-picker__panel',
      ) as HTMLElement;
      expect(panel).toBeTruthy();
      expect(panel.getAttribute('role')).toBe('group');
    });

    it('should render hours and minutes listboxes', () => {
      const listboxes = getAllListboxes(overlayContainerEl);
      expect(listboxes.length).toBe(2);
    });

    it('should not render seconds column by default', () => {
      const listboxes = getAllListboxes(overlayContainerEl);
      expect(listboxes.length).toBe(2);
    });

    it('should render seconds column when showSeconds is true', () => {
      // Close first, change input, reopen
      component.isOpen.set(false);
      fixture.detectChanges();
      fixture.componentRef.setInput('showSeconds', true);
      fixture.detectChanges();
      openPopup(hostEl, fixture);

      const listboxes = getAllListboxes(overlayContainerEl);
      expect(listboxes.length).toBe(3);
    });

    it('should not render AM/PM buttons in 24h mode', () => {
      const ampmBtns = overlayContainerEl.querySelectorAll(
        '.mlv-time-picker__ampm .mlv-button',
      );
      expect(ampmBtns.length).toBe(0);
    });

    it('should render divider between hours and minutes', () => {
      const dividers = overlayContainerEl.querySelectorAll(
        '.mlv-time-picker__divider',
      );
      expect(dividers.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Popup structure — 12h mode
  // ---------------------------------------------------------------------------

  describe('popup structure (12h mode)', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('mode', '12h');
      fixture.detectChanges();
      openPopup(hostEl, fixture);
    });

    it('should render AM and PM buttons', () => {
      const ampmBtns = overlayContainerEl.querySelectorAll(
        '.mlv-time-picker__ampm .mlv-button',
      );
      expect(ampmBtns.length).toBe(2);
    });

    it('should render AM/PM group with role=group and aria-label=Period', () => {
      const group = overlayContainerEl.querySelector(
        '.mlv-time-picker__ampm[role="group"]',
      ) as HTMLElement;
      expect(group).toBeTruthy();
      expect(group.getAttribute('aria-label')).toBe('Period');
    });

    it('should have aria-pressed=true on active period button', () => {
      component.value.set('10:00');
      fixture.detectChanges();
      const amBtn = overlayContainerEl.querySelector(
        '.mlv-time-picker__ampm .mlv-button',
      ) as HTMLButtonElement;
      const pmBtn = overlayContainerEl.querySelectorAll(
        '.mlv-time-picker__ampm .mlv-button',
      )[1] as HTMLButtonElement;
      // 10:00 → AM active
      expect(amBtn.getAttribute('aria-pressed')).toBe('true');
      expect(pmBtn.getAttribute('aria-pressed')).toBe('false');
    });

    it('should switch period to PM when writeValue receives a PM time', () => {
      component.value.set('15:00');
      fixture.detectChanges();
      const pmBtn = overlayContainerEl.querySelectorAll(
        '.mlv-time-picker__ampm .mlv-button',
      )[1] as HTMLButtonElement;
      expect(pmBtn.getAttribute('aria-pressed')).toBe('true');
    });

    it('should show hours 1–12 in hours listbox', () => {
      const hoursListbox = getListbox(overlayContainerEl, 0);
      const options = hoursListbox.querySelectorAll('[role="option"]');
      expect(options.length).toBe(12);
      expect(options[0].textContent?.trim()).toBe('01');
      expect(options[11].textContent?.trim()).toBe('12');
    });
  });

  // ---------------------------------------------------------------------------
  // ARIA attributes in popup
  // ---------------------------------------------------------------------------

  describe('ARIA attributes', () => {
    beforeEach(() => {
      openPopup(hostEl, fixture);
    });

    it('should have role=listbox on each column', () => {
      const listboxes = getAllListboxes(overlayContainerEl);
      listboxes.forEach((lb) => {
        expect(lb.getAttribute('role')).toBe('listbox');
      });
    });

    it('should have aria-label on hours listbox', () => {
      const hoursListbox = getListbox(overlayContainerEl, 0);
      expect(hoursListbox.getAttribute('aria-label')).toBe('Hours');
    });

    it('should have aria-label on minutes listbox', () => {
      const minutesListbox = getListbox(overlayContainerEl, 1);
      expect(minutesListbox.getAttribute('aria-label')).toBe('Minutes');
    });

    it('should have aria-label on seconds listbox when visible', () => {
      component.isOpen.set(false);
      fixture.detectChanges();
      fixture.componentRef.setInput('showSeconds', true);
      fixture.detectChanges();
      openPopup(hostEl, fixture);
      const secondsListbox = getListbox(overlayContainerEl, 2);
      expect(secondsListbox.getAttribute('aria-label')).toBe('Seconds');
    });

    it('should set tabindex=0 on listbox when not disabled', () => {
      const hoursListbox = getListbox(overlayContainerEl, 0);
      expect(hoursListbox.getAttribute('tabindex')).toBe('0');
    });

    it('should set tabindex=-1 on listbox when disabled', () => {
      component.isOpen.set(false);
      fixture.detectChanges();
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      openPopup(hostEl, fixture);
      const hoursListbox = getListbox(overlayContainerEl, 0);
      expect(hoursListbox.getAttribute('tabindex')).toBe('-1');
    });

    it('should have role=option on each list item', () => {
      const hoursListbox = getListbox(overlayContainerEl, 0);
      const options = hoursListbox.querySelectorAll('[role="option"]');
      expect(options.length).toBeGreaterThan(0);
    });

    it('should have aria-activedescendant pointing to an ID without spaces', () => {
      component.value.set('10:30');
      fixture.detectChanges();
      const hoursListbox = getListbox(overlayContainerEl, 0);
      const activeDescendant =
        hoursListbox.getAttribute('aria-activedescendant') ?? '';
      expect(activeDescendant).not.toContain(' ');
      expect(activeDescendant.length).toBeGreaterThan(0);
    });

    it('should have aria-selected=true on the selected option', () => {
      component.value.set('10:30');
      fixture.detectChanges();
      const hoursListbox = getListbox(overlayContainerEl, 0);
      const selected = getSelectedOption(hoursListbox);
      expect(selected).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  // aria-describedby / message integration
  // ---------------------------------------------------------------------------

  describe('aria-describedby', () => {
    it('should not set aria-describedby when no message is present', () => {
      const trigger = getTrigger(hostEl);
      expect(trigger.getAttribute('aria-describedby')).toBeNull();
    });

    it('should set aria-describedby pointing to message element when message is present', () => {
      fixture.componentRef.setInput('message', 'Error text');
      fixture.detectChanges();
      const trigger = getTrigger(hostEl);
      const describedById = trigger.getAttribute('aria-describedby');
      expect(describedById).toBeTruthy();
      // Verify the referenced element exists in the DOM
      const messageEl = hostEl.querySelector(`[id="${describedById}"]`);
      expect(messageEl).toBeTruthy();
      expect(messageEl?.textContent?.trim()).toBe('Error text');
    });
  });

  // ---------------------------------------------------------------------------
  // Signal model writes
  // ---------------------------------------------------------------------------

  describe('value model', () => {
    it('should synchronize programmatic model writes into the display', () => {
      component.value.set('14:30');
      fixture.detectChanges();
      expect(
        hostEl.querySelector('.mlv-time-picker__value')?.textContent?.trim(),
      ).toBe('14:30');
    });
  });

  // ---------------------------------------------------------------------------
  // writeValue / CVA
  // ---------------------------------------------------------------------------

  describe('external value writes', () => {
    beforeEach(() => {
      openPopup(hostEl, fixture);
    });

    it('should parse HH:mm value and reflect in selected options', () => {
      component.value.set('14:30');
      fixture.detectChanges();
      const hoursListbox = getListbox(overlayContainerEl, 0);
      const selected = getSelectedOption(hoursListbox);
      expect(selected?.textContent?.trim()).toBe('14');
    });

    it('should parse minutes correctly', () => {
      component.value.set('09:45');
      fixture.detectChanges();
      const minutesListbox = getListbox(overlayContainerEl, 1);
      const selected = getSelectedOption(minutesListbox);
      expect(selected?.textContent?.trim()).toBe('45');
    });

    it('should parse HH:mm:ss when showSeconds is true', () => {
      component.isOpen.set(false);
      fixture.detectChanges();
      fixture.componentRef.setInput('showSeconds', true);
      fixture.detectChanges();
      openPopup(hostEl, fixture);
      component.value.set('08:05:30');
      fixture.detectChanges();
      const secondsListbox = getListbox(overlayContainerEl, 2);
      const selected = getSelectedOption(secondsListbox);
      expect(selected?.textContent?.trim()).toBe('30');
    });

    // An empty write renders as empty (#348) — it used to seed the drums from
    // the wall clock. `time-picker-empty.spec.ts` covers the behaviour; these
    // pin the write path from a held value, open.
    it.each([
      ['empty string', ''],
      ['null', null as unknown as string],
    ])('should empty the drums when writeValue receives %s', (_, empty) => {
      openPopup(hostEl, fixture);
      component.value.set('08:05');
      fixture.detectChanges();
      expect(getSelectedOption(getListbox(overlayContainerEl, 0))).toBeTruthy();

      component.value.set(empty);
      fixture.detectChanges();

      expect(getSelectedOption(getListbox(overlayContainerEl, 0))).toBeNull();
      expect(getSelectedOption(getListbox(overlayContainerEl, 1))).toBeNull();
      expect(getTrigger(hostEl).textContent ?? '').not.toMatch(/\d\d:\d\d/);
      expect(component.hasValue()).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Disabled input
  // ---------------------------------------------------------------------------

  describe('disabled', () => {
    it('should add disabled class when disabled', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      expect(hostEl.classList).toContain('mlv-time-picker--disabled');
    });

    it('should remove disabled class when re-enabled', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      fixture.componentRef.setInput('disabled', false);
      fixture.detectChanges();
      expect(hostEl.classList).not.toContain('mlv-time-picker--disabled');
    });
  });

  // ---------------------------------------------------------------------------
  // 24h hours range
  // ---------------------------------------------------------------------------

  describe('24h hours column', () => {
    beforeEach(() => {
      openPopup(hostEl, fixture);
    });

    it('should show 24 hour options (0-23) in 24h mode', () => {
      const hoursListbox = getListbox(overlayContainerEl, 0);
      const options = hoursListbox.querySelectorAll('[role="option"]');
      expect(options.length).toBe(24);
    });

    it('should zero-pad single-digit hours', () => {
      const hoursListbox = getListbox(overlayContainerEl, 0);
      const firstOption = hoursListbox.querySelector('[role="option"]');
      expect(firstOption?.textContent?.trim()).toBe('00');
    });
  });

  // ---------------------------------------------------------------------------
  // Minutes column
  // ---------------------------------------------------------------------------

  describe('minutes column', () => {
    beforeEach(() => {
      openPopup(hostEl, fixture);
    });

    it('should show 60 minute options (0–59)', () => {
      const minutesListbox = getListbox(overlayContainerEl, 1);
      const options = minutesListbox.querySelectorAll('[role="option"]');
      expect(options.length).toBe(60);
    });

    it('should zero-pad single-digit minutes', () => {
      const minutesListbox = getListbox(overlayContainerEl, 1);
      const firstOption = minutesListbox.querySelector('[role="option"]');
      expect(firstOption?.textContent?.trim()).toBe('00');
    });
  });

  // ---------------------------------------------------------------------------
  // Keyboard navigation on column
  // ---------------------------------------------------------------------------

  describe('keyboard navigation', () => {
    beforeEach(async () => {
      openPopup(hostEl, fixture);
      await fixture.whenStable();
    });

    it('should advance selected value on ArrowDown in the hours listbox', async () => {
      component.value.set('10:00');
      fixture.detectChanges();
      await fixture.whenStable();

      const hoursListbox = getListbox(overlayContainerEl, 0);

      hoursListbox.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      );
      fixture.detectChanges();

      expect(component.value()).toMatch(/^11:/);
    });

    it('should decrease selected value on ArrowUp in the hours listbox', async () => {
      component.value.set('10:00');
      fixture.detectChanges();
      await fixture.whenStable();

      const hoursListbox = getListbox(overlayContainerEl, 0);

      hoursListbox.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }),
      );
      fixture.detectChanges();

      expect(component.value()).toMatch(/^09:/);
    });

    it('should jump to first value on Home key', async () => {
      component.value.set('14:00');
      fixture.detectChanges();
      await fixture.whenStable();

      const hoursListbox = getListbox(overlayContainerEl, 0);

      hoursListbox.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Home', bubbles: true }),
      );
      fixture.detectChanges();

      expect(component.value()).toMatch(/^00:/);
    });

    it('should jump to last value on End key in 24h mode', async () => {
      component.value.set('00:00');
      fixture.detectChanges();
      await fixture.whenStable();

      const hoursListbox = getListbox(overlayContainerEl, 0);

      hoursListbox.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'End', bubbles: true }),
      );
      fixture.detectChanges();

      expect(component.value()).toMatch(/^23:/);
    });

    it('should wrap from 23 to 00 on ArrowDown in 24h mode', async () => {
      component.value.set('23:00');
      fixture.detectChanges();
      await fixture.whenStable();

      const hoursListbox = getListbox(overlayContainerEl, 0);

      hoursListbox.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      );
      fixture.detectChanges();

      expect(component.value()).toMatch(/^00:/);
    });

    it('should wrap from 00 to 23 on ArrowUp in 24h mode', async () => {
      component.value.set('00:00');
      fixture.detectChanges();
      await fixture.whenStable();

      const hoursListbox = getListbox(overlayContainerEl, 0);

      hoursListbox.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }),
      );
      fixture.detectChanges();

      expect(component.value()).toMatch(/^23:/);
    });

    it('should not change value on keyboard when disabled', async () => {
      component.isOpen.set(false);
      fixture.detectChanges();
      fixture.componentRef.setInput('disabled', true);
      component.value.set('10:00');
      fixture.detectChanges();
      openPopup(hostEl, fixture);
      await fixture.whenStable();

      const hoursListbox = getListbox(overlayContainerEl, 0);

      hoursListbox.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      );
      fixture.detectChanges();

      expect(component.value()).toBe('10:00');
    });
  });

  // ---------------------------------------------------------------------------
  // Scoped direction
  //
  // The columns live in a popup pane portaled to <body>, so they inherit no
  // `[dir]` scope from the trigger. Inter-column Arrow navigation therefore
  // resolves its direction from the time picker's own host, not from the
  // document — a picker inside a `dir="rtl"` island mirrors while the document
  // stays LTR, and an `dir="ltr"` island inside an RTL document does not.
  // ---------------------------------------------------------------------------

  describe('scoped direction — inter-column navigation', () => {
    let rtlService: MlvRtlService;

    beforeEach(() => {
      rtlService = TestBed.inject(MlvRtlService);
    });

    afterEach(() => {
      hostEl.parentElement?.removeAttribute('dir');
      rtlService.setDirection('ltr');
      document.documentElement.removeAttribute('dir');
    });

    /** Scopes `dir` to an ancestor of the picker, leaving the document alone. */
    function scopeDirection(direction: 'ltr' | 'rtl'): void {
      const scope = hostEl.parentElement;
      if (!scope) {
        throw new Error('Time picker host has no parent to scope `dir` on');
      }
      scope.setAttribute('dir', direction);
    }

    function columnsContainer(): HTMLElement {
      return overlayContainerEl.querySelector(
        '.mlv-time-picker__columns',
      ) as HTMLElement;
    }

    /** The accessible name of the column that currently holds DOM focus. */
    function focusedColumnLabel(): string | null {
      return (
        (document.activeElement as HTMLElement | null)?.getAttribute(
          'aria-label',
        ) ?? null
      );
    }

    function pressOnColumns(key: string): void {
      columnsContainer().dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true }),
      );
      fixture.detectChanges();
    }

    it('should mirror inter-column arrows inside a scoped [dir="rtl"] subtree while the document stays LTR', async () => {
      scopeDirection('rtl');
      openPopup(hostEl, fixture);
      await fixture.whenStable();

      expect(rtlService.direction()).toBe('ltr');
      expect(document.documentElement.getAttribute('dir')).not.toBe('rtl');

      getListbox(overlayContainerEl, 0).focus();
      expect(focusedColumnLabel()).toBe('Hours');

      pressOnColumns('ArrowLeft');
      expect(focusedColumnLabel()).toBe('Minutes');

      pressOnColumns('ArrowRight');
      expect(focusedColumnLabel()).toBe('Hours');

      // The block axis is not an inter-column axis and never mirrors.
      pressOnColumns('ArrowUp');
      expect(focusedColumnLabel()).toBe('Hours');

      pressOnColumns('ArrowDown');
      expect(focusedColumnLabel()).toBe('Hours');
    });

    it('should leave a scoped [dir="ltr"] island unmirrored while the document is RTL', async () => {
      rtlService.setDirection('rtl');
      scopeDirection('ltr');
      openPopup(hostEl, fixture);
      await fixture.whenStable();

      expect(rtlService.direction()).toBe('rtl');

      getListbox(overlayContainerEl, 0).focus();
      expect(focusedColumnLabel()).toBe('Hours');

      // ArrowLeft is "previous" here, and Hours is already the first column.
      pressOnColumns('ArrowLeft');
      expect(focusedColumnLabel()).toBe('Hours');

      pressOnColumns('ArrowRight');
      expect(focusedColumnLabel()).toBe('Minutes');
    });
  });

  // ---------------------------------------------------------------------------
  // aria listbox integration (Phase 3 @angular/aria migration)
  //
  // The column is backed by @angular/aria's headless ngListbox/ngOption in
  // focusMode="activedescendant" + selectionMode="follow". These specs assert
  // the aria-owned behaviour the migration adopts, on top of the existing
  // role/selection/keyboard contract above.
  // ---------------------------------------------------------------------------

  describe('aria listbox integration', () => {
    beforeEach(async () => {
      openPopup(hostEl, fixture);
      await fixture.whenStable();
    });

    it('should keep options out of the tab order (activedescendant focus mode)', () => {
      const hoursListbox = getListbox(overlayContainerEl, 0);
      const options =
        hoursListbox.querySelectorAll<HTMLElement>('[role="option"]');
      expect(options.length).toBeGreaterThan(0);
      options.forEach((opt) => {
        expect(opt.getAttribute('tabindex')).toBe('-1');
      });
    });

    it('should move aria-activedescendant (not DOM focus) on ArrowDown', async () => {
      component.value.set('10:00');
      fixture.detectChanges();
      await fixture.whenStable();

      const hoursListbox = getListbox(overlayContainerEl, 0);
      const before = hoursListbox.getAttribute('aria-activedescendant');

      hoursListbox.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      );
      fixture.detectChanges();
      await fixture.whenStable();

      const after = hoursListbox.getAttribute('aria-activedescendant');
      // activedescendant advanced to the next option...
      expect(after).toBeTruthy();
      expect(after).not.toBe(before);
      // ...and focus stayed on the listbox container, never an <li>.
      const options =
        hoursListbox.querySelectorAll<HTMLElement>('[role="option"]');
      options.forEach((opt) => {
        expect(opt.getAttribute('tabindex')).toBe('-1');
      });
    });

    it('should select a value via type-ahead (aria addition)', async () => {
      component.value.set('00:00');
      fixture.detectChanges();
      await fixture.whenStable();

      const minutesListbox = getListbox(overlayContainerEl, 1);

      // Minute labels are zero-padded ("05", "15", …). Typing "1" then "5"
      // seeks to "15" via aria's type-ahead search over the option `label`.
      minutesListbox.dispatchEvent(
        new KeyboardEvent('keydown', { key: '1', bubbles: true }),
      );
      minutesListbox.dispatchEvent(
        new KeyboardEvent('keydown', { key: '5', bubbles: true }),
      );
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.value()).toBe('00:15');
    });

    it('should select the clicked option (delegated aria click selection)', async () => {
      component.value.set('10:00');
      fixture.detectChanges();
      await fixture.whenStable();

      const hoursListbox = getListbox(overlayContainerEl, 0);
      const options =
        hoursListbox.querySelectorAll<HTMLElement>('[role="option"]');

      // Click the "15" option (index 15 in 24h mode).
      options[15].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();

      expect(component.value()).toMatch(/^15:/);
    });
  });

  // ---------------------------------------------------------------------------
  // Value output format
  // ---------------------------------------------------------------------------

  describe('value format', () => {
    beforeEach(async () => {
      openPopup(hostEl, fixture);
      await fixture.whenStable();
    });

    it('should emit HH:mm format by default', async () => {
      component.value.set('09:05');
      fixture.detectChanges();
      await fixture.whenStable();

      const minutesListbox = getListbox(overlayContainerEl, 1);
      minutesListbox.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      );
      fixture.detectChanges();

      expect(component.value()).toMatch(/^\d{2}:\d{2}$/);
    });

    it('should emit HH:mm:ss format when showSeconds is true', async () => {
      component.isOpen.set(false);
      fixture.detectChanges();
      fixture.componentRef.setInput('showSeconds', true);
      fixture.detectChanges();
      openPopup(hostEl, fixture);

      component.value.set('09:05:30');
      fixture.detectChanges();
      await fixture.whenStable();

      const secondsListbox = getListbox(overlayContainerEl, 2);
      secondsListbox.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      );
      fixture.detectChanges();

      expect(component.value()).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    });

    it('should always emit 24h format even in 12h mode', async () => {
      component.isOpen.set(false);
      fixture.detectChanges();
      fixture.componentRef.setInput('mode', '12h');
      fixture.detectChanges();
      openPopup(hostEl, fixture);

      component.value.set('15:00'); // 3 PM
      fixture.detectChanges();
      await fixture.whenStable();

      const hoursListbox = getListbox(overlayContainerEl, 0);
      hoursListbox.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      );
      fixture.detectChanges();

      // Should be a valid 24h time, hours 0-23
      const parts = component.value().split(':');
      const hour = parseInt(parts[0], 10);
      expect(hour).toBeGreaterThanOrEqual(0);
      expect(hour).toBeLessThan(24);
    });
  });
});

// ---------------------------------------------------------------------------
// ReactiveFormsHostComponent — forms integration
// ---------------------------------------------------------------------------

describe('MlvTimePicker (Reactive Forms)', () => {
  let fixture: ComponentFixture<ReactiveFormHostComponent>;
  let host: ReactiveFormHostComponent;
  let hostEl: HTMLElement;
  let overlayContainerEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReactiveFormHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ReactiveFormHostComponent);
    host = fixture.componentInstance;
    hostEl = fixture.nativeElement;
    overlayContainerEl = TestBed.inject(OverlayContainer).getContainerElement();
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should reflect FormControl value set programmatically', () => {
    host.ctrl.setValue('08:30');
    fixture.detectChanges();

    // Open popup to see the columns
    const tp = hostEl.querySelector('mlv-time-picker') as HTMLElement;
    openPopup(tp, fixture);

    const hoursListbox = overlayContainerEl.querySelector<HTMLElement>(
      '[role="listbox"]',
    ) as HTMLElement;
    const selected = hoursListbox.querySelector<HTMLElement>(
      '[aria-selected="true"]',
    );
    expect(selected?.textContent?.trim()).toBe('08');
  });

  it('should update FormControl when column value changes via keyboard', async () => {
    host.ctrl.setValue('10:00');
    fixture.detectChanges();

    const tp = hostEl.querySelector('mlv-time-picker') as HTMLElement;
    openPopup(tp, fixture);
    await fixture.whenStable();

    const hoursListbox = overlayContainerEl.querySelector<HTMLElement>(
      '[role="listbox"]',
    ) as HTMLElement;
    hoursListbox.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    fixture.detectChanges();

    expect(host.ctrl.value).toMatch(/^11:/);
  });

  it('should disable column listboxes when FormControl is disabled', () => {
    host.ctrl.disable();
    fixture.detectChanges();

    const tp = hostEl.querySelector('mlv-time-picker') as HTMLElement;
    openPopup(tp, fixture);

    const listboxes =
      overlayContainerEl.querySelectorAll<HTMLElement>('[role="listbox"]');
    listboxes.forEach((lb) => {
      expect(lb.getAttribute('tabindex')).toBe('-1');
    });
  });

  it('should re-enable column listboxes when FormControl is enabled', () => {
    host.ctrl.disable();
    fixture.detectChanges();
    host.ctrl.enable();
    fixture.detectChanges();

    const tp = hostEl.querySelector('mlv-time-picker') as HTMLElement;
    openPopup(tp, fixture);

    const listboxes =
      overlayContainerEl.querySelectorAll<HTMLElement>('[role="listbox"]');
    listboxes.forEach((lb) => {
      expect(lb.getAttribute('tabindex')).toBe('0');
    });
  });

  it('should mark the control as touched when the trigger blurs', () => {
    expect(host.ctrl.touched).toBe(false);

    const tp = hostEl.querySelector('mlv-time-picker') as HTMLElement;
    const trigger = getTrigger(tp);

    // Focus then blur trigger without opening popup
    trigger.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    fixture.detectChanges();
    trigger.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    fixture.detectChanges();

    expect(host.ctrl.touched).toBe(true);
  });

  describe('showSeconds in reactive form', () => {
    it('should emit HH:mm:ss when showSeconds changes to true', async () => {
      host.ctrl.setValue('09:15');
      host.showSeconds.set(true);
      fixture.detectChanges();

      const tp = hostEl.querySelector('mlv-time-picker') as HTMLElement;
      openPopup(tp, fixture);
      await fixture.whenStable();

      const listboxes =
        overlayContainerEl.querySelectorAll<HTMLElement>('[role="listbox"]');
      // Press ArrowDown on seconds
      listboxes[2].dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      );
      fixture.detectChanges();

      expect(host.ctrl.value).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    });
  });
});

// ---------------------------------------------------------------------------
// State variants — HostComponent
// ---------------------------------------------------------------------------

describe('MlvTimePicker (state variants)', () => {
  let fixture: ComponentFixture<HostComponent>;
  let hostEl: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    hostEl = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  const states = ['success', 'info', 'warning', 'error'] as const;

  states.forEach((state) => {
    it(`should apply state-${state} class to form control wrapper`, () => {
      fixture.componentInstance.state.set(state);
      fixture.detectChanges();
      const wrapper = hostEl.querySelector(
        'mlv-form-control-wrapper',
      ) as HTMLElement;
      expect(wrapper.classList).toContain(
        `mlv-form-control-wrapper--state-${state}`,
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Mobile full-screen sheet (#116)
//
// The sheet's own drum sizing is container-query based and lives entirely in
// CSS, which jsdom cannot resolve — that half is asserted against the compiled
// stylesheet in `time-picker-styles.spec.ts`. What *is* assertable here is the
// switch: which panel gets the sheet treatment, and whether it still carries
// everything it carried before.
//
// This project deliberately ships no `matchMedia` stub (unlike `mlv-select` and
// `mlv-combobox`, whose `test-setup.ts` reports a desktop viewport), so
// `MlvBreakpointService` stays pinned to its initial tier and the popup's
// `mobileMode="auto"` resolves to full-screen. The desktop case therefore has
// to install the stub itself, before the component is created.
// ---------------------------------------------------------------------------

describe('MlvTimePicker — mobile full-screen sheet', () => {
  const SHEET = 'mlv-time-picker__panel--sheet';

  async function make(): Promise<{
    fixture: ComponentFixture<MlvTimePicker>;
    panel: HTMLElement;
    popup: MlvPopup;
  }> {
    await TestBed.configureTestingModule({
      imports: [MlvTimePicker],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    const fixture = TestBed.createComponent(MlvTimePicker);
    fixture.detectChanges();
    await fixture.whenStable();

    openPopup(fixture.nativeElement, fixture);
    await fixture.whenStable();

    const overlayEl = TestBed.inject(OverlayContainer).getContainerElement();
    return {
      fixture,
      panel: overlayEl.querySelector('.mlv-time-picker__panel') as HTMLElement,
      popup: fixture.debugElement.query(By.directive(MlvPopup))
        .componentInstance as MlvPopup,
    };
  }

  it('marks the panel as a sheet while the popup is full-screen', async () => {
    const { panel, popup } = await make();
    expect(popup.isFullscreen()).toBe(true);
    expect(panel.classList).toContain(SHEET);
  });

  it('keeps the density modifier alongside the sheet modifier', async () => {
    // The two live on separate bindings — `[class]` writes the density
    // modifier as a whole string while `[class.…--sheet]` toggles this one —
    // so a regression that made either clobber the other would take the drum's
    // desktop sizing or its sheet sizing out silently.
    const { panel } = await make();
    expect(panel.classList).toContain(SHEET);
    expect(
      [...panel.classList].filter((c) =>
        /^mlv-time-picker__panel--(tight|compact|comfortable|spacious|airy)$/.test(
          c,
        ),
      ).length,
    ).toBe(1);
  });

  describe('on a desktop viewport', () => {
    let restoreMatchMedia: (() => void) | undefined;

    beforeEach(() => {
      // `min-width` queries match, `max-width` ones do not — the same shape
      // `libs/core/select/src/test-setup.ts` installs globally.
      const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: (query: string): MediaQueryList =>
          ({
            matches: /min-width/.test(query),
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
    });

    afterEach(() => restoreMatchMedia?.());

    it('leaves the trigger-anchored dropdown unmarked', async () => {
      const { panel, popup } = await make();
      expect(popup.isFullscreen()).toBe(false);
      expect(panel.classList).not.toContain(SHEET);
    });
  });
});

// ---------------------------------------------------------------------------
// MlvTimePicker — injected DOCUMENT
// ---------------------------------------------------------------------------

describe('MlvTimePicker (injected DOCUMENT)', () => {
  /**
   * The columns live in the popup, portaled into the CDK overlay container of
   * the injected document. Inter-column navigation compared each column with
   * the ambient `document.activeElement`, which never holds a column there, so
   * ArrowLeft / ArrowRight did nothing.
   */
  it('moves between columns by the injected document’s active element', async () => {
    const isolated = document.implementation.createHTMLDocument('time-picker');
    await TestBed.configureTestingModule({
      imports: [MlvTimePicker],
      providers: [
        provideMlvI18nTesting(),
        { provide: DOCUMENT, useValue: isolated },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(MlvTimePicker);
    const hostEl: HTMLElement = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();

    openPopup(hostEl, fixture);
    await fixture.whenStable();

    const listboxes = isolated.querySelectorAll<HTMLElement>(
      '.mlv-time-picker__columns [role="listbox"]',
    );
    expect(
      listboxes.length,
      'the columns render into the injected document',
    ).toBe(2);
    // jsdom moves no `activeElement` inside a `createHTMLDocument()` document:
    // pin it to the hours column and observe the focus call on minutes.
    Object.defineProperty(isolated, 'activeElement', {
      configurable: true,
      get: () => listboxes[0],
    });
    const focusMinutes = vi.spyOn(listboxes[1], 'focus');

    isolated
      .querySelector('.mlv-time-picker__columns')
      ?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
      );

    expect(focusMinutes).toHaveBeenCalledTimes(1);
    fixture.destroy();
  });
});
