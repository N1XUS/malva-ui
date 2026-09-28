import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import type { MlvDensity } from '@malva-ui/cdk/density';
import { MlvButton } from '@malva-ui/core/button';
import { MlvForm } from '@malva-ui/core/form';
import { MlvInput } from '@malva-ui/core/input';

@Component({
  selector: 'docs-input-density-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvButton, MlvForm, MlvInput],
  templateUrl: './index.html',
})
export default class InputDensityExampleComponent {
  readonly density = signal<MlvDensity>('comfortable');
  readonly densityLevels: MlvDensity[] = [
    'tight',
    'compact',
    'comfortable',
    'spacious',
    'airy',
  ];
}
