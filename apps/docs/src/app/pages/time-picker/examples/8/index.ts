import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { MlvTimePicker } from '@malva-ui/core/time-picker';

@Component({
  selector: 'docs-time-picker-signal-forms-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvTimePicker, FormField],
  templateUrl: './index.html',
})
export default class DocsTimePickerSignalFormsExampleComponent {
  readonly model = signal({ time: '14:30' });
  readonly fields = form(this.model);
}
