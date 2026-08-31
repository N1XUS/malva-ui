import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="exampleArray"
    header="link"
  />`,
})
export class LinkPageComponent {
  exampleArray = new Array(2).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Link',
    description: 'Anchor element with visual variants for navigation.',
  };
}
