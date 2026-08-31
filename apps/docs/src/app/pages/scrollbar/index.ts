import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page [meta]="meta" [examples]="exampleArray" header="scrollbar" />`,
})
export class ScrollbarPageComponent {
  exampleArray = new Array(4).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Scrollbar',
    description:
      'A minimalistic custom scrollbar that hides the native browser scrollbar and renders a themed overlay track and thumb. Native scroll behaviour is preserved — only the visual presentation changes.',
  };
}
