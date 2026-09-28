# 2026-09 — virtual data-table rows stride by the row height they render

Applies to `@malva-ui/core/data-table` — `MlvDataTable` in `virtualScroll`
mode, and its `rowHeight` input. Fixes #363 (owner ruling D18).

**Breaking, behaviour and default value.** Nothing is renamed or removed; no
selector, output, token or i18n key changes.

- `rowHeight`'s default changes `40` → `undefined`, and its type `number` →
  `number | undefined`. `VERSIONING.md` § 3 row 111, _Changed default value of
  an input_.
- What an unset `rowHeight` means changes: the viewport strides by the
  **measured** row pitch instead of 40 px, and the virtual rows no longer carry
  an inline `height`. Row 112, _what a value means_.
- The accepted type only widens (row 115): every existing binding compiles.
  The **read** type widens too, so `const h: number = table.rowHeight()` fails
  `strict` with TS2322 (§ 3, shape d).
- Additive, row 114: the BEM element `.mlv-data-table__row-probe`.

On the `0.x` line a `!` commit is demoted to a minor: **`0.2.0` → `0.3.0`**
(§ 7).

## 1. What changed

CDK virtual scroll places every non-rendered row at `index × itemSize`, and
sizes its spacer at `rowCount × itemSize`. The table passed `rowHeight` to
`itemSize`, defaulting to `40`. But a data row renders at
`--mlv-dt-row-height`: `calc(var(--mlv-height-*) + var(--mlv-spacing-4))`,
which is 60 px at `comfortable` and a 16 px root. The `<td>` owns that height,
and table layout lets it beat the `<tr>`'s inline `height: 40px`. So every
virtual table that did not hand-set a matching `rowHeight` had a stride shorter
than its rows. The mismatch had three effects:

- rows jumped by up to `(pitch − 40) × rows-per-range-change` on scroll;
- the scroll range was two thirds of the content;
- `scrollToIndex` landed on the wrong row.

A hand-set value matched only one density at one root font size.

Now the stride is measured:

- **Probe.** In virtual mode with `rowHeight` unset, the host renders one
  extra direct child,
  `<div class="mlv-data-table__row-probe" aria-hidden="true">`. It is empty,
  `position: absolute`, `width: 0`, `height: var(--mlv-dt-row-height)`,
  `visibility: hidden` and `pointer-events: none`. It is sized by the same
  property on the same physical axis as `&__cell--data`, adds no scroll range,
  takes no pointer and paints nothing.
- **Measure.** A `ResizeObserver` (through `MlvResizeObserverService`) reports
  its height. Non-zero reports update the stride. A zero report (a
  `display: none` ancestor) keeps the last value.
- **Precedence.** `itemSize` is `rowHeight ?? measured ?? 60`.
  - `60` is the comfortable row at the CSS-initial 16 px root.
  - It stands in only where nothing is laid out yet: a server render (which
    never reads it — the viewport attaches no scroll strategy there), a jsdom
    spec, and the frame before the first observer delivery.
- **Follows** with no density-specific code:
  - density — the table's own `mlvDensity`, an ancestor `MLV_DENSITY_CONTEXT`,
    or `MlvDensityService` — including runtime flips;
  - the root font size;
  - an override of `--mlv-dt-row-height` or of the `--mlv-height-*` token,
    written on the host or an ancestor.
- **Rows.** With `rowHeight` unset, no inline `height` is written: rows are
  sized by the `<td>`'s `height: var(--mlv-dt-row-height)`, the probe's own
  token. A cell `height` is a minimum, though, so the stride matches only
  while cell content fits inside that token minus the 1px row separator (the
  `border-bottom` sits inside the cell's border-box). Taller content grows the
  row past the stride — shape (i).
- **No 40 px floor.** The old inline `height: 40px` also held every virtual
  row at 40 px or more. A token below that — `--mlv-dt-row-height: 2rem`, or
  `tight` density on a root under about 14.5 px — now renders rows at that
  size (32 px, 38.5 px). That is correct now that the stride follows, but it is
  visible.
- **Explicit.** A bound `rowHeight` still wins, still pins every virtual `<tr>`
  with `[style.height.px]`, and renders **no** probe and no observer: that
  path's markup is what it was before this change.
- **Server.** The probe is in the server payload (empty, no style) for a table
  with `rowHeight` unset; nothing is measured there.

Non-virtual tables are unchanged: they render no probe and never read
`rowHeight`.

## 2. Measured

Playwright ran the docs `/data-table` example 15 (10 000 rows, no `rowHeight`
bound) in Chromium, Firefox and WebKit. Each row gives the
`itemSize / rendered pitch` pair in px and the worst drift of a visible row
over 40 × 7 px scroll steps. Drift is `|Δtop + Δscroll|`; 0 means a row moves
exactly with the scroll.

| Scenario                            | Before          | After      |
| ----------------------------------- | --------------- | ---------- |
| comfortable, 16 px root             | 40 / 60, 60 px  | 60 / 60, 0 |
| compact (runtime flip)              | 40 / 52, 36 px  | 52 / 52, 0 |
| spacious (runtime flip)             | 40 / 68, 84 px  | 68 / 68, 0 |
| comfortable, 20 px root             | 40 / 75, 105 px | 75 / 75, 0 |
| host `--mlv-dt-row-height: 2.75rem` | 40 / 44, 12 px  | 44 / 44, 0 |
| host `--mlv-height-m: 3.5rem`       | 40 / 72, 96 px  | 72 / 72, 0 |

- **Before** figures are Chromium only.
- **After** figures are identical in all three engines.
- **List end.** Before, at a 20 px root and under the `--mlv-height-m`
  override, the last row could not be scrolled fully into view. After, it can
  in every scenario — at 10 000 rows; § 3 (a) bounds the row count.
- **Probe accuracy.** A static-markup probe equalled the rendered row pitch in
  every combination: all five densities, 16 and 20 px roots, and both
  overrides, in all three engines.

## 3. Consumer shapes

**(a) A virtual table with no `rowHeight`.** Scrolling is now correct. The
scroll range grows to `rowCount × pitch` (1.5× at comfortable), so the
scrollbar thumb shrinks and the last row is reachable — **up to a row count
browsers cap**. One scroll container holds at most 17,895,688 px in Firefox,
which past that drops the height entirely, so only the first screen of rows
can be reached; Chrome and WebKit clamp at 33,554,428 px. So the last row is
reachable in every engine below about 17.8M px ÷ pitch rows: ≈ 298 000 at
comfortable on a 16 px root, fewer at `spacious` / `airy` or a larger root
font (≈ 235 000 at `airy`, ≈ 238 000 at comfortable on a 20 px root). The 1.5×
stride moves that bound down: a Firefox table of 298 000–447 000 rows was
scrollable end to end at the old 40 px stride (misplaced, but reachable) and
now reaches only its first screen. **Do:** nothing below the bound. Above it,
page server-side — the data-at-scale showcase switches to paging there — or
bind a smaller `rowHeight` knowingly, accepting that the stride no longer
matches the rows.

**(b) `[rowHeight]` set to the comfortable pitch (`60`)** — the old docs advice.
It still works at comfortable on a 16 px root. It is still wrong at any other
density or font size, because a px value follows neither. **Do:** delete it;
this repository's docs example 15 and the data-at-scale showcase did.

**(c) `[rowHeight]` used to force a different row height.** It still wins,
still pins the rows, and the table renders no probe for it. **Do:** keep it.
Alternatively, override
`--mlv-dt-row-height` on the table host: that is now honoured by both the cells
and the stride, and it scales with the root font size.

**(d) Code reading `table.rowHeight()` as a number.** It now reads `undefined`
unless a value is bound. Under `strict`, `const h: number = table.rowHeight()`
fails with TS2322. **Do:** bind the value you read, or write
`table.rowHeight() ?? fallback`. The measured pitch has no public accessor
(§ 5).

**(e) jsdom specs that count virtual rows or read the spacer.** jsdom has no
layout and no `ResizeObserver`, so an unbound `rowHeight` now strides at the
60 px stand-in instead of 40. Measured with 200 rows in a zero-height
viewport: 4 rendered rows and a `12000px` spacer, where there were 5 and
`8000px`. **Do:** bind `[rowHeight]` in the spec, as this library's own virtual
specs do, or provide a `MlvResizeObserverFactory` stub that reports the probe's
height.

**(f) Selectors or snapshots expecting `style="height: 40px"` on virtual
rows.** An unbound table writes no inline row height now. **Do:** read the
`<td>`'s computed height or `--mlv-dt-row-height`.

**(g) An override written below the host.** An override of
`--mlv-dt-row-height` or `--mlv-height-*` on `tbody` or `td` resizes the rows,
but the probe — a child of the host — never sees it, so stride and rows
disagree again. **Do:** write the override on the `mlv-data-table` element or
an ancestor.

**(h) Structural selectors over the host's children.** A virtual table with
`rowHeight` unset gains one `div` between the toolbar and
`.mlv-data-table__wrapper`. That shifts `mlv-data-table > div:nth-child(…)`,
`:first-of-type` and counts of the host's children. **Do:** select by BEM
class.

**(i) Cell templates taller than the row token.** A cell `height` is a minimum,
and the probe does not see content. Content taller than `--mlv-dt-row-height`
minus the 1px row separator grows the row past the stride, and rows drift
again. Measured in all three engines with 5rem-tall cell content, comfortable,
16 px root: probe 60, row pitch 81. With `--mlv-dt-row-height: 5rem` on the
host: probe 80, pitch 81, because the separator's `border-bottom` sits inside
the cell's border-box. **Do:** set `--mlv-dt-row-height` on the host to at least
the content height + 1px, or bind `rowHeight` to the rendered pitch.

## 4. Unchanged

- Non-virtual tables: markup and behaviour identical.
- The explicit-`rowHeight` path: `itemSize`, the pinned `<tr>` height and the
  markup — no probe, no observer — as before.
- `--mlv-dt-row-height` values per density, and every other `--mlv-dt-*`
  variable.
- No `ResizeObserver` is created on the server, and the server payload
  carries no `NaN`.

## 5. Not covered

- **Anchor on a pitch change.** A pitch change while scrolled keeps
  `scrollTop`, so the row at the top becomes `scrollTop / newPitch`. Measured:
  at `scrollTop` 300 000 a comfortable → compact flip moves the top row from
  5 001 to 5 771. CDK preserves no anchor. Before this change the stride did
  not follow at all.
- **One-frame fallback.** Until the observer's first delivery the stride is
  60 px. That is invisible at `scrollTop` 0, where every table starts.
- **No public accessor.** The measured pitch is not exposed. A consumer doing
  its own arithmetic has to re-derive it; the data-at-scale showcase's
  scroll-limit check resolves `3.75rem` against the root font size itself,
  which only works because it pins the table's density.
