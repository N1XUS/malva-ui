import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page [meta]="meta" [examples]="examples" header="slider" />`,
})
export class SliderPageComponent {
  examples = new Array(8).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Slider',
    description:
      'A range slider supporting single-value and dual-thumb ranges, value tooltips, tick marks, keyboard navigation, and all three Angular forms modes.',
  };
}
