import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import type { MlvDensity } from '@malva-ui/cdk/density';
import { MlvButton } from '@malva-ui/core/button';
import { MlvCombobox } from '@malva-ui/core/combobox';
import { MlvForm } from '@malva-ui/core/form';

@Component({
  selector: 'docs-combobox-density-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvButton, MlvCombobox, MlvForm],
  templateUrl: './index.html',
})
export default class ComboboxDensityExampleComponent {
  readonly density = signal<MlvDensity>('comfortable');
  readonly densityLevels: MlvDensity[] = [
    'tight',
    'compact',
    'comfortable',
    'spacious',
    'airy',
  ];
  readonly languages = [
    'CSS',
    'Go',
    'Java',
    'JavaScript',
    'Kotlin',
    'Python',
    'Rust',
    'Swift',
    'TypeScript',
  ];
}
