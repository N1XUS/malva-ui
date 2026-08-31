import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MlvCheckbox } from '@malva-ui/core/checkbox';
import { MlvFieldset, MlvFieldsetSpan, MlvForm } from '@malva-ui/core/form';
import { MlvInput } from '@malva-ui/core/input';
import type { MlvSelectOption } from '@malva-ui/core/select';
import { MlvSelect } from '@malva-ui/core/select';

@Component({
  selector: 'docs-form-fieldsets-example',
  imports: [
    MlvForm,
    MlvFieldset,
    MlvFieldsetSpan,
    MlvInput,
    MlvCheckbox,
    MlvSelect,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class FormFieldsetsExampleComponent {
  readonly countries: MlvSelectOption<string>[] = [
    { label: 'Germany', value: 'de' },
    { label: 'Poland', value: 'pl' },
    { label: 'Ukraine', value: 'ua' },
  ];
}
