import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MlvNumberInput } from './number-input';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';

@Component({
  template: `<mlv-number-input
    [stack]="'vertical'"
    [controlAlignment]="'left'"
  />`,
  imports: [MlvNumberInput],
})
class VerticalLeftNumberInputHost {}

describe('MlvNumberInput', () => {
  let component: MlvNumberInput;
  let fixture: ComponentFixture<MlvNumberInput>;

  /** The internal `<input>` that carries the wheel listener. */
  const nativeInput = (): HTMLInputElement =>
    fixture.nativeElement.querySelector(
      '.mlv-number-input__native',
    ) as HTMLInputElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvNumberInput, VerticalLeftNumberInputHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MlvNumberInput);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should use horizontal controls by default', () => {
    fixture.detectChanges();

    expect(
      fixture.nativeElement.classList.contains(
        'mlv-number-input--stack-horizontal',
      ),
    ).toBe(true);
    expect(
      fixture.nativeElement.classList.contains(
        'mlv-number-input--control-right',
      ),
    ).toBe(true);
  });

  it('should render a vertical stepper stack before the input when left aligned', async () => {
    const hostFixture = TestBed.createComponent(VerticalLeftNumberInputHost);
    hostFixture.detectChanges();
    await hostFixture.whenStable();

    const host = hostFixture.nativeElement.querySelector(
      'mlv-number-input',
    ) as HTMLElement;
    // The wrapper nests the projected control inside `__control-row`, not
    // directly in `__control-container`.
    const control = hostFixture.nativeElement.querySelector(
      '.mlv-form-control-wrapper__control-row',
    ) as HTMLElement;
    const renderedControls = Array.from(control.children).filter((child) =>
      (child as HTMLElement).matches(
        '.mlv-number-input__steppers, .mlv-number-input__native',
      ),
    ) as HTMLElement[];

    expect(host.classList.contains('mlv-number-input--stack-vertical')).toBe(
      true,
    );
    expect(host.classList.contains('mlv-number-input--control-left')).toBe(
      true,
    );
    expect(
      renderedControls[0].classList.contains('mlv-number-input__steppers'),
    ).toBe(true);
    expect(
      renderedControls[1].classList.contains('mlv-number-input__native'),
    ).toBe(true);
    expect(
      renderedControls[0].querySelector('.mlv-number-input__increment'),
    ).toBeTruthy();
    expect(
      renderedControls[0].querySelector('.mlv-number-input__decrement'),
    ).toBeTruthy();
  });

  describe('form-side value writes (clamp effect)', () => {
    it('should set value and internalStringValue', async () => {
      component.value.set(42);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(component.value()).toBe(42);
      expect(component['_internalStringValue']()).toBe('42');
    });

    it('should clamp value to min', async () => {
      fixture.componentRef.setInput('min', 10);
      component.value.set(5);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(component.value()).toBe(10);
      expect(component['_internalStringValue']()).toBe('10');
    });

    it('should clamp value to max', async () => {
      fixture.componentRef.setInput('max', 100);
      component.value.set(150);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(component.value()).toBe(100);
      expect(component['_internalStringValue']()).toBe('100');
    });

    it('should handle null value', async () => {
      component.value.set(42);
      fixture.detectChanges();
      await fixture.whenStable();
      component.value.set(null);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(component.value()).toBeNull();
      expect(component['_internalStringValue']()).toBe('');
    });
  });

  describe('computed signals', () => {
    it('isAtMin should be true at min boundary', async () => {
      fixture.componentRef.setInput('min', 0);
      component.value.set(0);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(component.isAtMin()).toBe(true);
    });

    it('isAtMin should be false above min', async () => {
      fixture.componentRef.setInput('min', 0);
      component.value.set(1);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(component.isAtMin()).toBe(false);
    });

    it('isAtMax should be true at max boundary', async () => {
      fixture.componentRef.setInput('max', 100);
      component.value.set(100);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(component.isAtMax()).toBe(true);
    });

    it('isAtMax should be false below max', async () => {
      fixture.componentRef.setInput('max', 100);
      component.value.set(99);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(component.isAtMax()).toBe(false);
    });

    it('effectiveLargeStep defaults to 10x step', () => {
      fixture.componentRef.setInput('step', 5);
      expect(component.effectiveLargeStep()).toBe(50);
    });

    it('effectiveLargeStep uses explicit largeStep when set', () => {
      fixture.componentRef.setInput('step', 5);
      fixture.componentRef.setInput('largeStep', 25);
      expect(component.effectiveLargeStep()).toBe(25);
    });

    it('effectivePrecision infers from step', () => {
      fixture.componentRef.setInput('step', 0.01);
      expect(component.effectivePrecision()).toBe(2);
    });

    it('effectivePrecision uses explicit precision', () => {
      fixture.componentRef.setInput('step', 0.01);
      fixture.componentRef.setInput('precision', 4);
      expect(component.effectivePrecision()).toBe(4);
    });
  });

  describe('keyboard navigation', () => {
    function dispatchKeydown(
      key: string,
      options: Partial<KeyboardEventInit> = {},
    ): void {
      const el = fixture.nativeElement.querySelector(
        '.mlv-number-input__native',
      ) as HTMLInputElement;
      el.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, ...options }),
      );
    }

    beforeEach(async () => {
      component.value.set(50);
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('ArrowUp increments by step', async () => {
      fixture.componentRef.setInput('step', 5);
      dispatchKeydown('ArrowUp');
      await fixture.whenStable();
      expect(component.value()).toBe(55);
    });

    it('ArrowDown decrements by step', async () => {
      fixture.componentRef.setInput('step', 5);
      dispatchKeydown('ArrowDown');
      await fixture.whenStable();
      expect(component.value()).toBe(45);
    });

    it('Shift+ArrowUp increments by largeStep', async () => {
      fixture.componentRef.setInput('step', 5);
      dispatchKeydown('ArrowUp', { shiftKey: true });
      await fixture.whenStable();
      expect(component.value()).toBe(100); // 50 + 50
    });

    it('Shift+ArrowDown decrements by largeStep', async () => {
      fixture.componentRef.setInput('step', 5);
      dispatchKeydown('ArrowDown', { shiftKey: true });
      await fixture.whenStable();
      expect(component.value()).toBe(0); // 50 - 50
    });

    it('Home jumps to min', async () => {
      fixture.componentRef.setInput('min', 10);
      dispatchKeydown('Home');
      await fixture.whenStable();
      expect(component.value()).toBe(10);
    });

    it('End jumps to max', async () => {
      fixture.componentRef.setInput('max', 200);
      dispatchKeydown('End');
      await fixture.whenStable();
      expect(component.value()).toBe(200);
    });
  });

  describe('boundary clamping', () => {
    it('should not go below min when stepping down', async () => {
      fixture.componentRef.setInput('min', 0);
      fixture.componentRef.setInput('step', 10);
      component.value.set(3);
      fixture.detectChanges();
      await fixture.whenStable();
      component['_step'](-10);
      await fixture.whenStable();
      expect(component.value()).toBe(0);
    });

    it('should not go above max when stepping up', async () => {
      fixture.componentRef.setInput('max', 100);
      fixture.componentRef.setInput('step', 10);
      component.value.set(98);
      fixture.detectChanges();
      await fixture.whenStable();
      component['_step'](10);
      await fixture.whenStable();
      expect(component.value()).toBe(100);
    });
  });

  describe('signal-forms integration', () => {
    it('should propagate stepper changes to the value model', async () => {
      component.value.set(10);
      fixture.detectChanges();
      await fixture.whenStable();
      component['_step'](5);
      await fixture.whenStable();
      expect(component.value()).toBe(15);
    });

    it('should report the touch output on blur', async () => {
      const touched = vi.fn();
      component.touch.subscribe(touched);
      component._onBlur();
      await fixture.whenStable();
      expect(touched).toHaveBeenCalledTimes(1);
    });

    it('computedDisabled reflects the disabled input', async () => {
      expect(component.computedDisabled()).toBe(false);
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(component.computedDisabled()).toBe(true);
    });
  });

  describe('scroll wheel', () => {
    it('should increment on wheel up (deltaY < 0)', () => {
      component['_isFocused'].set(true);
      fixture.componentRef.setInput('scrollable', true);
      component.value.set(10);
      const event = new WheelEvent('wheel', { deltaY: -100, cancelable: true });
      component._onWheel(event);
      expect(component.value()).toBe(11);
    });

    it('should decrement on wheel down (deltaY > 0)', () => {
      component['_isFocused'].set(true);
      fixture.componentRef.setInput('scrollable', true);
      component.value.set(10);
      const event = new WheelEvent('wheel', { deltaY: 100, cancelable: true });
      component._onWheel(event);
      expect(component.value()).toBe(9);
    });

    it('should not step when scrollable is false', () => {
      component['_isFocused'].set(true);
      fixture.componentRef.setInput('scrollable', false);
      component.value.set(10);
      const event = new WheelEvent('wheel', { deltaY: -100, cancelable: true });
      component._onWheel(event);
      expect(component.value()).toBe(10);
    });

    it('should not step when not focused', () => {
      component['_isFocused'].set(false);
      fixture.componentRef.setInput('scrollable', true);
      component.value.set(10);
      const event = new WheelEvent('wheel', { deltaY: -100, cancelable: true });
      component._onWheel(event);
      expect(component.value()).toBe(10);
    });

    // The tests above call the handler directly, so they pass whether or not
    // anything is listening. These dispatch a real event on the native input
    // and therefore cover the binding itself.
    it('steps on a wheel event dispatched at the native input', () => {
      fixture.componentRef.setInput('scrollable', true);
      fixture.detectChanges();
      component['_isFocused'].set(true);
      component.value.set(10);

      nativeInput().dispatchEvent(
        new WheelEvent('wheel', {
          deltaY: -100,
          cancelable: true,
          bubbles: true,
        }),
      );

      expect(component.value()).toBe(11);
    });

    it('preventDefaults the wheel event so the page does not scroll', () => {
      fixture.componentRef.setInput('scrollable', true);
      fixture.detectChanges();
      component['_isFocused'].set(true);
      component.value.set(10);

      const event = new WheelEvent('wheel', {
        deltaY: -100,
        cancelable: true,
        bubbles: true,
      });
      nativeInput().dispatchEvent(event);

      // A passive listener cannot cancel the event; this asserts it is not one.
      expect(event.defaultPrevented).toBe(true);
    });

    it('leaves the wheel event cancellable when not scrollable', () => {
      fixture.componentRef.setInput('scrollable', false);
      fixture.detectChanges();
      component['_isFocused'].set(true);
      component.value.set(10);

      const event = new WheelEvent('wheel', {
        deltaY: -100,
        cancelable: true,
        bubbles: true,
      });
      nativeInput().dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
      expect(component.value()).toBe(10);
    });
  });
});

// Reactive Forms integration test
describe('MlvNumberInput — Reactive Forms', () => {
  @Component({
    template: `<mlv-number-input [formControl]="ctrl" [min]="0" [max]="100" />`,
    imports: [MlvNumberInput, ReactiveFormsModule],
  })
  class HostComponent {
    ctrl = new FormControl<number>(42);
  }

  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should render initial control value', () => {
    const input = fixture.nativeElement.querySelector(
      '.mlv-number-input__native',
    ) as HTMLInputElement;
    expect(input.value).toBe('42');
  });

  it('should update form control when user types valid value', async () => {
    const input = fixture.nativeElement.querySelector(
      '.mlv-number-input__native',
    ) as HTMLInputElement;
    input.value = '75';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new FocusEvent('blur'));
    await fixture.whenStable();
    expect(fixture.componentInstance.ctrl.value).toBe(75);
  });
});

describe('MlvNumberInput field surface (ariaLabel, description, required)', () => {
  let fixture: ComponentFixture<MlvNumberInput>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MlvNumberInput],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(MlvNumberInput);
    await fixture.whenStable();
  });

  function native(): HTMLInputElement {
    return fixture.nativeElement.querySelector(
      '.mlv-number-input__native',
    ) as HTMLInputElement;
  }

  it('forwards ariaLabel onto the spinbutton input', async () => {
    fixture.componentRef.setInput('ariaLabel', 'Quantity');
    await fixture.whenStable();

    expect(native().getAttribute('aria-label')).toBe('Quantity');
  });

  it('marks the label and the spinbutton when required', async () => {
    fixture.componentRef.setInput('label', 'Quantity');
    fixture.componentRef.setInput('required', true);
    await fixture.whenStable();

    expect(native().getAttribute('aria-required')).toBe('true');
    expect(
      fixture.nativeElement.querySelector('.mlv-label__required'),
    ).not.toBeNull();
  });

  it('renders the description and references it from aria-describedby', async () => {
    fixture.componentRef.setInput('description', 'Whole units only.');
    await fixture.whenStable();

    const description = fixture.nativeElement.querySelector(
      'mlv-description',
    ) as HTMLElement;
    expect(description.textContent?.trim()).toBe('Whole units only.');
    expect(native().getAttribute('aria-describedby')).toBe(description.id);
  });
});
