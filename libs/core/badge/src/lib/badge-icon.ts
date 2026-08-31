import { Directive, input } from '@angular/core';

/** Which side of the badge label a `[mlvBadgeIcon]` renders on. */
export type MlvBadgeIconPosition = 'start' | 'end';

/**
 * Marks a projected element as the badge's icon slot. The badge sizes it from
 * its own density-driven font size and adds the label gap, so consumers do not
 * have to hand-tune `width`/`height` per density.
 *
 * The icon is decorative by default (`aria-hidden="true"`): a badge normally
 * repeats the icon's meaning in its label. When the icon is the badge's only
 * content, give the badge itself an accessible name.
 *
 * @example
 * ```html
 * <mlv-badge tone="success" muted>
 *   <svg lucideCheck mlvBadgeIcon />
 *   Published
 * </mlv-badge>
 *
 * <mlv-badge tone="info">
 *   Syncing
 *   <svg lucideRefreshCw mlvBadgeIcon position="end" />
 * </mlv-badge>
 * ```
 */
@Directive({
  selector: '[mlvBadgeIcon]',
  host: {
    class: 'mlv-badge__icon',
    '[class.mlv-badge__icon--end]': "position() === 'end'",
    'aria-hidden': 'true',
  },
})
export class MlvBadgeIcon {
  /**
   * Where the icon sits relative to the badge label. `'start'` (the default)
   * keeps it leading; `'end'` moves it after the label. Both are reordered by
   * CSS, so the icon can stay wherever it reads best in the template.
   */
  readonly position = input<MlvBadgeIconPosition>('start');
}
