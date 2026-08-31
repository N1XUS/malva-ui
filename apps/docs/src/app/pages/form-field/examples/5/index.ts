import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { MlvInput } from '@malva-ui/core/input';
import { MlvFormField, MlvLabel } from '@malva-ui/core/form-utils';

/** A validator whose key has no built-in message, to show the generic fallback. */
function ibanChecksum(control: { value: string | null }) {
  const value = (control.value ?? '').trim();
  return value.length === 0 || value.startsWith('DE')
    ? null
    : { ibanChecksum: true };
}

@Component({
  selector: 'docs-form-field-messages-example',
  imports: [ReactiveFormsModule, MlvInput, MlvFormField, MlvLabel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class FormFieldMessagesExampleComponent {
  /** Fails the built-in `required` rule, which has a mapped message. */
  readonly name = new FormControl('', Validators.required);

  /** Fails a custom rule with no mapped message — shows the generic fallback. */
  readonly iban = new FormControl('GB29 NWBK', ibanChecksum);
}
