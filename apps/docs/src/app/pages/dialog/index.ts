import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
      [meta]="meta"
      [examples]="exampleArray"
      header="dialog"
    />
    <router-outlet />`,
})
export class DialogPageComponent {
  exampleArray = new Array(9).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Dialog',
    description: 'Modal dialog windows for user interaction.',
  };
}
