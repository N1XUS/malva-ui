import {
  ChangeDetectionStrategy,
  Component,
  input,
  ViewEncapsulation,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import {
  MLV_DENSITY_ELEMENT,
  MlvDensityDirective,
  provideMlvDensityContext,
} from '@malva-ui/cdk/density';

/**
 * Vertical anchor of the action bar. `'bottom'` is the natural companion to
 * `shape="pill"` + `contrast` for floating selection toolbars that appear when
 * the user selects rows in a data-table.
 */
export type MlvActionBarPosition = 'top' | 'bottom';

/**
 * Visual shape of the action bar.
 *
 * - `'default'` — full-width bar with a flush bottom / top border.
 * - `'pill'` — content-width floating pill with a fully rounded radius and a
 *   drop shadow. When paired with `fixed`, the pill auto-centers horizontally.
 */
export type MlvActionBarShape = 'default' | 'pill';

/**
 * Header / toolbar container applied to the consumer's own semantic element.
 *
 * The bar is also a density scope: `mlvDensity` (contributed by
 * {@link MlvDensityDirective} as a host directive) stamps
 * `mlv-action-bar--<density>`, which scales the bar's own padding, the gap
 * between its controls and the logo type ramp, **and** is projected as
 * `MLV_DENSITY_CONTEXT` so directive-bearing controls inside the bar — buttons,
 * selects, chips — size themselves to match. One attribute therefore sizes the
 * whole bar.
 *
 * @example
 * ```html
 * <header mlvActionBar mlvDensity="tight" aria-label="Application">
 *   <a mlvActionBarLogo href="/">Malva</a>
 *   <mlv-spacer />
 *   <button mlvButton>Save</button>
 * </header>
 * ```
 */
@Component({
  // Attribute-selector component — camelCase [mlvX] is the documented pattern
  // (see .claude/rules/angular-component.md); the rule only models kebab-case.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: '[mlvActionBar]',
  imports: [],
  templateUrl: './action-bar.html',
  styleUrl: './action-bar.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [{ directive: MlvDensityDirective, inputs: ['mlvDensity'] }],
  providers: [
    { provide: MLV_DENSITY_ELEMENT, useValue: 'action-bar' },
    provideMlvDensityContext(MlvDensityDirective),
  ],
  host: {
    class: 'mlv-action-bar',
    '[class.mlv-action-bar--fixed]': 'fixed()',
    '[class.mlv-action-bar--sticky]': 'sticky()',
    '[class.mlv-action-bar--pos-top]': 'position() === "top"',
    '[class.mlv-action-bar--pos-bottom]': 'position() === "bottom"',
    '[class.mlv-action-bar--shape-pill]': 'shape() === "pill"',
    '[class.mlv-action-bar--wrap]': 'wrap()',
    '[class.mlv-action-bar--contrast]': 'contrast()',
    // The `animate.enter` / `animate.leave` values below cannot be made
    // conditional: a non-bracketed `host` key is a static attribute, which
    // Angular's `parseHostBindings` stores as `literal(value)`. So the opt-out
    // is a modifier that cancels the keyframes in CSS instead.
    '[class.mlv-action-bar--no-animation]': '!animated()',
    'animate.enter': 'mlv-action-bar--enter',
    'animate.leave': 'mlv-action-bar--leave',
  },
})
export class MlvActionBar {
  /**
   * Applies `position: sticky` so the bar stays pinned while its scroll
   * container scrolls past it.
   */
  readonly sticky = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Applies `position: fixed` so the bar stays pinned to the viewport. When
   * combined with `shape="pill"`, the bar is auto-centered horizontally.
   */
  readonly fixed = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Vertical placement of the bar. Used as the anchor edge when combined with
   * `fixed` or `sticky`, and as the enter/leave animation direction.
   * Defaults to `'top'`.
   */
  readonly position = input<MlvActionBarPosition>('top');

  /**
   * Visual shape. See {@link MlvActionBarShape}. Defaults to `'default'`.
   */
  readonly shape = input<MlvActionBarShape>('default');

  /**
   * Lets the bar's content flow onto further lines once it no longer fits on
   * one, instead of overflowing its container.
   *
   * Off by default, so an application navigation bar keeps its single-row
   * geometry and relies on `[mlvActionBarActions]` to shed controls at narrow
   * widths. Turn it on for content-heavy bars — for example a workflow toolbar
   * projected into `mlv-page-dock` — that must stay fully reachable on a
   * narrow canvas. On a wide viewport nothing wraps and the look is unchanged.
   */
  readonly wrap = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Whether the bar plays its enter / leave animation when it is inserted into
   * or removed from the DOM. Defaults to `true`.
   *
   * The animation says "this bar just appeared" — right for a selection bar
   * revealed by an `@if`, wrong for a bar that is permanent chrome inside a
   * view the router rebuilds. A repeated view is not a new surface, and a page
   * that renders many bars fades and slides all of them on every arrival, so
   * pass `[animated]="false"` there.
   *
   * `prefers-reduced-motion` is honoured independently and is not what this
   * input is for: that shortens the animation for a reader who asked for less
   * motion, while this says the bar has no entrance to play in the first
   * place.
   */
  readonly animated = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });

  /**
   * Renders the bar on a dark, inverted surface so it stands out from the
   * surrounding content. On the light theme the bar becomes a distinctive
   * near-black surface; on the dark theme it flips to a contrasting lighter
   * surface. Child controls automatically adapt their text / icon color so
   * they remain readable on the inverted background.
   */
  readonly contrast = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });
}
