import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvProgress } from '@malva-ui/core/progress';
import type { MlvProgressSize } from '@malva-ui/core/progress';

@Component({
  selector: 'docs-progress-bar-sizes-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvProgress],
  templateUrl: './index.html',
})
export default class ProgressBarSizesExampleComponent {
  readonly sizes: MlvProgressSize[] = ['s', 'm', 'l'];
}
