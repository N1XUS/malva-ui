import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import type { MlvDensity } from '@malva-ui/cdk/density';
import {
  MlvDensityService,
  MlvDensityRootDirective,
} from '@malva-ui/cdk/density';
import { MlvButton } from '@malva-ui/core/button';

@Component({
  selector: 'docs-density-global-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvDensityRootDirective, MlvButton],
  providers: [MlvDensityService],
  templateUrl: './index.html',
})
export default class DensityGlobalExampleComponent {
  readonly densityService = inject(MlvDensityService);

  setDensity(density: MlvDensity): void {
    this.densityService.setDensity(density);
  }
}
