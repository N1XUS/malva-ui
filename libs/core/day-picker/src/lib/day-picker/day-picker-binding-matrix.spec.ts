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
import { MlvDayPicker } from './day-picker';

describe('MlvDayPicker — forms bindings matrix', () => {
  const sample = new Date(2026, 6, 22);
  const selected = new Date(2026, 6, 23);

  function select(fixture: ComponentFixture<unknown>): void {
    const picker = fixture.debugElement.query(By.directive(MlvDayPicker))
      .componentInstance as MlvDayPicker<Date>;
    picker.onDateSelected(selected);
    fixture.detectChanges();
  }

  function blur(fixture: ComponentFixture<unknown>): void {
    const trigger = fixture.nativeElement.querySelector(
      '.mlv-day-picker__trigger',
    ) as HTMLElement;
    trigger.dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();
  }

  it('reactive: [formControl]', async () => {
    @Component({
      template: `<mlv-day-picker [formControl]="control" />`,
      imports: [MlvDayPicker, ReactiveFormsModule],
    })
    class Host {
      readonly control = new FormControl<Date | null>(null);
      readonly picker = viewChild.required(MlvDayPicker<Date>);
    }

    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;

    await verifyFormsBinding<Date | null>({
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
      sample,
      interact: () => select(fixture),
      expectedAfterInteraction: selected,
      blur: () => blur(fixture),
    });
  });

  it('template-driven: ngModel', async () => {
    @Component({
      template: `<mlv-day-picker [(ngModel)]="value" />`,
      imports: [MlvDayPicker, FormsModule],
    })
    class Host {
      value: Date | null = null;
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
      .query(By.directive(MlvDayPicker))
      .injector.get(NgControl);

    await verifyFormsBinding<Date | null>({
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
      sample,
      interact: () => select(fixture),
      expectedAfterInteraction: selected,
      blur: () => blur(fixture),
    });
  });

  it('signal forms: [formField]', async () => {
    @Component({
      template: `<mlv-day-picker [formField]="fields.date" />`,
      imports: [MlvDayPicker, FormField],
    })
    class Host {
      readonly disable = signal(false);
      readonly model = signal<{ date: Date | null }>({ date: null });
      readonly fields = form(this.model, (path) => {
        disabled(path.date, () => this.disable());
      });
      readonly picker = viewChild.required(MlvDayPicker<Date>);
    }

    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;

    await verifyFormsBinding<Date | null>({
      adapter: {
        mode: 'signal-forms',
        setValue: async (value) => {
          host.model.set({ date: value });
          fixture.detectChanges();
          await fixture.whenStable();
        },
        getValue: () => host.fields.date().value(),
        isTouched: () => host.fields.date().touched(),
        setDisabled: async (value) => {
          host.disable.set(value);
          fixture.detectChanges();
          await fixture.whenStable();
        },
        isDisabled: () => host.picker().computedDisabled(),
      },
      sample,
      interact: () => select(fixture),
      expectedAfterInteraction: selected,
      blur: () => blur(fixture),
    });
  });
});
