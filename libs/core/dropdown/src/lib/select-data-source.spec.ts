import { signal } from '@angular/core';
import { MlvSelectDataSource } from './select-data-source';

describe('MlvSelectDataSource', () => {
  const items = Array.from({ length: 25 }, (_, i) => `Item ${i + 1}`);

  it('is unpaged by default (perPage = Infinity)', () => {
    const ds = new MlvSelectDataSource(items);
    expect(ds.perPage()).toBe(Infinity);
    expect(ds.connect()().length).toBe(25);
    expect(ds.totalItems()).toBe(25);
  });

  it('searches natural fields with empty keys', () => {
    const ds = new MlvSelectDataSource(items);
    ds.setSearch({ query: 'item 2', keys: [] });
    expect(ds.connect()()).toEqual([
      'Item 2',
      'Item 20',
      'Item 21',
      'Item 22',
      'Item 23',
      'Item 24',
      'Item 25',
    ]);
  });

  it('follows a signal-backed array', () => {
    const data = signal(['a']);
    const ds = new MlvSelectDataSource(data);
    data.set(['a', 'b']);
    expect(ds.connect()()).toEqual(['a', 'b']);
  });

  it('never reports loading', () => {
    expect(new MlvSelectDataSource(items).loading()).toBe(false);
  });

  it('can still be paged by a consumer that pushes setPerPage', () => {
    const ds = new MlvSelectDataSource(items);
    ds.setPerPage(10);
    expect(ds.connect()().length).toBe(10);
  });
});
