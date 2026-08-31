import {
  Component,
  ChangeDetectionStrategy,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import type { MlvDensity } from '@malva-ui/cdk/density';
import {
  MlvDensityService,
  MlvDensityDirective,
  MLV_DENSITY_ELEMENT,
} from '@malva-ui/cdk/density';
import { MlvButton } from '@malva-ui/core/button';

/**
 * Example component that integrates MlvDensityDirective as a hostDirective.
 * Provides MLV_DENSITY_ELEMENT so the directive can generate BEM class names.
 */
@Component({
  selector: 'docs-status-chip',
  template: `<span class="docs-status-chip__label"><ng-content /></span>`,
  styleUrl: './index.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: MLV_DENSITY_ELEMENT, useValue: 'status-chip' }],
  hostDirectives: [{ directive: MlvDensityDirective, inputs: ['mlvDensity'] }],
  host: { class: 'docs-status-chip' },
})
class StatusChipComponent {}

@Component({
  selector: 'docs-density-host-directive-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatusChipComponent, MlvButton],
  providers: [MlvDensityService],
  templateUrl: './index.html',
})
export default class DensityHostDirectiveExampleComponent {
  readonly densityService = inject(MlvDensityService);

  setDensity(density: MlvDensity): void {
    this.densityService.setDensity(density);
  }
}
