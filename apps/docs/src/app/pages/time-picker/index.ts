import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="examples"
    header="time-picker"
  />`,
})
export class TimePickerPageComponent {
  examples = new Array(9).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Time Picker',
    description:
      'A scrollable drum-roll time picker for selecting hours, minutes, and optionally seconds. Supports 24-hour and 12-hour AM/PM modes with full reactive forms integration.',
  };
}
