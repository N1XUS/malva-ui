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

@Component({
  selector: 'docs-density-card',
  template: `
    <div class="docs-density-card__header">
      <ng-content select="[slot=title]" />
    </div>
    <div class="docs-density-card__body">
      <ng-content />
    </div>
  `,
  styleUrl: './index.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: MLV_DENSITY_ELEMENT, useValue: 'density-card' }],
  hostDirectives: [{ directive: MlvDensityDirective, inputs: ['mlvDensity'] }],
  host: { class: 'docs-density-card' },
})
class DensityCardComponent {}

@Component({
  selector: 'docs-density-override-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DensityCardComponent, MlvButton],
  providers: [MlvDensityService],
  templateUrl: './index.html',
})
export default class DensityOverrideExampleComponent {
  readonly densityService = inject(MlvDensityService);

  setDensity(density: MlvDensity): void {
    this.densityService.setDensity(density);
  }
}
