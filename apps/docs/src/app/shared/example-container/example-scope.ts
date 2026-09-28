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
 * `MLV_DENSITY_CONTEXT` is the half that sizes library components. Since #364
 * every density-aware library component stamps its own
 * `mlv-{block}--{density}` modifier from the density directive — the
 * form-control wrapper, label, checkbox, radio, list item and tab item
 * included — and that modifier is exactly what `density.scss`'s
 * `[class*='--x'] &:not(…)` selectors treat as an override, so the ancestor
 * `mlv--tight` class alone sizes none of them. They resolve this scope through
 * the context. The class stays for plain example markup that carries no
 * density directive (hand-written `.mlv--compact …` rules).
 *
 * Because this scope always has an opinion, it beats a component-scoped
 * `MlvDensityService` inside an example. An example that switches density
 * locally binds a nearer scope instead — `form[mlvForm] [mlvDensity]`, as the
 * input, select and combobox density examples do.
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
