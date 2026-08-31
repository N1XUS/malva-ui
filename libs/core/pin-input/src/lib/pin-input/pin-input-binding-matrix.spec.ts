import { Component, signal, viewChild } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import {
  FormControl,
  FormsModule,
  NgControl,
  ReactiveFormsModule,
} from '@angular/forms';
import { disabled, form, FormField } from '@angular/forms/signals';
import { By } from '@angular/platform-browser';
import { verifyFormsBinding } from '@malva-ui/core/form-utils/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvPinInput } from './pin-input';

describe('MlvPinInput — forms bindings matrix', () => {
  function firstCell(fixture: ComponentFixture<unknown>): HTMLInputElement {
    return fixture.nativeElement.querySelector(
      '.mlv-pin-input__cell .mlv-input__native',
    );
  }

  function replaceFirst(fixture: ComponentFixture<unknown>): void {
    const input = firstCell(fixture);
    input.value = '9';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }

  function blur(fixture: ComponentFixture<unknown>): void {
    firstCell(fixture).dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();
  }

  it('reactive: [formControl]', async () => {
    @Component({
      template: `<mlv-pin-input [length]="4" [formControl]="control" />`,
      imports: [MlvPinInput, ReactiveFormsModule],
    })
    class Host {
      readonly control = new FormControl('', { nonNullable: true });
      readonly pin = viewChild.required(MlvPinInput);
    }

    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;

    await verifyFormsBinding<string>({
      adapter: {
        mode: 'reactive',
        setValue: (value) => {
          host.control.setValue(value);
          fixture.detectChanges();
        },
        getValue: () => host.control.value,
        isTouched: () => host.control.touched,
        setDisabled: (value) => {
          if (value) host.control.disable();
          else host.control.enable();
          fixture.detectChanges();
        },
        isDisabled: () => host.pin().computedDisabled(),
      },
      sample: 'ABCD',
      interact: () => replaceFirst(fixture),
      expectedAfterInteraction: '9BCD',
      blur: () => blur(fixture),
    });
  });

  it('template-driven: ngModel', async () => {
    @Component({
      template: `<mlv-pin-input [length]="4" [(ngModel)]="value" />`,
      imports: [MlvPinInput, FormsModule],
    })
    class Host {
      value = '';
    }

    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;
    const ngControl = fixture.debugElement
      .query(By.directive(MlvPinInput))
      .injector.get(NgControl);

    await verifyFormsBinding<string>({
      adapter: {
        mode: 'template-driven',
        setValue: async (value) => {
          host.value = value;
          fixture.detectChanges();
          await fixture.whenStable();
          fixture.detectChanges();
        },
        getValue: () => host.value,
        isTouched: () => ngControl.touched,
      },
      sample: 'ABCD',
      interact: () => replaceFirst(fixture),
      expectedAfterInteraction: '9BCD',
      blur: () => blur(fixture),
    });
  });

  it('signal forms: [formField]', async () => {
    @Component({
      template: `<mlv-pin-input [length]="4" [formField]="fields.code" />`,
      imports: [MlvPinInput, FormField],
    })
    class Host {
      readonly disable = signal(false);
      readonly model = signal({ code: '' });
      readonly fields = form(this.model, (path) => {
        disabled(path.code, () => this.disable());
      });
      readonly pin = viewChild.required(MlvPinInput);
    }

    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;

    await verifyFormsBinding<string>({
      adapter: {
        mode: 'signal-forms',
        setValue: async (value) => {
          host.model.set({ code: value });
          fixture.detectChanges();
          await fixture.whenStable();
        },
        getValue: () => host.fields.code().value(),
        isTouched: () => host.fields.code().touched(),
        setDisabled: async (value) => {
          host.disable.set(value);
          fixture.detectChanges();
          await fixture.whenStable();
        },
        isDisabled: () => host.pin().computedDisabled(),
      },
      sample: 'ABCD',
      interact: () => replaceFirst(fixture),
      expectedAfterInteraction: '9BCD',
      blur: () => blur(fixture),
    });
  });
});
