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
    expect(source.connect()()).toEqual([null, { id: 1 }, { id: 2 }]);
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
