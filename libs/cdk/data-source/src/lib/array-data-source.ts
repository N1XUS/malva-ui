import type { Signal } from '@angular/core';
import { computed, signal } from '@angular/core';
import { normalizeForMatch } from '@malva-ui/cdk/utils';
import { MlvDataSource } from './data-source';
import type { MlvFilterState } from './data-source.types';

/**
 * @private One active filter plus the comparand normalisation hoisted out of
 * the row loop.
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
   * computed holds a value, and a row object mutated in place without
   * publishing a new array reference is not re-read. See the library
   * CLAUDE.md.
   */
  private readonly _haystack = computed<readonly string[][]>(() => {
    this._searchKeys();
    return this._rawData().map(() => []);
  });

  /** @private Raw data passed through the active filter predicates. */
  private readonly _filtered = computed<T[]>(() => {
    const data = this._rawData();
    const filters = this._filters();
    const search = this._search();
    const normalizedQuery = normalizeForMatch(search?.query.trim() ?? '');

    if (!filters.length && !normalizedQuery) return data;

    // Hoisted once per pass: `contains`/`not-contains` used to re-normalise
    // their constant comparand for every single row.
    const prepared = filters.map((f) => this._prepareFilter(f));

    if (!normalizedQuery) {
      return data.filter((row) =>
        prepared.every((f) => this._applyFilter(row, f)),
      );
    }

    const keys = this._searchKeys();
    const haystack = this._haystack();
    return data.filter(
      (row, index) =>
        this._matchesQuery(row, keys, haystack[index], normalizedQuery) &&
        prepared.every((f) => this._applyFilter(row, f)),
    );
  });

  /** @private Filtered data sorted by the active sort state (stable copy). */
  private readonly _sorted = computed(() => {
    const data = [...this._filtered()];
    const sort = this._sort();
    if (!sort) return data;
    return data.sort((a, b) => {
      const av = this._read(a, sort.key);
      const bv = this._read(b, sort.key);
      let cmp: number;
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv;
      } else {
        cmp = String(av ?? '').localeCompare(String(bv ?? ''), undefined, {
          numeric: true,
        });
      }
      return sort.direction === 'asc' ? cmp : -cmp;
    });
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
   * needs, computed once per `_filtered` pass instead of once per row. Only
   * `contains` / `not-contains` read `normalizedValue`; the identity operators
   * (`equals`, `not-equals`, `in`, `not-in`) must not pay for it.
   */
  private _prepareFilter(f: MlvFilterState): MlvPreparedFilter {
    const normalizesValue =
      f.operator === 'contains' || f.operator === 'not-contains';
    return {
      state: f,
      normalizedValue: normalizesValue
        ? normalizeForMatch(String(f.value ?? ''))
        : '',
    };
  }

  /** @private Evaluates a single prepared filter against a row, returning `true` when the row passes. */
  private _applyFilter(row: T, f: MlvPreparedFilter): boolean {
    const val = this._read(row, f.state.key);
    const fval = f.state.value;
    switch (f.state.operator) {
      case 'equals':
        return val === fval;
      case 'not-equals':
        return val !== fval;
      case 'contains':
        return normalizeForMatch(String(val ?? '')).includes(f.normalizedValue);
      case 'not-contains':
        return !normalizeForMatch(String(val ?? '')).includes(
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
