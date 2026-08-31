import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="examples"
    header="accordion"
  />`,
})
export class AccordionPageComponent {
  examples = new Array(3).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Accordion',
    description:
      'Vertically stacked, expandable sections built on the @angular/aria accordion pattern and wrapping mlv-expand for the animation. Supports single- and multi-expand modes, lazy content, rich headers, and full keyboard navigation (Arrow Up/Down, Home, End).',
  };
}
