import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { form, disabled, FormField } from '@angular/forms/signals';
import { By } from '@angular/platform-browser';
import { NgControl } from '@angular/forms';
import { verifyFormsBinding } from '@malva-ui/core/form-utils/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvInput } from './input';

/**
 * The forms bindings matrix for `mlv-input`: the SAME assertions must hold for
 * reactive (`[formControl]`), template-driven (`ngModel`), and signal forms
 * (`[formField]`) bindings. This is the signal-forms-migration safety net —
 * when the control later swaps its CVA base for `FormValueControl`, all three
 * runs must stay green (see docs/plans/signal-forms-migration.md).
 */
describe('MlvInput — forms bindings matrix', () => {
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

  it('reactive: [formControl]', async () => {
    @Component({
      template: `<mlv-input label="Email" [formControl]="ctrl" />`,
      imports: [MlvInput, ReactiveFormsModule],
    })
    class ReactiveHostComponent {
      readonly ctrl = new FormControl('', { nonNullable: true });
      readonly input = viewChild.required(MlvInput);
    }

    await TestBed.configureTestingModule({
      imports: [ReactiveHostComponent],
      providers: [provideMlvI18nTesting()],
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
        isDisabled: () => host.input().computedDisabled(),
      },
      sample: 'a@b.co',
      interact: () => typeInto(fixture, 'typed'),
      expectedAfterInteraction: 'typed',
      blur: () => blurField(fixture),
    });
  });

  it('template-driven: ngModel', async () => {
    @Component({
      template: `<mlv-input label="Email" [(ngModel)]="value" />`,
      imports: [MlvInput, FormsModule],
    })
    class NgModelHostComponent {
      readonly value = signal('');
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
      .query(By.directive(MlvInput))
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
      sample: 'a@b.co',
      interact: () => typeInto(fixture, 'typed'),
      expectedAfterInteraction: 'typed',
      blur: () => blurField(fixture),
    });
  });

  it('signal forms: [formField] binds the CVA control (direction-A interop)', async () => {
    @Component({
      template: `<mlv-input label="Email" [formField]="f.email" />`,
      imports: [MlvInput, FormField],
    })
    class SignalFormsHostComponent {
      readonly disable = signal(false);
      readonly model = signal({ email: '' });
      readonly f = form(this.model, (path) => {
        disabled(path.email, () => this.disable());
      });
      readonly input = viewChild.required(MlvInput);
    }

    await TestBed.configureTestingModule({
      imports: [SignalFormsHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(SignalFormsHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;

    await verifyFormsBinding<string>({
      adapter: {
        mode: 'signal-forms',
        setValue: async (v) => {
          host.model.update((m) => ({ ...m, email: v }));
          fixture.detectChanges();
          await fixture.whenStable();
        },
        getValue: () => host.f.email().value(),
        isTouched: () => host.f.email().touched(),
        setDisabled: async (d) => {
          host.disable.set(d);
          fixture.detectChanges();
          await fixture.whenStable();
        },
        isDisabled: () => host.input().computedDisabled(),
      },
      sample: 'a@b.co',
      interact: () => typeInto(fixture, 'typed'),
      expectedAfterInteraction: 'typed',
      blur: () => blurField(fixture),
    });
  });
});
