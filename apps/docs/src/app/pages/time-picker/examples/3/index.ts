import { Component, ChangeDetectionStrategy } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MlvTimePicker } from '@malva-ui/core/time-picker';

@Component({
  selector: 'docs-time-picker-seconds-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvTimePicker, ReactiveFormsModule],
  templateUrl: './index.html',
})
export default class TimePickerSecondsExampleComponent {
  readonly lapCtrl = new FormControl('00:01:23', { nonNullable: true });
  readonly countdownCtrl = new FormControl('00:30:00', { nonNullable: true });
}
