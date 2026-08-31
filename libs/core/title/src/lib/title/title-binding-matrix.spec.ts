import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { Component, signal, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { form, disabled, FormField } from '@angular/forms/signals';
import { By } from '@angular/platform-browser';
import { NgControl } from '@angular/forms';
import { verifyFormsBinding } from '@malva-ui/core/form-utils/testing';
import { MlvTitle } from './title';

/**
 * The forms bindings matrix for `[mlvTitle]` (editable mode): the SAME
 * assertions must hold for reactive (`[formControl]`), template-driven
 * (`ngModel`), and signal forms (`[formField]`) bindings. This is the
 * signal-forms-migration safety net — the control extends
 * `MlvSignalFormControlBase` (`FormValueControl<string | null>`), and all three
 * runs must stay green (see docs/plans/signal-forms-migration.md).
 */
describe('MlvTitle — forms bindings matrix', () => {
  function editorTextarea(
    fixture: ComponentFixture<unknown>,
  ): HTMLTextAreaElement {
    return fixture.nativeElement.querySelector(
      'textarea',
    ) as HTMLTextAreaElement;
  }

  function typeInto(fixture: ComponentFixture<unknown>, text: string): void {
    const textarea = editorTextarea(fixture);
    textarea.value = text;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }

  function blurField(fixture: ComponentFixture<unknown>): void {
    editorTextarea(fixture).dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();
  }

  it('reactive: [formControl]', async () => {
    @Component({
      template: `<h2
        mlvTitle
        editable
        [formControl]="ctrl"
        aria-label="Document title"
      ></h2>`,
      imports: [MlvTitle, ReactiveFormsModule],
    })
    class ReactiveHostComponent {
      readonly ctrl = new FormControl('', { nonNullable: true });
      readonly title = viewChild.required(MlvTitle);
    }

    await TestBed.configureTestingModule({
      imports: [ReactiveHostComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(ReactiveHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;

    await verifyFormsBinding<string>({
      adapter: {
        mode: 'reactive',
        setValue: async (v) => {
          host.ctrl.setValue(v);
          fixture.detectChanges();
          await fixture.whenStable();
        },
        getValue: () => host.ctrl.value,
        isTouched: () => host.ctrl.touched,
        setDisabled: (d) => {
          if (d) host.ctrl.disable();
          else host.ctrl.enable();
          fixture.detectChanges();
        },
        isDisabled: () => host.title().computedDisabled(),
      },
      sample: 'Document title',
      interact: () => typeInto(fixture, 'typed'),
      expectedAfterInteraction: 'typed',
      blur: () => blurField(fixture),
    });
  });

  it('template-driven: ngModel', async () => {
    @Component({
      template: `<h2
        mlvTitle
        editable
        [(ngModel)]="value"
        aria-label="Document title"
      ></h2>`,
      imports: [MlvTitle, FormsModule],
    })
    class NgModelHostComponent {
      readonly value = signal('');
    }

    await TestBed.configureTestingModule({
      imports: [NgModelHostComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(NgModelHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;
    const ngControl = fixture.debugElement
      .query(By.directive(MlvTitle))
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
      sample: 'Document title',
      interact: () => typeInto(fixture, 'typed'),
      expectedAfterInteraction: 'typed',
      blur: () => blurField(fixture),
    });
  });

  it('signal forms: [formField]', async () => {
    @Component({
      template: `<h2
        mlvTitle
        editable
        [formField]="f.title"
        aria-label="Document title"
      ></h2>`,
      imports: [MlvTitle, FormField],
    })
    class SignalFormsHostComponent {
      readonly disable = signal(false);
      readonly model = signal({ title: '' });
      readonly f = form(this.model, (path) => {
        disabled(path.title, () => this.disable());
      });
      readonly title = viewChild.required(MlvTitle);
    }

    await TestBed.configureTestingModule({
      imports: [SignalFormsHostComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(SignalFormsHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;

    await verifyFormsBinding<string>({
      adapter: {
        mode: 'signal-forms',
        setValue: async (v) => {
          host.model.update((m) => ({ ...m, title: v }));
          fixture.detectChanges();
          await fixture.whenStable();
        },
        getValue: () => host.f.title().value() ?? '',
        isTouched: () => host.f.title().touched(),
        setDisabled: async (d) => {
          host.disable.set(d);
          fixture.detectChanges();
          await fixture.whenStable();
        },
        isDisabled: () => host.title().computedDisabled(),
      },
      sample: 'Document title',
      interact: () => typeInto(fixture, 'typed'),
      expectedAfterInteraction: 'typed',
      blur: () => blurField(fixture),
    });
  });
});
