import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="exampleArray"
    header="action-bar"
  />`,
})
export class ActionBarPage {
  exampleArray = new Array(2).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Action Bar',
    description: 'An action bar provides a top-level navigation container.',
  };
}