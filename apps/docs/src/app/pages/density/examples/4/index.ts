import {
  Component,
  ChangeDetectionStrategy,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import type { MlvDensity } from '@malva-ui/cdk/density';
import {
  MlvDensityService,
  MlvCompactComfortableDensity,
  MlvComfortableSpaciousDensity,
  MLV_DENSITY_ELEMENT,
} from '@malva-ui/cdk/density';
import { MlvButton } from '@malva-ui/core/button';

/** Supports only compact + comfortable (no spacious). */
@Component({
  selector: 'docs-cc-badge',
  template: `<ng-content />`,
  styleUrl: './index.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: MLV_DENSITY_ELEMENT, useValue: 'cc-badge' }],
  hostDirectives: [
    {
      directive: MlvCompactComfortableDensity,
      inputs: ['mlvDensity'],
    },
  ],
  host: { class: 'docs-cc-badge' },
})
class CompactComfortableBadgeComponent {}

/** Supports only comfortable + spacious (no compact). */
@Component({
  selector: 'docs-cs-badge',
  template: `<ng-content />`,
  styleUrl: './index.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: MLV_DENSITY_ELEMENT, useValue: 'cs-badge' }],
  hostDirectives: [
    {
      directive: MlvComfortableSpaciousDensity,
      inputs: ['mlvDensity'],
    },
  ],
  host: { class: 'docs-cs-badge' },
})
class ComfortableSpaciousBadgeComponent {}

@Component({
  selector: 'docs-density-restricted-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CompactComfortableBadgeComponent,
    ComfortableSpaciousBadgeComponent,
    MlvButton,
  ],
  providers: [MlvDensityService],
  templateUrl: './index.html',
})
export default class DensityRestrictedExampleComponent {
  readonly densityService = inject(MlvDensityService);

  setDensity(density: MlvDensity): void {
    this.densityService.setDensity(density);
  }
}
