import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="exampleArray"
    header="day-picker"
  />`,
})
export class DayPickerPageComponent {
  exampleArray = new Array(2).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Day Picker',
    description: 'A day picker input for selecting dates.',
  };
}
