import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { JsonPipe } from '@angular/common';
import { MlvInput } from '@malva-ui/core/input';
import { MlvCheckbox } from '@malva-ui/core/checkbox';
import { MlvSelect } from '@malva-ui/core/select';
import { MlvFormField, MlvLabel, MlvHint } from '@malva-ui/core/form-utils';
import { MlvButton } from '@malva-ui/core/button';

@Component({
  selector: 'docs-form-field-template-driven-example',
  imports: [
    FormsModule,
    MlvInput,
    MlvCheckbox,
    MlvSelect,
    MlvFormField,
    MlvLabel,
    MlvHint,
    JsonPipe,
    MlvButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class FormFieldTemplateDrivenExampleComponent {
  readonly templateModel = {
    name: '',
    email: '',
    color: null as null | string,
    newsletter: false,
  };
  readonly templateSubmitted = signal(false);
  readonly colors = ['Red', 'Green', 'Blue', 'Yellow', 'Purple'];

  onTemplateSubmit(): void {
    this.templateSubmitted.set(true);
  }
}
