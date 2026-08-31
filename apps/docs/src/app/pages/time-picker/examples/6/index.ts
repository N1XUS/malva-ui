import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MlvTimePicker } from '@malva-ui/core/time-picker';
import type { MlvTimePickerState } from '@malva-ui/core/time-picker';

interface StateConfig {
  state: MlvTimePickerState;
  label: string;
  message: string;
  value: string;
}

@Component({
  selector: 'docs-time-picker-states-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvTimePicker, ReactiveFormsModule],
  templateUrl: './index.html',
})
export default class TimePickerStatesExampleComponent {
  readonly configs: StateConfig[] = [
    {
      state: 'default',
      label: 'Check-in time',
      message: '',
      value: '14:00',
    },
    {
      state: 'success',
      label: 'Confirmed slot',
      message: 'Time slot is available',
      value: '10:30',
    },
    {
      state: 'warning',
      label: 'Peak hours',
      message: 'This time has high demand',
      value: '08:00',
    },
    {
      state: 'error',
      label: 'Invalid window',
      message: 'Outside operating hours (09:00–18:00)',
      value: '23:45',
    },
    {
      state: 'info',
      label: 'Suggested time',
      message: 'Based on your preferences',
      value: '11:15',
    },
  ];

  readonly timeCtrl = new FormControl(this.configs[0].value, {
    nonNullable: true,
  });
  readonly selectedConfig = signal<StateConfig>(this.configs[0]);

  select(config: StateConfig): void {
    this.selectedConfig.set(config);
    this.timeCtrl.setValue(config.value);
  }
}
