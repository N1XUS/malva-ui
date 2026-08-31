import { Component, ChangeDetectionStrategy } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MlvTimePicker } from '@malva-ui/core/time-picker';

@Component({
  selector: 'docs-time-picker-basic-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvTimePicker, ReactiveFormsModule],
  templateUrl: './index.html',
})
export default class TimePickerBasicExampleComponent {
  readonly timeCtrl = new FormControl('09:00', { nonNullable: true });
}
