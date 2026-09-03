import { signal } from '@angular/core';
// `vi.mock` below is hoisted above this import, so the oracle runs the exact
// same (counted, behaviourally identical) normalisation the data source runs.
import { normalizeForMatch } from '@malva-ui/cdk/utils';
import type * as MlvCdkUtils from '@malva-ui/cdk/utils';
import { MlvArrayDataSource } from './array-data-source';
import type {
  MlvDataSourceFilterOperator,
  MlvFilterState,
  MlvSearchState,
  MlvSortDirection,
} from './data-source.types';

/**
 * Call counter for `normalizeForMatch`. The performance guards below assert the
 * *number* of normalisations, so the shared util is wrapped rather than
 * replaced — behaviour is byte-identical to the real implementation, which
 * keeps every behavioural test in this file honest. Counting the wrapper (and
 * not `String.prototype.normalize`) also keeps these guards valid once
 * `normalizeForMatch` grows an internal ASCII fast path.
 */
const normalizeCounter = vi.hoisted(() => ({ calls: 0 }));

vi.mock('@malva-ui/cdk/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof MlvCdkUtils>();
  return {
    ...actual,
    normalizeForMatch: (text: string): string => {
      normalizeCounter.calls++;
      return actual.normalizeForMatch(text);
    },
  };
});

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

// ---------------------------------------------------------------------------
// Oracle — a verbatim copy of the pre-cache `_read` / `_matchesQuery` /
// `_applyFilter` / `_filtered` logic. The equivalence suite asserts the
// optimised source still produces exactly this.
// ---------------------------------------------------------------------------

function oracleRead(row: unknown, key: string): unknown {
  return row !== null && typeof row === 'object'
    ? (row as Record<string, unknown>)[key]
    : undefined;
}

function oracleMatchesQuery(
  row: unknown,
  keys: readonly string[],
  normalizedQuery: string,
): boolean {
  if (keys.length > 0) {
    return keys.some((key) =>
      normalizeForMatch(String(oracleRead(row, key) ?? '')).includes(
        normalizedQuery,
      ),
    );
  }
  if (row === null || typeof row !== 'object') {
    return normalizeForMatch(String(row ?? '')).includes(normalizedQuery);
  }
  return Object.values(row as Record<string, unknown>).some(
    (value) =>
      (typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean') &&
      normalizeForMatch(String(value)).includes(normalizedQuery),
  );
}

function oracleApplyFilter(row: unknown, f: MlvFilterState): boolean {
  const val = oracleRead(row, f.key);
  const fval = f.value;
  switch (f.operator) {
    case 'equals':
      return val === fval;
    case 'not-equals':
      return val !== fval;
    case 'contains':
      return normalizeForMatch(String(val ?? '')).includes(
        normalizeForMatch(String(fval ?? '')),
      );
    case 'not-contains':
      return !normalizeForMatch(String(val ?? '')).includes(
        normalizeForMatch(String(fval ?? '')),
      );
    case 'in':
      return Array.isArray(fval) && fval.includes(val);
    case 'not-in':
      return Array.isArray(fval) && !fval.includes(val);
    default:
      return true;
  }
}

function oracleFilter(
  data: readonly unknown[],
  search: MlvSearchState | null,
  filters: readonly MlvFilterState[],
): unknown[] {
  const normalizedQuery = normalizeForMatch(search?.query.trim() ?? '');
  if (!filters.length && !normalizedQuery) return [...data];
  return data.filter((row) => {
    const matchesSearch =
      !normalizedQuery ||
      oracleMatchesQuery(row, search?.keys ?? [], normalizedQuery);
    return matchesSearch && filters.every((f) => oracleApplyFilter(row, f));
  });
}

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
    // The `null` row trails: since #83 a nullish row is an absent record and
    // sinks in both directions. It used to lead under `asc`, because `_read`
    // gave `undefined`, `?? ''` made it `''`, and `''` collates first.
    expect(source.connect()()).toEqual([{ id: 1 }, { id: 2 }, null]);
  });
});

// ---------------------------------------------------------------------------
// Precomputed-haystack equivalence + performance guards
// ---------------------------------------------------------------------------

/** Object rows carrying array / nested-object values the type filter must skip. */
const mixedRows: readonly unknown[] = [
  {
    id: 1,
    name: 'Café Zürich',
    status: 'Draft',
    active: true,
    tags: ['zebra'],
    meta: { owner: 'nadia' },
  },
  {
    id: 2,
    name: 'Beta tablet',
    status: null,
    active: false,
    tags: ['beta'],
    meta: { owner: 'omar' },
  },
  {
    id: 30,
    name: 'Gamma screen',
    status: undefined,
    active: true,
    tags: [],
    meta: { owner: 'pia' },
  },
];

/** Rows that are not objects at all — the option controls pass these. */
const primitiveRows: readonly unknown[] = [
  'Café',
  'beta',
  42,
  0,
  null,
  undefined,
  '',
  true,
];

interface EquivalenceCase {
  readonly name: string;
  readonly data: readonly unknown[];
  readonly search: MlvSearchState | null;
  readonly filters: readonly MlvFilterState[];
}

const equivalenceCases: readonly EquivalenceCase[] = [
  {
    name: 'explicit keys over object rows',
    data: mixedRows,
    search: { query: 'beta', keys: ['name', 'status'] },
    filters: [],
  },
  {
    name: 'explicit keys, accented data vs unaccented query',
    data: mixedRows,
    search: { query: 'cafe zurich', keys: ['name'] },
    filters: [],
  },
  {
    name: 'explicit keys, unaccented data vs accented query',
    data: mixedRows,
    search: { query: 'gámmá', keys: ['name'] },
    filters: [],
  },
  {
    name: 'explicit key that no row declares',
    data: mixedRows,
    search: { query: 'a', keys: ['nope'] },
    filters: [],
  },
  {
    name: 'explicit key whose value is null or undefined on some rows',
    data: mixedRows,
    search: { query: 'draft', keys: ['status'] },
    filters: [],
  },
  {
    name: 'explicit key over a boolean value',
    data: mixedRows,
    search: { query: 'true', keys: ['active'] },
    filters: [],
  },
  {
    name: 'natural fields over object rows',
    data: mixedRows,
    search: { query: 'cafe', keys: [] },
    filters: [],
  },
  {
    name: 'natural fields must skip array values',
    data: mixedRows,
    search: { query: 'zebra', keys: [] },
    filters: [],
  },
  {
    name: 'natural fields must skip nested object values',
    data: mixedRows,
    search: { query: 'nadia', keys: [] },
    filters: [],
  },
  {
    name: 'natural fields match numbers and booleans',
    data: mixedRows,
    search: { query: '30', keys: [] },
    filters: [],
  },
  {
    name: 'natural fields over primitive rows',
    data: primitiveRows,
    search: { query: 'cafe', keys: [] },
    filters: [],
  },
  {
    name: 'natural fields over primitive rows, numeric query',
    data: primitiveRows,
    search: { query: '42', keys: [] },
    filters: [],
  },
  {
    name: 'explicit keys over primitive rows read as undefined',
    data: primitiveRows,
    search: { query: 'cafe', keys: ['length'] },
    filters: [],
  },
  {
    name: 'empty query disables search',
    data: mixedRows,
    search: { query: '', keys: ['name'] },
    filters: [],
  },
  {
    name: 'whitespace-only query disables search',
    data: mixedRows,
    search: { query: '   \t ', keys: ['name'] },
    filters: [],
  },
  {
    name: 'null search state',
    data: mixedRows,
    search: null,
    filters: [],
  },
  {
    name: 'search ANDed with a contains filter',
    data: mixedRows,
    search: { query: 'a', keys: ['name'] },
    filters: [{ key: 'name', operator: 'contains', value: 'CAFÉ' }],
  },
  {
    name: 'filters only, no search',
    data: mixedRows,
    search: null,
    filters: [
      { key: 'status', operator: 'not-contains', value: 'draft' },
      { key: 'active', operator: 'equals', value: true },
    ],
  },
  {
    name: 'filters over primitive rows',
    data: primitiveRows,
    search: null,
    filters: [{ key: 'anything', operator: 'not-equals', value: 'x' }],
  },
];

describe('MlvArrayDataSource haystack equivalence with the pre-cache matcher', () => {
  it.each(equivalenceCases)('$name', ({ data, search, filters }) => {
    const source = new MlvArrayDataSource<unknown>([...data]);
    source.setPerPage(Infinity);
    source.setSearch(search);
    source.setFilters([...filters]);

    const expected = oracleFilter(data, search, filters);

    expect(source.connect()()).toEqual(expected);
    expect(source.totalItems()).toBe(expected.length);
  });

  it('never matches a query that spans two fields (no naive join)', () => {
    // `{ a: 'foo', b: 'bar' }` matched per field, so 'obar' — which only exists
    // across the 'foo' | 'bar' boundary — must not match. A joined haystack
    // ('foobar', or 'foo bar' searched with a space-bearing query) would.
    const data = [{ a: 'foo', b: 'bar' }];

    const keyed = new MlvArrayDataSource(data);
    keyed.setPerPage(Infinity);
    keyed.setSearch({ query: 'obar', keys: ['a', 'b'] });
    expect(keyed.connect()()).toEqual([]);
    expect(keyed.totalItems()).toBe(0);

    const natural = new MlvArrayDataSource(data);
    natural.setPerPage(Infinity);
    natural.setSearch({ query: 'obar', keys: [] });
    expect(natural.connect()()).toEqual([]);
    expect(natural.totalItems()).toBe(0);

    // A separator-bearing query must not smuggle a cross-field match either.
    natural.setSearch({ query: 'foo bar', keys: [] });
    expect(natural.connect()()).toEqual([]);
  });
});

/** Builds `count` rows with three searchable string fields. */
function makeRows(count: number, salt = 'x'): Record<string, string>[] {
  return Array.from({ length: count }, (_, i) => ({
    a: `alpha-${salt}-${i}`,
    b: `bravo-${salt}-${i}`,
    c: `charlie-${salt}-${i}`,
  }));
}

describe('MlvArrayDataSource normalisation cost', () => {
  beforeEach(() => {
    normalizeCounter.calls = 0;
  });

  it('normalizes each searched field at most once per (data, keys) pair', () => {
    const rowCount = 50;
    const keys = ['a', 'b', 'c'];
    const queries = ['a', 'al', 'alp', 'alph', 'alpha', 'alpha-'];
    const source = new MlvArrayDataSource(makeRows(rowCount));
    source.setPerPage(Infinity);

    normalizeCounter.calls = 0;
    for (const query of queries) {
      source.setSearch({ query, keys });
      source.connect()();
    }

    // Derivation. Every query here is a prefix of `alpha-`, so key 'a'
    // (`alpha-x-<i>`) matches on the *first* field of every row and the matcher
    // short-circuits there — 'b' and 'c' are never consulted.
    //   keystroke 1: 1 query + rowCount * 1 field (memo is empty)
    //   keystrokes 2..6: 1 query each, field 0 served from the memo
    // = rowCount + queries.length = 50 + 6 = 56.
    // Eager precomputation would have paid rowCount * keys.length + 6 = 156;
    // the pre-change matcher re-normalised per keystroke: 6 * (1 + 50) = 306.
    expect(normalizeCounter.calls).toBe(rowCount + queries.length);
    expect(source.totalItems()).toBe(rowCount);
  });

  it('extends a row memo field by field, and only once', () => {
    const rowCount = 50;
    const keys = ['a', 'b', 'c'];
    const source = new MlvArrayDataSource(makeRows(rowCount));
    source.setPerPage(Infinity);

    // Warm the memo to one field per row with a query only 'a' satisfies.
    source.setSearch({ query: 'alpha', keys });
    source.connect()();

    // A query only the *third* key satisfies has to walk past the memoised
    // field 0 and normalise fields 1 and 2: 1 query + rowCount * 2.
    normalizeCounter.calls = 0;
    source.setSearch({ query: 'charlie', keys });
    expect(source.totalItems()).toBe(rowCount);
    expect(normalizeCounter.calls).toBe(1 + rowCount * 2);

    // The whole row is memoised now, so any further query is 1 normalisation
    // regardless of which field answers it.
    for (const query of ['charli', 'bravo', 'alpha', 'nothing']) {
      normalizeCounter.calls = 0;
      source.setSearch({ query, keys });
      source.connect()();
      expect(normalizeCounter.calls).toBe(1);
    }
    expect(source.totalItems()).toBe(0);
  });

  it('normalizes every field once when nothing matches, then nothing again', () => {
    const rowCount = 30;
    const keys = ['a', 'b', 'c'];
    const source = new MlvArrayDataSource(makeRows(rowCount));
    source.setPerPage(Infinity);

    // Worst case: no field matches, so all three are consulted per row —
    // 1 query + rowCount * keys.length. This is the bound the eager version
    // paid unconditionally.
    normalizeCounter.calls = 0;
    source.setSearch({ query: 'zzz', keys });
    expect(source.totalItems()).toBe(0);
    expect(normalizeCounter.calls).toBe(1 + rowCount * keys.length);

    normalizeCounter.calls = 0;
    source.setSearch({ query: 'zzzz', keys });
    expect(source.totalItems()).toBe(0);
    expect(normalizeCounter.calls).toBe(1);
  });

  it('drops the memos on new data or new keys, but never on a new query', () => {
    const rowCount = 20;
    const data = signal(makeRows(rowCount));
    const source = new MlvArrayDataSource(data);
    source.setPerPage(Infinity);

    source.setSearch({ query: 'alpha', keys: ['a', 'b'] });
    source.connect()();

    // Query-only change: 1 normalisation (the query) and no rebuild — key 'a'
    // is already memoised for every row and still answers.
    normalizeCounter.calls = 0;
    source.setSearch({ query: 'alph', keys: ['a', 'b'] });
    source.connect()();
    expect(normalizeCounter.calls).toBe(1);

    // Same keys passed as a fresh array reference: still no rebuild, because
    // `_searchKeys` compares element-wise.
    normalizeCounter.calls = 0;
    source.setSearch({ query: 'alp', keys: ['a', 'b'] });
    source.connect()();
    expect(normalizeCounter.calls).toBe(1);

    // Changed keys drop every memo: 1 query + rowCount (key 'a' answers again,
    // so only field 0 of each row is re-normalised).
    normalizeCounter.calls = 0;
    source.setSearch({ query: 'alp', keys: ['a', 'c'] });
    source.connect()();
    expect(normalizeCounter.calls).toBe(1 + rowCount);

    // Reordering the same keys must drop them too — the memo is indexed by
    // position, so entry 0 would otherwise answer for the wrong key.
    normalizeCounter.calls = 0;
    source.setSearch({ query: 'alp', keys: ['c', 'a'] });
    source.connect()();
    // 1 query + rowCount * 2: 'charlie-x-<i>' misses 'alp', so field 1 ('a')
    // has to be normalised as well.
    expect(normalizeCounter.calls).toBe(1 + rowCount * 2);

    // A new data array reference drops them as well. `_filtered` re-runs from
    // the top, so the query is normalised again too: 1 + rowCount * 2.
    normalizeCounter.calls = 0;
    data.set(makeRows(rowCount, 'y'));
    source.connect()();
    expect(normalizeCounter.calls).toBe(1 + rowCount * 2);
    expect(source.totalItems()).toBe(rowCount);
  });

  it('normalizes a contains comparand once per pass, not once per row', () => {
    const rowCount = 40;
    const source = new MlvArrayDataSource(
      Array.from({ length: rowCount }, (_, i) => ({ name: `Café ${i}` })),
    );
    source.setPerPage(Infinity);

    normalizeCounter.calls = 0;
    source.setFilters([{ key: 'name', operator: 'contains', value: 'CAFE' }]);
    source.connect()();

    // Exact bound: 1 for the (empty) search query + 1 for the hoisted
    // comparand + rowCount row values = 42. The pre-change code normalised the
    // constant comparand again for every row: 1 + 2 * 40 = 81.
    expect(normalizeCounter.calls).toBe(rowCount + 2);
    expect(source.totalItems()).toBe(rowCount);
  });

  it('does not normalize the comparand for identity operators', () => {
    const source = new MlvArrayDataSource(makeRows(5));
    source.setPerPage(Infinity);

    normalizeCounter.calls = 0;
    source.setFilters([
      { key: 'a', operator: 'equals', value: 'alpha-x-0' },
      { key: 'b', operator: 'not-equals', value: 'nope' },
      { key: 'c', operator: 'in', value: ['charlie-x-0'] },
      { key: 'a', operator: 'not-in', value: ['zzz'] },
    ]);
    source.connect()();

    // Only the (empty) search query is normalised — `equals`, `not-equals`,
    // `in` and `not-in` compare by identity and must pay nothing.
    expect(normalizeCounter.calls).toBe(1);
    expect(source.totalItems()).toBe(1);
  });
});

describe('MlvArrayDataSource lazy-memo correctness', () => {
  const memoRows = [
    { a: 'alpha', b: 'bravo', c: 'charlie' },
    { a: 'delta', b: 'echo', c: 'foxtrot' },
  ];

  it('answers correctly as the query moves between fields, in both directions', () => {
    const source = new MlvArrayDataSource(memoRows);
    source.setPerPage(Infinity);
    const keys = ['a', 'b', 'c'];

    // 'alpha' memoises only field 0 of row 0; row 1 walks all three and misses.
    source.setSearch({ query: 'alpha', keys });
    expect(source.connect()()).toEqual([memoRows[0]]);

    // A field the memo has not reached yet on row 0 must still be consulted.
    source.setSearch({ query: 'charlie', keys });
    expect(source.connect()()).toEqual([memoRows[0]]);

    // And going back to an already-memoised field must not re-derive a stale
    // answer.
    source.setSearch({ query: 'alpha', keys });
    expect(source.connect()()).toEqual([memoRows[0]]);

    source.setSearch({ query: 'echo', keys });
    expect(source.connect()()).toEqual([memoRows[1]]);
  });

  it('re-reads the right key after the key list is reordered', () => {
    const source = new MlvArrayDataSource(memoRows);
    source.setPerPage(Infinity);

    // Memoises field 0 = 'a' for both rows.
    source.setSearch({ query: 'alpha', keys: ['a', 'b'] });
    expect(source.connect()()).toEqual([memoRows[0]]);

    // Same set, swapped order. Position 0 now means 'b'; a memo carried over
    // would answer 'alpha' for it and never look at 'bravo'.
    source.setSearch({ query: 'bravo', keys: ['b', 'a'] });
    expect(source.connect()()).toEqual([memoRows[0]]);

    source.setSearch({ query: 'echo', keys: ['b', 'a'] });
    expect(source.connect()()).toEqual([memoRows[1]]);
  });

  it('re-reads natural fields after the data array is replaced', () => {
    const data = signal([{ label: 'Café' }]);
    const source = new MlvArrayDataSource(data);
    source.setPerPage(Infinity);

    source.setSearch({ query: 'cafe', keys: [] });
    expect(source.connect()().length).toBe(1);

    data.set([{ label: 'Tea' }]);
    expect(source.connect()()).toEqual([]);

    source.setSearch({ query: 'tea', keys: [] });
    expect(source.connect()().length).toBe(1);
  });

  it('keeps a partially filled memo valid when only the filters change', () => {
    const rows = [
      { a: 'alpha', b: 'bravo', c: 'charlie', keep: 'yes' },
      { a: 'delta', b: 'echo', c: 'foxtrot', keep: 'no' },
      { a: 'gamma', b: 'bravo', c: 'charlie', keep: 'yes' },
    ];
    const keys = ['a', 'b', 'c'];
    const source = new MlvArrayDataSource(rows);
    source.setPerPage(Infinity);

    // 'alpha' stops at field 0 on row 0, so its memo is the one-element prefix
    // ['alpha']; rows 1 and 2 walk all three fields and miss, so theirs are
    // full.
    source.setSearch({ query: 'alpha', keys });
    expect(source.connect()()).toEqual([rows[0]]);

    // `_filtered` now re-runs with the haystack generation unchanged, so row 0
    // is still holding that partial memo. A partial memo mistaken for the whole
    // field list would make 'charlie' miss row 0 — the walk is driven by the
    // key list, not by the memo's length, so it does not.
    normalizeCounter.calls = 0;
    source.setFilters([{ key: 'keep', operator: 'equals', value: 'yes' }]);
    source.setSearch({ query: 'charlie', keys });
    expect(source.connect()()).toEqual([rows[0], rows[2]]);
    // 1 query + row 0 extending its memo over fields 1 and 2. Rows 1 and 2 are
    // already full, and `equals` normalises nothing.
    expect(normalizeCounter.calls).toBe(1 + 2);

    // Every memo is full now, so a filter-only change costs just the query.
    // `_matchesQuery` is the left operand of `&&`, so it still runs for every
    // row — the filter never skips a row that would have needed normalising.
    normalizeCounter.calls = 0;
    source.setFilters([{ key: 'keep', operator: 'equals', value: 'no' }]);
    expect(source.connect()()).toEqual([]);
    expect(normalizeCounter.calls).toBe(1);
  });
});

describe('MlvArrayDataSource filter operators', () => {
  interface OpRow {
    label: string | null | undefined;
    n: number;
  }

  const opRows: OpRow[] = [
    { label: 'Café', n: 1 },
    { label: 'beta', n: 2 },
    { label: null, n: 3 },
    { label: undefined, n: 4 },
  ];

  function run(filter: MlvFilterState): number[] {
    const source = new MlvArrayDataSource(opRows);
    source.setPerPage(Infinity);
    source.setFilters([filter]);
    const actual = source.connect()();
    // Every operator is also checked against the verbatim pre-change filter.
    expect(actual).toEqual(oracleFilter(opRows, null, [filter]));
    return actual.map((r) => r.n);
  }

  it('equals compares by identity', () => {
    expect(run({ key: 'label', operator: 'equals', value: 'Café' })).toEqual([
      1,
    ]);
    expect(run({ key: 'label', operator: 'equals', value: null })).toEqual([3]);
    expect(run({ key: 'label', operator: 'equals', value: undefined })).toEqual(
      [4],
    );
  });

  it('not-equals compares by identity', () => {
    expect(
      run({ key: 'label', operator: 'not-equals', value: 'Café' }),
    ).toEqual([2, 3, 4]);
  });

  it('contains normalises both sides and treats nullish as an empty string', () => {
    expect(run({ key: 'label', operator: 'contains', value: 'cafe' })).toEqual([
      1,
    ]);
    // A nullish comparand normalises to '' — which every string contains.
    expect(run({ key: 'label', operator: 'contains', value: null })).toEqual([
      1, 2, 3, 4,
    ]);
    expect(
      run({ key: 'label', operator: 'contains', value: undefined }),
    ).toEqual([1, 2, 3, 4]);
    // A nullish row value normalises to '' — which contains nothing but ''.
    expect(run({ key: 'label', operator: 'contains', value: 'beta' })).toEqual([
      2,
    ]);
  });

  it('not-contains is the exact negation of contains', () => {
    expect(
      run({ key: 'label', operator: 'not-contains', value: 'cafe' }),
    ).toEqual([2, 3, 4]);
    expect(
      run({ key: 'label', operator: 'not-contains', value: null }),
    ).toEqual([]);
    expect(
      run({ key: 'label', operator: 'not-contains', value: undefined }),
    ).toEqual([]);
  });

  it('in and not-in require an array comparand', () => {
    expect(
      run({ key: 'label', operator: 'in', value: ['Café', 'beta'] }),
    ).toEqual([1, 2]);
    expect(run({ key: 'label', operator: 'not-in', value: ['Café'] })).toEqual([
      2, 3, 4,
    ]);
    // A non-array comparand fails both, exactly as before.
    expect(run({ key: 'label', operator: 'in', value: 'Café' })).toEqual([]);
    expect(run({ key: 'label', operator: 'not-in', value: 'Café' })).toEqual(
      [],
    );
  });

  it('passes every row through for an unrecognised operator', () => {
    const unknownOperator =
      'starts-with' as unknown as MlvDataSourceFilterOperator;
    expect(
      run({ key: 'label', operator: unknownOperator, value: 'ca' }),
    ).toEqual([1, 2, 3, 4]);
  });
});

// ---------------------------------------------------------------------------
// Sorting — ordering parity, cost guards and stability
// ---------------------------------------------------------------------------

/**
 * Verbatim copy of the pre-decoration `_sorted` comparator: `_read` and
 * `String(… ?? '')` are evaluated per comparison, and the string branch goes
 * through `localeCompare(…, undefined, { numeric: true })`, which resolves a
 * fresh collator every call.
 *
 * Every ordering assertion below is cross-checked against this oracle *and*
 * against a literal expectation. The oracle keeps the cases whose result is
 * implementation-defined (`NaN`) honest — it runs in the same engine, so it
 * pins "unchanged from before", not a hand-derived order.
 */
function oracleSort(
  rows: readonly unknown[],
  key: string,
  direction: MlvSortDirection,
): unknown[] {
  return [...rows].sort((a, b) => {
    const av = oracleRead(a, key);
    const bv = oracleRead(b, key);
    let cmp: number;
    if (typeof av === 'number' && typeof bv === 'number') {
      cmp = av - bv;
    } else {
      cmp = String(av ?? '').localeCompare(String(bv ?? ''), undefined, {
        numeric: true,
      });
    }
    return direction === 'asc' ? cmp : -cmp;
  });
}

/** One row of the ordering parity table: a column of values plus both orders. */
interface SortCase {
  readonly name: string;
  /** Column values; the row at index `i` gets `id: i`. */
  readonly values: readonly unknown[];
  /** Expected `id` order under `'asc'`. */
  readonly asc: readonly number[];
  /** Expected `id` order under `'desc'`. */
  readonly desc: readonly number[];
  /**
   * Set when the **oracle** returns `NaN` for some pair in this column, which
   * leaves its permutation implementation-defined (ECMA-262: a comparator
   * returning `NaN` forfeits any ordering guarantee). The oracle cross-check
   * is then skipped, carrying the reason.
   *
   * Not inverted into "the oracle must disagree". That reads like a stronger
   * guard and is actually a liability: it would assert a property of V8's
   * TimSort, and the oracle already lands on the post-fix order for a third of
   * the permutations of these very columns — so a V8 change could turn it red
   * with nothing of ours having changed. It is the same trap #10's
   * `engineDefined` flag existed to avoid.
   *
   * Nothing is lost by skipping it. The literal `asc` / `desc` assertion above
   * is the revert guard, and it is red against the pre-#81 comparator.
   *
   * The row-level table's marker is a different thing and *is* inverted: the
   * old path there is `sort`'s `undefined` hoisting, which is specified, so
   * "the old comparator still disagrees" is a claim about the spec rather than
   * about an engine.
   */
  readonly oracleIsImplementationDefined?: string;
}

const sortCases: readonly SortCase[] = [
  // `null` and `undefined` both collapse to `''` via `?? ''`, so they tie with
  // an actual empty string and with each other; stability keeps input order.
  {
    name: 'nullish values tie with the empty string and sort first',
    values: [null, undefined, '', 'b', 'a'],
    asc: [0, 1, 2, 4, 3],
    desc: [3, 4, 0, 1, 2],
  },
  // A nullish value against a number is *not* the numeric branch: `''` vs the
  // stringified number, so nullish leads under `asc`.
  {
    name: 'nullish values sort ahead of numbers',
    values: [null, 5, undefined, 10, 2],
    asc: [0, 2, 4, 1, 3],
    desc: [3, 1, 4, 0, 2],
  },
  // The branch keys off the *pair*, so a number/string pair is compared as
  // strings while a number/number pair inside the same column is not.
  {
    name: 'a column mixing numbers and strings, numbers first',
    values: [10, '9', 2, 'apple'],
    asc: [2, 1, 0, 3],
    desc: [3, 0, 1, 2],
  },
  {
    name: 'the same mixed column with the pair order swapped',
    values: ['9', 10, 'apple', 2],
    asc: [3, 0, 1, 2],
    desc: [2, 1, 0, 3],
  },
  // `1.5` vs `1.25` is the discriminator between the two branches: numerically
  // 1.25 < 1.5, but `numeric: true` collation reads the fraction digits as a
  // number and puts '1.5' before '1.25'.
  {
    name: 'a number/number pair takes the numeric branch',
    values: [1.5, 1.25],
    asc: [1, 0],
    desc: [0, 1],
  },
  {
    name: 'a number/string pair takes the collator branch',
    values: [1.5, '1.25'],
    asc: [0, 1],
    desc: [1, 0],
  },
  // `numeric: true` — the option a refactor is most likely to silently drop.
  {
    name: 'numeric collation orders item2 before item10',
    values: ['item10', 'item2', 'item1'],
    asc: [2, 1, 0],
    desc: [0, 1, 2],
  },
  // #81: `NaN` now ranks above `Infinity` instead of making the comparator
  // return `NaN`. It is a rank, not a pinned end, so it flips with the
  // direction like any other value.
  {
    name: 'NaN ranks above every finite value and above Infinity',
    values: [3, NaN, 1, 2],
    asc: [2, 3, 0, 1],
    desc: [1, 0, 3, 2],
    oracleIsImplementationDefined:
      'the oracle returns NaN for every pair touching the NaN — V8 happens to ' +
      'leave this input as-is, but nothing requires it to',
  },
  {
    name: 'infinities order numerically',
    values: [Infinity, -Infinity, 0, 5],
    asc: [1, 2, 3, 0],
    desc: [0, 3, 2, 1],
  },
  // `Infinity - Infinity` is NaN too, so a column that merely *repeats* an
  // infinity used to reach the NaN path with no NaN anywhere in the data.
  //
  // No `divergesFromOracle`: V8's TimSort happens to leave this particular
  // input correctly ordered despite the NaN return, and does so for every
  // permutation of it. So the fix makes this case *specified* rather than
  // changing it — the defect here was conformance, not an observed misorder,
  // and the honest record of that is an oracle that still agrees.
  {
    name: 'a repeated infinity no longer reaches a NaN comparator result',
    values: [Infinity, 3, Infinity, 1],
    asc: [3, 1, 0, 2],
    desc: [0, 2, 1, 3],
  },
  // Every rank in the total order at once, including a repeated NaN so the
  // tie-and-stability half is covered too.
  {
    name: 'the full non-finite ladder orders -Infinity < finite < Infinity < NaN',
    values: [3, NaN, 1, Infinity, -Infinity, NaN],
    asc: [4, 2, 0, 3, 1, 5],
    desc: [1, 5, 3, 0, 2, 4],
    oracleIsImplementationDefined:
      'the oracle returns NaN for any pair touching either NaN, so it ' +
      'produced 81 different permutations depending on input order',
  },
  // `0 - -0` is `0`, so the two tie and stability decides.
  {
    name: '-0 ties with 0',
    values: [0, -0, 1, -1],
    asc: [3, 0, 1, 2],
    desc: [2, 0, 1, 3],
  },
  {
    name: 'booleans compare as "false" < "true"',
    values: [true, false, true],
    asc: [1, 0, 2],
    desc: [0, 2, 1],
  },
  // `String(date)` is the locale-independent `Date.prototype.toString`, which
  // leads with the weekday name — so 'Thu Jan 02' sorts before 'Wed Jan 01'.
  {
    name: 'dates compare as their toString, weekday first',
    values: [new Date(2020, 0, 2), new Date(2020, 0, 1)],
    asc: [0, 1],
    desc: [1, 0],
  },
  {
    name: 'objects compare through their toString',
    values: [{ toString: () => 'zeta' }, { toString: () => 'alpha' }],
    asc: [1, 0],
    desc: [0, 1],
  },
  {
    name: 'an all-equal column keeps input order in both directions',
    values: ['x', 'x', 'x', 'x'],
    asc: [0, 1, 2, 3],
    desc: [0, 1, 2, 3],
  },
  { name: 'an empty column', values: [], asc: [], desc: [] },
  { name: 'a single-row column', values: ['solo'], asc: [0], desc: [0] },
];

describe('MlvArrayDataSource sort ordering parity', () => {
  for (const testCase of sortCases) {
    for (const direction of ['asc', 'desc'] as const) {
      it(`${testCase.name} [${direction}]`, () => {
        const rows = testCase.values.map((v, id) => ({ id, v }));
        const source = new MlvArrayDataSource(rows);
        source.setPerPage(Infinity);
        source.setSort({ key: 'v', direction });

        const sorted = source.connect()();

        const expected = direction === 'asc' ? testCase.asc : testCase.desc;
        expect(sorted.map((row) => row.id)).toEqual(expected);

        // Compared as `id` arrays rather than as row objects: a failed
        // `toEqual` over objects prints them, and the readable diff here is
        // the permutation.
        const oracle = oracleSort(rows, 'v', direction).map(
          (row) => (row as { id: number }).id,
        );
        if (!testCase.oracleIsImplementationDefined) {
          // …and identical to the pre-decoration comparator, element for
          // element. Skipped where the oracle itself has no defined answer —
          // see `SortCase.oracleIsImplementationDefined`.
          expect(oracle).toEqual(expected);
        }
      });
    }
  }

  it('returns a fresh array and never mutates the filtered input', () => {
    const rows = [{ v: 'c' }, { v: 'a' }, { v: 'b' }];
    const data = signal(rows);
    const source = new MlvArrayDataSource(data);
    source.setPerPage(Infinity);
    source.setSort({ key: 'v', direction: 'asc' });

    const sorted = source.connect()();

    expect(sorted.map((row) => row.v)).toEqual(['a', 'b', 'c']);
    expect(sorted).not.toBe(rows);
    // The caller's array is untouched — the sort ran over a copy.
    expect(rows.map((row) => row.v)).toEqual(['c', 'a', 'b']);
    expect(data()).toBe(rows);
  });

  it('still returns a copy when no sort is active', () => {
    const rows = [{ v: 'c' }, { v: 'a' }];
    const source = new MlvArrayDataSource(rows);
    source.setPerPage(Infinity);

    const connected = source.connect()();

    expect(connected).toEqual(rows);
    expect(connected).not.toBe(rows);
  });
});

/** A row in the nullish-row table: an object row, or a nullish row itself. */
type NullishRow = { v: string } | null | undefined;

/** Renders a row as its sort key, so a nullish row is visible in a diff. */
const rowLabel = (row: NullishRow): string | null | undefined =>
  row == null ? row : row.v;

/**
 * Row-level cases: the **array** holds nullish rows, not merely nullish
 * values. This is the gap the value-level table above cannot cover, because
 * every row it builds is a real object.
 *
 * Since #83 a nullish row is treated as an absent record rather than as the
 * empty string: `null` and `undefined` rows are indistinguishable, they form a
 * suffix in **both** directions, and their relative order is the input's.
 *
 * Before #83 the two diverged, and the divergence was `Array.prototype.sort`'s
 * rather than the comparator's: `sort` resolved every pair involving an
 * `undefined` *element* by itself — always to the end, in both directions,
 * without invoking the comparator — while a `null` element was passed through,
 * read as `undefined`, stringified to `''` and therefore led under `asc`. That
 * gave `undefined` rows the right answer for the wrong reason and `null` rows
 * the wrong answer.
 */
interface NullishRowCase {
  readonly name: string;
  readonly rows: NullishRow[];
  readonly asc: readonly (string | null | undefined)[];
  readonly desc: readonly (string | null | undefined)[];
  /**
   * Set when #83 changed this case, carrying the direction(s) it changed in.
   * The oracle assertion is inverted for those, exactly as in
   * {@link SortCase.divergesFromOracle} — a case the old comparator already
   * got right must keep agreeing with it, and one it got wrong must keep
   * disagreeing, so neither half can be reverted with this suite green.
   */
  readonly divergesFromOracle?: readonly MlvSortDirection[];
}

const nullishRowCases: readonly NullishRowCase[] = [
  // Unchanged by #83: `sort`'s own hoisting already put this row last. The
  // mechanism moved from `sort` to the partition; the answer did not.
  {
    name: 'an undefined row sinks to the end in both directions',
    rows: [{ v: 'b' }, undefined, { v: 'a' }],
    asc: ['a', 'b', undefined],
    desc: ['b', 'a', undefined],
  },
  // The headline change: a `null` row used to lead under `asc` because `''`
  // collates before every non-empty string.
  {
    name: 'a null row sinks to the end in both directions',
    rows: [{ v: 'b' }, null, { v: 'a' }],
    asc: ['a', 'b', null],
    desc: ['b', 'a', null],
    divergesFromOracle: ['asc'],
  },
  // `undefined` before `null` in the suffix because that is the input order,
  // not because one outranks the other.
  {
    name: 'null and undefined rows sort alike, keeping input order',
    rows: [{ v: 'b' }, undefined, null, { v: 'a' }],
    asc: ['a', 'b', undefined, null],
    desc: ['b', 'a', undefined, null],
    divergesFromOracle: ['asc', 'desc'],
  },
  {
    name: 'several undefined rows all sink',
    rows: [undefined, { v: 'b' }, undefined, { v: 'a' }],
    asc: ['a', 'b', undefined, undefined],
    desc: ['b', 'a', undefined, undefined],
  },
  {
    name: 'an all-undefined array is left alone',
    rows: [undefined, undefined],
    asc: [undefined, undefined],
    desc: [undefined, undefined],
  },
  // The pair that proves "input order, not a rank": the same two rows in the
  // opposite input order come back in that opposite order.
  {
    name: 'an undefined row before a null row keeps that order',
    rows: [undefined, null],
    asc: [undefined, null],
    desc: [undefined, null],
    divergesFromOracle: ['asc', 'desc'],
  },
  {
    name: 'a null row before an undefined row keeps that order',
    rows: [null, undefined],
    asc: [null, undefined],
    desc: [null, undefined],
  },
];

describe('MlvArrayDataSource sort ordering parity — nullish rows', () => {
  for (const testCase of nullishRowCases) {
    for (const direction of ['asc', 'desc'] as const) {
      it(`${testCase.name} [${direction}]`, () => {
        const source = new MlvArrayDataSource<NullishRow>(testCase.rows);
        source.setPerPage(Infinity);
        source.setSort({ key: 'v', direction });

        const sorted = source.connect()();

        const expected = direction === 'asc' ? testCase.asc : testCase.desc;
        expect(sorted.map(rowLabel)).toEqual(expected);

        const oracle = oracleSort(testCase.rows, 'v', direction).map((row) =>
          rowLabel(row as NullishRow),
        );
        if (testCase.divergesFromOracle?.includes(direction)) {
          expect(oracle).not.toEqual(expected);
        } else {
          expect(oracle).toEqual(expected);
        }
      });

      // The structural half of #83, asserted from the result rather than from
      // a literal: whatever the column holds, every nullish row is in the
      // trailing run and their relative order is the input's.
      it(`${testCase.name} — nullish rows form a suffix in input order [${direction}]`, () => {
        const source = new MlvArrayDataSource<NullishRow>(testCase.rows);
        source.setPerPage(Infinity);
        source.setSort({ key: 'v', direction });

        const sorted = source.connect()();
        const nullishCount = testCase.rows.filter((row) => row == null).length;
        const suffixStart = sorted.length - nullishCount;

        expect(sorted.slice(suffixStart).every((row) => row == null)).toBe(
          true,
        );
        expect(sorted.slice(0, suffixStart).some((row) => row == null)).toBe(
          false,
        );
        expect(sorted.slice(suffixStart).map(rowLabel)).toEqual(
          testCase.rows.filter((row) => row == null).map(rowLabel),
        );
      });
    }
  }

  it('does not push a real row off the first page with an undefined row', () => {
    // The paging symptom: a nullish row leading under `asc` renders a blank
    // first row and bumps a real one to page 2.
    const source = new MlvArrayDataSource<NullishRow>([
      undefined,
      { v: 'a' },
      { v: 'b' },
    ]);
    source.setPerPage(2);
    source.setSort({ key: 'v', direction: 'asc' });

    expect(source.connect()().map(rowLabel)).toEqual(['a', 'b']);

    source.setPage(2);
    expect(source.connect()().map(rowLabel)).toEqual([undefined]);
  });

  it('does not push a real row off the first page with a null row', () => {
    // The same symptom for a `null` row, which is the one #83 actually fixes:
    // before it, page 1 was `[null, 'a']` and `'b'` was on page 2.
    const source = new MlvArrayDataSource<NullishRow>([
      null,
      { v: 'a' },
      { v: 'b' },
    ]);
    source.setPerPage(2);
    source.setSort({ key: 'v', direction: 'asc' });

    expect(source.connect()().map(rowLabel)).toEqual(['a', 'b']);

    source.setPage(2);
    expect(source.connect()().map(rowLabel)).toEqual([null]);
  });

  it('counts nullish rows in totalItems', () => {
    // The partition must not drop rows: `totalItems` is derived from the
    // filtered array, and the sorted output has to carry the same count.
    const source = new MlvArrayDataSource<NullishRow>([
      { v: 'b' },
      null,
      undefined,
      { v: 'a' },
    ]);
    source.setPerPage(Infinity);
    source.setSort({ key: 'v', direction: 'asc' });

    expect(source.totalItems()).toBe(4);
    expect(source.connect()().length).toBe(4);
  });
});

/** Every permutation of `values`, as arrays. */
function permutations<V>(values: readonly V[]): V[][] {
  if (values.length <= 1) return [[...values]];
  const out: V[][] = [];
  for (let i = 0; i < values.length; i++) {
    const rest = [...values.slice(0, i), ...values.slice(i + 1)];
    for (const tail of permutations(rest)) out.push([values[i], ...tail]);
  }
  return out;
}

/** A NaN-safe label, so a sorted key sequence can be compared as a string. */
const numLabel = (value: number): string =>
  Number.isNaN(value) ? 'NaN' : String(value);

/**
 * The transitivity proof for #81, run rather than argued.
 *
 * A comparator that is not transitive makes `Array.prototype.sort`'s output
 * depend on the *order in which it happens to compare things* — so the same
 * multiset, fed in different input orders, comes out differently. Sorting
 * every permutation of one column and collapsing the results into a set turns
 * that into a single assertion: **one** distinct output means the comparator
 * induced a genuine total order over these values, **more than one** means it
 * did not.
 *
 * This is stronger than asserting a literal order, which a comparator can
 * satisfy for one input and violate for a permutation of it.
 */
describe('MlvArrayDataSource numeric sort is a total order', () => {
  // Both infinities, a repeated NaN (so ties are covered), and finites either
  // side of zero.
  const column = [3, NaN, 1, Infinity, -Infinity, NaN];

  for (const direction of ['asc', 'desc'] as const) {
    it(`orders every permutation of a non-finite column identically [${direction}]`, () => {
      const outcomes = new Set(
        permutations(column).map((values) => {
          const source = new MlvArrayDataSource(
            values.map((v, id) => ({ id, v })),
          );
          source.setPerPage(Infinity);
          source.setSort({ key: 'v', direction });
          return source
            .connect()()
            .map((row) => numLabel(row.v))
            .join(',');
        }),
      );

      expect(outcomes.size).toBe(1);
      expect([...outcomes][0]).toBe(
        direction === 'asc'
          ? '-Infinity,1,3,Infinity,NaN,NaN'
          : 'NaN,NaN,Infinity,3,1,-Infinity',
      );
    });

    it(`the pre-#81 comparator did not [${direction}]`, () => {
      // Inverted, like the oracle checks in the parity tables: the defect has
      // to stay demonstrable, or reverting the fix would leave this suite
      // green. 720 permutations of the same six values, and the pre-#81
      // comparator returns NaN for every pair touching either NaN.
      const outcomes = new Set(
        permutations(column).map((values) =>
          oracleSort(
            values.map((v, id) => ({ id, v })),
            'v',
            direction,
          )
            .map((row) => numLabel((row as { v: number }).v))
            .join(','),
        ),
      );

      expect(outcomes.size).toBeGreaterThan(1);
    });
  }

  it('keeps a repeated infinity finite-comparable without any NaN in the data', () => {
    // #81's second reachable path: `Infinity - Infinity` is NaN, so this column
    // used to reach a NaN comparator result with entirely ordinary data.
    const source = new MlvArrayDataSource(
      [Infinity, 3, Infinity, 1].map((v, id) => ({ id, v })),
    );
    source.setPerPage(Infinity);
    source.setSort({ key: 'v', direction: 'asc' });

    expect(
      source
        .connect()()
        .map((row) => numLabel(row.v)),
    ).toEqual(['1', '3', 'Infinity', 'Infinity']);
  });
});

describe('MlvArrayDataSource sort stability', () => {
  /**
   * 1 024 rows over 4 distinct keys. Every group is far larger than the
   * 22-element run threshold at which V8's TimSort switches from binary
   * insertion sort to merging, so a comparator that lost positional
   * information — sorting indices, or rebuilding the output from a
   * value-keyed lookup — would visibly scramble the ids inside a group.
   */
  const size = 1024;
  const rows = Array.from({ length: size }, (_, id) => ({
    id,
    bucket: `g${id % 4}`,
  }));

  const idsInBucket = (bucket: number): number[] =>
    rows.filter((row) => row.bucket === `g${bucket}`).map((row) => row.id);

  it('keeps equal keys in input order under asc', () => {
    const source = new MlvArrayDataSource(rows);
    source.setPerPage(Infinity);
    source.setSort({ key: 'bucket', direction: 'asc' });

    expect(
      source
        .connect()()
        .map((row) => row.id),
    ).toEqual([0, 1, 2, 3].flatMap(idsInBucket));
  });

  it('keeps equal keys in input order under desc, reversing only the groups', () => {
    const source = new MlvArrayDataSource(rows);
    source.setPerPage(Infinity);
    source.setSort({ key: 'bucket', direction: 'desc' });

    expect(
      source
        .connect()()
        .map((row) => row.id),
    ).toEqual([3, 2, 1, 0].flatMap(idsInBucket));
  });
});

describe('MlvArrayDataSource sort cost', () => {
  /**
   * 512 rows with distinct string keys, so every comparison takes the collator
   * branch. A comparison sort over N = 512 elements performs at least N - 1 =
   * 511 comparisons, and V8's TimSort performs on the order of N·log2(N) ≈
   * 4 600 on shuffled input — the two bounds every guard below is derived from.
   */
  const size = 512;

  /** Deterministic shuffle: `i * 37 mod 512` is a permutation (37 is odd). */
  const shuffledLabel = (i: number): string =>
    `item-${String((i * 37) % size).padStart(3, '0')}`;

  it('resolves at most one collator per sort pass, not one per comparison', () => {
    const rows = Array.from({ length: size }, (_, id) => ({
      id,
      label: shuffledLabel(id),
    }));
    const source = new MlvArrayDataSource(rows);
    source.setPerPage(Infinity);
    source.setSort({ key: 'label', direction: 'asc' });

    // Both routes to a collator are counted: constructing one directly, and
    // `String.prototype.localeCompare` with an options bag, which per
    // ECMA-402 initialises a fresh collator on every single call.
    let resolutions = 0;
    const RealCollator = Intl.Collator;
    class CountingCollator extends RealCollator {
      constructor(
        locales?: Intl.LocalesArgument,
        options?: Intl.CollatorOptions,
      ) {
        super(locales, options);
        resolutions++;
      }
    }
    const realLocaleCompare = String.prototype.localeCompare;
    const intl = Intl as { Collator: typeof Intl.Collator };
    const stringProto = String.prototype as {
      localeCompare: typeof String.prototype.localeCompare;
    };

    let ascending: readonly { id: number }[];
    let descending: readonly { id: number }[];
    intl.Collator = CountingCollator;
    stringProto.localeCompare = function (
      this: string,
      that: string,
      locales?: Intl.LocalesArgument,
      options?: Intl.CollatorOptions,
    ): number {
      resolutions++;
      return realLocaleCompare.call(this, that, locales, options);
    };
    try {
      ascending = source.connect()();
      source.setSort({ key: 'label', direction: 'desc' });
      descending = source.connect()();
    } finally {
      intl.Collator = RealCollator;
      stringProto.localeCompare = realLocaleCompare;
    }

    // Non-vacuity: the two passes really did sort all 512 rows.
    expect(ascending.map((row) => row.id)).toEqual(
      [...rows].sort((a, b) => (a.label < b.label ? -1 : 1)).map((r) => r.id),
    );
    expect(descending.map((row) => row.id)).toEqual(
      [...ascending].reverse().map((row) => row.id),
    );

    // Bound: O(1) per sort pass — at most one resolution each, so at most 2
    // for the two passes above. Observed: 0, because the collator is resolved
    // once at module scope and reused. The pre-change comparator resolved one
    // per comparison, i.e. between 2 × 511 = 1 022 and ≈ 2 × 4 600 = 9 200.
    expect(resolutions).toBeLessThanOrEqual(2);
  });

  it('reads and stringifies each row once per sort, not once per comparison', () => {
    let reads = 0;
    let stringifications = 0;
    const rows = Array.from({ length: size }, (_, id) => {
      const label = shuffledLabel(id);
      return {
        id,
        // The getter counts `_read`; the object it hands back counts the
        // `String(… ?? '')` the collator branch needs. Both are what the
        // comparator used to do twice per comparison.
        get label(): unknown {
          reads++;
          return {
            toString: (): string => {
              stringifications++;
              return label;
            },
          };
        },
      };
    });

    const source = new MlvArrayDataSource(rows);
    source.setPerPage(Infinity);
    source.setSort({ key: 'label', direction: 'asc' });

    const sorted = source.connect()();

    // Non-vacuity: the rows really came back in collated label order.
    expect(sorted.map((row) => row.id)).toEqual(
      Array.from({ length: size }, (_, i) => i).sort(
        (a, b) => ((a * 37) % size) - ((b * 37) % size),
      ),
    );

    // Bound: decorate–sort–undecorate touches each row exactly once, so both
    // counters equal N = 512 no matter how many comparisons the sort makes.
    // The pre-change comparator did both inside the comparator — 2 per
    // comparison — so it performed between 2 × 511 = 1 022 and ≈ 9 200 of each.
    expect(reads).toBe(size);
    expect(stringifications).toBe(size);
  });

  it('stringifies nothing at all for a column the numeric branch fully covers', () => {
    const rows = Array.from({ length: size }, (_, id) => ({
      id,
      amount: (id * 37) % size,
    }));
    const source = new MlvArrayDataSource(rows);
    source.setPerPage(Infinity);
    source.setSort({ key: 'amount', direction: 'asc' });

    // `String(number)` never consults `Number.prototype.toString`, so the only
    // way to count it is to swap the global the module resolves `String` from.
    // The window is exactly the one `connect()()` call.
    const realString = globalThis.String;
    let stringCalls = 0;
    const countingString = ((value?: unknown): string => {
      stringCalls++;
      return (realString as (v?: unknown) => string)(value);
    }) as unknown as StringConstructor;
    // Inheriting from the real `String` keeps its statics (`String.raw`,
    // `fromCharCode`, …) and `String.prototype` reachable through the chain,
    // so anything else running inside the window is unaffected.
    Object.setPrototypeOf(countingString, realString);

    let sorted: readonly { id: number; amount: number }[];
    globalThis.String = countingString;
    try {
      sorted = source.connect()();
    } finally {
      globalThis.String = realString;
    }

    // Non-vacuity: 512 rows really were sorted numerically.
    expect(sorted.map((row) => row.amount)).toEqual(
      Array.from({ length: size }, (_, i) => i),
    );

    // Bound: 0. Every pair is number/number, so the collator branch never runs
    // and no comparand is ever needed as a string. The pre-change comparator
    // also stringified nothing here — decorating eagerly would have made this
    // 512 where it used to be 0, which is why the text form is computed lazily.
    expect(stringCalls).toBe(0);
  });
});
