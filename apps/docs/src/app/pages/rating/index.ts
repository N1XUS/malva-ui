import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page [meta]="meta" [examples]="examples" header="rating" />`,
})
export class RatingPageComponent {
  examples = new Array(6).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Rating',
    description:
      'A signal-forms-native star rating with hover preview, half-star precision, read-only display mode, keyboard navigation, and compatibility with every Angular forms API.',
  };
}
