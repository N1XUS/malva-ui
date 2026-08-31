import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import {
  MlvDrawer,
  MlvDrawerContent,
  MlvDrawerHeader,
  DrawerBodyDirective,
  MlvDrawerSection,
  MlvDrawerSections,
} from '@malva-ui/core/drawer';
import { MlvButton } from '@malva-ui/core/button';
import { MlvForm } from '@malva-ui/core/form';
import { MlvFormField } from '@malva-ui/core/form-utils';
import { MlvInput } from '@malva-ui/core/input';
import { FormsModule } from '@angular/forms';
import { MlvAutofocus, MlvSpacer } from '@malva-ui/cdk/utils';
import { LucideX } from '@lucide/angular';
import type { MlvSelectOption } from '@malva-ui/core/select';
import { MlvSelect } from '@malva-ui/core/select';

@Component({
  selector: 'docs-drawer-right-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MlvDrawer,
    MlvDrawerContent,
    MlvDrawerHeader,
    DrawerBodyDirective,
    MlvDrawerSection,
    MlvDrawerSections,
    MlvButton,
    MlvForm,
    MlvFormField,
    MlvInput,
    FormsModule,
    MlvAutofocus,
    MlvSpacer,
    LucideX,
    MlvSelect,
  ],
  templateUrl: './index.html',
})
export default class DrawerRightExampleComponent {
  readonly showDrawer = signal(false);

  readonly lowQuantityOptions: MlvSelectOption<string>[] = [
    {
      label: 'Hide product',
      value: 'hide',
    },
    {
      label: 'Allow buying',
      value: 'allowbuy',
    },
    {
      label: 'Disallow buying',
      value: 'disallowbuy',
    },
  ];

  submitForm(): void {
    console.log('something');
  }
}
