import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvCombobox } from '@malva-ui/core/combobox';

@Component({
  selector: 'docs-combobox-mobile-example',
  imports: [MlvCombobox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class ComboboxMobileExampleComponent {
  fruits = [
    'Apple',
    'Apricot',
    'Banana',
    'Blueberry',
    'Cherry',
    'Grapefruit',
    'Kiwi',
    'Lemon',
    'Mango',
    'Orange',
    'Peach',
    'Pear',
  ];
}
