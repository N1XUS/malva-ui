import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  ViewEncapsulation,
} from '@angular/core';
import {
  MLV_DENSITY_ELEMENT,
  MlvDensityDirective,
  provideMlvDensityContext,
} from '@malva-ui/cdk/density';
import type { MlvFormGap } from '../form.types';
import { mlvFormGapValue } from '../form-gap';

/**
 * Layout shell for a native `<form>`: vertical stack with a density-scaled gap,
 * and the density source for everything inside it.
 *
 * - `mlvDensity` (host directive) stamps `mlv-form--<density>` (the form's own
 *   gap scale, and plain markup inside it) **and** provides
 *   `MLV_DENSITY_CONTEXT`, which every density-aware control inside resolves
 *   its own modifier from (fields, labels, buttons, chips…), so one attribute
 *   sizes the whole form. The context is the form's resolved density, so a
 *   form pins everything inside it, even without an explicit value (#364).
 * - `gap` overrides the rhythm explicitly; `--mlv-form-gap` is the CSS hook.
 *
 * @example
 * ```html
 * <form mlvForm mlvDensity="compact" maxWidth="32rem" [formGroup]="form">
 *   <mlv-input formControlName="name" label="Name" />
 *   <footer mlvFormActions align="end"><button mlvButton type="submit">Save</button></footer>
 * </form>
 * ```
 */
@Component({
  // Attribute-selector component on the native element it enhances — same
  // pattern as `button[mlvButton]` / `main[mlvPage]`.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'form[mlvForm]',
  template: '<ng-content />',
  styleUrl: './form.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [{ directive: MlvDensityDirective, inputs: ['mlvDensity'] }],
  providers: [
    { provide: MLV_DENSITY_ELEMENT, useValue: 'form' },
    provideMlvDensityContext(MlvDensityDirective),
  ],
  host: {
    class: 'mlv-form',
    '[style.--mlv-form-gap]': '_gapValue()',
    '[style.max-inline-size]': 'maxWidth() ?? null',
  },
})
export class MlvForm {
  /**
   * Explicit rhythm between the form's direct children (and, by inheritance,
   * inside every `mlvFieldset`). Unset = density-scaled default
   * (tight 0.5rem → airy 1.5rem).
   */
  readonly gap = input<MlvFormGap | undefined>(undefined);

  /** Caps the form's inline size (`max-inline-size`), e.g. `'32rem'`. */
  readonly maxWidth = input<string | undefined>(undefined);

  /**
   * @internal Inline `--mlv-form-gap` value; `null` removes the override so the
   * stylesheet's density-scaled default applies.
   */
  protected readonly _gapValue = computed(() => {
    const gap = this.gap();
    return gap ? mlvFormGapValue(gap) : null;
  });
}
