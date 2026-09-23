import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { form, FormField, min } from '@angular/forms/signals';
import type { MlvFormState } from '@malva-ui/core/form-utils';
import { MlvFormField } from '@malva-ui/core/form-utils';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';
import { MlvRating } from './rating';

@Component({
  imports: [MlvRating, FormField],
  template: `<mlv-rating [formField]="reviewForm.score" [state]="state()" />`,
})
class SignalHost {
  readonly model = signal({ score: 0 });
  readonly reviewForm = form(this.model, (path) => {
    min(path.score, 1);
  });
  readonly state = signal<MlvFormState>('default');
}

@Component({
  imports: [MlvRating, MlvFormField, FormField],
  template: `
    <mlv-form-field>
      <mlv-rating [formField]="reviewForm.score" />
    </mlv-form-field>
  `,
})
class FieldHost {
  readonly model = signal({ score: 0 });
  readonly reviewForm = form(this.model, (path) => {
    min(path.score, 1);
  });
}

/**
 * #320 (FC-08): the rating already tinted its empty stars for an error, but
 * its `role="group"` host never said it was invalid, and inside a
 * `mlv-form-field` nothing pointed at the field's error message.
 */
describe('MlvRating — validation surface (#320)', () => {
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

  function rating(fixture: ComponentFixture<unknown>): HTMLElement {
    return (fixture.nativeElement as HTMLElement).querySelector(
      'mlv-rating',
    ) as HTMLElement;
  }

  it('sets aria-invalid on the group once an invalid field is touched', async () => {
    const fixture = await render(SignalHost);
    expect(rating(fixture).hasAttribute('aria-invalid')).toBe(false);

    fixture.componentInstance.reviewForm.score().markAsTouched();
    await settle(fixture);

    expect(rating(fixture).getAttribute('aria-invalid')).toBe('true');
    expect(rating(fixture).classList).toContain('mlv-rating--state-error');

    fixture.componentInstance.model.set({ score: 4 });
    await settle(fixture);
    expect(rating(fixture).hasAttribute('aria-invalid')).toBe(false);
  });

  it('honours an explicit state="error" and claims no invalidity for the other states', async () => {
    const fixture = await render(SignalHost);

    fixture.componentInstance.state.set('error');
    await settle(fixture);
    expect(rating(fixture).getAttribute('aria-invalid')).toBe('true');

    for (const state of ['success', 'warning', 'info'] as const) {
      fixture.componentInstance.state.set(state);
      await settle(fixture);
      expect(rating(fixture).hasAttribute('aria-invalid')).toBe(false);
    }
  });

  it('is described by the error message of the field it sits in, and only while it shows', async () => {
    const fixture = await render(FieldHost);
    expect(rating(fixture).hasAttribute('aria-describedby')).toBe(false);

    fixture.componentInstance.reviewForm.score().markAsTouched();
    await settle(fixture);

    const fieldMessage = (fixture.nativeElement as HTMLElement).querySelector(
      '.mlv-form-field > mlv-message',
    ) as HTMLElement;
    expect(fieldMessage.id).not.toBe('');
    expect(rating(fixture).getAttribute('aria-describedby')).toBe(
      fieldMessage.id,
    );

    fixture.componentInstance.model.set({ score: 3 });
    await settle(fixture);
    expect(rating(fixture).hasAttribute('aria-describedby')).toBe(false);
  });

  it('has no axe violations in the error state inside a field', async () => {
    const fixture = await render(FieldHost);
    fixture.componentInstance.reviewForm.score().markAsTouched();
    await settle(fixture);
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });
});
