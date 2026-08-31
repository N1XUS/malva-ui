import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page [meta]="meta" [examples]="examples" header="chip" />`,
})
export class ChipPageComponent {
  examples = new Array(5).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Chip',
    description:
      'Compact interactive labels for tags, filters, or selected items — with color variants, density sizing, prepend/append slots, closable mode, and an optional floating elevation.',
  };
}
