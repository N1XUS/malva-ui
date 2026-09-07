import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvFormField, MlvLabel } from '@malva-ui/core/form-utils';
import { MlvTokenizer } from './tokenizer';

@Component({
  imports: [MlvFormField, MlvLabel, MlvTokenizer],
  template: `
    <mlv-form-field>
      <mlv-label>Skills</mlv-label>
      <mlv-tokenizer />
    </mlv-form-field>
  `,
})
class FieldHost {}

@Component({
  imports: [MlvTokenizer],
  template: `<mlv-tokenizer />`,
})
class StandaloneHost {}

/**
 * `mlv-tokenizer` reports a `'native'` label strategy, so `mlv-form-field`
 * points the projected `<mlv-label>`'s `for` at its inner `<input>`. That
 * alone does not give the control the label's name: the same input carries an
 * `aria-label` that falls back to the tokenizer's own i18n string, and
 * `aria-label` outranks `<label for>` in the accessible-name computation — so
 * the label would deliver click-to-focus and nothing else (#197 review, B1).
 */
describe('MlvTokenizer — accessible name inside mlv-form-field (#197 review)', () => {
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
    const input = host.querySelector('.mlv-input__native') as HTMLInputElement;

    expect(label.getAttribute('for')).toBe(input.id);
    // The assertion that matters: with any `aria-label` present the name is
    // that string, not "Skills", and the `for` above buys focus only.
    expect(input.hasAttribute('aria-label')).toBe(false);
  });

  it('keeps the i18n fallback name when no field label names it', async () => {
    const host = await render(StandaloneHost);

    const input = host.querySelector('.mlv-input__native') as HTMLInputElement;

    // Standalone the tokenizer must still name itself — suppressing the
    // fallback unconditionally would trade one unnamed control for another.
    expect(input.getAttribute('aria-label')).toBeTruthy();
  });
});
