import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="examples"
    header="scheduler"
  />`,
})
export class SchedulerPageComponent {
  readonly meta: DocPageMeta = {
    title: 'Scheduler',
    description:
      'Month, week and day calendar views for timed, all-day and multi-day events, with two-way model binding, pointer and keyboard drag-move, resize and range selection, and a replaceable toolbar.',
  };

  readonly examples = new Array(8).fill(0).map((_, index) => index + 1);
}
