import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page [meta]="meta" [examples]="examples" header="table" />`,
})
export class TablePageComponent {
  examples = new Array(5).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Table',
    description:
      'A semantic native table primitive with bordered and hoverable appearances, responsive overflow, Pop In mobile rows, and density-aware spacing.',
  };
}
