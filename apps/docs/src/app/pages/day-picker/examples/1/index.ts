import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvDayPicker } from '@malva-ui/core/day-picker';

@Component({
  selector: 'docs-day-picker-basic-example',
  imports: [MlvDayPicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class DayPickerBasicExampleComponent {}
