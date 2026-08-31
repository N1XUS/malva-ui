import { Component, ChangeDetectionStrategy } from '@angular/core';
import type { MlvSelectOption } from '@malva-ui/core/select';
import { MlvSelect } from '@malva-ui/core/select';

interface City {
  name: string;
  country: string;
}

@Component({
  selector: 'docs-select-grouped-example',
  imports: [MlvSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class SelectGroupedExampleComponent {
  cities: City[] = [
    { name: 'Paris', country: 'France' },
    { name: 'Lyon', country: 'France' },
    { name: 'Nice', country: 'France' },
    { name: 'Berlin', country: 'Germany' },
    { name: 'Munich', country: 'Germany' },
    { name: 'Tokyo', country: 'Japan' },
    { name: 'Osaka', country: 'Japan' },
  ];

  cityToOption = (city: City): MlvSelectOption<City> => ({
    label: city.name,
    value: city,
    group: city.country,
  });
}
