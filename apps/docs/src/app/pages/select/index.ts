import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="exampleArray"
    header="select"
  />`,
})
export class SelectPageComponent {
  exampleArray = new Array(11).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Select',
    description:
      'A dropdown select component supporting single and multiple selection, custom templates, native picker mode, and validation states.',
  };
}
