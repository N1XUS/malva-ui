# @malva-ui/pagination

All page navigation controls explicitly use `type="button"` to remain
form-safe.

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

**Path:** `libs/core/pagination`
**Import path:** `@malva-ui/core/pagination`
**Selector:** `mlv-pagination`

Pagination control with an item-count line plus items-per-page selector on one side, and a page-navigation strip (prev/next arrows, numbered page buttons, ellipsis page-jump fields) on the other. It owns no data — only the position within it.

---

## Public API

| Export                     | Kind      | Description                                                                                          |
| -------------------------- | --------- | ---------------------------------------------------------------------------------------------------- |
| `MlvPagination`            | Component | The pagination component (`mlv-pagination`).                                                         |
| `MlvPaginationCount`       | Directive | `[mlvPaginationCount]` — replaces the item-count text with a projected template.                     |
| `MlvPaginationPerPageItem` | Directive | `[mlvPaginationPerPageItem]` — replaces the whole items-per-page selector.                           |
| `MlvPaginationService`     | Service   | Component-scoped page-range calculation. Provided by `MlvPagination`; not `providedIn: 'root'`.      |
| `MlvPaginationObject`      | Interface | Input shape the component pushes into the service (`totalItems`, `currentPage`, per-page + options). |

---

## Components

### `MlvPagination`

- **Selector:** `mlv-pagination`
- **Change Detection:** `OnPush`
- **Encapsulation:** `None`
- **Providers:** `MlvPaginationService`, `MlvSelectionService`

#### Inputs

| Name                | Type                      | Required | Default                        | Description                                                                                                                                                                                                                                                              |
| ------------------- | ------------------------- | -------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `totalItems`        | `number`                  | ✅       | —                              | Total items across all pages. Drives the page count, the "X–Y of Z" range text, and how far `perPageOptions` is trimmed.                                                                                                                                                 |
| `perPageOptions`    | `number[]`                |          | `[10, 30, 60, 100, Infinity]`  | Choices offered by the items-per-page selector. The list is cut after the first option that covers `totalItems`; include `Infinity` for "All (Z)".                                                                                                                       |
| `mlvDensity`        | `MlvDensity \| undefined` |          | `undefined`                    | Density for the items-per-page dropdown list. Forwarded to the `mlv-popup`, which stamps `mlv--{density}` on the detached overlay panel (outside the page's density cascade); rows respond via the `mlv-list-item` density ladder. Omitted → global `MlvDensityService`. |
| `mobile`            | `BooleanInput`            |          | `false`                        | Adds `mlv-pagination--mobile` to the host. **The library ships no rules for that class** — a styling hook for the consumer, not a built-in responsive mode.                                                                                                              |
| `id`                | `string`                  |          | generated (`mlv-pagination-N`) | **Currently inert** — nothing reads it. The per-page trigger and its listbox pair through their own generated id.                                                                                                                                                        |
| `displayTotalItems` | `BooleanInput`            |          | `true`                         | **Currently inert** — nothing reads it. The count is always rendered; project `[mlvPaginationCount]` to change or suppress the text.                                                                                                                                     |

#### Models (two-way bindable)

| Name           | Type     | Default | Description                                                                                      |
| -------------- | -------- | ------- | ------------------------------------------------------------------------------------------------ |
| `currentPage`  | `number` | `1`     | Currently active page, 1-based. Also set by the arrows, page buttons and page-jump fields.       |
| `itemsPerPage` | `number` | `10`    | Items shown per page; also set by the per-page selector. `Infinity` puts every item on one page. |

Their change outputs are `currentPageChange` and `itemsPerPageChange` (the `model()` outputs — there are no separate `output()` declarations).

#### Coercion

`mobile` and `displayTotalItems` use `coerceBooleanProperty`, so both accept attribute syntax (`<mlv-pagination mobile>`). **`totalItems` and `currentPage` are not coerced** — bind numbers, not route-param strings.

#### Public methods

| Method                           | Description                                                                                                                        |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `goToPage(page: number)`         | Sets `currentPage`. No clamping — internal callers only reach it from enabled controls.                                            |
| `setItemsPerPage(n: number)`     | Sets `itemsPerPage`. `Infinity` puts every item on one page.                                                                       |
| `setPageFromInput(event: Event)` | Jumps to the page typed into an ellipsis field (Enter keydown). Out-of-range values are ignored.                                   |
| `getCellContext()`               | Template context for the projected slots: `$implicit` (current page), `total`, `start`, `end` (1-based, `end` clamped), `options`. |

---

## Layout Structure

The host is a plain flex row of two wrappers, both sized by `flex-basis`:

```
┌──────────────────────────────────────────────────────────────────┐
│  50 items   [10 – 30 of 50 ▾]        [←] [1] [2] […] [50] [→]    │
│  .mlv-pagination__items-count-wrapper  .mlv-pagination__items-wrapper │
│  (flex-basis: 400%)                    (flex-basis: 60%, shrink 0)   │
└──────────────────────────────────────────────────────────────────┘
```

- `__items-count-wrapper` holds the count text and the per-page selector, `white-space: nowrap`.
- `__items-wrapper` is a `role="navigation"` landmark and is **not rendered at all while `totalPages() <= 1`**.
- The per-page selector is **not rendered** while `normalizedItemsPerPageOptions()` is empty — i.e. when `totalItems` is at or below the smallest `perPageOptions` entry.

There is no absolute positioning and no three-column grid.

---

## Page collapsing

Collapsing is driven by **page count**, not container width — the component
observes no resize. `MlvPaginationService.pages()` returns the page numbers to
render, inserting `moreElementValue` (`-1`) markers where a run is elided:

- Window size is fixed at `CORNER_DISPLAY_PAGES * 2 + SIDE_CURRENT_DISPLAY_PAGES * 2 + 1 + 2` = **9** entries (1 corner page each side, 2 pages either side of current, the current page, and 2 ellipsis slots).
- At or below 9 pages every page is rendered.
- Near the start or the end, a single ellipsis appears on the far side; in the middle, one on each side.

```
 9 pages,  page 1:  [<] [1] [2] [3] [4] [5] [6] [7] [8] [9] [>]
50 pages,  page 1:  [<] [1] [2] [3] [4] [5] [6] [7] […] [50] [>]
50 pages, page 25:  [<] [1] […] [23] [24] [25] [26] [27] […] [50] [>]
50 pages, page 50:  [<] [1] […] [44] [45] [46] [47] [48] [49] [50] [>]
```

Each `…` slot renders as an `mlv-input[type=number]` (`.mlv-pagination__item--input`,
sized to `--mlv-height-s`); pressing Enter calls `setPageFromInput()`, which
ignores values outside `1…totalPages`.

---

## Items-per-Page Selector

A transparent trigger button showing the current range (or the localized "All (Z)"
label when the active value is `Infinity`) opens an `mlv-popup` containing a
shared **`mlv-dropdown-panel`** — the same panel `mlv-select` and `mlv-combobox`
use, rather than a hand-rolled option list.

The panel owns the listbox pattern: it pins `listRole="listbox"`,
`itemRole="option"`, `selectionMode="explicit"` and `[softDisabled]="false"`,
renders the selected state, and supplies keyboard navigation and type-ahead.
Pagination supplies only data and receives the choice:

- `[options]` — `MlvSelectOption<number>[]` built from
  `normalizedItemsPerPageOptions()`, labelled through the same i18n resolver, so
  the `Infinity` entry reads "All (Z)" instead of a number.
- `[selectedValues]` — the active value as a single-element array; the panel's
  selection model is array-shaped even for single select.
- `(valueChange)` — unwrapped to one number, applied, and the popup closed.

`MlvSelectionService` must be provided by the component that hosts the panel —
it injects it non-optionally, as a focus-first channel only. `mlv-pagination`
provides it alongside `MlvPaginationService`; `selectedValues` remains the single
source of truth for selection.

---

## CSS Classes (BEM)

| Class                                          | Description                                                                      |
| ---------------------------------------------- | -------------------------------------------------------------------------------- |
| `.mlv-pagination`                              | Host element                                                                     |
| `.mlv-pagination--mobile`                      | Applied by the `mobile` input. **No rules ship for it** — consumer styling hook. |
| `.mlv-pagination__items-count-wrapper`         | Count text + per-page selector                                                   |
| `.mlv-pagination__items-count`                 | The count text itself                                                            |
| `.mlv-pagination__items-per-page`              | Items-per-page trigger + popup wrapper                                           |
| `.mlv-pagination__items-per-page__description` | Width/opacity-animated label revealed on the active option                       |
| `.mlv-pagination__items-per-page--active`      | Sets the two custom properties that reveal that label                            |
| `.mlv-pagination__items-wrapper`               | `role="navigation"` landmark around the page strip                               |
| `.mlv-pagination__items`                       | Arrow + page-button row                                                          |
| `.mlv-pagination__items__container`            | The page buttons and ellipsis fields                                             |
| `.mlv-pagination__item`                        | Any arrow button, page button, or ellipsis field                                 |
| `.mlv-pagination__item--input`                 | The ellipsis page-jump `mlv-input`                                               |

Active/disabled page-button appearance is **not** styled here — the buttons are
`mlvButton` with `[variant]` swapped between `primary` and `transparent` and
`shape="square"`, so `button.scss` owns their look.

Component-scoped custom properties: `--mlv-pagination-item-width` and
`--mlv-pagination-item-opacity` (both default to `0`, set by
`__items-per-page--active`).

---

## Design Tokens Used

| Token                  | Usage                                                 |
| ---------------------- | ----------------------------------------------------- |
| `--mlv-font-size-s`    | Count text and the ellipsis field's inner input       |
| `--mlv-text-secondary` | Count text colour                                     |
| `--mlv-height-s`       | Ellipsis page-jump field box (width = height)         |
| `--mlv-spacing-2`      | Gaps between count/selector and between page controls |

Everything else the component looks like comes from `mlv-button`, `mlv-input`,
`mlv-popup` and `mlv-dropdown-panel`.

---

## Usage Examples

```html
<!-- Basic -->
<mlv-pagination [totalItems]="500" [(currentPage)]="page" />

<!-- Custom per-page choices with an "all items" option -->
<mlv-pagination [totalItems]="total" [(currentPage)]="page" [(itemsPerPage)]="perPage" [perPageOptions]="[10, 25, 50, 100, Infinity]" />

<!-- Custom count text -->
<mlv-pagination [totalItems]="total" [(currentPage)]="page">
  <ng-template mlvPaginationCount let-page let-start="start" let-end="end"> Showing {{ start }}–{{ end }} on page {{ page }} </ng-template>
</mlv-pagination>
```

`totalItems` is not coerced — `totalItems="200"` binds the **string** `"200"`.
Convert route params before binding.

---

## Accessibility

- The page-navigation section (`.mlv-pagination__items-wrapper`) is a `role="navigation"` landmark, labelled via `[attr.aria-label]="_i18n().navigationLabel"` (English: "Pagination").
- Prev/next arrow buttons use `[attr.aria-label]` from `_i18n().previousPage` / `_i18n().nextPage`.
- Prev, next and page-number controls are native `<button mlvButton>` bound with `(click)`: Enter and Space activation is the browser's own click, so one key press moves exactly one page. They used to bind `(mlvClick)`, which also emitted for the keydown — Next skipped a page and could push `currentPage` to `totalPages + 1` (Prev to `0`) (#299). Pinned by `pagination.spec.ts` › _keyboard activation_.
- Page number buttons set `[attr.aria-current]="'page'"` on the current page and take their `aria-label` from the ICU `page` key (English: "Page {page}") via `_pageAriaLabel()`, not from a hardcoded string.
- The ellipsis "jump to page" field is a `mlv-input` (`type="number"`) with `[ariaLabel]="_i18n().goToPage"` (English: "Go to page") so it has an accessible name despite only showing a `...` placeholder.
- i18n keys consumed: `navigationLabel`, `previousPage`, `nextPage`, `page`, `goToPage`, plus the ICU display keys `itemRange`, `itemCount`, `itemsPerPage` and `allItems` — see `MLV_PAGINATION_I18N`. (`items` is declared on `MlvPaginationI18n` but this component does not read it.)
- Items-per-page selector: the trigger declares `aria-haspopup="listbox"` (via `MlvPopupTrigger`'s `ariaHasPopup` input) plus `aria-controls` pointing at the panel's `listboxId`, and `MlvPopupTrigger` reflects `aria-expanded`. The listbox semantics — roles, `aria-selected`, roving focus and type-ahead — come from `mlv-dropdown-panel` rather than being wired here, which also closes the roving-tabindex gap the hand-rolled list had.
- The popup's listbox is **named**: `mlv-dropdown-panel` takes `[ariaLabel]="_perPageListboxLabel()"`. The panel renders an `mlv-list[selectable]` whose host claims `role="listbox"`, a listbox owes an accessible name (axe `aria-input-field-name`, WCAG 4.1.2), and the panel invents none of its own — without this the popup opened an unnamed listbox. The wording reuses the current selection's own label (`_resolvedPerPageLabel`) — "10 items per page", or "All (Z)" for `Infinity` — so it needs no new i18n key and stays translated in every pack.

---

## Services

### `MlvPaginationService`

Component-scoped (provided by `MlvPagination`, **not** `providedIn: 'root'`). Derives the page model from one `MlvPaginationObject` signal that the component keeps in sync via an `effect`.

| Member                          | Kind                 | Description                                                                                                                                       |
| ------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pagination`                    | `signal`             | The `MlvPaginationObject` input state.                                                                                                            |
| `totalPages`                    | `computed<number>`   | `ceil(totalItems / itemsPerPage)`; `0` when `itemsPerPage` is falsy.                                                                              |
| `pages`                         | `computed<number[]>` | Page numbers to render, with `moreElementValue` markers where a run is elided.                                                                    |
| `normalizedItemsPerPageOptions` | `computed<number[]>` | `perPageOptions` trimmed against `totalItems` — **empty** when `totalItems` is at or below the smallest option, which is what hides the selector. |
| `moreElementValue`              | `-1`                 | The ellipsis marker inside `pages()`.                                                                                                             |
| `validate()`                    | method               | Dev-mode-only `console.warn` when `totalItems` or `itemsPerPage` is not a positive number. Called from `pages()`.                                 |

---

## Dependencies

- `@angular/core` ^22.0.0
- `@angular/cdk/coercion` — `BooleanInput`, `coerceBooleanProperty`
- `@malva-ui/cdk/density` — `MlvDensity` type
- `@malva-ui/cdk/utils` — `mlvNextId`, `range`, `MlvStructural`
- `@malva-ui/core/button`, `/input`, `/popup`, `/dropdown`, `/form-utils` (`MlvSelectionService`)
- `@lucide/angular` — `LucideChevronLeft`, `LucideChevronRight`
- `@malva-ui/i18n` — `MLV_PAGINATION_I18N`, `MlvI18nResolverService`
- Malva UI CSS design tokens (`--mlv-*`)
