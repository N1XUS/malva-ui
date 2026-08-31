import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import {
  MlvDateRangePicker,
  type MlvDateRangePickerValue,
} from '@malva-ui/core/date-range-picker';

@Component({
  selector: 'docs-date-range-picker-signal-forms-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvDateRangePicker, FormField],
  templateUrl: './index.html',
})
export default class DocsDateRangePickerSignalFormsExampleComponent {
  readonly model = signal<{ range: MlvDateRangePickerValue<Date> | null }>({
    range: null,
  });
  readonly fields = form(this.model);
}
