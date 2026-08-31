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
import { MlvSelect } from './select';

const options = ['Apple', 'Banana'];

describe('MlvSelect — forms bindings matrix', () => {
  it('reactive: [formControl]', async () => {
    @Component({
      template: `<mlv-select [options]="options" [formControl]="control" />`,
      imports: [MlvSelect, ReactiveFormsModule],
    })
    class Host {
      readonly options = options;
      readonly control = new FormControl<string | null>(null);
      readonly select = viewChild.required(MlvSelect<string>);
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
        isDisabled: () => host.select().computedDisabled(),
      },
      sample: 'Apple',
      interact: () => {
        host.select().selectOption(['Banana']);
        fixture.detectChanges();
      },
      expectedAfterInteraction: 'Banana',
    });
    expect(host.control.touched).toBe(true);
  });

  it('template-driven: ngModel', async () => {
    @Component({
      template: `<mlv-select [options]="options" [(ngModel)]="value" />`,
      imports: [MlvSelect, FormsModule],
    })
    class Host {
      readonly options = options;
      value: string | null = null;
      readonly select = viewChild.required(MlvSelect<string>);
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
      .query(By.directive(MlvSelect))
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
      sample: 'Apple',
      interact: () => {
        host.select().selectOption(['Banana']);
        fixture.detectChanges();
      },
      expectedAfterInteraction: 'Banana',
    });
    expect(ngControl.touched).toBe(true);
  });

  it('signal forms: [formField]', async () => {
    @Component({
      template: `<mlv-select [options]="options" [formField]="fields.fruit" />`,
      imports: [MlvSelect, FormField],
    })
    class Host {
      readonly options = options;
      readonly disable = signal(false);
      readonly model = signal<{ fruit: string | null }>({ fruit: null });
      readonly fields = form(this.model, (path) => {
        disabled(path.fruit, () => this.disable());
      });
      readonly select = viewChild.required(MlvSelect<string>);
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
          host.model.set({ fruit: value });
          fixture.detectChanges();
          await fixture.whenStable();
        },
        getValue: () => host.fields.fruit().value(),
        isTouched: () => host.fields.fruit().touched(),
        setDisabled: async (value) => {
          host.disable.set(value);
          fixture.detectChanges();
          await fixture.whenStable();
        },
        isDisabled: () => host.select().computedDisabled(),
      },
      sample: 'Apple',
      interact: () => {
        host.select().selectOption(['Banana']);
        fixture.detectChanges();
      },
      expectedAfterInteraction: 'Banana',
    });
    expect(host.fields.fruit().touched()).toBe(true);
  });
});
