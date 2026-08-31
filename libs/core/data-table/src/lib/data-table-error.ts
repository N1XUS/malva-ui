import { Directive, TemplateRef, inject } from '@angular/core';

/**
 * Template context handed to a `mlvDataTableError` template.
 */
export interface MlvDataTableErrorContext {
  /** Resolved error message — the `error` string, or the localized default. */
  $implicit: string;
  /** Invoke to emit the table's `(retry)` output. */
  retry: () => void;
}

/**
 * Directive for the "request failed" slot. Rendered in place of the table body
 * whenever `[error]` is truthy and the table is not loading, so a failed request
 * is never mistaken for an empty result set.
 *
 * Usage:
 * ```html
 * <mlv-data-table [data]="rows()" [columns]="columns" [error]="error()" (retry)="reload()">
 *   <ng-template mlvDataTableError let-message let-retry="retry">
 *     <p>{{ message }}</p>
 *     <button mlvButton variant="secondary" type="button" (click)="retry()">Try again</button>
 *   </ng-template>
 * </mlv-data-table>
 * ```
 */
@Directive({
  selector: '[mlvDataTableError]',
})
export class MlvDataTableError {
  /** The projected template rendered instead of the default error block. */
  readonly templateRef = inject(TemplateRef<MlvDataTableErrorContext>);

  /**
   * Type guard so Angular narrows `let-message` / `let-retry="retry"` to
   * {@link MlvDataTableErrorContext} in strict templates.
   */
  static ngTemplateContextGuard(
    _dir: MlvDataTableError,
    _ctx: unknown,
  ): _ctx is MlvDataTableErrorContext {
    return true;
  }
}
