import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MlvDrawer,
  MlvDrawerContent,
  MlvDrawerHeader,
  MlvDrawerBody,
  MlvDrawerSection,
  MlvDrawerSections,
} from '@malva-ui/core/drawer';
import { MlvButton } from '@malva-ui/core/button';
import { MlvFieldset, MlvFieldsetSpan, MlvForm } from '@malva-ui/core/form';
import { MlvFormControlPrepend } from '@malva-ui/core/form-utils';
import { MlvInput } from '@malva-ui/core/input';
import { MlvTextarea } from '@malva-ui/core/textarea';
import { MlvTokenizer } from '@malva-ui/core/tokenizer';
import { MlvNumberInput } from '@malva-ui/core/number-input';
import { MlvSwitch } from '@malva-ui/core/switch';
import { MlvRadio, MlvRadioGroup } from '@malva-ui/core/radio';
import { MlvCheckbox, MlvCheckboxGroup } from '@malva-ui/core/checkbox';
import { MlvDayPicker } from '@malva-ui/core/day-picker';
import { MlvAutofocus, MlvSpacer } from '@malva-ui/cdk/utils';
import type { MlvSelectOption } from '@malva-ui/core/select';
import { MlvSelect } from '@malva-ui/core/select';

@Component({
  selector: 'docs-drawer-right-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MlvDrawer,
    MlvDrawerContent,
    MlvDrawerHeader,
    MlvDrawerBody,
    MlvDrawerSection,
    MlvDrawerSections,
    MlvButton,
    MlvForm,
    MlvFieldset,
    MlvFieldsetSpan,
    MlvFormControlPrepend,
    MlvInput,
    MlvTextarea,
    MlvTokenizer,
    MlvNumberInput,
    MlvSelect,
    MlvSwitch,
    MlvRadio,
    MlvRadioGroup,
    MlvCheckbox,
    MlvCheckboxGroup,
    MlvDayPicker,
    MlvAutofocus,
    MlvSpacer,
  ],
  templateUrl: './index.html',
})
export default class DrawerRightExampleComponent {
  readonly showDrawer = signal(false);

  readonly taxClasses: MlvSelectOption<string>[] = [
    { label: 'Standard rate (19%)', value: 'standard' },
    { label: 'Reduced rate (7%)', value: 'reduced' },
    { label: 'Tax exempt', value: 'exempt' },
  ];

  readonly lowQuantityOptions: MlvSelectOption<string>[] = [
    { label: 'Hide product', value: 'hide' },
    { label: 'Allow buying', value: 'allowbuy' },
    { label: 'Disallow buying', value: 'disallowbuy' },
  ];

  readonly weightUnits: MlvSelectOption<string>[] = [
    { label: 'kg', value: 'kg' },
    { label: 'g', value: 'g' },
    { label: 'lb', value: 'lb' },
  ];

  /** Splits a pasted "a, b, c" into one tag per comma-separated entry. */
  readonly splitTags = (value: string): string[] =>
    value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

  submitForm(): void {
    console.log('something');
  }
}
