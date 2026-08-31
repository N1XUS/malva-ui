import { Directive, TemplateRef, inject } from '@angular/core';

/**
 * Optional host-owned actions projected into the Data Table's single toolbar.
 * The template renders after all table-owned controls.
 */
@Directive({ selector: 'ng-template[mlvDataTableToolbarActions]' })
export class MlvDataTableToolbarActions {
  /** Projected toolbar-actions template rendered by the owning Data Table. */
  readonly templateRef = inject<TemplateRef<unknown>>(TemplateRef);
}
