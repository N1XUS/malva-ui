import type { Signal } from '@angular/core';
import { computed, signal } from '@angular/core';
import { normalizeForMatch } from '@malva-ui/cdk/utils';
import { MlvDataSource } from './data-source';
import type { MlvFilterState } from './data-source.types';

/**
 * @private One active filter, the comparand normalisation hoisted out of the
 * row loop, and the row-side memo its column reads through.
 *
 * `normalizedValue` is populated **only** for the two operators that read it
 * (`contains` / `not-contains`); every other operator compares the raw
 * `state.value` by identity and must not pay for a normalisation it never uses.
 */
interface MlvPreparedFilter {
  /** The filter exactly as configured on the source. */
  readonly state: MlvFilterState;
  /**
   * `normalizeForMatch(String(state.value ?? ''))` for `contains` /
   * `not-contains`; an unread empty string for every other operator.
   */
  readonly normalizedValue: string;
  /**
   * This filter's column memo out of {@link MlvArrayDataSource._filterHaystack}
   * — `normalizeForMatch(String(_read(row, state.key) ?? ''))` per row, indexed
   * by position in the **raw** data array and filled on demand.
   *
   * The reference is shared by every prepared filter naming the same `key`, so
   * a `contains` and a `not-contains` on one column normalise it once between
   * them. The identity operators never read it; they still carry one so the
   * entry survives an operator flip on an otherwise unchanged filter.
   */
  readonly memo: string[];
}

/**
 * @private One row of {@link MlvArrayDataSource._sorted}'s decorated array:
 * the row plus the two comparand forms the comparator needs, computed at most
 * once per row instead of once per comparison.
 */
interface MlvSortEntry<T> {
  /** The row itself, carried through so the sorted array can be rebuilt. */
  readonly row: T;
  /**
   * `_read(row, sort.key)`, kept **raw**. The comparator's numeric branch keys
   * off the *pair* (`typeof av === 'number' && typeof bv === 'number'`), so a
   * column mixing numbers and strings compares those pairs as strings — the
   * values can never be collapsed to one precomputed key.
   */
  readonly value: unknown;
  /**
   * `String(value ?? '')`, filled the first time a comparison actually reaches
   * the collator branch and `undefined` until then.
   *
   * Lazy rather than eager so a column the numeric branch fully covers still
   * allocates no strings at all, exactly as the per-comparison comparator did;
   * eager decoration would have turned 0 allocations into one per row there.
   */
  text: string | undefined;
}

/**
 * @private The single collator the sort comparator's string branch uses.
 *
 * `localeCompare(that, undefined, { numeric: true })` initialises a fresh
 * collator on **every call**, so locale resolution used to be O(n log n) per
 * sort; hoisting one collator here makes it O(1).
 *
 * `numeric: true` is what orders `'item2'` before `'item10'` — it is load
 * bearing, not decoration.
 *
 * **The locale is the host's, not the app's.** `undefined` resolves the
 * runtime default (`navigator.language` and friends), and resolves it once,
 * when this module is first imported. That is exactly what the per-call form
 * resolved. It is deliberately not the app language:
 * `MlvI18nService.switchLanguage()` swaps the translation pack and nothing
 * else, so sorting has never followed the app language and does not start to
 * here. A source that must collate in the app's language needs its own
 * comparator.
 */
const SORT_COLLATOR = new Intl.Collator(undefined, { numeric: true });

/**
 * @private The sort comparator's numeric branch: a **total order** over every
 * IEEE-754 double, ranked `-Infinity < … < Infinity < NaN`.
 *
 * It replaces `av - bv`, which returned `NaN` whenever the subtraction was
 * non-finite. A comparator returning `NaN` breaks the contract
 * `Array.prototype.sort` expects, and the spec then leaves the permutation
 * **implementation-defined** — so the result was neither ordered nor stable.
 * That was reachable with no `NaN` in the data at all: `Infinity - Infinity`
 * is `NaN`, so a column merely *repeating* an infinity hit it. #81.
 *
 * `<` / `>` do the ordering, which is what keeps this a total order rather than
 * a subtraction: neither is ever true when a `NaN` is involved, and neither
 * overflows. The remaining case — `!(a < b) && !(a > b)` — is an equal pair, a
 * repeated infinity, or a `NaN`, and only the last needs a rank.
 *
 * **`NaN` ranks above `Infinity`**, so it trails under `asc` and leads under
 * `desc`. It is a rank, not a pinned end: `NaN` is a value present in the
 * column, so it flips with the direction like every other value. (A nullish
 * *row* is the opposite case — an absent record, pinned last in both
 * directions, handled by the partition in `_sorted` and never seen here.)
 * PostgreSQL orders float `NaN` above all other values including `Infinity`
 * for the same reason, so a table sorted client-side matches one sorted in the
 * database.
 *
 * `-0` and `0` tie, as they did under subtraction; `sort`'s stability then
 * keeps their input order.
 */
function compareNumeric(a: number, b: number): number {
  if (a < b) return -1;
  if (a > b) return 1;
  const aIsNaN = Number.isNaN(a);
  const bIsNaN = Number.isNaN(b);
  if (aIsNaN === bIsNaN) return 0;
  return aIsNaN ? 1 : -1;
}

/**
 * Default data source for in-memory arrays.
 * Handles filtering, sorting, and pagination automatically.
 * Pass a Signal<T[]> or a plain T[] (wrapped automatically).
 */
export class MlvArrayDataSource<T> extends MlvDataSource<T> {
  /** @private The backing data signal (a passed `Signal<T[]>`, or a plain array wrapped in one). */
  private readonly _rawData: Signal<T[]>;

  constructor(data: Signal<T[]> | T[]) {
    super();
    this._rawData = Array.isArray(data) ? signal(data) : data;
  }

  /**
   * @private The search `keys` split off `_search()`, so that typing — which
   * changes only `query` — does not invalidate {@link _haystack}.
   *
   * `setSearch` copies `keys` defensively, so every keystroke produces a fresh
   * array reference. The element-wise `equal` therefore matters: it keeps this
   * computed's version (and every consumer's cached value) untouched whenever
   * the keys themselves did not change.
   *
   * It is also the single source of truth for the key list: `_haystack` keys
   * its memos on this value and `_filtered` passes *this* value — never
   * `_search()!.keys` — to {@link _matchesQuery}. Because a memo entry is
   * indexed by position in the key list, the two must never disagree.
   */
  private readonly _searchKeys = computed<readonly string[]>(
    () => this._search()?.keys ?? [],
    {
      equal: (a, b) => a.length === b.length && a.every((k, i) => k === b[i]),
    },
  );

  /**
   * @private One mutable normalisation memo per row, index-aligned with
   * `_rawData()`. Each entry holds the **prefix** of that row's searched
   * fields that {@link _matchesQuery} has already normalised — see the
   * invariant documented there — and grows on demand rather than being filled
   * up front, so a row whose first field matches never pays for the rest.
   *
   * The computed itself does no work: it exists only to key the memos on
   * `(data array identity, search keys)`. Reading both dependencies here means
   * a new data array or a changed key set hands out fresh, empty memos, and
   * nothing stale can survive. A changed *query* invalidates neither, which is
   * the whole point: typing re-scans cached strings instead of re-normalising.
   *
   * Mutating these arrays from inside `_filtered` is memoisation, not reactive
   * state — no signal is written, so there is no glitch and no purity hazard;
   * each entry is a pure function of `(row identity, key)`.
   *
   * Trade-off: the normalised strings stay retained for as long as this
   * computed holds a value, and an in-place mutation that publishes no new
   * array reference is not observed. Two distinct cases — a mutated *row*
   * keeps its own stale text, while a mutated *array* (`splice`, `shift`)
   * shifts the alignment, so a row is answered by a **different** row's text.
   * See the library CLAUDE.md.
   */
  private readonly _haystack = computed<readonly string[][]>(() => {
    this._searchKeys();
    return this._rawData().map(() => []);
  });

  /**
   * @private The filtered column `key`s split off `_filters()` — deduplicated
   * and sorted into a canonical **set** — so that editing a filter does not
   * invalidate {@link _filterHaystack}.
   *
   * **Not the analogue of {@link _searchKeys}, despite the shape.** The two
   * exist for different reasons, and conflating them is what makes this
   * comparator easy to get wrong:
   *
   * - `_haystack` entries are indexed by **position in the key list** (see the
   *   prefix invariant on {@link _matchesQuery}), so entry `i` only answers for
   *   `keys[i]`. There `_searchKeys` is load-bearing for **correctness**: a
   *   reorder genuinely must rebuild.
   * - `_filterHaystack` entries are addressed by the key **string**. A memo
   *   entry is a pure function of `(row identity, key)` and cannot be made
   *   wrong by anything the filter list does. So `_filterKeys` is purely an
   *   **eviction policy**, and its only job is to bound retention.
   *
   * The bound it buys: normalised text is retained for the columns currently
   * filtered, and no others — drop a column from the filter list and its
   * strings are released on the next read. Nothing about correctness rests on
   * that, which is why the comparator is free to be as coarse as it likes.
   *
   * Hence the canonical form. Order is not part of the eviction key, and
   * `mlv-data-table.onColumnFiltersChange()` rebuilds `activeFilters` with the
   * edited key moved to the **end** of the list, so a positional comparator
   * dropped every memo on each column-filter edit — precisely the multi-filter
   * case #64 is about. Deduplicating likewise keeps the entry when one of two
   * predicates on a single column is removed.
   *
   * Deliberately maps **every** filter, not just the two operators that read a
   * memo. An operator flipped from `equals` to `contains` on a key already in
   * the set then keeps that column's cache, and the identity operators pay one
   * empty array for it.
   */
  private readonly _filterKeys = computed<readonly string[]>(
    () => [...new Set(this._filters().map((f) => f.key))].sort(),
    {
      equal: (a, b) => a.length === b.length && a.every((k, i) => k === b[i]),
    },
  );

  /**
   * @private One normalisation memo per filtered **column key**, each indexed
   * by position in `_rawData()` and filled on demand by
   * {@link _prepareFilter} / {@link _filterColumnText}.
   *
   * Like {@link _haystack} this computed does no work: it hands out an empty
   * map and exists only to key the memos on `(data array identity, filter key
   * set)`. The data dependency is the one that matters — a new array must not
   * be answered by the old one's cached text. The key-set dependency is an
   * eviction bound only; see {@link _filterKeys}. A changed filter *value*
   * invalidates neither, which is the whole point — the comparand is already
   * hoisted, and typing in a filter input must re-scan cached strings rather
   * than re-normalise the dataset.
   *
   * Keyed by column rather than by filter position so two predicates on one
   * column (the `contains` + `not-contains` pair a range-ish text filter
   * produces) share a single entry.
   *
   * Filling it from inside `_filtered` is memoisation, not reactive state — no
   * signal is written, so there is no glitch and no purity hazard. The same
   * staleness and retention trade-offs as `_haystack` apply; see the library
   * CLAUDE.md.
   */
  private readonly _filterHaystack = computed<Map<string, string[]>>(() => {
    this._rawData();
    this._filterKeys();
    return new Map<string, string[]>();
  });

  /** @private Raw data passed through the active filter predicates. */
  private readonly _filtered = computed<T[]>(() => {
    const data = this._rawData();
    const filters = this._filters();
    const search = this._search();
    const normalizedQuery = normalizeForMatch(search?.query.trim() ?? '');

    if (!filters.length && !normalizedQuery) return data;

    // Hoisted once per pass: `contains`/`not-contains` used to re-normalise
    // their constant comparand for every single row. The row side comes off
    // the per-column memo, which outlives the pass.
    const memos = this._filterHaystack();
    const prepared = filters.map((f) => this._prepareFilter(f, memos));

    if (!normalizedQuery) {
      return data.filter((row, index) =>
        prepared.every((f) => this._applyFilter(row, index, f)),
      );
    }

    const keys = this._searchKeys();
    const haystack = this._haystack();
    return data.filter(
      (row, index) =>
        this._matchesQuery(row, keys, haystack[index], normalizedQuery) &&
        prepared.every((f) => this._applyFilter(row, index, f)),
    );
  });

  /**
   * @private Filtered data sorted by the active sort state (stable copy).
   *
   * Decorate–sort–undecorate: `_read` runs once per row and `String(… ?? '')`
   * at most once per row, instead of twice per *comparison* — O(n) conversions
   * instead of O(n log n). The comparator itself allocates nothing and
   * resolves nothing; it reads the two decorated fields and one module-scope
   * collator.
   *
   * The decorated array is what gets sorted, so `Array.prototype.sort`'s
   * ES2019 stability carries straight through to the rows: equal keys keep
   * their input order. Rebuilding the output from a value-keyed lookup would
   * not. (Sorting *indices* would be stable too — `sort` has been stable since
   * ES2019 whatever it is handed — so it is the rebuild, not the indirection,
   * that is the hazard.)
   *
   * The type branch is unchanged and stays per-pair — see
   * {@link MlvSortEntry.value}. Within the numeric branch the comparison is
   * {@link compareNumeric}, a total order rather than a subtraction (#81).
   *
   * **Nullish rows never reach the comparator.** They are partitioned out
   * before the sort and appended afterwards, so they land last in both
   * directions (#83). See the note in the body for why that is a partition and
   * not a comparator branch.
   */
  private readonly _sorted = computed<T[]>(() => {
    const filtered = this._filtered();
    const sort = this._sort();
    if (!sort) return [...filtered];

    // A nullish row is an absent record: it has no value in *any* column, so
    // it sorts last however the column is sorted (#83). That is a property of
    // the row, not a rank among the values, which is why it is a partition
    // rather than a comparator branch:
    //
    // - a branch would have to sit outside `descending ? -cmp : cmp` to avoid
    //   being flipped into the lead under `desc`, which is exactly the kind of
    //   ordering-dependent special case that breaks transitivity by accident;
    // - partitioning removes nullish rows from the transitivity question
    //   entirely — the comparator only ever sees present rows;
    // - the comparator keeps its cost: no extra field on the entry, no extra
    //   test per comparison.
    //
    // It also drops the previous reliance on `Array.prototype.sort` hoisting
    // `undefined` *elements* to the end by itself (ECMA-262
    // `CompareArrayElements` steps 1-2). That gave `undefined` rows the right
    // answer for the wrong reason, and gave `null` rows — which `sort` does
    // *not* hoist — the wrong answer: they went through the comparator, read
    // as `undefined`, stringified to `''` and led under `asc`.
    const present: MlvSortEntry<T>[] = [];
    const nullish: T[] = [];
    for (let i = 0; i < filtered.length; i++) {
      const row = filtered[i];
      if (row === null || row === undefined) {
        nullish.push(row);
      } else {
        present.push({
          row,
          value: this._read(row, sort.key),
          text: undefined,
        });
      }
    }

    const descending = sort.direction === 'desc';

    const compare = (a: MlvSortEntry<T>, b: MlvSortEntry<T>): number => {
      let cmp: number;
      if (typeof a.value === 'number' && typeof b.value === 'number') {
        cmp = compareNumeric(a.value, b.value);
      } else {
        // `??=` and not `||=`: `String(null ?? '')` is `''`, which must be
        // cached, not recomputed on every comparison that touches this row.
        a.text ??= String(a.value ?? '');
        b.text ??= String(b.value ?? '');
        cmp = SORT_COLLATOR.compare(a.text, b.text);
      }
      return descending ? -cmp : cmp;
    };

    present.sort(compare);

    const out = present.map((entry) => entry.row);
    // Not `out.push(...nullish)`: spreading into an argument list is bounded
    // by the engine's argument limit, and `nullish` is caller data.
    for (let i = 0; i < nullish.length; i++) out.push(nullish[i]);
    return out;
  });

  /** Number of rows left after search and filters, before pagination. */
  readonly totalItems: Signal<number> = computed(() => this._filtered().length);

  /** The current page's slice of the filtered and sorted array. */
  connect(): Signal<T[]> {
    return computed(() => {
      const data = this._sorted();
      const page = this._page();
      const perPage = this._perPage();
      if (!isFinite(perPage)) return data;
      const start = (page - 1) * perPage;
      return data.slice(start, start + perPage);
    });
  }

  /**
   * @private Reads one property off a row. `T` is unconstrained, so a row may
   * be a primitive, `null`, or `undefined` — every keyed read goes through here
   * and yields `undefined` for those rather than throwing.
   */
  private _read(row: T, key: string): unknown {
    return row !== null && typeof row === 'object'
      ? (row as Record<string, unknown>)[key]
      : undefined;
  }

  /**
   * @private Whether a row matches the normalised query, normalising each
   * searched field at most once per `(data array, search keys)` pair by
   * memoising it into `cache`.
   *
   * Semantics are unchanged from the pre-cache matcher — fields are still
   * tested one at a time, left to right, stopping at the first hit, so
   * `{ a: 'foo', b: 'bar' }` never matches `'obar'`:
   *
   * - explicit `keys`: `String(_read(row, key) ?? '')` per key.
   * - empty `keys`, primitive / `null` / `undefined` row: the single
   *   `String(row ?? '')`.
   * - empty `keys`, object row ("natural fields"): every own enumerable
   *   `string` / `number` / `boolean` value as `String(value)`. Nested
   *   objects, arrays and functions are skipped, as before.
   *
   * **Invariant:** fields are always consulted in index order and the loop
   * stops at the first hit, so `cache` is always the normalised prefix
   * `[0, cache.length)` of this row's field list — which makes
   * `i === cache.length` an exact "not normalised yet" test.
   *
   * The corollary is that `keys` must be the same value `_haystack` was keyed
   * on, i.e. `_searchKeys()`; reading `_search()!.keys` here instead would let
   * entry `i` answer for a different key than the one it was normalised from.
   */
  private _matchesQuery(
    row: T,
    keys: readonly string[],
    cache: string[],
    normalizedQuery: string,
  ): boolean {
    if (keys.length > 0) {
      for (let i = 0; i < keys.length; i++) {
        if (i === cache.length) {
          cache.push(normalizeForMatch(String(this._read(row, keys[i]) ?? '')));
        }
        if (cache[i].includes(normalizedQuery)) return true;
      }
      return false;
    }
    if (row === null || typeof row !== 'object') {
      if (cache.length === 0) cache.push(normalizeForMatch(String(row ?? '')));
      return cache[0].includes(normalizedQuery);
    }
    let i = 0;
    for (const value of Object.values(row as Record<string, unknown>)) {
      if (
        typeof value !== 'string' &&
        typeof value !== 'number' &&
        typeof value !== 'boolean'
      ) {
        continue;
      }
      if (i === cache.length) cache.push(normalizeForMatch(String(value)));
      if (cache[i].includes(normalizedQuery)) return true;
      i++;
    }
    return false;
  }

  /**
   * @private Pairs a filter with the one comparand normalisation its operator
   * needs — computed once per `_filtered` pass instead of once per row — and
   * with its column's memo out of `memos`, created on first sight of the key.
   *
   * Only `contains` / `not-contains` read `normalizedValue`; the identity
   * operators (`equals`, `not-equals`, `in`, `not-in`) must not pay for it.
   */
  private _prepareFilter(
    f: MlvFilterState,
    memos: Map<string, string[]>,
  ): MlvPreparedFilter {
    let memo = memos.get(f.key);
    if (memo === undefined) {
      memo = [];
      memos.set(f.key, memo);
    }
    const normalizesValue =
      f.operator === 'contains' || f.operator === 'not-contains';
    return {
      state: f,
      normalizedValue: normalizesValue
        ? normalizeForMatch(String(f.value ?? ''))
        : '',
      memo,
    };
  }

  /**
   * @private This row's filtered column value, normalised at most once per
   * `(data array, filter key)` pair.
   *
   * `??=` and not `||=`: a nullish cell stringifies to `''`, which is a
   * perfectly good memo entry and must not be recomputed on every later pass —
   * exactly the case `contains` sees most of, since a missing column reads as
   * `undefined` for every row that lacks it.
   *
   * `index` is the row's position in `_rawData()`, which is what `_filtered`
   * iterates in both of its branches, so the memo stays index-aligned with the
   * array its generation was keyed on.
   */
  private _filterColumnText(
    index: number,
    value: unknown,
    f: MlvPreparedFilter,
  ): string {
    return (f.memo[index] ??= normalizeForMatch(String(value ?? '')));
  }

  /**
   * @private Evaluates a single prepared filter against a row, returning `true`
   * when the row passes.
   *
   * `_read` is hoisted above the switch and therefore still runs on a memo hit,
   * where `contains` / `not-contains` will not look at `val` at all. That is
   * one wasted property read per row per pass, kept deliberately: the four
   * identity operators need `val` from this same read, and pushing it into the
   * two arms that use it would make the number of times a column's getter is
   * invoked depend on whether its memo happens to be warm. A column backed by a
   * throwing or counting getter keeps firing once per row per pass exactly as
   * it did before the memo — pinned by the `_read`-count guard in the spec.
   */
  private _applyFilter(row: T, index: number, f: MlvPreparedFilter): boolean {
    const val = this._read(row, f.state.key);
    const fval = f.state.value;
    switch (f.state.operator) {
      case 'equals':
        return val === fval;
      case 'not-equals':
        return val !== fval;
      case 'contains':
        return this._filterColumnText(index, val, f).includes(
          f.normalizedValue,
        );
      case 'not-contains':
        return !this._filterColumnText(index, val, f).includes(
          f.normalizedValue,
        );
      case 'in':
        return Array.isArray(fval) && fval.includes(val);
      case 'not-in':
        return Array.isArray(fval) && !fval.includes(val);
      default:
        return true;
    }
  }
}
