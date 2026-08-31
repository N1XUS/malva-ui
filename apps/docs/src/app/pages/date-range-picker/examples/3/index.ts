import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MlvDateRangePicker } from '@malva-ui/core/date-range-picker';

@Component({
  selector: 'docs-date-range-picker-constraints-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvDateRangePicker],
  templateUrl: './index.html',
})
export default class DateRangePickerConstraintsExampleComponent {
  /** Earliest selectable date — today. */
  readonly minDate = new Date();

  /** Latest selectable date — 60 days from today. */
  readonly maxDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
}
