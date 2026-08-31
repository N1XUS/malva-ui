import {
  ChangeDetectionStrategy,
  Component,
  input,
  ViewEncapsulation,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';

/**
 * Orientation of the divider line.
 * - `'horizontal'` — a full-width horizontal rule (default)
 * - `'vertical'` — a full-height vertical rule; requires the parent to have a defined height
 */
export type MlvDividerOrientation = 'horizontal' | 'vertical';

/**
 * Divider component that renders a thin separator line between content sections.
 *
 * Renders an `<hr role="separator">` internally and supports an optional
 * label projected via `<ng-content>`.  When a label is present the divider
 * line is split into two segments flanking the label.
 *
 * @example Basic horizontal
 * ```html
 * <mlv-divider />
 * ```
 *
 * @example With label
 * ```html
 * <mlv-divider>OR</mlv-divider>
 * ```
 *
 * @example Vertical
 * ```html
 * <div style="display: flex; height: 2rem;">
 *   <span>Left</span>
 *   <mlv-divider orientation="vertical" />
 *   <span>Right</span>
 * </div>
 * ```
 *
 * @example Dashed
 * ```html
 * <mlv-divider dashed />
 * ```
 *
 * @example Muted
 * ```html
 * <mlv-divider muted />
 * ```
 */
@Component({
  selector: 'mlv-divider',
  templateUrl: './divider.html',
  styleUrl: './divider.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  host: {
    class: 'mlv-divider',
    role: 'separator',
    '[class.mlv-divider--vertical]': 'orientation() === "vertical"',
    '[class.mlv-divider--horizontal]': 'orientation() === "horizontal"',
    '[class.mlv-divider--dashed]': 'dashed()',
    '[class.mlv-divider--muted]': 'muted()',
    '[attr.aria-orientation]': 'orientation()',
  },
})
export class MlvDivider {
  /**
   * The orientation of the divider line.
   * Defaults to `'horizontal'`.
   */
  readonly orientation = input<MlvDividerOrientation>('horizontal');

  /**
   * When `true`, renders the divider line as a dashed stroke instead of solid.
   * Supports attribute syntax: `<mlv-divider dashed>`.
   */
  readonly dashed = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * When `true`, uses a more subtle border color (`--mlv-border-subtle`)
   * instead of the default border token.
   * Supports attribute syntax: `<mlv-divider muted>`.
   */
  readonly muted = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });
}
