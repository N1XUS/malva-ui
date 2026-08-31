import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="exampleArray"
    header="split-pane"
  />`,
})
export class SplitPanePageComponent {
  exampleArray = new Array(4).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Split Pane',
    description:
      'Resizable split panel layout with horizontal and vertical splits, drag handle, and keyboard resize support.',
  };
}
