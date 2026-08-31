import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  contentChild,
  input,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import {
  MlvDensityDirective,
  MLV_DENSITY_ELEMENT,
} from '@malva-ui/cdk/density';
import type { MlvTone } from '@malva-ui/cdk/utils';
import { MlvBadgeIcon } from '../badge-icon';

/**
 * Available tone variants for the badge component.
 * Extends the shared {@link MlvTone} semantic vocabulary with neutral and
 * brand options, mapping to color tokens in the design system.
 */
export type MlvBadgeTone =
  | MlvTone
  | 'default'
  | 'primary'
  | 'secondary'
  | 'accent';

/**
 * Badge component for displaying short status labels, counts, or tags.
 * Supports solid and muted color modes across all semantic tone variants,
 * with full density system integration.
 *
 * A projected `[mlvBadgeIcon]` is sized and spaced by the badge itself and can
 * be moved to either side with the directive's `position` input.
 *
 * @example
 * ```html
 * <mlv-badge tone="success">Active</mlv-badge>
 * <mlv-badge tone="danger" muted>Deprecated</mlv-badge>
 * <mlv-badge tone="primary" mlvDensity="compact">New</mlv-badge>
 * <mlv-badge tone="success" muted>
 *   <svg lucideCheck mlvBadgeIcon />
 *   Published
 * </mlv-badge>
 * ```
 */
@Component({
  selector: 'mlv-badge',
  templateUrl: './badge.html',
  styleUrl: './badge.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  providers: [{ provide: MLV_DENSITY_ELEMENT, useValue: 'badge' }],
  hostDirectives: [
    {
      directive: MlvDensityDirective,
      inputs: ['mlvDensity'],
    },
  ],
  host: {
    class: 'mlv-badge',
    '[class]': '"mlv-badge--tone-" + tone()',
    '[class.mlv-badge--muted]': 'muted()',
    '[class.mlv-badge--with-icon]': '!!_iconRef()',
  },
})
export class MlvBadge {
  /**
   * The semantic tone of the badge.
   * Determines the background and text colors.
   * Defaults to `'default'` (neutral).
   */
  readonly tone = input<MlvBadgeTone>('default');

  /**
   * @deprecated No-op. Badges always render with fully rounded (pill)
   * corners via `--mlv-radius-full`; this input has never affected the
   * rendered radius and is kept only so existing `[rounded]` bindings keep
   * compiling. Override `border-radius` on `.mlv-badge` if you need a
   * different shape.
   */
  readonly rounded = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * When `true`, uses muted surface/text tokens instead of solid fill colors.
   * Muted badges are less visually prominent and suit inline or decorative contexts.
   * Supports attribute usage: `<mlv-badge muted>` or `<mlv-badge [muted]="true">`.
   */
  readonly muted = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * @protected Projected `[mlvBadgeIcon]`, if any. Only its presence is used —
   * it adds the label gap, so a badge without an icon keeps its former spacing.
   */
  protected readonly _iconRef = contentChild(MlvBadgeIcon);
}
