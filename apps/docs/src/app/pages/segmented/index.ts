import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="examples"
    header="segmented"
  />`,
})
export class SegmentedPageComponent {
  readonly examples = [1, 2, 3, 4, 5];

  readonly meta: DocPageMeta = {
    title: 'Segmented',
    description:
      'Segmented control for switching between views or states — buttons or router links in one grey track with a sliding pill; doubles as a radio-style form control.',
  };
}
