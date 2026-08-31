import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MlvTimePicker } from '@malva-ui/core/time-picker';

@Component({
  selector: 'docs-time-picker-disabled-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvTimePicker, ReactiveFormsModule],
  templateUrl: './index.html',
})
export default class TimePickerDisabledExampleComponent {
  /** Attribute-disabled time picker (static). */
  readonly fixedTimeCtrl = new FormControl(
    { value: '14:30', disabled: true },
    { nonNullable: true },
  );

  /** FormControl-disabled time picker (toggleable). */
  readonly appointmentControl = new FormControl<string>(
    { value: '10:00', disabled: true },
    { nonNullable: true },
  );
  readonly isDisabled = signal(true);

  toggleDisabled(): void {
    if (this.isDisabled()) {
      this.appointmentControl.enable();
    } else {
      this.appointmentControl.disable();
    }
    this.isDisabled.set(!this.isDisabled());
  }
}
