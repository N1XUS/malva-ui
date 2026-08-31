import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="examples"
    header="number-input"
  />`,
})
export class NumberInputPageComponent {
  examples = new Array(6).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Number Input',
    description:
      'A themed numeric stepper with keyboard stepping, long-press acceleration, scroll-wheel support, and signal/reactive/template-driven forms integration.',
  };
}
