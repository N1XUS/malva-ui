import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="examples"
    header="data-table"
  />`,
})
export class DataTablePageComponent {
  examples = new Array(23).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Data Table',
    description:
      'A feature-rich data table with global search, toolbar or per-column filtering, external filter composition, sorting, pinned and resizable columns, tree rows, editing, selection, virtual scrolling, and integrated pagination.',
  };
}
