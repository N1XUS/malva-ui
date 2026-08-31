import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvInput } from '@malva-ui/core/input';
import { MlvAutocomplete } from '@malva-ui/core/autocomplete';
import type { MlvAutocompleteSearchFn } from '@malva-ui/core/autocomplete';
import { of } from 'rxjs';
import { delay } from 'rxjs/operators';

const COUNTRIES = [
  'Argentina',
  'Australia',
  'Austria',
  'Belgium',
  'Brazil',
  'Canada',
  'Chile',
  'China',
  'Denmark',
  'Egypt',
  'Finland',
  'France',
  'Germany',
  'Greece',
  'India',
  'Indonesia',
  'Ireland',
  'Italy',
  'Japan',
  'Kenya',
  'Mexico',
  'Netherlands',
  'Norway',
  'Poland',
  'Portugal',
  'Spain',
  'Sweden',
  'Switzerland',
  'Thailand',
  'Turkey',
  'Ukraine',
  'United Kingdom',
  'United States',
  'Vietnam',
];

@Component({
  selector: 'docs-autocomplete-async-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvInput, MlvAutocomplete],
  templateUrl: './index.html',
})
export default class AutocompleteAsyncExampleComponent {
  /** Simulates a network lookup with 600ms latency. */
  readonly search: MlvAutocompleteSearchFn<string> = (query) =>
    of(
      COUNTRIES.filter((country) =>
        country.toLowerCase().includes(query.toLowerCase()),
      ),
    ).pipe(delay(600));
}
