import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page [meta]="meta" [examples]="examples" header="button" />`,
})
export class ButtonPageComponent {
  examples = new Array(10).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Button',
    description: 'Buttons trigger actions or navigation.',
  };
}
