import type { ModelSignal, Signal } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  model,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { form, FormField, required } from '@angular/forms/signals';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';

import { MlvFormField } from './form-field';
import { MlvLabel } from '../label/label';
import { MlvSignalFormControlBase } from '../form-control-base/signal-form-control-base';
import { MLV_FORM_CONTROL } from '../models/form-control-connector';
import type { MlvFormControlLabelStrategy } from '../models/form-field-connector';

/**
 * A stand-in for the text controls (`mlv-input`, `mlv-textarea`, …): the
 * control's own `_describedBy()` lands on its native `<input>`, which is
 * exactly how every real control that renders a description / message wires
 * `aria-describedby`. The real controls are downstream of `core-form-utils`;
 * the composition with the real `mlv-input` is pinned in
 * `libs/core/input/src/lib/input/input-field-error.spec.ts`.
 */
@Component({
  selector: 'test-described-control',
  template: `<input
      [id]="id()"
      [value]="value()"
      [attr.aria-invalid]="resolvedState() === 'error' || null"
      [attr.aria-describedby]="_describedBy()"
      (input)="value.set($any($event.target).value)"
      (blur)="_markTouched()"
    />
    @if (message()) {
      <span [id]="_messageId()">{{ message() }}</span>
    }`,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: MLV_FORM_CONTROL,
      useExisting: forwardRef(() => TestDescribedControl),
    },
  ],
})
class TestDescribedControl extends MlvSignalFormControlBase<string> {
  readonly value: ModelSignal<string> = model('');
  readonly hasValue: Signal<boolean> = computed(() => this.value() !== '');
  protected override _externalLabelStrategy(): MlvFormControlLabelStrategy {
    return 'native';
  }
}

@Component({
  imports: [MlvFormField, MlvLabel, TestDescribedControl, FormField],
  template: `
    <mlv-form-field>
      <mlv-label>Email</mlv-label>
      <test-described-control [formField]="emailForm.email" [message]="own()" />
    </mlv-form-field>
  `,
})
class SignalHost {
  readonly model = signal({ email: '' });
  readonly emailForm = form(this.model, (path) => {
    required(path.email);
  });
  readonly own = signal('');
}

@Component({
  imports: [MlvFormField, MlvLabel, TestDescribedControl, ReactiveFormsModule],
  template: `
    <mlv-form-field>
      <mlv-label>Email</mlv-label>
      <test-described-control [formControl]="ctrl" />
    </mlv-form-field>
  `,
})
class ReactiveHost {
  readonly ctrl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
}

/**
 * #320 (FC-09): the auto error message a field renders was announced once
 * through `role="alert"` on insertion and never associated with the control
 * afterwards — no id on the `<mlv-message>`, nothing in any control's
 * `aria-describedby`. A screen-reader user tabbing back to the field heard
 * "invalid entry" with no reason.
 */
describe('MlvFormField — the auto error message describes the control (#320)', () => {
  async function render<T>(
    host: new () => T,
  ): Promise<{ fixture: ComponentFixture<T>; root: HTMLElement }> {
    await TestBed.configureTestingModule({
      imports: [host],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(host);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function autoMessage(root: HTMLElement): HTMLElement | null {
    // The field's own message is the last `mlv-message` it renders, after the
    // projected-message slot.
    return root.querySelector<HTMLElement>(
      '.mlv-form-field > mlv-message.mlv-message--error',
    );
  }

  function describedBy(root: HTMLElement): string[] {
    const value = root.querySelector('input')?.getAttribute('aria-describedby');
    return value ? value.split(/\s+/) : [];
  }

  async function blur(fixture: ComponentFixture<unknown>): Promise<void> {
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector('input')?.dispatchEvent(new FocusEvent('blur'));
    await settle(fixture);
  }

  it('signal forms: references the rendered message by id while it shows, and drops it once valid', async () => {
    const { fixture, root } = await render(SignalHost);
    expect(describedBy(root)).toEqual([]);

    await blur(fixture);

    const message = autoMessage(root);
    expect(message?.textContent?.trim()).toBe('This field is required');
    const messageId = message?.id ?? '';
    expect(messageId).not.toBe('');
    expect(describedBy(root)).toEqual([messageId]);
    expect(root.querySelector('input')?.getAttribute('aria-invalid')).toBe(
      'true',
    );

    fixture.componentInstance.model.set({ email: 'a@b.c' });
    await settle(fixture);

    expect(autoMessage(root)).toBeNull();
    expect(root.querySelector('input')?.hasAttribute('aria-describedby')).toBe(
      false,
    );
  });

  it("keeps the control's own message first and appends the field error after it", async () => {
    const { fixture, root } = await render(SignalHost);
    fixture.componentInstance.own.set('We never share it');
    await settle(fixture);
    const before = describedBy(root);
    expect(before).toHaveLength(1);

    await blur(fixture);

    const messageId = autoMessage(root)?.id ?? '';
    expect(messageId).not.toBe('');
    expect(describedBy(root)).toEqual([...before, messageId]);

    fixture.componentInstance.model.set({ email: 'a@b.c' });
    await settle(fixture);
    expect(describedBy(root)).toEqual(before);
  });

  it('reactive forms: the NgControl path is associated the same way', async () => {
    const { fixture, root } = await render(ReactiveHost);
    expect(describedBy(root)).toEqual([]);

    fixture.componentInstance.ctrl.markAsTouched();
    await settle(fixture);

    const messageId = autoMessage(root)?.id ?? '';
    expect(messageId).not.toBe('');
    expect(describedBy(root)).toEqual([messageId]);
  });

  it('gives each field its own message id', async () => {
    const { fixture, root } = await render(SignalHost);
    await blur(fixture);
    const first = autoMessage(root)?.id;

    const second = TestBed.createComponent(SignalHost);
    await settle(second);
    await blur(second);
    const other = autoMessage(second.nativeElement as HTMLElement)?.id;

    expect(first).toBeTruthy();
    expect(other).toBeTruthy();
    expect(other).not.toBe(first);
  });

  it('has no axe violations while the error is shown', async () => {
    const { fixture, root } = await render(SignalHost);
    await blur(fixture);
    await expectNoAxeViolations(root);
  });
});
