import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="exampleArray"
    header="empty-state"
  />`,
})
export class EmptyStatePageComponent {
  exampleArray = new Array(3).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Empty State',
    description:
      'Structured placeholder for empty lists, search results, or uninitialized content.',
  };
}
