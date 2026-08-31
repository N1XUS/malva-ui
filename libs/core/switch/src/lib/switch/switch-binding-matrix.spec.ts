import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { form, disabled, FormField } from '@angular/forms/signals';
import { By } from '@angular/platform-browser';
import { NgControl } from '@angular/forms';
import { verifyFormsBinding } from '@malva-ui/core/form-utils/testing';
import { MlvSwitch } from './switch';

/**
 * The forms bindings matrix for `mlv-switch`: the SAME assertions must hold for
 * reactive (`[formControl]`), template-driven (`ngModel`), and signal forms
 * (`[formField]`) bindings. `mlv-switch` is a `FormCheckboxControl` — the form
 * value is a `boolean` carried by the `checked` model (not `value`). This is the
 * checkbox-variant safety net for docs/plans/signal-forms-migration.md: after
 * the CVA→FormCheckboxControl cutover, all three runs must stay green.
 *
 * User interaction = clicking the rendered switch (native `click`, which toggles
 * `checked` and fires `change`). Blur = blurring the native input.
 */
describe('MlvSwitch — forms bindings matrix', () => {
  function nativeInput(fixture: ComponentFixture<unknown>): HTMLInputElement {
    return fixture.nativeElement.querySelector(
      '.mlv-switch__native',
    ) as HTMLInputElement;
  }

  async function clickInput(fixture: ComponentFixture<unknown>): Promise<void> {
    nativeInput(fixture).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function blurField(fixture: ComponentFixture<unknown>): void {
    nativeInput(fixture).dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();
  }

  it('reactive: [formControl]', async () => {
    @Component({
      template: `<mlv-switch [formControl]="ctrl">Dark mode</mlv-switch>`,
      imports: [MlvSwitch, ReactiveFormsModule],
    })
    class ReactiveHostComponent {
      readonly ctrl = new FormControl(false, { nonNullable: true });
      readonly switch = viewChild.required(MlvSwitch);
    }

    await TestBed.configureTestingModule({
      imports: [ReactiveHostComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(ReactiveHostComponent);
    fixture.detectChanges();
    const host = fixture.componentInstance;

    await verifyFormsBinding<boolean>({
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
        isDisabled: () => host.switch().computedDisabled(),
      },
      sample: true,
      interact: () => clickInput(fixture),
      expectedAfterInteraction: false,
      blur: () => blurField(fixture),
    });
  });

  it('template-driven: ngModel', async () => {
    @Component({
      template: `<mlv-switch [(ngModel)]="value">Dark mode</mlv-switch>`,
      imports: [MlvSwitch, FormsModule],
    })
    class NgModelHostComponent {
      readonly value = signal(false);
    }

    await TestBed.configureTestingModule({
      imports: [NgModelHostComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(NgModelHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;
    const ngControl = fixture.debugElement
      .query(By.directive(MlvSwitch))
      .injector.get(NgControl);

    await verifyFormsBinding<boolean>({
      adapter: {
        mode: 'template-driven',
        setValue: async (v) => {
          host.value.set(v);
          fixture.detectChanges();
          await fixture.whenStable();
          fixture.detectChanges();
        },
        getValue: () => host.value(),
        isTouched: () => ngControl.touched === true,
      },
      sample: true,
      interact: () => clickInput(fixture),
      expectedAfterInteraction: false,
      blur: () => blurField(fixture),
    });
  });

  it('signal forms: [formField] drives the FormCheckboxControl', async () => {
    @Component({
      template: `<mlv-switch [formField]="f.on">Dark mode</mlv-switch>`,
      imports: [MlvSwitch, FormField],
    })
    class SignalFormsHostComponent {
      readonly disable = signal(false);
      readonly model = signal({ on: false });
      readonly f = form(this.model, (path) => {
        disabled(path.on, () => this.disable());
      });
      readonly switch = viewChild.required(MlvSwitch);
    }

    await TestBed.configureTestingModule({
      imports: [SignalFormsHostComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(SignalFormsHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;

    await verifyFormsBinding<boolean>({
      adapter: {
        mode: 'signal-forms',
        setValue: async (v) => {
          host.model.update((m) => ({ ...m, on: v }));
          fixture.detectChanges();
          await fixture.whenStable();
        },
        getValue: () => host.f.on().value(),
        isTouched: () => host.f.on().touched(),
        setDisabled: async (d) => {
          host.disable.set(d);
          fixture.detectChanges();
          await fixture.whenStable();
        },
        isDisabled: () => host.switch().computedDisabled(),
      },
      sample: true,
      interact: () => clickInput(fixture),
      expectedAfterInteraction: false,
      blur: () => blurField(fixture),
    });
  });
});
