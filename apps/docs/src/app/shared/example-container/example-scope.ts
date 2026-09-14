import { Directive, inject, input } from '@angular/core';
import type { MlvDensity } from '@malva-ui/cdk/density';
import { MLV_DENSITY_CONTEXT } from '@malva-ui/cdk/density';
import type { MlvTheme } from '@malva-ui/cdk/theme';
import type { MlvDirection } from '@malva-ui/cdk/utils';

/**
 * Scopes density, direction and theme to one docs example preview.
 *
 * The three switchers above a docs example are **per-example**: flipping one
 * must not flip the page around it. So this directive never talks to
 * `MlvDensityService`, `MlvRtlService` or `MlvThemeService` — those own the
 * document and are driven by `docs-app-bar-preferences`. It writes the three
 * scoped mechanisms the library already honours, on its own host element:
 *
 * | Concern   | Mechanism                                                                    |
 * | --------- | ---------------------------------------------------------------------------- |
 * | Density   | the `mlv--{density}` cascade class **and** `MLV_DENSITY_CONTEXT`             |
 * | Direction | a `dir` attribute — `MlvRtlService.elementDirection()` resolves the nearest  |
 * | Theme     | an `mlvTheme` attribute — `theme.scss` keys its token islands off it        |
 *
 * Density needs **both** halves. The class alone is not enough: every
 * density-aware component stamps its own `mlv-{block}--{density}` modifier from
 * the density directive, and that modifier is exactly what
 * `density.scss`'s `[class*='--x'] &:not(…)` selectors treat as an override —
 * so a `mlv-button--comfortable` resolved from the *global* service would beat
 * the ancestor `mlv--tight`. Providing `MLV_DENSITY_CONTEXT` makes those
 * directives resolve the scoped value instead, and the cascade class then
 * covers the components that have no density directive of their own.
 *
 * @example
 * ```html
 * <div docsExampleScope [density]="density()" [direction]="direction()" [theme]="theme()">
 *   <ng-container *ngComponentOutlet="component()" />
 * </div>
 * ```
 */
@Directive({
  selector: '[docsExampleScope]',
  providers: [
    {
      provide: MLV_DENSITY_CONTEXT,
      // Evaluated lazily at injection time, so referencing the class inside its
      // own decorator metadata needs no `forwardRef`.
      useFactory: () => inject(DocsExampleScopeDirective).density,
    },
  ],
  host: {
    '[class]': '"mlv--" + density()',
    '[attr.dir]': 'direction()',
    '[attr.mlvTheme]': 'theme()',
  },
})
export class DocsExampleScopeDirective {
  /**
   * Density applied to everything inside the host, as both the `mlv--{density}`
   * cascade class and the projected `MLV_DENSITY_CONTEXT`.
   */
  readonly density = input.required<MlvDensity>();

  /**
   * Direction applied to the host subtree. Written as a plain `dir` attribute,
   * which is this library's direction API — `elementDirection(host)` walks up
   * to the nearest explicit `dir`, so an example mirrors while the page does
   * not.
   */
  readonly direction = input.required<MlvDirection>();

  /**
   * Theme applied to the host subtree, as the `mlvTheme` attribute that
   * `@malva-ui/styles` keys its scoped token islands off.
   */
  readonly theme = input.required<MlvTheme>();
}
