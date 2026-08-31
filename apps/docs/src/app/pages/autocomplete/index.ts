import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { DocPageMeta } from '../../shared/doc-page';
import { DocPageComponent } from '../../shared/doc-page';

@Component({
  imports: [DocPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-page
    [meta]="meta"
    [examples]="examples"
    header="autocomplete"
  />`,
})
export class AutocompletePageComponent {
  examples = new Array(4).fill(0).map((_, i) => i + 1);

  readonly meta: DocPageMeta = {
    title: 'Autocomplete',
    description:
      'The [mlvAutocomplete] directive adds typeahead suggestions to any text input — a native <input> or a mlv-input — reusing the same matcher and dropdown panel as mlv-combobox. It supports static option lists, async search with a loading affordance, matched-substring highlighting, a pluggable matcher, debounce, and a WAI-ARIA activedescendant keyboard model.',
  };
}
