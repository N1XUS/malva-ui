# 2026-09 — pinned data-table columns stick to their logical edge

Applies to `@malva-ui/core/data-table` (`MlvDataTable.getCellStyle()`, pinned
columns). The same change mirrors `@malva-ui/cdk/utils` `MlvFade` and the
`@malva-ui/core/copy-to-clipboard` content fade in RTL; those halves are not
breaking (§ 3). Fixes #341.

**Breaking, behaviour only.** No exported symbol, selector, input, output,
token, BEM class or i18n key is renamed, removed or retyped. `getCellStyle()`
keeps its signature and its `Record<string, string>` return type. What moves is
**what the returned object contains** for a pinned column: the sticky offset
arrives as the custom property `--mlv-dt-pinned-inset` instead of as a physical
`left` / `right` key — in LTR too.

Classified under `VERSIONING.md` § 3 row 112, _Changed default behaviour at an
unchanged API — … what a value means_. The RTL placement itself is row 117 (a
bug fix restoring documented behaviour: `pinSide` pins to a side of the table,
and in RTL the start column scrolled out of view). But `getCellStyle()` is
public, and a consumer spreading its object onto an element of its own gets
`position: sticky` with no offset after this change, in either direction. On
the `0.x` line a `!` commit is demoted to a minor: **`0.2.0` → `0.3.0`** (§ 7).

## 1. What changed

A pinned column's offset is a running sum of **logical** widths from its pinned
edge. `columnCellStyles()` wrote it as a physical inset — `left: X` for
`pinSide: 'left'`, `right: X` for `'right'` — and the stylesheet had no side
rule. `pinSide` is a logical alias (a `'left'` column is rendered first, so it
sits on the right in RTL), so under `[dir="rtl"]` the inset constrained the
wrong edge: the start columns scrolled away as the table scrolled toward its
inline end, and the end column sat a full scroll range off its edge until the
table reached it.

Now:

- `getCellStyle()` / `columnCellStyles()` emit
  `--mlv-dt-pinned-inset: calc(<offset> + var(--mlv-dt-pinned-{start|end}-correction, 0px))`,
  plus the unchanged `position: sticky` and `z-index: 2`. No `left`, `right` or
  `inset-inline-*` key.
- `data-table.scss` puts the property on a physical side:
  `.mlv-data-table__cell--pinned-left { left: … }` and
  `.mlv-data-table__cell--pinned-left:dir(rtl) { left: auto; right: … }`,
  mirrored for `--pinned-right`. Physical, not `inset-inline-*`, because
  `.claude/rules/rtl.md`'s sticky row forbids a logical inline inset on a
  sticky element (it cites a Safari 26 RTL bug; WebKit 26.6 did not reproduce
  it for these cells — § 1a). `:dir()`, not `[dir='rtl'] &`: `MlvRtlService`
  always writes `<html dir>`, so the attribute form also matches an LTR island
  inside an RTL document.
- An engine without `:dir()` takes an `@supports not selector(:dir(rtl))`
  fallback that sets the side from `inset-inline-start` / `inset-inline-end`
  (§ 4).
- The header / footer gutter correction `--mlv-dt-pinned-right-correction` is
  now `--mlv-dt-pinned-end-correction` — the body viewport's scrollbar sits at
  its inline end. It was never listed in `tokens.md`.
- The edge scrim (`::after`) gradient uses `mixins.inline-distance(±90deg)`, so
  it darkens next to the column in both directions (renders identically in
  LTR: `90deg` is `to right`).
- The sticky virtual viewport (`.mlv-data-table__virtual-viewport`) moves from
  `inset-inline-start: 0` to `left: 0` / `:dir(rtl) right: 0`, with the same
  `@supports` fallback, to satisfy the sticky row. No measured engine behaves
  differently for it (§ 1a).

### 1a. Measured

Playwright, Chromium 153 and WebKit 26.6: a 300px scroller over a 900px table
with two start columns (80px, 60px) and one end column (110px) — distance of
each cell from the edge it should stick to (start 1 · start 2 · end), at scroll
start / middle / end. Both engines gave identical numbers:

| Case                               | Before                                         | After                 |
| ---------------------------------- | ---------------------------------------------- | --------------------- |
| Scoped `[dir="rtl"]`, document LTR | `0·80·−600` / `−300·−220·−300` / `−600·−520·0` | `0·80·0` at all three |
| Document `dir="rtl"`               | `0·80·−600` / `−300·−220·−300` / `−600·−520·0` | `0·80·0` at all three |
| `dir="auto"` resolving to RTL      | `0·80·−600` / `−300·−220·−300` / `−600·−520·0` | `0·80·0` at all three |
| LTR island inside an RTL document  | `0·80·0` at all three                          | `0·80·0` at all three |
| LTR                                | `0·80·0` at all three                          | `0·80·0` at all three |

A logical `inset-inline-*` on the same cells also measured `0·80·0` in both
engines, so the sticky row's Safari bug did not reproduce for table cells in
WebKit 26.6. Whether it applies to shipping Safari 26 is an open question for
the rule, not for this change.

The sticky virtual viewport, distance from the scroller's inline-start edge at
scroll start / middle / end in RTL:

| Engine       | Before (logical) | After (physical + `:dir()`) |
| ------------ | ---------------- | --------------------------- |
| Chromium 153 | `0·0·0`          | `0·0·0`                     |
| WebKit 26.6  | `0·−300·−600`    | `0·−300·−600`               |

WebKit 26.6 lets it scroll away in RTL in **every** spelling — physical,
logical, before and after — so a virtual-scroll table in RTL on WebKit keeps
its pre-existing defect: the body rows slide out from under the header. Not
fixed here; tracked separately.

## 2. Consumer shapes

- **An element of yours styled with `[style]="table.getCellStyle(col)"`** (a
  custom sticky summary row, a print clone). It keeps `position: sticky` and
  loses the offset. **Do:** give it the table's classes
  (`mlv-data-table__cell--pinned-left` / `--pinned-right` — the rules are global,
  `ViewEncapsulation.None`), or set `left` / `right` from
  `var(--mlv-dt-pinned-inset)` in your own stylesheet.
- **Code or specs reading `getCellStyle(col).left` / `.right`.** Both are
  `undefined` now. **Do:** read `['--mlv-dt-pinned-inset']`; the side is the
  cell's `:dir()`.
- **A stylesheet setting `left` / `right` on pinned cells.** The inline `left` /
  `right` used to override it; now nothing inline competes, and an unlayered
  consumer rule beats the library's `@layer mlv.components` rule. **Do:** delete
  it if it was never meant to apply.
- **An override of `--mlv-dt-pinned-right-correction`.** **Do:** rename it to
  `--mlv-dt-pinned-end-correction`.
- **Visual baselines of RTL tables with pinned columns.** **Do:** re-baseline;
  LTR renders identically.

## 3. Not breaking, same change

- `MlvFade` (horizontal) and the `mlv-copy-to-clipboard` content fade place
  their edge layers with `--mlv-inline-direction` instead of `left` / `right`
  keywords, so the fades mirror under any `[dir="rtl"]` scope — before, an RTL
  label faded on the wrong edge and the copy fade stayed on the physical right
  while the indicator sat on the left. LTR values are unchanged (row 117).
- `MlvFade` no longer slides its mask in on mount: the host carries an inline
  `transition: none` until the first measurement is painted. `--start` reads
  `Math.abs(scrollLeft)`, so an RTL subpixel offset at the start no longer
  raises it, and a change of `mlvFade` re-measures without a scroll (row 117).
  A direction flip on a mounted, scrolled fade still animates the mask across
  the box once — cosmetic.
- JSDoc on `MlvPinSide`, `MlvColumnAlign`, `MlvTimelineItemDirection` and
  `getCellStyle()` now states what each means. No behaviour changed.

## 4. Browser support

`:dir()` is in Chromium 120, Firefox 49 and Safari 16.4. Angular 22.1's default
browserslist is `baseline widely available on 2026-05-07`
(`@angular/build/src/utils/supported-browsers.js`), which resolves to Chrome /
Edge 119, Firefox 119 and Safari 17 at the low end — so Chromium / Edge 119 has
no `:dir()` and would drop every `:dir(rtl)` rule. For that engine the pinned
cells and the virtual viewport carry an `@supports not selector(:dir(rtl))`
block that resets the physical side and sets `inset-inline-start` /
`inset-inline-end` instead. It is the only engine in range that takes the
branch; no Safari in range lacks `:dir()`. Verified by simulation in Chromium
153 (the `:dir()` rules removed from the compiled CSS): without the block, RTL
pinned cells measured `0·80·−600` and the viewport `0·−300·−600`; with it,
`0·80·0` and `0·0·0`. Not measured in a real Chrome 119.

Under `dir="auto"`, `:dir()` resolves the direction from content, so the pinned
offset follows it (measured above). `--mlv-inline-direction` treats `auto` as
transparent (`.claude/rules/rtl.md`), so under a `dir="auto"` that resolves to
RTL the edge scrim, `MlvFade` and the copy fade still point LTR: the scrim
darkens the pinned column's own side, and a fade masks the reader's first
letters instead of the last.

## 5. Alternatives considered

- **Physical keys from TypeScript** — `columnCellStyles()` picks `left` or
  `right` from the table's own `elementDirection(host)` signal. Not breaking (a
  row 117 patch), complies with the sticky row and needs no `:dir()`. Rejected
  because the side is resolved in script: `dir="auto"` resolving to RTL stays
  broken (the direction signal treats `auto` as transparent; the pre-change
  physical inset measured `0·80·−600` there in both engines), a direction flip
  rebuilds every style object in a change-detection pass, and a table moved
  between `[dir]` scopes keeps a stale side, since no `dir` attribute changes to
  re-resolve it. The CSS rule is resolved by the browser per cell, with no
  script: right at first paint of server-rendered markup, on a flip, after a
  move and under `dir="auto"`.
- **Inline logical insets** — the issue's own proposal: `inset-inline-start` /
  `inset-inline-end` in the style object. Measured `0·80·0` in both engines in
  every case, keeps spread consumers working in both directions and needs no
  `:dir()`; it would still break code reading `.left` / `.right`. Rejected
  because it violates the sticky row. That the row did not reproduce for table
  cells in WebKit 26.6 is a question for the rule's owner; if the row is ruled
  obsolete for table cells, this narrows the break.
- **Both keys** — physical keys inline plus stylesheet overrides. An inline
  style can only be beaten by `!important`, and a layered `!important` also
  beats a consumer's unlayered `!important`. Rejected.

## 6. Unchanged

- `pinSide`, `pinnable`, `pinTo()`, `unpin()`, `togglePin()`, `columnOffsets`
  (still keyed `<key>_left` / `<key>_right`) and the column order.
- `position: sticky` and `z-index: 2` on pinned cells.
- Every LTR pixel.
