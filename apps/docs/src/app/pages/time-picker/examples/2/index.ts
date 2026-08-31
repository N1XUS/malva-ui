import { Component, ChangeDetectionStrategy } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MlvTimePicker } from '@malva-ui/core/time-picker';

@Component({
  selector: 'docs-time-picker-12h-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvTimePicker, ReactiveFormsModule],
  templateUrl: './index.html',
})
export default class TimePicker12hExampleComponent {
  readonly startCtrl = new FormControl('09:00', { nonNullable: true });
  readonly endCtrl = new FormControl('17:30', { nonNullable: true });
}
