import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { JsonPipe } from '@angular/common';
import { MlvInput } from '@malva-ui/core/input';
import { MlvCheckbox } from '@malva-ui/core/checkbox';
import { MlvSelect } from '@malva-ui/core/select';
import { MlvRadio, MlvRadioGroup } from '@malva-ui/core/radio';
import { MlvFormField, MlvLabel, MlvHint } from '@malva-ui/core/form-utils';
import { MlvButton } from '@malva-ui/core/button';

@Component({
  selector: 'docs-form-field-reactive-forms-example',
  imports: [
    ReactiveFormsModule,
    MlvInput,
    MlvCheckbox,
    MlvSelect,
    MlvRadio,
    MlvRadioGroup,
    MlvFormField,
    MlvLabel,
    MlvHint,
    JsonPipe,
    MlvButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class FormFieldReactiveFormsExampleComponent {
  readonly reactiveForm = new FormGroup({
    name: new FormControl('', [Validators.required, Validators.minLength(2)]),
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [
      Validators.required,
      Validators.minLength(8),
    ]),
    country: new FormControl(null, Validators.required),
    gender: new FormControl('', Validators.required),
    terms: new FormControl(false, Validators.requiredTrue),
  });
  readonly reactiveSubmitted = signal(false);
  readonly countries = [
    'United States',
    'Canada',
    'United Kingdom',
    'Germany',
    'France',
    'Japan',
  ];

  onReactiveSubmit(): void {
    this.reactiveForm.markAllAsTouched();
    if (this.reactiveForm.valid) {
      this.reactiveSubmitted.set(true);
    }
  }
}
