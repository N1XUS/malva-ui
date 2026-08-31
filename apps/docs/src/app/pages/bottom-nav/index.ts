import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="examples"
    header="bottom-nav"
  />`,
})
export class BottomNavPageComponent {
  examples = new Array(7).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Bottom Nav',
    description:
      'Fixed bottom navigation bar for mobile contexts with vertical/horizontal stacking, active-only label reveal, and automatic overflow menu.',
  };
}
