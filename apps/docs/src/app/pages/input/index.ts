import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="exampleArray"
    header="input"
  />`,
})
export class InputPageComponent {
  exampleArray = new Array(7).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Input',
    description:
      'Text input field with support for prefixes, suffixes, validation states, and disabled mode.',
  };
}
