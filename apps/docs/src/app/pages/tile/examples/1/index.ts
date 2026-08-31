import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { MlvDensity } from '@malva-ui/cdk/density';
import { LucideGauge } from '@lucide/angular';
import { MlvTile, MlvTileHeader } from '@malva-ui/core/tile';

@Component({
  selector: 'docs-tile-density-example',
  imports: [MlvTile, MlvTileHeader, LucideGauge],
  templateUrl: './index.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './index.scss',
})
export default class TileDensityExampleComponent {
  readonly densities: readonly MlvDensity[] = [
    'tight',
    'compact',
    'comfortable',
    'spacious',
    'airy',
  ];
}
