import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { MlvDensity } from '@malva-ui/cdk/density';
import { MlvButtonGroup, MlvButtonToggle } from '@malva-ui/core/button';

@Component({
  selector: 'docs-button-toggle-density-example',
  imports: [MlvButtonGroup, MlvButtonToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class ButtonToggleDensityExampleComponent {
  readonly densities: MlvDensity[] = [
    'tight',
    'compact',
    'comfortable',
    'spacious',
    'airy',
  ];
}
