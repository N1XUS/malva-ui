import { Directive, inject, computed } from '@angular/core';
import { MlvDensityService } from './density.service';

/**
 * Root density directive.
 *
 * Applies the global `MlvDensityService` density as a `mlv--{density}`
 * BEM modifier class on the host element. This enables the CSS density
 * cascade defined in `@malva-ui/styles` (new theme framework) to propagate
 * automatically to all density-aware descendants.
 *
 * Place this directive on a layout root or container element (e.g.,
 * `<mlv-layout>`, `<main>`, or `<body>`) once per application. All
 * descendant components that use the `@include density-compact / density-spacious`
 * SCSS mixins will respond automatically to the current service density — no
 * per-component `[mlvDensity]` input needed.
 *
 * Individual components can still override by setting their own
 * `[mlvDensity]` input, which adds their BEM modifier class and takes
 * precedence over the cascade (matching the SCSS mixin's `:not(...)` logic).
 *
 * @example Place on layout root
 * ```html
 * <mlv-layout mlvDensityRoot>
 *   <mlv-button>Automatically compact when service says compact</mlv-button>
 * </mlv-layout>
 * ```
 *
 * @example Programmatic control
 * ```ts
 * private readonly density = inject(MlvDensityService);
 *
 * useCompact(): void {
 *   this.density.setDensity('compact');
 * }
 * ```
 */
@Directive({
  selector: '[mlvDensityRoot]',
  host: {
    '[class]': '"mlv--" + _density()',
  },
})
export class MlvDensityRootDirective {
  /** @private */
  private readonly _service = inject(MlvDensityService);

  /** @protected Current global density resolved from `MlvDensityService`, applied as the `mlv--{density}` host class. */
  protected readonly _density = computed(() => this._service.density());
}
