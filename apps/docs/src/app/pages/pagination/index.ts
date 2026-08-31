import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page [meta]="meta" [examples]="examples" header="pagination" />`,
})
export class PaginationPageComponent {
  examples = new Array(4).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Pagination',
    description:
      'Pagination divides content into discrete pages. It shows the current slice of data, lets users jump between pages, and configure how many items appear per page.',
  };
}
