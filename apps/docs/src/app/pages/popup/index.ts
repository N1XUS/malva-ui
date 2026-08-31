import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="exampleArray"
    header="popup"
  />`,
})
export class PopupPageComponent {
  exampleArray = new Array(8).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Popup',
    description: 'Floating content panels triggered by user interaction.',
  };
}
