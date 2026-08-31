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
| `responsive` | `BooleanInput`      | `false`   | Enables horizontal overflow styling for narrow viewports. Required for Pop In mode.      |
| `popIn`      | `BooleanInput`      | `false`   | Enables the paired main/secondary row presentation at the mobile breakpoint.             |
| `hoverable`  | `MlvTableHoverable` | `false`   | Applies pointer feedback to a whole row or individual data cells.                        |
| `mlvDensity` | `MlvDensity`        | inherited | Applies `tight`, `compact`, `comfortable`, `spacious`, or `airy` spacing and type scale. |

### Appearance classes

The component adds the BEM block `mlv-table` and state modifiers for the
selected inputs. It preserves native table roles and does not add a grid role.

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
