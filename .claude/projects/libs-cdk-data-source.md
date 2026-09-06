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

For **sorting**, a nullish row goes further than "this property is absent": it
is an absent _record_, and since #83 it sinks to the end in **both**
directions. `null` and `undefined` rows are indistinguishable, they form a
trailing run, and their relative order inside that run is the input's. They
never reach the comparator — `_sorted` partitions them out before the sort and
appends them afterwards. See the sort section below.

Filtering and keyed search are unaffected: there a nullish row still reads as
an absent property value and participates normally.

Before #83 the two diverged, and neither half was a decision:
`Array.prototype.sort` hoisted `undefined` **elements** to the end by itself,
while a `null` row went through the comparator, read as `''` and led under
`asc`. See
[docs/migrations/2026-09-data-source-sort-semantics.md](../../docs/migrations/2026-09-data-source-sort-semantics.md).

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

### Filter cost — the per-column normalisation memo

Both sides of a `contains` / `not-contains` predicate are memoised, on
different clocks:

| side                       | normalised                                   | held in                            |
| -------------------------- | -------------------------------------------- | ---------------------------------- |
| comparand (`filter.value`) | once per `_filtered` **pass**                | `_prepareFilter`'s prepared filter |
| row value (`row[key]`)     | once per `(data array identity, filter key)` | `_filterHaystack`, a column memo   |

The identity operators (`equals`, `not-equals`, `in`, `not-in`) compare by
identity and normalise **neither** side.

`_filterHaystack` is shaped like `_haystack` and does no work either: it hands
out an empty `Map<string, string[]>` and exists only to key the memos on
`(data array identity, filter key set)`. The shared shape is where the
resemblance stops — see the eviction note below. `_prepareFilter` creates a
column's entry on first
sight of the key, and `_applyFilter` fills row `i` of it with `??=` the first
time a pass actually reaches that row — so the short-circuiting `every` is
preserved and a row an earlier filter already rejected never pays. `??=` and
not `||=`: a nullish cell stringifies to `''`, which is a valid memo entry and
must not be recomputed every pass.

The keys are split out of `_filters()` into a `_filterKeys` computed, so typing
in a filter input — which changes only `value`, handing over fresh
`MlvFilterState` objects every time — leaves the memo valid.

**`_filterKeys` is an eviction policy, not a correctness dependency**, and this
is where it differs from `_searchKeys` despite the identical shape. A
`_haystack` entry is indexed by _position in the key list_, so entry `i` only
answers for `keys[i]` and a reorder genuinely must rebuild — `_searchKeys` is
load-bearing. A `_filterHaystack` entry is addressed by the key _string_; it is
a pure function of `(row identity, key)` and nothing the filter list does can
make it wrong. `_filterKeys` exists only to bound retention: normalised text is
held for the columns currently filtered and no others, so dropping a column
from the filter list releases its strings on the next read.

Because order is not part of that bound, `_filterKeys` canonicalises — it
deduplicates and sorts. That is not cosmetic: `mlv-data-table`'s per-column
funnel handler (`onColumnFiltersChange`) rebuilds `activeFilters` as "every
filter except the edited key, then the edited key", so **every column-filter
edit reorders the list**. Under a positional comparator that dropped every
memo on each edit, which is exactly the multi-filter case #64 is about.
Deduplicating likewise keeps the entry when one of two predicates on a single
column is removed. A changed **column set** rebuilds; a changed `value`,
`operator` or _order_ does not. Every filter is mapped into `_filterKeys`, not
just the two operators that read a memo, so flipping `equals` → `contains` on a
key already in the set keeps that column's cache.

The memo is keyed by **column key**, not by filter position, so a `contains`
and a `not-contains` on one column share a single entry and normalise it once
between them.

`_applyFilter` still hoists `_read` above its switch, so it runs on a memo hit
too, where `contains` / `not-contains` never look at the value. That is one
wasted property read per row per pass, kept deliberately: the identity
operators need the value from that same read, and moving it into the two arms
that use it would make the number of times a column's getter fires depend on
whether its memo is warm. A guard pins the count at one per row per pass across
a warm and a cold pass.

An active `contains` filter over R rows therefore costs `R + 2` on the first
pass and `2` on every later one (the empty search query plus the comparand),
instead of `R + 2` every pass — the point of #64. Combined with search, a
keystroke over a 10 000-row table with a column filter applied drops from
`2 × 10 000 + 2` normalisations to the 2 that are irreducible (the query and
the comparand); the row side goes to zero.

Two consequences carry over from `_haystack`. The normalised strings stay
retained for as long as the computed holds its value, bounded by rows ×
**currently filtered** columns. And an in-place mutation of the data is not
observed — in two different ways, worth separating:

- A **row object** mutated in place, with the same array reference published,
  keeps its cached text: the row answers with what it used to say.
- The **array itself** mutated in place (`splice`, `shift`, `sort`) is worse,
  because both memos are indexed by position. After `rows.shift()` row `i` is
  answered by row `i + 1`'s cached text — a row matched against a _different_
  row's value, not merely a stale one. One asymmetry: a _growing_ in-place
  mutation (`push`) makes `_haystack` throw, because the memo array is shorter
  than the data, while the filter memo stays silent and answers the new tail
  correctly by accident.

Neither is new to #64 — the search path has behaved this way since #4, and the
contract has always been that a `Signal<T[]>` publishes a new array reference.
The filter memo extends the same hazard to a second axis.

A column that is both searched and filtered is normalised once into each memo —
the two structures are independent, and deduplicating them is not worth
coupling the prefix-indexed search entry to the column-keyed filter one.

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

**That fuzz records #10, and #10 only.** It ran before #81 and #83, whose whole
point was to change ordering: a re-run today would report divergences for
nullish rows and for non-finite numeric columns, deliberately. The
still-standing claim is narrower than it reads — the _decoration rewrite_
introduced no drift. What each semantics change did and did not move is pinned
by the parity tables' `divergesFromOracle` markers instead.

That includes the parts that look like bugs:

- The branch keys off the **pair** (`typeof av === 'number' && typeof bv ===
'number'`), never off one value or off the column. A column mixing numbers and
  strings compares number/number numerically and everything else through the
  collator — `[1.5, 1.25]` sorts to `[1.25, 1.5]` while `[1.5, '1.25']` sorts to
  `[1.5, '1.25']`. That is why `value` is decorated raw alongside `text` and
  cannot be collapsed to a single key.
- A `null` or `undefined` **cell value** collapses to `''`, so the two tie with
  each other and with an empty string, and sort ahead of any stringified number.
- A nullish **row** is a different thing from a nullish cell value, and is not
  compared at all. `_sorted` partitions the filtered array into present rows
  and nullish rows, sorts only the former, and appends the latter — so a
  nullish row trails in both directions and the run keeps input order (#83).
  It is a partition rather than a comparator branch for three reasons: a branch
  would have to sit outside the `descending ? -cmp : cmp` negation or be
  flipped into the lead under `desc`; partitioning takes nullish rows out of
  the comparator's transitivity obligations entirely; and the comparator keeps
  its cost (no extra entry field, no extra test per comparison). It also drops
  the previous reliance on `Array.prototype.sort` hoisting `undefined`
  **elements** (ECMA-262 `CompareArrayElements` steps 1-2), which gave
  `undefined` rows the right answer for the wrong reason and `null` rows the
  wrong answer. Pinned by the `sort ordering parity — nullish rows` table,
  which asserts both the literal orders and the structural suffix property.
- `numeric: true` is load bearing: `'item2'` before `'item10'`.
- Who actually sees these two changes: `mlv-data-table` is the only component
  that sorts on its own (`data-table.ts` is the sole non-spec `setSort` call
  site in the repo). `mlv-select` / `mlv-combobox` / `[mlvAutocomplete]`
  inherit sorting through `MlvSelectDataSource` but never set a sort
  themselves, so their default behaviour is unchanged — they are affected only
  when a consumer sorts the source it was given.
- The numeric branch is `compareNumeric`, a **total order** ranked
  `-Infinity < finite < Infinity < NaN`, not `av - bv` (#81). Subtraction
  returned `NaN` whenever it was non-finite, and a comparator returning `NaN`
  leaves `Array.prototype.sort`'s permutation implementation-defined — so the
  result was neither ordered nor stable. That was reachable with no `NaN` in
  the data: `Infinity - Infinity` is `NaN`, so a column merely _repeating_ an
  infinity hit it.
  - `NaN` is a **rank**, not a pinned end: it trails under `asc` and leads
    under `desc`, like any other value. PostgreSQL orders float `NaN` above all
    other values including `Infinity`, so a client-side sort matches a
    database-side one. Contrast the nullish _row_ above, which is pinned last
    in both directions because it is an absent record rather than a value.
  - `-0` and `0` tie, as they did under subtraction; stability decides.
  - Proven by permutation-invariance rather than by a literal: an intransitive
    comparator makes `sort`'s output depend on input order, so
    `numeric sort is a total order` sorts all 720 permutations of one
    non-finite column and asserts a single distinct result. The same describe
    asserts the pre-#81 comparator produces **more** than one (81, in fact),
    so the defect stays demonstrable and the fix cannot be reverted green.
- **Known, pre-existing, out of scope:** the _mixed-type_ branch is still not
  transitive, independently of #81. Because the numeric branch keys off the
  pair, two negative numbers compare numerically while either against a string
  compares through the collator, whose `numeric: true` reads the digits after
  the `-` sign — so `-5 < -3` numerically, `'-3' < '-4'` and `'-4' < '-5'` by
  collation, and `[-5, -3, '-4']` is a cycle. Fixing it is a third semantics
  decision (what a mixed column _should_ mean), not part of #81.
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
  - **filter normalisation-count** guards, the same style one level down
    (`describe('MlvArrayDataSource filter normalisation cost')`): N passes over
    R rows moving only `filter.value` cost `R + 2 + 2(N-1)` rather than
    `N(R + 2)`; a changed filter `key` or a new data array rebuilds while a
    changed `value` does not; a **reorder** of the filter list does not (the
    shape `mlv-data-table` produces on every column-filter edit — the guard
    fails at `3 + 2R` against a positional comparator), nor does dropping one
    of two predicates on a single column (the dedupe); `_read` fires once per
    row per pass whether the memo is warm or cold; two `contains` filters on
    different keys memoise
    `R` each; a row rejected by an earlier filter never has its later columns
    normalised, and pays for exactly the one missing value when a widened
    filter reaches it; a nullish column value memoises as `''` and is not
    recomputed (the `??=` vs `||=` guard); a `contains` and a `not-contains` on
    one key share `R`; and search + filter across keystrokes costs `2R` once
    and `2` per later keystroke, with a search-key change rebuilding only the
    haystack;
  - **lazy-memo correctness** guards: a query moving between fields in both
    directions, a key-list reorder, natural fields after the data array is
    replaced, and a partially filled memo staying valid when only `_filters()`
    changes;
  - one case per filter operator, including an unrecognised operator hitting
    `default`, each also cross-checked against the oracle.

  It also carries the **sort** guards:
  - an **ordering parity table** (18 columns × both directions) asserted twice:
    against a literal expected order _and_ against a verbatim copy of the
    pre-decoration comparator kept as a second oracle. It covers nullish cell
    values vs `''` vs text vs numbers, a mixed number/string column in both
    pair orders, the `[1.5, 1.25]` / `[1.5, '1.25']` pair that separates the
    two branches, `numeric: true` (`'item2'` before `'item10'`), `NaN`,
    ±`Infinity`, the full non-finite ladder, `-0`, booleans, `Date`s, objects
    with a `toString`, an all-equal column, and the empty / single-row columns.
    A column where the **oracle** returns `NaN` for some pair carries
    `oracleIsImplementationDefined`, which skips the oracle cross-check for
    that case: the oracle has no defined answer there, so asserting either
    agreement _or_ disagreement would be asserting a property of V8's TimSort.
    The literal `asc` / `desc` expectation is the revert guard, and it is red
    against the pre-#81 comparator. Every other case still asserts oracle
    equality, which is what preserves #10's "no drift from the decoration
    rewrite" guarantee;
  - a second, **row-level** parity table (`sort ordering parity — nullish
rows`) for the case the value-level table structurally cannot reach: the
    array itself holding `null` / `undefined` rows. Each case is asserted three
    ways — the literal order, the oracle check (inverted for the directions
    #83 changed: the old path there is `sort`'s specified `undefined`
    hoisting, so "the old comparator still disagrees" is a claim about the
    spec rather than about an engine), and a
    **structural** invariant derived from the result (every nullish row is in
    the trailing run, no nullish row precedes it, and the run's order is the
    input's). It includes the paging symptom for both nullish kinds
    (`perPage: 2` over `[undefined, {v:'a'}, {v:'b'}]` and over
    `[null, {v:'a'}, {v:'b'}]` must not put a blank row on page 1) and a
    `totalItems` guard proving the partition drops no rows;
  - **`numeric sort is a total order`** — the transitivity proof for #81, run
    rather than argued. All 720 permutations of one non-finite column
    (`[3, NaN, 1, Infinity, -Infinity, NaN]`) are sorted and the results
    collapsed into a set: exactly one distinct output means the comparator
    induced a real total order, since an intransitive comparator makes `sort`'s
    output depend on the order it happens to compare things in. Necessary
    rather than sufficient, strictly — more than one distinct result _proves_
    intransitivity, while exactly one is strong evidence — so the claim it
    carries is "no intransitivity is observable over this domain".
    A companion case asserts the pre-#81 oracle yields more than one over the
    same input (81, in fact), which keeps the defect demonstrable. Note that
    companion tests only the spec-local oracle, so it can never go red from a
    source change; the revert guard is the `toBe(1)` half;
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
