import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="examples"
    header="search-field"
  />`,
})
export class SearchFieldPageComponent {
  readonly examples = [1, 2, 3, 4, 5];

  readonly meta: DocPageMeta = {
    title: 'Search Field',
    description:
      'A search-specific input with debounced live updates or explicit submit behavior, loading feedback, clearing, and accessible keyboard interaction.',
  };
}
