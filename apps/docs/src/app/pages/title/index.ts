import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="exampleArray"
    header="title"
  />`,
})
export class TitlePageComponent {
  exampleArray = new Array(6).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Title',
    description:
      'Inline heading typography component with semantic level inference, projected or model-driven content, and editable form-control support.',
  };
}
