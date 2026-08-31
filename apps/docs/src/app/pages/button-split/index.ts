import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="examples"
    header="button-split"
  />`,
})
export class ButtonSplitPageComponent {
  readonly examples = [1, 2];

  readonly meta: DocPageMeta = {
    title: 'Split Button',
    description:
      'Pairs a primary action with a compact trigger for related choices.',
  };
}
