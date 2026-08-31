import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { MlvSelectOption } from '@malva-ui/core/select';
import { MlvSelect } from '@malva-ui/core/select';

interface Destination {
  city: string;
  country: string;
}

@Component({
  selector: 'docs-select-native-example',
  imports: [MlvSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class SelectNativeExampleComponent {
  readonly destinations: Destination[] = [
    { city: 'Bucharest', country: 'Romania' },
    { city: 'Berlin', country: 'Germany' },
    { city: 'Tokyo', country: 'Japan' },
  ];

  readonly destinationToOption = (
    destination: Destination,
  ): MlvSelectOption<Destination> => ({
    label: destination.city,
    value: destination,
    group: destination.country,
  });
}
