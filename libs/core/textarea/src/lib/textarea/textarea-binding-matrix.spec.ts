import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { form, disabled, FormField } from '@angular/forms/signals';
import { By } from '@angular/platform-browser';
import { NgControl } from '@angular/forms';
import { verifyFormsBinding } from '@malva-ui/core/form-utils/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvTextarea } from './textarea';

/**
 * The forms bindings matrix for `mlv-textarea`: the SAME assertions must hold
 * for reactive (`[formControl]`), template-driven (`ngModel`), and signal forms
 * (`[formField]`) bindings. This is the signal-forms-migration safety net — the
 * control extends `MlvSignalFormControlBase` (`FormValueControl`), and all three
 * runs must stay green (see docs/plans/signal-forms-migration.md).
 */
describe('MlvTextarea — forms bindings matrix', () => {
  function nativeTextarea(
    fixture: ComponentFixture<unknown>,
  ): HTMLTextAreaElement {
    return fixture.nativeElement.querySelector(
      'textarea',
    ) as HTMLTextAreaElement;
  }

  function typeInto(fixture: ComponentFixture<unknown>, text: string): void {
    const textarea = nativeTextarea(fixture);
    textarea.value = text;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }

  function blurField(fixture: ComponentFixture<unknown>): void {
    nativeTextarea(fixture).dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();
  }

  it('reactive: [formControl]', async () => {
    @Component({
      template: `<mlv-textarea label="Notes" [formControl]="ctrl" />`,
      imports: [MlvTextarea, ReactiveFormsModule],
    })
    class ReactiveHostComponent {
      readonly ctrl = new FormControl('', { nonNullable: true });
      readonly textarea = viewChild.required(MlvTextarea);
    }

    await TestBed.configureTestingModule({
      imports: [ReactiveHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(ReactiveHostComponent);
    fixture.detectChanges();
    const host = fixture.componentInstance;

    await verifyFormsBinding<string>({
      adapter: {
        mode: 'reactive',
        setValue: (v) => {
          host.ctrl.setValue(v);
          fixture.detectChanges();
        },
        getValue: () => host.ctrl.value,
        isTouched: () => host.ctrl.touched,
        setDisabled: (d) => {
          if (d) host.ctrl.disable();
          else host.ctrl.enable();
          fixture.detectChanges();
        },
        isDisabled: () => host.textarea().computedDisabled(),
      },
      sample: 'first draft',
      interact: () => typeInto(fixture, 'typed'),
      expectedAfterInteraction: 'typed',
      blur: () => blurField(fixture),
    });
  });

  it('template-driven: ngModel', async () => {
    @Component({
      template: `<mlv-textarea label="Notes" [(ngModel)]="value" />`,
      imports: [MlvTextarea, FormsModule],
    })
    class NgModelHostComponent {
      readonly value = signal('');
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
      .query(By.directive(MlvTextarea))
      .injector.get(NgControl);

    await verifyFormsBinding<string>({
      adapter: {
        mode: 'template-driven',
        setValue: async (v) => {
          host.value.set(v);
          fixture.detectChanges();
          await fixture.whenStable();
        },
        getValue: () => host.value(),
        isTouched: () => ngControl.touched === true,
      },
      sample: 'first draft',
      interact: () => typeInto(fixture, 'typed'),
      expectedAfterInteraction: 'typed',
      blur: () => blurField(fixture),
    });
  });

  it('signal forms: [formField]', async () => {
    @Component({
      template: `<mlv-textarea label="Notes" [formField]="f.notes" />`,
      imports: [MlvTextarea, FormField],
    })
    class SignalFormsHostComponent {
      readonly disable = signal(false);
      readonly model = signal({ notes: '' });
      readonly f = form(this.model, (path) => {
        disabled(path.notes, () => this.disable());
      });
      readonly textarea = viewChild.required(MlvTextarea);
    }

    await TestBed.configureTestingModule({
      imports: [SignalFormsHostComponent],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(SignalFormsHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;

    await verifyFormsBinding<string>({
      adapter: {
        mode: 'signal-forms',
        setValue: async (v) => {
          host.model.update((m) => ({ ...m, notes: v }));
          fixture.detectChanges();
          await fixture.whenStable();
        },
        getValue: () => host.f.notes().value(),
        isTouched: () => host.f.notes().touched(),
        setDisabled: async (d) => {
          host.disable.set(d);
          fixture.detectChanges();
          await fixture.whenStable();
        },
        isDisabled: () => host.textarea().computedDisabled(),
      },
      sample: 'first draft',
      interact: () => typeInto(fixture, 'typed'),
      expectedAfterInteraction: 'typed',
      blur: () => blurField(fixture),
    });
  });
});
