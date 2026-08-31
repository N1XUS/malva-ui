import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="examples"
    header="button-group"
  />`,
})
export class ButtonGroupPageComponent {
  readonly examples = [1, 2, 3];

  readonly meta: DocPageMeta = {
    title: 'Button Group',
    description:
      'Joins related buttons into one visual set and can provide their shared variant.',
  };
}
