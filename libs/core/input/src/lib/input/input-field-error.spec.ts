import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { form, FormField, required } from '@angular/forms/signals';
import { MlvFormField, MlvLabel } from '@malva-ui/core/form-utils';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvInput } from './input';

@Component({
  imports: [MlvInput, MlvFormField, MlvLabel, FormField],
  template: `
    <mlv-form-field>
      <mlv-label>Email</mlv-label>
      <mlv-input [formField]="signupForm.email" [description]="hint()" />
    </mlv-form-field>
  `,
})
class FieldHost {
  readonly model = signal({ email: '' });
  readonly signupForm = form(this.model, (path) => {
    required(path.email);
  });
  readonly hint = signal('');
}

/**
 * #320 (FC-09), with the real control: `mlv-form-field` > `mlv-input
 * [formField]` required and blurred used to read `aria-invalid="true"` and
 * `aria-describedby` absent — "Email, edit text, invalid entry" with no
 * reason once the one-time `role="alert"` announcement was gone.
 */
describe('MlvInput in a field — the auto error message describes the input (#320)', () => {
  async function render(): Promise<ComponentFixture<FieldHost>> {
    await TestBed.configureTestingModule({
      imports: [FieldHost],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(FieldHost);
    await settle(fixture);
    return fixture;
  }

  async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function native(fixture: ComponentFixture<unknown>): HTMLInputElement {
    return (fixture.nativeElement as HTMLElement).querySelector(
      '.mlv-input__native',
    ) as HTMLInputElement;
  }

  function fieldMessage(
    fixture: ComponentFixture<unknown>,
  ): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(
      '.mlv-form-field > mlv-message',
    );
  }

  async function blur(fixture: ComponentFixture<unknown>): Promise<void> {
    native(fixture).dispatchEvent(new FocusEvent('blur'));
    await settle(fixture);
  }

  it('references the rendered message by id, and returns to the pre-error value once valid', async () => {
    const fixture = await render();
    const before = native(fixture).getAttribute('aria-describedby');
    expect(before).toBeNull();

    await blur(fixture);

    const message = fieldMessage(fixture);
    expect(message?.textContent?.trim()).toBe('This field is required');
    expect(message?.id).toBeTruthy();
    expect(native(fixture).getAttribute('aria-invalid')).toBe('true');
    expect(native(fixture).getAttribute('aria-describedby')).toBe(message?.id);

    fixture.componentInstance.model.set({ email: 'a@b.c' });
    await settle(fixture);

    expect(fieldMessage(fixture)).toBeNull();
    expect(native(fixture).getAttribute('aria-describedby')).toBe(before);
  });

  it("appends the field error after the input's own description", async () => {
    const fixture = await render();
    fixture.componentInstance.hint.set('We send receipts here');
    await settle(fixture);
    const before = native(fixture).getAttribute('aria-describedby') ?? '';
    expect(before).not.toBe('');

    await blur(fixture);

    expect(native(fixture).getAttribute('aria-describedby')).toBe(
      `${before} ${fieldMessage(fixture)?.id}`,
    );
  });

  it('has no axe violations while the error is shown', async () => {
    const fixture = await render();
    await blur(fixture);
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });
});
