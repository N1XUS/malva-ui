import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { MlvDayPicker } from '@malva-ui/core/day-picker';

@Component({
  selector: 'docs-day-picker-signal-forms-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvDayPicker, FormField],
  templateUrl: './index.html',
})
export default class DocsDayPickerSignalFormsExampleComponent {
  readonly model = signal<{ date: Date | null }>({
    date: new Date(2026, 6, 22),
  });
  readonly fields = form(this.model);
}
