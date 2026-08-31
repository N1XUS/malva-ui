import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  input,
} from '@angular/core';
import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import type { MlvTone } from '@malva-ui/cdk/utils';

/**
 * Available tone variants for the status indicator.
 * Extends the shared {@link MlvTone} semantic vocabulary with neutral and
 * brand options — mirroring `MlvBadgeTone` / `MlvChipTone` — so a dot's colour stays
 * consistent with the badge/chip it commonly sits beside.
 */
export type MlvStatusIndicatorTone =
  | MlvTone
  | 'default'
  | 'primary'
  | 'secondary'
  | 'accent';

/**
 * Small circular status dot for conveying presence, health, or state (online,
 * busy, error, …). Renders a `0.5rem` (8px) coloured dot using the same
 * semantic {@link MlvStatusIndicatorTone} vocabulary as `mlv-badge` / `mlv-chip`,
 * with an optional infinite ripple pulse.
 *
 * Decorative by default (`aria-hidden`); provide {@link MlvStatusIndicator.ariaLabel}
 * to expose an accessible name (`role="img"`) when the dot carries meaning that
 * is not conveyed by adjacent text.
 *
 * @example
 * ```html
 * <mlv-status-indicator tone="success" pulse />
 * <mlv-status-indicator tone="danger" ariaLabel="Offline" />
 * <span><mlv-status-indicator tone="warning" /> Degraded</span>
 * ```
 */
@Component({
  selector: 'mlv-status-indicator',
  template: '',
  styleUrl: './status-indicator.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-status-indicator',
    '[class]': '"mlv-status-indicator--tone-" + tone()',
    '[class.mlv-status-indicator--pulse]': 'pulse()',
    '[style.--mlv-status-indicator-size]': '_sizeVar()',
    '[attr.role]': 'ariaLabel() ? "img" : null',
    '[attr.aria-label]': 'ariaLabel() || null',
    '[attr.aria-hidden]': 'ariaLabel() ? null : "true"',
  },
})
export class MlvStatusIndicator {
  /**
   * The semantic tone of the dot, mapped to a solid fill colour token.
   * Defaults to `'default'` (neutral grey).
   */
  readonly tone = input<MlvStatusIndicatorTone>('default');

  /**
   * When `true`, an expanding ripple ring animates outward from the dot on an
   * infinite loop to draw attention (e.g. "live"/"recording" states).
   * Respects `prefers-reduced-motion: reduce`, which suppresses the ripple.
   * Supports attribute usage: `<mlv-status-indicator pulse>`.
   */
  readonly pulse = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Diameter of the dot in pixels. Defaults to `8` (`0.5rem`), matching the
   * design spec. Converted to `rem` internally so the dot scales with the
   * user's root font-size. Overridable per-instance (e.g. `[size]="4"`).
   */
  readonly size = input<number>(8);

  /**
   * Optional accessible name. When set, the dot is exposed to assistive
   * technology as `role="img"` with this label; when omitted, the dot is purely
   * decorative (`aria-hidden`) on the assumption that adjacent text conveys the
   * status. Use this only when the colour/pulse is the sole carrier of meaning.
   */
  readonly ariaLabel = input<string>('');

  /**
   * @protected Dot size expressed in `rem` for the `--mlv-status-indicator-size`
   * custom property (keeps the value scalable rather than binding raw px).
   */
  protected readonly _sizeVar = computed(() => `${this.size() / 16}rem`);
}
