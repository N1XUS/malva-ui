import { Directive, TemplateRef, inject } from '@angular/core';

/**
 * Directive for the footer summary row slot.
 *
 * The template context provides `{ $implicit: columns }` where `columns`
 * is the current visible column list.
 *
 * Usage:
 * ```html
 * <mlv-data-table ...>
 *   <ng-template mlvDataTableFooter let-cols>
 *     <th scope="row" [attr.colspan]="cols.length - 1">Total</th>
 *     <td>...</td>
 *   </ng-template>
 * </mlv-data-table>
 * ```
 *
 * Direct `th` and `td` children receive the table's density, divider, sticky
 * surface, and bordered-cell styling without private component classes.
 */
@Directive({
  selector: '[mlvDataTableFooter]',
})
export class MlvDataTableFooter {
  readonly templateRef = inject(TemplateRef);
}
