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
import { MlvSlider, type MlvSliderValue } from './slider';

describe('MlvSlider — forms bindings matrix', () => {
  function thumb(fixture: ComponentFixture<unknown>): HTMLElement {
    return fixture.nativeElement.querySelector('.mlv-slider__thumb--low');
  }

  function increment(fixture: ComponentFixture<unknown>): void {
    thumb(fixture).dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        cancelable: true,
      }),
    );
    fixture.detectChanges();
  }

  function blur(fixture: ComponentFixture<unknown>): void {
    thumb(fixture).dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();
  }

  it('reactive: [formControl]', async () => {
    @Component({
      template: `<mlv-slider [formControl]="control" />`,
      imports: [MlvSlider, ReactiveFormsModule],
    })
    class Host {
      readonly control = new FormControl<MlvSliderValue>(0, {
        nonNullable: true,
      });
      readonly slider = viewChild.required(MlvSlider);
    }

    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;

    await verifyFormsBinding<MlvSliderValue>({
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
        isDisabled: () => host.slider().computedDisabled(),
      },
      sample: 25,
      interact: () => increment(fixture),
      expectedAfterInteraction: 26,
      blur: () => blur(fixture),
    });
  });

  it('template-driven: ngModel', async () => {
    @Component({
      template: `<mlv-slider [(ngModel)]="value" />`,
      imports: [MlvSlider, FormsModule],
    })
    class Host {
      value: MlvSliderValue = 0;
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
      .query(By.directive(MlvSlider))
      .injector.get(NgControl);

    await verifyFormsBinding<MlvSliderValue>({
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
      sample: 25,
      interact: () => increment(fixture),
      expectedAfterInteraction: 26,
      blur: () => blur(fixture),
    });
  });

  it('signal forms: [formField]', async () => {
    @Component({
      template: `<mlv-slider [formField]="fields.value" />`,
      imports: [MlvSlider, FormField],
    })
    class Host {
      readonly disable = signal(false);
      readonly model = signal<{ value: MlvSliderValue }>({ value: 0 });
      readonly fields = form(this.model, (path) => {
        disabled(path.value, () => this.disable());
      });
      readonly slider = viewChild.required(MlvSlider);
    }

    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;

    await verifyFormsBinding<MlvSliderValue>({
      adapter: {
        mode: 'signal-forms',
        setValue: async (value) => {
          host.model.set({ value });
          fixture.detectChanges();
          await fixture.whenStable();
        },
        getValue: () => host.fields.value().value(),
        isTouched: () => host.fields.value().touched(),
        setDisabled: async (value) => {
          host.disable.set(value);
          fixture.detectChanges();
          await fixture.whenStable();
        },
        isDisabled: () => host.slider().computedDisabled(),
      },
      sample: 25,
      interact: () => increment(fixture),
      expectedAfterInteraction: 26,
      blur: () => blur(fixture),
    });
  });
});
