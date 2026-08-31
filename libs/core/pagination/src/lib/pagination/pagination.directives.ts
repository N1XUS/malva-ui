import { Directive } from '@angular/core';
import { MlvStructural } from '@malva-ui/cdk/utils';

/**
 * Replaces the item-count text of `mlv-pagination` with a projected template.
 *
 * Receives `MlvPagination.getCellContext()`: `$implicit` is the current page,
 * plus `total`, `start`, `end` and `options`.
 *
 * @example
 * ```html
 * <mlv-pagination [totalItems]="total" [(currentPage)]="page">
 *   <ng-template mlvPaginationCount let-page let-total="total">
 *     Page {{ page }} · {{ total }} records
 *   </ng-template>
 * </mlv-pagination>
 * ```
 */
@Directive({
  selector: '[mlvPaginationCount]',
})
export class MlvPaginationCount extends MlvStructural {}

/**
 * Replaces the whole items-per-page selector of `mlv-pagination` — the trigger
 * button *and* its dropdown — with a projected template. Rendered only while
 * there is more than one per-page option to offer.
 *
 * Receives the same context as {@link MlvPaginationCount}. The template owns the
 * entire interaction, so it must call `setItemsPerPage()` itself.
 *
 * @example
 * ```html
 * <mlv-pagination #p [totalItems]="total" [(currentPage)]="page">
 *   <ng-template mlvPaginationPerPageItem let-options="options">
 *     @for (option of options; track option) {
 *       <button type="button" (click)="p.setItemsPerPage(option)">{{ option }}</button>
 *     }
 *   </ng-template>
 * </mlv-pagination>
 * ```
 */
@Directive({
  selector: '[mlvPaginationPerPageItem]',
})
export class MlvPaginationPerPageItem extends MlvStructural {}
