import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MlvButton } from '@malva-ui/core/button';
import { MlvCheckbox } from '@malva-ui/core/checkbox';
import { MlvForm, MlvFormActions, MlvFormHeader } from '@malva-ui/core/form';
import { MlvFormField } from '@malva-ui/core/form-utils';
import { MlvInput } from '@malva-ui/core/input';
import { MlvTitle } from '@malva-ui/core/title';

@Component({
  selector: 'docs-form-stacked-example',
  imports: [
    ReactiveFormsModule,
    MlvForm,
    MlvFormHeader,
    MlvFormActions,
    MlvFormField,
    MlvInput,
    MlvCheckbox,
    MlvButton,
    MlvTitle,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class FormStackedExampleComponent {
  private readonly _fb = inject(NonNullableFormBuilder);

  readonly form = this._fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    newsletter: [false],
  });

  submit(): void {
    console.log(this.form.getRawValue());
  }
}
