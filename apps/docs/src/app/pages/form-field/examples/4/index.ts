import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  email,
  form,
  FormField,
  minLength,
  required,
  submit,
} from '@angular/forms/signals';
import { MlvButton } from '@malva-ui/core/button';
import { MlvCheckbox } from '@malva-ui/core/checkbox';
import { MlvFormField, MlvHint, MlvLabel } from '@malva-ui/core/form-utils';
import { MlvInput } from '@malva-ui/core/input';
import { MlvRadio, MlvRadioGroup } from '@malva-ui/core/radio';
import { MlvSelect } from '@malva-ui/core/select';

@Component({
  selector: 'docs-form-field-signal-forms-example',
  imports: [
    MlvButton,
    MlvCheckbox,
    FormField,
    MlvFormField,
    MlvHint,
    MlvInput,
    JsonPipe,
    MlvLabel,
    MlvRadio,
    MlvRadioGroup,
    MlvSelect,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class FormFieldSignalFormsExampleComponent {
  readonly countries = [
    'United States',
    'Canada',
    'United Kingdom',
    'Germany',
    'France',
    'Japan',
  ];

  /** Writable model owned by the signal form. */
  readonly model = signal<{
    name: string;
    email: string;
    password: string;
    country: string | null;
    gender: string;
    terms: boolean;
  }>({
    name: '',
    email: '',
    password: '',
    country: null,
    gender: '',
    terms: false,
  });

  /** Schema-driven field tree bound directly through `[formField]`. */
  readonly fields = form(this.model, (path) => {
    required(path.name, { message: 'Full name is required' });
    minLength(path.name, 2, {
      message: 'Full name must be at least 2 characters',
    });
    required(path.email, { message: 'Email is required' });
    email(path.email, { message: 'Enter a valid email address' });
    required(path.password, { message: 'Password is required' });
    minLength(path.password, 8, {
      message: 'Password must be at least 8 characters',
    });
    required(path.country, { message: 'Select a country' });
    required(path.gender, { message: 'Select a gender' });
    required(path.terms, {
      message: 'Accept the terms and conditions to continue',
    });
  });

  /** Whether the latest valid submission completed. */
  readonly submitted = signal(false);

  /** Submits through Angular Signal Forms and exposes the accepted model. */
  async onSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    this.submitted.set(false);

    await submit(this.fields, async () => {
      this.submitted.set(true);
      return undefined;
    });
  }
}
