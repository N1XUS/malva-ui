import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvProgress } from '@malva-ui/core/progress';
import type { MlvProgressSize } from '@malva-ui/core/progress';

interface CircleEntry {
  size: MlvProgressSize;
  value: number;
  label: string;
}

@Component({
  selector: 'docs-progress-circle-sizes-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvProgress],
  templateUrl: './index.html',
})
export default class ProgressCircleSizesExampleComponent {
  readonly entries: CircleEntry[] = [
    { size: 's', value: 80, label: 'CPU' },
    { size: 'm', value: 55, label: 'Memory' },
    { size: 'l', value: 33, label: 'Disk' },
  ];
}
