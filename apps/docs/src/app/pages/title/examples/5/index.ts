import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MlvFormField, MlvHint, MlvLabel } from '@malva-ui/core/form-utils';
import { MlvTitle } from '@malva-ui/core/title';

@Component({
  selector: 'docs-title-reactive-forms-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    JsonPipe,
    ReactiveFormsModule,
    MlvFormField,
    MlvHint,
    MlvLabel,
    MlvTitle,
  ],
  templateUrl: './index.html',
})
export default class TitleReactiveFormsExampleComponent {
  readonly form = new FormGroup({
    title: new FormControl('Migration plan', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(4)],
    }),
  });
}
