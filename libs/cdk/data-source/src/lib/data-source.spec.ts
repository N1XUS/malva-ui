import { computed, signal } from '@angular/core';
import type { Signal } from '@angular/core';
import { MlvDataSource } from './data-source';

class StubSource extends MlvDataSource<number> {
  readonly totalItems = computed(() => 0);
  connect(): Signal<number[]> {
    return signal<number[]>([]);
  }
  /** Test hook exposing the protected loading writer. */
  setLoading(value: boolean): void {
    this._loading.set(value);
  }
}

describe('MlvDataSource (base)', () => {
  it('starts not loading and exposes a readonly loading signal', () => {
    const ds = new StubSource();
    expect(ds.loading()).toBe(false);
    ds.setLoading(true);
    expect(ds.loading()).toBe(true);
  });

  it('defaults page to 1 and perPage to 10', () => {
    const ds = new StubSource();
    expect(ds.page()).toBe(1);
    expect(ds.perPage()).toBe(10);
  });

  it('resets page to 1 on setSearch / setSort / setFilters / setPerPage', () => {
    const ds = new StubSource();
    ds.setPage(3);
    ds.setSearch({ query: 'a', keys: [] });
    expect(ds.page()).toBe(1);
    ds.setPage(3);
    ds.setSort({ key: 'x', direction: 'asc' });
    expect(ds.page()).toBe(1);
    ds.setPage(3);
    ds.setFilters([]);
    expect(ds.page()).toBe(1);
    ds.setPage(3);
    ds.setPerPage(25);
    expect(ds.page()).toBe(1);
  });

  it('copies the search keys defensively', () => {
    const ds = new StubSource();
    const keys = ['a'];
    ds.setSearch({ query: 'q', keys });
    keys.push('b');
    expect(ds.search()?.keys).toEqual(['a']);
  });
});
