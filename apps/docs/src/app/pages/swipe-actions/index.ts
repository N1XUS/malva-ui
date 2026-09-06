import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="examples"
    header="swipe-actions"
  />`,
})
export class SwipeActionsPageComponent {
  examples = new Array(7).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Swipe Actions',
    description:
      'iOS-style swipe-to-reveal actions for list rows. A CSS scroll-snap container drives the gesture natively — momentum, axis locking, trackpad, keyboard — with sticky-stacked actions on either edge and no per-frame JavaScript.',
  };
}
