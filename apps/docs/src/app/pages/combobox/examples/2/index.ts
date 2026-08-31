import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvCombobox } from '@malva-ui/core/combobox';

@Component({
  selector: 'docs-combobox-multiple-example',
  imports: [MlvCombobox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class ComboboxMultipleExampleComponent {
  countries = [
    'Argentina',
    'Brazil',
    'Canada',
    'Denmark',
    'Egypt',
    'France',
    'Germany',
    'Hungary',
    'India',
    'Japan',
  ];
}
