---
# Library: dropdown

Viewport sizing uses `DOCUMENT.defaultView` when available and skips browser
event subscriptions during server rendering.

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Dropdown library (`@malva-ui/core/dropdown`) provides a generic dropdown panel component and option utilities. It is primarily used as the content panel inside `MlvCombobox` and `MlvSelect`. Supports single and multiple selection, custom item templates, configurable height constraints, and the shared Malva themed scrollbar.

## Public API

Exported from `libs/forms/dropdown/src/index.ts`:

| Export | Kind | Description |
|--------|------|-------------|
| `MlvDropdownPanel<T>` | Component | Dropdown list panel — `mlv-dropdown-panel` |
| `MlvSelectOption<T>` | Interface | `{ label: string; value: T; group?: string; disabled?: boolean }` |
| `MlvSelectOptionTransform<T>` | Type | `(item: T) => MlvSelectOption<T>` |
| `defaultOptionTransform<T>` | Function | Converts item using `String(item)` as label |
| `isSelectOption<T>` | Function | Type-guard: value is `MlvSelectOption`-shaped (`label` + `value`) |
| `hasOptionGroups<T>` | Function | Type-guard: any option carries a non-empty `group` (drives grouped rendering) |
| `resolveOptions<T>` | Function | `(items: T[], transform) => MlvSelectOption<T>[]` |
| `MlvOptionMatcher<T>` | Type | `(option: MlvSelectOption<T>, query: string) => boolean` — suggestion filter predicate |
| `defaultOptionMatcher<T>` | Function | Case- and diacritic-insensitive substring match on the label |
| `filterOptions<T>` | Function | `(options, query, matcher?) => MlvSelectOption<T>[]` — shared substring filter (blank query returns all); results ranked prefix-matches-first via `rankPrefixMatchesFirst`. With the **default** matcher it runs a fused path that folds each label exactly once for both the `includes` test and the `startsWith` ranking; a **custom** matcher keeps the two-pass shape (predicate once per option, then `rankPrefixMatchesFirst`). Extracted from `mlv-combobox`; also powers `[mlvAutocomplete]` |
| `rankPrefixMatchesFirst<T>` | Function | Stable partition: labels starting with the query (case/diacritic-insensitive) rank before other matches, applied **within each consecutive group run** so grouped panels keep contiguous runs. Makes the top suggestion inline-completable |
| `normalizeForMatch` | Function | NFD-fold + strip diacritics + lower-case, with an ASCII fast path collapsing to `toLowerCase()` (excluding `^` and `` ` ``, the two ASCII `Diacritic=Yes` characters the full pipeline strips) (matching/highlighting normalisation); re-exported from `@malva-ui/cdk/utils`, which now owns the implementation |
| `matchSegments` | Function | `(label, query) => MlvMatchSegment[]` — splits a label around the first match (diacritic-aligned) for highlighting. A label of ASCII characters other than `^` / `` ` `` slices `label` directly; any other label needs the per-code-point folded projection, because those are exactly the labels whose fold is length-preserving |
| `MlvMatchSegment` | Interface | `{ text: string; matched: boolean }` |
| `optionId` | Function | `(listboxId, index) => string` — deterministic activedescendant option id (`<listboxId>-option-<index>`). Single source of truth for the format, shared by `MlvDropdownPanel.optionId`, `mlv-combobox`, and `[mlvAutocomplete]` so the rendered id and the trigger's `aria-activedescendant` never drift |
| `MlvActiveDescendant` | Class | Signal-backed active-option index bookkeeping for the activedescendant keyboard model: read-only `index` signal, `move(delta)` (wrap-around), `first`/`last`/`reset`; option count read lazily via a `() => number` constructor accessor. Extracted from the byte-identical `_moveActive` in `mlv-combobox` / `[mlvAutocomplete]`; now backs both |
| `MlvHighlightMatchPipe` | Pipe | `mlvHighlightMatch` — `label \| mlvHighlightMatch:query` → `MlvMatchSegment[]` |
| `MlvSelectDataSource<T>` | Class | `extends MlvArrayDataSource<T>` from `@malva-ui/cdk/data-source`, unpaged (`perPage = Infinity`) — the default in-memory data source for option controls |
| `toOptionsResult<T>` | Function | `(result: T[] \| Promise<T[]> \| Observable<T[]>) => Observable<T[]>` — normalises every supported search result into a one-shot observable. Moved here from `[mlvAutocomplete]`, which used to keep it private; shared by `MlvOptionsAdapter` and the directive |
| `MlvOptionsAdapter<T>` | Class | Normalises `T[] \| Observable<T[]> \| MlvDataSource<T>` (+ optional `searchFn`) into one reactive shape — `mode`, `items`, `loading`, `loadingMore`, `ready`, `hasMore`, `search()`, `ensureLoaded()`, `loadMore()` — with lazy page accumulation for a data source. Shared engine behind `mlv-select`, `mlv-combobox` and `[mlvAutocomplete]`; construct it in an injection context |
| `MlvOptionsAdapterConfig<T>` | Interface | `{ source, searchFn, debounce, eager }` — all `Signal`s, so a control passes its `input()`s straight through |
| `MlvOptionsInput<T>` | Type | `readonly T[] \| Observable<readonly T[]> \| MlvDataSource<T> \| null \| undefined` — everything an option control accepts as `options` |
| `MlvOptionsSearchFn<T>` | Type | `(query: string) => T[] \| Promise<T[]> \| Observable<T[]>` — remote search function |
| `MlvOptionsMode` | Type | `'local'` (consumer filters) \| `'remote'` (source filters, consumer calls `search()`) |
| `isReconciliationEmit<T>` | Function | `(incoming, committed, visible, compare) => boolean` — whether an aria listbox `valueChange` is pure reconciliation noise rather than a user selection (see below) |
| `filteredOutCommitted<T>` | Function | `(incoming, committed, visible, compare) => T[]` — committed values aria dropped only because their option is not rendered; re-added to a genuine multi-select pick |

---

## Components

### `MlvDropdownPanel<T>`

**File:** `libs/forms/dropdown/src/lib/dropdown-panel/dropdown-panel.ts`
**Template:** `libs/forms/dropdown/src/lib/dropdown-panel/dropdown-panel.html`
**Styles:** `libs/forms/dropdown/src/lib/dropdown-panel/dropdown-panel.scss`

- **Selector:** `mlv-dropdown-panel`
- **Change Detection:** `OnPush`
- **Encapsulation:** `None`

#### Inputs

| Name                      | Type                                                     | Default      | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------- | -------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `options`                 | `MlvSelectOption<T>[]`                                   | `[]`         | Options to display                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `multiple`                | `boolean`                                                | `false`      | Multi-select mode                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `selectedValues`          | `T[]`                                                    | `[]`         | Currently selected values                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `minHeight`               | `number`                                                 | `0`          | Minimum height in px                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `maxHeight`               | `number`                                                 | `0`          | Max height in px; `0` = 40% of viewport                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `itemTemplate`            | `TemplateRef<{ $implicit: MlvSelectOption<T> }> \| null` | `null`       | Custom item renderer                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `listboxId`               | `string \| null`                                         | `null`       | HTML `id` set on the inner `<mlv-list>` so a parent select/combobox can reference the listbox via `aria-controls`                                                                                                                                                                                                                                                                                                                                                                             |
| `ariaLabel`               | `string \| null`                                         | `null`       | Accessible name rendered as `aria-label` on the inner listbox. `role="listbox"` is an ARIA input field (axe `aria-input-field-name`, WCAG 4.1.2), so a panel not already named through an owning control needs one — `mlv-filter` passes its field label, and `mlv-select` / `mlv-combobox` each pass their own resolved trigger name (`_panelAriaLabel`: the visible `label`, else the explicit `ariaLabel` input). `null` renders no attribute — an unlabelled consumer's DOM is unchanged. |
| `focusMode`               | `'roving' \| 'activedescendant'`                         | `'roving'`   | Forwarded to the inner aria listbox. `'activedescendant'` keeps DOM focus on the owning trigger/input (used by `mlv-combobox`); `'roving'` moves focus onto the active option (used by `mlv-select`).                                                                                                                                                                                                                                                                                         |
| `activeIndex`             | `number`                                                 | `-1`         | Index of the activedescendant-active (highlighted) option; `-1` = none. Renders `.mlv-dropdown-panel__item--active` on that row and drives a deterministic option `id`.                                                                                                                                                                                                                                                                                                                       |
| `highlightQuery`          | `string`                                                 | `''`         | When non-empty, the default option row emphasises the matched substring of this query in each label (via `MlvHighlightMatchPipe` → `<mark class="mlv-dropdown-panel__match">`). Ignored for custom `itemTemplate` rows. Empty = plain label (unchanged). Used by `mlv-combobox` and `[mlvAutocomplete]`.                                                                                                                                                                                      |
| `loading`                 | `boolean`                                                | `false`      | Renders a loading affordance (spinner + `loadingText`, `role="status"`) above the list and suppresses the empty `<ng-content>` projection. Also sets the `--loading` host modifier and `aria-busy` on the listbox — previous options stay mounted, readable and interactive; the default row renders in the secondary text colour while loading (custom `itemTemplate` rows own their colours and are untouched).                                                                             |
| `loadingText`             | `string`                                                 | `'Loading…'` | Text announced inside both loading affordances (top row and `loadingMore` bottom row).                                                                                                                                                                                                                                                                                                                                                                                                        |
| `loadingMore`             | `boolean`                                                | `false`      | A page **beyond the first** is in flight: renders a polite `role="status"` row (`.mlv-dropdown-panel__loading-more`) after the last option and sets `aria-busy` on the listbox. Options stay interactive and are not dimmed.                                                                                                                                                                                                                                                                  |
| `hasMore`                 | `boolean`                                                | `false`      | Whether more pages exist. Arms the paging sentinel — see **Lazy-loading pagination** below.                                                                                                                                                                                                                                                                                                                                                                                                   |
| `infiniteScrollThreshold` | `number`                                                 | `150`        | Distance (px) from the end of the scroll owner at which `loadMore` fires.                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `scrollMode`              | `'self' \| 'parent'`                                     | `'self'`     | Selects the single scroll owner. Standalone panels render their own `mlv-scrollbar`; panels inside `mlv-popup` delegate scrolling to the popup to avoid nested scroll regions.                                                                                                                                                                                                                                                                                                                |

#### Outputs

| Name          | Type                   | Description                                                                             |
| ------------- | ---------------------- | --------------------------------------------------------------------------------------- |
| `valueChange` | `output<readonly T[]>` | Emits when selection changes                                                            |
| `loadMore`    | `output<void>`         | Emits when the user scrolls within `infiniteScrollThreshold` of the end while `hasMore` |

#### Host Bindings

```ts
host: {
  'class': 'mlv-dropdown-panel',
  '[class.mlv-dropdown-panel--parent-scroll]': 'scrollMode() === "parent"',
  '[class.mlv-dropdown-panel--loading]': 'loading()',
  '[style.max-height.px]': '_calculatedMaxHeight()',
}
```

`_calculatedMaxHeight` is computed from `maxHeight` input or `window.innerHeight * 0.4` as default.

`--loading` recedes the **default** option rows to `--mlv-text-secondary` (a contrast-validated token) rather than fading the listbox: the rows stay mounted, readable and clickable while a refresh resolves, and an opacity dim on live controls would fail WCAG 1.4.3. Custom `itemTemplate` rows own their colours and are untouched.

#### Lazy-loading pagination

A zero-height sentinel `<div class="mlv-dropdown-panel__sentinel" aria-hidden="true">` at the end of the panel content hosts `[mlvInfiniteScroll]` (`@malva-ui/cdk/infinite-scroll`) and re-emits its trigger as the panel's `loadMore`. The sentinel does not own the scrollbar, so it is pointed at the real scroll owner via `[scrollContainer]`:

- `scrollMode="self"` — the panel's own `mlv-scrollbar` viewport (`MlvScrollbar.viewportElement`).
- `scrollMode="parent"` — the nearest ancestor `.mlv-scrollbar__viewport`, i.e. the owning `mlv-popup`'s.

That element is resolved in `afterNextRender` (it does not exist earlier) into the `_scrollContainer` signal; until it resolves the sentinel is `[disabled]`, so the directive's initial `afterNextRender` measurement never runs against the non-scrolling panel host. The sentinel is also disabled while `!hasMore()`, and passes `[loading]="loading() || loadingMore()"` so a fetch in flight cannot trigger another.

**Dev-mode warning for a missing scroll owner.** In `scrollMode="parent"` the lookup finds nothing unless the panel really renders inside an `mlv-scrollbar` viewport — and an unresolved owner keeps the sentinel disabled, so lazy paging fails _silently_. Under `isDevMode()` the panel therefore `console.warn`s once per instance when `hasMore()` is `true`, the owner lookup has run (`_scrollOwnerResolved`), and `_scrollContainer()` is still `null`. It is an `effect` reading both signals (warning `untracked`, latched by `_warnedNoScrollOwner`), so a `hasMore` that flips true long after the first render is caught too. Never fires in `self` mode (the panel's own scrollbar always resolves) or while `hasMore` is `false`.

**Auto-fill.** An `afterRenderEffect` re-runs `MlvInfiniteScroll.check()` whenever the option set (or the sentinel's own armed state) changes, so a page too short to fill the scroll owner immediately requests the next one instead of stalling until the user scrolls. `MlvOptionsAdapter.loadMore()` is a no-op until the requested page has been applied, so repeated firing cannot skip a page.

Consumers bind `[loadingMore]`, `[hasMore]` and `(loadMore)` straight from `MlvOptionsAdapter` (`loadingMore`, `hasMore`, `loadMore()`).

#### Option groups (sticky headers)

When the resolved options declare groups — at least one option carries a non-empty `group` string (`hasOptionGroups()` → `_isGrouped`) — the panel clusters **consecutive same-group runs** under a sticky, non-selectable section header (APG listbox grouping):

- Each run is wrapped in `<div role="group" [attr.aria-labelledby]="headerId">`; the header is `<div role="presentation" [id]="headerId" class="mlv-dropdown-panel__group-header">` (uppercase, `position: sticky; top: 0` inside the active scroll owner: the panel's own `mlv-scrollbar` or its parent `mlv-popup` viewport).
- **Consecutive-run grouping (no reordering).** DOM order stays identical to the flat `options()` order, so option flat indices, `optionId(index)`, `activeIndex`, and aria's DOM-order navigation all stay aligned. A run of options with no `group` renders as a headerless cluster.
- Headers are **not** aria options: they are skipped by keyboard nav / type-ahead (never registered on the `Listbox`), excluded from a combobox's filtered result set (a header shows only while ≥1 of its options survives the filter), and never enter the value.
- Verified safe against `@angular/aria`'s `Listbox`: options register via DI (`inject(LISTBOX)`) and sort by `compareDocumentPosition` under a `subtree:true` MutationObserver, so nesting one level deep inside a `role="group"` div does not break registration, ordering, pointer `closest('[role="option"]')`, or navigation.
- **Ungrouped arrays are byte-for-byte unchanged** — the template branches to the exact previous flat `@for` when `_isGrouped()` is false (plain primitive arrays never carry a `group`).

The shared option-row markup lives in a single `<ng-template #optionRow>` **declared inside `<mlv-list>`** (so an outlet-ed `<mlv-list-item>` resolves the aria `LISTBOX` token from its declaration injector, not its insertion point), outlet-ed by both the flat and grouped branches with the option's flat `index`.

#### Template Summary

Renders a `mlv-list[selectable]` (backed by `@angular/aria`'s `ngListbox` after the Task 2.1 migration) through a shared `panelContent` template. With the default `scrollMode="self"`, that template is wrapped in `mlv-scrollbar`; with `scrollMode="parent"`, it renders directly into the owning popup scrollbar. The self-owned scrollbar viewport uses `viewportTabIndex="-1"` because the listbox already owns focus. Each `mlv-list-item[value]` renders either a custom `itemTemplate` or the default (label text + `LucideCheck` when selected). Options are optionally clustered under sticky group headers — see **Option groups** above.

The panel always has exactly one themed scroll owner. Standalone/autocomplete panels use their nested Malva scrollbar; select and combobox bind `scrollMode="parent"` and rely on `mlv-popup`'s scrollbar. The `--parent-scroll` modifier exposes overflow to that ancestor rather than clipping it. The panel pins the listbox to the previous CdkListbox behaviour and the correct listbox roles:

- `listRole="listbox"` on the `<mlv-list>` and `itemRole="option"` on each `<mlv-list-item>` — required so aria's pointer selection can resolve options via `closest('[role="option"]')`.
- `selectionMode="explicit"` + `[softDisabled]="false"` — arrow keys move focus without committing the value and skip disabled options.
- `[label]="option.label"` on each item — feeds aria's type-ahead search.
- `[disabled]="option.disabled ?? false"` on each item — forwarded to aria's `Option`, which renders `aria-disabled`; disabled options are skipped by keyboard navigation (see `[softDisabled]="false"` above) and cannot be selected.
- `[attr.aria-label]="ariaLabel()"` on the `<mlv-list>` — the accessible name for the listbox, absent unless a consumer sets `ariaLabel`.
- `[listboxId]="_resolvedListboxId()"` on the `<mlv-list>` — forwards the id into aria's `Listbox.id` input (re-exposed as `listboxId` by `MlvListSelectable`). aria renders it via `[attr.id]="id()"`, so the DOM id equals the value the parent select/combobox `aria-controls` points to. Binding the native `[id]` instead does **not** work — aria's own `[attr.id]` overrides it, minting a `ng-listbox-*` id and dangling `aria-controls`. `_resolvedListboxId()` is `listboxId()` when set, else a stable `mlvNextId('mlv-dropdown-listbox')` fallback so the listbox always carries a valid unique id.

The listbox sets `--mlv-list-padding-block` and `--mlv-list-padding-inline` so option rows keep x-axis breathing room inside select/combobox popups.

#### Styling — `--surface` modifier

`.mlv-dropdown-panel--surface` is an **opt-in** BEM modifier (in `dropdown-panel.scss`) that paints a standalone floating surface on the panel: `background-color: var(--mlv-background-raised)`, a `var(--mlv-stroke-width)` `var(--mlv-border-subtle)` hairline border, `border-radius: var(--mlv-radius-panel)`, `box-shadow: var(--mlv-shadow-floating)` — the same visual vocabulary as the `mlv-popup` surface, so an autocomplete popup reads identically to a combobox popup. It exists because `[mlvAutocomplete]` hosts the panel in a **bare CDK overlay** (nothing paints chrome), unlike `mlv-combobox` / `mlv-select`, which nest the panel inside a styled `mlv-popup`. The directive adds the class to the panel's host element after attach; the panel component itself is untouched. Combobox / select never receive the class, so their visuals are unaffected. The panel's host `[style.max-height.px]` bounds its self-owned `mlv-scrollbar`.

#### Styling — classes

| Class                               | Purpose                                                                                                                                                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `mlv-dropdown-panel--surface`       | Opt-in standalone floating surface — see above                                                                                                                                                                           |
| `mlv-dropdown-panel--parent-scroll` | `scrollMode="parent"` — overflow visible so the ancestor popup scrolls                                                                                                                                                   |
| `mlv-dropdown-panel--loading`       | Set while `loading()`; recedes `__item-label` / `__item-check` to `--mlv-text-secondary` (short `--mlv-duration-fast` colour transition, instant under `prefers-reduced-motion`). No opacity — the rows stay interactive |
| `mlv-dropdown-panel__loading`       | Top `role="status"` loading row                                                                                                                                                                                          |
| `mlv-dropdown-panel__loading-more`  | Bottom `role="status"` next-page row (`loadingMore`); shares one rule block with `__loading`, same spinner + `__loading-text` markup                                                                                     |
| `mlv-dropdown-panel__sentinel`      | Zero-height (`height: 0; overflow: hidden`) `aria-hidden` marker hosting `[mlvInfiniteScroll]`; never occupies layout                                                                                                    |

#### Public Methods

- `isValueSelected(value: T): boolean`
- `onValueChange(values: readonly T[]): void` — re-emits the aria listbox selection array (aria's `ngListbox` emits the values array directly; the previous `ListboxValueChangeEvent` wrapper is gone).

---

## Interfaces / Types

```ts
export interface MlvSelectOption<T = unknown> {
  label: string;
  value: T;
  /** Optional group label — clusters options under a sticky, non-selectable header. */
  group?: string;
  /** Whether the option is unavailable for selection. Skipped by keyboard navigation. */
  disabled?: boolean;
}

export type MlvSelectOptionTransform<T> = (item: T) => MlvSelectOption<T>;
```

---

## Utility Functions

```ts
// Default transform — uses String(item)
export function defaultOptionTransform<T>(item: T): MlvSelectOption<T>;

// Type-guard: MlvSelectOption-shaped value (label + value)
export function isSelectOption<T>(value: unknown): value is MlvSelectOption<T>;

// Type-guard: at least one option declares a non-empty `group` (drives grouped
// rendering). false for empty / ungrouped arrays, so ungrouped lists are unchanged.
export function hasOptionGroups<T>(options: readonly MlvSelectOption<T>[]): boolean;

// Map items array to MlvSelectOption array
export function resolveOptions<T>(items: T[], transform: MlvSelectOptionTransform<T>): MlvSelectOption<T>[];

// Deterministic activedescendant option id (`<listboxId>-option-<index>`).
// Canonical format owner — `MlvDropdownPanel.optionId`, `mlv-combobox`,
// and `[mlvAutocomplete]` all call this so the id never drifts.
export function optionId(listboxId: string, index: number): string;
```

### `MlvActiveDescendant` (activedescendant keyboard model)

Signal-backed active-option index bookkeeping shared by `mlv-combobox` and `[mlvAutocomplete]` (both previously carried a byte-identical `_moveActive`). The option count is read lazily via a constructor accessor, so the owner backs it with any signal/computed (e.g. `filteredOptions().length`, `_results().length`) without pushing the count on every keystroke.

```ts
class MlvActiveDescendant {
  /** Read-only active index; -1 = none. Reactive (template/effect) or imperative. */
  readonly index: Signal<number>;
  constructor(count: () => number);
  /** Advance by delta with wrap-around; a first move from -1 lands on first (delta>0) / last (delta<0); resets to -1 when count is 0. */
  move(delta: number): void;
  first(): void; // activate index 0; no-op when empty
  last(): void; // activate count-1; no-op when empty
  reset(): void; // clear back to -1
}
```

### `MlvSelectDataSource<T>`

`extends MlvArrayDataSource<T>` (`@malva-ui/cdk/data-source`) with `perPage` forced to `Infinity` in the constructor — the only override. Everything else (filtering, natural-field search via `setSearch({ query, keys: [] })`, sorting, `loading`) is inherited unchanged. Reach for it when option controls (`mlv-select`, `mlv-combobox`, `[mlvAutocomplete]`) want the data-source shape over an in-memory array so a swap to a remote subclass later is a one-line change; a plain `T[]` is still the simplest input when no data-source features are needed.

```ts
const ds = new MlvSelectDataSource(['a', 'b', 'c']); // or a Signal<T[]>
ds.perPage(); // Infinity
ds.connect()(); // ['a', 'b', 'c'] — unpaged
```

### Async result normalization (`options-result.ts`)

```ts
// Array / Promise / Observable → one-shot Observable<T[]>.
export function toOptionsResult<T>(result: T[] | Promise<T[]> | Observable<T[]>): Observable<T[]>;
```

Lived as a private helper inside `[mlvAutocomplete]` until every option control needed the same async boundary.

### Options adapter (`options-adapter.ts`)

`MlvOptionsAdapter<T>` normalises everything an option control accepts as `options` — plus an optional `searchFn` — into one reactive shape shared by `mlv-select`, `mlv-combobox` and `[mlvAutocomplete]`. **Construct it inside an injection context** (a component field initialiser or constructor): it creates `effect()`s and injects `DestroyRef`.

```ts
export type MlvOptionsSearchFn<T> = (query: string) => T[] | Promise<T[]> | Observable<T[]>;
export type MlvOptionsInput<T> = readonly T[] | Observable<readonly T[]> | MlvDataSource<T> | null | undefined;
export type MlvOptionsMode = 'local' | 'remote';

readonly adapter = new MlvOptionsAdapter<T>({
  source: this.options,      // Signal<MlvOptionsInput<T>>
  searchFn: this.searchFn,   // Signal<MlvOptionsSearchFn<T> | null | undefined>
  debounce: this.debounce,   // Signal<number> — remote searches only
  eager: this.eager,         // Signal<boolean> — searchFn('') at construction
});
```

**Config** (`MlvOptionsAdapterConfig<T>`) — every field is a `Signal`, so the control passes its `input()`s straight through:

| Field      | Type                                                 | Purpose                                                                           |
| ---------- | ---------------------------------------------------- | --------------------------------------------------------------------------------- |
| `source`   | `Signal<MlvOptionsInput<T>>`                         | The control's `options` input                                                     |
| `searchFn` | `Signal<MlvOptionsSearchFn<T> \| null \| undefined>` | Optional remote search; **supersedes `source`** when set                          |
| `debounce` | `Signal<number>`                                     | Debounce (ms) for `search()`; `0` runs immediately. Remote modes only             |
| `eager`    | `Signal<boolean>`                                    | `true` → `searchFn('')` runs at construction instead of on first `ensureLoaded()` |

**Signals**

| Signal        | Meaning                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `mode`        | `'local'` (consumer filters `items` itself) vs `'remote'` (source owns filtering — call `search()`, render `items` as-is) |
| `items`       | Current raw items — accumulated page slices for a data source                                                             |
| `loading`     | First page / search in flight — drives the panel's top loading affordance                                                 |
| `loadingMore` | A page **beyond the first** is in flight — drives the bottom loading row. Data source only                                |
| `ready`       | The first payload has arrived; lets a consumer tell "empty" from "not loaded yet"                                         |
| `hasMore`     | `items.length < totalItems()` — more pages exist. Data source only                                                        |

**Methods** — `search(query)` (debounced; no-op in local mode), `ensureLoaded()` (runs the initial `searchFn` load once, e.g. on first panel open), `loadMore()` (requests the next data-source page).

**Per-source semantics**

| Source                                | `mode`   | `items`                      | `loading`                         | `loadingMore`                   | `ready`                                 | `hasMore`                        | `search(q)`                                                                 |
| ------------------------------------- | -------- | ---------------------------- | --------------------------------- | ------------------------------- | --------------------------------------- | -------------------------------- | --------------------------------------------------------------------------- |
| `readonly T[]` / `null` / `undefined` | `local`  | the array (`[]` for nullish) | `false`                           | `false`                         | `true` immediately                      | `false`                          | no-op                                                                       |
| `Observable<readonly T[]>`            | `local`  | latest emission              | `true` until the first emission   | `false`                         | after the first emission                | `false`                          | no-op                                                                       |
| `MlvDataSource<T>`                    | `remote` | accumulated page slices      | `ds.loading() && ds.page() === 1` | `ds.loading() && ds.page() > 1` | once observed not-loading since connect | `items.length < ds.totalItems()` | `ds.setSearch({ query, keys: [] })`, or `null` for a blank/whitespace query |
| `searchFn` (wins over `source`)       | `remote` | last result (`[]` on error)  | while a call is in flight         | `false`                         | after the first result **or error**     | `false`                          | invokes `searchFn(q)`                                                       |

- Observable source: a **new observable reference** unsubscribes the old one, clears `items` and resets `ready` — a late emission from the previous observable is dropped.
- `searchFn`: a newer query supersedes an in-flight one (the older subscription is torn down and its result discarded by a monotonic token); **stale `items` stay visible until the new result lands**. Errors resolve to `[]` and end `loading` — they never leave the control stuck in a loading state. Only the first emission of an observable result is taken.
- `searchFn` is **lazy** by default: nothing runs until `ensureLoaded()` (or `search()`). `ensureLoaded()` replays the last `search()` query and is a no-op once a load has started. `eager: true` runs `searchFn('')` at construction.
- A **swapped `searchFn`** re-arms the lazy gate and **nothing else** — the next `ensureLoaded()` calls the new function (immediately, if `eager`). The in-flight call is left running and `items` / `ready` / `loading` are untouched, so results stay on screen until the new function answers (the same "stale results kept while loading" contract a newer query follows); a late result from the old function is discarded by the monotonic token once the new one starts. Clearing/reset semantics are deliberately absent because they would make the control sensitive to the _reference_ identity of the bound function, and an inline arrow (`[search]="(q) => api.find(q)"`) is a fresh reference on every change-detection run. The very first observation (`undefined → fn` at construction) is not a swap. Binding a stable function reference is still the recommendation — it is just no longer load-bearing for correctness.
- A `searchFn` **supersedes the source without connecting it**: a `MlvDataSource` passed alongside is left untouched (no `connect()`, no fetch). Clearing the `searchFn` hands the branch back to the data source, which connects then.

**Paging accumulation contract** (data source only) — `MlvDataSource.connect()` emits the **current page's slice**; the adapter is what turns slices into a growing list:

The adapter tracks the **applied page** (the page whose slice is currently in `items`) and the items accumulated _before_ it, then routes each new slice by comparing the source's page against it:

| Incoming slice                          | Result                                                                                                                                               |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| same slice reference as the one applied | **nothing applied** — a `page` bump whose data has not arrived yet must not append                                                                   |
| `page <= 1`                             | **replaces** `items`; accumulation restarts                                                                                                          |
| `page === appliedPage`                  | the page already shown was re-emitted (backing array changed, refetch landed) → its **tail is replaced**, never appended, so rows are not duplicated |
| `page > appliedPage`                    | **appended** to the accumulated items                                                                                                                |

- `loadMore()` calls `setPage(page + 1)` and is a **no-op** unless `hasMore()`, nothing is in flight, **and the source's page is the one already applied**. A page requested but not yet accumulated blocks the next bump, so a scroll sentinel firing repeatedly cannot skip a page — including for sources that never report `loading` (`MlvArrayDataSource` / `MlvSelectDataSource`), where the loading flag alone would guard nothing.
- A same-page re-emit replaces **only the last applied page's tail** — the pages accumulated before it are kept as-is and never refreshed. By design: the adapter holds no per-page provenance for earlier slices, and a paged source that mutates an earlier page is expected to reset (a new search / a fresh source), which restarts accumulation from page 1.
- `setSearch()` resets the source to page 1 (base-class behaviour), so the next slice replaces rather than appends — accumulation restarts per search, and `loadMore()` stays blocked until it lands. Stale items stay visible while that search is in flight.
- Reconnecting (a new `source`, or a `searchFn` being cleared) resets `items`, `ready` and all the accumulation bookkeeping.

### aria reconciliation guard (`reconciliation.ts`)

`@angular/aria`'s `ngListbox` reconciles its `value` model against the currently **rendered** options and re-emits `valueChange` whenever the rendered set changes — not only on user interaction. Any control that filters the panel's options while a selection is committed (`mlv-combobox` today, `mlv-select` once it filters) must tell that noise apart from a genuine pick, or typing wipes the committed value. Both helpers are pure: the owner passes the currently visible option **values** and its own `compareWith`.

```ts
// True when the emit (a) adds no value that is not already committed and
// (b) only removes values whose option is currently not rendered. An emit that
// exactly restates the committed selection counts as reconciliation too.
export function isReconciliationEmit<T>(incoming: readonly T[], committed: readonly T[], visible: readonly T[], compare: (a: T, b: T) => boolean): boolean;

// Committed values aria dropped only because their option is not rendered (and
// that are not incoming) — re-add them to a genuine multi-select pick so
// earlier selections survive filtering.
export function filteredOutCommitted<T>(incoming: readonly T[], committed: readonly T[], visible: readonly T[], compare: (a: T, b: T) => boolean): T[];
```

`mlv-combobox` keeps its private `_isReconciliationEmit` / `_filteredOutCommitted` method names and delegates to these, passing `filteredOptions().map((o) => o.value)` as `visible`.

---

## Testing

- Nx project: **`core-dropdown`** — `yarn nx test core-dropdown`.
- `select-data-source.spec.ts` (5 tests): unpaged by default (`perPage = Infinity`, full list through `connect()`, `totalItems`), natural-field search with empty `keys`, follows a signal-backed array, never reports `loading`, still pageable if a consumer calls `setPerPage`.
- `dropdown-panel.spec.ts` (26 tests): activedescendant option ids / active highlight; `ariaLabel` names the inner listbox and is absent by default; self-owned themed `mlv-scrollbar` integration with its viewport removed from the composite widget's tab order; parent-scroll delegation renders the listbox without a nested scrollbar; **option groups** — one `role="group"` per consecutive run, `aria-labelledby` → presentational sticky header, headers excluded from `role="option"`, flat option-id alignment preserved across groups, flat `activeIndex` highlight when grouped, ungrouped arrays render with no group wrapper, headerless clusters for options without a `group`; plus **match highlighting** (`highlightQuery` wraps the matched substring in `<mark>` without changing label text) and the **loading affordance** (`loading` renders a `role="status"` row with `loadingText` and suppresses the empty projection). **Loading recede + paging** (7 tests): `loading` adds the `--loading` host modifier and `aria-busy` on the listbox while the options stay rendered (both cleared when it flips back); `loadingMore` renders the polite bottom `__loading-more` row with `loadingText`, no top row, and `aria-busy`; the sentinel emits `loadMore` exactly once when the scroll owner is scrolled within threshold while `hasMore` (and stays silent on the arming render); the auto-fill re-measure fires when an appended page still does not fill the scroll owner; `loadingMore` gates the sentinel (near-end scroll emits nothing until the page lands); a non-default `infiniteScrollThreshold` of 400 ignores a 500px distance and fires at 350px; nothing is emitted when `hasMore` is false. The paging tests stub `scrollHeight`/`clientHeight` on the panel's `.mlv-scrollbar__viewport` — jsdom reports `0` for every layout box, which otherwise reads as "already at the end" — and share an `arm()` helper that renders, stubs an overflowing-but-at-top viewport, and flips `hasMore`. **Parent-mode paging** (1 test): a `ParentScrollHost` renders the panel with `scrollMode="parent"` inside an `mlv-scrollbar`; the panel renders no scrollbar of its own, `_scrollContainer()` resolves to the **wrapping** `.mlv-scrollbar__viewport`, and scrolling that viewport within threshold emits `loadMore` exactly once (silent while parked at the top). **Missing scroll owner** (3 tests, `console.warn` spied): parent mode with no scrollbar ancestor warns once when `hasMore` flips true (and never again for that instance), stays silent while `hasMore` is false, and stays silent in self mode.
- `option-matcher.spec.ts` (62 tests): `normalizeForMatch`, `defaultOptionMatcher` (case/diacritic-insensitive, blank-query-matches-all), `filterOptions` (blank returns a copy, default + custom matcher), `matchSegments` (blank, mid/leading match, diacritic alignment, no-match). **Fast-path equivalence** — the file keeps verbatim copies of the pre-fast-path `normalizeForMatch` / `matchSegments` as oracles and asserts deep-equal output across a 20-case table (pure ASCII, accented label with ASCII and accented queries, marks already in NFD, emoji / surrogate pairs, match at index 0, match at the last character, whole-label match, empty label, empty and whitespace-only query, no-match, repeated substring, an ASCII label against a query folding to non-ASCII, a query folding to nothing, and eight `^`/`` ` `` cases — the two ASCII `Diacritic=Yes` code points, which the full pipeline strips, so an ASCII label carrying one is _not_ index-aligned with its fold and must not take the direct-slice path). **Fast-path guards** — a `traceNormalize` helper (reading the call count _before_ `mockRestore()`, which clears it) asserts an ASCII label + ASCII query causes zero `String.prototype.normalize` calls and a non-ASCII label exactly one, and a `^`-bearing ASCII label at least one; a `traceFolds` helper traces every `String.prototype.toLowerCase` receiver and asserts the ASCII label is folded once rather than once per code point, and that `filterOptions` with the default matcher folds each label (and the query) exactly once rather than twice. **Custom matcher** — invoked once per option with the trimmed query, in order, with ranking still applied. **Group runs** — two non-consecutive runs of the same group never merge, through both `rankPrefixMatchesFirst` and the fused `filterOptions` path; a missing `group` and an empty-string `group` are one run (`?? ''`); empty input returns an empty array. One test pins a **pre-existing surrogate-pair quirk** in the slow path (`folded` grows by code units while `originIndex` grows by code points, so a surrogate-pair query over-selects one code point) — locked in deliberately because this change is required to be output-identical.
- `active-descendant.spec.ts` (16 tests): `optionId` format (`<listboxId>-option-<index>`, panel-id parity); `MlvActiveDescendant` — start at `-1`, `move` wrap-around (first/last from `-1`, forward/backward wrap, count-0 → reset, lazy/live count), `first`/`last` (activate, no-op when empty, live count), `reset`.
- `highlight-match.pipe.spec.ts` (3 tests): nullish label, segmentation, empty query.
- `options-result.spec.ts` (3 tests): `toOptionsResult` normalises an array, a Promise, and an Observable to the same one-shot emission (moved here with the helper from `core-autocomplete`).
- `options-adapter.spec.ts` (21 tests): array source (local, ready, `items`, nullish → `[]`, `search()` no-op); observable source (loading until first emission, latest emission wins, reference change re-subscribes / resets `ready` / drops late emissions from the old observable); `MlvDataSource` (`MlvSelectDataSource` → remote, ready immediately, `setSearch({ query, keys: [] })` and `null` for a blank query; a paged remote stub → loading until the first slice, `loadMore()` accumulates pages, `loadingMore` vs `loading`, stale items kept, exhausted/in-flight `loadMore()` is a no-op, a new search resets to page 1; `debounce` coalesces rapid `search()` calls); **paging edge cases** — a double `loadMore()` on an in-memory source (which never reports `loading`) does not skip page 2, a re-emit of the applied page replaces its tail instead of duplicating rows, and `loadMore()` stays blocked until the requested page is applied then allows the next; `searchFn` (remote, lazy until `ensureLoaded()`, `eager` loads at construction, newer query supersedes an in-flight one, errors → `[]` + `ready`, arrays / Promises / Observables, a swapped function only re-arms the lazy gate — the previous result and `ready` survive until the new function answers, and it is invoked exactly once while the old one is never re-invoked — re-binding an _equivalent_ arrow twice leaves an in-flight call untouched and its result still applies, and a data source passed alongside is never connected). Adapters are built with `runInInjectionContext(TestBed.inject(Injector), …)` and effects flushed with `TestBed.tick()`; `RemoteStub` counts both requests and `connect()` calls.
- `reconciliation.spec.ts` (6 tests): `isReconciliationEmit` — true when nothing is added and every removed value is filtered out of view, true when the emit restates the committed selection, true for the empty-options initial load, false when a value is added, false when a still-visible value is removed (genuine deselect); `filteredOutCommitted` returns committed values that are neither incoming nor visible (empty when all are visible).

---

## Usage Example

```html
<mlv-dropdown-panel [options]="options()" [selectedValues]="selected()" [multiple]="false" (valueChange)="onSelect($event)" />
```

---

## Dependencies

- `@malva-ui/core/list` — `MlvList`, `MlvListItem`, `MlvListSelectable`, `MlvListItemSelectable` (the listbox accessibility now comes from `@angular/aria` via these list directives; the panel no longer imports `@angular/cdk/listbox` directly)
- `@malva-ui/core/form-utils` — `MlvSelectionService`
- `@malva-ui/core/scrollbar` — themed vertical scrolling without adding another composite-widget tab stop; its `viewportElement` getter is the sentinel's scroll owner in `scrollMode="self"`
- `@malva-ui/cdk/infinite-scroll` — `MlvInfiniteScroll` on the paging sentinel (`scrollContainer`, `threshold`, `check()`)
- `@malva-ui/cdk/utils` — `mlvNextId` (stable fallback id for the inner listbox when no `listboxId` is supplied), `normalizeForMatch` (re-exported for existing consumers; implementation now lives here)
- `@malva-ui/cdk/data-source` — `MlvArrayDataSource`, extended by `MlvSelectDataSource`; `MlvDataSource` + `MlvSearchState`, the paged/remote branch of `MlvOptionsAdapter`
- `@lucide/angular` — `LucideCheck` icon
