import { describe, expect, it } from 'vitest';
import { runScaleQuery } from './scale-engine';
import { generateScaleRows } from './scale-dataset';
import { SCALE_ALL_ROWS } from './scale-protocol';
import type { ScaleQueryState, ScaleRow } from './scale-protocol';

const row = (id: number, patch: Partial<ScaleRow> = {}): ScaleRow => ({
  id,
  ref: `ACC-${String(id).padStart(6, '0')}`,
  account: `Account ${id}`,
  owner: 'Dana Reyes',
  region: 'EMEA',
  industry: 'Software',
  plan: 'Growth',
  status: 'active',
  seats: 10,
  arr: 1000,
  health: 50,
  renewalDate: '2026-03-01',
  ...patch,
});

const state = (patch: Partial<ScaleQueryState> = {}): ScaleQueryState => ({
  sort: null,
  filters: [],
  search: null,
  page: 1,
  perPage: SCALE_ALL_ROWS,
  ...patch,
});

describe('runScaleQuery — paging', () => {
  const rows = Array.from({ length: 25 }, (_, index) => row(index + 1));

  it('returns the requested 1-based page slice', () => {
    const result = runScaleQuery(rows, state({ page: 2, perPage: 10 }));
    expect(result.rows.map((r) => r.id)).toEqual([
      11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    ]);
  });

  it('returns a short final page', () => {
    const result = runScaleQuery(rows, state({ page: 3, perPage: 10 }));
    expect(result.rows.map((r) => r.id)).toEqual([21, 22, 23, 24, 25]);
  });

  it('returns nothing past the end', () => {
    expect(runScaleQuery(rows, state({ page: 9, perPage: 10 })).rows).toEqual(
      [],
    );
  });

  it('reports the pre-paging total, not the slice length', () => {
    const result = runScaleQuery(rows, state({ page: 2, perPage: 10 }));
    expect(result.total).toBe(25);
    expect(result.rows).toHaveLength(10);
  });

  it('skips slicing entirely for the table’s virtual-scroll page size', () => {
    const result = runScaleQuery(rows, state({ perPage: SCALE_ALL_ROWS }));
    expect(result.rows).toHaveLength(25);
    expect(result.total).toBe(25);
  });

  it('skips slicing for a non-finite page size', () => {
    expect(
      runScaleQuery(rows, state({ perPage: Number.POSITIVE_INFINITY })).rows,
    ).toHaveLength(25);
  });

  it('slices a page straight out of the caller’s array, copying nothing', () => {
    // A page click on a query with no sort, search or filter used to copy the
    // whole dataset and then throw the copy away one line later — 8 MB of
    // references per click at a million rows.
    const result = runScaleQuery(rows, state({ page: 2, perPage: 10 }));
    expect(result.rows).toHaveLength(10);
    expect(result.rows[0]).toBe(rows[10]);
  });

  it('still hands back a copy when an unpaged query returns the whole array', () => {
    // The unpaged branch is the only one that would otherwise return the
    // caller's own array, so it is the only one that pays for a copy.
    const result = runScaleQuery(rows, state({ perPage: SCALE_ALL_ROWS }));
    expect(result.rows).not.toBe(rows);
    expect(result.rows).toEqual(rows);
  });

  it('reports a finite, non-negative compute cost', () => {
    const result = runScaleQuery(rows, state());
    expect(Number.isFinite(result.computeMs)).toBe(true);
    expect(result.computeMs).toBeGreaterThanOrEqual(0);
  });
});

describe('runScaleQuery — search', () => {
  const rows = [
    row(1, { account: 'Northwind Trading', owner: 'Ada Lovelace' }),
    row(2, { account: 'Zürich Logistics', owner: 'Bo Chen' }),
    row(3, { account: 'Southwind Media', owner: 'Northwind Holdings' }),
  ];

  it('ORs the query across the supplied keys', () => {
    const result = runScaleQuery(
      rows,
      state({ search: { query: 'northwind', keys: ['account', 'owner'] } }),
    );
    expect(result.rows.map((r) => r.id)).toEqual([1, 3]);
    expect(result.total).toBe(2);
  });

  it('only reads the keys it was given', () => {
    const result = runScaleQuery(
      rows,
      state({ search: { query: 'northwind', keys: ['account'] } }),
    );
    expect(result.rows.map((r) => r.id)).toEqual([1]);
  });

  it('ignores case and diacritics', () => {
    const result = runScaleQuery(
      rows,
      state({ search: { query: 'ZURICH', keys: ['account'] } }),
    );
    expect(result.rows.map((r) => r.id)).toEqual([2]);
  });

  it('treats a whitespace-only query as no search', () => {
    const result = runScaleQuery(
      rows,
      state({ search: { query: '   ', keys: ['account'] } }),
    );
    expect(result.rows).toHaveLength(3);
  });

  it('matches numeric columns by their string form', () => {
    const result = runScaleQuery(
      rows,
      state({ search: { query: '000002', keys: ['ref'] } }),
    );
    expect(result.rows.map((r) => r.id)).toEqual([2]);
  });

  it('returns nothing when no key matches', () => {
    const result = runScaleQuery(
      rows,
      state({ search: { query: 'zzz', keys: ['account', 'owner'] } }),
    );
    expect(result.rows).toEqual([]);
    expect(result.total).toBe(0);
  });
});

describe('runScaleQuery — filters', () => {
  const rows = [
    row(1, { region: 'EMEA', plan: 'Growth', arr: 100 }),
    row(2, { region: 'APAC', plan: 'Enterprise', arr: 200 }),
    row(3, { region: 'EMEA', plan: 'Enterprise', arr: 300 }),
  ];

  it('applies equals', () => {
    const result = runScaleQuery(
      rows,
      state({
        filters: [{ key: 'region', operator: 'equals', value: 'EMEA' }],
      }),
    );
    expect(result.rows.map((r) => r.id)).toEqual([1, 3]);
  });

  it('applies not-equals', () => {
    const result = runScaleQuery(
      rows,
      state({
        filters: [{ key: 'region', operator: 'not-equals', value: 'EMEA' }],
      }),
    );
    expect(result.rows.map((r) => r.id)).toEqual([2]);
  });

  it('applies contains and not-contains case-insensitively', () => {
    expect(
      runScaleQuery(
        rows,
        state({
          filters: [{ key: 'plan', operator: 'contains', value: 'enter' }],
        }),
      ).rows.map((r) => r.id),
    ).toEqual([2, 3]);
    expect(
      runScaleQuery(
        rows,
        state({
          filters: [{ key: 'plan', operator: 'not-contains', value: 'enter' }],
        }),
      ).rows.map((r) => r.id),
    ).toEqual([1]);
  });

  it('applies in and not-in', () => {
    expect(
      runScaleQuery(
        rows,
        state({
          filters: [
            { key: 'region', operator: 'in', value: ['APAC', 'LATAM'] },
          ],
        }),
      ).rows.map((r) => r.id),
    ).toEqual([2]);
    expect(
      runScaleQuery(
        rows,
        state({
          filters: [
            { key: 'region', operator: 'not-in', value: ['APAC', 'LATAM'] },
          ],
        }),
      ).rows.map((r) => r.id),
    ).toEqual([1, 3]);
  });

  it('ANDs multiple filters together', () => {
    const result = runScaleQuery(
      rows,
      state({
        filters: [
          { key: 'region', operator: 'equals', value: 'EMEA' },
          { key: 'plan', operator: 'equals', value: 'Enterprise' },
        ],
      }),
    );
    expect(result.rows.map((r) => r.id)).toEqual([3]);
  });

  it('ANDs filters with the global search', () => {
    const result = runScaleQuery(
      rows,
      state({
        search: { query: 'Account', keys: ['account'] },
        filters: [{ key: 'region', operator: 'equals', value: 'APAC' }],
      }),
    );
    expect(result.rows.map((r) => r.id)).toEqual([2]);
  });

  it('drops every row when in/not-in is handed a non-array comparand', () => {
    expect(
      runScaleQuery(
        rows,
        state({ filters: [{ key: 'region', operator: 'in', value: 'EMEA' }] }),
      ).rows,
    ).toEqual([]);
  });
});

describe('runScaleQuery — sort', () => {
  const rows = [
    row(1, { account: 'item10', arr: 300 }),
    row(2, { account: 'item2', arr: 100 }),
    row(3, { account: 'item1', arr: 200 }),
  ];

  it('sorts numeric columns numerically', () => {
    expect(
      runScaleQuery(
        rows,
        state({ sort: { key: 'arr', direction: 'asc' } }),
      ).rows.map((r) => r.id),
    ).toEqual([2, 3, 1]);
    expect(
      runScaleQuery(
        rows,
        state({ sort: { key: 'arr', direction: 'desc' } }),
      ).rows.map((r) => r.id),
    ).toEqual([1, 3, 2]);
  });

  it('sorts string columns with natural numeric collation', () => {
    expect(
      runScaleQuery(
        rows,
        state({ sort: { key: 'account', direction: 'asc' } }),
      ).rows.map((r) => r.id),
    ).toEqual([3, 2, 1]);
  });

  it('is stable for equal keys', () => {
    const tied = [
      row(1, { plan: 'A' }),
      row(2, { plan: 'A' }),
      row(3, { plan: 'A' }),
    ];
    expect(
      runScaleQuery(
        tied,
        state({ sort: { key: 'plan', direction: 'asc' } }),
      ).rows.map((r) => r.id),
    ).toEqual([1, 2, 3]);
  });

  it('sorts before paging, not within the page', () => {
    const many = Array.from({ length: 30 }, (_, index) =>
      row(index + 1, { arr: 1000 - index }),
    );
    const result = runScaleQuery(
      many,
      state({ sort: { key: 'arr', direction: 'asc' }, page: 1, perPage: 3 }),
    );
    expect(result.rows.map((r) => r.id)).toEqual([30, 29, 28]);
    expect(result.total).toBe(30);
  });

  it('never mutates the array it was given', () => {
    const source = generateScaleRows(6, 50);
    const before = source.map((r) => r.id);
    runScaleQuery(source, state({ sort: { key: 'arr', direction: 'desc' } }));
    expect(source.map((r) => r.id)).toEqual(before);
  });
});

describe('runScaleQuery — tree rows', () => {
  it('filters, sorts and pages top-level rows only, carrying children along', () => {
    const rows: ScaleRow[] = [
      row(1, { arr: 300, _mlvChildren: [row(11, { arr: 1, region: 'APAC' })] }),
      row(2, { arr: 100, _mlvChildren: [row(12, { arr: 2, region: 'APAC' })] }),
    ];
    const result = runScaleQuery(
      rows,
      state({
        sort: { key: 'arr', direction: 'asc' },
        filters: [{ key: 'region', operator: 'equals', value: 'EMEA' }],
      }),
    );
    expect(result.rows.map((r) => r.id)).toEqual([2, 1]);
    expect(result.total).toBe(2);
    expect(result.rows[0]._mlvChildren?.map((c) => c.id)).toEqual([12]);
  });
});
