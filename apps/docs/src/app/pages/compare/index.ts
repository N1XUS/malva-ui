import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="examples"
    header="compare"
  />`,
})
export class ComparePageComponent {
  examples = new Array(7).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Compare',
    description:
      'Before/after comparison surface. Two projected layers split by a draggable divider — images, charts, or any content — with click-to-jump, hover steering, vertical orientation, keyboard control over a hidden native range input, and a themable handle.',
  };
}
