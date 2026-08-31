import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { MlvDensity } from '@malva-ui/cdk/density';
import { MlvButton, MlvButtonGroup } from '@malva-ui/core/button';

@Component({
  selector: 'docs-button-group-density-example',
  imports: [MlvButton, MlvButtonGroup],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class ButtonGroupDensityExampleComponent {
  readonly densities: MlvDensity[] = [
    'tight',
    'compact',
    'comfortable',
    'spacious',
    'airy',
  ];
}
