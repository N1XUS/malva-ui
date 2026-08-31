import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="exampleArray"
    header="list"
  />`,
})
export class ListPageComponent {
  exampleArray = new Array(11).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'List',
    description: 'A list displays a set of related items in a vertical layout.',
  };
}
