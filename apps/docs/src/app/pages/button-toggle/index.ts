import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="examples"
    header="button-toggle"
  />`,
})
export class ButtonTogglePageComponent {
  readonly examples = [1, 2, 3];

  readonly meta: DocPageMeta = {
    title: 'Toggle Button',
    description:
      'Represents an option that can be independently pressed and released.',
  };
}
