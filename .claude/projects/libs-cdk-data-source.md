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
is absent" rather than crashing on a mixed array.

That absent value collates as the empty string, so such a row leads under `asc`
— with one exception. A row that is literally `undefined` never reaches the
comparator at all and sinks to the end in **both** directions, because
`Array.prototype.sort` hoists `undefined` elements itself. `null` rows and
`undefined` rows therefore sort to opposite ends. See the sort section below for
the mechanism, and issue #83 for whether that asymmetry should be kept.

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

### Sort cost — decorate–sort–undecorate + one hoisted collator

`_sorted` decorates before it sorts. Each row becomes one `MlvSortEntry`
(`{ row, value, text }`), the decorated array is sorted, and the rows are mapped
back out. `_read` therefore runs **once per row** and `String(value ?? '')` **at
most once per row**, instead of twice per _comparison_: O(n) conversions instead
of O(n log n). The comparator itself allocates nothing.

`text` is filled **lazily**, the first time a comparison actually reaches the
collator branch. Eager decoration would have turned an all-numeric column's 0
string allocations into one per row — a regression on the most common table
sort. Lazy fill is `≤` the old comparator in every case.

The string branch reads one module-scope `Intl.Collator(undefined,
{ numeric: true })`. `localeCompare(that, undefined, { numeric: true })`
initialises a fresh collator on **every call**, so locale resolution used to be
O(n log n) per sort as well.

> **The sort locale is the host's, not the app's.** `undefined` locales resolves
> the runtime default (`navigator.language` and friends) once, when the module
> is first imported — exactly what the per-call form resolved.
> `MlvI18nService.switchLanguage()` swaps the translation pack and nothing else,
> so sorting has never followed the app language and does not start to. A source
> that must collate in the app's language needs its own comparator.

Measured on the real class over 10 000 rows, one `asc` pass (plus one `desc`
pass for the collator row):

| per sort, 10 000 rows                      | before  | after                    |
| ------------------------------------------ | ------- | ------------------------ |
| collator resolutions (`asc` + `desc`)      | 130 704 | **0** (1 at module load) |
| `_read` calls                              | 130 702 | **10 000**               |
| `String(… ?? '')` conversions              | 130 702 | **10 000**               |
| `String()` conversions, all-numeric column | 0       | **0** (unchanged)        |

Wall clock over the same 10 000 rows, median of 11 runs:

| workload                                   | before   | after       | speedup |
| ------------------------------------------ | -------- | ----------- | ------- |
| string column, all values distinct, `asc`  | 204.9 ms | **15.8 ms** | 13.0×   |
| string column, all values distinct, `desc` | 207.3 ms | **15.8 ms** | 13.1×   |
| low-cardinality string column (4 groups)   | 91.5 ms  | **3.9 ms**  | 23.2×   |
| numeric column                             | 1.8 ms   | **1.0 ms**  | 1.8×    |

Ordering is unchanged, verified rather than asserted: a differential fuzz of
**250 000 iterations / 500 000 sorts / 9 979 850 compared elements** against a
verbatim copy of the pre-change comparator reports **0 divergences**. Arrays of
0-40 rows over mixed numbers, numeric strings, `NaN`, ±`Infinity`, `-0`, huge and
denormal numbers, booleans, `Date`s (including an invalid one), NFC/NFD pairs,
ligatures, astral characters and emoji, 200-character strings, `bigint`s,
`symbol`s, arrays, objects with a `toString`, `Object.create(null)` rows, and
`null` / `undefined` **rows** as well as values; both directions; a present and
an absent sort key. Elements are compared with `Object.is` at each index, so the
check is exact permutation identity, not deep equality.

That includes the parts that look like bugs:

- The branch keys off the **pair** (`typeof av === 'number' && typeof bv ===
'number'`), never off one value or off the column. A column mixing numbers and
  strings compares number/number numerically and everything else through the
  collator — `[1.5, 1.25]` sorts to `[1.25, 1.5]` while `[1.5, '1.25']` sorts to
  `[1.5, '1.25']`. That is why `value` is decorated raw alongside `text` and
  cannot be collapsed to a single key.
- A `null` or `undefined` **cell value** collapses to `''`, so the two tie with
  each other and with an empty string, and sort ahead of any stringified number.
- A row that is literally `undefined` is the exception to that, and the two
  nullish cases stop behaving alike: `Array.prototype.sort` resolves every pair
  involving an `undefined` **element** itself, parking it at the end in _both_
  directions without ever calling the comparator (ECMA-262
  `CompareArrayElements` steps 1-2). A `null` row is not hoisted and does go
  through the comparator, so it leads under `asc`. Decorating therefore has to
  map an `undefined` row to an `undefined` entry rather than wrapping it —
  wrapping would hand it to the comparator, where it reads as `''` and leads
  under `asc` instead of sinking. Pinned in both directions by the
  `sort ordering parity — nullish rows` table.
- `numeric: true` is load bearing: `'item2'` before `'item10'`.
- A number column containing `NaN` makes the comparator return `NaN`, and the
  resulting permutation is engine-defined. Preserved, not fixed. It is reachable
  without any `NaN` in the data, too: `Infinity - Infinity` is `NaN`, so a column
  that merely repeats an infinity hits the same path. Those two cases are
  asserted against the oracle only, never against a literal order — the literal
  would pin what V8 happens to do today and would flip on a V8 change with
  nothing of ours having changed. The oracle runs in the same engine, so it
  still pins the property that matters: unchanged from before.
- `Array.prototype.sort` is stable (ES2019) and the decorated array is what gets
  sorted, so equal keys keep their input order.

Three things that are _not_ byte-identical. None affects ordering or length, and
the fuzz above does not cover them because they are not ordering properties:

- **Sparse arrays keep their holes.** `sort` used to fill them; `map` preserves
  them, so `2 in result` can now be `false` where it was `true`. Reading the
  index yields `undefined` either way.
- **An impure `toString` is now called once per row, not once per comparison**,
  so a value that returns different text on each call gets one stable comparand.
  That removes a non-transitive comparator — an improvement, kept deliberately.
- **A one-row table whose sort-key getter throws now throws.** `_read` runs in
  the decorate step, where the old code never invoked the comparator at all at
  `N = 1`.

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

  It also carries the **sort** guards:
  - an **ordering parity table** (17 columns × both directions) asserted twice:
    against a literal expected order _and_ against a verbatim copy of the
    pre-decoration comparator kept as a second oracle. It covers nullish vs
    `''` vs text vs numbers, a mixed number/string column in both pair orders,
    the `[1.5, 1.25]` / `[1.5, '1.25']` pair that separates the two branches,
    `numeric: true` (`'item2'` before `'item10'`), `NaN`, ±`Infinity`, `-0`,
    booleans, `Date`s, objects with a `toString`, an all-equal column, and the
    empty / single-row columns. Running the same cases through the second
    oracle is what keeps the engine-defined `NaN` permutation honest;
  - a second, **row-level** parity table (`sort ordering parity — nullish
rows`) for the case the value-level table structurally cannot reach: the
    array itself holding `null` / `undefined` rows, where `sort`'s own
    element hoisting — not the comparator — decides the order, and where the
    two nullish kinds stop behaving alike. It includes the paging symptom
    (`perPage: 2` over `[undefined, {v:'a'}, {v:'b'}]` must not put a blank
    row on page 1);
  - identity guards: `_sorted` returns a fresh array and leaves both the
    caller's array and `_filtered()` untouched, sorted or not;
  - **stability** over 1 024 rows in 4 groups, both directions;
  - **cost** guards over 512 rows, each with its bound derived in a comment.
    Collator resolutions (counted by subclassing `Intl.Collator` _and_
    patching `String.prototype.localeCompare`, the two ways to reach one) are
    `≤ 1` per sort pass where the old comparator needed 511 – ≈4 600.
    `_read` calls and `String()` conversions (counted with a getter and a
    counting `toString` on the row) are exactly `N`, where the old comparator
    did 2 per comparison. A third guard swaps `globalThis.String` for the
    duration of one `connect()()` and pins an all-numeric column at **0**
    string conversions — the regression eager decoration would introduce.

- `libs/core/data-table/src/lib/data-source-sort-locale.spec.ts` — the
  locale-switch guard. Sorting resolves the **host** locale, so
  `MlvI18nService.switchLanguage()` must not move a row; the words are chosen
  so Turkish collation genuinely disagrees with the host's (dotless `ı`), and
  the test fails loudly if the host default ever coincides. It lives in
  `core-data-table` rather than next to the data source because
  `@nx/enforce-module-boundaries` restricts `family:cdk` to `family:cdk`, so
  `libs/cdk/data-source` may not import `@malva-ui/i18n` even from a spec.

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
