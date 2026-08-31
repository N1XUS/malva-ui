import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { form, disabled, FormField } from '@angular/forms/signals';
import { By } from '@angular/platform-browser';
import { NgControl } from '@angular/forms';
import { verifyFormsBinding } from '@malva-ui/core/form-utils/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvNumberInput } from './number-input';

/**
 * The forms bindings matrix for `mlv-number-input`: the SAME assertions must
 * hold for reactive (`[formControl]`), template-driven (`ngModel`), and signal
 * forms (`[formField]`) bindings. This is the signal-forms-migration safety net
 * — the control edits `value = model<number | null>(null)` (a `FormValueControl`)
 * and all three runs must stay green (see docs/plans/signal-forms-migration.md).
 *
 * Interaction gesture: type a number then commit with Enter (number-input holds
 * the raw string while typing and commits/clamps on blur or Enter). Sample and
 * expected values respect the `[min]="0" [max]="100"` bounds.
 */
describe('MlvNumberInput — forms bindings matrix', () => {
  function nativeInput(fixture: ComponentFixture<unknown>): HTMLInputElement {
    return fixture.nativeElement.querySelector(
      '.mlv-number-input__native',
    ) as HTMLInputElement;
  }

  function typeAndCommit(
    fixture: ComponentFixture<unknown>,
    text: string,
  ): void {
    const input = nativeInput(fixture);
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    fixture.detectChanges();
  }

  function blurField(fixture: ComponentFixture<unknown>): void {
    nativeInput(fixture).dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();
  }

  it('reactive: [formControl]', async () => {
    @Component({
      template: `<mlv-number-input
        label="Qty"
        [min]="0"
        [max]="100"
        [formControl]="ctrl"
      />`,
      imports: [MlvNumberInput, ReactiveFormsModule],
    })
    class ReactiveHostComponent {
      readonly ctrl = new FormControl<number | null>(0);
      readonly control = viewChild.required(MlvNumberInput);
    }

    await TestBed.configureTestingModule({
      imports: [ReactiveHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(ReactiveHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;

    await verifyFormsBinding<number | null>({
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
      sample: 42,
      interact: () => typeAndCommit(fixture, '43'),
      expectedAfterInteraction: 43,
      blur: () => blurField(fixture),
    });
  });

  it('template-driven: ngModel', async () => {
    @Component({
      template: `<mlv-number-input
        label="Qty"
        [min]="0"
        [max]="100"
        [(ngModel)]="value"
      />`,
      imports: [MlvNumberInput, FormsModule],
    })
    class NgModelHostComponent {
      readonly value = signal<number | null>(0);
    }

    await TestBed.configureTestingModule({
      imports: [NgModelHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(NgModelHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;
    const ngControl = fixture.debugElement
      .query(By.directive(MlvNumberInput))
      .injector.get(NgControl);

    await verifyFormsBinding<number | null>({
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
      sample: 42,
      interact: () => typeAndCommit(fixture, '43'),
      expectedAfterInteraction: 43,
      blur: () => blurField(fixture),
    });
  });

  it('signal forms: [formField]', async () => {
    @Component({
      template: `<mlv-number-input
        label="Qty"
        [min]="0"
        [max]="100"
        [formField]="f.qty"
      />`,
      imports: [MlvNumberInput, FormField],
    })
    class SignalFormsHostComponent {
      readonly disable = signal(false);
      readonly model = signal<{ qty: number | null }>({ qty: 0 });
      readonly f = form(this.model, (path) => {
        disabled(path.qty, () => this.disable());
      });
      readonly control = viewChild.required(MlvNumberInput);
    }

    await TestBed.configureTestingModule({
      imports: [SignalFormsHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(SignalFormsHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;

    await verifyFormsBinding<number | null>({
      adapter: {
        mode: 'signal-forms',
        setValue: async (v) => {
          host.model.update((m) => ({ ...m, qty: v }));
          fixture.detectChanges();
          await fixture.whenStable();
        },
        getValue: () => host.f.qty().value(),
        isTouched: () => host.f.qty().touched(),
        setDisabled: async (d) => {
          host.disable.set(d);
          fixture.detectChanges();
          await fixture.whenStable();
        },
        isDisabled: () => host.control().computedDisabled(),
      },
      sample: 42,
      interact: () => typeAndCommit(fixture, '43'),
      expectedAfterInteraction: 43,
      blur: () => blurField(fixture),
    });
  });
});
