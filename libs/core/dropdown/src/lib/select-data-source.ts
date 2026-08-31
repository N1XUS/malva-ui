import type { Signal } from '@angular/core';
import { MlvArrayDataSource } from '@malva-ui/cdk/data-source';

/**
 * In-memory data source for option controls (`mlv-select`, `mlv-combobox`,
 * `[mlvAutocomplete]`). Identical to `MlvArrayDataSource` except that it is
 * **unpaged** (`perPage = Infinity`) so the whole list renders; the shared
 * natural-field search (`setSearch({ query, keys: [] })`) and sorting are
 * inherited. Reach for it when you want a data-source-shaped API over an
 * in-memory array (e.g. to swap for a remote subclass later); a plain `T[]`
 * remains the simplest input.
 */
export class MlvSelectDataSource<T> extends MlvArrayDataSource<T> {
  /**
   * @param data A plain array (wrapped in a signal automatically) or a
   * `Signal<T[]>` to track reactively.
   */
  constructor(data: Signal<T[]> | T[]) {
    super(data);
    this._perPage.set(Infinity);
  }
}
