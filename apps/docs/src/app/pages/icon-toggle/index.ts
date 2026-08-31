import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="examples"
    header="icon-toggle"
  />`,
})
export class IconTogglePageComponent {
  examples = new Array(3).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Icon Toggle',
    description:
      'Chromeless, glyph-only WAI-ARIA toggle button. State is expressed entirely as a CSS fill on the single projected icon — no background in any state.',
  };
}
