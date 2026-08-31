import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvInput } from '@malva-ui/core/input';
import { MlvAutocomplete } from '@malva-ui/core/autocomplete';
import type { MlvOptionMatcher } from '@malva-ui/core/dropdown';

@Component({
  selector: 'docs-autocomplete-matcher-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvInput, MlvAutocomplete],
  templateUrl: './index.html',
})
export default class AutocompleteMatcherExampleComponent {
  readonly languages = [
    'C',
    'C++',
    'C#',
    'Go',
    'Java',
    'JavaScript',
    'Kotlin',
    'Python',
    'Ruby',
    'Rust',
    'Scala',
    'Swift',
    'TypeScript',
  ];

  /** Prefix-only matcher: suggestions must start with the query. */
  readonly startsWith: MlvOptionMatcher<string> = (option, query) =>
    option.label.toLowerCase().startsWith(query.toLowerCase());
}
