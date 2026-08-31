import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvSegmented, MlvSegmentedItem } from '@malva-ui/core/segmented';

@Component({
  selector: 'docs-segmented-layout-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvSegmented, MlvSegmentedItem],
  templateUrl: './index.html',
})
export default class SegmentedLayoutExampleComponent {
  readonly value = signal('list');
}
