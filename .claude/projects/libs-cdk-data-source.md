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

### Search cost — the lazy normalisation memo

Typing must not re-normalise the dataset. Each searched field is normalised
**at most once per `(data array identity, search keys)` pair** into a private
`_haystack` computed — a `string[][]` index-aligned with the data array — and a
keystroke over already-seen fields then costs exactly one `normalizeForMatch`
(the query) plus a `String.includes` scan.

The memo is filled **lazily**, not up front. `_haystack` itself does no work: it
hands out one empty array per row and exists only to key the memos on
`(data, keys)`. `_matchesQuery` walks a row's fields in index order, normalising
field `i` only when it reaches it, and stops at the first hit — so each entry is
always the normalised _prefix_ `[0, entry.length)` of that row's field list, and
`i === entry.length` is an exact "not normalised yet" test. A row whose first
key matches never pays for the rest, exactly as the pre-change matcher did.

The keys are split out of `_search()` into a `_searchKeys` computed with an
element-wise `equal`, so a `setSearch` that changes only `query` (and, because
`setSearch` copies `keys` defensively, always hands over a fresh array) leaves
`_haystack` valid.

Measured over 10 000 rows × 5 keys, a 6-keystroke session (median of 11 runs):

| scenario                              | before  | after      |
| ------------------------------------- | ------- | ---------- |
| steady state, broad query             | 25.0 ms | **1.1 ms** |
| steady state, query matching last key | 62.6 ms | **2.8 ms** |
| steady state, query matching nothing  | 68.7 ms | **2.6 ms** |
| first keystroke alone, broad query    | 4.8 ms  | 4.9 ms     |
| new data array on every keystroke     | 25.2 ms | 28.1 ms    |

The last two rows are the point of the lazy fill: the short-circuit is
preserved, so the cases that cannot benefit from a memo are not made worse. An
eager haystack (normalising every field as soon as the computed runs) reached
the same steady-state numbers but cost 12.9 ms and 71.5 ms on those two rows —
a 2.6–2.8× regression against the pre-change matcher.

Fields are matched **separately**, never joined into one string, so
`{ a: 'foo', b: 'bar' }` still does not match `'obar'` — a join would have
matched it.

Mutating a memo array from inside `_filtered` is memoisation, not reactive
state: no signal is written, so there is no glitch and no purity hazard, and
each entry is a pure function of `(row identity, field index)`. A partially
filled entry is never mistaken for "no match" — the walk is driven by the field
list, not by the memo's length — so `_filtered` re-running because `_filters()`
or the query changed, while the haystack generation is unchanged, reuses the
prefix and extends it as needed.

Three consequences to know about:

- **Staleness.** A row object mutated **in place**, without publishing a new
  array reference, is no longer re-read on the next keystroke; the cached memo
  keeps the old text until the data signal emits a new array. Mutating
  without a new reference already breaks the signal contract (`_rawData` uses
  default `Object.is` equality, so `set(sameArray)` never notifies), but it used
  to work by accident for search. Publish a new array — `data.set([...rows])` —
  after mutating rows.
- **Memory.** The normalised strings stay retained for as long as the source is
  alive, bounded by rows × searched fields — 10 000 rows × 5 keys ≈ 50 000
  strings ≈ 3 MiB at the worst case, and only for fields actually consulted, so
  a query that keeps matching on the first key retains a fifth of that. There is
  no eviction; a source over a very large array that is only searched
  occasionally pays that in resident memory.
- **Data churn.** A consumer that replaces the whole array on _every_ keystroke
  (server-side filtering fed into an array source) rebuilds the memo each time
  and gains nothing from it — 28.1 ms vs the old matcher's 25.2 ms above. The
  lazy fill keeps that to roughly break-even rather than a multiple, but a
  custom `MlvDataSource` subclass is still the right shape for server-filtered
  data.

`contains` / `not-contains` normalise their comparand **once per filter pass**
rather than once per row; the identity operators (`equals`, `not-equals`, `in`,
`not-in`) never normalise it at all.

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
  search, filtering, and sorting over an array containing `null`). It also
  carries the haystack guards:
  - a verbatim copy of the pre-cache `_matchesQuery` / `_applyFilter` /
    `_filtered` logic kept as an **oracle**, and a table of cases (explicit
    keys, natural fields, primitive rows, array/object values that must be
    skipped, accents in either direction, missing keys, nullish values, empty
    and whitespace-only queries, search ANDed with filters) asserted equal to
    it;
  - the cross-field false positive (`'obar'` over `{ a: 'foo', b: 'bar' }`),
    which is the test a naive join fails;
  - **normalisation-count** guards. `normalizeForMatch` is wrapped through a
    `vi.mock` of `@malva-ui/cdk/utils` that counts calls and delegates, so the
    counts survive the ASCII fast path planned for that util. They pin exact
    numbers, each with its derivation in a comment: N keystrokes over R rows
    that all match on the first of K keys cost `R + N` (the lazy short-circuit
    — an eager haystack would cost `R*K + N`); a query that matches nothing
    costs `1 + R*K` once and `1` thereafter; walking from key 1 to key 3 costs
    `1 + 2R`; a changed `keys` array (including a reorder) or a new data
    reference rebuilds, a changed `query` does not; a `contains` filter costs
    `R + 2` (not `2R + 1`), and identity operators cost 1;
  - **lazy-memo correctness** guards: a query moving between fields in both
    directions, a key-list reorder, natural fields after the data array is
    replaced, and a partially filled memo staying valid when only `_filters()`
    changes;
  - one case per filter operator, including an unrecognised operator hitting
    `default`, each also cross-checked against the oracle.

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
