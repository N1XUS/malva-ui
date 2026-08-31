import { Injectable, signal } from '@angular/core';

/**
 * Tracks the user-toggled column hidden set for `mlv-data-table`.
 * The component reads `isHidden(key)` while building `visibleColumns`
 * and calls `toggle(key)` when the user clicks the column-visibility
 * popup checkbox.
 */
@Injectable()
export class MlvDataTableColumnVisibilityService {
  /** @private Set of currently-hidden column keys. */
  private readonly _hiddenColumns = signal<Set<string>>(new Set());

  /** Read-only signal exposing the hidden-set for `effect()` consumers. */
  readonly hiddenColumns = this._hiddenColumns.asReadonly();

  /** Whether a column is currently hidden by the user. */
  isHidden(key: string): boolean {
    return this._hiddenColumns().has(key);
  }

  /** Toggle visibility of a hideable column. */
  toggle(key: string): void {
    const current = this._hiddenColumns();
    const next = new Set(current);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this._hiddenColumns.set(next);
  }

  /** Replaces the hidden set with a cloned, pre-normalized key collection. */
  replaceHiddenColumns(keys: ReadonlySet<string>): void {
    this._hiddenColumns.set(new Set(keys));
  }
}
