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
import { MlvColorPicker } from './color-picker';

describe('MlvColorPicker — forms bindings matrix', () => {
  const changedColor = '#00ff00';

  function changeHue(fixture: ComponentFixture<unknown>): void {
    const input = fixture.nativeElement.querySelector(
      '.mlv-color-picker__slider-track--hue input',
    ) as HTMLInputElement;
    input.value = '120';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }

  function blur(fixture: ComponentFixture<unknown>): void {
    const input = fixture.nativeElement.querySelector(
      '.mlv-color-picker__slider-track--hue input',
    ) as HTMLInputElement;
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    fixture.detectChanges();
  }

  it('reactive: [formControl]', async () => {
    @Component({
      template: `<mlv-color-picker [formControl]="control" />`,
      imports: [MlvColorPicker, ReactiveFormsModule],
    })
    class Host {
      readonly control = new FormControl('#ff0000', { nonNullable: true });
      readonly picker = viewChild.required(MlvColorPicker);
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
        isDisabled: () => host.picker().computedDisabled(),
      },
      sample: '#0000ff',
      interact: () => changeHue(fixture),
      expectedAfterInteraction: changedColor,
      blur: () => blur(fixture),
    });
  });

  it('template-driven: ngModel', async () => {
    @Component({
      template: `<mlv-color-picker [(ngModel)]="value" />`,
      imports: [MlvColorPicker, FormsModule],
    })
    class Host {
      value = '#ff0000';
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
      .query(By.directive(MlvColorPicker))
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
      sample: '#0000ff',
      interact: () => changeHue(fixture),
      expectedAfterInteraction: changedColor,
      blur: () => blur(fixture),
    });
  });

  it('signal forms: [formField]', async () => {
    @Component({
      template: `<mlv-color-picker [formField]="fields.color" />`,
      imports: [MlvColorPicker, FormField],
    })
    class Host {
      readonly disable = signal(false);
      readonly model = signal({ color: '#ff0000' });
      readonly fields = form(this.model, (path) => {
        disabled(path.color, () => this.disable());
      });
      readonly picker = viewChild.required(MlvColorPicker);
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
          host.model.set({ color: value });
          fixture.detectChanges();
          await fixture.whenStable();
        },
        getValue: () => host.fields.color().value(),
        isTouched: () => host.fields.color().touched(),
        setDisabled: async (value) => {
          host.disable.set(value);
          fixture.detectChanges();
          await fixture.whenStable();
        },
        isDisabled: () => host.picker().computedDisabled(),
      },
      sample: '#0000ff',
      interact: () => changeHue(fixture),
      expectedAfterInteraction: changedColor,
      blur: () => blur(fixture),
    });
  });
});
