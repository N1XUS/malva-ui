import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import type { MlvDensity } from '@malva-ui/cdk/density';
import {
  MlvDensityService,
  MlvDensityRootDirective,
} from '@malva-ui/cdk/density';
import { MlvButton } from '@malva-ui/core/button';
import { MlvInput } from '@malva-ui/core/input';

@Component({
  selector: 'docs-input-density-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvDensityRootDirective, MlvButton, MlvInput],
  providers: [MlvDensityService],
  templateUrl: './index.html',
})
export default class InputDensityExampleComponent {
  readonly densityService = inject(MlvDensityService);
  readonly densityLevels: MlvDensity[] = [
    'tight',
    'compact',
    'comfortable',
    'spacious',
    'airy',
  ];
}
