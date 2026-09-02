import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="examples"
    header="speed-dial"
  />`,
})
export class SpeedDialPageComponent {
  examples = new Array(5).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Speed Dial',
    description:
      'Floating action button that unfolds into related actions — in a line or on a circle, semi-circle or quarter-circle arc — with a staggered entrance, an optional page mask, click or hover opening and full menu-button keyboard support.',
  };
}
