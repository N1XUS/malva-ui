import type { Signal } from '@angular/core';
import { computed, signal } from '@angular/core';
import { normalizeForMatch } from '@malva-ui/cdk/utils';
import { MlvDataSource } from './data-source';
import type { MlvFilterState } from './data-source.types';

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

  /** @private Raw data passed through the active filter predicates. */
  private readonly _filtered = computed(() => {
    const data = this._rawData();
    const filters = this._filters();
    const search = this._search();
    const normalizedQuery = normalizeForMatch(search?.query.trim() ?? '');

    if (!filters.length && !normalizedQuery) return data;

    return data.filter((row) => {
      const matchesSearch =
        !normalizedQuery ||
        this._matchesQuery(row, search?.keys ?? [], normalizedQuery);

      return matchesSearch && filters.every((f) => this._applyFilter(row, f));
    });
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
   * @private Whether a row matches the normalised query. With explicit `keys`
   * only those properties are inspected. With empty `keys` ("natural fields"):
   * primitives match on `String(row)`, objects on every own enumerable
   * string / number / boolean value.
   */
  private _matchesQuery(
    row: T,
    keys: readonly string[],
    normalizedQuery: string,
  ): boolean {
    if (keys.length > 0) {
      return keys.some((key) =>
        normalizeForMatch(String(this._read(row, key) ?? '')).includes(
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

  /** @private Evaluates a single filter against a row, returning `true` when the row passes. */
  private _applyFilter(row: T, f: MlvFilterState): boolean {
    const val = this._read(row, f.key);
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
}
