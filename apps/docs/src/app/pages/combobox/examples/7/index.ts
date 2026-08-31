import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvCombobox } from '@malva-ui/core/combobox';
import type { MlvSelectOption } from '@malva-ui/core/select';

interface Timezone {
  id: string;
  city: string;
  region: string;
}

@Component({
  selector: 'docs-combobox-grouped-example',
  imports: [MlvCombobox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class ComboboxGroupedExampleComponent {
  timezones: Timezone[] = [
    { id: 'America/New_York', city: 'New York', region: 'Americas' },
    { id: 'America/Sao_Paulo', city: 'São Paulo', region: 'Americas' },
    { id: 'Europe/London', city: 'London', region: 'Europe' },
    { id: 'Europe/Paris', city: 'Paris', region: 'Europe' },
    { id: 'Europe/Berlin', city: 'Berlin', region: 'Europe' },
    { id: 'Asia/Tokyo', city: 'Tokyo', region: 'Asia' },
    { id: 'Asia/Singapore', city: 'Singapore', region: 'Asia' },
  ];

  zoneToOption = (zone: Timezone): MlvSelectOption<Timezone> => ({
    label: zone.city,
    value: zone,
    group: zone.region,
  });
}
