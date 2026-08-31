import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MlvFormControlAppend } from '@malva-ui/core/form-utils';
import {
  MlvInput,
  MlvPasswordStrength,
  type MlvPasswordStrengthRule,
} from '@malva-ui/core/input';

interface PasswordStrengthPresentation {
  emoji: string;
  label: string;
}

@Component({
  selector: 'docs-input-password-strength-emoji-example',
  imports: [MlvFormControlAppend, MlvInput, MlvPasswordStrength],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export default class PasswordStrengthEmojiExampleComponent {
  /** Consumer-owned rules; the directive does not prescribe password policy. */
  protected readonly rules: readonly MlvPasswordStrengthRule[] = [
    (value) => value.length >= 8,
    (value) => /[a-z]/.test(value) && /[A-Z]/.test(value),
    (value) => /\d/.test(value),
    (value) => /[^A-Za-z0-9]/.test(value),
  ];

  /** Custom score-to-presentation mapping owned entirely by this example. */
  protected readonly presentations: readonly PasswordStrengthPresentation[] = [
    { emoji: '🫥', label: 'No' },
    { emoji: '😟', label: 'Weak' },
    { emoji: '😐', label: 'Fair' },
    { emoji: '🙂', label: 'Good' },
    { emoji: '💪', label: 'Strong' },
  ];
}
