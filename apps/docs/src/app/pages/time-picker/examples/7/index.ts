import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import type { MlvDensity } from '@malva-ui/cdk/density';
import { MlvTimePicker } from '@malva-ui/core/time-picker';
import { MlvButton } from '@malva-ui/core/button';

@Component({
  selector: 'docs-time-picker-density-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvTimePicker, ReactiveFormsModule, MlvButton],
  templateUrl: './index.html',
})
export default class TimePickerDensityExampleComponent {
  readonly timeCtrl = new FormControl('14:30', { nonNullable: true });
  readonly timeCtrl12h = new FormControl('09:00', { nonNullable: true });
  readonly density = signal<MlvDensity>('comfortable');

  readonly densities: MlvDensity[] = [
    'tight',
    'compact',
    'comfortable',
    'spacious',
    'airy',
  ];

  setDensity(d: MlvDensity): void {
    this.density.set(d);
  }
}
