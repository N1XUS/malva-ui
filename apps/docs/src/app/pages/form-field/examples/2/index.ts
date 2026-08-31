import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MlvInput } from '@malva-ui/core/input';
import { MlvFormField, MlvLabel, MlvHint } from '@malva-ui/core/form-utils';
import { MlvButton } from '@malva-ui/core/button';

@Component({
  selector: 'docs-form-field-display-strategies-example',
  imports: [
    ReactiveFormsModule,
    MlvInput,
    MlvFormField,
    MlvLabel,
    MlvHint,
    MlvButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class FormFieldDisplayStrategiesExampleComponent {
  readonly strategyForm = new FormGroup({
    immediate: new FormControl('', Validators.required),
    dirty: new FormControl('', Validators.required),
    touched: new FormControl('', Validators.required),
    submit: new FormControl('', Validators.required),
  });

  onStrategySubmit(): void {
    this.strategyForm.markAllAsTouched();
  }
}
