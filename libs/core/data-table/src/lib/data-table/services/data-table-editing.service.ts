import { Injectable, signal } from '@angular/core';

/**
 * Component-scoped editing state for `mlv-data-table`. Holds the per-row
 * snapshot map used for rollback on cancel and tracks whether a given row
 * index is currently in edit mode. The component delegates `startEdit` /
 * `saveEdit` / `cancelEdit` to this service and emits the matching outputs
 * itself.
 *
 * Provided per-component via `providers: [MlvDataTableEditingService]` so each
 * `mlv-data-table` instance has its own isolated editing state.
 */
@Injectable()
export class MlvDataTableEditingService<T = Record<string, unknown>> {
  /** @private Map of row-index → original row snapshot (for rollback). */
  private readonly _editingRows = signal<Map<number, T>>(new Map());

  /** Whether any row is currently being edited. */
  isEditing(index: number): boolean {
    return this._editingRows().has(index);
  }

  /** Whether at least one row is currently being edited. */
  hasActiveEdit(): boolean {
    return this._editingRows().size > 0;
  }

  /**
   * Begin editing the given row. Stores a shallow clone in the rollback map.
   * Returns the cloned snapshot for the caller to emit on `rowEditStart`.
   */
  start(row: T, index: number): T {
    const snapshot = { ...row } as T;
    const map = new Map(this._editingRows());
    map.set(index, snapshot);
    this._editingRows.set(map);
    return snapshot;
  }

  /**
   * Confirm edits for the given row. Returns the original snapshot (or the
   * row itself if no snapshot was stored) so the caller can include it on
   * the `rowEditSave` payload.
   */
  save(row: T, index: number): T {
    const original = this._editingRows().get(index) ?? row;
    const map = new Map(this._editingRows());
    map.delete(index);
    this._editingRows.set(map);
    return original;
  }

  /**
   * Cancel editing the given row. Drops the snapshot. The caller is
   * responsible for restoring the row data if it wants rollback semantics.
   */
  cancel(index: number): void {
    const map = new Map(this._editingRows());
    map.delete(index);
    this._editingRows.set(map);
  }
}
