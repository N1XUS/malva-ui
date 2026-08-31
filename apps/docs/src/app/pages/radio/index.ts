import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="exampleArray"
    header="radio"
  />`,
})
export class RadioPageComponent {
  exampleArray = new Array(4).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Radio',
    description:
      'Radio buttons allow users to select a single option from a set.',
  };
}
