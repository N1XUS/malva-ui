import { signal } from '@angular/core';
import { MlvArrayDataSource } from './array-data-source';

interface Row {
  id: number;
  name: string;
  status: string | null;
  internal: string;
}

const rows: Row[] = [
  { id: 1, name: 'Café phone', status: 'Draft', internal: 'secret-a' },
  { id: 2, name: 'Beta tablet', status: 'Published', internal: 'secret-b' },
  { id: 30, name: 'Gamma screen', status: null, internal: 'find-me' },
];

describe('MlvArrayDataSource search', () => {
  it('matches case-insensitively across configured keys with OR semantics', () => {
    const source = new MlvArrayDataSource(rows);

    source.setSearch({ query: '  PUBLISH  ', keys: ['name', 'status'] });
    expect(
      source
        .connect()()
        .map((row) => row.id),
    ).toEqual([2]);

    source.setSearch({ query: 'phone', keys: ['name', 'status'] });
    expect(
      source
        .connect()()
        .map((row) => row.id),
    ).toEqual([1]);
  });

  it('matches search and contains filters without requiring typed diacritics', () => {
    const source = new MlvArrayDataSource(rows);

    source.setSearch({ query: 'cafe', keys: ['name'] });
    expect(
      source
        .connect()()
        .map((row) => row.id),
    ).toEqual([1]);

    source.setSearch(null);
    source.setFilters([{ key: 'name', operator: 'contains', value: 'CAFE' }]);
    expect(
      source
        .connect()()
        .map((row) => row.id),
    ).toEqual([1]);
  });

  it('does not inspect undeclared or internal row properties', () => {
    const source = new MlvArrayDataSource(rows);

    source.setSearch({ query: 'find-me', keys: ['name', 'status'] });
    expect(source.connect()()).toEqual([]);
  });

  it('normalizes numeric and null values without throwing', () => {
    const source = new MlvArrayDataSource(rows);

    source.setSearch({ query: '30', keys: ['id', 'status'] });
    expect(
      source
        .connect()()
        .map((row) => row.id),
    ).toEqual([30]);

    source.setSearch({ query: 'null', keys: ['status'] });
    expect(source.connect()()).toEqual([]);
  });

  it('ANDs global search with column filters before pagination', () => {
    const source = new MlvArrayDataSource(rows);
    source.setPerPage(1);
    source.setSearch({ query: 'a', keys: ['name'] });
    source.setFilters([
      { key: 'status', operator: 'in', value: ['Draft', 'Published'] },
    ]);

    expect(source.totalItems()).toBe(2);
    expect(
      source
        .connect()()
        .map((row) => row.id),
    ).toEqual([1]);

    source.setPage(2);
    expect(
      source
        .connect()()
        .map((row) => row.id),
    ).toEqual([2]);
  });

  it('evaluates in and not-in filters as value membership', () => {
    const source = new MlvArrayDataSource(rows);

    source.setFilters([
      { key: 'status', operator: 'in', value: ['Draft', 'Published'] },
    ]);
    expect(
      source
        .connect()()
        .map((row) => row.id),
    ).toEqual([1, 2]);

    source.setFilters([
      { key: 'status', operator: 'not-in', value: ['Published'] },
    ]);
    expect(
      source
        .connect()()
        .map((row) => row.id),
    ).toEqual([1, 30]);
  });

  it('resets page and reacts to signal-backed data', () => {
    const data = signal(rows);
    const source = new MlvArrayDataSource(data);
    source.setPerPage(1);
    source.setPage(3);

    source.setSearch({ query: 'beta', keys: ['name'] });
    expect(source.page()).toBe(1);
    expect(
      source
        .connect()()
        .map((row) => row.id),
    ).toEqual([2]);

    data.set([{ id: 4, name: 'Beta watch', status: 'Draft', internal: '' }]);
    expect(source.totalItems()).toBe(1);
    expect(
      source
        .connect()()
        .map((row) => row.id),
    ).toEqual([4]);
  });

  it('resets pagination when column filters change', () => {
    const source = new MlvArrayDataSource(rows);
    source.setPage(3);

    source.setFilters([{ key: 'status', operator: 'equals', value: 'Draft' }]);

    expect(source.page()).toBe(1);
    expect(
      source
        .connect()()
        .map((row) => row.id),
    ).toEqual([1]);
  });

  it('disables search for whitespace-only or null state', () => {
    const source = new MlvArrayDataSource(rows);

    source.setSearch({ query: '   ', keys: ['name'] });
    expect(source.totalItems()).toBe(3);

    source.setSearch(null);
    expect(source.connect()).toBeTypeOf('function');
    expect(source.totalItems()).toBe(3);
  });
});

describe('MlvArrayDataSource natural-field search (empty keys)', () => {
  it('matches primitives against their string form when keys are empty', () => {
    const source = new MlvArrayDataSource(['Apple', 'Banana', 'Café']);
    source.setPerPage(Infinity);
    source.setSearch({ query: 'cafe', keys: [] });
    expect(source.connect()()).toEqual(['Café']);
    source.setSearch({ query: 'AN', keys: [] });
    expect(source.connect()()).toEqual(['Banana']);
  });

  it('matches objects against every own primitive value when keys are empty', () => {
    const source = new MlvArrayDataSource(rows);
    source.setSearch({ query: 'find-me', keys: [] });
    expect(
      source
        .connect()()
        .map((r) => r.id),
    ).toEqual([30]);
    source.setSearch({ query: '30', keys: [] });
    expect(
      source
        .connect()()
        .map((r) => r.id),
    ).toEqual([30]);
  });

  it('still ignores undeclared keys when keys are provided', () => {
    const source = new MlvArrayDataSource(rows);
    source.setSearch({ query: 'find-me', keys: ['name'] });
    expect(source.connect()()).toEqual([]);
  });
});

describe('MlvArrayDataSource paging', () => {
  it('keeps perPage 10 by default', () => {
    const source = new MlvArrayDataSource(
      Array.from({ length: 12 }, (_, i) => i),
    );
    expect(source.perPage()).toBe(10);
    expect(source.connect()().length).toBe(10);
  });
});

describe('MlvArrayDataSource nullish rows', () => {
  it('reads keyed properties off a nullish row as undefined instead of throwing', () => {
    const source = new MlvArrayDataSource<string | null>(['a', null]);

    source.setSearch({ query: 'a', keys: ['x'] });

    expect(() => source.connect()()).not.toThrow();
    expect(source.connect()()).toEqual([]);
    expect(source.totalItems()).toBe(0);
  });

  it('filters a nullish row on a missing key instead of throwing', () => {
    const source = new MlvArrayDataSource<string | null>(['a', null]);

    source.setFilters([{ key: 'x', operator: 'equals', value: undefined }]);

    expect(() => source.connect()()).not.toThrow();
    expect(source.connect()()).toEqual(['a', null]);
  });

  it('sorts an array containing null without throwing', () => {
    const source = new MlvArrayDataSource<{ id: number } | null>([
      { id: 2 },
      null,
      { id: 1 },
    ]);

    source.setSort({ key: 'id', direction: 'asc' });

    expect(() => source.connect()()).not.toThrow();
    expect(source.connect()()).toEqual([null, { id: 1 }, { id: 2 }]);
  });
});
