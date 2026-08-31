import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvSegmented, MlvSegmentedItem } from '@malva-ui/core/segmented';
import type { MlvSegmentedTone } from '@malva-ui/core/segmented';

@Component({
  selector: 'docs-segmented-tones-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvSegmented, MlvSegmentedItem],
  templateUrl: './index.html',
})
export default class SegmentedTonesExampleComponent {
  readonly tones: MlvSegmentedTone[] = [
    'neutral',
    'accent',
    'info',
    'success',
    'warning',
    'danger',
  ];
  readonly value = signal('two');
}
