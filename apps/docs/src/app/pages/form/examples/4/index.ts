import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvAutofocus, MlvSpacer } from '@malva-ui/cdk/utils';
import { MlvButton } from '@malva-ui/core/button';
import { MlvCheckbox } from '@malva-ui/core/checkbox';
import {
  MlvDialog,
  MlvDialogBody,
  MlvDialogClose,
  MlvDialogFooter,
  MlvDialogHeader,
  MlvDialogTemplate,
} from '@malva-ui/core/dialog';
import {
  MlvDrawer,
  MlvDrawerBody,
  MlvDrawerContent,
  MlvDrawerHeader,
} from '@malva-ui/core/drawer';
import { MlvFieldset, MlvForm } from '@malva-ui/core/form';
import { MlvInput } from '@malva-ui/core/input';
import type { MlvSelectOption } from '@malva-ui/core/select';
import { MlvSelect } from '@malva-ui/core/select';
import { MlvTitle } from '@malva-ui/core/title';

@Component({
  selector: 'docs-form-overlays-example',
  imports: [
    MlvForm,
    MlvFieldset,
    MlvInput,
    MlvCheckbox,
    MlvSelect,
    MlvButton,
    MlvTitle,
    MlvDialogTemplate,
    MlvDialog,
    MlvDialogHeader,
    MlvDialogBody,
    MlvDialogFooter,
    MlvDialogClose,
    MlvDrawer,
    MlvDrawerBody,
    MlvDrawerContent,
    MlvDrawerHeader,
    MlvAutofocus,
    MlvSpacer,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
  styles: `
    .row {
      display: flex;
      gap: var(--mlv-spacing-3);
    }
  `,
})
export default class FormOverlaysExampleComponent {
  readonly dialogOpen = signal(false);
  readonly drawerOpen = signal(false);

  readonly roles: MlvSelectOption<string>[] = [
    { label: 'Owner', value: 'owner' },
    { label: 'Editor', value: 'editor' },
    { label: 'Viewer', value: 'viewer' },
  ];

  readonly handlers: MlvSelectOption<string>[] = [
    { label: 'Hide product', value: 'hide' },
    { label: 'Allow buying', value: 'allowbuy' },
    { label: 'Disallow buying', value: 'disallowbuy' },
  ];
}
