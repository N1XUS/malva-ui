import { computed, Directive, inject, input } from '@angular/core';
import { MLV_INPUT_VALUE } from './input-value-accessor';

/**
 * A synchronous password-strength rule supplied by the consumer.
 *
 * Return `true` when the password satisfies the rule and `false` otherwise.
 */
export interface MlvPasswordStrengthRule {
  (value: string): boolean;
}

/**
 * Headless password-strength calculator for `mlv-input`.
 *
 * The directive evaluates consumer-provided rules against the input's current
 * value and exposes reactive score metadata through `exportAs`. It renders no
 * UI, allowing consumers to present bars, text, emoji, or another indicator.
 */
@Directive({
  selector: 'mlv-input[mlvPasswordStrength]',
  exportAs: 'mlvPasswordStrength',
})
export class MlvPasswordStrength {
  /**
   * Synchronous rules evaluated against the current input value.
   */
  readonly mlvPasswordStrength = input<readonly MlvPasswordStrengthRule[]>([]);

  /** @private Input value accessor provided by the host `mlv-input`. */
  private readonly _input = inject(MLV_INPUT_VALUE);

  /** Number of rules currently satisfied by the input value. */
  readonly score = computed(() => {
    const value = this._input.value() ?? '';
    return this.mlvPasswordStrength().reduce(
      (total, rule) => total + (rule(value) ? 1 : 0),
      0,
    );
  });

  /** Total number of configured rules. */
  readonly maxScore = computed(() => this.mlvPasswordStrength().length);

  /**
   * Normalized score from `0` to `1`. Returns `0` when no rules are configured.
   */
  readonly ratio = computed(() => {
    const maximum = this.maxScore();
    return maximum === 0 ? 0 : this.score() / maximum;
  });
}
