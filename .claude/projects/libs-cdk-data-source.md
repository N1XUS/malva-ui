# Library: data-source (`@malva-ui/cdk/data-source`)

> **Keep this file up to date.** Always update this file whenever you change the shared data-source abstractions, their public API, packaging, or dependency wiring.

## Overview

`@malva-ui/cdk/data-source` is a headless CDK leaf library holding the
signal-based data-source contract shared by `mlv-data-table` and the option
controls (`mlv-select`, `mlv-combobox`, `[mlvAutocomplete]`).

The abstract base and the in-memory array source previously lived in
`libs/core/data-table/src/lib/data-source.ts`. Because `@malva-ui/core/data-table`
imports from `@malva-ui/core/dropdown`, dropdown-side libraries could not import
them back without a cycle. Moving them into the CDK family breaks that cycle:
both the table and the option controls now depend downwards on the same
primitives.

It contains **no components, directives, or services** — only two classes and a
types module. It is registered as a secondary entry point of the `@malva-ui/cdk`
package (alongside `accessibility`, `density`, `floating-container`,
`infinite-scroll`, `overlay`, `utils`) and is re-exported from `@malva-ui/cdk`.

## Public API

Exported from `libs/cdk/data-source/src/index.ts`:

| Export                        | Kind           | Description                                                                                                                                                                                                                    |
| ----------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `MlvDataSource<T>`            | Abstract class | Base contract: sort / filter / search / page / perPage / loading state plus the abstract `totalItems` and `connect()`.                                                                                                         |
| `MlvArrayDataSource<T>`       | Class          | In-memory source over a `T[]` or `Signal<T[]>` — filters, searches, sorts and paginates locally.                                                                                                                               |
| `MlvSortDirection`            | Type alias     | `'asc' \| 'desc'`.                                                                                                                                                                                                             |
| `MlvSortState`                | Interface      | `{ key, direction }`.                                                                                                                                                                                                          |
| `MlvDataSourceFilterOperator` | Type alias     | `'contains' \| 'not-contains' \| 'equals' \| 'not-equals' \| 'in' \| 'not-in'` — the predicates `MlvArrayDataSource` evaluates. Named to avoid colliding with `@malva-ui/core/filter`'s wider `MlvFilterOperator` (see below). |
| `MlvFilterState`              | Interface      | `{ key, operator, value }` — one column predicate.                                                                                                                                                                             |
| `MlvSearchState`              | Interface      | `{ query, keys }` — global query plus the keys it may inspect. An **empty** `keys` array means "natural fields" (see below).                                                                                                   |
| `MlvDataSourceState`          | Interface      | `{ sort, filters, search?, page, perPage }` — a serialisable snapshot shape. `search` is optional for pre-global-search data sources.                                                                                          |

## `MlvDataSource<T>`

**File:** `libs/cdk/data-source/src/lib/data-source.ts`

### Protected writable signals (for subclasses)

| Member     | Type                                     | Default | Purpose                                                     |
| ---------- | ---------------------------------------- | ------- | ----------------------------------------------------------- |
| `_sort`    | `WritableSignal<MlvSortState \| null>`   | `null`  | Active sort.                                                |
| `_filters` | `WritableSignal<MlvFilterState[]>`       | `[]`    | Active column predicates.                                   |
| `_search`  | `WritableSignal<MlvSearchState \| null>` | `null`  | Global query + allowed keys.                                |
| `_page`    | `WritableSignal<number>`                 | `1`     | Current **1-based** page.                                   |
| `_perPage` | `WritableSignal<number>`                 | `10`    | Page size. `Infinity` disables slicing in the array source. |
| `_loading` | `WritableSignal<boolean>`                | `false` | In-flight flag — see "Loading" below.                       |

### Readonly signals (public)

`sort`, `filters`, `search`, `page`, `perPage`, `loading` — the `asReadonly()`
views of the six writers above.

### Abstract members

| Member       | Type             | Contract                                                                                                       |
| ------------ | ---------------- | -------------------------------------------------------------------------------------------------------------- |
| `totalItems` | `Signal<number>` | Total item count **after** filtering/search. Paged remote sources return the server total, not the slice size. |
| `connect()`  | `Signal<T[]>`    | The **current page's slice**. Consumers that page lazily (dropdowns) accumulate slices themselves.             |

### Mutators

| Method             | Resets page to 1 | Notes                                                                     |
| ------------------ | ---------------- | ------------------------------------------------------------------------- |
| `setSort(state)`   | yes              |                                                                           |
| `setFilters(list)` | yes              |                                                                           |
| `setSearch(state)` | yes              | Copies `keys` defensively, so a caller mutating its array cannot leak in. |
| `setPerPage(n)`    | yes              |                                                                           |
| `setPage(n)`       | —                | 1-based.                                                                  |

### `connect()` contract — current page slice

`connect()` returns the slice for the **current page only**, never the
accumulated result. `mlv-data-table` renders that slice directly. The option
controls page lazily: they read `page()`/`perPage()`, call `setPage(page + 1)`
to request more, and append each new slice to what they already show. A source
that returned a growing array would double-count in the table.

### Loading

Subclasses flip `_loading` **synchronously** — set it `true` in the same tick
the request is issued, and back to `false` when it settles (success _or_
failure). This lets consumers distinguish "loaded and genuinely empty" (show the
empty state) from "not fetched yet" (show a spinner). A source that only sets
the flag inside an async callback leaves one frame where both `loading()` and
the data are false/empty, which renders as a flash of the empty state.

```ts
class RemoteUsers extends MlvDataSource<User> {
  private readonly _rows = signal<User[]>([]);
  readonly totalItems = signal(0);

  connect(): Signal<User[]> {
    return this._rows.asReadonly();
  }

  async fetch(): Promise<void> {
    this._loading.set(true); // synchronous, before the await
    try {
      const page = await api.users(this.page(), this.perPage(), this.search()?.query);
      this._rows.set(page.items);
      this.totalItems.set(page.total);
    } finally {
      this._loading.set(false);
    }
  }
}
```

## `MlvArrayDataSource<T>`

**File:** `libs/cdk/data-source/src/lib/array-data-source.ts`

```ts
new MlvArrayDataSource(rows); // plain array — wrapped in a signal
new MlvArrayDataSource(rowsSignal); // Signal<T[]> — tracked reactively
```

`T` is unconstrained: rows may be objects **or** primitives (`string[]`,
`number[]`), which is what the option controls pass.

Because of that, every keyed read (`sort.key`, `filter.key`, an explicit search
key) goes through one private `_read(row, key)` helper that yields `undefined`
for a primitive, `null`, or `undefined` row instead of throwing. Sorting,
filtering, and keyed search therefore all treat a nullish row as "this property
is absent" and sort it to the front under `asc` (empty string comparand), rather
than crashing on a mixed array.

Pipeline per read: `filter (search AND every column predicate)` → `sort` →
`slice(page, perPage)`. `totalItems()` is the post-filter count. A non-finite
`perPage` (`Infinity`) disables slicing.

Filter operators: `contains`, `not-contains`, `equals`, `not-equals`, `in`,
`not-in`. `contains`/`not-contains` compare through `normalizeForMatch` from
`@malva-ui/cdk/utils`, so case and diacritics do not have to be typed exactly.
`in`/`not-in` require an array `value` and test membership by identity.

### Search — explicit keys vs natural fields

`setSearch({ query, keys })` normalises and trims `query`; a whitespace-only
query disables search. How a row is matched depends on `keys`:

| `keys`    | Matching                                                                                                                                                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| non-empty | OR across exactly those properties — `normalizeForMatch(String(row[key] ?? ''))`. Undeclared properties are never inspected.                                                                                                         |
| **empty** | **Natural fields.** A primitive (or `null`) row matches on `normalizeForMatch(String(row ?? ''))`; an object row matches on any own enumerable `string`/`number`/`boolean` value. Nested objects, arrays, and functions are skipped. |

Empty `keys` is the mode the option controls use — they know option shapes, not
column keys. The data table always passes its `searchable` column keys, so its
behaviour is unchanged.

```ts
const cities = new MlvArrayDataSource(['Paris', 'Café de Flore']);
cities.setSearch({ query: 'cafe', keys: [] }); // → ['Café de Flore']
```

> Natural-field search inspects **every** own primitive value, including fields
> a table would deliberately hide. Pass explicit `keys` whenever a row carries
> data that must not be searchable.

## Dependencies

| Package               | Usage                                                    |
| --------------------- | -------------------------------------------------------- |
| `@angular/core`       | `signal`, `computed`, `Signal` — no decorators, no DI    |
| `@malva-ui/cdk/utils` | `normalizeForMatch` for search and `contains` comparison |

No new external peer dependencies. As a CDK library it must never import
`@malva-ui/core/*`.

## Used by

| Consumer                    | How                                                                                                                                                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@malva-ui/core/data-table` | Star-re-exports the whole entry point (`export * from '@malva-ui/cdk/data-source'`) for compatibility; wraps plain `[data]` arrays in `MlvArrayDataSource`. Keeps `MlvDataTableFilterOperator` as a deprecated alias of `MlvDataSourceFilterOperator`. |
| `@malva-ui/core/dropdown`   | Option sources for `mlv-select`, `mlv-combobox` and `[mlvAutocomplete]`.                                                                                                                                                                               |

### Why the operator type is not called `MlvFilterOperator`

`@malva-ui/core/filter` already exports a public `MlvFilterOperator` — a
16-member union for its condition model (`starts-with`, `between`, `empty`, …).
This library's 6-member predicate union is a different type with a different
domain, so it is named `MlvDataSourceFilterOperator`. Two same-named public
types in one product family is a footgun for consumers, and it is also a hard
build error: `@malva-ui/core/data-table` re-exports this entry point, and the
`@malva-ui/core` root barrel star-exports both `data-table` and `filter`, which
TypeScript rejects with TS2308 when the two names resolve to different
declarations.

## Testing

- `libs/cdk/data-source/src/lib/data-source.spec.ts` — base class through a stub
  subclass: `loading` default and readonly projection, `page`/`perPage` defaults,
  page reset on every mutator, and the defensive `keys` copy in `setSearch`.
- `libs/cdk/data-source/src/lib/array-data-source.spec.ts` — the ported
  data-table suite (keyed search, diacritics, filter operators, search AND
  filters, pagination reset, signal-backed data, whitespace/null search), the
  natural-field cases (primitive rows, object rows, explicit keys still scoped),
  a paging block (default `perPage` slicing), and a nullish-row block (keyed
  search, filtering, and sorting over an array containing `null`).

`data-source.types.ts` is types only (no test).

## File Structure

```
libs/cdk/data-source/src/
  index.ts                       — public API barrel
  test-setup.ts
  lib/
    data-source.types.ts         — MlvSortDirection/SortState/DataSourceFilterOperator/FilterState/SearchState/DataSourceState
    data-source.ts               — MlvDataSource<T>
    data-source.spec.ts          — base class unit tests
    array-data-source.ts         — MlvArrayDataSource<T>
    array-data-source.spec.ts    — array source unit tests
```
