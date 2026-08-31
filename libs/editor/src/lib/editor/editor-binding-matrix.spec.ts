import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  FormsModule,
  NgControl,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
  FormControl,
} from '@angular/forms';
import { disabled, form, FormField } from '@angular/forms/signals';
import { By } from '@angular/platform-browser';
import { verifyFormsBinding } from '@malva-ui/core/form-utils/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvEditor } from './editor';

describe('MlvEditor — forms bindings matrix', () => {
  async function edit(component: MlvEditor): Promise<void> {
    component.editor()?.commands.setContent('<p>Typed</p>');
    await Promise.resolve();
  }

  async function blur(component: MlvEditor): Promise<void> {
    const content = component.editor()?.view.dom;
    if (!content) return;
    content.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    content.dispatchEvent(
      new FocusEvent('focusout', {
        bubbles: true,
        relatedTarget: document.body,
      }),
    );
    await Promise.resolve();
    await Promise.resolve();
  }

  it('reactive: [formControl]', async () => {
    @Component({
      imports: [MlvEditor, ReactiveFormsModule],
      template: '<mlv-editor [formControl]="control" />',
    })
    class ReactiveHost {
      readonly control = new FormControl<string | null>(null);
      readonly editor = viewChild.required(MlvEditor);
    }

    await TestBed.configureTestingModule({
      imports: [ReactiveHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(ReactiveHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;

    await verifyFormsBinding<string | null>({
      adapter: {
        mode: 'reactive',
        setValue: async (value) => {
          host.control.setValue(value);
          fixture.detectChanges();
          await fixture.whenStable();
          expect(host.editor().editor()?.getHTML()).toContain('External');
        },
        getValue: () => host.control.value,
        isTouched: () => host.control.touched,
        setDisabled: async (value) => {
          if (value) {
            host.control.disable();
          } else {
            host.control.enable();
          }
          fixture.detectChanges();
          await fixture.whenStable();
        },
        isDisabled: () => host.editor().computedDisabled(),
      },
      sample: '<p>External</p>',
      interact: async () => {
        await edit(host.editor());
        fixture.detectChanges();
        await fixture.whenStable();
      },
      expectedAfterInteraction: '<p>Typed</p>',
      blur: async () => {
        await blur(host.editor());
        fixture.detectChanges();
        await fixture.whenStable();
      },
    });

    expect(host.editor().editor()?.isEditable).toBe(true);
    host.editor().editor()?.commands.clearContent();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.control.value).toBeNull();
    host.control.disable();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.editor().computedDisabled()).toBe(true);
    expect(host.editor().editor()?.isEditable).toBe(false);
  });

  it('template-driven: [(ngModel)]', async () => {
    @Component({
      imports: [MlvEditor, FormsModule],
      template: '<mlv-editor [(ngModel)]="value" />',
    })
    class NgModelHost {
      readonly value = signal<string | null>(null);
      readonly editor = viewChild.required(MlvEditor);
    }

    await TestBed.configureTestingModule({
      imports: [NgModelHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(NgModelHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;
    const control = fixture.debugElement
      .query(By.directive(MlvEditor))
      .injector.get(NgControl);

    await verifyFormsBinding<string | null>({
      adapter: {
        mode: 'template-driven',
        setValue: async (value) => {
          host.value.set(value);
          fixture.detectChanges();
          await fixture.whenStable();
          // NgModel writes through its FormControl in a microtask; the next
          // pass forwards that updated control model into FormValueControl.
          fixture.detectChanges();
          await fixture.whenStable();
          expect(host.editor().value()).toBe(value);
          expect(host.editor().editor()?.getHTML()).toContain('External');
        },
        getValue: () => host.value(),
        isTouched: () => control.touched === true,
        setDisabled: async (value) => {
          if (value) {
            control.control?.disable();
          } else {
            control.control?.enable();
          }
          fixture.detectChanges();
          await fixture.whenStable();
        },
        isDisabled: () => host.editor().computedDisabled(),
      },
      sample: '<p>External</p>',
      interact: async () => {
        await edit(host.editor());
        fixture.detectChanges();
        await fixture.whenStable();
      },
      expectedAfterInteraction: '<p>Typed</p>',
      blur: async () => {
        await blur(host.editor());
        fixture.detectChanges();
        await fixture.whenStable();
      },
    });

    host.editor().editor()?.commands.clearContent();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.value()).toBeNull();
    control.control?.disable();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.editor().editor()?.isEditable).toBe(false);
  });

  it('signal forms: [formField]', async () => {
    @Component({
      imports: [MlvEditor, FormField],
      template: '<mlv-editor [formField]="field.body" />',
    })
    class SignalFormsHost {
      readonly disable = signal(false);
      readonly model = signal<{ body: string | null }>({ body: null });
      readonly field = form(this.model, (path) => {
        disabled(path.body, () => this.disable());
      });
      readonly editor = viewChild.required(MlvEditor);
    }

    await TestBed.configureTestingModule({
      imports: [SignalFormsHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(SignalFormsHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;

    await verifyFormsBinding<string | null>({
      adapter: {
        mode: 'signal-forms',
        setValue: async (value) => {
          host.model.set({ body: value });
          fixture.detectChanges();
          await fixture.whenStable();
          expect(host.editor().editor()?.getHTML()).toContain('External');
        },
        getValue: () => host.field.body().value(),
        isTouched: () => host.field.body().touched(),
        setDisabled: async (value) => {
          host.disable.set(value);
          fixture.detectChanges();
          await fixture.whenStable();
        },
        isDisabled: () => host.editor().computedDisabled(),
      },
      sample: '<p>External</p>',
      interact: async () => {
        await edit(host.editor());
        fixture.detectChanges();
        await fixture.whenStable();
      },
      expectedAfterInteraction: '<p>Typed</p>',
      blur: async () => {
        await blur(host.editor());
        fixture.detectChanges();
        await fixture.whenStable();
      },
    });

    host.editor().editor()?.commands.clearContent();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.field.body().value()).toBeNull();
    host.disable.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.editor().editor()?.isEditable).toBe(false);
  });

  it('supports direct [(value)] binding and does not provide NG_VALUE_ACCESSOR', async () => {
    @Component({
      imports: [MlvEditor],
      template:
        '<mlv-editor [(value)]="value" [disabled]="disable()" (touch)="touched.set(true)" />',
    })
    class DirectHost {
      readonly value = signal<string | null>(null);
      readonly disable = signal(false);
      readonly touched = signal(false);
      readonly editor = viewChild.required(MlvEditor);
    }

    await TestBed.configureTestingModule({
      imports: [DirectHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(DirectHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;

    host.value.set('<p>External</p>');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.editor().editor()?.getHTML()).toContain('External');

    await edit(host.editor());
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.value()).toBe('<p>Typed</p>');

    await blur(host.editor());
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.editor().focused()).toBe(false);
    expect(host.touched()).toBe(true);

    host.editor().editor()?.commands.clearContent();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.value()).toBeNull();

    host.disable.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.editor().computedDisabled()).toBe(true);
    expect(host.editor().editor()?.isEditable).toBe(false);

    expect(
      fixture.debugElement
        .query(By.directive(MlvEditor))
        .injector.get(NG_VALUE_ACCESSOR, null),
    ).toBeNull();
  });
});
