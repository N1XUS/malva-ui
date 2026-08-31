import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MlvButton, MlvButtonIcon } from '@malva-ui/core/button';
import {
  MlvFormControlAppend,
  MlvFormControlInset,
} from '@malva-ui/core/form-utils';
import {
  MlvInput,
  MlvPasswordStrength,
  type MlvPasswordStrengthRule,
} from '@malva-ui/core/input';
import { LucideEye, LucideEyeOff } from '@lucide/angular';

@Component({
  selector: 'docs-input-password-strength-example',
  imports: [
    MlvButton,
    MlvButtonIcon,
    MlvFormControlAppend,
    MlvFormControlInset,
    MlvInput,
    MlvPasswordStrength,
    LucideEye,
    LucideEyeOff,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class PasswordStrengthExampleComponent {
  /** Four levels rendered by the example's segmented strength meter. */
  protected readonly levels = [1, 2, 3, 4] as const;

  /** Consumer-owned rules evaluated by the headless directive. */
  protected readonly rules: readonly MlvPasswordStrengthRule[] = [
    (value) => value.length >= 8,
    (value) => /[a-z]/.test(value) && /[A-Z]/.test(value),
    (value) => /\d/.test(value),
    (value) => /[^A-Za-z0-9]/.test(value),
  ];

  /** Whether the password is currently revealed as plain text. */
  protected readonly passwordVisible = signal(false);

  /** Toggles the native input between password and text presentation. */
  protected togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  /** Returns an accessible text equivalent for the four visual levels. */
  protected strengthLabel(score: number): string {
    return ['No strength', 'Weak', 'Fair', 'Good', 'Strong'][score];
  }
}
