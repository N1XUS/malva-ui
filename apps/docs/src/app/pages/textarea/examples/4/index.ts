import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MlvTextarea } from '@malva-ui/core/textarea';
import {
  ReactiveFormsModule,
  FormGroup,
  FormControl,
  Validators,
} from '@angular/forms';
import { MlvButton } from '@malva-ui/core/button';

@Component({
  selector: 'docs-textarea-form-example',
  imports: [MlvTextarea, ReactiveFormsModule, MlvButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
})
export default class TextareaFormExampleComponent {
  readonly form = new FormGroup({
    message: new FormControl('', [
      Validators.required,
      Validators.minLength(10),
    ]),
  });

  get messageState(): 'default' | 'error' | 'success' {
    const ctrl = this.form.controls.message;
    if (ctrl.pristine) return 'default';
    if (ctrl.invalid) return 'error';
    return 'success';
  }

  get messageText(): string {
    const ctrl = this.form.controls.message;
    if (ctrl.pristine || ctrl.valid) return '';
    if (ctrl.errors?.['required']) return 'Message is required.';
    if (ctrl.errors?.['minlength'])
      return 'Message must be at least 10 characters.';
    return '';
  }

  submit(): void {
    this.form.markAllAsTouched();
  }
}
