import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page [meta]="meta" [examples]="examples" header="page" />`,
})
export class PagePageComponent {
  readonly examples = [1, 2, 3, 4];

  readonly meta: DocPageMeta = {
    title: 'Page',
    description:
      'Composable page surfaces, structured headers, and responsive content with optional contextual asides.',
  };
}
