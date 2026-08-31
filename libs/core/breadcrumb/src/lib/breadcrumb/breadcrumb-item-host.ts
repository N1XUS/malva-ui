import { Directive } from '@angular/core';

/**
 * Attribute directive that can be applied to any `<a>` or `<li>` element as an
 * alternative to using the `<mlv-breadcrumb-item>` component. Applies the
 * correct BEM classes without replacing the native element.
 *
 * Use this when you need to preserve native element semantics (e.g., when
 * working with a router `<a>` element inside a list item, or when composing
 * with third-party link components).
 *
 * @example Applied to a native anchor inside an `<li>`
 * ```html
 * <nav mlvBreadcrumb>
 *   <ol class="mlv-breadcrumb__list">
 *     <li mlvBreadcrumbItem class="mlv-breadcrumb__item">
 *       <a mlvBreadcrumbItem class="mlv-breadcrumb__link" href="/">Home</a>
 *     </li>
 *   </ol>
 * </nav>
 * ```
 *
 * @example Applied to a `<li>` element
 * ```html
 * <li mlvBreadcrumbItem>
 *   <a class="mlv-breadcrumb__link" href="/products">Products</a>
 * </li>
 * ```
 */
@Directive({
  selector: '[mlvBreadcrumbItem]',
  host: {
    class: 'mlv-breadcrumb__item',
  },
})
export class MlvBreadcrumbItemHost {}
