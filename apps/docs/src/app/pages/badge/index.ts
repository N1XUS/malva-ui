import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page [meta]="meta" [examples]="examples" header="badge" />`,
})
export class BadgePageComponent {
  examples = new Array(6).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Badge',
    description:
      'Compact labels for displaying status, counts, and categorical metadata with semantic color variants.',
  };
}
