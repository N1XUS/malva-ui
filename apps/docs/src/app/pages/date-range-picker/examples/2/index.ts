import { Component, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MlvDateRangePicker } from '@malva-ui/core/date-range-picker';
import type {
  MlvDateRangePickerValue,
  MlvDateRangePickerState,
} from '@malva-ui/core/date-range-picker';

@Component({
  selector: 'docs-date-range-picker-form-field-example',
  imports: [MlvDateRangePicker, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class DateRangePickerFormFieldExampleComponent {
  range: MlvDateRangePickerValue | null = null;

  get validationState(): MlvDateRangePickerState {
    const r = this.range;
    if (!r?.start || !r?.end) return 'default';
    const nights = Math.round(
      (r.end.getTime() - r.start.getTime()) / 86_400_000,
    );
    if (nights < 2) return 'error';
    if (nights > 14) return 'warning';
    return 'success';
  }

  get validationMessage(): string {
    const r = this.range;
    if (!r?.start || !r?.end) return '';
    const nights = Math.round(
      (r.end.getTime() - r.start.getTime()) / 86_400_000,
    );
    if (nights < 2) return 'Minimum stay is 2 nights.';
    if (nights > 14) return 'Stays longer than 14 nights require approval.';
    return `${nights} nights selected — looks great!`;
  }
}
