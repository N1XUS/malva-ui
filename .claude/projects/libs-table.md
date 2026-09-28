# @malva-ui/core/table

> **Keep this file up to date.** Update it whenever the table component,
> directives, styles, tests, or public API change.

**Path:** `libs/core/table`  
**Import path:** `@malva-ui/core/table`  
**Selector:** `table[mlvTable]`

Native table presentation primitives for common tables. The package enhances a
real HTML `<table>` rather than rendering rows or owning a data source. Use
`@malva-ui/core/data-table` for sorting, filtering, pagination, selection,
editing, virtual scroll, and other data-grid behavior.

## Public API

| Export              | Kind      | Description                                                                               |
| ------------------- | --------- | ----------------------------------------------------------------------------------------- |
| `MlvTable`          | Component | Adds Malva table appearance, responsive modes, and density support to `<table mlvTable>`. |
| `MlvTableRow`       | Directive | Marks a `<tr mlvTableRow>` as `main` or `secondary` for Pop In mode.                      |
| `MlvTableCell`      | Directive | Adds shared Malva cell styling to cells carrying `mlvTableCell`.                          |
| `MlvTableHoverable` | Type      | `false`, `'row'`, or `'cell'`.                                                            |

## `MlvTable`

### Inputs

| Input        | Type                | Default   | Description                                                                              |
| ------------ | ------------------- | --------- | ---------------------------------------------------------------------------------------- |
| `bordered`   | `BooleanInput`      | `false`   | Adds an outer boundary and cell separators.                                              |
| `responsive` | `BooleanInput`      | `false`   | Table scrolls its own inline overflow over one shared column grid. Required for Pop In.  |
| `popIn`      | `BooleanInput`      | `false`   | Enables the paired main/secondary row presentation at the mobile breakpoint.             |
| `hoverable`  | `MlvTableHoverable` | `false`   | Applies pointer feedback to a whole row or individual data cells.                        |
| `mlvDensity` | `MlvDensity`        | inherited | Applies `tight`, `compact`, `comfortable`, `spacious`, or `airy` spacing and type scale. |

### Appearance classes

The component adds the BEM block `mlv-table` and state modifiers for the
selected inputs. It preserves native table roles and does not add a grid role.

## Responsive mode

`[responsive]="true"`: the `<table>` itself becomes `display: block` +
`overflow-x: auto` — scrolls its own inline overflow, no wrapper, native
semantics kept.

- **One column grid.** A `display: block` table wraps caption + row groups in
  one anonymous table box (CSS 2.1 § 17.2.1), so header, data and footer cells
  share columns in both directions. Never give `thead` / `tbody` / `tfoot`
  their own `display: table` — each section then sizes columns from its own
  content, headers drift off their columns and the caption squeezes to its
  longest word (#355).
- **Fills the table.** The anonymous box is unstyleable and shrinks to fit, so
  every row ends with a generated `tr::after` cell: `0.0001%` width +
  `0.01rem` logical inline-start padding. Blink, WebKit and Gecko widen an
  auto-width table until a percentage column's max-content fits its share —
  legacy auto-layout behaviour the three share, **not** CSS Tables 3 (§ 3.9.1
  has no such inflation). Inflated width = padding / percentage, ~160 000px at
  a 16px root; past Blink / WebKit's 1 000 000px table limit it is clamped,
  still wider than any container. The share takes no visible width; the slack
  goes to the real columns as in a native table.
- **Padding floor.** Must stay ≥ 1 layout unit (1/64px Blink / WebKit, 1/60px
  Gecko) after root font size × zoom, or it rounds to 0 and the grid shrinks to
  its content. `0.001rem` did: grid at 39% of the table at a 10px root, ~60% at
  any zoom < 1 in Chromium / WebKit. `0.01rem` fills 100% in all three engines
  from an 8px root at 25% zoom to a 64px root at 500% zoom. Keep it ≥ `0.01rem`
  and < `0.0625rem` (under one CSS pixel at the default root; at a high
  device-pixel ratio it can still round to one device pixel — see the notch
  below) — the contract spec pins both.
- **Fill cell semantics.** Empty `content` — nothing added to the a11y tree
  (Chromium CDP tree and Gecko table model unchanged); hover / border rules
  target real cells only, so the fill column carries no row decoration.
- **One line per cell.** Data cells get `text-wrap-mode: nowrap` (headers were
  always `white-space: nowrap`) — a wide table scrolls instead of squeezing its
  columns. Wrap mode only: the inherited `white-space-collapse` survives, so
  text under an ancestor's `pre-line` / `pre-wrap` keeps its authored line
  breaks. Engines without `text-wrap-mode` take an `@supports not` fallback,
  `white-space: nowrap`, which collapses them.
- **Child-scoped.** Both rules match only the table's own rows (`> tr`, or
  `> thead | tbody | tfoot > tr` — an Angular template creates no implicit
  `tbody`). A table nested in a cell gets no fill cell; its cells still inherit
  the one-line wrap mode, like any other cell content.
- **Same column count per row.** Use `colspan`. In a shorter row the fill cell
  lands in a real column and skews the slack.
- **Renders differently from the old per-section tables** (API and tokens
  unchanged):
  - column widths shared across `thead` / `tbody` / `tfoot`;
  - caption as wide as the grid (was squeezed to its longest word);
  - content-sized container (float, absolutely positioned, inline-block,
    `width: fit-content`): Chromium / WebKit let the table take the available
    width, Firefox sizes it to its columns (all three were 344–345px in the
    test fixture). Give the container an explicit width to pin it;
  - grid `auto` track: the table takes its real column width (481 vs 344px in
    the fixture), so a neighbouring track gets less; flex items unchanged;
  - consumer `white-space: normal` on a cell descendant, or on a cell from an
    unlayered consumer rule, now wraps when the column is narrow — per-section
    `min-width: max-content` held every column at max-content;
  - 1-device-pixel notch at the inline end of row separators, the hover-row
    background and the bordered header underline at a high device-pixel ratio:
    the fill column sits outside every `tr > *` decoration. Firefox 155 at DSF 3
    (100% zoom) and DSF 2 (200%), WebKit 26.6 at DSF 2 (200%) and DSF 3 (150%);
    none in Chrome 153. No padding avoids it (filling needs ≥ `0.0078rem`, no
    notch at DSF 3 × 300% needs < ~`0.0035rem`); mirroring the decorations
    onto the fill cell is the tracked fix.
- **Pop In** (below `48rem`): cells go back to the inherited `white-space` (an
  ancestor's `pre-line` keeps its breaks in a card), fill cell dropped.
- **Tests.** Chromium geometry: `libs/core/table/e2e/table.spec.ts`
  (`yarn nx run core-table:e2e`, manual like every component e2e suite) —
  shared columns in LTR and under scoped `dir="rtl"`, fill (also at a 10px root
  and 90% zoom), one-line overflow, inherited `pre-line`, nested table, Pop In
  cards. Stylesheet contract (CI): `table-responsive-styles.spec.ts`.

## Pop In markup

Pop In is opt-in and requires both `[responsive]="true"` and `[popIn]="true"`.
Each data item is represented by a pair of native rows:

```html
<tr mlvTableRow main>
  <td mlvTableCell data-label="Name">...</td>
</tr>
<tr mlvTableRow secondary>
  <td mlvTableCell colspan="2">...</td>
</tr>
```

The main row should contain the minimum set of important or interactive cells.
The secondary row is for supporting display-only information. On narrow
viewports the table header is visually collapsed while remaining available to
assistive technology, main cells show their `data-label`, and the secondary
row becomes a quiet supporting surface. Set `colspan` to the number of cells in
the paired main row; it is a numeric HTML attribute and does not accept a
percentage.

## Styling

Styles use the `mlv-table` BEM block, shared Malva design tokens, rem units,
and a reduced-motion fallback. `MlvTable` integrates the shared
`MlvDensityDirective`; density changes cell padding and type scale while
preserving the native table structure. Unmarked native rows and cells remain
valid and retain the base table styling; the row/cell directives only provide
styling hooks and do not change native semantics.
