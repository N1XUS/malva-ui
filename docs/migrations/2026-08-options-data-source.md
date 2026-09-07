# 2026-08 — Option sources, `MlvDataSource` move, searchable select

Additive unless noted. `@malva-ui/core/data-table` keeps exporting every moved
symbol, so existing imports compile.

## 1. `MlvDataSource` primitives moved to `@malva-ui/cdk/data-source`

`MlvDataSource<T>`, `MlvArrayDataSource<T>`, `MlvSortDirection`, `MlvSortState`,
`MlvFilterState`, `MlvSearchState`, `MlvDataSourceState` now live in
`@malva-ui/cdk/data-source` (re-exported by `@malva-ui/core/data-table`).
The filter-operator union moved with them and is called
**`MlvDataSourceFilterOperator`** — not `MlvFilterOperator`, which
`@malva-ui/core/filter` already owns for its own, wider condition model (two
same-named public types would also make the `@malva-ui/core` root barrel an
ambiguous star-export, TS2308). `MlvDataTableFilterOperator` remains as a
deprecated alias. `normalizeForMatch` moved to `@malva-ui/cdk/utils` (still
exported by `@malva-ui/core/dropdown`).

- New: `MlvDataSource.loading` (readonly signal) / protected `_loading` — set it
  synchronously around async work.
- `MlvArrayDataSource<T>` no longer requires `T extends object`; `setSearch`
  with **empty `keys`** matches primitives on `String(row)` and objects on
  every own primitive value ("natural fields"). Data table never sends empty
  keys, so table behaviour is unchanged. `perPage` default stays `10`.
- New `MlvSelectDataSource<T>` (`@malva-ui/core/dropdown`, re-exported by
  `@malva-ui/core/select`): `MlvArrayDataSource` with `perPage = Infinity`.

## 2. Option controls accept `T[] | Observable<T[]> | MlvDataSource<T>`

`mlv-select`, `mlv-combobox`, `[mlvAutocomplete]` `options` inputs widen.
Data sources are searched with `setSearch({ query, keys: [] })` and paged
lazily (`setPage(page + 1)` when the user scrolls near the end; `hasMore`
derives from `totalItems`). `connect()` must emit the current page slice.

New: `searchFn` + `searchDebounce` on select and combobox (`searchFn`
supersedes `options`; paging is not available with `searchFn`);
`MlvAutocompleteSearchFn` is now an alias of `MlvOptionsSearchFn`.

Every shape is normalised by the shared `MlvOptionsAdapter` from
`@malva-ui/core/dropdown`. Re-binding `searchFn` only re-arms its lazy gate —
the in-flight call keeps running and the rendered items are untouched — so an
inline arrow (`[searchFn]="(q) => api.find(q)"`, a fresh reference on every
change detection run) is tolerated. A **stable** reference is still the
recommendation.

## 3. `mlv-select`

- New `compareWith` (default reference equality). Written values normalise
  onto option instances; a value whose option has not loaded yet renders the
  **loading variant** (`mlv-select--loading`, `aria-busy`, spinner instead of
  chevron, tabbable but not openable) until the first load resolves.
- New `searchable`, `searchPlaceholder`, `matcher`: search field **pinned above
  the option list** as the first row of the open dropdown (projected into the
  popup's `[mlvPopupPinnedContent]` slot, so it never scrolls away);
  activedescendant navigation; while open the search input carries
  `role="combobox"` and the trigger **steps down to `role="button"`** rather
  than losing its role. `aria-expanded` / `aria-haspopup` / `aria-controls`
  stay on the trigger (valid on either role); only `aria-required` moves, onto
  the search input.
- The panel now ignores aria reconciliation emits (a value can no longer be
  wiped when options change while the popup is open).

## 3b. `[loading]` now participates in readiness (select + combobox)

**Behavioural change.** The `loading` input inherited from
`MlvSignalFormUiControlBase` used to be accepted and never rendered on
`mlv-select` / `mlv-combobox`. It now (i) renders the dropdown panel's spinner
row (`_panelLoading = _adapter.loading() || loading()`) and (ii) feeds `_ready`
(`_adapter.ready() && !loading()`).

Consequence: while `[loading]` is `true` **and** the committed value is not
among the current options, the field enters the **loading variant**
(`_awaitingValueLabel`) —

- `mlv-select`: inert trigger (`aria-busy`, cannot open), spinner instead of the
  chevron, the clear X still available as the escape hatch;
- `mlv-combobox`: `readonly` input showing the localized loading placeholder,
  spinner instead of the chevron, only matched chips rendered.

Bind `[loading]` to the **option-loading** state only. A consumer that bound it
to an unrelated flag (a form save in flight, a page-level spinner) should rebind
it — otherwise that flag now makes the field inert whenever the value's label
has not resolved.

## 4. `mlv-popup`

Additive: new `MlvPopupPinnedContent` (`[mlvPopupPinnedContent]`) content slot.
An `<ng-template mlvPopupPinnedContent>` is stamped as `.mlv-popup__pinned`
directly above the popup's scroll region in **every** mode — anchored and
full-screen alike (there it lands below `.mlv-popup__header`, inside the focus
trap) — so the projected chrome never scrolls with the content. Nothing is
stamped when the slot is absent, so existing popups are unchanged.
`mlv-select` uses it for the searchable dropdown's search row.

## 5. i18n

New keys (all locales shipped): `select.searchPlaceholder`, `select.noResults`,
`select.loading`, `select.resultsAvailable`, `combobox.noResults`,
`combobox.pressEnterToAdd`, `combobox.loading`, `combobox.resultsAvailable`.
Custom `MlvLanguage` packs must add them.

## 6. `mlv-dropdown-panel`

New inputs `loadingMore`, `hasMore`, `infiniteScrollThreshold`, output
`loadMore`; listbox `aria-busy`. The `--loading` modifier **recolours** the
default option rows to `--mlv-text-secondary` instead of dimming the listbox —
the rows stay mounted, readable and clickable while a refresh resolves, and an
opacity dim on live controls would fail WCAG 1.4.3. Custom `itemTemplate` rows
own their colours and are untouched.
