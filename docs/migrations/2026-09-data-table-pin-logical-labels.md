# 2026-09 — the data-table pin menu says "start" / "end"

Applies to `@malva-ui/core/data-table` (`MlvDataTable`, `mlv-data-table`)
columns with `pinnable: true` or `pinnable: ['left', 'right']`. Ships with
#371 (hard-coded English routed through the language packs).

**Breaking, behaviour only.** No exported symbol was renamed, removed or
retyped. `MlvPinSide` keeps its `'left' | 'right'` values, `pinned`,
`pinSide`, `pinnable`, `pinTo()`, `togglePin()`, `unpin()`,
`getColumnPinSide()`, the `columnPinChange` payload, every BEM class and every
existing i18n key are unchanged. What changes is the **text** of the two
side items in the pin popup — also their accessible name, since each is a
`role="menuitemradio"` named by its content. That is VERSIONING §3 row 112
(_default behaviour … what a value means_: a default visible string changes
meaning at an unchanged API), so it ships with `!`, which on `0.x` releases as
`0.2.0` → `0.3.0` (VERSIONING §7). The rest of #371 — new optional i18n keys
and slices, and six inputs widened to `T | undefined` (five `string`, plus
view-variant `groupLabels`) — is minor (row 115) and needs no migration.

## 1. What changed

The popup's two side items were hard-coded English, "Pin left" and "Pin
right". `MlvPinSide` is a **logical alias**, not a physical edge: its JSDoc
says so, `columnCellStyles()` writes only `--mlv-dt-pinned-inset` and the
stylesheet picks the physical side from `:dir()`, so `'left'` sticks to the
inline-start edge — the **right** edge inside a `dir="rtl"` scope. Pinned in
`data-table-pinned-rtl.spec.ts` (12 specs, among them _sticks start columns
to the right inside a scoped `[dir="rtl"]` while the document stays LTR_).
In an RTL table "Pin left" therefore pinned the column to the right.

The labels now come from two new optional keys on `MlvDataTableI18n`,
`pinStart` and `pinEnd`, worded logically in every shipped pack. The English
fallback (for a hand-written pack without the keys) is the new wording too.

## 2. Before / after

| Surface                                    | Before       | After          |
| ------------------------------------------ | ------------ | -------------- |
| `'left'` item text and accessible name     | "Pin left"   | "Pin to start" |
| `'right'` item text and accessible name    | "Pin right"  | "Pin to end"   |
| Same items with a non-English pack         | "Pin left" … | translated     |
| "Unpin", the pin button's own `aria-label` | unchanged    | unchanged      |
| Which edge a pinned column sticks to       | unchanged    | unchanged      |

## 3. Who is affected

- **Specs and e2e locators matching the old text** —
  `textContent.includes('Pin right')`,
  `getByRole('menuitemradio', { name: 'Pin left' })`. **Do:** match
  "Pin to start" / "Pin to end", or select by position among
  `.mlv-data-table__pin-popup-item` and check `aria-checked`.
- **Documentation, screenshots or support copy** that quote "Pin left" /
  "Pin right". **Do:** reword to start / end.
- **An app that wants physical wording** in an LTR-only product. **Do:**
  provide a pack (or `provideMlvI18n` override) whose `dataTable.pinStart` /
  `pinEnd` read as you prefer; the keys exist for exactly that.
- **A test harness that provides a lazy `provideMlvI18n(loader)`** — `mlv-tree`
  and `mlv-view-variant-*` now read a pack. **Do:** await
  `TestBed.inject(ApplicationInitStatus).donePromise` (or use
  `provideMlvI18nTesting()`) before rendering `mlv-tree` /
  `mlv-view-variant-*`, as data-table already required.

Not affected: pinning behaviour, the stored `pinSide` values, snapshots of
column presentation state, and the pin trigger's own name (`pinColumn` /
`changePinSide` / `unpinColumn`). In this repository one spec matched the old
text (`data-table-presentation-state.spec.ts`, updated) and the `/data-table`
example 3 prose quoted it (reworded); no other `libs/` or `apps/` code reads
it.
