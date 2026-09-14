import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="examples"
    header="items-more"
  />`,
})
export class ItemsMorePageComponent {
  examples = new Array(4).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Items More',
    description:
      'A single-line row that withholds the items that do not fit and offers them behind a "show more" control. Each item declares how it looks in the row and how it looks collapsed.',
  };
}
