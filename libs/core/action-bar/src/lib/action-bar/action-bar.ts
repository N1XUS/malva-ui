import {
  ChangeDetectionStrategy,
  Component,
  input,
  ViewEncapsulation,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';

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
  host: {
    class: 'mlv-action-bar',
    '[class.mlv-action-bar--fixed]': 'fixed()',
    '[class.mlv-action-bar--sticky]': 'sticky()',
    '[class.mlv-action-bar--pos-top]': 'position() === "top"',
    '[class.mlv-action-bar--pos-bottom]': 'position() === "bottom"',
    '[class.mlv-action-bar--shape-pill]': 'shape() === "pill"',
    '[class.mlv-action-bar--wrap]': 'wrap()',
    '[class.mlv-action-bar--contrast]': 'contrast()',
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
