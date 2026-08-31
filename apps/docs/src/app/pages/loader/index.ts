import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="examples"
    header="loader"
  />`,
})
export class LoaderPageComponent {
  examples = new Array(9).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Loader',
    description: 'Loaders indicate progress for ongoing operations.',
  };
}
