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
 * `<mlv-page-shell>`, `<main>`, or `<body>`) once per application. All
 * descendant components that use the `@include density-compact / density-spacious`
 * SCSS mixins will respond automatically to the current service density — no
 * per-component `[mlvDensity]` input needed.
 *
 * Every Malva component that uses those mixins stamps its own
 * `mlv-{block}--{density}` modifier (own `mlvDensity` → nearest density scope
 * → `MlvDensityService`), which takes precedence over this class (the SCSS
 * mixin's `:not(...)` logic). So the class sizes only markup that carries no
 * modifier of its own — application styles keyed on `.mlv--{density}`. It is
 * **not** a density scope: it neither reads nor provides `MLV_DENSITY_CONTEXT`,
 * because a root that published the global density would shadow every
 * component-scoped `MlvDensityService` below it (#364).
 *
 * @example Place on layout root
 * ```html
 * <mlv-page-shell mlvDensityRoot>
 *   <mlv-button>Automatically compact when service says compact</mlv-button>
 * </mlv-page-shell>
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
