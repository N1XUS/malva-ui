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
import { MlvRating } from './rating';

/**
 * Forms-transport safety net for `mlv-rating`. The same value, touch, and
 * disabled assertions run through reactive, template-driven, and signal-form
 * bindings after the control's `FormValueControl` cutover.
 */
describe('MlvRating — forms bindings matrix', () => {
  function stars(fixture: ComponentFixture<unknown>): HTMLButtonElement[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll('.mlv-rating__star'),
    );
  }

  function chooseFourthStar(fixture: ComponentFixture<unknown>): void {
    stars(fixture)[3].click();
    fixture.detectChanges();
  }

  function blurFourthStar(fixture: ComponentFixture<unknown>): void {
    stars(fixture)[3].dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();
  }

  it('reactive: [formControl]', async () => {
    @Component({
      template: `<mlv-rating [max]="5" [formControl]="ctrl" />`,
      imports: [MlvRating, ReactiveFormsModule],
    })
    class ReactiveHostComponent {
      readonly ctrl = new FormControl(0, { nonNullable: true });
      readonly control = viewChild.required(MlvRating);
    }

    await TestBed.configureTestingModule({
      imports: [ReactiveHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(ReactiveHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;

    await verifyFormsBinding<number>({
      adapter: {
        mode: 'reactive',
        setValue: (value) => {
          host.ctrl.setValue(value);
          fixture.detectChanges();
        },
        getValue: () => host.ctrl.value,
        isTouched: () => host.ctrl.touched,
        setDisabled: (isDisabled) => {
          if (isDisabled) host.ctrl.disable();
          else host.ctrl.enable();
          fixture.detectChanges();
        },
        isDisabled: () => host.control().computedDisabled(),
      },
      sample: 3,
      interact: () => chooseFourthStar(fixture),
      expectedAfterInteraction: 4,
      blur: () => blurFourthStar(fixture),
    });
  });

  it('template-driven: ngModel', async () => {
    @Component({
      template: `<mlv-rating [max]="5" [(ngModel)]="score" />`,
      imports: [MlvRating, FormsModule],
    })
    class NgModelHostComponent {
      readonly score = signal(0);
    }

    await TestBed.configureTestingModule({
      imports: [NgModelHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(NgModelHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;
    const ngControl = fixture.debugElement
      .query(By.directive(MlvRating))
      .injector.get(NgControl);

    await verifyFormsBinding<number>({
      adapter: {
        mode: 'template-driven',
        setValue: async (value) => {
          host.score.set(value);
          fixture.detectChanges();
          await fixture.whenStable();
        },
        getValue: () => host.score(),
        isTouched: () => ngControl.touched === true,
      },
      sample: 3,
      interact: () => chooseFourthStar(fixture),
      expectedAfterInteraction: 4,
      blur: () => blurFourthStar(fixture),
    });
  });

  it('signal forms: [formField]', async () => {
    @Component({
      template: `<mlv-rating [formField]="ratingForm.score" />`,
      imports: [MlvRating, FormField],
    })
    class SignalFormsHostComponent {
      readonly disable = signal(false);
      readonly model = signal({ score: 0 });
      readonly ratingForm = form(this.model, (path) => {
        disabled(path.score, () => this.disable());
      });
      readonly control = viewChild.required(MlvRating);
    }

    await TestBed.configureTestingModule({
      imports: [SignalFormsHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(SignalFormsHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;

    await verifyFormsBinding<number>({
      adapter: {
        mode: 'signal-forms',
        setValue: async (value) => {
          host.model.update((model) => ({ ...model, score: value }));
          fixture.detectChanges();
          await fixture.whenStable();
        },
        getValue: () => host.ratingForm.score().value(),
        isTouched: () => host.ratingForm.score().touched(),
        setDisabled: async (isDisabled) => {
          host.disable.set(isDisabled);
          fixture.detectChanges();
          await fixture.whenStable();
        },
        isDisabled: () => host.control().computedDisabled(),
      },
      sample: 3,
      interact: () => chooseFourthStar(fixture),
      expectedAfterInteraction: 4,
      blur: () => blurFourthStar(fixture),
    });
  });
});
