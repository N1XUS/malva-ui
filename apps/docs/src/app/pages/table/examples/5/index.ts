import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import type { MlvDensity } from '@malva-ui/cdk/density';
import { MlvButton } from '@malva-ui/core/button';
import { MlvTable, MlvTableCell } from '@malva-ui/core/table';

@Component({
  selector: 'docs-table-density-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvButton, MlvTable, MlvTableCell],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class TableDensityExampleComponent {
  readonly activeDensity = signal<MlvDensity>('comfortable');
  readonly densities: readonly MlvDensity[] = [
    'tight',
    'compact',
    'comfortable',
    'spacious',
    'airy',
  ];

  setDensity(density: MlvDensity): void {
    this.activeDensity.set(density);
  }
}
