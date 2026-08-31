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
import { MlvColorPickerPopup } from './color-picker-popup';

describe('MlvColorPickerPopup — forms bindings matrix', () => {
  function changeColor(fixture: ComponentFixture<unknown>): void {
    const picker = fixture.debugElement.query(By.directive(MlvColorPickerPopup))
      .componentInstance as MlvColorPickerPopup;
    (
      picker as unknown as { _onColorChange(value: string): void }
    )._onColorChange('#112233');
    fixture.detectChanges();
  }

  function blur(fixture: ComponentFixture<unknown>): void {
    const input = fixture.nativeElement.querySelector(
      '.mlv-color-picker-popup__input',
    ) as HTMLInputElement;
    input.dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();
  }

  it('reactive: [formControl]', async () => {
    @Component({
      template: `<mlv-color-picker-popup live [formControl]="control" />`,
      imports: [MlvColorPickerPopup, ReactiveFormsModule],
    })
    class Host {
      readonly control = new FormControl('#ff0000', { nonNullable: true });
      readonly picker = viewChild.required(MlvColorPickerPopup);
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
      sample: '#00ff00',
      interact: () => changeColor(fixture),
      expectedAfterInteraction: '#112233',
      blur: () => blur(fixture),
    });
  });

  it('template-driven: ngModel', async () => {
    @Component({
      template: `<mlv-color-picker-popup live [(ngModel)]="value" />`,
      imports: [MlvColorPickerPopup, FormsModule],
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
      .query(By.directive(MlvColorPickerPopup))
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
      sample: '#00ff00',
      interact: () => changeColor(fixture),
      expectedAfterInteraction: '#112233',
      blur: () => blur(fixture),
    });
  });

  it('signal forms: [formField]', async () => {
    @Component({
      template: `<mlv-color-picker-popup live [formField]="fields.color" />`,
      imports: [MlvColorPickerPopup, FormField],
    })
    class Host {
      readonly disable = signal(false);
      readonly model = signal({ color: '#ff0000' });
      readonly fields = form(this.model, (path) => {
        disabled(path.color, () => this.disable());
      });
      readonly picker = viewChild.required(MlvColorPickerPopup);
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
      sample: '#00ff00',
      interact: () => changeColor(fixture),
      expectedAfterInteraction: '#112233',
      blur: () => blur(fixture),
    });
  });
});
