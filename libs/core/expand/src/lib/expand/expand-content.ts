import { Directive, inject, TemplateRef } from '@angular/core';

/**
 * Marks an `<ng-template>` as the lazy content for a `mlv-expand` panel.
 *
 * Nothing inside the template is constructed until the panel first opens, so a
 * heavy child component in a panel the user never expands is never initialized.
 * The template is re-instantiated on each subsequent open — it is not cached —
 * because `mlv-expand` removes its body from the DOM while closed.
 *
 * @example
 * ```html
 * <button type="button" (click)="panel.toggle()">Load on demand</button>
 * <mlv-expand #panel>
 *   <ng-template mlvExpandContent>
 *     <heavy-component />
 *   </ng-template>
 * </mlv-expand>
 * ```
 */
@Directive({
  selector: '[mlvExpandContent]',
})
export class MlvExpandContent {
  /** The template reference rendered once the panel first opens. */
  readonly templateRef = inject(TemplateRef);
}
