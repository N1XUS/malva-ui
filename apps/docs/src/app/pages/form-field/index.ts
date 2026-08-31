import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="exampleArray"
    header="form-field"
  />`,
})
export class FormFieldPageComponent {
  exampleArray = new Array(5).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Form Field',
    description:
      'Wrapper component for form controls that provides labels, hints, validation messages, and display strategies.',
  };
}
