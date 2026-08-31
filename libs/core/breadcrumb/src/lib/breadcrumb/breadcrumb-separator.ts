import { Directive, inject, TemplateRef } from '@angular/core';

/**
 * Structural directive that marks an `<ng-template>` as a custom separator
 * to be rendered between breadcrumb items.
 *
 * When no `[mlvSeparator]` directive is present inside `nav[mlvBreadcrumb]`,
 * the component falls back to a `LucideChevronRight` icon.
 *
 * @example Custom text separator
 * ```html
 * <nav mlvBreadcrumb [items]="items">
 *   <ng-template mlvSeparator>›</ng-template>
 * </nav>
 * ```
 *
 * @example Custom icon separator
 * ```html
 * <nav mlvBreadcrumb [items]="items">
 *   <ng-template mlvSeparator>
 *     <svg lucideSlash [size]="14" />
 *   </ng-template>
 * </nav>
 * ```
 */
@Directive({
  selector: '[mlvSeparator]',
})
export class MlvBreadcrumbSeparator {
  /** The template reference for the custom separator content. */
  readonly templateRef = inject(TemplateRef);
}
