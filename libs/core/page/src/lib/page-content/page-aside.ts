import {
  Directive,
  ElementRef,
  afterNextRender,
  inject,
  isDevMode,
} from '@angular/core';

/**
 * The complementary column of `mlv-page-content`, projected as the consumer's
 * own element rather than as a template rendered into a fixed second slot.
 *
 * It used to be a template, and the layout offered a `start` placement that
 * moved the column before the main content **visually while leaving it after
 * the main content in the DOM** — a reading and focus order that disagreed
 * with the rendered page, introduced by a layout convenience. Reading order
 * cannot be fixed by `order` or by `grid-template-areas`: assistive technology
 * and sequential focus follow the DOM. So the placement input is gone and the
 * aside always follows the main column, in the DOM and on screen alike. A
 * genuinely leading complementary column is a claim about reading order, and
 * the honest way to make it is to write that content first — which this
 * component, wrapping the main column for a consumer, cannot express and no
 * longer pretends to.
 *
 * ```html
 * <mlv-page-content>
 *   <article>…</article>
 *   <aside mlvPageAside aria-label="Related work">…</aside>
 * </mlv-page-content>
 * ```
 */
@Directive({
  selector: '[mlvPageAside]',
  host: { class: 'mlv-page-content__aside', 'data-slot': 'page-aside' },
})
export class MlvPageAside {
  constructor() {
    if (!isDevMode()) {
      return;
    }
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    // Warned from the region, not from the parent: a parent cannot introspect
    // a projected template to tell an author their landmark has no name, and
    // by the time it could the markup is somewhere else in the file.
    afterNextRender(() => {
      const isLandmark =
        host.tagName === 'ASIDE' ||
        host.getAttribute('role') === 'complementary';
      if (!isLandmark) {
        console.warn(
          '[mlvPageAside] renders a complementary landmark. Put it on an ' +
            '<aside> element (or add role="complementary") so it is one.',
        );
        return;
      }
      const named =
        !!host.getAttribute('aria-label')?.trim() ||
        !!host.getAttribute('aria-labelledby')?.trim();
      if (!named) {
        console.warn(
          '[mlvPageAside] a complementary landmark needs an accessible name ' +
            'to be distinguishable from the page. Add aria-label or ' +
            'aria-labelledby.',
        );
      }
    });
  }
}
