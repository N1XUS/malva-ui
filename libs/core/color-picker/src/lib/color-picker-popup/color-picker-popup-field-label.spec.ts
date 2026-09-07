import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvFormField, MlvLabel } from '@malva-ui/core/form-utils';
import { MlvColorPickerPopup } from './color-picker-popup';

@Component({
  imports: [MlvFormField, MlvLabel, MlvColorPickerPopup],
  template: `
    <mlv-form-field>
      <mlv-label>Brand colour</mlv-label>
      <mlv-color-picker-popup />
    </mlv-form-field>
  `,
})
class FieldHost {}

@Component({
  imports: [MlvColorPickerPopup],
  template: `<mlv-color-picker-popup />`,
})
class StandaloneHost {}

/**
 * In `field` presentation the popup reports a `'native'` label strategy, so
 * `mlv-form-field` points the projected `<mlv-label>`'s `for` at its text
 * `<input>`. The input's own `aria-label` was suppressed only by the control's
 * `label` **input** — empty exactly when the name comes from the field — so it
 * fell through to the i18n string and outranked the `for` (#197 review, B1).
 */
describe('MlvColorPickerPopup — accessible name inside mlv-form-field (#197 review)', () => {
  async function render<T>(host: new () => T): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [host],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(host);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('lets the projected label name the input instead of the i18n fallback', async () => {
    const host = await render(FieldHost);

    const label = host.querySelector('label') as HTMLLabelElement;
    const input = host.querySelector(
      '.mlv-color-picker-popup__input',
    ) as HTMLInputElement;

    expect(label.getAttribute('for')).toBe(input.id);
    expect(input.hasAttribute('aria-label')).toBe(false);
  });

  it('keeps the i18n fallback name when no field label names it', async () => {
    const host = await render(StandaloneHost);

    const input = host.querySelector(
      '.mlv-color-picker-popup__input',
    ) as HTMLInputElement;

    expect(input.getAttribute('aria-label')).toBeTruthy();
  });
});
