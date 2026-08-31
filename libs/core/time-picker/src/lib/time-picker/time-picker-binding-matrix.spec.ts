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
import { MlvTimePicker } from './time-picker';

describe('MlvTimePicker — forms bindings matrix', () => {
  function changeMinute(fixture: ComponentFixture<unknown>): void {
    const picker = fixture.debugElement.query(By.directive(MlvTimePicker))
      .componentInstance as MlvTimePicker;
    (
      picker as unknown as { _onMinuteChange(value: number): void }
    )._onMinuteChange(21);
    fixture.detectChanges();
  }

  function blur(fixture: ComponentFixture<unknown>): void {
    const trigger = fixture.nativeElement.querySelector(
      '.mlv-time-picker__trigger',
    ) as HTMLElement;
    trigger.dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();
  }

  it('reactive: [formControl]', async () => {
    @Component({
      template: `<mlv-time-picker [formControl]="control" />`,
      imports: [MlvTimePicker, ReactiveFormsModule],
    })
    class Host {
      readonly control = new FormControl('10:20', { nonNullable: true });
      readonly picker = viewChild.required(MlvTimePicker);
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
      sample: '10:20',
      interact: () => changeMinute(fixture),
      expectedAfterInteraction: '10:21',
      blur: () => blur(fixture),
    });
  });

  it('template-driven: ngModel', async () => {
    @Component({
      template: `<mlv-time-picker [(ngModel)]="value" />`,
      imports: [MlvTimePicker, FormsModule],
    })
    class Host {
      value = '10:20';
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
      .query(By.directive(MlvTimePicker))
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
      sample: '10:20',
      interact: () => changeMinute(fixture),
      expectedAfterInteraction: '10:21',
      blur: () => blur(fixture),
    });
  });

  it('signal forms: [formField]', async () => {
    @Component({
      template: `<mlv-time-picker [formField]="fields.time" />`,
      imports: [MlvTimePicker, FormField],
    })
    class Host {
      readonly disable = signal(false);
      readonly model = signal({ time: '10:20' });
      readonly fields = form(this.model, (path) => {
        disabled(path.time, () => this.disable());
      });
      readonly picker = viewChild.required(MlvTimePicker);
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
          host.model.set({ time: value });
          fixture.detectChanges();
          await fixture.whenStable();
        },
        getValue: () => host.fields.time().value(),
        isTouched: () => host.fields.time().touched(),
        setDisabled: async (value) => {
          host.disable.set(value);
          fixture.detectChanges();
          await fixture.whenStable();
        },
        isDisabled: () => host.picker().computedDisabled(),
      },
      sample: '10:20',
      interact: () => changeMinute(fixture),
      expectedAfterInteraction: '10:21',
      blur: () => blur(fixture),
    });
  });
});
