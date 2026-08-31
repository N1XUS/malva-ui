import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { form, disabled, required, FormField } from '@angular/forms/signals';
import { By } from '@angular/platform-browser';
import { NgControl } from '@angular/forms';
import { verifyFormsBinding } from '@malva-ui/core/form-utils/testing';
import { MlvSignalFormControlBase } from './signal-form-control-base';
import { MlvFormField } from '../form-field/form-field';

/**
 * Minimal concrete FormValueControl on the new base — a native input is fine
 * here (test fixture, not shipped code). Blur reports touch via the base's
 * `touch` output.
 */
@Component({
  selector: 'mlv-test-signal-input',
  template: `
    <input
      [value]="value()"
      [disabled]="computedDisabled()"
      (input)="value.set($any($event.target).value)"
      (focus)="setFocused(true)"
      (blur)="setFocused(false); _markTouched()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestSignalInputComponent extends MlvSignalFormControlBase<string> {
  readonly value = model('');
  readonly hasValue = computed(() => this.value().length > 0);
}

describe('MlvSignalFormControlBase — forms bindings matrix (direction B)', () => {
  function nativeInput(fixture: ComponentFixture<unknown>): HTMLInputElement {
    return fixture.nativeElement.querySelector('input') as HTMLInputElement;
  }

  function typeInto(fixture: ComponentFixture<unknown>, text: string): void {
    const input = nativeInput(fixture);
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }

  function blurField(fixture: ComponentFixture<unknown>): void {
    nativeInput(fixture).dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();
  }

  it('signal forms: [formField] drives the FormValueControl', async () => {
    @Component({
      template: `<mlv-test-signal-input [formField]="f.name" />`,
      imports: [TestSignalInputComponent, FormField],
    })
    class SignalHostComponent {
      readonly disable = signal(false);
      readonly modelValue = signal({ name: '' });
      readonly f = form(this.modelValue, (path) => {
        disabled(path.name, () => this.disable());
      });
      readonly control = viewChild.required(TestSignalInputComponent);
    }

    await TestBed.configureTestingModule({
      imports: [SignalHostComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(SignalHostComponent);
    fixture.detectChanges();
    const host = fixture.componentInstance;

    await verifyFormsBinding<string>({
      adapter: {
        mode: 'signal-forms',
        setValue: async (v) => {
          host.modelValue.update((m) => ({ ...m, name: v }));
          fixture.detectChanges();
          await fixture.whenStable();
        },
        getValue: () => host.f.name().value(),
        isTouched: () => host.f.name().touched(),
        setDisabled: async (d) => {
          host.disable.set(d);
          fixture.detectChanges();
          await fixture.whenStable();
        },
        isDisabled: () => host.control().computedDisabled(),
      },
      sample: 'Ada',
      interact: () => typeInto(fixture, 'typed'),
      expectedAfterInteraction: 'typed',
      blur: () => blurField(fixture),
    });
  });

  it('resolves an invalid touched signal field to the error visual state', async () => {
    @Component({
      template: `<mlv-test-signal-input [formField]="f.name" />`,
      imports: [TestSignalInputComponent, FormField],
    })
    class SignalStateHostComponent {
      readonly modelValue = signal({ name: '' });
      readonly f = form(this.modelValue, (path) => {
        required(path.name);
      });
      readonly control = viewChild.required(TestSignalInputComponent);
    }

    await TestBed.configureTestingModule({
      imports: [SignalStateHostComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(SignalStateHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;

    expect(host.control().resolvedState()).toBe('default');
    blurField(fixture);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.control().resolvedState()).toBe('error');
  });

  it('reactive: [formControl] drives the FormValueControl (RISK GATE)', async () => {
    @Component({
      template: `<mlv-test-signal-input [formControl]="ctrl" />`,
      imports: [TestSignalInputComponent, ReactiveFormsModule],
    })
    class ReactiveHostComponent {
      readonly ctrl = new FormControl('', { nonNullable: true });
      readonly control = viewChild.required(TestSignalInputComponent);
    }

    await TestBed.configureTestingModule({
      imports: [ReactiveHostComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(ReactiveHostComponent);
    fixture.detectChanges();
    const host = fixture.componentInstance;

    await verifyFormsBinding<string>({
      adapter: {
        mode: 'reactive',
        setValue: (v) => {
          host.ctrl.setValue(v);
          fixture.detectChanges();
        },
        getValue: () => host.ctrl.value,
        isTouched: () => host.ctrl.touched,
        setDisabled: (d) => {
          if (d) host.ctrl.disable();
          else host.ctrl.enable();
          fixture.detectChanges();
        },
        isDisabled: () => host.control().computedDisabled(),
      },
      sample: 'Ada',
      interact: () => typeInto(fixture, 'typed'),
      expectedAfterInteraction: 'typed',
      blur: () => blurField(fixture),
    });
  });

  it('template-driven: ngModel drives the FormValueControl (RISK GATE)', async () => {
    @Component({
      template: `<mlv-test-signal-input [(ngModel)]="value" />`,
      imports: [TestSignalInputComponent, FormsModule],
    })
    class NgModelHostComponent {
      readonly value = signal('');
    }

    await TestBed.configureTestingModule({
      imports: [NgModelHostComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(NgModelHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;
    const ngControl = fixture.debugElement
      .query(By.directive(TestSignalInputComponent))
      .injector.get(NgControl);

    await verifyFormsBinding<string>({
      adapter: {
        mode: 'template-driven',
        setValue: async (v) => {
          host.value.set(v);
          fixture.detectChanges();
          await fixture.whenStable();
        },
        getValue: () => host.value(),
        isTouched: () => ngControl.touched === true,
      },
      sample: 'Ada',
      interact: () => typeInto(fixture, 'typed'),
      expectedAfterInteraction: 'typed',
      blur: () => blurField(fixture),
    });
  });
});

describe('MlvFormField — signal-forms error display', () => {
  @Component({
    template: `
      <mlv-form-field [displayStrategy]="strategy()">
        <mlv-test-signal-input [formField]="f.name" />
      </mlv-form-field>
    `,
    imports: [MlvFormField, TestSignalInputComponent, FormField],
  })
  class FieldHostComponent {
    readonly strategy = signal<'touched' | 'immediate'>('touched');
    readonly modelValue = signal({ name: '' });
    readonly f = form(this.modelValue, (path) => {
      required(path.name, { message: 'Name is required' });
    });
  }

  let fixture: ComponentFixture<FieldHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FieldHostComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(FieldHostComponent);
    fixture.detectChanges();
  });

  function message(): string {
    return (
      (
        fixture.nativeElement.querySelector(
          'mlv-message[state="error"], mlv-message',
        ) as HTMLElement | null
      )?.textContent?.trim() ?? ''
    );
  }

  it('shows the rule-supplied message only after the field is touched', () => {
    expect(message()).toBe(''); // required error present but untouched

    const input = fixture.nativeElement.querySelector(
      'input',
    ) as HTMLInputElement;
    input.dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();

    expect(message()).toBe('Name is required');
  });

  it('immediate strategy shows the signal-forms error without interaction', () => {
    fixture.componentInstance.strategy.set('immediate');
    fixture.detectChanges();
    expect(message()).toBe('Name is required');
    expect(
      (
        fixture.nativeElement.querySelector('.mlv-form-field') as HTMLElement
      ).classList.contains('mlv-form-field--error'),
    ).toBe(true);
  });
});
