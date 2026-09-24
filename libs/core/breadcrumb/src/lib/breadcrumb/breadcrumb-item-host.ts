import { Directive } from '@angular/core';

/**
 * Attribute directive that stamps the `mlv-breadcrumb__item` class on a native
 * element — the alternative to `<mlv-breadcrumb-item>` when a crumb's markup
 * has to stay your own (a router `<a>` carrying other directives, a
 * third-party link component). It renders nothing and sets no role.
 *
 * Put it on `<li>` elements projected **straight into** `nav[mlvBreadcrumb]`.
 * The breadcrumb renders the `<ol>` itself, so do not write one: a second
 * `<ol>` nests `ol > ol`, and the outer list's only child is then not an
 * `<li>` (axe `list`, serious, WCAG 1.3.1).
 *
 * The markup inside each `<li>` is yours, separator included — unlike
 * `<mlv-breadcrumb-item>`, a native `<li>` does not stamp the breadcrumb's
 * separator. Use `.mlv-breadcrumb__link` (with `--current` and
 * `aria-current="page"` on the last crumb) and an `aria-hidden`
 * `.mlv-breadcrumb__separator`. Use one shape per trail: an `<li>` placed
 * after `<mlv-breadcrumb-item>`s gets no separator before it.
 *
 * On an `<a>` inside such an `<li>` the directive only adds the class; since
 * it sets no role, it never nests a `listitem` inside a `listitem`.
 *
 * @example Native `<li>`s projected into the breadcrumb's own list
 * ```html
 * <nav mlvBreadcrumb>
 *   <li mlvBreadcrumbItem>
 *     <a class="mlv-breadcrumb__link" href="/">Home</a>
 *     <span class="mlv-breadcrumb__separator" aria-hidden="true">›</span>
 *   </li>
 *   <li mlvBreadcrumbItem>
 *     <span
 *       class="mlv-breadcrumb__link mlv-breadcrumb__link--current"
 *       aria-current="page"
 *     >Products</span>
 *   </li>
 * </nav>
 * ```
 */
@Directive({
  selector: '[mlvBreadcrumbItem]',
  host: {
    class: 'mlv-breadcrumb__item',
  },
})
export class MlvBreadcrumbItemHost {}
