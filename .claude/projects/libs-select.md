---
# Library: select

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

`@malva-ui/core/select` provides a fully-featured, accessible dropdown select component for Angular forms. It wraps the popup and dropdown infrastructure to deliver single/multiple selection, custom option rendering, optional native select behavior, automatic positioning, and signal/reactive/template-driven forms integration.

The library is generic (`MlvSelect<T>`) so it can work with any data type and accepts a transform function to convert raw values into displayable options.

---

## Public API

Exported from `libs/forms/select/src/index.ts`:

| Export                        | Kind                                                 | Description                                                                                                         |
| ----------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `MlvSelect`                   | Component class                                      | The primary select component                                                                                        |
| `MlvSelectState`              | Type alias                                           | `'default' \| 'success' \| 'info' \| 'warning' \| 'error'` (alias of `MlvFormState`)                                |
| `MlvSelectListTemplate`       | Directive class                                      | Marks an `<ng-template>` as the full list template (selector-only marker)                                           |
| `MlvSelectItemTemplate`       | Directive class                                      | Marks an `<ng-template>` as the per-item template inside the dropdown                                               |
| `MlvSelectSelectedTemplate`   | Directive class                                      | Marks an `<ng-template>` as the selected-value display template in the trigger                                      |
| `MlvSelectOption<T>`          | Interface (re-export from `@malva-ui/core/dropdown`) | `{ label: string; value: T; group?: string; disabled?: boolean }` (`group` clusters options under sticky headers)   |
| `MlvSelectOptionTransform<T>` | Type (re-export from `@malva-ui/core/dropdown`)      | `(item: T) => MlvSelectOption<T>`                                                                                   |
| `defaultOptionTransform`      | Function (re-export from `@malva-ui/core/dropdown`)  | Default transform: `String(item)` → label                                                                           |
| `resolveOptions`              | Function (re-export from `@malva-ui/core/dropdown`)  | Maps a raw array through a transform function                                                                       |
| `MlvSelectDataSource<T>`      | Class (re-export from `@malva-ui/core/dropdown`)     | Unpaged (`perPage = Infinity`) `MlvArrayDataSource<T>` subclass — default in-memory data source for option controls |

---

## Components

### `MlvSelect<T>`

**File:** `libs/forms/select/src/lib/select/select.ts`

**Selector:** `mlv-select`

**Purpose:** A combobox-style form control. Renders a trigger button and a popup dropdown panel. Extends `MlvSignalFormControlBase<T | T[] | null>`, so `[formField]`, `[formControl]`, and `ngModel` share one public `value` model and the common Malva form-control inputs.

#### Inherited inputs from `MlvSignalFormControlBase<T>`

| Input      | Type                              | Default                        | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------- | --------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`       | `string`                          | auto-generated `mlv-control-N` | HTML `id` applied to the trigger element                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `label`    | `string`                          | `''`                           | Label text rendered above the control                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `hint`     | `string`                          | `''`                           | Hint text displayed inside the label                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `message`  | `string`                          | `''`                           | Validation/status message below the control                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `state`    | `MlvFormState` (`MlvSelectState`) | `'default'`                    | Visual state: `default`, `success`, `info`, `warning`, `error`                                                                                                                                                                                                                                                                                                                                                                                                            |
| `disabled` | `BooleanInput`                    | `false`                        | Disables the control (coerced via `coerceBooleanProperty`)                                                                                                                                                                                                                                                                                                                                                                                                                |
| `readonly` | `boolean`                         | `false`                        | Marks the control as readonly                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `loading`  | `BooleanInput`                    | `false`                        | **Rendered:** ORs into the dropdown's spinner row (`_panelLoading`) and suppresses `_ready`, so a consumer-driven load also holds the trigger's loading variant while a committed value's label is pending. Bind it to a flag that is genuinely about **option loading** — because it feeds `_ready`, an unrelated flag (a save in flight, a page-level spinner) puts the trigger into the loading variant whenever the committed value is not among the current options. |

#### Own inputs

| Input               | Type                                                                                                       | Default                                   | Description                                                                                                                                                                                                                                                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `options`           | `MlvOptionsInput<T>` (`readonly T[] \| Observable<readonly T[]> \| MlvDataSource<T> \| null \| undefined`) | `[]`                                      | The items to display in the dropdown. Arrays / observables are **local**; an `MlvDataSource` is **remote** (source-side search + lazy paging). Immutable collections are accepted. See _Async sources_.                                                                                                                                             |
| `searchFn`          | `MlvOptionsSearchFn<T> \| null`                                                                            | `null`                                    | Remote search `(query) => T[] \| Promise<T[]> \| Observable<T[]>`. **Supersedes `options`** as the item source; the list is not filtered locally. Lazy: first invoked on the first open (or immediately when a committed value still needs its label).                                                                                              |
| `searchDebounce`    | `number`                                                                                                   | `200`                                     | Debounce (ms) applied to remote searches (`MlvDataSource` / `searchFn`) only. Local filtering stays instant.                                                                                                                                                                                                                                        |
| `searchable`        | `BooleanInput`                                                                                             | `false`                                   | Renders a search field as the first row of the open dropdown — pinned above the option list, so it never scrolls away — moves the combobox semantics onto it while open, and switches navigation to the activedescendant model. See _Searchable dropdown_.                                                                                          |
| `searchPlaceholder` | `string \| undefined`                                                                                      | `undefined`                               | Placeholder of the in-dropdown search field. Falls back to `MLV_SELECT_I18N.searchPlaceholder` (`'Search...'`).                                                                                                                                                                                                                                     |
| `matcher`           | `MlvOptionMatcher<T> \| undefined`                                                                         | shared substring matcher                  | Custom local-filter predicate (fuzzy / secondary-field). Threaded into the shared `filterOptions`; results are always ranked prefix-matches-first. **Ignored for remote sources**, which own their filtering. Mirrors `mlv-combobox`'s / `[mlvAutocompleteMatcher]`.                                                                                |
| `ariaLabel`         | `string \| undefined`                                                                                      | `undefined`                               | Accessible name for the combobox trigger when no visible `label` is rendered. Also (via `_panelAriaLabel`) names the dropdown panel's `role="listbox"` — see _Dropdown panel accessible name_.                                                                                                                                                      |
| `multiple`          | `boolean`                                                                                                  | `false`                                   | Enables multi-selection mode                                                                                                                                                                                                                                                                                                                        |
| `native`            | `boolean \| 'auto'`                                                                                        | `false`                                   | Renders a transparent, interactive native `<select>` over the visual trigger. `true` always uses it; `'auto'` uses it below the `md` breakpoint; a bare `native` attribute means `true`. Native choices come from `[options]`; custom item and selected-value templates are ignored, and only native `<option>` / `<optgroup>` content is rendered. |
| `placeholder`       | `string`                                                                                                   | `'Select...'`                             | Placeholder text shown when no value is selected                                                                                                                                                                                                                                                                                                    |
| `toOption`          | `MlvSelectOptionTransform<T>`                                                                              | `defaultOptionTransform`                  | Function mapping a raw item to `{ label, value }`                                                                                                                                                                                                                                                                                                   |
| `compareWith`       | `(a: T, b: T) => boolean`                                                                                  | `defaultCompareWith` (reference equality) | Equality used to match option values against the selection and against externally written values. Threaded into `MlvSelectionService.compareWith` and used by the reconciliation guard. See _Value ↔ options normalisation_.                                                                                                                       |
| `mobileMode`        | `MlvPopupMobileMode` (`'auto' \| 'fullscreen' \| 'off'`)                                                   | `'auto'`                                  | Passthrough to the dropdown `mlv-popup`. `'auto'` = full-screen sheet below the `md` breakpoint (< 768px), anchored above; `'off'` = always anchored; `'fullscreen'` = always sheet.                                                                                                                                                                |
| `mobileTitle`       | `string \| undefined`                                                                                      | `undefined`                               | Explicit full-screen sheet heading. When omitted, falls back to `label` (or, when unset, the resolved placeholder) via `_resolvedMobileTitle`.                                                                                                                                                                                                      |
| `mlvDensity`        | `MlvDensity \| undefined`                                                                                  | `undefined`                               | Density for the dropdown option list. Forwarded to the dropdown `mlv-popup`, which stamps `mlv--{density}` on the detached overlay panel (outside the page's density cascade); rows respond via the `mlv-list-item` density ladder. Omitted → global `MlvDensityService`.                                                                           |

#### Outputs

`MlvSelect` communicates value changes through its `value` model and touch state through the inherited `touch` output.

#### Key computed / signals

| Member                                   | Kind                   | Description                                                                                                                                                                |
| ---------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resolvedOptions`                        | `computed`             | `_adapter.items()` mapped through `toOption()`                                                                                                                             |
| `_nativeActive` (protected)              | `computed`             | Whether the transparent native select is active: always for `native=true`, below `md` for `native='auto'`, never for `false`                                               |
| `_nativeOptionGroups` (protected)        | `computed`             | Normalized `[options]` values grouped into native `<optgroup>` / `<option>` structures                                                                                     |
| `filteredOptions`                        | `computed`             | The options actually rendered in the panel: `resolvedOptions` filtered by `searchQuery` while **searchable + local**, `resolvedOptions` as-is otherwise                    |
| `searchQuery`                            | `signal<string>`       | Text of the in-dropdown search field; always `''` while closed (the close resets it)                                                                                       |
| `isOpen`                                 | `signal<boolean>`      | Tracks whether the dropdown popup is visible                                                                                                                               |
| `triggerWidth`                           | `signal<number>`       | Pixel width of the trigger element (used to size the popup)                                                                                                                |
| `_adapter` (protected)                   | `MlvOptionsAdapter<T>` | The shared source adapter behind `options` / `searchFn`; template-facing for the paging bindings (`hasMore` / `loadingMore` / `loadMore()`)                                |
| `_allValuesMatched` (protected)          | `computed`             | Whether every committed value has a matching option (by `compareWith`)                                                                                                     |
| `_ready` (protected)                     | `computed`             | `_adapter.ready() && !loading()` — the first payload arrived and no consumer-driven load is running                                                                        |
| `_awaitingValueLabel` (protected)        | `computed`             | The loading variant: `hasValue() && !_ready() && !_allValuesMatched()`                                                                                                     |
| `_panelLoading` (protected)              | `computed`             | `_adapter.loading() \|\| loading()` — the dropdown's top spinner row                                                                                                       |
| `_eagerDone` (private)                   | `signal<boolean>`      | Latches `true` on the first `ready()` of a **remote** source; gates the adapter's `eager` flag off so an inline-arrow `searchFn` cannot loop (see _Async sources_)         |
| `_activeDescendant` (private)            | `MlvActiveDescendant`  | Shared active-option bookkeeping over `filteredOptions` (searchable mode only). A constructor `effect` resets it whenever the filtered list shrinks past the current index |
| `_onPanelMousedown` (protected)          | method                 | Prevents the panel's `mousedown` default **only** while searchable (a method, never an inline `searchable() && …` expression — see _Searchable dropdown_)                  |
| `_activeIndex` (protected)               | `computed`             | The panel's `[activeIndex]`; pinned to `-1` while not searchable                                                                                                           |
| `_activeOptionId` (protected)            | `computed`             | `optionId(listboxId(), index)` of the active row — the search input's `aria-activedescendant`; `null` when none                                                            |
| `_searchInputId` (protected)             | `computed`             | `"<id>-search"` — the focus target after the popup opens                                                                                                                   |
| `_outerIsCombobox` (protected)           | `computed`             | `!(searchable() && isOpen())` — whether the **trigger** owns the combobox semantics                                                                                        |
| `_highlightQuery` (protected)            | `computed`             | Matched-substring emphasis; empty unless searchable over a **local** source                                                                                                |
| `_resolvedSearchPlaceholder` (protected) | `computed`             | `searchPlaceholder()` ?? the i18n `searchPlaceholder`                                                                                                                      |
| `_resultsAnnouncement` (protected)       | `computed`             | Polite live-region copy: i18n `resultsAvailable` (ICU `{count}`) or `noResults`; empty unless searchable **and** open                                                      |

#### Content children

| Query              | Directive                   | Description                                                            |
| ------------------ | --------------------------- | ---------------------------------------------------------------------- |
| `itemTemplate`     | `MlvSelectItemTemplate`     | Optional custom template for each option row in the dropdown           |
| `selectedTemplate` | `MlvSelectSelectedTemplate` | Optional custom template for the selected value display in the trigger |

#### Host bindings

```
class="mlv-select"
[class]="'mlv-select--' + state()"   // e.g. mlv-select--error
[class.mlv-select--disabled]="disabled()"
[class.mlv-select--open]="isOpen()"
[class.mlv-select--loading]="_awaitingValueLabel()"
```

#### Template structure (`select.html`)

1. `<mlv-form-control-wrapper>` — wraps the whole control, receives `focused`, `disabled`, `state`.
2. `<mlv-label>` — rendered when `label()` or `hint()` is set; clicking focuses the trigger.
3. `<ng-template mlvFormControlWrapperControl>` — projects the control itself:
   - `<mlv-popup-container>` — CDK overlay anchor.
   - `.mlv-select__trigger` — visual trigger (`div[role="combobox"]` in custom mode) with:
     - `[hostRole]="_outerIsCombobox() ? 'combobox' : 'button'"` — the role steps down to `button` while the **searchable** dropdown is open (the search input is the combobox then). `aria-expanded`, `aria-haspopup="listbox"`, `aria-controls`, `aria-disabled`, `aria-labelledby`/`aria-label` and `aria-describedby` are unconditional (all valid on either role); only `aria-required` is gated on `_outerIsCombobox()` — the search `mlv-input` takes it over via `[required]="required()"` while it owns the role.
     - `mlvResizeObserver` — tracks trigger width.
     - `mlvClick` — handles click-to-toggle.
     - Keyboard: `ArrowUp`/`ArrowDown` open and focus the first item, `Home`/`End` open without focusing (all four through the shared `_openFromKey($event, focusFirst)`, which always prevents the default and no-ops while inert); `Escape` closes. The focus-first request is skipped while `searchable()` — focus goes to the search field instead.
     - `aria-busy` while `_awaitingValueLabel()`.
     - Shows the i18n `loading` text while `_awaitingValueLabel()`, otherwise `selectedTemplate` / plain text when a value is selected, otherwise the placeholder.
     - A chevron arrow SVG (rotates 180° when open) — replaced by an `mlv-loader` spinner while `_awaitingValueLabel()`.
   - `.mlv-select__native` — real native `<select>` rendered when `_nativeActive()` is true. It is positioned over the visual trigger with `opacity: 0`, so it remains the focusable/clickable interaction surface while the styled trigger stays visible. It renders normalized `[options]` as `<option>` / `<optgroup>` and does not render custom templates.
   - `<mlv-popup>` — the popup overlay bound to `isOpen`, with `(afterOpened)="_onPopupOpened()"` (focus handoff to the search field) and `(afterClosed)="_onPopupClosed()"` (focus restore + search reset).
     - `<ng-template mlvPopupPinnedContent>` — stamped only when `searchable()` — carries `.mlv-select__search` (a `lucideSearch` icon + a `bare` `mlv-input`). The popup renders it as `.mlv-popup__pinned`, **above** its scroll region, so the search row is the dropdown's first row and stays put however far the options scroll.
     - `<ng-template mlvPopupContent>` stamps `.mlv-select__panel` — a `(mousedown)="_onPanelMousedown($event)"` wrapper — around `<mlv-dropdown-panel scrollMode="parent">`, so the option list delegates to the popup's themed scrollbar instead of creating a nested scroll region. The panel receives `[options]="filteredOptions()"`, `[focusMode]="searchable() ? 'activedescendant' : 'roving'"`, `[activeIndex]="_activeIndex()"`, `[highlightQuery]="_highlightQuery()"`, `[loading]="_panelLoading()"`, `[loadingText]="_i18n().loading"`, `[hasMore]="_adapter.hasMore()"`, `[loadingMore]="_adapter.loadingMore()"` and `(loadMore)="_adapter.loadMore()"`; when `searchable()` it also projects the `.mlv-select__empty` no-results row.
   - `.mlv-select__sr-status` — a visually-hidden `role="status" aria-live="polite"` region rendering `_resultsAnnouncement()` (after the popup container, still inside the control template).
4. `<mlv-message>` — rendered when `message()` is set.

#### Styling (`select.scss`)

BEM block `mlv-select`. Uses `@malva-ui/styles` `mixins.base()` for box-sizing/font reset. Key elements:

- `.mlv-select__trigger` — flex row, full width, 9px vertical padding.
- `.mlv-select__arrow` — 20×20px, transitions color and rotation; becomes `var(--mlv-text-primary)` on hover/focus/open; rotates 180° when open.
- `.mlv-select__value` — `var(--mlv-text-primary)`.
- `.mlv-select__placeholder` — `var(--mlv-text-secondary)`.
- `.mlv-select__popup` — padding forced to 0 to let the dropdown panel define its own spacing.
- `.mlv-select--loading` — the loading variant: `cursor: progress` on the trigger, and the arrow box becomes a centring flex box so the `mlv-loader` sits exactly where the chevron did (no trigger-row shift).
- `.mlv-select__search` — the searchable mode's first row: **layout only** (flex row, gap, padding) plus a raised background + bottom hairline so it stays legible over the options scrolling beneath it. It carries no positioning of its own — the popup's `.mlv-popup__pinned` slot takes it out of the scroll region entirely (and its `z-index: 3` already outranks `.mlv-dropdown-panel__group-header`'s sticky `z-index: 1`).
- `.mlv-select__search-icon` — the non-shrinking `lucideSearch` glyph (`--mlv-text-tertiary`).
- `.mlv-select__search-input` — **layout only** (`flex: 1; min-width: 0`); the `bare` `mlv-input` owns its own padding / font / background.
- `.mlv-select__panel` — the `mousedown`-swallowing wrapper that keeps DOM focus in the search field while pointing at options (no styles of its own).
- `.mlv-select__empty` — the projected "no results" row inside the panel.
- `.mlv-select__sr-status` — visually-hidden polite live region; **byte-identical** to `.mlv-combobox__sr-status` (both must stay in sync).

#### Providers

- `MlvSelectionService` (from `@malva-ui/core/form-utils`) — scoped to the component instance to manage the selected value(s).
- `MLV_FORM_CONTROL` — connects the control to Malva field/wrapper infrastructure.

---

## Directives

### `MlvSelectListTemplate`

**File:** `libs/forms/select/src/lib/select-template.directives.ts`

**Selector:** `[mlvSelectListTemplate]`

**Purpose:** Marker directive — inject `TemplateRef` to supply a full replacement template for the option list. (Currently a marker; the component queries for it but the actual rendering delegates to `MlvDropdownPanel`.)

### `MlvSelectItemTemplate`

**File:** `libs/forms/select/src/lib/select-template.directives.ts`

**Selector:** `[mlvSelectItemTemplate]`

**Purpose:** Marks an `<ng-template>` as the custom item template. When present, the template is forwarded to `<mlv-dropdown-panel [itemTemplate]>`, allowing custom rendering of each option row.

Template context: the implicit variable is the `MlvSelectOption<T>` object for the row.

### `MlvSelectSelectedTemplate`

**File:** `libs/forms/select/src/lib/select-template.directives.ts`

**Selector:** `[mlvSelectSelectedTemplate]`

**Purpose:** Marks an `<ng-template>` as the custom selected-value display inside the trigger button. When present, it replaces the default `{{ displayValue }}` text.

Template context: `$implicit` is `T[]` (the array of currently selected raw values).

---

## Services

### `MlvSelectionService` (from `@malva-ui/core/form-utils`)

Scoped per `MlvSelect` instance (provided in the component's `providers` array). Manages selected values array and multi/single mode. The component interacts with it via:

- `selectionService.multiple.set(...)` — synced from the `multiple` input via `effect()`.
- `selectionService.compareWith.set(...)` — synced from the `compareWith` input via `effect()`, so the service's membership checks use the control's equality.
- `selectionService.selectedValues()` — signal returning currently selected raw values.
- `selectionService.setValues([...])` — replaces selection.
- `selectionService.clear()` — clears selection.
- `selectionService.requestFocusFirst()` — requests focus on the first dropdown item (keyboard navigation).

---

## Usage Examples

### Basic single-select with primitive values

```typescript
import { MlvSelect } from '@malva-ui/core/select';

@Component({
  imports: [MlvSelect, ReactiveFormsModule],
  template: ` <mlv-select label="Country" placeholder="Choose a country" [options]="countries" [formControl]="countryControl" /> `,
})
export class MyComponent {
  countries = ['United States', 'Canada', 'Mexico'];
  countryControl = new FormControl('');
}
```

### Object options with a custom transform

```typescript
import { MlvSelect, MlvSelectOptionTransform } from '@malva-ui/core/select';

interface User {
  id: number;
  name: string;
}

const userTransform: MlvSelectOptionTransform<User> = (u) => ({ label: u.name, value: u });

@Component({
  imports: [MlvSelect, ReactiveFormsModule],
  template: ` <mlv-select label="User" [options]="users" [toOption]="userTransform" [formControl]="userControl" /> `,
})
export class MyComponent {
  users: User[] = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ];
  userTransform = userTransform;
  userControl = new FormControl<User | null>(null);
}
```

### Object values that survive serialize/deserialize (`compareWith`)

```html
<!-- A value loaded from the server is a different object instance than the
     option — compareWith collapses it onto the option, so the label and the
     check-mark agree even when the options arrive after the value. -->
<mlv-select [options]="users" [toOption]="userTransform" [compareWith]="sameUser" [formControl]="userControl" />
<!-- sameUser = (a: User, b: User) => a.id === b.id; -->
```

### Multi-select with custom item template

```typescript
@Component({
  imports: [MlvSelect, MlvSelectItemTemplate, NgTemplateOutlet],
  template: `
    <mlv-select [options]="tags" [multiple]="true" [formControl]="tagsControl">
      <ng-template mlvSelectItemTemplate let-option>
        <span class="tag-item">{{ option.label }}</span>
      </ng-template>
    </mlv-select>
  `,
})
```

### Custom selected-value display

```typescript
@Component({
  imports: [MlvSelect, MlvSelectSelectedTemplate],
  template: `
    <mlv-select [options]="items" [formControl]="ctrl">
      <ng-template mlvSelectSelectedTemplate let-values>
        {{ values.length }} items selected
      </ng-template>
    </mlv-select>
  `,
})
```

### Grouped options (sticky headers)

Return a `group` label from `toOption` to cluster options under sticky,
non-selectable section headers (rendered by the shared `mlv-dropdown-panel`;
see the dropdown lib docs for the full mechanism). Group headers are skipped by
keyboard navigation / type-ahead and never enter the value. Plain string arrays
and ungrouped `MlvSelectOption` arrays are unaffected.

```typescript
@Component({
  imports: [MlvSelect],
  template: `<mlv-select label="City" [options]="cities" [toOption]="cityToOption" />`,
})
export class MyComponent {
  cities = [
    { name: 'Paris', country: 'France' },
    { name: 'Berlin', country: 'Germany' },
  ];
  cityToOption = (c: { name: string; country: string }): MlvSelectOption<typeof c> => ({
    label: c.name,
    value: c,
    group: c.country, // ← options sharing a country cluster under one header
  });
}
```

### Async sources

```html
<!-- Observable source: the trigger holds the loading variant until the first emission -->
<mlv-select [options]="users$" [toOption]="userToOption" [compareWith]="sameUser" [formControl]="ctrl" />

<!-- Data source: source-side search + lazy paging through the panel's sentinel -->
<mlv-select [options]="userDataSource" [toOption]="userToOption" [searchDebounce]="300" />

<!-- Remote search fn (supersedes [options]); lazy — first invoked on the first open, or
     immediately when a committed value still needs its label -->
<mlv-select [searchFn]="searchUsers" [toOption]="userToOption" [loading]="resolvingInitialUser()" />
<!-- searchUsers = (query: string) => this.api.findUsers(query)
     Bind [loading] only to flags about *option* loading. It feeds `_ready`, so an
     unrelated flag (a save in flight, say) puts the trigger into the loading variant
     whenever the committed value is not among the current options. -->
```

---

## Dependencies

Internal `@malva-ui/*` libraries:

- `@malva-ui/core/popup` — `MlvPopup`, `MlvPopupContent`, `MlvPopupContainer`, `MlvPopupPinnedContent` (the searchable dropdown's pinned search row)
- `@malva-ui/core/dropdown` — `MlvDropdownPanel`, `MlvSelectOption`, `MlvSelectOptionTransform`, `defaultOptionTransform`, `resolveOptions`, `isReconciliationEmit` / `filteredOutCommitted` (the shared aria reconciliation guard), `valueIndex` + `MlvValueIndex` (the shared option-value membership/resolution index), `MlvOptionsAdapter` + `MlvOptionsInput` / `MlvOptionsSearchFn` (the shared source adapter behind `options` / `searchFn`), `filterOptions` + `MlvOptionMatcher` (searchable local filtering), `MlvActiveDescendant` + `optionId` (the shared activedescendant bookkeeping and option-id format)
- `@malva-ui/core/form-utils` — `MlvSignalFormControlBase`, wrapper primitives, `MlvSelectionService`, `toAriaValues`, `fromAriaValues`
- `@malva-ui/core/input` — `MlvInput` (the `bare` in-dropdown search field; carries `role="combobox"` and, via `[required]`, `aria-required` while the searchable dropdown is open)
- `@malva-ui/core/loader` — `MlvLoader` (the loading variant's circular spinner in place of the chevron)
- `@malva-ui/i18n` — `MLV_SELECT_I18N` (`placeholder`, `searchPlaceholder`, `noResults`, `loading`, `resultsAvailable`), `MLV_FORM_UTILS_I18N` (`clear`), `MlvI18nResolverService` (the ICU `resultsAvailable`)
- `@malva-ui/cdk/accessibility` — `MlvClick`
- `@malva-ui/cdk/utils` — `MlvResizeObserver`, `MlvBreakpointService` (responsive `native='auto'` mode)
- `@malva-ui/styles` — SCSS mixins (`mixins.base()`)

Angular / third-party:

- `@angular/common` — `NgTemplateOutlet`
- `@angular/cdk/overlay` — `ConnectedPosition`
- `@lucide/angular` — `LucideChevronDown`, `LucideSearch` icons

---

## Accessibility notes (updated)

- The trigger keeps `role="combobox"` via `MlvClick`'s `[hostRole]="_outerIsCombobox() ? 'combobox' : 'button'"` (the directive no longer forces `button` on its own). While the **searchable** dropdown is open the combobox role moves onto the in-dropdown search input and the trigger steps down to `role="button"` — never to no role at all — so exactly one `role="combobox"` is ever exposed while every ARIA attribute stays valid for the role that carries it. `aria-expanded` / `aria-haspopup` / `aria-controls` are unconditional (valid on both roles); only `aria-required` is gated off for the button phase, and it moves onto the search input (`[required]="required()"`) so a required searchable select never stops exposing it. See _Searchable dropdown_.
- `MlvClick` receives `[disabled]="computedDisabled()"` so a disabled trigger is removed from the tab order (`tabindex="-1"`); `aria-disabled` renders only when disabled. `openDropdown()` also refuses to focus a disabled trigger — `tabindex="-1"` still accepts programmatic focus, so the label's click target would otherwise land the caret on a disabled field.
- The visible `<mlv-label>` is linked via `aria-labelledby` (a `<label for>` cannot name the `<div>` trigger) — `labelId` computed added.
- Closed-trigger keyboard: ArrowUp / ArrowDown / Home / End open the dropdown (shared `_openFromKey`; no-op while inert). The focus-first request runs in roving mode only — a searchable dropdown hands focus to its search field instead.
- A polite `aria-live` status region (`.mlv-select__sr-status`) announces the filtered result count / "No results" while the searchable dropdown is open — both resolved from `MLV_SELECT_I18N` (`resultsAvailable` is an ICU plural). It is empty while closed or non-searchable, so no stale count is read out.
- The loading variant sets `aria-busy` on the trigger and gives the `mlv-loader` an `ariaLabel` from `MLV_SELECT_I18N.loading`. The trigger is **not** disabled — it keeps `tabindex="0"` and stays reachable and readable to AT while its value resolves; only the open paths are suppressed.
- Native mode keeps the real `<select>` as the only exposed focus target. The styled trigger is `aria-hidden`, disabled, and removed from the tab order while the transparent native control carries the field's label, description, and value interaction. Native controls are intentionally opacity-hidden rather than `visibility: hidden`, because they must remain focusable and clickable.

---

## Async sources (2026-08)

`options` and `searchFn` are normalised by the shared **`MlvOptionsAdapter<T>`** (`@malva-ui/core/dropdown`, `_adapter`) — the same engine behind `mlv-combobox` and `[mlvAutocomplete]`. It exposes `mode()`, `items()`, `loading()`, `loadingMore()`, `ready()`, `hasMore()`, `search()`, `ensureLoaded()`, `loadMore()`; see `libs-dropdown.md` → _Options adapter_ for the per-source contract.

- **Local mode** (`readonly T[]`, `Observable<readonly T[]>`) — the consumer owns filtering. A plain array is `ready()` from the first tick, so a synchronous `options` binding behaves exactly as before.
- **Remote mode** (`MlvDataSource<T>`, or any `searchFn`) — the source owns filtering and `filteredOptions` renders `items` as-is. With `searchable`, the in-dropdown search field forwards its query through `_adapter.search()`; without it, remote mode is about async delivery and paging rather than querying.
- **Debounce.** `searchDebounce` (default `200`ms) applies to remote searches only.
- **Lazy first load.** A `searchFn` is not called until it is needed: a constructor effect calls `_adapter.ensureLoaded()` on the first `isOpen()`. The exception is the adapter's `eager` gate — `hasValue() && !_allValuesMatched() && !_eagerDone()` — which fires the initial load immediately when a committed value still has no resolvable label, so the loading variant resolves without the user opening the list. `_eagerDone` latches `true` the first time a **remote** source reports `ready()` and never flips back: an inline-arrow `searchFn` (`[searchFn]="(q) => api.find(q)"`) is a fresh reference on every change detection run, which re-arms the adapter's lazy gate on every pass, and without the latch a still-unmatched committed value would make each pass fire another request whose result triggers the next pass. The mode check in the latch matters — an array source is `ready()` from the first tick, so latching on readiness alone would disarm the gate before a late-bound `searchFn` ever became the active branch.
- **The list stays open while loading.** `_panelLoading` (`_adapter.loading() || loading()`) drives the panel's top spinner row and its `--loading` modifier; the panel keeps previous options mounted, readable and interactive (it recedes the default rows' colour rather than dimming them), so a landing response never blanks the dropdown or closes it.
- **Paging.** `[hasMore]`, `[loadingMore]` and `(loadMore)` are bound straight off the adapter, so an `MlvDataSource` with a finite `perPage` grows the list through the panel's infinite-scroll sentinel. The unpaged `MlvSelectDataSource` simply reports `hasMore: false`.
- **The reconciliation guard is what makes this safe.** Every async landing changes the _rendered_ option set under a possibly-open panel, which is exactly when aria re-emits `valueChange`; `selectOption` routes those through the shared guard (see _Reconciliation-emit guard_ below), so a committed value survives a source swapping its items out from under the panel.
- **Late labels resolve themselves.** The `_applyPendingValues` effect tracks `resolvedOptions()`, so a value written before its options arrive re-normalises onto the real option instance as soon as the source answers — the trigger's `displayValue` and the panel's check-mark then agree.

## Loading variant (`--loading`)

`_awaitingValueLabel()` = `hasValue() && !_ready() && !_allValuesMatched()` — a value is committed but no option resolves its label yet (the classic "deserialized id, options still in flight" case). While it holds:

- the host carries `mlv-select--loading` (`cursor: progress` on the trigger),
- the trigger sets `aria-busy` but keeps `tabindex="0"` — **tabbable but inert**,
- the trigger renders `MLV_SELECT_I18N.loading` instead of the raw value, so a still-unresolved object never leaks a `String(item)` label into the field,
- the chevron is replaced by the `mlv-loader` spinner (the toggle affordance would be a dead control),
- `_isInert()` (`computedDisabled() || _awaitingValueLabel()`) returns `true`, so every **open** path is suppressed — `toggleDropdown()`, `openDropdown()` and `_openFromKey()`.

Three things deliberately keep working while the variant holds:

- **The inline clear X stays rendered** (`_showClear()` is _not_ gated on `_awaitingValueLabel()`). With every open path inert it is the only escape hatch left when a source never answers, and `onClear()` works there — dropping the value clears `hasValue()`, which ends the variant. Combobox parity.
- **Closing is never blocked.** `toggleDropdown()` short-circuits on `isOpen()` before the inert check, so a panel opened before the variant engaged (a late `[loading]`, a value written under an open list) is still dismissable from its own trigger.
- **`openDropdown()` still focuses the trigger** before the inert early-return. It is the `<mlv-label>` click target, and clicking a field's label must always land focus on that field — from there the X is one Tab away. A **disabled** field is the exception (`computedDisabled()` returns before the focus call): its trigger carries `tabindex="-1"`, which would still accept programmatic focus.

The variant clears as soon as the source is `ready()` **or** every committed value matches an option. Arrays are `ready()` immediately, so a synchronous `options` binding never shows it.

> **Multi-select:** `_allValuesMatched` uses `.every()`, so **one** unresolved value puts the whole trigger into the variant — by design. The trigger renders a single summary string (`displayValue`), which would otherwise under-report the selection (`"2 items selected"` while only one is known) or leak a raw label for the unresolved entry.

---

## `@angular/aria` integration (Task 2.5)

The dropdown popup is the **migrated `@angular/aria` listbox** — `mlv-select` renders `mlv-dropdown-panel`, which host-applies `@angular/aria`'s `ngListbox`/`ngOption` (via `MlvListSelectable`/`MlvListItemSelectable`). No aria selectors are bound in `mlv-select` itself; the panel is consumed as-is.

**Trigger strategy — manual `<div role="combobox">` trigger kept (not `ngCombobox`).** In aria 22.0.5 there is no `ngComboboxInput`; `[ngCombobox]` is the trigger directive and can sit on a non-editable `<div>`. A full `ngCombobox` restructure was rejected because aria's `ComboboxPopup`/`ComboboxWidget` render the popup via aria's own `DeferredContent`, which conflicts with the CDK-overlay positioning (`mlv-popup`) the design pins, and aria's combobox expects the listbox in `activedescendant` focus mode while the shared panel/list use roving focus (consumed as-is). The existing manual trigger already satisfies the full a11y contract, so the migration is panel-only.

**Forms value ↔ aria bridge.** `mlv-select` exposes `T` single / `T[]` multi / `null`, while the aria listbox always models selection as a flat array. The bridge helpers translate between them:

- External `value` model changes → `toAriaValues(value)` feed `MlvSelectionService`.
- `selectOption(values)` → `fromAriaValues(values, multiple())` collapses the aria array back to the public forms value.

**Value ↔ options normalisation (`compareWith`).** A written value is not fed to the selection service verbatim. The forms-value effect stashes `toAriaValues(this.value())` in `_pendingValues`, then `_applyPendingValues()` replaces each pending value with the **option's own instance** whenever `compareWith` matches one (`opts.find((o) => compare(o.value, v))?.value ?? v`). Two consequences:

- A deserialised object (`{ id: 2, name: 'stale' }`) collapses onto the real option, so the check-mark and the trigger's `displayValue` agree instead of rendering a stale/`String(item)` label.
- The effect reads `resolvedOptions()`, so it **re-runs when the options arrive after the value** — a preset value resolves its label as soon as its option loads. Later tasks (async sources, searchable mode) rely on that re-run.

`compareWith` is also pushed into `MlvSelectionService.compareWith` by its own effect, so the service's membership checks (`isSelected`, `deselect`) use the same equality.

**One shared option-value index (`_optionValueIndex`).** Two members cross-check the committed selection against `resolvedOptions()`, and each used to run its own nested `selected × options` scan:

| Site                  | Was                                                                     | Now                                    |
| --------------------- | ----------------------------------------------------------------------- | -------------------------------------- |
| `_allValuesMatched`   | `selected.every((v) => opts.some((o) => compare(o.value, v)))`          | `selected.every((v) => index.has(v))`  |
| `_applyPendingValues` | `pending.map((v) => opts.find((o) => compare(o.value, v))?.value ?? v)` | `pending.map((v) => index.resolve(v))` |

(`_isNativeOptionSelected` is the third site in this control but queries the other direction — see below.)

`resolvedOptions()` is the **accumulated** lazily-paged list, so every page append re-ran both over the whole accumulated list — a scroll session over a large remote list with many values selected cost O(selected × options²) in total. The private `_optionValueIndex` computed now holds one `valueIndex(resolvedOptions(), compareWith(), (o) => o.value)` (`@malva-ui/core/dropdown`) that rebuilds only when the option list or the comparator changes and serves both. The projection is passed to `valueIndex` rather than applied first, because a `.map()` at the call site would walk the whole accumulated list eagerly on every rebuild — defeating the index's progressive walk, which otherwise reads nothing until a query asks and stops at the first match. It carries an explicit `Signal<MlvValueIndex<T>>` annotation as a precaution, not a necessity: it is a new node on the documented `_adapter` → `eager` → `_allValuesMatched` → `resolvedOptions` → `_adapter` inference cycle, so annotating keeps it from ever contributing to a circular inference — but `typecheck` and `core:build` both pass without it today. It is the same cycle `_adapter`'s own annotation breaks — that one _is_ load-bearing.

Behaviour is unchanged in every case, including the equality edge values: `valueIndex` keys a `Map` only for a **recognised** identity comparator with no hazard value present (`NaN` under `===`, `-0` under `Object.is`), and answers a hazardous query pairwise. In particular `_applyPendingValues` is **not** a no-op under the default `===`: a written `-0` matched against a `+0` option is replaced by the option's `+0`, exactly as `find(...)?.value ?? v` always did.

**A second index for the native `<select>` (`_selectedValueIndex`).** `_isNativeOptionSelected` is the same O(selected × options) shape but queries the other direction, and it is the most expensive of the six: it is a template **method** bound once per rendered `<option>` (`select.html:108` and `:119`), so it re-runs on **every change-detection pass** of the native branch, not only when a signal changes.

It gets its own `valueIndex`, not a share of `_optionValueIndex`, for two independent reasons:

- **Invalidation flips.** This index is keyed on `selectedValues()` + `compareWith()`; the option-side one is keyed on `resolvedOptions()` + `compareWith()`. They rebuild on different signals.
- **Argument order is observable.** This site calls `compare(selected, value)` — transposed relative to the other five, which call `compare(option.value, committedValue)`. `valueIndex` applies `compare(indexedValue, queriedValue)`, so the order is reproduced **only** by indexing the selection and querying with the option value. Indexing the options instead silently transposes the arguments, and a consumer's `compareWith` is under no obligation to be symmetric.

`MlvSelectionService` only ever `set`s a fresh array, so holding it by reference inside the index is safe.

> `MlvDropdownPanel._selectedSet` (`dropdown-panel.ts`) is **not** a precedent for this. It builds a bare `new Set(selectedValues())` and queries it unconditionally — correct there only because `MlvDropdownPanel` has no `compareWith` input at all. Copying it here would silently drop both `compareWith` support and the `NaN`/`-0` rule.

**Reconciliation-emit guard.** `@angular/aria`'s `Listbox` reconciles its `value` model against the currently **rendered** options and re-emits `valueChange` whenever that set changes — not only on user interaction. `selectOption` therefore routes every emit through the shared `isReconciliationEmit()` / `filteredOutCommitted()` helpers from `@malva-ui/core/dropdown` (the same pair `mlv-combobox` uses), passing `_visibleValues()` (`filteredOptions().map((o) => o.value)`) as the visible set and `compareWith()` as the comparator. The input's default is the **shared** `defaultCompareWith` from `@malva-ui/core/dropdown`, not a per-instance inline arrow — same `===` behaviour, but the guards recognise the reference and take their O(R + V) `Set` path instead of R × V `compare()` calls per emit:

- An emit that adds nothing and only drops values whose option is **not rendered** is reconciliation → **ignored entirely** (no value write, no close, no touch). An async initial load landing while the panel is open makes aria reconcile against the previous (empty) set and re-emit `[]`; unguarded, that wiped the committed value.
- A genuine deselect of a **rendered** option is unaffected — single-select still commits `null`.
- A genuine multi-select pick re-adds the committed values aria dropped only because their option is not rendered, so earlier picks survive an option-set change.

The guard applies unconditionally (not only while filtering), because the "options changed under an open panel" case is exactly when the noise appears. `_visibleValues()` reads `filteredOptions()`, so in searchable mode the visible set narrows with the query — which is exactly when aria drops the committed value from its model.

`selectOption` only decides _what_ to write; the write itself lives in the private `_commitSelection(next)`, shared with the search field's Enter (see _Searchable dropdown_). It is the single place that closes + refocuses for single-select, writes the forms value, syncs the selection service and marks touched.

**Cross-lib `aria-controls` linkage — FIXED 2026-07-20 (in `@malva-ui/core/list` / `@malva-ui/core/dropdown`):** previously the trigger's `aria-controls` pointed at `listboxId()` (`"<id>-listbox"`) but the aria `Listbox` host directive rendered its **own** generated DOM `id` and overrode the panel's `[id]="listboxId()"` binding, so the DOM-level linkage dangled (combobox had the identical wiring). `MlvListSelectable` now re-exposes aria's `Listbox.id` input publicly as `listboxId` (`hostDirectives` inputs alias `'id: listboxId'`), and `mlv-dropdown-panel` binds `[listboxId]` (instead of the native `[id]`) on the `<mlv-list>`. aria renders it via `[attr.id]="id()"`, so the rendered listbox DOM id now equals `listboxId()` and the trigger's `aria-controls` resolves to a real element. `select.spec.ts` asserts the true linkage (`trigger aria-controls === rendered listbox id === "fruit-listbox"`), replacing the earlier select-owned-contract-only assertion.

---

## Searchable dropdown (2026-08)

`searchable` stamps a **search field as the first row of the open dropdown** — the select's answer to a long option list, without turning it into a `mlv-combobox` (the trigger stays a summary button; the search lives inside the popup and disappears with it).

**Anatomy.** The search row is projected into the popup's **pinned slot**: `<ng-template mlvPopupPinnedContent>` (stamped only when `searchable()`) holds `.mlv-select__search` (a `lucideSearch` icon + a `bare` `mlv-input`, `id="<id>-search"`), which the popup renders as `.mlv-popup__pinned` directly above `.mlv-popup__scrollbar`. `mlvPopupContent` then holds `.mlv-select__panel` wrapping the `mlv-dropdown-panel`, and the `.mlv-select__empty` no-results row is projected into the panel's empty slot. A visually-hidden `.mlv-select__sr-status` live region sits next to the popup container.

> **Why pinned, not sticky.** The row started life as `position: sticky; top: 0` inside the popup's scroll viewport and could still scroll out of view on long lists — sticky-in-a-scroll-container also depends on nothing between the row and the viewport establishing overflow/containment. The popup slot moves it out of the scroll region altogether: it keeps its own height, the scroll region shrinks around it, and the row is unscrollable by construction. Full-screen sheets get the same treatment — the row lands under `.mlv-popup__header`, still inside the sheet's focus trap. See `libs-popup.md` → _Pinned-content slot_.

**Exactly one `role="combobox"`.** `_outerIsCombobox = !(searchable() && isOpen())`. While the searchable dropdown is open the trigger **steps down to `role="button"`** and the search input becomes the combobox (`role="combobox"`, `aria-expanded="true"`, `aria-haspopup="listbox"`, `aria-autocomplete="list"`, `aria-controls="<id>-listbox"`, `aria-activedescendant`, an `aria-label` from the field's `label` or resolved placeholder, and `[required]="required()"` → `aria-required` on the bare input). Closing hands `combobox` straight back. A non-searchable select never loses it.

The trigger keeps `aria-expanded`, `aria-haspopup="listbox"` and `aria-controls` **unconditionally** — all three are valid on `button` and semantically correct there (a button that opened a popup). Dropping the role to `null` instead would leave a bare `<div>` carrying ARIA state that no role permits. Only `aria-required` is gated (`_outerIsCombobox() && required()`), because it is not allowed on `button` — and it is not lost, only **moved**: the search input carries it while it is the live combobox, so a required searchable select still exposes `aria-required` on the element that owns the role. Net effect: the non-searchable path's trigger ARIA is byte-identical to before this feature.

**Activedescendant keyboard model.** The panel is pinned to `focusMode="activedescendant"` while searchable (`'roving'` otherwise), so DOM focus stays in the search input and the highlighted row is tracked by index in the shared `MlvActiveDescendant` (`filteredOptions().length` read lazily). `_activeOptionId` computes `optionId(listboxId(), index)` — the same helper the panel stamps on each row, so the input's `aria-activedescendant` and the `.mlv-dropdown-panel__item--active` highlight can never drift.

A constructor `effect` watches `filteredOptions().length` and resets the active index (untracked) whenever it has fallen out of range. A remote response landing over stale results — or any narrowing of the list — would otherwise leave `aria-activedescendant` pointing at a row that no longer exists, and the next arrow press stepping from a phantom position.

| Key                 | Behaviour                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| type                | `searchQuery` updates, active index resets; local sources filter instantly, remote ones are asked (debounced)          |
| ArrowDown / ArrowUp | move the active option with wrap-around (first move from "none" lands on first / last)                                 |
| Home / End          | activate the first / last option                                                                                       |
| Enter               | commit the active option; **single** closes + refocuses the trigger, **multi** toggles it and stays open (index reset) |
| Escape              | close (the close resets the query)                                                                                     |
| Tab / Shift+Tab     | close and return focus to the trigger; the default is prevented                                                        |

Tab prevents its default deliberately: the search field lives in a **detached overlay**, so a native Tab would move focus to whatever follows the overlay in the DOM rather than to the field after the select. Closing and restoring the trigger puts the user back where the tab sequence expects them.

**Focus handoff.** `(afterOpened)` → `_onPopupOpened()` focuses the search field via `document.getElementById(_searchInputId())` (the input is stamped inside a detached embedded view, so view queries cannot reach it — the same pattern `mlv-combobox` / `mlv-day-picker` use). `(afterClosed)` → `_onPopupClosed()` restores focus to the trigger and, when searchable, resets the active index and the query. `_openFromKey`'s `requestFocusFirst()` is skipped while searchable — pulling DOM focus onto an option would break the model.

**Local vs remote.** `filteredOptions` filters `resolvedOptions` through the shared `filterOptions(resolved, searchQuery(), matcher())` **only** when searchable over a local source (array / observable); a remote source (`MlvDataSource` / `searchFn`) renders its items as-is and receives the query through `_adapter.search(value)`. Filtering remote results locally as well would hide server matches the local matcher dislikes and empty the list while a newer query is in flight. For the same reason `_highlightQuery` (the `<mark>` emphasis) is local-mode only. Closing re-asks a remote source for `''` once, so a blank field never sits above a list still filtered by the previous query.

**The `mousedown` guard.** `.mlv-select__panel` swallows `mousedown` (`(mousedown)="_onPanelMousedown($event)"`) so clicking an option or the scrollbar cannot blur the search input — the activedescendant model and the open state both depend on focus staying there. It is a genuine no-op when not searchable. The pinned search row is deliberately **outside** that wrapper (it is a sibling slot, not panel content): swallowing its own `mousedown` would stop a click from placing the caret in the input.

> It must stay a **method**. The obvious inline form, `(mousedown)="searchable() && $event.preventDefault()"`, evaluates to `false` on the non-searchable path, and Angular treats a `false` listener return as `preventDefault()` (`wrapListener` → `listenerFn(e) !== false`). That silently swallowed the mousedown default for **every** select dropdown — roving focus could not transfer to the clicked option and text selection was blocked. Pinned by the non-searchable spec, which asserts `defaultPrevented === false`.

**The popup scroll viewport is not a tab stop.** `mlv-popup` renders its content in a bare `<mlv-scrollbar class="mlv-popup__scrollbar">`, and since [2026-08-scrollbar-viewport-tabindex](../../docs/migrations/2026-08-scrollbar-viewport-tabindex.md) `viewportTabIndex` defaults to `null` — **no `tabindex` attribute at all**, no `role`, no `aria-label`. (It previously auto-resolved to `tabindex="0"` in searchable mode, because the scroll region holds only the activedescendant listbox with the search input pinned **outside** it.) Nothing is lost in practice: Tab from the search input is intercepted (`preventDefault` → close + refocus the trigger), so focus never advanced into the overlay anyway; and the panel is scrolled by the activedescendant model, the pointer, and — where the browser grants native scroller focusability to a child-less scroller — the scroller itself.

**Divergence from `mlv-combobox`: Enter in multi-select keeps the query.** A multi-select select commits the active option on Enter and **leaves `searchQuery` as it is** (only the active index resets), while `mlv-combobox` clears its query after a multi commit. Intentional: the select's search field is a _filter box_ over the list — several matches of one query are usually toggled in a row — whereas the combobox's input _is_ the value field, so it has to empty itself to type the next value.

**Announcements.** `_resultsAnnouncement` renders into `.mlv-select__sr-status` (`role="status" aria-live="polite"`): the ICU `resultsAvailable` count, or `noResults` when the query matches nothing. Empty while closed or non-searchable.

**i18n keys used:** `searchPlaceholder` (search field placeholder), `noResults` (the `__empty` row + announcement), `resultsAvailable` (ICU `{count, plural, …}`, resolved via `MlvI18nResolverService`), plus the existing `placeholder` / `loading`.

```html
<!-- Local: type-to-filter over the bound array -->
<mlv-select label="Country" searchable [options]="countries" [(value)]="country" />

<!-- Custom local matcher (secondary field) -->
<mlv-select searchable [options]="users" [toOption]="userToOption" [matcher]="matchNameOrEmail" />

<!-- Remote: the search field drives the source, not a local filter -->
<mlv-select searchable [searchFn]="searchUsers" [toOption]="userToOption" [searchDebounce]="300" />
```

> **A non-searchable select is untouched.** No search row, no `__empty` projection, roving focus (`activeIndex` pinned to `-1`, `highlightQuery` empty), the trigger keeps its combobox role at all times, and `filteredOptions` is `resolvedOptions`.

## Native select mode

Set `native` to `true` when the browser's native options picker is preferred (particularly on mobile), or to `'auto'` to use it below the shared `md` breakpoint. A bare `native` attribute is shorthand for `native="true"`; the default is `false`.

Native mode uses the component's normalized `[options]` data. A `group` becomes an `<optgroup>`, and `disabled` becomes a disabled `<option>`. `MlvSelectItemTemplate` and `MlvSelectSelectedTemplate` are ignored in this mode because native controls only render their native option content.

```html
<!-- Native picker on every viewport -->
<mlv-select native label="Country" [options]="countries" [(value)]="country" />

<!-- Native picker below md; custom dropdown above md -->
<mlv-select native="auto" label="Country" [options]="countries" [(value)]="country" />
```

---

## Testing

- Nx project: **`core-select`** (`libs/core/select/project.json`) — `yarn nx test core-select`. The leaf lib previously had specs but no test project (orphaned); wiring (`project.json`, `vite.config.mts`, `tsconfig*.json`, `src/test-setup.ts`) mirrors `core-list`.
- `test-setup.ts` stubs `window.matchMedia` to report a **desktop** viewport (`min-width` queries match), mirroring `libs/core/combobox/src/test-setup.ts`. jsdom has no `matchMedia`, so CDK's `BreakpointObserver` never emits and `MlvBreakpointService` stays pinned to its initial `'sm'` tier — which would make the default `mobileMode="auto"` resolve to the full-screen sheet in every spec and break the anchored-behaviour assertions (notably the searchable focus handoff). The full-screen specs opt in explicitly via `mobileMode="fullscreen"`, which ignores the breakpoint, so they are unaffected.
- `select.spec.ts` covers trigger accessibility, forms↔aria value bridging, the rendered listbox, option groups, clearing, and mobile fullscreen behavior.
- `describe('MlvSelect — default compareWith (unset by the consumer)')` (6 tests): the input resolves to the shared `defaultCompareWith` reference; an option written by reference selects; a structurally-equal value is **not** collapsed onto the option instance (reference equality, unlike the custom-comparator block below); a reconciliation emit that drops a non-rendered value is ignored; a genuine deselect of a rendered option still commits `null`; a multi-select pick re-adds the filtered-out committed value in committed order.
- `describe('MlvSelect — compareWith + reconciliation guard')` (5 tests): a structurally-equal written value normalises onto the option instance (`selectedValues()[0]` is the option object, `displayValue` is its label); the normalisation re-runs when options arrive **after** the value; an aria emit that only drops a value whose option is not rendered is ignored (value + selection intact); a genuine deselect of a rendered option still commits `null` in single-select; a genuine multi-select pick re-adds the committed value aria dropped only because it was not rendered.
- `describe('MlvSelect — value-vs-options cost')` (5 tests) guards the shared `_optionValueIndex`. Two are **absolute**: an empty selection costs **exactly zero** option reads per page append (the walk is progressive, so a control with nothing committed never reads the list at all — an eager build regresses this to one full walk per append), and a single committed value costs at most one walk of the accumulated options. The other three are differential: appending a page of options must cost the same whether 1 or 50 values are committed (a **differential** assertion, so no magic constant — a nested scan would add `49 × options` reads), reads stay under a small constant multiple of the accumulated option count across four page appends with 50 committed values, and a custom `compareWith` still pays its pairwise scan (comparator calls scale with the selection). The instrument is a counting `value` accessor on the options `toOption` produces, because `defaultCompareWith` cannot be wrapped in a spy without destroying the reference `valueIndex` recognises it by.
- `describe('MlvSelect — native option selection cost')` (5 tests) guards `_selectedValueIndex`, the selection-side index behind `_isNativeOptionSelected`: with 300 native options and 20 committed values, three successive selections each followed by five repaints (driven by an unrelated `[label]` input, so neither the selection nor the options change) walk each selection array **exactly 20 times** — once per selection change, never once per option per pass — while `selectedOptions` proves the per-option binding really re-ran and produced fresh output. A custom comparator still pays exactly `PASSES × (R(R+1)/2 + (V−R)R)` invocations, an exact figure that doubles as the evidence that a repaint re-runs all 300 bindings. A deliberately **asymmetric** comparator (true only when the first argument is a committed value and the second an option value) pins the `compare(selected, optionValue)` argument order — no symmetric comparator in this suite would notice a transposition. A committed `NaN` is never reported as selecting the `NaN` option under the `===` default, which a bare `Set` would get wrong. Finally, a `compareWith` **swapped at runtime** while the native branch renders (from `===` to a case-insensitive predicate) re-renders the selection — the one test that fails if `_isNativeOptionSelected` indexes the options instead of the selection.
- `describe('MlvSelect — option-side comparator argument order')` (2 tests) pins `compare(option.value, committedValue)` at the option-side sites with a deliberately **asymmetric** comparator, exactly as the combobox suite does; the `_selectedValueIndex` site is pinned separately (and in the opposite direction) by the asymmetric test above.
- `describe('MlvSelect — identity comparator edge values')` (7 tests) proves the SameValueZero bail end-to-end through `.mlv-select--loading` (which, with `[loading]` pinning `_ready()` false, shows exactly when `_allValuesMatched` is false): a committed `NaN` never matches a `NaN` option under `===` but does under `Object.is`; a committed `-0` matches a `+0` option under `===` **and takes the option's `+0` instance** (so `_applyPendingValues` is not the identity no-op it looks like), while under `Object.is` neither direction matches (hazard on the querying side, then on the keyed side); empty options and an empty selection.
- `describe('MlvSelect — async options + loading variant')` (10 tests): a preset value awaiting its label from an `Observable` source renders the loading variant (host class, `aria-busy`, `tabindex="0"`, the `mlv-loader` inside `.mlv-select__arrow`, the i18n loading text and no raw `[object …]` label) and `toggleDropdown()` cannot open it — then the emission resolves the real label, drops the class and `aria-busy`, and the trigger opens again; no value (or a value that already matches an option) never enters the variant; the panel's `__loading` spinner row shows inside the **open** dropdown while the source loads and gives way to the options without closing; the consumer's `[loading]` input drives both the variant and the panel spinner row inside an already-open dropdown; the clear X stays rendered while awaiting, `openDropdown()` still focuses the trigger there without opening, and `onClear()` ends the variant with a `null` value; a dropdown opened before the variant engaged still closes from its own trigger; a source swapping its items out from under an open panel leaves the committed value and the open state intact (the shared reconciliation guard); a paged `MlvDataSource` (local `PagedTagSource` stub, `perPage` 2 over 4 items, resolving only on an explicit `flush()`) shows the top spinner for page one, then 2 options + the sentinel, then the `__loading-more` row (options unchanged) while page two is in flight, then all 4 options; a `searchFn` with a preset value is called once with `''` **eagerly** (no open needed), holds the variant until its result contains the matching option, and is not re-run by a later `openDropdown()` (`ensureLoaded` idempotent); and trigger `keydown` `ArrowDown` / `Home` open the dropdown while an `ArrowDown` during the loading variant does not.
- `describe('MlvSelect — searchable')` (16 tests): the search row is inside `.mlv-popup__pinned`, precedes `.mlv-popup__scrollbar` in DOM order, is **not** inside `.mlv-scrollbar__viewport` (the listbox is), is focused after the popup opens (`document.activeElement.id === 'fruit-search'`) and shows the i18n placeholder; exactly one `role="combobox"` exists across the host **and** the overlay (trigger while closed, carrying `aria-required` from the host's `required` → search input while open, the trigger stepping down to `role="button"` while keeping `aria-expanded`/`aria-haspopup`/`aria-controls` and dropping only `aria-required`, which the search input now carries → `combobox` again on close); typing filters locally, emphasises the match (`.mlv-dropdown-panel__match`) and falls back to the `.mlv-select__empty` i18n row; a custom `matcher` (startsWith) narrows differently from the default substring match; an explicit `searchPlaceholder` beats the i18n default; ArrowDown drives `aria-activedescendant` + the `--active` highlight and Enter commits (single closes and refocuses the trigger); `Home`/`End` jump to the ends of the filtered list; multi-select Enter toggles the active option on then off and keeps the dropdown open; an option **click** still selects while the `.mlv-select__panel` wrapper swallows the `mousedown` (`defaultPrevented === true`), so the dropdown stays open with focus still in the search field; Escape closes and resets the query, and Tab closes and returns focus to the trigger; a remote `searchFn` is called with `''` on open then with each query, keeps stale options mounted under the `--loading` modifier without closing, and swaps them when the response lands; a response that **shrinks** the list past a navigated index (3 rows with the last active → 2 rows) clears `aria-activedescendant` and the next ArrowDown restarts at index 0 — discriminating, because a surviving stale index would wrap modulo the new count onto index 1 instead; grouped options keep their sticky headers with the pinned search row rendered outside the scroll region that holds the whole grouped listbox, and typing filters within the groups (one header survives); the polite `.mlv-select__sr-status` region announces `3 results available`, re-announces `1 result available` as the query narrows and `No results found` when it matches nothing; and a non-searchable select renders no search row and no `__empty` row, keeps `role="combobox"` + `aria-required` on its trigger, renders the listbox in roving mode (`tabindex="-1"`, no `aria-activedescendant`) and — critically — leaves the panel `mousedown` default **unprevented**. Because the popup's `afterClosed` only fires once the leave animation completes (jsdom never fires `animationend`), the close-path assertions drive it through a `finishClose()` helper, as the existing full-screen spec does.
- `describe('MlvSelect') > trigger accessibility` also pins that `openDropdown()` does **not** focus a disabled trigger (its `tabindex="-1"` would still accept programmatic focus) and does not open.
- `select-binding-matrix.spec.ts` proves `[formControl]`, `ngModel`, and `[formField]` value/touch/disabled behavior.

## Mobile fullscreen

The dropdown `mlv-popup` is wired to `[mobileMode]="mobileMode()"` (default `'auto'`) and `[mobileTitle]="_resolvedMobileTitle()"` (`mobileTitle` input → `label` → resolved placeholder). Below the `md` breakpoint (< 768px) the option list opens as a full-screen sheet with a header bar (title + close button), scroll-locked page, and slide-up animation; above it the dropdown stays trigger-anchored (byte-identical to before). The select trigger is a plain `role="combobox"` button and the popup is the whole interaction surface, so the popup's `cdkTrapFocus` (engaged when `isFullscreen()`) composes cleanly — selection / Escape / backdrop / X all close through the `opened` model, and `(afterClosed)="_onPopupClosed()"` restores focus to the trigger (and resets the search, when `searchable`). Consumers can override via the `mobileMode` / `mobileTitle` inputs (e.g. `mobileMode="off"` to keep the dropdown always anchored). See `libs-popup.md` → _Mobile fullscreen inputs_.

> **Contrast with `mlv-combobox`:** the combobox also supports full-screen mode (`mobileMode="auto"`), but composes it differently — its search `mlv-input` lives in the trigger row outside the overlay panel, so it projects an **in-sheet search input** into the popup's `[mlvPopupHeaderContent]` slot to keep type-to-filter working behind the sheet's solid backdrop + focus trap. `mlv-select`'s trigger is a plain button and its dropdown popup is the whole interaction surface, so it needs no header slot — even with `searchable`, whose search field is already inside the popup (in the `[mlvPopupPinnedContent]` slot, which renders under the sheet's header and inside its focus trap). See `libs-combobox.md` → _Mobile fullscreen (in-sheet search input)_.

## Inline clear (2026-07)

- `hasValue` = selection non-empty; `ownsClearButton = true`; `_showClear` gates the affordance (clearable + value + interactive). It is deliberately **not** gated on `_awaitingValueLabel()` — while the loading variant holds, every open path is inert, so the X is the only escape hatch for a source that never answers (combobox parity). See _Loading variant_.
- `onClear()` clears the selection, writes the collapsed forms value (`null` single / `[]` multi), and marks touched.
- The X is a DOM **sibling** of the `role="combobox"` trigger (a button nested inside it would trip nested-interactive), CSS-overlaid just before the chevron (`.mlv-select__clear`); the trigger reserves space via `--with-clear` padding.

---

## Field surface (2026-08)

- `ariaLabel` moved to `MlvSignalFormUiControlBase`; `MlvSelect` no longer declares it. Behaviour is unchanged: it is applied to the `role="combobox"` trigger only when no visible `label` is set (a visible label wins through `aria-labelledby`).
- Inherited `required` renders the `mlv-label` marker and sets `aria-required` on the trigger — and, while a **searchable** dropdown is open, on the in-dropdown search input instead (the element that owns `role="combobox"` then).
- Inherited `description` renders `<mlv-description>` below the control; the trigger's `aria-describedby` is the base's `_describedBy()`.
- `<mlv-message>` now carries `_messageId()`, so the describedby reference resolves.

---

## Dropdown panel accessible name (2026-08)

`mlv-dropdown-panel`'s inner `role="listbox"` is an ARIA input field (axe `aria-input-field-name`, WCAG 4.1.2) and needs its own accessible name — it is not implicitly named by the trigger it belongs to. `mlv-select` binds `[ariaLabel]="_panelAriaLabel()"` on its `<mlv-dropdown-panel>`, where `_panelAriaLabel` mirrors the trigger's own resolution: the visible `label` when set, else the explicit `ariaLabel` input — `null` when neither is set (same as an unlabelled trigger, an existing condition outside this fix's scope). Mirrors `mlv-combobox` and `mlv-filter` (which passes its field `label` directly).
