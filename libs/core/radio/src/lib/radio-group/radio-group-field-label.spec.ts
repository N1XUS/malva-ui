import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvFormField, MlvLabel } from '@malva-ui/core/form-utils';
import { MlvRadioGroup } from './radio-group';
import { MlvRadio } from '../radio/radio';

@Component({
  imports: [MlvFormField, MlvLabel, MlvRadioGroup, MlvRadio],
  template: `
    <mlv-form-field>
      <mlv-label>Delivery</mlv-label>
      <mlv-radio-group label="Shipping speed">
        <mlv-radio value="standard">Standard</mlv-radio>
        <mlv-radio value="express">Express</mlv-radio>
      </mlv-radio-group>
    </mlv-form-field>
  `,
})
class BothLabelsHost {}

@Component({
  imports: [MlvFormField, MlvLabel, MlvRadioGroup, MlvRadio],
  template: `
    <mlv-form-field>
      <mlv-label>Delivery</mlv-label>
      <mlv-radio-group>
        <mlv-radio value="standard">Standard</mlv-radio>
      </mlv-radio-group>
    </mlv-form-field>
  `,
})
class FieldLabelOnlyHost {}

/**
 * Same precedence contract as `mlv-time-picker` — see that component's
 * `*-field-label.spec.ts` for why an unconditional `_fieldLabelId()` binding
 * is the defect (#197 review, B5).
 */
describe('MlvRadioGroup — label precedence inside mlv-form-field (#197 review)', () => {
  async function render<T>(
    host: new () => T,
  ): Promise<{ root: HTMLElement; group: HTMLElement }> {
    await TestBed.configureTestingModule({
      imports: [host],
      providers: [provideMlvI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(host);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    return {
      root,
      group: root.querySelector('[role="radiogroup"]') as HTMLElement,
    };
  }

  function namedBy(root: HTMLElement, group: HTMLElement): string | null {
    const id = group.getAttribute('aria-labelledby');
    if (id === null) return group.getAttribute('aria-label');
    return root.querySelector(`[id="${id}"]`)?.textContent?.trim() ?? null;
  }

  it("announces the group's own label, not the field's", async () => {
    const { root, group } = await render(BothLabelsHost);

    expect(namedBy(root, group)).toBe('Shipping speed');
  });

  it("falls back to the field's label when the group has none", async () => {
    const { root, group } = await render(FieldLabelOnlyHost);

    expect(namedBy(root, group)).toBe('Delivery');
  });
});
