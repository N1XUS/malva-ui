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
import {
  MlvDateRangePicker,
  type MlvDateRangePickerValue,
} from './date-range-picker';

type Range = MlvDateRangePickerValue<Date> | null;

const sample: Range = {
  start: new Date(2026, 6, 10),
  end: new Date(2026, 6, 12),
};
const changed: Range = {
  start: new Date(2026, 6, 20),
  end: new Date(2026, 6, 24),
};

function chooseRange(
  fixture: ComponentFixture<unknown>,
  picker: MlvDateRangePicker<Date>,
): void {
  picker.onRangeChanged(changed);
  picker.applySelection();
  fixture.detectChanges();
}

function blur(fixture: ComponentFixture<unknown>): void {
  fixture.nativeElement
    .querySelector('.mlv-date-range-picker__trigger')
    .dispatchEvent(new FocusEvent('blur'));
  fixture.detectChanges();
}

describe('MlvDateRangePicker — forms bindings matrix', () => {
  it('reactive: [formControl]', async () => {
    @Component({
      template: `<mlv-date-range-picker [formControl]="control" />`,
      imports: [MlvDateRangePicker, ReactiveFormsModule],
    })
    class Host {
      readonly control = new FormControl<Range>(null);
      readonly picker = viewChild.required(MlvDateRangePicker<Date>);
    }

    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;

    await verifyFormsBinding<Range>({
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
      interact: () => chooseRange(fixture, host.picker()),
      expectedAfterInteraction: changed,
      blur: () => blur(fixture),
    });
  });

  it('template-driven: ngModel', async () => {
    @Component({
      template: `<mlv-date-range-picker [(ngModel)]="value" />`,
      imports: [MlvDateRangePicker, FormsModule],
    })
    class Host {
      value: Range = null;
      readonly picker = viewChild.required(MlvDateRangePicker<Date>);
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
      .query(By.directive(MlvDateRangePicker))
      .injector.get(NgControl);

    await verifyFormsBinding<Range>({
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
      interact: () => chooseRange(fixture, host.picker()),
      expectedAfterInteraction: changed,
      blur: () => blur(fixture),
    });
  });

  it('signal forms: [formField]', async () => {
    @Component({
      template: `<mlv-date-range-picker [formField]="fields.range" />`,
      imports: [MlvDateRangePicker, FormField],
    })
    class Host {
      readonly disable = signal(false);
      readonly model = signal<{ range: Range }>({ range: null });
      readonly fields = form(this.model, (path) => {
        disabled(path.range, () => this.disable());
      });
      readonly picker = viewChild.required(MlvDateRangePicker<Date>);
    }

    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;

    await verifyFormsBinding<Range>({
      adapter: {
        mode: 'signal-forms',
        setValue: async (value) => {
          host.model.set({ range: value });
          fixture.detectChanges();
          await fixture.whenStable();
        },
        getValue: () => host.fields.range().value(),
        isTouched: () => host.fields.range().touched(),
        setDisabled: async (value) => {
          host.disable.set(value);
          fixture.detectChanges();
          await fixture.whenStable();
        },
        isDisabled: () => host.picker().computedDisabled(),
      },
      sample,
      interact: () => chooseRange(fixture, host.picker()),
      expectedAfterInteraction: changed,
      blur: () => blur(fixture),
    });
  });
});
