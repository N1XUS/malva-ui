import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MlvPinInput } from '@malva-ui/core/pin-input';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MlvButton } from '@malva-ui/core/button';

@Component({
  selector: 'docs-pin-input-reactive-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvPinInput, ReactiveFormsModule, MlvButton],
  templateUrl: './index.html',
})
export default class PinInputReactiveExampleComponent {
  readonly otpCtrl = new FormControl('', [
    Validators.required,
    Validators.minLength(6),
  ]);
  readonly submitted = signal(false);
  readonly submittedValue = signal('');

  submit(): void {
    if (this.otpCtrl.valid) {
      this.submittedValue.set(this.otpCtrl.value ?? '');
      this.submitted.set(true);
    } else {
      this.otpCtrl.markAsTouched();
    }
  }

  reset(): void {
    this.otpCtrl.reset('');
    this.submitted.set(false);
    this.submittedValue.set('');
  }
}
