import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page [meta]="meta" [examples]="examples" header="filter" />`,
})
export class FilterPageComponent {
  readonly examples = [1, 2, 3, 4];

  readonly meta: DocPageMeta = {
    title: 'Filter',
    description:
      'Compact option filters, multi-condition editors, and a metadata-driven Smart Filter Bar for composing explicit or live queries.',
  };
}
