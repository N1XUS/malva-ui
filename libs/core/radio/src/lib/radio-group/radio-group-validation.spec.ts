import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { form, FormField, required } from '@angular/forms/signals';
import type { MlvFormState } from '@malva-ui/core/form-utils';
import { MlvFormField } from '@malva-ui/core/form-utils';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvRadio } from '../radio/radio';
import { MlvRadioGroup } from './radio-group';

@Component({
  imports: [MlvRadioGroup, MlvRadio, FormField],
  template: `
    <mlv-radio-group
      label="Plan"
      [formField]="planForm.plan"
      [state]="state()"
      [message]="message()"
    >
      <mlv-radio value="basic">Basic</mlv-radio>
      <mlv-radio value="pro">Pro</mlv-radio>
    </mlv-radio-group>
  `,
})
class SignalHost {
  readonly model = signal<{ plan: string | null }>({ plan: null });
  readonly planForm = form(this.model, (path) => {
    required(path.plan);
  });
  readonly state = signal<MlvFormState>('default');
  readonly message = signal('');
}

@Component({
  imports: [MlvRadioGroup, MlvRadio, MlvFormField, FormField],
  template: `
    <mlv-form-field>
      <mlv-radio-group label="Plan" [formField]="planForm.plan">
        <mlv-radio value="basic">Basic</mlv-radio>
        <mlv-radio value="pro">Pro</mlv-radio>
      </mlv-radio-group>
    </mlv-form-field>
  `,
})
class FieldHost {
  readonly model = signal<{ plan: string | null }>({ plan: null });
  readonly planForm = form(this.model, (path) => {
    required(path.plan);
  });
}

/**
 * #320 (FC-08): the radio group already rendered its state accent and its
 * message, but the `role="radiogroup"` host never said it was invalid.
 */
describe('MlvRadioGroup — validation surface (#320)', () => {
  async function render<T>(host: new () => T): Promise<ComponentFixture<T>> {
    await TestBed.configureTestingModule({
      imports: [host],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(host);
    await settle(fixture);
    return fixture;
  }

  async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function group(fixture: ComponentFixture<unknown>): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector(
      'mlv-radio-group',
    ) as HTMLElement;
  }

  it('sets aria-invalid on the radiogroup once a required field is touched', async () => {
    const fixture = await render(SignalHost);
    expect(group(fixture).hasAttribute('aria-invalid')).toBe(false);

    fixture.componentInstance.planForm.plan().markAsTouched();
    await settle(fixture);

    expect(group(fixture).getAttribute('aria-invalid')).toBe('true');
    expect(group(fixture).classList).toContain('mlv-radio-group--state-error');

    fixture.componentInstance.model.set({ plan: 'pro' });
    await settle(fixture);
    expect(group(fixture).hasAttribute('aria-invalid')).toBe(false);
  });

  it('honours an explicit state="error" and claims no invalidity for the other states', async () => {
    const fixture = await render(SignalHost);

    fixture.componentInstance.state.set('error');
    await settle(fixture);
    expect(group(fixture).getAttribute('aria-invalid')).toBe('true');

    for (const state of ['success', 'warning', 'info'] as const) {
      fixture.componentInstance.state.set(state);
      await settle(fixture);
      expect(group(fixture).hasAttribute('aria-invalid')).toBe(false);
    }
  });

  it('is described by the error message of the field it sits in', async () => {
    const fixture = await render(FieldHost);
    fixture.componentInstance.planForm.plan().markAsTouched();
    await settle(fixture);

    const fieldMessage = (fixture.nativeElement as HTMLElement).querySelector(
      '.mlv-form-field > mlv-message',
    ) as HTMLElement;
    expect(fieldMessage.id).not.toBe('');
    expect(group(fixture).getAttribute('aria-describedby')).toBe(
      fieldMessage.id,
    );
  });

  it('has no axe violations in the error state with a message', async () => {
    const fixture = await render(SignalHost);
    fixture.componentInstance.message.set('Pick a plan');
    fixture.componentInstance.planForm.plan().markAsTouched();
    await settle(fixture);
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });
});
