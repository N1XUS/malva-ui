import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="exampleArray"
    header="date-range-picker"
  />`,
})
export class DateRangePickerPageComponent {
  exampleArray = new Array(5).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Date Range Picker',
    description:
      'A dual-calendar popup for selecting a start and end date. Supports reactive forms, min/max constraints, custom date adapters, and multiple validation states.',
  };
}
