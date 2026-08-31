import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MlvCheckbox } from '@malva-ui/core/checkbox';
import { MlvFieldset, MlvForm } from '@malva-ui/core/form';

@Component({
  selector: 'docs-form-bare-fieldset-example',
  imports: [MlvForm, MlvFieldset, MlvCheckbox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class FormBareFieldsetExampleComponent {}
