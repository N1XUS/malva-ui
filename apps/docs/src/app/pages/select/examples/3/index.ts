import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { MlvSelectOption } from '@malva-ui/core/select';
import {
  MlvSelect,
  MlvSelectItemTemplate,
  MlvSelectSelectedTemplate,
} from '@malva-ui/core/select';

interface Country {
  code: string;
  name: string;
  flag: string;
}

@Component({
  selector: 'docs-select-complex-objects-example',
  imports: [MlvSelect, MlvSelectItemTemplate, MlvSelectSelectedTemplate],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class SelectComplexObjectsExampleComponent {
  countries: Country[] = [
    { code: 'US', name: 'United States', flag: '\u{1F1FA}\u{1F1F8}' },
    { code: 'GB', name: 'United Kingdom', flag: '\u{1F1EC}\u{1F1E7}' },
    { code: 'DE', name: 'Germany', flag: '\u{1F1E9}\u{1F1EA}' },
    { code: 'FR', name: 'France', flag: '\u{1F1EB}\u{1F1F7}' },
    { code: 'JP', name: 'Japan', flag: '\u{1F1EF}\u{1F1F5}' },
  ];

  countryToOption = (country: Country): MlvSelectOption<Country> => ({
    label: country.name,
    value: country,
  });

  getCountryFlag(country: Country): string {
    return country.flag;
  }

  getCountryName(country: Country): string {
    return country.name;
  }
}
