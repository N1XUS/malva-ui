import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvCombobox, MlvComboboxItemDef } from '@malva-ui/core/combobox';
import type { MlvSelectOption } from '@malva-ui/core/select';

interface Tag {
  id: number;
  name: string;
  color: string;
}

@Component({
  selector: 'docs-combobox-complex-objects-example',
  imports: [MlvCombobox, MlvComboboxItemDef],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class ComboboxComplexObjectsExampleComponent {
  predefinedTags: Tag[] = [
    { id: 1, name: 'Bug', color: '#e53935' },
    { id: 2, name: 'Feature', color: '#43a047' },
    { id: 3, name: 'Enhancement', color: '#1e88e5' },
    { id: 4, name: 'Documentation', color: '#fb8c00' },
  ];

  tagToOption = (tag: Tag): MlvSelectOption<Tag> => ({
    label: tag.name,
    value: tag,
  });
}
