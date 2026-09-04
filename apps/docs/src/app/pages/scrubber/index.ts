import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="examples"
    header="scrubber"
  />`,
})
export class ScrubberPageComponent {
  examples = new Array(3).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Scrubber',
    description:
      'A one-dimensional scroll-snap selector — the drum-roll primitive behind the time picker. Scrolls on either axis, takes any item type with a display hook, and mirrors on the inline axis in RTL.',
  };
}
