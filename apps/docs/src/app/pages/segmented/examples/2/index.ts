import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MlvSegmented, MlvSegmentedItem } from '@malva-ui/core/segmented';

@Component({
  selector: 'docs-segmented-links-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvSegmented, MlvSegmentedItem, RouterLink],
  templateUrl: './index.html',
})
export default class SegmentedLinksExampleComponent {
  /** Match the bare page URL only, so the default view yields once `?view=` is set. */
  readonly exactOptions = { exact: true } as const;
}
