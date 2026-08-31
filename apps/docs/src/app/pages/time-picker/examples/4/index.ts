import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MlvTimePicker } from '@malva-ui/core/time-picker';

@Component({
  selector: 'docs-time-picker-reactive-forms-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvTimePicker, ReactiveFormsModule],
  templateUrl: './index.html',
})
export default class TimePickerReactiveFormsExampleComponent {
  readonly form = new FormGroup({
    startTime: new FormControl<string>('08:00', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    endTime: new FormControl<string>('17:00', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  get formValue(): string {
    return JSON.stringify(this.form.value, null, 2);
  }

  reset(): void {
    this.form.reset({ startTime: '08:00', endTime: '17:00' });
  }
}
