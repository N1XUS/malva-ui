import { Directive } from '@angular/core';

/**
 * Marks projected content as the trigger button's glyph, replacing the default
 * `lucidePlus` icon of `mlv-speed-dial`. The element is projected into the
 * trigger's "open" glyph slot: while the dial is open it crossfades out
 * (fade, shrink, quarter turn) and the built-in `lucideX` close glyph takes
 * its place.
 *
 * @example
 * ```html
 * <mlv-speed-dial [items]="items" ariaLabel="Share">
 *   <svg mlvSpeedDialTriggerIcon lucideShare2 [size]="20" aria-hidden="true" />
 * </mlv-speed-dial>
 * ```
 */
@Directive({ selector: '[mlvSpeedDialTriggerIcon]' })
export class MlvSpeedDialTriggerIcon {}
