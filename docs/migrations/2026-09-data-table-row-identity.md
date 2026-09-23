# 2026-09 — `mlv-data-table`: edits follow the row object, rows are handed out uncopied

**Packages:** `@malva-ui/core/data-table` (`MlvDataTable`).
**Kind:** breaking, **behaviour only**. No public member renamed, removed or retyped. No input, output or method signature changed. The internal row type drops its `_mlvDepth` / `_mlvRef` keys, which were `_`-prefixed and never public (VERSIONING.md §2): no call site of a public member fails to compile, but a typed read of those internal keys does (TS2339). `MlvEditEvent` and `MlvEditSaveEvent` gain one optional field, `sourceRow`, which is additive. What changes is **which object** a row reference is, and **which row** an edit belongs to. VERSIONING.md §3 classes that as "changed default behaviour at an unchanged API — … what a value means", which is a major. Resolves #297 (audit findings DD-02 and DD-05).

---

## Why

Two defects shared one mechanism.

- **DD-02: edits were keyed by view position.** `MlvDataTableEditingService` stored sessions under the `@for` index. Sorting, filtering, searching, paging or expanding a tree node moved a different row into that index.
  - That row then rendered in edit mode.
  - Saving paired it with the wrong `originalRow`.
  - `apps/docs` data-table example 6 wrote the save back at `event.index`. That is a view position, so on a sorted table it overwrote the wrong entry of its array.
- **DD-05: every recompute copied every row.** `flattenRows` spread each row into `{ ...row, _mlvDepth, _mlvRef }` on every sort, filter, search keystroke and page change.
  - At 100k rows that cost 13.4–14.4 ms and 16.9 MB retained per recompute once the spread call site went megamorphic, which is any app with more than one row type.
  - Those copies were what every template, event and `flatRows()` handed out.

The fix keys edit sessions by the consumer's **row object** and stops copying rows. The two changes cannot be separated:

- A row has an identity only if the table hands out the consumer's own object. A per-recompute copy has none.
- Handing out the consumer's own object on the edit path would let edit templates write straight into consumer data. So editing now clones a **draft** for the row's templates (copy-on-edit), and the consumer's row stays untouched until it writes the save back.

The new optional `sourceRow` on the edit events is the object the consumer passed in `data`. That is the key to write back by, because `index` still means view position (decision D36, unchanged).

Measured after the change, at 100k rows:

| Case                | Before                         | After           |
| ------------------- | ------------------------------ | --------------- |
| Nothing expanded    | 13.4–14.4 ms, 16.9 MB retained | ~0 ms, 40 B     |
| Every node expanded | 15.4–16.0 ms, 17.0 MB          | 3.0 ms, 1.75 MB |

---

## What changes, shape by shape

In each shape below, **copy the row yourself where you relied on the table's copy**.

### (a) A side panel bound to `rowClick.row`

```html
<mlv-data-table [data]="rows" (rowClick)="form = $event.row" />

<mlv-input [(ngModel)]="form.name" />
```

|                        | Before                                                                                         | After                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| What `rowClick.row` is | A throwaway flat copy                                                                          | Your own row object (`===`)                                    |
| Typing in the panel    | Wrote into the copy. Your data was untouched, and the copy was discarded at the next recompute | Writes into your data, live. Closing the panel reverts nothing |

**Do:** `form = { ...$event.row }` (or `structuredClone`), and write it back on submit.

The same applies to every other row the table hands out:

- the `row` of a non-edited row's `mlvDataTableCell` templates;
- the argument of a column's `tone(row)` function;
- each element of `flatRows()`.

### (b) A display template that writes to `row`

```html
<mlv-checkbox *mlvDataTableCell="'done'; let row from rows" [(ngModel)]="row.done" />
```

|              | Before                                                              | After                                                                              |
| ------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Toggling     | Flipped a copy, which reset on the next sort, search or data change | Mutates your row in place and persists                                             |
| Notification | None                                                                | None: your `data` signal does not re-emit, so a `computed` over it does not re-run |

**Do:** either:

- bind one way and update immutably: `[ngModel]="row.done" (ngModelChange)="setDone(row, $event)"`; or
- if the old throwaway toggle was the point, keep the state outside the row.

### (c) An async save handler: the row snaps back

```ts
async onSave(e: MlvEditSaveEvent<Row>) {
  await this.api.save(e.row);
  this.rows.update(...);
}
```

|                                       | Before                                                                                                             | After                                                                                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| On screen between save and write-back | The edit templates had written into the rendered copy itself, so the edited values stayed until the next recompute | The draft ends with the edit, and the row renders `sourceRow`, i.e. its **pre-edit values**, until you write back. A pessimistic save flashes the old value |

**Do:** write back optimistically inside the handler, and roll back if the request fails.

This behaviour is pinned by the spec "renders the pre-edit values after a save the consumer has not written back".

### (d) A refetch ends an edit silently

|                                                        | Before                                                                                                               | After                                                                                                               |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Rows replaced by new objects while one is being edited | The **index** stayed in edit mode, now on whichever row landed there. The typed values were lost with the old copies | The row is a different object, so it is no longer the edited row and leaves edit mode. **No `rowEditCancel` fires** |

The same happens with the documented replace write-back of an earlier save, if the row is being edited again when that write-back lands (an async save): the new session is keyed by the source the write-back replaces, so it ends silently and its typed values are lost.

The orphaned session is not pruned. See [Explicitly out of scope](#explicitly-out-of-scope) and [#419](https://github.com/N1XUS/malva-ui/issues/419).

**Do:** either:

- keep row objects stable across a refetch (reuse the object for an unchanged id); or
- track "editing" yourself from `rowEditStart.sourceRow`, and clear it when you refetch.

A remote `MlvDataSource` that returns new objects per page round-trip loses an open edit on every round-trip.

### (e) One row object listed at two positions

|                                     | Before                            | After                                                                                                                                                |
| ----------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data = [a, b, a]`, edit position 0 | Only position 0 entered edit mode | **Both** positions enter edit mode, sharing one draft, so typing shows at both. This is the same rule as selection, which was already identity-keyed |

**Do:** if the two positions are distinct records, give them distinct objects (`{ ...row }`).

Pinned by the spec "edits both positions together, with one shared draft".

### (f) `isEditing(i)` after a sort

|                                    | Before                                                                                     | After                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `isEditing(i)` after the rows move | Answered for the index that was clicked, whichever row now sits there. That was the defect | Answers for **whichever row is rendered at `i` now**. The edited row may be at another index |

**Do:** hold on to `rowEditStart.sourceRow` and find it: `table.flatRows().indexOf(sourceRow)`.

### (g) `flatRows()` can be the `displayRows()` array itself

|                                    | Before                                            | After                                                                                                                                                                                                                                               |
| ---------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `flatRows()` with nothing expanded | A fresh array of copies. Mutating it was harmless | **The same array** as `displayRows()`, the data source's connected array (for a custom `MlvDataSource`, whatever its `connect()` returns). An in-place `.sort()`, `.splice()` or `.reverse()` rewrites the table's rendered rows behind its signals |

**Do:** `[...table.flatRows()]` before mutating.

---

## Saving: writing the edit back

The table never writes the edit back itself. Replace `sourceRow` with `row`, or copy onto it:

```ts
onSave(event: MlvEditSaveEvent<Employee>): void {
  // Replace the object …
  this.employees.update((rows) => rows.map((r) => (r === event.sourceRow ? event.row : r)));

  // … or copy onto it and publish a new array. The row keeps its object:
  // Object.assign(event.sourceRow!, event.row);
  // this.employees.update((rows) => [...rows]);
}
```

**Selection and tree expansion follow the replacement.** Both are keyed by row object, so replacing the object would drop the saved row from `selectedRows` and collapse a saved expanded parent. The table carries them over:

- A save records `draft → sourceRow`.
- If the **next data emission** contains the saved `row` and no longer contains `sourceRow`, then `selectedRows` and the expanded set swap `sourceRow` for `row`:
  - `selectedRows` keeps its order and emits `selectionChange` once;
  - a parent keeps its children open.
- What counts as a data emission depends on the input:
  - array `data`: the array itself. A sort, filter, search or page change is **not** an emission; only a new array is.
  - an `MlvDataSource`: the page it currently connects, because that page is all the table sees. So a sort, filter, search or page change **is** an emission, and it drops a pending record. See [With an `MlvDataSource`](#with-an-mlvdatasource-only-the-connected-page-is-seen).
- The record is dropped at that emission, whatever the emission holds. So write back in the save handler, or make the write-back the first emission after it.

| After the write-back                                     | Before (6c41b8ab)                                                                       | After                        |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------- |
| Row renders selected                                     | yes, through the copy's `_mlvRef`                                                       | yes, carried over            |
| `selectedRows` holds                                     | the **stale pre-edit** object                                                           | the **saved** object         |
| Extra `selectionChange`                                  | no                                                                                      | **yes, one**                 |
| Saved expanded parent                                    | stays expanded                                                                          | stays expanded, carried over |
| Saved row carries `_mlvDepth` / `_mlvRef` into your data | **yes**, and `_mlvRef` retained the old object, including in a `JSON.stringify` payload | no                           |

Not carried over:

- an emission that lacks the saved object, such as an async save whose first emission is unrelated;
- a server echo, which is a new object (carry state to it yourself);
- the **parent's expansion** when an immutable write-back of a tree child also rebuilds the parent. The child's selection does carry. The rebuilt parent is a new object, so it renders collapsed, as it did before: its expansion was keyed by the old parent object.

In virtual-scroll mode, a replaced object also re-creates its row view, because `trackBy` is the row.

`Object.assign` keeps the object, so it needs none of this.

These cases are pinned by the specs under "selection and expansion across the documented write-back":

- removing the carry-over turns four of them red;
- keeping a pending record past an unrelated emission turns one red;
- restricting the search to root rows turns the tree-child spec red.

### With an `MlvDataSource`, only the connected page is seen

The table sees a data source's current page and nothing else, so the carry-over decides on that page alone. Three shapes follow. They were measured in review with an `MlvArrayDataSource`; with array `data` all three carry correctly. A save-as-copy with array `data` changes too, correctly: on 6c41b8ab the inserted copy inherited `_mlvRef` to the source, so it rendered selected and expanded as if it were the source. Now only the source does.

| Shape                                                                                                                                  | After                                                                                                                                                                                                                                                                             | Before (6c41b8ab)                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| A sort, filter, search or page change between the save and a late write-back                                                           | The change is an emission and drops the record. The written-back row renders **unselected**, and `selectedRows` keeps the pre-edit object                                                                                                                                         | The row stayed selected through the copy's `_mlvRef`; `selectedRows` held the stale object        |
| A write-back that moves the saved row **to another page**: a rename under a sort on that column, a status change under a status filter | The emitted page holds neither the saved row nor its source, so nothing is carried. The row renders **unselected** on its new page, and `selectedRows` keeps the pre-edit object, which is no longer in the data. Selecting the row again adds a second entry for the same record | The row stayed selected through the copy's `_mlvRef`; `selectedRows` held the stale object        |
| A save-as-copy write-back that inserts the saved row and keeps the source, when the insertion pushes the source onto another page      | The page holds the saved row and not the source, which reads exactly like a replacement. The selection **moves from the source to the copy**                                                                                                                                      | The source stayed selected. The copy carried `_mlvRef` to the source, so it rendered selected too |

The first two are a regression for those shapes. The record is deliberately not kept past that one emission: holding it until the saved row turns up on some later page would keep a stale record alive for as long as it never does.

**Do:** with an `MlvDataSource`, carry the state yourself in the save handler. Swap `sourceRow` for `row` in the set you bind to `[(selectedRows)]`, or re-select the source after a save-as-copy.

---

## What the draft is

The draft (`row` in the edit events and edit templates) and the snapshot (`originalRow`) are **shallow** clones that keep the row's prototype. Each reads what `{ ...row }` reads: own enumerable string and symbol keys, each value through its getter. Each key is then **defined** on `Object.create(Object.getPrototypeOf(row))` as a plain writable data property.

- **Top-level properties are the draft's own.** Assign them freely. Cancel drops the draft and the row renders its untouched values again. Before, the typed values stayed on the rendered copy until the next recompute, and the caller was left to restore them.
- **Starting an edit on a row already being edited keeps its session.** Both the in-progress draft and the original snapshot survive. Before, a second `startEdit` at that index re-snapshotted the already-edited copy, so `originalRow` reported the edits as the original values.
- **Nested objects are shared** with your row and with `originalRow`. A template doing `row.meta.tag = x` writes through to your data, survives a cancel, and shows in `originalRow`. That was already true before; the docs now say so. Replace instead: `row.meta = { ...row.meta, tag: x }`.
  - A deep clone was rejected: it breaks class instances, `Date`s, `Map`s and anything with identity.
- **The prototype is kept**, which is new. Before, every row the table handed out was a plain object. Now a class-instance row keeps its getters and methods while edited, and `rowEditSave.row instanceof Employee`. Pinned by "keeps the prototype on the draft, so getters still render while editing".
  - Defining rather than copying descriptors means a row you froze (NgRx freezes state in dev mode) still yields a writable draft. Copying the descriptors would have kept the freeze, and would have copied an own getter live instead of reading its value. Pinned, with the symbol-key and non-enumerable-key rules, by "clones a frozen row as a spread reads it: writable, symbol keys kept, hidden keys skipped, getters read".
  - Defining rather than assigning means an own property that shadows a prototype accessor is copied as it is. Assigning it would throw on a getter-only accessor (`Cannot set property … which has only a getter`), or hand the value to a prototype setter and create no own property. Pinned by the two specs under "rows whose own property shadows a prototype accessor".
  - One caveat: ECMAScript `#private` fields and built-in internal slots are not copied. A member that reads a `#private` field throws on the draft, and so does an inherited method of a `Date`, `Map` or `Set` subclass row (`TypeError: this is not a Date object.`).

---

## Adjacent fixes in the same change

- **A very wide tree node no longer throws.** Expanding a node used `result.push(...flattenRows(children))`. That passes every child as an argument, so past the engine's argument limit it threw `RangeError: Maximum call stack size exceeded`.
  - Rows are now pushed one at a time.
  - The limit depends on stack size: about 120k children in plain `node`, and more in a vitest worker. So the spec uses 1,000,000 children, and restoring the spread turns it red.
- **The nested-row indent is `padding-inline-start`,** replacing a physical `padding-left`, per `.claude/rules/rtl.md`. The indent spacer is empty, so nothing moves visibly in either direction.

---

## Who is affected

| Consumer                                                                                                             | Effect                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code that writes to a row it got from the table outside edit mode: shapes (a), (b), `tone`, `flatRows()`             | **Now writes your data.** Copy first                                                                                                                                                                                                                                                                                                                                                                                                      |
| `rowEditSave` handlers that write back by `index`                                                                    | Were already wrong on any sorted, filtered, searched or paged table. Write back by `sourceRow`                                                                                                                                                                                                                                                                                                                                            |
| Async or pessimistic save handlers                                                                                   | The row shows pre-edit values until the write-back (c)                                                                                                                                                                                                                                                                                                                                                                                    |
| Apps that refetch while a row is being edited                                                                        | The edit ends without `rowEditCancel` (d)                                                                                                                                                                                                                                                                                                                                                                                                 |
| Tables listing one object twice                                                                                      | Both positions edit together (e)                                                                                                                                                                                                                                                                                                                                                                                                          |
| Tables fed an `MlvDataSource` whose selected row is saved while the page can change before or through the write-back | Three shapes lose or move the selection: a sort, filter, search or page change before a late write-back, and a write-back that moves the row off the page, both leave the saved row unselected with `selectedRows` keeping the pre-edit object; a save-as-copy that pushes the source off the page moves the selection to the copy. Carry it yourself ([With an `MlvDataSource`](#with-an-mlvdatasource-only-the-connected-page-is-seen)) |
| Code that reads `_mlvDepth` / `_mlvRef` off a row                                                                    | Both are gone. They were `_`-prefixed and never public (VERSIONING.md §2); use `getDepth(row)`                                                                                                                                                                                                                                                                                                                                            |

In this repository: nothing needed a change beyond docs example 6, whose index write-back is replaced by the identity write-back above.

- `data-operations` looks the clicked row up by id.
- `project-workspace` and `settings-access` only read in their cell templates.
- `data-at-scale` already canonicalises row identity and does not edit.

## What you have to do

1. Write edits back **by `sourceRow`**, not by `index`.
2. Where you mutated a row the table handed you outside edit mode, copy it first.
3. In an async save, write back optimistically.
4. In edit templates, replace nested objects rather than mutating them.
5. With an `MlvDataSource`, carry a selected row's selection yourself in the save handler wherever the page can change before or through the write-back: a sort, filter, search or page change before a late write-back, a write-back that moves the row off the page, and a save-as-copy that pushes the source off the page.

Nothing to rename. No call site of a public member fails to compile; a typed read of the internal `_mlvDepth` / `_mlvRef` keys does (TS2339).

---

## Explicitly out of scope

- **Orphaned edit sessions are not pruned; tracked in [#419](https://github.com/N1XUS/malva-ui/issues/419).** A session whose row was replaced by a new object stays open, holding its two clones, with no `rowEditCancel`. That covers a refetch and a replace write-back landing while the row is being edited again (shape (d)). The internal editing service also keeps reporting an active edit, though nothing reads that today. Two options are on the table, and neither is done here:
  - prune sessions whose source leaves the data, and emit cancel;
  - add a `rowKey` input, so identity can be a field rather than an object.
- **The mixed number/string sort branch.** That is #119, closed wontfix after measurement. It is untouched here.

## Not changed

- Every public member of `MlvDataTable`, including the signatures of:
  - `startEdit`, `saveEdit`, `cancelEdit`, `isEditing`, `getDepth`;
  - `flatRows`, `displayRows`, `selectedRows`;
  - every input and output.
- The meaning of `index` on every event: the row's view index when the event fires (D36).
- `originalRow` on `rowEditSave`: still a pre-edit shallow clone. It now has no `_mlv*` keys and keeps the row's prototype.
- Selection and expansion stay identity-keyed, as they were.
- Tree depth still shows per rendered position, so a row object listed at two tree positions indents correctly at both. `getDepth(row)` reports its last nested position.
