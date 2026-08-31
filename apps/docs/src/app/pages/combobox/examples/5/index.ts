import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import type { MlvDensity } from '@malva-ui/cdk/density';
import {
  MlvDensityService,
  MlvDensityRootDirective,
} from '@malva-ui/cdk/density';
import { MlvButton } from '@malva-ui/core/button';
import { MlvCombobox } from '@malva-ui/core/combobox';

@Component({
  selector: 'docs-combobox-density-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvDensityRootDirective, MlvButton, MlvCombobox],
  providers: [MlvDensityService],
  templateUrl: './index.html',
})
export default class ComboboxDensityExampleComponent {
  readonly densityService = inject(MlvDensityService);
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
