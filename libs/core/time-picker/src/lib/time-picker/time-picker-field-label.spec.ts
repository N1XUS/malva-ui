import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideMlvI18nTesting } from '@malva-ui/i18n/testing';
import { MlvFormField, MlvLabel } from '@malva-ui/core/form-utils';
import { MlvTimePicker } from './time-picker';

@Component({
  imports: [MlvFormField, MlvLabel, MlvTimePicker],
  template: `
    <mlv-form-field>
      <mlv-label>Start</mlv-label>
      <mlv-time-picker label="Meeting time" />
    </mlv-form-field>
  `,
})
class BothLabelsHost {}

@Component({
  imports: [MlvFormField, MlvLabel, MlvTimePicker],
  template: `
    <mlv-form-field>
      <mlv-label>Start</mlv-label>
      <mlv-time-picker />
    </mlv-form-field>
  `,
})
class FieldLabelOnlyHost {}

@Component({
  imports: [MlvTimePicker],
  template: `<mlv-time-picker label="Meeting time" />`,
})
class OwnLabelOnlyHost {}

/**
 * The `'aria'` half of #197 prescribes
 * `[attr.aria-labelledby]="label() ? labelId() : _fieldLabelId()"`: a name the
 * consumer wrote on the control itself is the nearer, more specific one and
 * must win over the field's. `mlv-time-picker` bound `_fieldLabelId()`
 * unconditionally, so the identical composition announced "Start" here and
 * "Meeting time" on `mlv-day-picker` (#197 review, B5).
 */
describe('MlvTimePicker — label precedence inside mlv-form-field (#197 review)', () => {
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
      trigger: root.querySelector('.mlv-time-picker__trigger') as HTMLElement,
    };
  }

  function namedBy(root: HTMLElement, trigger: HTMLElement): string | null {
    const id = trigger.getAttribute('aria-labelledby');
    if (id === null) return trigger.getAttribute('aria-label');
    return root.querySelector(`[id="${id}"]`)?.textContent?.trim() ?? null;
  }

  it("announces the control's own label, not the field's", async () => {
    const { root, trigger } = await render(BothLabelsHost);

    expect(namedBy(root, trigger)).toBe('Meeting time');
  });

  it("falls back to the field's label when the control has none", async () => {
    const { root, trigger } = await render(FieldLabelOnlyHost);

    expect(namedBy(root, trigger)).toBe('Start');
  });

  it('names the trigger from its own label outside any field', async () => {
    const { root, trigger } = await render(OwnLabelOnlyHost);

    // Standalone, `<mlv-label [for]>` cannot name a `div[role="combobox"]`, so
    // without an `aria-labelledby` the trigger announced the generic i18n
    // string while showing "Meeting time" — a WCAG 2.5.3 mismatch.
    expect(namedBy(root, trigger)).toBe('Meeting time');
  });
});
