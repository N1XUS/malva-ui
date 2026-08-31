import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import type { MlvDensity } from '@malva-ui/cdk/density';
import { MlvButton } from '@malva-ui/core/button';
import { MlvCheckbox } from '@malva-ui/core/checkbox';
import type { MlvFormGap } from '@malva-ui/core/form';
import { MlvFieldset, MlvForm, MlvFormActions } from '@malva-ui/core/form';
import { MlvInput } from '@malva-ui/core/input';
import type { MlvSelectOption } from '@malva-ui/core/select';
import { MlvSelect } from '@malva-ui/core/select';

@Component({
  selector: 'docs-form-density-example',
  imports: [
    MlvForm,
    MlvFieldset,
    MlvFormActions,
    MlvInput,
    MlvCheckbox,
    MlvSelect,
    MlvButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
  styles: `
    .controls {
      display: flex;
      gap: var(--mlv-spacing-3);
      max-inline-size: 32rem;
      margin-block-end: var(--mlv-spacing-6);
    }
    .controls > * {
      flex: 1;
    }
  `,
})
export default class FormDensityExampleComponent {
  readonly density = signal<MlvDensity>('compact');
  readonly densities: MlvDensity[] = [
    'tight',
    'compact',
    'comfortable',
    'spacious',
    'airy',
  ];

  readonly gap = signal<MlvFormGap | 'auto'>('auto');
  readonly gaps: (MlvFormGap | 'auto')[] = ['auto', 'xs', 's', 'm', 'l', 'xl'];

  /** `'auto'` = no override (density default). */
  readonly gapOverride = computed<MlvFormGap | undefined>(() => {
    const gap = this.gap();
    return gap === 'auto' ? undefined : gap;
  });

  readonly roles: MlvSelectOption<string>[] = [
    { label: 'Owner', value: 'owner' },
    { label: 'Editor', value: 'editor' },
    { label: 'Viewer', value: 'viewer' },
  ];
}
