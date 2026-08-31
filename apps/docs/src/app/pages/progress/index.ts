import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="examples"
    header="progress"
  />`,
})
export class ProgressPageComponent {
  examples = new Array(7).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Progress',
    description:
      'Progress indicators communicate the completion status of an operation to the user. Use the bar variant for linear tasks and the circle variant for compact or standalone indicators.',
  };
}
