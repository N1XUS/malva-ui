# 2026-09 — `MlvArrayDataSource` sort: nullish rows and non-finite numbers

**Packages:** `@malva-ui/cdk/data-source` (`MlvArrayDataSource`), and everything that sorts through it — `@malva-ui/core/data-table`, `@malva-ui/core/dropdown` (`MlvSelectDataSource`).
**Kind:** breaking, **behaviour only**. No public API changed: no symbol renamed, removed or retyped, no input, no method signature, **nothing to edit at a call site**. Two inputs come out of `_sorted` in a different order than before. Resolves #83 and #81.

---

## Why

Both were found while reviewing #10 (the decorate–sort–undecorate rewrite) and both were **deliberately left alone** by it: a performance change must carry no semantic drift, so the pre-existing ordering was pinned with parity tests rather than corrected. They were filed as #83 and #81 to be decided on their own. This is that decision.

Neither was a chosen behaviour. One was `Array.prototype.sort`'s semantics leaking through, the other was a comparator that forfeited its ordering guarantee.

---

## 1. A nullish **row** is an absent record and sinks to the end

### The distinction that matters

This is about an array **element** that is literally `null` or `undefined` — not about a row whose **cell** is nullish.

```ts
// A nullish ROW — an array element. Its order CHANGED.
const rows = [{ v: 'b' }, null, { v: 'a' }];

// A nullish CELL — a present row with an absent value. UNCHANGED.
const cells = [{ v: 'b' }, { v: null }, { v: 'a' }];
```

**Nullish cell values are unchanged.** `_read` yields `undefined`, `?? ''` makes it the empty string, and `''` collates before every non-empty string — so a row whose sorted column is `null`, `undefined` or `''` still ties with the others of that group and still leads under `asc`. Filtering and keyed search are likewise untouched, in both cases: there a nullish row still reads as "this property is absent" and participates normally, and it is still counted in `totalItems()`.

### Before and after

```ts
source.setData([{ v: 'b' }, undefined, null, { v: 'a' }]);
```

| Direction | Before                                | After                                 |
| --------- | ------------------------------------- | ------------------------------------- |
| `asc`     | `[null, {v:'a'}, {v:'b'}, undefined]` | `[{v:'a'}, {v:'b'}, undefined, null]` |
| `desc`    | `[{v:'b'}, {v:'a'}, null, undefined]` | `[{v:'b'}, {v:'a'}, undefined, null]` |

A nullish row now sinks to the end in **both** directions; `null` and `undefined` are indistinguishable; they form one trailing run whose internal order is the **input's**, not a rank. `[undefined, null]` stays `[undefined, null]` and `[null, undefined]` stays `[null, undefined]`, in both directions.

The headline change is the `null` row under `asc`. An `undefined`-only array is unaffected — it already landed last.

### Why it was asymmetric

Two different mechanisms, only one of them ours.

- A `null` row went **through** the comparator. `_read` yielded `undefined`, `?? ''` made it `''`, and `''` collates before every non-empty string — so it led under `asc` and sat behind the real rows under `desc`.
- An `undefined` row never reached the comparator at all. `Array.prototype.sort` resolves every pair involving an `undefined` **element** itself — always to the end, in both directions, without invoking the comparator (ECMA-262 `CompareArrayElements`, steps 1–2).

So `undefined` rows got the right answer for the wrong reason and `null` rows got the wrong answer. With paging that was visible: a blank row at the top of page 1 pushing a real row off it.

### Why a partition and not a comparator branch

Nullish rows are removed from the array before the sort and appended after it:

```ts
const present: MlvSortEntry<T>[] = [];
const nullish: T[] = [];
for (let i = 0; i < filtered.length; i++) {
  const row = filtered[i];
  if (row === null || row === undefined) nullish.push(row);
  else present.push({ row, value: this._read(row, sort.key), text: undefined });
}
// …present.sort(compare); then append `nullish` in order.
```

"Last in both directions" is a property of the row, not a rank among the values, and expressing it in the comparator is how that goes wrong:

- a comparator branch would have to sit **outside** the `descending ? -cmp : cmp` flip to avoid being inverted into the lead under `desc` — exactly the kind of ordering-dependent special case that breaks transitivity by accident;
- partitioning removes nullish rows from the transitivity question entirely: the comparator only ever sees present rows;
- the comparator keeps its cost — no extra field on the entry, no extra test per comparison.

It also drops the reliance on `sort`'s own `undefined` hoisting, so the behaviour is now the library's rather than the engine's.

---

## 2. The numeric branch is a total order

### Before

```ts
if (typeof a.value === 'number' && typeof b.value === 'number') {
  cmp = a.value - b.value;
}
```

A subtraction returns `NaN` whenever it is non-finite, and a comparator that returns `NaN` violates the contract `Array.prototype.sort` expects. The spec then leaves the permutation **implementation-defined** — so the result was neither ordered nor stable, and not reproducible across engines, array sizes or input orders.

**This was reachable with no `NaN` in the data at all.** `Infinity - Infinity` is `NaN`, so a column that merely _repeats_ an infinity hit it with entirely ordinary values:

```ts
[Infinity, 3, Infinity, 1]; // no NaN anywhere — implementation-defined order
```

Any column that saturates to `Infinity` — a division, an overflowing accumulation, a sentinel — reaches it as soon as two rows share the value.

### After

```ts
function compareNumeric(a: number, b: number): number {
  if (a < b) return -1;
  if (a > b) return 1;
  const aIsNaN = Number.isNaN(a);
  const bIsNaN = Number.isNaN(b);
  if (aIsNaN === bIsNaN) return 0;
  return aIsNaN ? 1 : -1;
}
```

A total order over every IEEE-754 double, ranked **`-Infinity < …finite… < Infinity < NaN`**. `<` and `>` do the ordering — neither is ever true when a `NaN` is involved and neither overflows — which is what keeps this an ordering rather than a subtraction. The remaining case (`!(a < b) && !(a > b)`) is an equal pair, a repeated infinity, or a `NaN`, and only the last needs a rank.

Sorting the column `[3, NaN, 1, Infinity, -Infinity, NaN]`:

| Direction | Result                                |
| --------- | ------------------------------------- |
| `asc`     | `-Infinity, 1, 3, Infinity, NaN, NaN` |
| `desc`    | `NaN, NaN, Infinity, 3, 1, -Infinity` |

Two properties are worth stating explicitly, because they are decisions rather than consequences:

- **`NaN` is a rank, not a pinned end.** It is a value present in the column, so it flips with the direction like every other value: it trails under `asc` and **leads** under `desc`. PostgreSQL orders float `NaN` above all other values including `Infinity` for the same reason, so a table sorted client-side matches one sorted in the database. (A nullish _row_ is the opposite case — an absent record, pinned last in both directions, and never seen by this comparator at all.)
- **`-0` and `0` still tie**, as they did under subtraction; `sort`'s stability then keeps their input order.

`array-data-source.spec.ts` proves the total order rather than arguing it: it sorts all 720 permutations of that six-value column and asserts the result set has exactly **one** member. The pre-#81 comparator produces more than one, and that inverted assertion is kept so the defect stays demonstrable.

---

## Who is affected

| Component                                         | How it sorts                                                                                                  | Effect                                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `mlv-data-table`                                  | calls `setSort()` itself from its own header UI                                                               | **the only component that changes without its consumer touching anything** |
| `mlv-select`, `mlv-combobox`, `[mlvAutocomplete]` | inherit sorting through `MlvSelectDataSource extends MlvArrayDataSource`, but **never set a sort themselves** | change only if a consumer called `setSort()` on the source it was handed   |

Everything else in the workspace reads the data source without sorting it.

## What you have to do

**Nothing.** There is no API change, and no call site to edit.

Re-check a rendered order only if your data can contain one of the two inputs:

- an array element that is literally `null` or `undefined` — a sparse fetch, a failed row parse, a placeholder;
- a numeric column that can hold `NaN` or `Infinity` — a failed `parseFloat`, a `0/0`, a saturating division, an overflow sentinel.

If a nullish row previously arrived at the top of an `asc` page and you compensated for it — filtering it out at render time, or special-casing index 0 — that compensation is now unnecessary and may be wrong. If you have a snapshot test over a sorted list containing either input, update the expectation; it was asserting an accident (and in the `NaN` case, an implementation-defined one that could have changed under a V8 upgrade regardless).

---

## Explicitly out of scope

**The mixed number/string branch is still non-transitive, and stays that way.** The type branch keys off the **pair**, not the column, so two numbers compare numerically while either against a string compares through the collator, whose `numeric: true` reads a digit run after `-` as a magnitude and ignores the sign:

```js
cmp(-5, -3); //  -5 < -3   (numeric branch)
cmp(-3, '-4'); //  -3 < '-4' (collator: 3 < 4)
cmp('-4', -5); // '-4' < -5  (collator: 4 < 5)
```

That is #119, and it is **closed `wontfix` after measurement** — do not read it as a pending fix. An exhaustive triple search over a 17-value mixed pool put Malva's comparator at 26 transitivity violations against Angular Material's 36 and PrimeNG's 74 (PrimeNG additionally breaking transitivity _of equality_ 336 times), and every alternative measured either regressed correctness elsewhere or cost 65–84× on the uniform columns that make up essentially all real usage. The mixed-type column is an unsolved problem across the ecosystem, not a gap specific to this library.

If a column of yours genuinely mixes types, give it a uniform representation before it reaches the data source.

## Not changed

- Every public member of `MlvDataSource` / `MlvArrayDataSource` / `MlvSelectDataSource`, including `setSort`, `MlvSortState`, `MlvSortDirection`, `connect()`, `totalItems()` and `loading`.
- The string branch: one shared `Intl.Collator(undefined, { numeric: true })`, with the stringified value memoised per entry (`??=`, not `||=`, so a cached `''` is not recomputed).
- The type branch itself — still per pair, still numeric only when **both** values are numbers.
- Nullish **cell** values in sorting (`?? ''`, leading under `asc`), and nullish rows in filtering, search and `totalItems()`.
- Sort stability: `Array.prototype.sort` is stable, so ties keep input order — including the nullish suffix.
- The pipeline and its costs: `filter → sort → slice`, one decorate–sort–undecorate pass, unchanged from #10.
