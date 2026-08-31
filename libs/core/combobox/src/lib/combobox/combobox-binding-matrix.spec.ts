import { Component, signal, viewChild } from '@angular/core';
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
import { MlvCombobox } from './combobox';

const options = ['Option 1', 'Option 2'];

describe('MlvCombobox — forms bindings matrix', () => {
  it('reactive: [formControl]', async () => {
    @Component({
      template: `<mlv-combobox [options]="options" [formControl]="control" />`,
      imports: [MlvCombobox, ReactiveFormsModule],
    })
    class Host {
      readonly options = options;
      readonly control = new FormControl<string | null>(null);
      readonly combobox = viewChild.required(MlvCombobox<string>);
    }
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;

    await verifyFormsBinding<string | null>({
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
        isDisabled: () => host.combobox().computedDisabled(),
      },
      sample: 'Option 1',
      interact: () => {
        host.combobox().selectValues(['Option 2']);
        fixture.detectChanges();
      },
      expectedAfterInteraction: 'Option 2',
    });
    expect(host.control.touched).toBe(true);
  });

  it('template-driven: ngModel', async () => {
    @Component({
      template: `<mlv-combobox [options]="options" [(ngModel)]="value" />`,
      imports: [MlvCombobox, FormsModule],
    })
    class Host {
      readonly options = options;
      value: string | null = null;
      readonly combobox = viewChild.required(MlvCombobox<string>);
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
      .query(By.directive(MlvCombobox))
      .injector.get(NgControl);

    await verifyFormsBinding<string | null>({
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
      sample: 'Option 1',
      interact: () => {
        host.combobox().selectValues(['Option 2']);
        fixture.detectChanges();
      },
      expectedAfterInteraction: 'Option 2',
    });
    expect(ngControl.touched).toBe(true);
  });

  it('signal forms: [formField]', async () => {
    @Component({
      template: `<mlv-combobox
        [options]="options"
        [formField]="fields.option"
      />`,
      imports: [MlvCombobox, FormField],
    })
    class Host {
      readonly options = options;
      readonly disable = signal(false);
      readonly model = signal<{ option: string | null }>({ option: null });
      readonly fields = form(this.model, (path) => {
        disabled(path.option, () => this.disable());
      });
      readonly combobox = viewChild.required(MlvCombobox<string>);
    }
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;

    await verifyFormsBinding<string | null>({
      adapter: {
        mode: 'signal-forms',
        setValue: async (value) => {
          host.model.set({ option: value });
          fixture.detectChanges();
          await fixture.whenStable();
        },
        getValue: () => host.fields.option().value(),
        isTouched: () => host.fields.option().touched(),
        setDisabled: async (value) => {
          host.disable.set(value);
          fixture.detectChanges();
          await fixture.whenStable();
        },
        isDisabled: () => host.combobox().computedDisabled(),
      },
      sample: 'Option 1',
      interact: () => {
        host.combobox().selectValues(['Option 2']);
        fixture.detectChanges();
      },
      expectedAfterInteraction: 'Option 2',
    });
    expect(host.fields.option().touched()).toBe(true);
  });
});
