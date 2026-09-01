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
| `matchSegments` | Function | `(label, query) => MlvMatchSegment[]` — splits a label around the first match (diacritic-aligned) for highlighting. A label of ASCII characters other than `^` / `` ` `` slices `label` directly; any other label needs the folded projection, because those are exactly the labels whose fold is length-preserving. That projection is built per code point but its origin map is keyed per folded **code unit** (an astral code point contributes two entries), so `originIndex.length === folded.length` and the code-unit search maths stays aligned on emoji / CJK-extension / math-alphanumeric labels |
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
| `defaultCompareWith<T>` | Function | `(a, b) => a === b` — the shared default behind every option control's `compareWith` input (`mlv-select`, `mlv-combobox`). A single module-level reference, so the guards below **and** `valueIndex` can recognise it and take their keyed fast path |
| `isReconciliationEmit<T>` | Function | `(incoming, committed, visible, compare) => boolean` — whether an aria listbox `valueChange` is pure reconciliation noise rather than a user selection (see below) |
| `filteredOutCommitted<T>` | Function | `(incoming, committed, visible, compare) => T[]` — committed values aria dropped only because their option is not rendered; re-added to a genuine multi-select pick |
| `valueIndex<T>` | Function | `(source, compare, project?) => MlvValueIndex<T>` — indexes a haystack for repeated membership / resolution queries, replacing the nested `queries × source` scan the option controls ran per option-list change (see below). Builds nothing until the first query |
| `MlvValueIndex<T>` | Interface | `{ has(value): boolean; resolve(value): T }` — exactly `source.some((c) => compare(project(c), value))` and `source.find(...) ?? value`. The keyed container behind them is built once, on first query; the methods themselves are not per-query memoised |

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

Renders a `mlv-list[selectable]` (backed by `@angular/aria`'s `ngListbox` after the Task 2.1 migration) through a shared `panelContent` template. With the default `scrollMode="self"`, that template is wrapped in `mlv-scrollbar`; with `scrollMode="parent"`, it renders directly into the owning popup scrollbar. The self-owned scrollbar viewport binds `[viewportTabIndex]="-1"` because the listbox already owns focus — an explicit "never a tab stop", not the `null` default, so a panel in its loading / empty state (no focusable children at all) cannot be pulled into the tab order by native browser scroller focusability. Each `mlv-list-item[value]` renders either a custom `itemTemplate` or the default (label text + `LucideCheck` when selected). Options are optionally clustered under sticky group headers — see **Option groups** above.

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

`mlv-combobox` keeps its private `_isReconciliationEmit` / `_filteredOutCommitted` method names and delegates to these. Both take the visible set as a parameter, so `selectValues` derives `filteredOptions().map((o) => o.value)` **once per emit** (`_visibleValues()`) and passes it to both — it used to be re-mapped inside each guard.

#### Identity fast path (`defaultCompareWith`)

One rule, stated once — `hazardOf()` in `reconciliation.ts` — and consumed by both the reconciliation guards (`Set`-based, below) and `valueIndex` (`Map`-based, further below). Nothing else in the repo restates it.

`ngListbox` re-emits `valueChange` on every rendered-set change, i.e. every filter keystroke, and both helpers were nested linear scans: R committed × V visible `compare()` calls each. With `compare` identical **by reference** to `defaultCompareWith` or to `Object.is`, they instead build one SameValueZero `Set` per input array and test membership — O(R + V). A caller-supplied comparator keeps the pairwise path unchanged, byte for byte, and pays for no extra scan (the reference check fails first).

This is why `mlv-select` and `mlv-combobox` default their `compareWith` input to the exported `defaultCompareWith` instead of a per-instance inline arrow: `input()` evaluates its default per component instance, so an inline `(a, b) => a === b` is a fresh reference per control and can never be recognised. Observable behaviour is identical — it is the same `===`.

**The SameValueZero hazard.** `Set` membership is SameValueZero, which matches _neither_ comparator:

|                       | `NaN` vs `NaN` | `+0` vs `-0` |
| --------------------- | -------------- | ------------ |
| `===`                 | not equal      | equal        |
| `Object.is`           | equal          | not equal    |
| SameValueZero (`Set`) | equal          | equal        |

`===` and SameValueZero differ on exactly one pair, `(NaN, NaN)`; `Object.is` and SameValueZero on exactly `(+0, -0)` and `(-0, +0)`. `hazardOf(compare)` returns the predicate for that one value — `isNaNValue` for `===`, `isNegativeZero` for `Object.is`, `null` for anything else — and `identitySets` applies it while it builds the sets (one pass it was doing anyway), returning `null` on a hit and dropping both helpers back to the pairwise path. With the hazard absent from every input, no differing pair can be formed and the two relations coincide on the values present, so the `Set` is exact.

**All three arrays are scanned**, including ones only used as query values: for `Object.is`, a `-0` on the querying side is as hazardous as one inside a set (`+0` in the set, `-0` queried — SameValueZero says present, `Object.is` says absent). Object and reference values behave identically under all three relations, so the common case never trips the guard.

`filteredOutCommitted` filters the `committed` **array** (never a set), so its result keeps committed order and duplicates — load-bearing, because callers spread it as `[...incoming, ...filteredOutCommitted(...)]`.

### `valueIndex` — value-vs-options membership without a nested scan

```ts
export interface MlvValueIndex<T> {
  /** `values.some((candidate) => compare(candidate, value))`. */
  has(value: T): boolean;
  /** `values.find((candidate) => compare(candidate, value)) ?? value`. */
  resolve(value: T): T;
}

export function valueIndex<T>(source: readonly T[], compare: (a: T, b: T) => boolean): MlvValueIndex<T>;
export function valueIndex<S, T>(source: readonly S[], compare: (a: T, b: T) => boolean, project: (item: S) => T): MlvValueIndex<T>;
```

The `project` overload exists for laziness, not convenience. Mapping at the call site (`valueIndex(options.map((o) => o.value), compare)`) walks the whole accumulated list on every rebuild whether or not anything is ever queried — which is precisely the eager cost the lazy build removes. Passing the projection in defers it; the pairwise path then reaches through `project` per candidate, which is what the scans being replaced always did.

Both methods are **defined by the pairwise scan they replace** — including `resolve`'s `?? value` tail, which returned the query value when the matched option's own value was nullish. An index is observationally indistinguishable from the scan; only its cost differs.

Built for the option controls, which each cross-check their committed selection against the resolved option list from several places at once:

| Control        | Index                 | Haystack               | Sites                                                      |
| -------------- | --------------------- | ---------------------- | ---------------------------------------------------------- |
| `mlv-combobox` | `_optionValueIndex`   | resolved option values | `_allValuesMatched`, `_chipOptions`, `_applyPendingValues` |
| `mlv-select`   | `_optionValueIndex`   | resolved option values | `_allValuesMatched`, `_applyPendingValues`                 |
| `mlv-select`   | `_selectedValueIndex` | committed selection    | `_isNativeOptionSelected`                                  |

**Which side you index is not a free choice.** `valueIndex` applies `compare(indexedValue, queriedValue)`, so the haystack must be whichever side the original scan passed as `compare`'s **first** argument. The option-side sites call `compare(option.value, committedValue)`; `_isNativeOptionSelected` calls `compare(selected, value)` and therefore indexes the selection. Getting this backwards transposes a consumer's `compareWith`, which is under no obligation to be symmetric — and no symmetric test comparator would ever notice.

Most of those were nested `selected × options` scans, and `resolvedOptions()` is the **accumulated** lazily-paged list — so every page append re-ran every scan over the whole accumulated list and a scroll session cost O(selected × options²) in total. Each control now holds a single `_optionValueIndex` computed (`valueIndex(resolvedOptions(), compareWith(), (o) => o.value)`) that rebuilds once per option-list or comparator change and serves all of them. `mlv-select`'s `_selectedValueIndex` is separate because it is keyed on a different signal (the selection) and rebuilds independently; its site is a template **method**, so it re-ran per option on every change-detection pass rather than only on signal changes.

**Strategy**, chosen once from `compare` alone via the same `hazardOf()`:

| `compare`                                                              | Container                                                        | Query cost                                           |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------- |
| `defaultCompareWith` / `Object.is`                                     | first-wins SameValueZero `Map`, grown to the walk cursor         | O(1) inside the prefix; resumes the walk beyond it   |
| a caller-supplied `compareWith`                                        | none                                                             | pairwise scan, unchanged                             |
| a recognised comparator, once the walk **passes** a hazard in `values` | latched off permanently — the prefix is abandoned, not consulted | pairwise scan, unchanged, for every subsequent query |

Note the third row is now reached _lazily_: a hazard sitting past the point the cursor ever reaches never disqualifies anything, because the values before it are all the index ever needed. `hazardOf(compare)` stays **eager** — it reads the comparator alone, needs no walk, and the strategy must be decided before the first query.

First-wins insertion is load-bearing: `resolve` is specified as `Array.prototype.find`, which returns the **earliest** match, so a later duplicate key must not overwrite an earlier one. `Map.set` on an existing SameValueZero key replaces the **value** while keeping the original key, so the `has` guard before each `set` is what keeps `resolve(0)` returning `+0` from `[+0, -0]` under `===` — and the walk has to actually reach the `-0` for that to be exercised at all.

**A hazard on the querying side is handled per query**, not by disqualifying the index: under `Object.is` a queried `-0` would be conflated with a keyed `+0` by SameValueZero, so that one query falls back to the pairwise scan and every other query stays O(1). (This is where `valueIndex` differs in _shape_ from `identitySets`, which pre-scans all three of its arrays because a caller consumes the sets directly. The rule they apply is the same function.)

Under `===` no such per-query fallback is needed for `±0`: `===` conflates the zeros exactly as SameValueZero does, so a `Map` reproduces `find` faithfully — a queried `-0` correctly resolves onto the indexed `+0` **instance**, which is why `_applyPendingValues` is _not_ the identity no-op it looks like under the default comparator.

**The walk is progressive.** Nothing is read until the first query; a query stops the walk at the first match, exactly where `find`/`some` would have stopped; and values passed on the way are materialised into a `Map` as the cursor advances. So a later query landing inside the built prefix is O(1), one landing beyond it resumes from the cursor, and **every element is read at most once for the life of the index**. A control with nothing committed still asks for the index on every option-list change and pays nothing at all.

Stopping early matters because the constants are not comparable: one `Map` entry costs **~26–32ns** against **~0.9–1.6ns** for a `===` step (measured, string keys, Node 22 — roughly a 20–29× ratio depending on machine). A full build is not something to pay speculatively, which is why an eager build — and even a lazy-but-build-it-all one — is the wrong shape here.

Hazards keep the semantics provable. A hazard **in the source** is latched the moment the walk passes it: the index reverts to the pairwise scan permanently and stops consulting the prefix. All-or-nothing, because a `Map` hit is sound only while the built prefix is hazard-free; answers already returned from that prefix were correct when they were returned. A hazard on the **querying** side still costs only that one query (below).

**Measured** on the controls' own shape — 5,000 options accumulated in 100-option pages, 50 appends, three checks re-run per append, default comparator, element reads counted outside the comparator so the pairwise path is not penalised by instrumentation:

| Committed values | Matches spread through the list | Matches clustered at the head | All queries miss (not yet paged in) |
| ---------------- | ------------------------------- | ----------------------------- | ----------------------------------- |
| 0                | 0 → 0 reads                     | 0 → 0 reads                   | 0 → 0 reads                         |
| 1                | 285,075 → 95,025; 0.26×         | 150 → 50; 0.83×               | 382,500 → 127,500; 0.15×            |
| 10               | 2,238,315 → 127,053; 1.15×      | 8,250 → 500; 0.87×            | 2,677,500 → 127,500; 1.25×          |
| 20               | 4,363,130 → 127,352; 2.14×      | 31,500 → 1,000; 1.08×         | 5,227,500 → 127,500; 2.59×          |
| 50               | 10,730,075 → 127,451; **4.9×**  | 191,250 → 2,500; **2.1×**     | 12,877,500 → 127,500; **4.0×**      |

Comparator invocations under either identity comparator go to **0** once the prefix answers; a custom `compareWith` keeps exactly its original count (10,730,075 at 50 spread) and does not regress — it never enters the keyed path at all. Note that instrumenting the comparator to count invocations adds work to the pairwise path _only_, so any wall-clock ratio measured that way flatters the fast path; the timings above keep the counters out of the comparator, and the invocation counts are unaffected either way.

**Where it loses, stated plainly.** Queries that all miss force the walk to the end, materialising the whole source where the pairwise scan would merely have read it. Measured break-even is about **7–8 all-miss queries** — below that the plain scan is cheaper, above it the index wins (1.25× at 10, 2.6× at 20). The same shape explains the `1`-committed column: a single mid-list match still materialises everything before it. Both are the transient state where a control's committed values have not been paged in yet, both are bounded by one walk of the source, and neither is the state a scroll session spends its time in. (An earlier revision built the map eagerly on first touch; that cost 127,500 reads even at zero selected, and was ~6× _slower_ than the original on head-clustered matches. Both regressions are gone.)

---

## Testing

- Nx project: **`core-dropdown`** — `yarn nx test core-dropdown`.
- `select-data-source.spec.ts` (5 tests): unpaged by default (`perPage = Infinity`, full list through `connect()`, `totalItems`), natural-field search with empty `keys`, follows a signal-backed array, never reports `loading`, still pageable if a consumer calls `setPerPage`.
- `dropdown-panel.spec.ts` (26 tests): activedescendant option ids / active highlight; `ariaLabel` names the inner listbox and is absent by default; self-owned themed `mlv-scrollbar` integration with its viewport removed from the composite widget's tab order; parent-scroll delegation renders the listbox without a nested scrollbar; **option groups** — one `role="group"` per consecutive run, `aria-labelledby` → presentational sticky header, headers excluded from `role="option"`, flat option-id alignment preserved across groups, flat `activeIndex` highlight when grouped, ungrouped arrays render with no group wrapper, headerless clusters for options without a `group`; plus **match highlighting** (`highlightQuery` wraps the matched substring in `<mark>` without changing label text) and the **loading affordance** (`loading` renders a `role="status"` row with `loadingText` and suppresses the empty projection). **Loading recede + paging** (7 tests): `loading` adds the `--loading` host modifier and `aria-busy` on the listbox while the options stay rendered (both cleared when it flips back); `loadingMore` renders the polite bottom `__loading-more` row with `loadingText`, no top row, and `aria-busy`; the sentinel emits `loadMore` exactly once when the scroll owner is scrolled within threshold while `hasMore` (and stays silent on the arming render); the auto-fill re-measure fires when an appended page still does not fill the scroll owner; `loadingMore` gates the sentinel (near-end scroll emits nothing until the page lands); a non-default `infiniteScrollThreshold` of 400 ignores a 500px distance and fires at 350px; nothing is emitted when `hasMore` is false. The paging tests stub `scrollHeight`/`clientHeight` on the panel's `.mlv-scrollbar__viewport` — jsdom reports `0` for every layout box, which otherwise reads as "already at the end" — and share an `arm()` helper that renders, stubs an overflowing-but-at-top viewport, and flips `hasMore`. **Parent-mode paging** (1 test): a `ParentScrollHost` renders the panel with `scrollMode="parent"` inside an `mlv-scrollbar`; the panel renders no scrollbar of its own, `_scrollContainer()` resolves to the **wrapping** `.mlv-scrollbar__viewport`, and scrolling that viewport within threshold emits `loadMore` exactly once (silent while parked at the top). **Missing scroll owner** (3 tests, `console.warn` spied): parent mode with no scrollbar ancestor warns once when `hasMore` flips true (and never again for that instance), stays silent while `hasMore` is false, and stays silent in self mode.
- `option-matcher.spec.ts` (77 tests): `normalizeForMatch`, `defaultOptionMatcher` (case/diacritic-insensitive, blank-query-matches-all), `filterOptions` (blank returns a copy, default + custom matcher), `matchSegments` (blank, mid/leading match, diacritic alignment, no-match). **Fast-path equivalence** — the file keeps verbatim copies of the pre-fast-path `normalizeForMatch` / `matchSegments` as oracles and asserts deep-equal output across a 26-case table (pure ASCII, accented label with ASCII and accented queries, marks already in NFD, match at index 0, match at the last character, whole-label match, empty label, empty and whitespace-only query, no-match, repeated substring, an ASCII label against a query folding to non-ASCII, a query folding to nothing, and eight `^`/`` ` `` cases — the two ASCII `Diacritic=Yes` code points, which the full pipeline strips, so an ASCII label carrying one is _not_ index-aligned with its fold and must not take the direct-slice path). **Fast-path guards** — a `traceNormalize` helper (reading the call count _before_ `mockRestore()`, which clears it) asserts an ASCII label + ASCII query causes zero `String.prototype.normalize` calls and a non-ASCII label exactly one, and a `^`-bearing ASCII label at least one; a `traceFolds` helper traces every `String.prototype.toLowerCase` receiver and asserts the ASCII label is folded once rather than once per code point, and that `filterOptions` with the default matcher folds each label (and the query) exactly once rather than twice. **Custom matcher** — invoked once per option with the trimmed query, in order, with ranking still applied. **Group runs** — two non-consecutive runs of the same group never merge, through both `rankPrefixMatchesFirst` and the fused `filterOptions` path; a missing `group` and an empty-string `group` are one run (`?? ''`); empty input returns an empty array. **Astral (surrogate-pair) code points** (11 tests) — regression cover for issue #58: the folded projection now pushes one `originIndex` entry per code _unit_, so `originIndex.length === folded.length` holds for every input. Covered: an emoji in both label and query, a bare astral query, an astral code point before / inside / spanning the match, several astral code points at once (a single-code-point off-by-one would not pass), a wholly-matched astral label (neither surrounding segment), astral + precomposed and decomposed accents in one label, a label of only astral code points, non-emoji astral (CJK ext. B U+2000B, math alphanumeric U+1D54F), and a no-match that must not corrupt the label. The equivalence oracle is **kept but no longer total**: it still encodes the pre-#58 desync, so astral inputs are excluded from its table (with a comment) and asserted against explicit expected output instead — the ASCII / accented / `^`-`` ` `` cases it does cover are what proves the fast path unchanged. **Differential fuzz** (4 tests) — an independent code-point reference implementation (`Array.from` + a code-point array search, no string indices, so the desync is unrepresentable) is compared against `matchSegments` over a 500-seed deterministic corpus (mulberry32) drawn from a mixed alphabet: ASCII, `^`/`` ` ``, precomposed accents, the same accents in NFD, a bare combining mark, BMP CJK, and astral code points; queries are mostly code-point slices of the label (sometimes upper-cased), the rest independently generated. Plus two implementation-free invariants over the same corpus (segments concatenate back to the exact label; at most one matched segment and never an empty one) and a **teeth check** that runs the corpus through the buggy oracle and requires it to diverge — and requires every divergence to involve an astral code point. **Astral vs. the ASCII fast path** — an astral label is never routed down it (an ASCII label cannot hold a surrogate pair), evidenced by `traceFolds` showing the label folded per code point rather than whole; an ASCII label with an astral query stays on the fast path and correctly reports no match.
- `active-descendant.spec.ts` (16 tests): `optionId` format (`<listboxId>-option-<index>`, panel-id parity); `MlvActiveDescendant` — start at `-1`, `move` wrap-around (first/last from `-1`, forward/backward wrap, count-0 → reset, lazy/live count), `first`/`last` (activate, no-op when empty, live count), `reset`.
- `highlight-match.pipe.spec.ts` (3 tests): nullish label, segmentation, empty query.
- `options-result.spec.ts` (3 tests): `toOptionsResult` normalises an array, a Promise, and an Observable to the same one-shot emission (moved here with the helper from `core-autocomplete`).
- `options-adapter.spec.ts` (21 tests): array source (local, ready, `items`, nullish → `[]`, `search()` no-op); observable source (loading until first emission, latest emission wins, reference change re-subscribes / resets `ready` / drops late emissions from the old observable); `MlvDataSource` (`MlvSelectDataSource` → remote, ready immediately, `setSearch({ query, keys: [] })` and `null` for a blank query; a paged remote stub → loading until the first slice, `loadMore()` accumulates pages, `loadingMore` vs `loading`, stale items kept, exhausted/in-flight `loadMore()` is a no-op, a new search resets to page 1; `debounce` coalesces rapid `search()` calls); **paging edge cases** — a double `loadMore()` on an in-memory source (which never reports `loading`) does not skip page 2, a re-emit of the applied page replaces its tail instead of duplicating rows, and `loadMore()` stays blocked until the requested page is applied then allows the next; `searchFn` (remote, lazy until `ensureLoaded()`, `eager` loads at construction, newer query supersedes an in-flight one, errors → `[]` + `ready`, arrays / Promises / Observables, a swapped function only re-arms the lazy gate — the previous result and `ready` survive until the new function answers, and it is invoked exactly once while the old one is never re-invoked — re-binding an _equivalent_ arrow twice leaves an in-flight call untouched and its result still applies, and a data source passed alongside is never connected). Adapters are built with `runInInjectionContext(TestBed.inject(Injector), …)` and effects flushed with `TestBed.tick()`; `RemoteStub` counts both requests and `connect()` calls.
- `reconciliation.spec.ts` (72 tests): `isReconciliationEmit` — true when nothing is added and every removed value is filtered out of view, true when the emit restates the committed selection, true for the empty-options initial load, false when a value is added, false when a still-visible value is removed (genuine deselect); `filteredOutCommitted` returns committed values that are neither incoming nor visible (empty when all are visible). Plus the fast-path suite: `defaultCompareWith` is `===` (reference equality for objects, `NaN !== NaN`, `+0 === -0`); a **differential fuzz** of 600 seeded random inputs per comparator (`defaultCompareWith`, `Object.is`, a custom by-id predicate, and a custom **asymmetric** `lexicallyBefore`) over a pool loaded with `NaN`, `±0`, and distinct-but-structurally-equal objects, checked against verbatim copies of both pre-change implementations; the **SameValueZero hazards** explicitly (a re-emitted `NaN` is an addition under `===`, not reconciliation; a committed `-0` is matched by neither an incoming nor a visible `+0` under `Object.is`; both hazards under a custom comparator); **order preservation** (committed order and duplicates survive, the committed instance is returned rather than a by-id-equal one); and that the **fast path is actually taken** — with R=50 committed and V=1000 visible, `visible` is walked exactly V times under either identity comparator and exactly R×V times under a custom one or when a hazard forces the fallback, measured through index accessors because `defaultCompareWith` cannot be wrapped in a spy without destroying the reference it is recognised by.
  Of those, the **`valueIndex`** suite is 34: a differential fuzz of 600 seeded random inputs per comparator (4 comparators, 4,800 index instances, **59,552 exact assertions**) against verbatim copies of the two scans it replaces, written in the controls' original `options.some((o) => compare(o.value, v))` / `options.find(...)?.value ?? v` shape — each index is queried in a **seeded random order**, with every query asked twice, because the progressive walk carries a cursor and an answer could otherwise depend on what was asked before it; empty haystack and empty query set; `resolve` returns the **first** match on the pairwise path _and_ on the keyed path (pinned with `values = [+0, -0]` under `===`, where a last-wins `Map` insertion would return `-0`) and the **indexed** instance, and keeps the `?? value` tail for a nullish indexed value; the SameValueZero hazards — `NaN` in the haystack bails under `===` but not under `Object.is`, `-0` disqualifies the index on the **keyed** side under `Object.is` while a `-0` **query** against a hazard-free haystack is answered pairwise per query, and `±0` under `===` needs no bail at all because a `Map` reproduces `+0 === -0`; and that the **fast path is actually taken** — with R=50 queries against V=1000 values, the haystack is read exactly V times under either identity comparator, exactly R×V under a custom comparator (with matching `compare` call counts), `1 + R×V` when a hazard at index 0 forces the bail, and `2×V` when one hazardous query falls back while the rest stay keyed. (Those four are all-miss workloads, so they hold identically for an eager, a lazy and a progressive build — they pin the _strategy_, not the walk.)

  The **progressive walk** suite (11 tests) is what pins the walk itself, since the cursor, the partial map and the bail latch are state shared across queries — a failure class the stateless versions could not have. It covers: a head match reading **one** element rather than building the map; a hit strictly inside the built prefix costing nothing further; resuming from the cursor rather than restarting (`b`, `c`, `e` over five values cost 2 + 1 + 2 reads, where restarting would cost 2 + 3 + 5); a definite miss walking to the end and not reporting a false negative, with the exhausted cursor then free; `resolve` after a `has` that moved the cursor still returning the **first** match; interleaved `has`/`resolve` in a scrambled order agreeing with the oracle throughout; first-wins both when the walk **passes** the duplicate (`[+0, -0, 'x']`, queried `'x'` first to force the full walk — the only arrangement in which an unguarded `Map.set` is observably last-wins) and when it **stops** before it (`[+0, -0]`); a hazard positioned **after** the cursor, asserting the answers before, during and after the mid-life bail all match the pairwise oracle and that the index then goes permanently pairwise (a prefix hit stops being free); and a hazardous **query** against a partially built index, which pays its own full scan and leaves the cursor and prefix intact.

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
