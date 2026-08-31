import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="exampleArray"
    header="form"
  />`,
})
export class FormPageComponent {
  exampleArray = new Array(5).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Form',
    description:
      'Layout shell for native forms: density-scaled stack, fieldset grids, header and action rows, and one density source for every control inside.',
  };
}
