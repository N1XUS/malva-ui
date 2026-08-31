import { Directive, ElementRef, inject, input, signal } from '@angular/core';
import type { FocusableOption } from '@angular/cdk/a11y';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';

/**
 * `[mlvStepHeader]` — applied to each step-header trigger element inside
 * `mlv-stepper`. Implements {@link FocusableOption} so the parent
 * `MlvStepper` can drive arrow-key navigation and roving tabindex via a
 * CDK `FocusKeyManager`.
 *
 * @internal Not part of the public API — an implementation detail of the stepper.
 */
@Directive({
  selector: '[mlvStepHeader]',
  exportAs: 'mlvStepHeader',
})
export class MlvStepHeader implements FocusableOption {
  /** @internal Host element reference, used for focus + focused-element lookup. */
  readonly elementRef = inject(ElementRef<HTMLElement>);

  /**
   * Whether this step header is non-interactive (e.g. a not-yet-reachable step
   * in linear mode). Disabled headers are skipped by the FocusKeyManager and
   * removed from the roving tab order.
   */
  readonly isDisabled = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * @internal Roving tabindex value managed by the parent FocusKeyManager.
   * `0` for the currently focused header, `-1` for all others. Bound to the
   * host element's `tabindex` attribute in the stepper template.
   */
  readonly tabIndex = signal(-1);

  /** FocusableOption — whether this header is skipped by the FocusKeyManager. */
  get disabled(): boolean {
    return this.isDisabled();
  }

  /** FocusableOption — programmatically focuses this step header. */
  focus(): void {
    this.elementRef.nativeElement.focus();
  }
}
