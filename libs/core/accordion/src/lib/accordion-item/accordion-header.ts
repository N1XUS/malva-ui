import { Directive } from '@angular/core';

/**
 * Marks projected content as the rich header of a `mlv-accordion-item`.
 *
 * Use it when the header needs more than the plain `header` string input
 * (icons, badges, multi-line markup). When present, it renders inside the
 * accordion trigger button alongside — or instead of — the `header` text.
 *
 * @example
 * ```html
 * <mlv-accordion-item>
 *   <span mlvAccordionHeader>
 *     <svg lucideFolder [size]="16" /> Documents
 *   </span>
 *   <p>Panel content…</p>
 * </mlv-accordion-item>
 * ```
 */
@Directive({
  selector: '[mlvAccordionHeader]',
})
export class MlvAccordionHeader {}
