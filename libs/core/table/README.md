# @malva-ui/core/table

Native table styling and responsive layout primitives for Malva UI. The table
keeps the browser's semantic table structure and does not render or manage
data; use `MlvDataTable` when those features are needed.

## Usage

```html
<table mlvTable [bordered]="true" hoverable="row" [responsive]="true" [popIn]="true" mlvDensity="compact" aria-label="People">
  <thead>
    <tr>
      <th scope="col">Name</th>
      <th scope="col">Role</th>
    </tr>
  </thead>
  <tbody>
    <tr mlvTableRow main>
      <td mlvTableCell data-label="Name">Ada Lovelace</td>
      <td mlvTableCell data-label="Role">Engineer</td>
    </tr>
    <tr mlvTableRow secondary>
      <td mlvTableCell colspan="2">Loves analytical engines.</td>
    </tr>
  </tbody>
</table>
```

`responsive` enables narrow-screen horizontal overflow. Add `popIn` and pair a
`main` row with a `secondary` row to use the mobile stacked presentation. Put
the most important, interactive content in the main row and supporting content
in the secondary row. Add `data-label` to main-row cells so their labels remain
visible when the header is visually collapsed on mobile.

`hoverable` accepts `"row"`, `"cell"`, or `false`.

For a secondary row, set `colspan` to the number of cells in its paired main
row. `colspan` is a numeric HTML attribute, so percentage values are not valid.

The table participates in the five-level Malva density system through
`mlvDensity`: `tight`, `compact`, `comfortable`, `spacious`, or `airy`. Omit it
to inherit the surrounding density context or the global default.

## Running unit tests

Run `yarn nx run core-table:vite:test --run` to execute the unit tests.
