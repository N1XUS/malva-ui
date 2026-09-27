# @malva-ui/data-table

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

**Path:** `libs/core/data-table`
**Import path:** `@malva-ui/core/data-table`
**Selector:** `mlv-data-table`

Feature-rich data table component for Angular. Accepts a plain `T[]` array or a custom `MlvDataSource<T>` and renders a searchable, sortable, filterable table with toolbar or per-column filter presentation, pinned/sticky and resizable columns, virtual scroll, tree rows, editing, grouped headers, row selection, column visibility, loading, summaries, and paged or infinite pagination.

---

## Public API

| Export                          | Kind           | Description                                                                                                                   |
| ------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `MlvDataTable`                  | Component      | Main table component (`mlv-data-table`)                                                                                       |
| `MlvDataTableCell`              | Directive      | `mlvDataTableCell` structural directive for custom cell templates                                                             |
| `MlvDataTableEditCell`          | Directive      | `mlvDataTableEditCell` structural directive for custom edit-mode cell templates                                               |
| `MlvDataTableNoData`            | Directive      | `mlvDataTableNoData` structural directive for custom empty-state template                                                     |
| `MlvDataTableError`             | Directive      | `mlvDataTableError` structural directive for custom failed-request template                                                   |
| `MlvDataTableErrorContext`      | Interface      | Error template context (`{ $implicit: message, retry }`)                                                                      |
| `MlvDataTableFooter`            | Directive      | `mlvDataTableFooter` structural directive for custom footer summary row templates                                             |
| `MlvDataTableToolbarActions`    | Directive      | `mlvDataTableToolbarActions` optional host-action template rendered last in the Data Table toolbar                            |
| `MlvDataSource<T>`              | Abstract class | Base class for custom data sources — re-exported from `@malva-ui/cdk/data-source`                                             |
| `MlvArrayDataSource<T>`         | Class          | In-memory data source — handles filtering, sorting, pagination. Re-exported from `@malva-ui/cdk/data-source`                  |
| `MlvDataSourceState`            | Interface      | Serialisable source snapshot — re-exported from `@malva-ui/cdk/data-source`                                                   |
| `MlvDataTableColumn<T>`         | Interface      | Column definition type                                                                                                        |
| `MlvDataTableColumnGroup`       | Interface      | Column group definition for multi-row headers                                                                                 |
| `MlvFilterState`                | Interface      | Active filter state (`{ key, operator, value }`)                                                                              |
| `MlvDataSourceFilterOperator`   | Type           | `'contains' \| 'not-contains' \| 'equals' \| 'not-equals' \| 'in' \| 'not-in'` — re-exported from `@malva-ui/cdk/data-source` |
| `MlvDataTableFilterOperator`    | Type           | **Deprecated since 0.1.12, removed in 1.0** — alias of `MlvDataSourceFilterOperator`                                          |
| `MlvSearchState`                | Interface      | Global query plus the explicit column keys it may inspect                                                                     |
| `MlvSearchFieldTrigger`         | Type           | `'live' \| 'submit'` search commit strategy                                                                                   |
| `MlvFilterDisplay`              | Type           | `'toolbar' \| 'column' \| 'none'` filter-control placement                                                                    |
| `MlvSortState`                  | Interface      | Active sort state (`{ key, direction }`)                                                                                      |
| `MlvSortDirection`              | Type           | `'asc' \| 'desc'`                                                                                                             |
| `MlvEditMode`                   | Type           | `'row' \| 'cell'`                                                                                                             |
| `MlvEditEvent<T>`               | Interface      | Row edit start/cancel event (`{ row, index, sourceRow? }`) — `row` = draft, `index` = view index, `sourceRow` = consumer row  |
| `MlvEditSaveEvent<T>`           | Interface      | Row edit save event (`{ row, index, originalRow, sourceRow? }`) — see [Row identity](#row-identity)                           |
| `MlvRowClickEvent<T>`           | Interface      | Row click event (`{ row, index, event }`) — `row` is the consumer's own object                                                |
| `MlvSelectableMode`             | Type           | `'single' \| 'multi' \| false`                                                                                                |
| `MlvSelectionChangeEvent<T>`    | Interface      | Selection change event (`{ selectedRows, row? }`)                                                                             |
| `MlvPaginationMode`             | Type           | `'paged' \| 'infinite'` — pagination strategy                                                                                 |
| `MlvLoadMoreEvent`              | Interface      | Infinite-scroll load-more payload (`{ page, perPage, distance }`)                                                             |
| `MlvColumnFilterConfig`         | Interface      | Per-column filter options and allowed operators                                                                               |
| `MlvColumnValueLabels`          | Type           | Raw-value → label map for a column's default cell renderer                                                                    |
| `MlvColumnToneFn<T>`            | Type           | `(row: T) => MlvTone \| null \| undefined` per-row tone resolver                                                              |
| `MlvColumnResponsive`           | Type           | Responsive breakpoint map (`Record<string \| number, 'hidden' \| 'visible'>`)                                                 |
| `MlvColumnAlign`                | Type           | `'left' \| 'center' \| 'right'` — **logical alias**: `'left'` = `text-align: start`, mirrors in RTL                           |
| `MlvPinSide`                    | Type           | `'left' \| 'right'` — **logical alias**: `'left'` pins to the inline-start edge, mirrors in RTL                               |
| `MlvColumnResizeSource`         | Type           | `'pointer' \| 'keyboard' \| 'reset'` resize commit source                                                                     |
| `MlvColumnResizeEvent`          | Interface      | Committed column key, pixel width or reset, and interaction source                                                            |
| `MlvDataTablePresentationState` | Interface      | Durable sort, visible/pinned columns, committed width overrides, and items-per-page snapshot                                  |

---

## Components

### `MlvDataTable`

**File:** `libs/core/data-table/src/lib/data-table/data-table.ts`

- **Selector:** `mlv-data-table`
- **Change Detection:** `OnPush`
- **Encapsulation:** `None`
- **Template:** `libs/core/data-table/src/lib/data-table/data-table.html`
- **Styles:** `libs/core/data-table/src/lib/data-table/data-table.scss`

#### Inputs

| Input                     | Type                                   | Default     | Description                                                                                                                                                                                                              |
| ------------------------- | -------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `columns`                 | `MlvDataTableColumn[]`                 | required    | Column definitions                                                                                                                                                                                                       |
| `data`                    | `T[] \| MlvDataSource<T> \| undefined` | `undefined` | Row data — array (auto-wrapped) or custom data source                                                                                                                                                                    |
| `rowHeight`               | `number`                               | `40`        | Row height in px. Required when `virtualScroll` is on — must match the actual rendered row height (which depends on the active density) so the CDK viewport positions rows correctly.                                    |
| `virtualScroll`           | `boolean`                              | `false`     | Enable CDK virtual scroll for large datasets. Splits the table into a header table, a `cdk-virtual-scroll-viewport` body, and an optional footer table so only the visible row slice is rendered.                        |
| `striped`                 | `boolean`                              | `false`     | Alternating row shading                                                                                                                                                                                                  |
| `bordered`                | `boolean`                              | `false`     | Cell border lines                                                                                                                                                                                                        |
| `stickyHeader`            | `boolean`                              | `true`      | Sticky table header on scroll                                                                                                                                                                                            |
| `maxHeight`               | `string \| undefined`                  | `undefined` | Maximum height of the scrollable table area (e.g. `'28rem'`, `'400px'`). Enables vertical scroll.                                                                                                                        |
| `columnGroups`            | `MlvDataTableColumnGroup[]`            | `[]`        | Column group definitions for multi-row headers                                                                                                                                                                           |
| `editable`                | `BooleanInput`                         | `false`     | Enable editable mode (shows edit/save/cancel action buttons per row)                                                                                                                                                     |
| `editMode`                | `MlvEditMode`                          | `'row'`     | Edit granularity: `'row'` edits entire rows, `'cell'` edits individual cells                                                                                                                                             |
| `addRow`                  | `BooleanInput`                         | `false`     | Show an "Add row" button in the toolbar when editable                                                                                                                                                                    |
| `loading`                 | `BooleanInput`                         | `false`     | Show a centered loading overlay (spinner) on top of the table body                                                                                                                                                       |
| `error`                   | `boolean \| string`                    | `false`     | Failed-request state. `true` uses the localized default message, a non-empty string is used verbatim. Replaces the table body while set and not loading. See "Error State" below.                                        |
| `showSearch`              | `BooleanInput`                         | `true`      | Render the built-in toolbar search field when searchable columns exist. Set to `false` when an external control owns search; `searchQuery` and searchable-column behavior remain active.                                 |
| `showSortMenu`            | `BooleanInput`                         | `false`     | Render the localized generic Sort menu when at least one column is sortable. Menu actions share header-sort state and presentation-state emissions.                                                                      |
| `searchTrigger`           | `MlvSearchFieldTrigger`                | `'live'`    | Commit the built-in search field live after its debounce or only on explicit submit                                                                                                                                      |
| `searchDebounce`          | `number`                               | `200`       | Trailing delay in milliseconds for live search; values below zero are clamped to zero                                                                                                                                    |
| `searchQuery`             | `string` (model)                       | `''`        | Applied global query. It searches only columns marked `searchable` and can be controlled externally even when `showSearch` is false                                                                                      |
| `filterDisplay`           | `MlvFilterDisplay`                     | `'toolbar'` | Place table-owned filters in one toolbar dialog, as scoped column-header popovers, or hide the controls for an external filter surface                                                                                   |
| `activeFilters`           | `MlvFilterState[]` (model)             | `[]`        | Applied column predicates. Global search is OR across searchable keys, then ANDed with this filter list                                                                                                                  |
| `selectable`              | `MlvSelectableMode`                    | `false`     | Row selection mode: `'single'`, `'multi'`, or `false`                                                                                                                                                                    |
| `selectedRows`            | `Set<T>` (model)                       | `new Set()` | Two-way bindable set of currently selected rows                                                                                                                                                                          |
| `actionsHeaderLabel`      | `string`                               | `'Actions'` | Accessible name for the trailing actions-column header (shown when `editable`). Rendered as visually-hidden text so the `<th>` is never nameless. Plain English default; i18n token is a follow-up.                      |
| `paginationMode`          | `MlvPaginationMode`                    | `'paged'`   | `'paged'` renders the classic paginator footer; `'infinite'` hides it and emits `loadMore` as the user scrolls near the bottom                                                                                           |
| `hasMore`                 | `BooleanInput`                         | `true`      | In infinite mode, whether more data is available. Set to `false` when the data source is exhausted so the directive stops observing                                                                                      |
| `infiniteScrollThreshold` | `number`                               | `200`       | Distance in px from the bottom at which `loadMore` fires (infinite mode only)                                                                                                                                            |
| `cellNavigation`          | `BooleanInput`                         | `false`     | **Experimental.** Opt into cell-level keyboard navigation backed by `@angular/aria` grid directives. Non-virtual only — yields to row-level roving when `virtualScroll` is on. See "Experimental cell navigation" below. |

#### Outputs

| Output                    | Type                            | Description                                                                                                                                      |
| ------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `rowEditStart`            | `MlvEditEvent`                  | Emits when a row enters edit mode                                                                                                                |
| `rowEditSave`             | `MlvEditSaveEvent`              | Emits when the user confirms edits on a row                                                                                                      |
| `rowEditCancel`           | `MlvEditEvent`                  | Emits when the user cancels editing a row                                                                                                        |
| `rowAdd`                  | `void`                          | Emits when the user clicks "Add row"                                                                                                             |
| `rowClick`                | `MlvRowClickEvent`              | Emits when the user clicks any data row (not including selection checkbox clicks)                                                                |
| `selectionChange`         | `MlvSelectionChangeEvent`       | Emits whenever the row selection changes — including once when a saved row's written-back object replaces it (see [Row identity](#row-identity)) |
| `retry`                   | `void`                          | Emits when the error block's retry control is activated. The consumer refetches and clears `error`                                               |
| `columnResize`            | `MlvColumnResizeEvent`          | Emits committed pointer/keyboard widths and resets so consumers can persist column state                                                         |
| `presentationStateChange` | `MlvDataTablePresentationState` | Emits one normalized durable-presentation snapshot after a user sort, visibility, pin, committed resize/reset, or page-size action               |
| `loadMore`                | `MlvLoadMoreEvent`              | Emits in infinite mode when the user scrolls within `infiniteScrollThreshold` of the bottom (`{ page, perPage, distance }`)                      |

`selectedRows`, `searchQuery`, and `activeFilters` are `model()`s, so they also
emit `selectedRowsChange`, `searchQueryChange`, and `activeFiltersChange`.

#### Density

Uses `MlvDensityDirective` as a `hostDirective` with `mlvDensity` input exposed. Provides `MLV_DENSITY_ELEMENT = 'data-table'`.

Density-aware CSS custom properties set on the host cascade through the entire table:

| Variable                    | Tight         | Compact       | Comfortable   | Spacious      | Airy          |
| --------------------------- | ------------- | ------------- | ------------- | ------------- | ------------- |
| `--mlv-dt-row-height`       | `2.75rem`     | `3.25rem`     | `3.75rem`     | `4.25rem`     | `4.75rem`     |
| `--mlv-dt-cell-padding-x`   | `0.75rem`     | `1rem`        | `1.25rem`     | `1.5rem`      | `1.75rem`     |
| `--mlv-dt-header-height`    | `2.25rem`     | `2.5rem`      | `3rem`        | `3.25rem`     | `3.75rem`     |
| `--mlv-dt-font-size`        | `font-size-s` | `font-size-s` | `font-size-m` | `font-size-l` | `font-size-l` |
| `--mlv-dt-header-font-size` | `font-size-s` | `font-size-s` | `font-size-m` | `font-size-l` | `font-size-l` |
| `--mlv-dt-icon-size`        | `0.75rem`     | `0.875rem`    | `1rem`        | `1.125rem`    | `1.25rem`     |

#### Content children (structural directives)

- `mlvDataTableCell="key"` — custom cell template; context: `{ $implicit: row, row, index }` — `row` is the consumer's own object (the edit draft while that row is edited), `index` the view index. A display template that writes to `row` (a `[(ngModel)]` checkbox) mutates consumer data — copy first if that is not wanted
- `mlvDataTableEditCell="key"` — custom edit-mode cell template; context: `{ $implicit: row, row, index }` — `row` is the edit draft; assign its **top-level** properties freely. Nested objects are shared with the consumer's row — replace (`row.meta = { ...row.meta, tag }`), never mutate in place
- `mlvDataTableNoData` — custom empty-state template shown when filtered data is empty
- `mlvDataTableError` — custom failed-request template; context: `{ $implicit: message, retry: () => void }`
- `mlvDataTableFooter` — custom footer summary row template rendered inside `<tfoot>`; context: `{ $implicit: visibleColumns }`
- `mlvDataTableToolbarActions` — optional host-owned action template rendered after table-owned Search, Sort, Columns, and Filter controls in the single toolbar

#### Internal state (signals on the component instance)

| Signal           | Description                                                  |
| ---------------- | ------------------------------------------------------------ |
| `activeFilters`  | Current `MlvFilterState[]` — a `model()`, two-way bindable   |
| `searchQuery`    | Applied global search string — a `model()`, two-way bindable |
| `currentSort`    | Current `MlvSortState \| null`                               |
| `currentPage`    | Active page number                                           |
| `currentPerPage` | Active items-per-page                                        |
| `containerWidth` | Tracked element width (drives responsive columns)            |

#### Template-facing public methods

The component template drives every feature through public methods on the
instance. They are part of the declared surface (not `_`-prefixed), but they
exist for the component's own template — a consumer normally reaches for the
inputs/outputs above instead.

| Area              | Methods                                                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cell rendering    | `getTemplate`, `getCellContext`, `getCellValue`, `getCellDisplayValue`, `getCellTone`, `getAlignClass`, `getCellStyle`                                                               |
| Empty/error state | `getNoDataTemplate`, `getErrorTemplate`, `onRetry`                                                                                                                                   |
| Editing           | `getEditTemplate`, `isEditing`, `startEdit`, `saveEdit`, `cancelEdit`, `onAddRow`                                                                                                    |
| Rows              | `onRowClick`, `isRowSelected`, `toggleRowSelection`, `toggleSelectAll`, `onInfiniteScrollLoadMore`                                                                                   |
| Columns           | `isColumnHidden`, `toggleColumnVisibility`, `getColStyle`, `getColWidth`, `getFooterTemplate`                                                                                        |
| Search & filters  | `onSearch`, `isColumnFiltered`, `getFilterLabel`, `onColumnFiltersChange`, `getColumnFilterColumns`, `focusColumnFilterTrigger`                                                      |
| Pinning           | `getPinnableSides`, `togglePin`, `pinTo`, `unpin`, `isColumnPinned`, `getColumnPinSide`                                                                                              |
| Tree rows         | `isRowExpanded`, `hasChildren`, `getDepth`, `toggleExpand`                                                                                                                           |
| Sorting           | `onSortClick`, `getSortDirection`, `getSortLabel`                                                                                                                                    |
| Column resizing   | `onResizeStart`, `onColumnResizeKeydown`, `getColumnResizeLabel`, `getColumnResizeValue`, `getColumnResizeMin`, `getColumnResizeMax`, `getColumnResizeValueText`, `resetColumnWidth` |
| Presentation      | `getPresentationState`, `applyPresentationState`                                                                                                                                     |

---

## Directives

### `MlvDataTableCell`

**File:** `libs/core/data-table/src/lib/data-table-cell.ts`
**Selector:** `[mlvDataTableCell]`

Structural directive for custom cell templates with full generic type inference.

#### Inputs

| Input       | Alias                  | Type                                   | Description                                                              |
| ----------- | ---------------------- | -------------------------------------- | ------------------------------------------------------------------------ |
| `columnKey` | `mlvDataTableCell`     | `string` (required)                    | Column key this template handles                                         |
| `from`      | `mlvDataTableCellFrom` | `T[] \| MlvDataSource<T> \| undefined` | Pass the same value as `[data]` — Angular infers `T` and types `let-row` |

#### Type narrowing

The directive declares `static ngTemplateContextGuard` so Angular narrows the template context to `MlvDataTableCellContext<T>`, giving full autocomplete on `let-row` without bracket indexing.

#### Usage — asterisk shorthand (preferred)

```html
<span *mlvDataTableCell="'salary'; let row from employees"> ${{ row.salary.toLocaleString() }} </span>
```

Microsyntax expands to `[mlvDataTableCell]="'salary'" [mlvDataTableCellFrom]="employees" let-row`. Angular infers `T` from the type of `employees`.

#### Usage — explicit `ng-template`

```html
<ng-template mlvDataTableCell="status" [mlvDataTableCellFrom]="employees" let-row>
  <span [class]="'badge--' + row.status">{{ row.status }}</span>
</ng-template>
```

### `MlvDataTableEditCell`

**File:** `libs/core/data-table/src/lib/data-table-edit-cell.ts`
**Selector:** `[mlvDataTableEditCell]`

Structural directive for custom edit-mode cell templates. Mirrors `MlvDataTableCell` API. When a row enters edit mode, the edit template replaces the display template for matching column keys.

#### Inputs

| Input       | Alias                      | Type                                   | Description                                                              |
| ----------- | -------------------------- | -------------------------------------- | ------------------------------------------------------------------------ |
| `columnKey` | `mlvDataTableEditCell`     | `string` (required)                    | Column key this edit template applies to                                 |
| `from`      | `mlvDataTableEditCellFrom` | `T[] \| MlvDataSource<T> \| undefined` | Pass the same value as `[data]` — Angular infers `T` and types `let-row` |

Like `MlvDataTableCell`, it declares `static ngTemplateContextGuard` so the
template context narrows to the row type.

#### Usage

```html
<mlv-input *mlvDataTableEditCell="'name'; let row from employees" [ngModel]="row.name" (ngModelChange)="row.name = $event" />
```

### `MlvDataTableNoData`

**File:** `libs/core/data-table/src/lib/data-table-no-data.ts`
**Selector:** `[mlvDataTableNoData]`

Structural directive. Template is shown in the table body when the data source returns zero rows.

```html
<ng-template mlvDataTableNoData>
  <p>No items found — try adjusting your filters.</p>
</ng-template>
```

### `MlvDataTableError`

**File:** `libs/core/data-table/src/lib/data-table-error.ts`
**Selector:** `[mlvDataTableError]`

Structural directive. Replaces the default error block described under "Error State". Context is `MlvDataTableErrorContext` — `{ $implicit: message, retry: () => void }` — narrowed by a `static ngTemplateContextGuard`.

```html
<ng-template mlvDataTableError let-message let-retry="retry">
  <p>{{ message }}</p>
  <button mlvButton variant="secondary" type="button" (click)="retry()">Try again</button>
</ng-template>
```

---

## Editable Mode

Enable editing with `[editable]="true"`. An actions column is appended with edit/save/cancel buttons per row.

### Edit flow

1. User clicks pencil icon → `startEdit(row, index)` clones the row into a **draft** (plus a pre-edit snapshot) and emits `rowEditStart` (`{ row: draft, index, sourceRow }`)
2. Edit templates replace display templates for columns that have a `mlvDataTableEditCell` defined. Every template of that row — edit and display — receives the draft, so edits show live across the row; the table never assigns a property of the consumer's object (a template mutating a nested object in place still writes through — the draft is shallow)
3. User clicks check → `saveEdit(row, index)` ends the edit and emits `rowEditSave` (`{ row: draft, index, originalRow: snapshot, sourceRow }`). The table does not write back — replace `sourceRow` with `row` in your data (or `Object.assign(sourceRow, row)`). **Until you do, the row renders its pre-edit values**: an async / pessimistic save flashes the old value — write back optimistically in the handler and roll back on failure
4. User clicks X → `cancelEdit(row, index)` drops the draft (the row renders its untouched top-level values again) and emits `rowEditCancel` (`{ row: discarded draft, index, sourceRow }`)

`startEdit` / `saveEdit` / `cancelEdit` accept the rendered row or the draft (an edit template may pass its own `row` back). Starting a row that is already being edited keeps the in-progress draft.

### Row identity

Edit state is keyed by the consumer's **row object**, never by view position (#297). Before, it was keyed by the `@for` index: sorting, filtering, searching, paging or expanding a tree node moved a different row into that position, which then rendered in edit mode, and saving paired it with the wrong `originalRow`. Breaking, behaviour only — consumer shapes and actions in [docs/migrations/2026-09-data-table-row-identity.md](../../docs/migrations/2026-09-data-table-row-identity.md). Now:

- An edit follows its row through sort / filter / search / page / tree expansion, survives the row leaving the view, and ends only on save or cancel. A row replaced by a **new object** (a refetch that rebuilds rows) is no longer the edited row and does not render in edit mode — silently, with no `rowEditCancel` (the orphaned session is not pruned; #419). Same for the replace write-back of an earlier async save landing while the row is being edited again: the new edit ends and its typed values are lost.
- A row object listed at **two positions** is one row: editing either puts both into edit mode, sharing one draft.
- `index` keeps its meaning (decision D36): the row's **view index** when the event fires — not a position in your data. `isEditing(index)` answers for whichever row is rendered at that index now.
- `sourceRow` (new, optional on the type so code constructing the event keeps compiling; always set by the table) is the object you passed in `data` — the key to write back by.
- Rows the table hands out — `rowClick.row`, the `row` of a non-edited row's cell templates, the argument of a `tone` function, `flatRows()` — are the consumer's own objects (`===`), not copies. Writing to one writes your data; copy it yourself where you relied on a copy. With nothing expanded `flatRows()` **is** the `displayRows()` array — never sort / splice it in place. They carry no `_mlvDepth` / `_mlvRef` keys any more, and the internal `MlvDataRow` type no longer declares them (a typed read fails TS2339); those were internal and never public API.
- Draft and `originalRow` are **shallow** clones that keep the row's prototype, so a class-instance row keeps its getters and methods while edited and `rowEditSave.row instanceof YourClass`. They read what `{ ...row }` reads (own enumerable string + symbol keys, values through `[[Get]]`) and **define** each key on `Object.create(proto)` as plain writable data — not `Object.assign`, whose `[[Set]]` threw on an own property shadowing a getter-only prototype accessor and handed a value to a prototype setter instead of creating the own property. A frozen row (NgRx dev freeze) still yields a writable draft, and an own getter is read into a data value (copying descriptors would keep the freeze and the live getter). Caveats: nested objects are shared (not deep-cloned — that would break class instances); ECMAScript `#private` fields and built-in internal slots are not copied, so a member reading a `#private` field throws on the draft, and so does an inherited method of a `Date` / `Map` / `Set` subclass row.

Write back by identity, either way:

```ts
onSave(event: MlvEditSaveEvent<Employee>): void {
  // Replace the object …
  this.employees.update((rows) => rows.map((row) => (row === event.sourceRow ? event.row : row)));
  // … or copy onto it and publish a new array: the row keeps its object.
  // Object.assign(event.sourceRow!, event.row);
  // this.employees.update((rows) => [...rows]);
}
```

Selection and tree expansion are keyed by row object too, so replacing the object would drop the saved row from both. The table carries them over:

- A save records `draft → sourceRow`. If the **next data emission** contains the saved `row` (at any depth — tree children included) and no longer contains `sourceRow`, `selectedRows` (order kept, `selectionChange` emitted) and the expanded set swap `sourceRow` for `row`.
- The data emission: array `data` → the array itself; a sort / filter / search / page change is **not** an emission. `MlvDataSource` → the connected page, so each sort / filter / search / page change **is** one.
- The record is dropped at that emission whatever it holds — write back in the save handler or in the first emission after it. Deliberately not retained longer (a record kept until the row turns up could live forever).
- Not carried: an emission that lacks the saved object (an async save whose first emission is unrelated); a server echo that is a new object (carry state to it yourself). Tree child written back immutably with its parent rebuilt: the child's selection **carries**; the rebuilt parent is a new object and renders collapsed (pre-existing).
- `MlvDataSource` limitations (the table sees only the page): a sort / filter / search / page change between save and a late write-back drops the record; a write-back that moves the saved row **to another page** (rename under a name sort, status change under a status filter) leaves it unselected there with `selectedRows` holding the stale pre-edit object — was kept selected via `_mlvRef` before; a save-as-copy that pushes the source off the page moves the selection from source to copy. Consumer carries selection itself in the save handler. Migration doc § "With an `MlvDataSource`, only the connected page is seen".
- Virtual mode: a replaced object re-creates its row view (`trackBy` is the row). `Object.assign(sourceRow, row)` keeps the object and needs none of this.

### Add row

Set `[addRow]="true"` to show an "Add row" button in the toolbar. The `rowAdd` output emits — the consumer is responsible for appending the new row to the data source.

### Example

```html
<mlv-data-table [data]="employees" [columns]="columns" editable addRow (rowEditSave)="onSave($event)" (rowAdd)="onAddRow()">
  <mlv-input *mlvDataTableEditCell="'name'; let row from employees" [ngModel]="row.name" (ngModelChange)="row.name = $event" />
  <mlv-input *mlvDataTableEditCell="'email'; let row from employees" [ngModel]="row.email" (ngModelChange)="row.email = $event" />
</mlv-data-table>
```

The `(ngModelChange)="row.name = $event"` writes go to the draft, not to `employees`.

---

## Column Groups (Multi-Row Headers)

Define `[columnGroups]` to render a two-row header. Columns in a group get a shared group header cell with colspan. Columns not belonging to any group get `rowspan="2"` and span both header rows.

```ts
columnGroups: MlvDataTableColumnGroup[] = [
  { title: 'Personal Info', columns: ['firstName', 'lastName', 'email'] },
  { title: 'Employment',    columns: ['department', 'role', 'salary'] },
];
```

```html
<mlv-data-table [data]="employees" [columns]="columns" [columnGroups]="columnGroups" />
```

### `MlvDataTableColumnGroup`

```ts
interface MlvDataTableColumnGroup {
  title: string; // Display title for the group header cell
  columns: string[]; // Column keys this group spans
  align?: MlvColumnAlign; // Optional alignment (default: center)
}
```

---

## Row Selection

Set `selectable="multi"` or `selectable="single"` to enable row selection. The table inserts a dedicated checkbox column before the first data column.

- `'multi'` — each row has a checkbox, plus a header checkbox that selects/deselects all visible rows with an indeterminate state.
- `'single'` — only one row can be selected at a time; checking a row clears any previous selection.

The selection state is exposed via the `selectedRows` two-way bindable model (a `Set<T>`) and the `selectionChange` output.

```ts
readonly selected = signal<Set<Record<string, unknown>>>(new Set());
readonly total = computed(() => {
  let sum = 0;
  for (const row of this.selected()) sum += (row as User).score;
  return sum;
});
```

```html
<mlv-data-table [data]="users" [columns]="columns" selectable="multi" [(selectedRows)]="selected" (selectionChange)="onChange($event)" />
```

Selection survives pagination because the consumer's row object is the identity key — for tree rows too; rendered rows are never copies.

> **Checkbox labelling** — header/row selection checkboxes are labelled via the
> `mlv-checkbox` `[ariaLabel]` input (never `[attr.aria-label]` on the host),
> which forwards the name to the checkbox's inner native input. This resolved
> the former `aria-prohibited-attr` axe exception. (The former
> `nested-interactive` and `empty-table-header` exceptions on the sortable and
> actions headers are also fixed — see "Sortable headers" and "Actions column
> header" below.)

---

## Row Click

Subscribe to `(rowClick)` to react to users clicking a data row. The event contains `{ row, index, event }` — `row` is the consumer's own object (not a copy), so bind a detail form to `{ ...$event.row }` unless it should write the table's data live. Clicks on selection checkboxes are stopped from bubbling so they do not trigger `rowClick`.

```html
<mlv-data-table [data]="rows" [columns]="columns" (rowClick)="openDetails($event.row)" />
```

---

## Infinite Scroll Pagination

Set `paginationMode="infinite"` to replace the classic paginator footer with infinite scrolling. The table hides the paginator, forces its internal `MlvArrayDataSource` to emit every row in the bound array (no per-page slicing), and attaches the `[mlvInfiniteScroll]` directive from `@malva-ui/cdk/infinite-scroll` to its scroll wrapper.

When the user scrolls within `infiniteScrollThreshold` pixels of the bottom, the table emits `(loadMore)` with `{ page, perPage, distance }`. The consumer is responsible for fetching the next page and appending the new rows to the array bound to `[data]`.

Bind `[loading]` to your in-flight fetch flag so the directive suppresses duplicate emissions during a single scroll gesture. While `[loading]` is truthy in infinite mode, the table renders a compact circular spinner inline at the bottom of the scroll wrapper (below the last row) instead of the full-table overlay used in paged mode — this keeps the already-loaded rows fully visible while the next page is being fetched. Bind `[hasMore]` to `false` once the backing source has been exhausted so the directive stops observing. A `maxHeight` is required so the table wrapper is actually scrollable — otherwise the page body is the scrolling surface and the directive has nothing to observe.

```ts
readonly rows = signal<Transaction[]>(buildPage(1));
readonly isLoading = signal(false);
readonly hasMore = signal(true);

onLoadMore(event: MlvLoadMoreEvent) {
  if (this.isLoading() || !this.hasMore()) return;
  this.isLoading.set(true);
  fetchPage(event.page).then((next) => {
    this.rows.update((current) => [...current, ...next]);
    if (event.page >= TOTAL_PAGES) this.hasMore.set(false);
    this.isLoading.set(false);
  });
}
```

```html
<mlv-data-table [data]="rows()" [columns]="columns" paginationMode="infinite" [loading]="isLoading()" [hasMore]="hasMore()" maxHeight="24rem" (loadMore)="onLoadMore($event)" />
```

---

## Virtual Scroll

Set `[virtualScroll]="true"` to use Angular CDK's `cdk-virtual-scroll-viewport` for efficient rendering of very large datasets. Only the visible slice of rows is materialized in the DOM; as the user scrolls, rows are recycled.

### Architecture — split tables

A single `<table>` cannot be used with `cdk-virtual-scroll-viewport` because the viewport applies a CSS `transform` to its inner content wrapper, which silently breaks `position: sticky` on descendants (sticky headers and pinned columns). To work around this, the table is split into **three separate `<table>` elements** in virtual mode:

1. **Header table** (`.mlv-data-table__table--virtual` with `<thead>` only) — rendered **outside** the viewport so it sits above the scroll surface in normal document flow.
2. **Body table** (`.mlv-data-table__table--virtual` with `<tbody>` only) — rendered **inside** the `cdk-virtual-scroll-viewport`. Uses `*cdkVirtualFor` to render only the visible slice of `flatRows()`.
3. **Footer table** (`.mlv-data-table__table--virtual` with `<tfoot>` only) — rendered **outside** the viewport below the body, only when a `mlvDataTableFooter` template is projected.

All three tables share the same `<colgroup>` (rendered via the internal `#colgroupTpl`) and use `table-layout: fixed`, so column widths stay perfectly aligned across the split tables. The wrapper itself uses `overflow-y: visible` in virtual mode — all vertical scrolling happens inside the viewport.

### Row height requirement

CDK virtual scroll requires a fixed item height so it can compute the positions of non-rendered rows. The `rowHeight` input is passed to `[itemSize]` on the viewport, and each rendered `<tr>` has its height forced via `[style.height.px]="rowHeight()"`.

**`rowHeight` MUST match the actual rendered row height for the active density**, otherwise the viewport will mis-position rows and the table will appear jumpy. See the density table above for the default `--mlv-dt-row-height` per density step (e.g. `60` for comfortable at 3.75rem = 60px).

### Viewport height

The viewport requires an explicit height because `cdk-virtual-scroll-viewport` does not derive its size from its content. The component exposes a `virtualViewportHeight` computed signal that returns `maxHeight()` if provided, otherwise falls back to `'24rem'`. Pass `[maxHeight]` (e.g. `'32rem'`) to control the visible height of the scroll area in virtual mode.

### The repeater outlives every empty state

`cdk-virtual-scroll-viewport` publishes its rendered range on a plain `Subject`, so a `*cdkVirtualFor` constructed while the viewport already exists receives no range until the range next changes — it renders nothing until somebody scrolls. The virtual `<tbody>` therefore keeps the repeater mounted unconditionally and drives it from an internal `_virtualRows()` computed (`flatRows()`, or `[]` while an error is shown); the no-data and error rows are siblings of the repeater, never a structural `@if` wrapped around it. With the repeater behind `@if`, any empty → refill transition (a search that matches nothing, then cleared) destroyed and rebuilt it against a surviving viewport, leaving a correctly sized scrollbar with zero rows and no message until the next scroll. No public API change; covered by `data-table-virtual-repeater.spec.ts`.

### Scroll syncing and geometry are set up after render, never on a server

The wrapper/viewport horizontal scroll mirroring and the gutter/extent
measurement are registered from an **`afterNextRender`** scheduled by the
virtual-scroll effect, not from the effect body itself. The block reads
`offsetWidth`, `clientWidth` and `scrollWidth` and attaches `scroll` listeners
plus a `ResizeObserver`. During server rendering the two `viewChild` refs it
needs _do_ resolve — view queries run on the server — so the effect body ran
there, the measurements resolved `undefined`, subtracted to `NaN`, and
`NaNpx` was serialised into the markup. A `NaN` is not an exception, so nothing
reached the `ErrorHandler` and the payload shipped silently corrupt.

Render hooks never run on the server, so scheduling the whole block through one
removes the class of problem rather than guarding each measurement. The
dependency reads (`virtualScroll()`, `tableWrapperRef()`,
`_virtualViewportRef()`) stay in the effect body, so the block is still
re-scheduled when virtual scroll toggles or the viewport is re-created; the
effect's `onCleanup` destroys a pending hook and unsubscribes the previous
generation's listeners. No public API change. Covered by the SSR smoke suite in
`@malva-ui/core` (`writes no NaN into the server payload`, with a
`virtualScroll` host) and by `data-table-virtual-repeater.spec.ts` for the
browser side.

### The paging effects never track the data source

`MlvDataTable` pushes `page` and `perPage` onto `effectiveDataSource()` from two
`effect()`s. Both calls are wrapped in `untracked()`, and they must stay that
way. A data source is free to read its own state inside those setters — a
server-backed subclass typically compares the incoming value against the one it
already holds so a no-op call does not cost a round trip — and tracked, those
reads join the effects' dependency sets. `MlvDataSource.setPerPage` resets the
page to 1, which is a write to one of them, so the two effects then retrigger
each other synchronously inside a single change-detection pass. That loop never
yields to a microtask: one click on "next page" freezes the tab outright, and
page 1 hides it entirely because the subclass's guard short-circuits there. Only
the table's own inputs belong in those dependency sets. Covered by
`data-table-paging-effects.spec.ts`, whose fake source turns the runaway into a
counted failure instead of a hung worker.

### Mutual exclusion with infinite scroll

Virtual scroll and infinite scroll (`paginationMode="infinite"`) solve different problems and are **mutually exclusive** in this component:

- **Infinite scroll** — progressively fetches more data from a remote source as the user scrolls near the bottom; all fetched rows remain in the DOM.
- **Virtual scroll** — assumes the full dataset is already in memory and renders only the visible slice.

When `virtualScroll` is on, the `[mlvInfiniteScroll]` directive is disabled and the bottom loader is not rendered. Use the classic paginator or no pagination at all with virtual scroll.

### Limitations

- **Sticky footer** — the footer table sits outside the scroll viewport, so it is always "pinned" under the body. There is no separate `sticky`/`non-sticky` mode in virtual mode.
- **Loading overlay** — the standard loading overlay still covers the whole component (including the sticky header) in virtual mode.
- **Pinned columns** — work correctly because `<colgroup>` + `table-layout: fixed` keeps widths aligned and pinned cells use `position: sticky` relative to their own `<table>`, not the viewport.

### Example

```ts
// Generate or fetch a large dataset up front
readonly rows = signal<Transaction[]>(generateLargeDataset(10_000));
readonly columns: MlvDataTableColumn[] = [
  { key: 'id', title: 'ID', width: '100px' },
  { key: 'merchant', title: 'Merchant', width: '220px' },
  { key: 'amount', title: 'Amount', align: 'right', width: '120px' },
  { key: 'status', title: 'Status', width: '140px' },
];
```

```html
<mlv-data-table [data]="rows()" [columns]="columns" [virtualScroll]="true" [rowHeight]="60" maxHeight="32rem" />
```

---

## Loading State

Set `[loading]="true"` to show a loading indicator. The rendering differs by `paginationMode`:

- **`paginationMode="paged"` (default)** — A centered spinner is rendered on top of the entire component inside a translucent backdrop (`.mlv-data-table__loading-overlay`). Existing rows remain visible beneath so the user keeps context during a refetch.
- **`paginationMode="infinite"`** — A compact circular spinner is rendered inline at the bottom of the scroll wrapper (`.mlv-data-table__loading-bottom`), directly below the last row. No backdrop is drawn; the already-loaded rows stay fully interactive while the next page is being fetched.

```html
<mlv-data-table [data]="rows" [columns]="columns" [loading]="isLoading()" />
```

---

## Error State

`[error]` distinguishes "the request failed" from "there is nothing to show" — without it a 500 renders as an empty list.

| Value                  | Result                                                |
| ---------------------- | ----------------------------------------------------- |
| `false` (default)      | No error; the table renders normally                  |
| `true`                 | Error block with the localized `errorMessage` default |
| a non-empty string     | Error block with that string as the message           |
| `''` / whitespace-only | Treated as no error                                   |

**Precedence and visibility**

- While `error` is set **and** `loading` is falsy, the error block replaces the entire table body — it outranks both the data rows and the `mlvDataTableNoData` template. `showError()` exposes this decision.
- `loading` wins: an in-flight refetch suppresses the previous failure so the spinner is not competing with a stale message.
- Rendered in all three body paths (standard, virtual scroll, experimental cell navigation).

**Default block**

An `mlv-empty-state` inside `.mlv-data-table__error` (`role="alert"`, `aria-live="assertive"`) with a danger-toned `lucideTriangleAlert` icon (`.mlv-data-table__error-icon`, `--mlv-text-negative`), the localized `errorTitle`, the resolved message, and a `button[mlvButton]` (`variant="secondary"`) that emits `(retry)`. Strings come from `MLV_DATA_TABLE_I18N` (`errorTitle`, `errorMessage`, `retry`).

The consumer owns the refetch and is responsible for clearing `error` once it succeeds.

```ts
readonly rows = signal<Invoice[]>([]);
readonly error = signal<boolean | string>(false);
readonly isLoading = signal(false);

reload(): void {
  this.isLoading.set(true);
  fetchInvoices()
    .then((next) => { this.rows.set(next); this.error.set(false); })
    .catch((e) => this.error.set(e.userMessage ?? true))
    .finally(() => this.isLoading.set(false));
}
```

```html
<mlv-data-table [data]="rows()" [columns]="columns" [error]="error()" [loading]="isLoading()" (retry)="reload()" />
```

Project `<ng-template mlvDataTableError>` (see `MlvDataTableError` above) to replace the default block; the alert region wrapper is kept around the projected content.

---

## Column Visibility Toggle

Mark individual columns with `hideable: true` to opt them into the column visibility popup. A "Columns" button appears in the toolbar and lists every hideable column with a checkbox; users can toggle columns on and off at runtime. Columns without `hideable` are always visible and cannot be hidden.

```ts
columns: MlvDataTableColumn[] = [
  { key: 'id',      title: 'ID' },                   // always visible
  { key: 'name',    title: 'Name' },                 // always visible
  { key: 'email',   title: 'Email',   hideable: true }, // user-toggleable
  { key: 'phone',   title: 'Phone',   hideable: true }, // user-toggleable
  { key: 'created', title: 'Created', hideable: true }, // user-toggleable
];
```

Internally tracked via the `_hiddenColumns` signal; hidden columns are filtered out of `visibleColumns` before layout calculations.

---

## Durable presentation snapshots

`getPresentationState()` returns the durable presentation settings that a host
may persist with a saved view:

```ts
interface MlvDataTablePresentationState {
  readonly sort: MlvSortState | null;
  readonly visibleColumnKeys: readonly string[];
  readonly pinnedStartColumnKeys: readonly string[];
  readonly pinnedEndColumnKeys: readonly string[];
  readonly columnWidths: Readonly<Record<string, number>>;
  readonly perPage: number;
}
```

Keys are returned in declared-column order. The snapshot intentionally excludes
the current page, row selection, search, filters, loading/error state, and
overlays. `applyPresentationState(partial)` changes only supplied fields,
ignores stale column keys, clamps widths and page size, resets the transient
page to one, and does not emit an echo. Hosts receive exactly one full,
normalized `(presentationStateChange)` snapshot after a user sort, column
visibility action, pin/unpin, committed resize/reset, or items-per-page change;
page-only movement remains transient. Non-hideable declared columns are always
restored to the visible list during application, and `Infinity` is preserved as
the paginator's all-items page-size sentinel.

---

## Footer Summary Row

Project a `<ng-template mlvDataTableFooter>` into the table to render a summary row inside a `<tfoot>` element. The template receives the current visible columns as its implicit context. Emit semantic `<th>`/`<td>` elements directly; the component owns their density padding, height, vertical alignment, top divider, opaque sticky surface, and bordered-cell separators without requiring consumers to apply private BEM classes.

```html
<mlv-data-table [data]="items" [columns]="columns">
  <ng-template mlvDataTableFooter let-cols>
    <th scope="row" [attr.colspan]="cols.length - 1">Total</th>
    <td>{{ subtotal() }}</td>
  </ng-template>
</mlv-data-table>
```

The footer uses `position: sticky; bottom: 0` when `[stickyHeader]="true"` so it stays visible while scrolling.

---

## Data Sources

> **Moved.** `MlvDataSource`, `MlvArrayDataSource`, `MlvSortDirection`, `MlvSortState`, `MlvFilterState`, `MlvSearchState` and `MlvDataSourceState` now live in **`@malva-ui/cdk/data-source`** (`libs/cdk/data-source`) so the option controls can share them without a cycle through `@malva-ui/core/dropdown`. `libs/core/data-table/src/lib/data-source.ts` is a compat re-export — every `@malva-ui/core/data-table` import keeps working unchanged. See [libs-cdk-data-source.md](libs-cdk-data-source.md) for the full contract.

### `MlvDataSource<T>` (abstract)

**File:** `libs/cdk/data-source/src/lib/data-source.ts` (re-exported from `libs/core/data-table/src/lib/data-source.ts`)

Extend this class to implement server-side pagination, remote filtering, or any custom data access.

```ts
class MyServerDataSource extends MlvDataSource<MyRow> {
  readonly totalItems = signal(0);
  connect(): Signal<MyRow[]> { ... }
}
```

Protected signals available in subclasses: `_sort`, `_filters`, `_search`, `_page`, `_perPage`, `_loading`. Public readonly counterparts: `sort`, `filters`, `search`, `page`, `perPage`, `loading`.

`_loading` (default `false`) is new — flip it **synchronously** when a request starts and back when it settles, so consumers can tell "loaded and empty" from "not fetched yet". The table's own `[loading]` input is independent of it; a custom source can drive both.

`connect()` returns the **current page's slice**, never an accumulated array.

### `MlvArrayDataSource<T>`

**File:** `libs/cdk/data-source/src/lib/array-data-source.ts` (re-exported from `libs/core/data-table/src/lib/data-source.ts`)

Default in-memory data source. Pass a `T[]` array or a `Signal<T[]>`. Automatically created when you pass an array to `[data]`.

`T` is no longer constrained to `extends object` — primitive rows (`string[]`, `number[]`) are supported for the option controls.

Filter operators: `contains`, `not-contains`, `equals`, `not-equals`, `in`, `not-in`. `setSearch()` stores a query plus explicit keys, normalizes case and diacritics, matches with OR semantics across those keys, and ANDs the result with column filters before sorting and pagination. `setSearch()` and `setFilters()` both reset the page to one.

**Natural-field search.** An **empty** `keys` array no longer means "match nothing" — it means "match the row's natural fields": a primitive row is matched on `String(row)`, an object row on every own enumerable string/number/boolean value. The data table always passes its `searchable` column keys, so its behaviour is unchanged; the mode exists for `mlv-select`/`mlv-combobox`/`[mlvAutocomplete]`, which know no column keys.

### Filter operator type

The shared declaration is **`MlvDataSourceFilterOperator`** in `@malva-ui/cdk/data-source` (deliberately not `MlvFilterOperator` — `@malva-ui/core/filter` owns that name for its own, wider 16-member condition union). `@malva-ui/core/data-table` star-re-exports it and additionally keeps `MlvDataTableFilterOperator` as a `@deprecated` alias, so every existing import keeps compiling. New code should use `MlvDataSourceFilterOperator` — the library's own internals (`MlvFilterDropdown`, `MlvColumnFilterConfig.operators`) and the docs examples already do; the alias declaration in `types.ts` is its only remaining use in the repo.

---

## Column Definition (`MlvDataTableColumn<T>`)

```ts
interface MlvDataTableColumn<T = unknown> {
  key: string; // matches a key of T
  title?: string; // header label (defaults to key)
  sortable?: boolean; // click header to sort
  searchable?: boolean; // include this column in global search
  filterable?: boolean; // show column in filter dropdown
  /**
   * User-pinning mode. Controls whether the header pin button is shown and which sides are allowed.
   * - `true`                    → both sides (click opens a popup with left / right / unpin)
   * - `'left'` / `'right'`      → single side (click directly toggles pinned ↔ unpinned)
   * - `['left', 'right']`       → explicit list form (multi-element → popup)
   * - `false` / `undefined`     → not user-pinnable
   */
  pinnable?: boolean | MlvPinSide | MlvPinSide[];
  pinned?: boolean; // sticky column (initial state)
  pinSide?: MlvPinSide; // sticky side
  hideable?: boolean; // user can hide/show via toolbar column popup
  align?: 'left' | 'center' | 'right';
  resizable?: boolean; // drag-resize via handle on header
  width?: string; // e.g. '120px'
  minWidth?: string; // minimum resize width
  maxWidth?: string; // maximum resize width
  responsive?: MlvColumnResponsive; // breakpoint visibility map
  filterConfig?: MlvColumnFilterConfig; // available filter options/operators
  valueLabels?: MlvColumnValueLabels; // raw value → label for the default cell
  tone?: MlvTone | MlvColumnToneFn<T>; // render the default cell as a muted badge
}
```

### Value labels & cell tones (default cell renderer)

Both fields affect only the **default** cell renderer — a `mlvDataTableCell` template for the same column always wins.

- **`valueLabels`** — `Record<rawValue, label>` or a `{ label, value }[]` list. When omitted, the column's `filterConfig.options` are used as the fallback source, so a column that already declares option filters renders its option labels for free. Lookup is by `String(rawValue)`; unmapped and nullish values pass through unchanged. Memoized into one `Map<columnKey, Map<string, string>>` computed off `visibleColumns()`.
- **`tone`** — a fixed `MlvTone` (`'info' | 'success' | 'warning' | 'danger'` from `@malva-ui/cdk/utils`) or a `(row) => MlvTone | null | undefined` resolver. When it resolves to a tone, the cell renders `<mlv-badge [tone] muted>` around the display value; `null`/`undefined` falls back to plain text for that row. `MlvColumnToneFn` uses the method-syntax bivariance form so `MlvDataTableColumn<Row>[]` stays assignable to the component's `MlvDataTableColumn[]` input.

```ts
readonly columns: MlvDataTableColumn<Deployment>[] = [
  {
    key: 'environment',
    filterable: true,
    filterConfig: { options: [{ label: 'Production', value: 'prod' }] }, // labels reused by the cell
  },
  {
    key: 'status',
    valueLabels: { succeeded: 'Succeeded', failed: 'Failed' },
    tone: (row) => (row.status === 'failed' ? 'danger' : 'success'),
  },
];
```

Template helpers: `getCellDisplayValue(row, col)` and `getCellTone(row, col)`.

### Responsive columns

`responsive` maps minimum **table** widths (not viewport widths) to `'hidden' | 'visible'`:

```ts
{ key: 'description', responsive: { 0: 'hidden', 769: 'visible' } }
```

Uses an internal `MlvResizeObserverService` to track container width.

Row flattening, responsive visibility, width parsing, and sticky-cell style
calculation live in the pure internal `data-table-layout.ts` module. The
component owns state and orchestration; the extracted functions are covered by
focused unit tests.

### Column resizing

Set `resizable: true` on a column to render a visible, focusable separator on its right edge. `minWidth` and `maxWidth` constrain every interaction; complete pixel values are direct, while percentages resolve against the rendered header-table width. Declared CSS lengths such as `rem` remain valid for layout; a resize starts from the rendered header measurement instead of misreading the numeric prefix as pixels.

- **Pointer:** mouse, touch, and pen share Pointer Events. Document-level tracking keeps the gesture intact if pointer capture is unavailable, while capture improves targeting when supported. The table ignores additional contacts, clamps live movement, cancels without committing on `pointercancel` or unexpected capture loss, and cleans up every listener if it is destroyed. The four drag listeners are `fromEvent` streams on the **injected `DOCUMENT`** (`pointermove`, `pointerup`, `pointercancel`) and on the handle (`lostpointercapture`), converted in #76. Each is piped through `takeUntil(pointerUp$)` **and** `takeUntilDestroyed(ref)`, where the terminator is filtered on the captured `pointerId` so a secondary contact lifting cannot end the gesture. They land in one `Subscription` that `_cleanupResize()` unsubscribes, keeping it the single idempotent teardown shared by pointer up, cancel, lost capture, width reset and `DestroyRef.onDestroy` — `unsubscribe()` on a closed `Subscription` is the no-op the stable bound handler references used to provide. `pointercancel` and `lostpointercapture` are the paths the gesture terminator cannot see, so that `unsubscribe()` is load-bearing there; both are asserted in `data-table.spec.ts`.
- **Horizontal scroll sync:** the wrapper/viewport `scroll` listeners are `fromEvent(el, 'scroll', { passive: true })` streams released from their owning `effect`'s `onCleanup` — not `takeUntilDestroyed`, because both elements are re-resolved whenever the effect re-runs and a destroy-scoped release would keep every earlier generation subscribed.
- **Keyboard:** `ArrowLeft`/`ArrowRight` resize by 8px, Shift uses a 32px step, Home/End move to the minimum/maximum, and Enter restores the declared width. The separator exposes localized `role="separator"` value metadata including an explicit pixel `aria-valuetext`.
- **Layout:** before resizing, the table measures every visible data, selection, and action column. Once an override exists, it freezes those measurements and applies the same summed pixel width to the standard table or all virtual header/body/footer tables. The virtual viewport remains wrapper-width and synchronizes horizontal movement with the outer wrapper in both directions outside Angular, including focus-driven viewport scrolling. Measured native scrollbar gutters correct end-pinned offsets (`--mlv-dt-pinned-end-correction`, the viewport's scrollbar sitting at its inline end) and extend the wrapper's scroll range through the final body pixel. This prevents browser table-layout redistribution, keeps both pin sides aligned, and leaves the outer wrapper as the sole user-facing horizontal scroll owner.
- **Performance:** live width uses the lightweight `_liveResize` signal and is rAF-throttled to one update per frame. Release commits one `_columnWidths` map clone inside Angular.
- **Persistence:** `(columnResize)` emits `{ key, width, source }` after pointer/keyboard commits. A reset emits `width: null`; double-clicking a separator or calling `resetColumnWidth(key?)` removes one or all overrides.
- **Styling:** the contrast-safe divider remains visually quiet at one pixel, grows on hover/focus/active, and sits inside a larger invisible hit target that expands further on coarse pointers.

### Pinned columns

Multiple columns can be pinned on both sides simultaneously. Offsets are computed cumulatively. Pinned cells now include a `transition` on `background` matching the static row transition timing (`--mlv-duration-normal`).

**Direction (#341).** `pinSide` is a logical alias: `'left'` pins to the inline-start edge, `'right'` to the inline-end edge, so under a `[dir="rtl"]` ancestor a `'left'` column renders first — on the right — and sticks to the scroller's right edge.

- The offset is a running sum of logical widths, so `getCellStyle()` / `columnCellStyles()` emit it as `--mlv-dt-pinned-inset: calc(<offset> + var(--mlv-dt-pinned-{start|end}-correction, 0px))` plus `position: sticky` and `z-index: 2` — **no `left` / `right` key** (before #341 they wrote a physical `left` / `right`, so in RTL a start column scrolled out of view at the scroll end and an end column sat 600px off its edge at the start).
- `data-table.scss` writes the property to a physical side: `.mlv-data-table__cell--pinned-left` → `left`, `--pinned-left:dir(rtl)` → `right` (mirror for `--pinned-right`). Physical because `.claude/rules/rtl.md`'s sticky row forbids a logical inline inset on a sticky element (it cites a Safari 26 RTL bug, which WebKit 26.6 did not reproduce for these cells — a logical inset measured correct there too); `:dir()` rather than `[dir='rtl'] &` because `MlvRtlService` always writes `<html dir>`, so the attribute form would also match an LTR island inside an RTL document.
- **No `:dir()`** (Chromium / Edge 119 — still in Angular 22.1's default browserslist, `baseline widely available on 2026-05-07`): an `@supports not selector(:dir(rtl))` block resets the physical side and sets `inset-inline-start` / `inset-inline-end` instead, for the pinned cells and the virtual viewport. It declares no `position`, so no rule pairs `position: sticky` with a logical inset. No Safari in range lacks `:dir()`. Simulated in Chromium 153 with the `:dir()` rules removed: RTL pinned cells `0·80·−600` → `0·80·0`, viewport `0·−300·−600` → `0·0·0`; not measured in a real Chrome 119.
- `dir="auto"`: `:dir()` resolves it from content, so the offset follows it (measured). The edge scrim reads `--mlv-inline-direction`, which treats `auto` as transparent, so under a `dir="auto"` that resolves to RTL the scrim still points LTR and darkens the column's own side.
- The edge scrim (`::after`) stays at the column's inline-end (start-pinned) / inline-start (end-pinned) edge, and its gradient uses `mixins.inline-distance(±90deg)` so it darkens next to the column in both directions.
- The virtual viewport (`__virtual-viewport`, sticky at the scroller's inline start) takes the same `left` / `:dir(rtl) right` form plus the fallback. **Known defect, pre-existing:** WebKit 26.6 lets it scroll away in RTL in every spelling — physical or logical, before and after #341 (`0·−300·−600` from the start edge at scroll start / middle / end) — so the body rows slide out from under the header in an RTL virtual-scroll table on WebKit. Chromium 153 keeps it at `0·0·0` in either spelling.
- A consumer spreading `getCellStyle()` onto its own element must also apply the side rule (or read `--mlv-dt-pinned-inset` itself) — see `docs/migrations/2026-09-data-table-pinned-inset.md`.
- Measured (Playwright, Chromium 153 and WebKit 26.6, identical results; scoped RTL, document RTL, `dir="auto"` resolving to RTL, LTR island, LTR): start cells 0 / 80px and the end cell 0px from their edges at scroll start, middle and end (before: `0·80·−600` / `−300·−220·−300` / `−600·−520·0` in RTL). Specs: `data-table-pinned-rtl.spec.ts` (compiled CSS incl. the fallback and a local sticky-inset guard, rendered with scoped `[dir]`), `data-table-layout.spec.ts`.

```ts
{ key: 'id',     pinned: true, pinSide: 'left',  width: '80px' },
{ key: 'amount', pinned: true, pinSide: 'right', width: '110px' },
```

### Pinnable columns (UI toggle)

Set `pinnable` on a column to show a pin/unpin button in the header cell. The pin icon appears on header hover and stays visible when the column is pinned. `pinnable` controls **which sides the user may pin the column to** and how the click behaves:

| Value                    | Allowed sides | Click behavior                                                                                         |
| ------------------------ | ------------- | ------------------------------------------------------------------------------------------------------ |
| `true`                   | both          | Opens a popup with **Pin left** / **Pin right** / **Unpin** options (the current side is highlighted). |
| `'left'` or `'right'`    | single        | Directly toggles between pinned on that side and unpinned.                                             |
| `['left', 'right']`      | both          | Same as `true` — explicit list form.                                                                   |
| `['left']` / `['right']` | single        | Same as the string form — direct toggle.                                                               |
| `false` / `undefined`    | —             | Column is not user-pinnable (it may still be pinned at load via `pinned`/`pinSide`).                   |

```ts
// Both sides allowed — clicking the header pin icon opens the side-chooser popup.
{ key: 'merchant', title: 'Merchant', width: '180px', pinnable: true },

// Starts pinned left; both sides allowed — user can switch to right or unpin via the popup.
{ key: 'id', title: 'ID', pinned: true, pinSide: 'left', pinnable: true },

// Only left pinning allowed — clicking the pin icon directly toggles pinned/unpinned.
{ key: 'status', title: 'Status', pinnable: 'left' },

// Only right pinning allowed.
{ key: 'amount', title: 'Amount', align: 'right', pinnable: 'right' },
```

The component tracks pin overrides internally via `_pinnedOverrides` signal. Public methods: `togglePin(col, side?)` (direct toggle, used by single-side pinnable columns), `pinTo(col, side)` (pin to a specific side, used by the popup), `unpin(col)` (explicit unpin, used by the popup), `isColumnPinned(col)`, `getColumnPinSide(col)`, `getPinnableSides(col)`.

---

## Sticky Header

Enabled by default (`[stickyHeader]="true"`). The `<thead>` uses `position: sticky; top: 0; z-index: 3`.

CSS variable `--mlv-dt-sticky-top` allows overriding the `top` offset (e.g., when the table is inside a page with a fixed app bar).

Pinned cells inside the sticky header get `z-index: 4` to ensure they stay above both the sticky header plane and other pinned body cells.

---

## Tree View

Add `_mlvChildren: T[]` to any row to make it expandable. Children can be nested arbitrarily deep. Each child row is indented proportionally to its depth.

```ts
type MyRow = {
  name: string;
  _mlvChildren?: MyRow[];
};
```

Flattening (`flattenRows` in `data-table-layout.ts`) never copies a row (#297). With nothing expanded it returns the `displayRows()` array itself (`depths: null`), so a sort / filter / search keystroke / page change allocates nothing; with nodes expanded it builds one array of the same references plus a **parallel depth array**, which the template reads by position through `_depthAt(i)` (`aria-level`, indent). The public `getDepth(row)` resolves a row (or its edit draft) through a row→depth `Map` built lazily from those two arrays, only when something calls it; a row object listed at two tree positions reports the depth of its last nested position there, while the rendered rows each show their own. The previous `{ ...row, _mlvDepth, _mlvRef }` copied every row on every recompute and handed those copies to every event and template. Measured at 100k rows (`node` 24, median): nothing expanded 13.4–14.4 ms / 16.9 MB retained → ~0 ms / 40 B once the spread call site is megamorphic (any app with several row types), 2.5–4.6 ms → ~0 ms monomorphic; every node expanded 15.4–16.0 ms → 3.0 ms and 17.0 MB → 1.75 MB megamorphic, 3.8–4.0 ms → 2.3 ms monomorphic. Positional depth rather than a row-keyed `Map`: the `Map` alone added ~4–5 ms to a fully expanded 100k walk, the array ~0.5 ms. Selection, expansion and edits are keyed by row identity. A node's children are pushed one by one, so a node with more children than the engine's argument limit (stack-dependent: ~120k in plain `node`, more in a vitest worker; the spec uses 1M) no longer throws `RangeError`.

---

## Filter Dropdown (`MlvFilterDropdown`)

**File:** `libs/core/data-table/src/lib/filter-dropdown/filter-dropdown.ts`
**Selector:** `mlv-dt-filter-dropdown` (internal — rendered automatically by `MlvDataTable`)

With `filterDisplay="toolbar"`, the shared editor opens from the toolbar Filters button. With `filterDisplay="column"`, a scoped instance opens from a sibling icon button beside each filterable header; it never nests inside the sort control and preserves conditions from other columns. Option filters use `in`/`not-in`; free-text filters expose the configured operators. Apply merges the owned draft into `activeFilters`, while Clear removes only keys owned by that editor and Cancel restores the committed snapshot. The Data Table performs the final merge against its current committed state at the column-editor boundary, so a stale overlay snapshot cannot replace filters owned by other columns.

The hosting `mlv-popup` is wired as a **non-modal dialog**: `panelRole="dialog"` with `[ariaLabel]="_i18n().filters"` (the trigger button keeps `aria-haspopup="dialog"`). It is intentionally non-modal so the page stays interactive; `Escape`/backdrop close is handled by the popup overlay, and `(afterClosed)="_onFiltersClosed()"` returns focus to the `#filterBtn` toolbar trigger so keyboard focus is never stranded on the destroyed overlay.

Column filter triggers restore focus to the matching header button after their editor closes. An applied filter is exposed through the localized accessible label (for example, “Filter Status, active”) rather than `aria-pressed`, because activating the button opens an editor instead of toggling the filter directly.

---

## Accessibility

- **Direction (RTL): scoped, not per-document.** The column-resize handler passes a cached `elementDirection(host)` signal to `MlvRtlService.normalizeArrowKey(event, direction)`, so a table inside a `[dir="rtl"]` subtree mirrors while the document stays LTR. `_onRowKeydown` deliberately omits the direction: its switch matches only the vertical pair, `Home` / `End` and `Space` / `Enter`, where mirroring is a no-op either way — the call site says so in a comment. Regressions in `data-table.spec.ts`.
- **Pointer column resize follows the same direction (#308).** The separator rides the column's inline-end edge — its left edge in RTL — so outward is toward smaller `clientX` there. `onResizeStart` records `inlineSign` (`1` LTR, `-1` RTL) on the resize state from the same cached `_direction()` signal, and `_onResizeMove` multiplies the physical `clientX` delta by it once. Before #308 an RTL outward drag shrank the column. Pinned in `data-table.spec.ts` for LTR, a global `setDirection('rtl')` and a scoped `[dir="rtl"]` ancestor.
- **Pinned columns stick to their logical edge (#341)** — sticky offset through `--mlv-dt-pinned-inset`, side chosen by the cell's `:dir()`; see _Pinned columns_ above.

### Row-level grid keyboard navigation

The table is a `role="grid"`. Data rows implement the **row-focus grid** pattern:

- Each data `<tr>` carries a roving `[attr.tabindex]` (`_rowTabIndex(i)` → `0` for the focused row, `-1` for the rest), plus `[attr.data-row-index]="i"`, so the row grid has a **single tab stop**.
- `_focusedRowIndex` (signal) tracks the focused flat-rows index; it is re-clamped in a constructor `effect` whenever `flatRows()` changes size (filter / sort / page / tree expand / data replacement) so it can never point out of range.
- `_onRowKeydown(i, row, event)` on each `<tr>` handles navigation **only when the row itself holds focus** (`event.target === event.currentTarget`) so keys typed into a cell widget (checkbox, button, edit input) are left alone:
  - `ArrowUp` / `ArrowDown` — move row focus by one (clamped)
  - `Home` / `End` — first / last row
  - `Space` / `Enter` — toggle selection of the focused row when `selectable()` is set
- `_moveRowFocus(target)` sets the roving index and focuses the row after the next render (`afterNextRender`). In **virtual-scroll mode** it first calls `viewport.scrollToIndex(target, 'smooth')` so an off-screen target row is materialised before it is focused (arrow steps hit already-rendered adjacent rows directly).
- `(focus)="_onRowFocus(i)"` and `onRowClick` keep `_focusedRowIndex` in sync when a row is reached by Tab or mouse.

### Row selection

- The per-row selection `mlv-checkbox` is rendered with `[tabbable]="false"` so it does **not** add a second tab stop per row — the row is the single tab stop, its `Space`/`Enter` toggles selection, and the checkbox stays mouse-operable. The header select-all checkbox remains tabbable.
- Selected rows expose `aria-selected` on the `<tr>`.

### Sortable headers

- Follows the WAI-ARIA grid **sort** pattern. The header `<th>` stays a plain, non-interactive cell — it carries `scope="col"` and `[attr.aria-sort]` (`'ascending' | 'descending' | 'none'`), but **no** widget `role` and **no** `tabindex`.
- The sort control is **one native `<button class="mlv-data-table__sort-button">`** rendered _inside_ the `<th>`, wrapping the header label (`__header-title`) and the sort-direction icon (`__sort-icon`, `aria-hidden`). The button carries the `aria-label` resolved from the `sortByColumn` ICU string ("Sort by {column}") via `getSortLabel(col)`.
- Keyboard activation (Enter / Space → sort) is handled natively by the `<button>` — there is no custom keydown handler. `(click)="onSortClick(col)"` cycles asc → desc → unsorted.
- The pin button (`pinButtonTpl`) and focusable resize separator are **siblings** of the sort button inside the `<th>`, never nested inside it — so no interactive control is nested within another (fixes the former axe `nested-interactive` violation).
- Resizable headers expose a named `role="separator"` with `aria-orientation="vertical"`, current/min/max pixel values, localized `aria-valuetext`, Pointer Events, Arrow/Home/End keyboard control, and Enter-to-reset.
- The shared `#headerCellInnerTpl` template (context `{ $implicit: col }`) renders this inner content once and is reused by all three header branches (standalone column in a group-header row, grouped sub-header row, and the standard single-row header), keeping the markup DRY.
- The button is chromeless (`font: inherit; color: inherit; background/border: none`) so it is visually identical to the previous plain-text header; the `--sortable:hover` color shift on `__cell-inner` still cascades into it, and `:focus-visible` shows the `--mlv-border-focus` ring.

### Actions column header

- The trailing actions column (rendered when `editable` is on) has no visible label. Its `<th>` is given an accessible name via visually-hidden text (`<span class="mlv-data-table__visually-hidden">`) driven by the `actionsHeaderLabel` input (default `'Actions'`) — this fixes the former axe `empty-table-header` violation.
- Row expansion/collapse and column pin controls resolve their accessible names
  through `MLV_DATA_TABLE_I18N`. `actionsHeaderLabel` remains a consumer-owned
  input so applications can provide their preferred localized heading.

### Tree rows

- Tree-view rows keep `aria-level` (depth + 1) and the expand/collapse button keeps `aria-expanded`.

### Error state

- The error block is wrapped in `.mlv-data-table__error` with `role="alert"` + `aria-live="assertive"`, so a failure that appears after the table has rendered is announced. The wrapper is kept around projected `mlvDataTableError` content too.
- The default Retry control is a real `button[mlvButton]` with visible text, so it is keyboard-operable and named without extra ARIA.
- The icon is `aria-hidden` — the title/description carry the message.

### Experimental cell navigation (`@angular/aria` grid)

Set `[cellNavigation]="true"` to swap the default **row-level** roving navigation for full **cell-level** navigation backed by the `@angular/aria` grid pattern. This is an **experimental, opt-in prototype** (default off). Off by default, the table is byte-for-byte the stable row-roving implementation described above — every existing spec passes unchanged.

**How it is wired**

- `ngGrid` is applied to the **non-virtual** `<table>` (config pinned in the template: `rowWrap="nowrap"`, `colWrap="nowrap"`; aria defaults kept for `focusMode="roving"` and `enableSelection=false`). aria owns `role="grid"`, roving `tabindex`, `aria-activedescendant`, and Arrow/Home/End keyboard navigation across cells.
- Each data `<tr>` carries `ngGridRow` (`role="row"`); each `<td>` carries `ngGridCell` (`role="gridcell"`). Only **body** cells are registered — header cells stay outside grid navigation.
- Interactive cells expose an `ngGridCellWidget`: edit-mode cells wrap their edit template in `widgetType="editable"` and the actions column wraps its buttons in `widgetType="complex"`, so Enter pauses grid navigation to interact and Escape resumes.
- The grid `<tr>`/`<td>` markup is a parallel template branch (aria directives can't be toggled on an element at runtime); the presentational cell body is shared via the internal `#cellContentTpl` / `#actionsButtonsTpl` templates, so display logic is not duplicated.
- **Direction (#339).** aria's `Grid` and `GridCell` inject the CDK `Directionality` to swap `ArrowLeft` / `ArrowRight` in RTL. The root instance follows only the document, so a table inside a `dir="rtl"` subtree mirrored its columns while `ArrowLeft` still moved to the previous column. `MlvDataTable` now has `viewProviders: [provideMlvScopedDirectionality()]` (`@malva-ui/cdk/utils`, `@internal`), so the grid follows the table's nearest `[dir]`, as the column-resize keys already did; `viewProviders` because the grid is in the view, so consumer cell templates keep their own. Pinned by `data-table-scoped-direction.spec.ts` (scoped RTL, LTR island). List of record: `.claude/rules/rtl.md` § _Sanctioned `Directionality` providers_.

**Prototype limitations (honest, documented)**

- **Requires non-virtual mode.** `_cellNav()` is `cellNavigation() && !virtualScroll()`. When `virtualScroll` is on, cell navigation is inert and the table falls back to row-level roving. `virtualScroll` splits the table into separate header/body/footer `<table>`s (a grid can't span them) and recycles rows out of the DOM (the aria grid's DOM-registered row/cell `SortedCollection` can't track recycled rows). The virtual + cell-nav combination was assessed and deliberately not supported in this prototype.
- **Row selection stays row-level.** aria's own cell-selection model (`enableSelection`) is intentionally left off; selection continues via the checkbox + `selectedRows`/`toggleRowSelection`. The per-row checkbox stays `[tabbable]="false"`, so keyboard row selection from within a cell is out of prototype scope.
- Pinned columns, tree rows, editing, and column groups all render unchanged under cell nav (the header/colgroup/footer are shared, cell styles/pins are reused); only the navigation model changes.

Covered by the `experimental cell navigation (aria ngGrid)` spec block (grid roles, single roving tab stop, no row-level tabindex, ArrowRight/ArrowDown cell movement, `ngGridCellWidget` presence, and the virtual-scroll fallback).

### Column pin popup — `@angular/aria` `ngMenu` evaluation (kept manual)

The header pin-side chooser (`.mlv-data-table__pin-popup`, `role="menu"` with `menuitemradio` Pin-left/Pin-right + `menuitem` Unpin) was evaluated against `@angular/aria`'s `ngMenu`/`ngMenuItem` and **kept as manual markup** — the plan's sanctioned fallback. Note the reasoning differs from the `mlv-menu` (Task 2.6) rejection:

- The menu 2.6 blocker (DI parent ≠ DOM location due to content projection) **does not apply here** — the `role="menu"` container and its items live in the **same** `*mlvPopupContent` template, so DI parent and DOM coincide and `ngMenu`/`ngMenuItem` _could_ attach.
- It is kept manual anyway because: (1) aria `Menu` has **no selection/value model** (`MenuInputs` omits `value`; `MenuItem` renders no `aria-checked`) — the popup's core state (which side is pinned) would stay hand-managed regardless, so aria replaces none of the selection plumbing; (2) aria `Menu`'s keyboard/focus/visibility model is coupled to `ngMenuTrigger`, but the popup opens via `mlvPopupTrigger`/CDK overlay (the plan's mandated positioning), and `mlv-popup` here is non-modal with no focus-trap and does not move focus into the panel on open, so aria's roving/typeahead never engages; (3) adopting aria roving would collapse the 2–3 native-button tab stops to one for marginal arrow-nav gain. The manual markup already emits correct `role="menu"`/`menuitemradio`/`menuitem`/`aria-checked`.

---

## Rendering internals (performance)

Per-cell template helpers are memoized so they no longer allocate a fresh object (or scan a list) on every change-detection cycle:

- **Cell styles** — `getCellStyle(col)` reads a memoized `_columnStyles` computed (`Map<columnKey, styleObject>`) built from `_columnStates()` + `columnOffsets()`. `_columnStates()` is **every declared column** enriched with the table's own state (pin overrides, committed or in-flight resize width, responsive visibility); `visibleColumns()` is that list with hidden columns dropped and the rest ordered by pin side. Header and body cells of a column share one **stable** style-object reference across CD cycles, so the `[style]` binding skips re-diffing until widths / pins / visibility / live-resize actually change. The memo is keyed on the declared set rather than the visible one so a hidden column is memoized too: `getCellStyle` is public, and off `visibleColumns()` its answer depended on whether the column happened to be rendered — a stable, state-derived object while visible and a freshly built, raw-input-derived one while hidden. The on-the-fly fallback is now reachable only for a column absent from `columns()`, which has no memoized state to return — deliberately without a dev warning, since that is legal input the fallback serves correctly (unlike the skipped-input cases the repo does warn on). **Scope:** this makes a hidden column's _width_ and _pin state_ state-derived; its _sticky offset stays `0px`_, because `columnOffsets()` sums over the **visible** pinned run and an unrendered column occupies no space in it. That is right for rendering, so the caveat is documented on `getCellStyle` instead of being papered over by offsetting columns that are not laid out. `columnCellStyles(col, offsets)` in `data-table-layout.ts` is the shared builder; for a pinned column it writes `position`, `z-index` and `--mlv-dt-pinned-inset`, never `left` / `right` (#341 — the stylesheet picks the side). `getColStyle`/`getColWidth` are unchanged.
- **Cell contexts** — `getCellContext(row, index)` returns a **stable** per-position `ngTemplateOutletContext`, cached in `_cellContexts` (`Map<viewIndex, MlvDataTableCellContext>`), instead of a new `{ $implicit, row, index }` per cell per CD. Keyed by **position**, not row (#297): rows are now the consumer's own objects and keep their identity across a sort, so a row-keyed entry would keep its stale `index`, and a row listed twice would thrash one entry between positions (an NG0100 in dev). An entry is replaced when the row at its index changes or enters/leaves edit mode (its `row` is then the edit draft), and the whole cache is dropped whenever `flatRows()` returns a new array. The row-level `rowCellsTpl` outlets in both the standard and virtual `<tr>` branches pass `getCellContext(row, i)` too, which is how an edited row's whole cell set sees the draft; the cell-navigation branch passes `getCellContext(row, i).row` into `cellContentTpl` for the same reason. NB: in Angular 22 `NgTemplateOutlet` forwards context reads through a Proxy to the latest `ngTemplateOutletContext` (no view teardown on context change) — stabilizing the reference removes the per-CD allocation and `NgTemplateOutlet.ngOnChanges` churn rather than a teardown.
- **Cell templates** — `getTemplate(key)` / `getEditTemplate(key)` read `_cellTemplateMap` / `_editCellTemplateMap` computeds (`Map<columnKey, TemplateRef>`, rebuilt only when the projected `cellTemplates()` / `editCellTemplates()` sets change), replacing an `Array.find()` per cell per CD. First registration wins for duplicate keys (preserves the old first-match `find()` semantics).
- `getCellValue(row, key)` is left as-is — it is plain property access with nothing to memoize.

`src/lib/data-source-sort-locale.spec.ts` is a guard that belongs to
`@malva-ui/cdk/data-source` but has to live here: it asserts that
`MlvI18nService.switchLanguage()` does not change `MlvArrayDataSource`'s sort
order (the comparator's collator is bound to the **host** locale, not the app
language), and `@nx/enforce-module-boundaries` forbids `family:cdk` from
importing `@malva-ui/i18n` even in a spec. See
[libs-cdk-data-source.md](libs-cdk-data-source.md).

## Styling

**Design philosophy:** Completely flat and borderless — no wrapper chrome, no shadow, no radius on the container. The table sits directly on the page. Visual hierarchy comes from typography and spacing alone. Headers use normal-case text in a muted accent color (`color-mix` of `--mlv-text-action` and `--mlv-text-secondary`), `font-weight-medium`. Row separators are barely visible (`--mlv-border-subtle`), with a slightly heavier `--mlv-border-normal` line between header and body. Summary footers reuse density geometry with a strong top divider and opaque sticky surface. Resize separators remain subtly visible at rest and become explicit on hover, press, or keyboard focus. Sort icons on unsorted columns are completely hidden until hover. Row hover uses `--mlv-background-neutral-1-hover` — the gentle neutral interactive hover step, not `--mlv-background-sunken` (a static recessed-tray surface token; using it for hover made the row read as pressed rather than hovered). A selected row (`__row--selected`) and its pinned cells read the selected-state fill — `--mlv-background-selected` at rest, `--mlv-background-selected-hover` under the pointer (SF-R1) — and **keep the table's own ink**: `--mlv-text-on-selected` is `mlv-link`'s resting colour, and rows host links, so recolouring the row's text would give a link in a selected row the same colour as the text around it, leaving nothing to tell the two apart (WCAG 1.4.1). `mlv-tree`'s default row renders no link, so it does take the ink. Before #304 the selected row was a `color-mix` of `--mlv-background-accent-1` that the `striped` fill and the neutral row hover both outranked, so an even striped row showed no selection and a hovered one lost it. The stripe and the neutral hover exclude `--selected` rather than rely on specificity; `__row--editing` and `__row--expanded` (both `--mlv-background-sunken`) still yield to selected by source order, as before. Pinned by `data-table-selection-style.spec.ts` (render) and `libs/styles` `tone-contrast.spec.mjs` (no `color` on the selected rule; the table ink and `--mlv-text-secondary` at 4.5:1 on the rest / hover fill in light, dark and high contrast). Row heights are generous (3.75rem comfortable, up to 4.75rem airy) to support rich multi-line cell content.

**BEM block:** `.mlv-data-table`

Key classes: `__wrapper`, `__wrapper--virtual`, `__table`, `__table--virtual`, `__virtual-viewport`, `__col--select`, `__col--actions`, `__head`, `__cell`, `__cell--header`, `__cell--data`, `__cell--pinned`, `__cell--group-header`, `__cell--standalone`, `__cell--actions`, `__cell--select`, `__cell-inner`, `__sort-button`, `__header-title`, `__sort-icon`, `__resize-handle`, `__visually-hidden`, `__pin-btn`, `__pin-btn--active`, `__pin-popup`, `__pin-popup-item`, `__pin-popup-item--active`, `__pin-popup-item--unpin`, `__row`, `__row--group-header`, `__row--editing`, `__row--selected`, `__row--footer`, `__row--error`, `__cell--error`, `__expand-btn`, `__expand-icon`, `__actions`, `__no-data-default`, `__error`, `__error-icon`, `__error-retry`, `__toolbar`, `__footer`, `__foot`, `__foot--sticky`, `__loading-overlay`, `__loading-bottom`, `__columns-dropdown`, `__columns-item`.

---

## Dependencies

| Package                         | Version       |
| ------------------------------- | ------------- |
| `@angular/core`                 | `^22.0.0`     |
| `@angular/common`               | `^22.0.0`     |
| `@angular/cdk`                  | `^22.0.0`     |
| `@malva-ui/core/pagination`     | `workspace:*` |
| `@malva-ui/core/button`         | `workspace:*` |
| `@malva-ui/core/badge`          | `workspace:*` |
| `@malva-ui/core/empty-state`    | `workspace:*` |
| `@malva-ui/core/checkbox`       | `workspace:*` |
| `@malva-ui/core/loader`         | `workspace:*` |
| `@malva-ui/core/popup`          | `workspace:*` |
| `@malva-ui/core/search-field`   | `workspace:*` |
| `@malva-ui/core/dropdown`       | `workspace:*` |
| `@malva-ui/i18n`                | `workspace:*` |
| `@malva-ui/cdk`                 | `workspace:*` |
| `@malva-ui/cdk/density`         | `workspace:*` |
| `@malva-ui/cdk/data-source`     | `workspace:*` |
| `@malva-ui/cdk/infinite-scroll` | `workspace:*` |
| `@lucide/angular`               | `*`           |

---

## Usage Examples

### Basic table

```ts
columns: MlvDataTableColumn[] = [
  { key: 'name',  title: 'Name',  sortable: true, filterable: true },
  { key: 'email', title: 'Email', width: '200px' },
];
```

```html
<mlv-data-table [data]="users" [columns]="columns" />
```

### Custom cell template

```html
<mlv-data-table [data]="rows" [columns]="columns">
  <ng-template mlvDataTableCell="status" let-row>
    <mlv-badge [color]="row['status'] === 'Active' ? 'success' : 'danger'" muted> {{ row['status'] }} </mlv-badge>
  </ng-template>
</mlv-data-table>
```

### Editable table

```html
<mlv-data-table [data]="employees" [columns]="columns" editable addRow (rowEditSave)="onSave($event)" (rowAdd)="onAddRow()">
  <mlv-input *mlvDataTableEditCell="'name'; let row from employees" [ngModel]="row.name" (ngModelChange)="row.name = $event" />
</mlv-data-table>
```

### Column groups

```html
<mlv-data-table
  [data]="employees"
  [columns]="columns"
  [columnGroups]="[
    { title: 'Personal', columns: ['name', 'email'] },
    { title: 'Work',     columns: ['department', 'role'] }
  ]"
/>
```

### Custom data source

```ts
class RemoteDS extends MlvDataSource<User> {
  readonly totalItems = signal(0);
  connect(): Signal<User[]> {
    return computed(() => {
      /* fetch from API using this._page(), this._perPage(), etc. */
    });
  }
}
```

```html
<mlv-data-table [data]="remoteSource" [columns]="columns" />
```

### Virtual scroll

```ts
readonly rows = signal<Transaction[]>(generateLargeDataset(10_000));
```

```html
<mlv-data-table [data]="rows()" [columns]="columns" [virtualScroll]="true" [rowHeight]="60" maxHeight="32rem" />
```
