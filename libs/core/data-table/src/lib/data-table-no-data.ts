import { Directive, TemplateRef, inject } from '@angular/core';

/**
 * Directive for the "no data" slot.
 *
 * Usage:
 * ```html
 * <mlv-data-table ...>
 *   <ng-template mlvDataTableNoData>
 *     <p>No records found.</p>
 *   </ng-template>
 * </mlv-data-table>
 * ```
 */
@Directive({
  selector: '[mlvDataTableNoData]',
})
export class MlvDataTableNoData {
  readonly templateRef = inject(TemplateRef);
}
