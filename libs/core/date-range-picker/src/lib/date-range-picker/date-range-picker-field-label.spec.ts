import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvFormField, MlvLabel } from '@malva-ui/core/form-utils';
import { MlvDateRangePicker } from './date-range-picker';

@Component({
  imports: [MlvFormField, MlvLabel, MlvDateRangePicker],
  template: `
    <mlv-form-field>
      <mlv-label>Period</mlv-label>
      <mlv-date-range-picker label="Travel dates" />
    </mlv-form-field>
  `,
})
class BothLabelsHost {}

@Component({
  imports: [MlvFormField, MlvLabel, MlvDateRangePicker],
  template: `
    <mlv-form-field>
      <mlv-label>Period</mlv-label>
      <mlv-date-range-picker />
    </mlv-form-field>
  `,
})
class FieldLabelOnlyHost {}

/**
 * Same precedence contract as `mlv-time-picker` — see that component's
 * `*-field-label.spec.ts` for why an unconditional `_fieldLabelId()` binding
 * is the defect (#197 review, B5).
 */
describe('MlvDateRangePicker — label precedence inside mlv-form-field (#197 review)', () => {
  async function render<T>(
    host: new () => T,
  ): Promise<{ root: HTMLElement; trigger: HTMLElement }> {
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
      trigger: root.querySelector(
        '.mlv-date-range-picker__trigger',
      ) as HTMLElement,
    };
  }

  function namedBy(root: HTMLElement, trigger: HTMLElement): string | null {
    const id = trigger.getAttribute('aria-labelledby');
    if (id === null) return trigger.getAttribute('aria-label');
    return root.querySelector(`[id="${id}"]`)?.textContent?.trim() ?? null;
  }

  it("announces the control's own label, not the field's", async () => {
    const { root, trigger } = await render(BothLabelsHost);

    expect(namedBy(root, trigger)).toBe('Travel dates');
  });

  it("falls back to the field's label when the control has none", async () => {
    const { root, trigger } = await render(FieldLabelOnlyHost);

    expect(namedBy(root, trigger)).toBe('Period');
  });
});
