import { Directive, TemplateRef, inject, input } from '@angular/core';
import type { MlvDataSource } from './data-source';

/** Context for DataTableEditCell templates */
export interface MlvDataTableEditCellContext<T> {
  $implicit: T;
  row: T;
  index: number;
}

/**
 * Structural directive for providing custom edit-mode cell templates.
 *
 * When the table is in editable mode and a row enters editing, this template
 * replaces the display template for the given column key.
 *
 * Usage (asterisk shorthand):
 * ```html
 * <mlv-input *mlvDataTableEditCell="'name'; let row from employees"
 *   [ngModel]="row.name" (ngModelChange)="row.name = $event" />
 * ```
 *
 * Usage (explicit ng-template):
 * ```html
 * <ng-template mlvDataTableEditCell="name" [mlvDataTableEditCellFrom]="employees" let-row>
 *   <mlv-input [ngModel]="row.name" (ngModelChange)="row.name = $event" />
 * </ng-template>
 * ```
 */
@Directive({
  selector: '[mlvDataTableEditCell]',
})
export class MlvDataTableEditCell<T extends object = Record<string, unknown>> {
  /** Column key this edit template applies to. */
  readonly columnKey = input.required<keyof T & string>({
    alias: 'mlvDataTableEditCell',
  });

  /**
   * Pass the same value as `[data]` on the parent `mlv-data-table`.
   * Angular uses this to infer `T` and type `let-row` in the template.
   */
  readonly from = input<T[] | MlvDataSource<T> | undefined>(undefined, {
    alias: 'mlvDataTableEditCellFrom',
  });

  readonly templateRef =
    inject<TemplateRef<MlvDataTableEditCellContext<T>>>(TemplateRef);

  /** Narrows the template context to `MlvDataTableEditCellContext<T>` for type-safe `let-row`. */
  static ngTemplateContextGuard<T extends object>(
    _dir: MlvDataTableEditCell<T>,
    _ctx: unknown,
  ): _ctx is MlvDataTableEditCellContext<T> {
    return true;
  }

  /** Enables `*mlvDataTableEditCell="'key'; let row from data"` microsyntax. */
  static ngTemplateGuard_mlvDataTableEditCellFrom: 'binding';
}
