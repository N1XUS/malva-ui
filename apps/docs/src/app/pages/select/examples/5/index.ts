import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import type { MlvDensity } from '@malva-ui/cdk/density';
import { MlvButton } from '@malva-ui/core/button';
import { MlvForm } from '@malva-ui/core/form';
import { MlvSelect } from '@malva-ui/core/select';

@Component({
  selector: 'docs-select-density-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvButton, MlvForm, MlvSelect],
  templateUrl: './index.html',
})
export default class SelectDensityExampleComponent {
  readonly density = signal<MlvDensity>('comfortable');
  readonly densityLevels: MlvDensity[] = [
    'tight',
    'compact',
    'comfortable',
    'spacious',
    'airy',
  ];
  readonly options = ['Design', 'Engineering', 'Marketing', 'Product', 'Sales'];
}
