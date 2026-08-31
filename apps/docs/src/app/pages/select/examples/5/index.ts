import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import type { MlvDensity } from '@malva-ui/cdk/density';
import {
  MlvDensityService,
  MlvDensityRootDirective,
} from '@malva-ui/cdk/density';
import { MlvButton } from '@malva-ui/core/button';
import { MlvSelect } from '@malva-ui/core/select';

@Component({
  selector: 'docs-select-density-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvDensityRootDirective, MlvButton, MlvSelect],
  providers: [MlvDensityService],
  templateUrl: './index.html',
})
export default class SelectDensityExampleComponent {
  readonly densityService = inject(MlvDensityService);
  readonly densityLevels: MlvDensity[] = [
    'tight',
    'compact',
    'comfortable',
    'spacious',
    'airy',
  ];
  readonly options = ['Design', 'Engineering', 'Marketing', 'Product', 'Sales'];
}
