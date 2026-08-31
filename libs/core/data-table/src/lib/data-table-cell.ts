import { Directive, TemplateRef, inject, input } from '@angular/core';
import type { MlvDataSource } from './data-source';

/** Context for DataTableCell templates */
export interface MlvDataTableCellContext<T> {
  $implicit: T;
  row: T;
  index: number;
}

/**
 * Structural directive for providing custom cell templates with full type inference.
 *
 * Usage (asterisk shorthand — preferred):
 * ```html
 * <mlv-data-table [data]="employees" [columns]="columns">
 *   <span *mlvDataTableCell="'salary'; let row from employees">
 *     {{ row.salary.toLocaleString() }}
 *   </span>
 * </mlv-data-table>
 * ```
 *
 * Usage (explicit ng-template):
 * ```html
 * <ng-template mlvDataTableCell="salary" [mlvDataTableCellFrom]="employees" let-row>
 *   <span>{{ row.salary.toLocaleString() }}</span>
 * </ng-template>
 * ```
 */
@Directive({
  selector: '[mlvDataTableCell]',
})
export class MlvDataTableCell<T extends object = Record<string, unknown>> {
  /** Column key this template applies to — typed as `keyof T` when `from` is provided. */
  readonly columnKey = input.required<keyof T & string>({
    alias: 'mlvDataTableCell',
  });

  /**
   * Pass the same value as `[data]` on the parent `mlv-data-table`.
   * Angular uses this to infer `T` and type `let-row` in the template.
   */
  readonly from = input<T[] | MlvDataSource<T> | undefined>(undefined, {
    alias: 'mlvDataTableCellFrom',
  });

  readonly templateRef =
    inject<TemplateRef<MlvDataTableCellContext<T>>>(TemplateRef);

  /** Narrows the template context to `MlvDataTableCellContext<T>` for type-safe `let-row`. */
  static ngTemplateContextGuard<T extends object>(
    _dir: MlvDataTableCell<T>,
    _ctx: unknown,
  ): _ctx is MlvDataTableCellContext<T> {
    return true;
  }

  /** Enables `*mlvDataTableCell="'key'; let row from data"` microsyntax. */
  static ngTemplateGuard_mlvDataTableCellFrom: 'binding';
}
