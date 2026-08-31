import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { form, required, FormField } from '@angular/forms/signals';
import { MlvInput } from '@malva-ui/core/input';

/**
 * Signal forms binding: `mlv-input` implements `FormValueControl` through the
 * Malva signal-control base and is driven directly by `[formField]`.
 */
@Component({
  selector: 'docs-input-signal-forms-example',
  imports: [MlvInput, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class InputSignalFormsExampleComponent {
  /** The form model — a plain writable signal. */
  readonly model = signal({ email: '' });

  /** Signal form over the model with a declarative `required` rule. */
  readonly f = form(this.model, (path) => {
    required(path.email, { message: 'Email is required' });
  });
}
