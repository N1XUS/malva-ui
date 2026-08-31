import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="exampleArray"
    header="combobox"
  />`,
})
export class ComboboxPageComponent {
  exampleArray = new Array(11).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Combobox',
    description:
      'A searchable dropdown component with support for single and multiple selection, custom creation, and complex objects.',
  };
}
