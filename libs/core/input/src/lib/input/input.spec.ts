import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { MlvInput } from './input';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

describe('MlvInput', () => {
  let component: MlvInput;
  let fixture: ComponentFixture<MlvInput>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvInput],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvInput);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('forwards the native search input type for composed search controls', () => {
    fixture.componentRef.setInput('type', 'search');
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector(
      'input',
    ) as HTMLInputElement;
    expect(input.type).toBe('search');
  });

  it('marks the shared wrapper as pill via the base-class input', async () => {
    const wrapper = fixture.nativeElement.querySelector(
      '.mlv-form-control-wrapper',
    ) as HTMLElement;
    expect(wrapper.classList).not.toContain('mlv-form-control-wrapper--pill');

    fixture.componentRef.setInput('pill', true);
    await fixture.whenStable();
    expect(wrapper.classList).toContain('mlv-form-control-wrapper--pill');
  });

  it('shows the clear button only while clearable AND a value is present, and hides it after clearing', () => {
    fixture.componentRef.setInput('clearable', true);
    fixture.detectChanges();
    const clearButton = (): HTMLElement | null =>
      fixture.nativeElement.querySelector('mlv-button-close');

    // Clearable but empty — no dangling X.
    expect(component.hasValue()).toBe(false);
    expect(clearButton()).toBeNull();

    // Value present — X appears.
    component.value.set('hello');
    fixture.detectChanges();
    expect(component.hasValue()).toBe(true);
    expect(clearButton()).not.toBeNull();

    // Clearing hides it again.
    component.clearValue();
    fixture.detectChanges();
    expect(component.hasValue()).toBe(false);
    expect(clearButton()).toBeNull();
  });

  it('re-emits inputFocus from the native focus handler', () => {
    fixture.detectChanges();
    const events: FocusEvent[] = [];
    component.inputFocus.subscribe((e) => events.push(e));
    const input = fixture.nativeElement.querySelector(
      'input',
    ) as HTMLInputElement;
    input.dispatchEvent(new FocusEvent('focus'));
    expect(events.length).toBe(1);
    expect(component.focused()).toBe(true);
  });

  it('re-emits inputBlur and reports touch from the native blur handler', () => {
    fixture.detectChanges();
    const blurs: FocusEvent[] = [];
    const touched = vi.fn();
    component.inputBlur.subscribe((e) => blurs.push(e));
    component.touch.subscribe(touched);
    const input = fixture.nativeElement.querySelector(
      'input',
    ) as HTMLInputElement;
    input.dispatchEvent(new FocusEvent('blur'));
    expect(blurs.length).toBe(1);
    expect(touched).toHaveBeenCalled();
    expect(component.focused()).toBe(false);
  });

  it('resolves bound validation errors to the error state after touch', () => {
    fixture.componentRef.setInput('errors', [{ kind: 'required' }]);
    fixture.detectChanges();

    const input = fixture.nativeElement as HTMLElement;
    const native = input.querySelector('input') as HTMLInputElement;
    const wrapper = input.querySelector('mlv-form-control-wrapper');

    expect(input.classList.contains('mlv-input--default')).toBe(true);
    expect(
      wrapper?.classList.contains('mlv-form-control-wrapper--state-default'),
    ).toBe(true);

    fixture.componentRef.setInput('touched', true);
    fixture.detectChanges();

    expect(input.classList.contains('mlv-input--error')).toBe(true);
    expect(native.getAttribute('aria-invalid')).toBe('true');
    expect(
      wrapper?.classList.contains('mlv-form-control-wrapper--state-error'),
    ).toBe(true);

    fixture.componentRef.setInput('state', 'warning');
    fixture.detectChanges();
    expect(input.classList.contains('mlv-input--warning')).toBe(true);
  });
});

describe('MlvInput field surface (label, description, required)', () => {
  let fixture: ComponentFixture<MlvInput>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvInput],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(MlvInput);
    await fixture.whenStable();
  });

  function native(): HTMLInputElement {
    return fixture.nativeElement.querySelector('input') as HTMLInputElement;
  }

  it('emits no aria-describedby when neither description nor message is set', () => {
    expect(native().getAttribute('aria-describedby')).toBeNull();
    expect(fixture.nativeElement.querySelector('mlv-description')).toBeNull();
  });

  it('renders the description and message and points aria-describedby at both, in order', async () => {
    fixture.componentRef.setInput('description', 'Work address preferred.');
    fixture.componentRef.setInput('message', 'Enter a valid email');
    await fixture.whenStable();

    const description = fixture.nativeElement.querySelector(
      'mlv-description',
    ) as HTMLElement;
    const message = fixture.nativeElement.querySelector(
      'mlv-message',
    ) as HTMLElement;
    expect(description.textContent?.trim()).toBe('Work address preferred.');

    const ids = (native().getAttribute('aria-describedby') ?? '').split(' ');
    expect(ids).toEqual([description.id, message.id]);
    for (const id of ids) {
      expect(fixture.nativeElement.querySelector(`#${id}`)).not.toBeNull();
    }
  });

  it('marks the label and the native input when required', async () => {
    fixture.componentRef.setInput('label', 'Email');
    fixture.componentRef.setInput('required', true);
    await fixture.whenStable();

    expect(native().getAttribute('aria-required')).toBe('true');
    expect(
      (
        fixture.nativeElement.querySelector(
          '.mlv-label__required',
        ) as HTMLElement
      ).textContent,
    ).toBe('*');
  });
});
