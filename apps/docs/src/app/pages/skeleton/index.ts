import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="examples"
    header="skeleton"
  />`,
})
export class SkeletonPageComponent {
  examples = new Array(4).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Skeleton',
    description:
      'Skeleton loaders are placeholder elements that mimic the shape of incoming content, reducing perceived wait time during data fetching.',
  };
}
