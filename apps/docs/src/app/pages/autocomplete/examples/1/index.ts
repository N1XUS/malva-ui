import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvInput } from '@malva-ui/core/input';
import { MlvAutocomplete } from '@malva-ui/core/autocomplete';
import type { MlvSelectOption } from '@malva-ui/core/dropdown';

@Component({
  selector: 'docs-autocomplete-static-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvInput, MlvAutocomplete],
  templateUrl: './index.html',
})
export default class AutocompleteStaticExampleComponent {
  readonly fruits = [
    'Apple',
    'Apricot',
    'Avocado',
    'Banana',
    'Blackberry',
    'Blueberry',
    'Cherry',
    'Cranberry',
    'Grape',
    'Mango',
    'Orange',
    'Peach',
    'Pear',
    'Pineapple',
    'Plum',
    'Raspberry',
    'Strawberry',
  ];

  readonly selected = signal<string>('');

  onPick(option: MlvSelectOption<string>): void {
    this.selected.set(option.label);
  }
}
