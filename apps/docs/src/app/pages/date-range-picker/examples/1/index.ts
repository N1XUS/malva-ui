import { Component, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MlvDateRangePicker } from '@malva-ui/core/date-range-picker';
import type { MlvDateRangePickerValue } from '@malva-ui/core/date-range-picker';

@Component({
  selector: 'docs-date-range-picker-basic-example',
  imports: [MlvDateRangePicker, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class DateRangePickerBasicExampleComponent {
  /** The selected date range — bound via ngModel. */
  range: MlvDateRangePickerValue | null = null;

  get displayValue(): string {
    const r = this.range;
    if (!r?.start && !r?.end) return 'None selected';
    const fmt = (d: Date | null) =>
      d
        ? d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : '…';
    return `${fmt(r.start)} — ${fmt(r.end)}`;
  }
}
