---
# Library: dropdown

Viewport sizing uses `DOCUMENT.defaultView` when available and skips browser
event subscriptions during server rendering.

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Dropdown library (`@malva-ui/core/dropdown`) provides a generic dropdown panel component and option utilities. It is primarily used as the content panel inside `MlvCombobox` and `MlvSelect`. Supports single and multiple selection, custom item templates, configurable height constraints, and the shared Malva themed scrollbar.

## Public API

Exported from `libs/core/dropdown/src/index.ts`:

| Export | Kind | Description |
|--------|------|-------------|
| `MlvDropdownPanel<T>` | Component | Dropdown list panel — `mlv-dropdown-panel` |
| `DROPDOWN_POSITIONS` | Const | `ConnectedPosition[]` — the ordered overlay positions every option panel is anchored with (`mlv-select`, `mlv-combobox`, `[mlvAutocomplete]`). See _Overlay positions (#154)_ |
| `MlvSelectOption<T>` | Interface | `{ label: string; value: T; group?: string; disabled?: boolean }` |
| `MlvSelectOptionTransform<T>` | Type | `(item: T) => MlvSelectOption<T>` |
| `defaultOptionTransform<T>` | Function | Converts item using `String(item)` as label |
| `isSelectOption<T>` | Function | Type-guard: value is `MlvSelectOption`-shaped — an object with a non-nullish `label` and a `value` key. Tests key **presence**, not truthiness, so `{ label: 'No', value: false }`, `value: 0`, `value: ''`, `value: null` and `label: ''` are options (#300) |
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
| `defaultCompareWith<T>` | Function | `(a, b) => a === b` — the shared default behind every option control's `compareWith` input (`mlv-select`, `mlv-combobox`) **and** `MlvSelectionService.compareWith`. A single module-level reference, so the guards below **and** `valueIndex` can recognise it and take their keyed fast path; re-exported from `@malva-ui/cdk/utils`, which now owns the implementation |
| `isReconciliationEmit<T>` | Function | `(incoming, committed, visible, compare) => boolean` — whether an aria listbox `valueChange` is pure reconciliation noise rather than a user selection (see below) |
| `filteredOutCommitted<T>` | Function | `(incoming, committed, visible, compare) => T[]` — committed values aria dropped only because their option is not rendered; re-added to a genuine multi-select pick |
| `valueIndex<T>` | Function | `(source, compare, project?) => MlvValueIndex<T, S>` (`S` = the source item type; `T` without `project`) — indexes a haystack for repeated membership / resolution queries, replacing the nested `queries × source` scan the option controls ran per option-list change (see below). Builds nothing until the first query |
| `MlvValueIndex<T, S = unknown>` | Interface | `{ has(value): boolean; resolve(value): T; find(value): S \| undefined }` — exactly `source.some((c) => compare(project(c), value))`, `source.find(...)?.projected ?? value` and `source.find(...)` (the matched **source item**, e.g. the option a value belongs to — #349). `S` defaults to `unknown` so an annotation written before `find` existed (`MlvValueIndex<T>`) still accepts a projected index. The keyed container behind them is built once, on first query; the methods themselves are not per-query memoised |

---

## Components

### `MlvDropdownPanel<T>`

**File:** `libs/core/dropdown/src/lib/dropdown-panel/dropdown-panel.ts`
**Template:** `libs/core/dropdown/src/lib/dropdown-panel/dropdown-panel.html`
**Styles:** `libs/core/dropdown/src/lib/dropdown-panel/dropdown-panel.scss`

- **Selector:** `mlv-dropdown-panel`
- **Change Detection:** `OnPush`
- **Encapsulation:** `None`

#### Inputs

| Name                      | Type                                                     | Default     | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------- | -------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `options`                 | `MlvSelectOption<T>[]`                                   | `[]`        | Options to display. Rendered through a bounded window of 100 rows that grows on scroll and on navigation — see _Option window (#318)_                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `multiple`                | `boolean`                                                | `false`     | Multi-select mode                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `selectedValues`          | `T[]`                                                    | `[]`        | The committed selection. Drives the inner aria listbox's `value` **and** the per-row check-mark, the latter through `compareWith` — a value here need not be the option's own instance, only one the comparator matches to it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `compareWith`             | `((a: T, b: T) => boolean) \| null`                      | `null`      | Equality predicate gating the check-marks — a row is checked when some committed value `v` satisfies `compareWith(v, option.value)`, same argument order and same answer as `MlvSelectionService.isSelected` — **and** the resolution of each committed value onto its option instance before the inner aria listbox sees it, so it governs `aria-selected` too. `null` **inherits the comparator from the injected `MlvSelectionService`**, the single source of truth every other membership check in the stack already uses, so `mlv-select` / `mlv-combobox` need no wiring. Set it on a standalone panel whose comparator is not on the service, **or on any panel whose `MlvSelectionService` is shared** — see _Check-mark identity_ below. |
| `minHeight`               | `number`                                                 | `0`         | Minimum height in px                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `maxHeight`               | `number`                                                 | `0`         | Max height in px; `0` = 40% of viewport in a browser. Server-side there is no viewport, so `0` emits no `max-height` at all                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `itemTemplate`            | `TemplateRef<{ $implicit: MlvSelectOption<T> }> \| null` | `null`      | Custom item renderer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `listboxId`               | `string \| null`                                         | `null`      | HTML `id` set on the inner `<mlv-list>` so a parent select/combobox can reference the listbox via `aria-controls`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `ariaLabel`               | `string \| null`                                         | `null`      | Accessible name rendered as `aria-label` on the inner listbox. `role="listbox"` is an ARIA input field (axe `aria-input-field-name`, WCAG 4.1.2), so a panel not already named through an owning control needs one — `mlv-filter` passes its field label, and `mlv-select` / `mlv-combobox` each pass their own resolved trigger name (`_panelAriaLabel`: the visible `label`, else the explicit `ariaLabel` input). `null` renders no attribute — an unlabelled consumer's DOM is unchanged.                                                                                                                                                                                                                                                      |
| `focusMode`               | `'roving' \| 'activedescendant'`                         | `'roving'`  | Forwarded to the inner aria listbox. `'activedescendant'` keeps DOM focus on the owning trigger/input (used by `mlv-combobox`); `'roving'` moves focus onto the active option (used by `mlv-select`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `activeIndex`             | `number`                                                 | `-1`        | Index of the activedescendant-active (highlighted) option; `-1` = none. Renders `.mlv-dropdown-panel__item--active` on that row and drives a deterministic option `id`. That class paints the **same** focus treatment the roving mode gets from the browser — see _Highlight parity between the two focus modes_. An index past the rendered window grows the window to include it, so the id `aria-activedescendant` names always resolves.                                                                                                                                                                                                                                                                                                      |
| `highlightQuery`          | `string`                                                 | `''`        | When non-empty, the default option row emphasises the matched substring of this query in each label (via `MlvHighlightMatchPipe` → `<mark class="mlv-dropdown-panel__match">`). Ignored for custom `itemTemplate` rows. Empty = plain label (unchanged). Used by `mlv-combobox` and `[mlvAutocomplete]`.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `loading`                 | `boolean`                                                | `false`     | Renders a loading affordance (spinner + `loadingText`, `role="status"`) above the list and suppresses both empty projections (the default slot and `[mlvDropdownPanelEmpty]`). Also sets the `--loading` host modifier and `aria-busy` on the listbox — previous options stay mounted, readable and interactive; the default row renders in the secondary text colour while loading (custom `itemTemplate` rows own their colours and are untouched).                                                                                                                                                                                                                                                                                              |
| `loadingText`             | `string \| undefined`                                    | `undefined` | Text announced inside both loading affordances (top row and `loadingMore` bottom row). Unset, the active pack's `dropdownPanel.loading` (`MLV_DROPDOWN_PANEL_I18N`, injected optionally), else English `'Loading…'` — byte-identical to the old literal default in English (#370, owner ruling D34; VERSIONING row 115). Select, combobox and autocomplete bind their own.                                                                                                                                                                                                                                                                                                                                                                         |
| `loadingMore`             | `boolean`                                                | `false`     | A page **beyond the first** is in flight: renders a polite `role="status"` row (`.mlv-dropdown-panel__loading-more`) after the last option and sets `aria-busy` on the listbox. Options stay interactive and are not dimmed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `hasMore`                 | `boolean`                                                | `false`     | Whether more pages exist. Arms the paging sentinel — see **Lazy-loading pagination** below. While rows are still withheld by the option window the sentinel grows the window first, and `loadMore` fires only once every bound option is rendered.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `infiniteScrollThreshold` | `number`                                                 | `150`       | Distance (px) from the end of the scroll owner at which `loadMore` fires.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `scrollMode`              | `'self' \| 'parent'`                                     | `'self'`    | Selects the single scroll owner. Standalone panels render their own `mlv-scrollbar`; panels inside `mlv-popup` delegate scrolling to the popup to avoid nested scroll regions. `'parent'` needs an ancestor `mlv-scrollbar` viewport: with none the panel renders **every** option (no window — nothing would grow it on scroll) and a `hasMore` source is never paged on scroll (dev warning).                                                                                                                                                                                                                                                                                                                                                    |

#### Outputs

| Name          | Type                   | Description                                                                                                                                                 |
| ------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `valueChange` | `output<readonly T[]>` | Emits when selection changes                                                                                                                                |
| `loadMore`    | `output<void>`         | Emits when the user scrolls within `infiniteScrollThreshold` of the end while `hasMore` and every bound option is rendered (a truncated window grows first) |

#### Host Bindings

```ts
host: {
  'class': 'mlv-dropdown-panel',
  '[class.mlv-dropdown-panel--parent-scroll]': 'scrollMode() === "parent"',
  '[class.mlv-dropdown-panel--loading]': 'loading()',
  '[style.max-height.px]': '_calculatedMaxHeight()',
}
```

`_calculatedMaxHeight` is computed from the `maxHeight` input, else `window.innerHeight * 0.4`, else `null`. The viewport half is `isPlatformBrowser`-gated, so on the server the computed is `null` and the host emits no `max-height` rather than the `NaNpx` it used to (`document.defaultView` exists under domino, `innerHeight` does not).

`--loading` recedes the **default** option rows to `--mlv-text-secondary` (a contrast-validated token) rather than fading the listbox: the rows stay mounted, readable and clickable while a refresh resolves, and an opacity dim on live controls would fail WCAG 1.4.3. Custom `itemTemplate` rows own their colours and are untouched.

#### Lazy-loading pagination

A zero-height sentinel `<div class="mlv-dropdown-panel__sentinel" aria-hidden="true">` at the end of the panel content hosts `[mlvInfiniteScroll]` (`@malva-ui/cdk/infinite-scroll`) and re-emits its trigger as the panel's `loadMore`. The sentinel does not own the scrollbar, so it is pointed at the real scroll owner via `[scrollContainer]`:

- `scrollMode="self"` — the panel's own `mlv-scrollbar` viewport (`MlvScrollbar.viewportElement`).
- `scrollMode="parent"` — the nearest ancestor `.mlv-scrollbar__viewport`, i.e. the owning `mlv-popup`'s.

That element is resolved in `afterNextRender` (it does not exist earlier) into the `_scrollContainer` signal; until it resolves the sentinel is `[disabled]`, so the directive's initial `afterNextRender` measurement never runs against the non-scrolling panel host. The sentinel is also disabled while `!_sentinelArmed()` (`hasMore() || _windowTruncated()`), and passes `[loading]="!_windowTruncated() && (loading() || loadingMore())"` so a fetch in flight cannot trigger another page. Growing the option window is local, so it is not gated by a fetch.

**Dev-mode warning for a missing scroll owner.** In `scrollMode="parent"` the lookup finds nothing unless the panel really renders inside an `mlv-scrollbar` viewport — and an unresolved owner keeps the sentinel disabled, so lazy paging fails _silently_. Under `isDevMode()` the panel therefore `console.warn`s once per instance when `hasMore()` is set and the lookup ran and found nothing (`_noScrollOwner`: `_scrollOwnerResolved()` and `_scrollContainer() === null`). It is an `effect` reading those signals (warning `untracked`, latched by `_warnedNoScrollOwner`), so a `hasMore` that flips true long after the first render is caught too. Never fires in `self` mode (the panel's own scrollbar always resolves) or while `hasMore` is `false`. A long list alone needs no warning: with no owner the panel renders every option (see _Option window_).

**Auto-fill.** An `afterRenderEffect` re-runs `MlvInfiniteScroll.check()` whenever the option set or the rendered window (`_renderCount`) changes, so a page too short to fill the scroll owner immediately requests the next one instead of stalling until the user scrolls. `MlvOptionsAdapter.loadMore()` is a no-op until the requested page has been applied, so repeated firing cannot skip a page.

Consumers bind `[loadingMore]`, `[hasMore]` and `(loadMore)` straight from `MlvOptionsAdapter` (`loadingMore`, `hasMore`, `loadMore()`).

#### Option window (#318)

The panel renders a **prefix** of `options()`, not every row. Each row hosts `@angular/aria`'s `Option`, and mounting `n` of them is O(n²): aria's `SortedCollection.register` copies its whole `Set` per option, and each `Option`'s `tabindex` binding reads the listbox's `items()`, which re-sorts by `compareDocumentPosition` — O(sibling distance) in Blink (measured: 0.84 µs for a far pair at 500 siblings, 7.7 µs at 4,000). Before windowing a standalone panel took 934 ms to open at 1k options, 41 s at 3k, 204 s at 5k, and did not open within 500 s at 10k (Chrome, production build).

- **Size.** `DROPDOWN_WINDOW_PAGE` = 100 rows (`option-window.ts`, internal, not in the barrel). A hundred rows is several screens of any panel height the library ships (40% of the viewport by default).
- **A prefix, never a slice from the middle.** Every rendered row keeps its flat index, so `optionId(index)`, `activeIndex`, `_checkedRows()[index]` and DOM order (what aria navigates by) are unchanged. Grouped rendering builds `_groups` from the same prefix, so a group keeps its header id as the window grows.
- **Nothing changes for a list that fits.** `_windowOptions` is the `options()` array itself when nothing is withheld; no set-position attributes, no withheld values, and the sentinel emits `loadMore` exactly as before.
- **Growth** — `_window`, a `linkedSignal` holding `{ limit, interacted }`:
  - one page more each time the paging sentinel fires (`_onSentinel`), **only while the scroll owner has layout** (`clientHeight > 0`). Without layout — a hidden panel, a server render, jsdom — every metric reads `0`, which the sentinel takes for "at the end", and each grown page would re-arm it until the whole list was mounted;
  - as far as a key needs (below);
  - always as far as `activeIndex`, so `aria-activedescendant` never names a missing id;
  - in roving mode, as far as `_defaultTabStop` — aria's own default tab stop (`ListboxPattern.setDefaultState`, mirrored by `ariaDefaultTabStop`): the first checked option it can focus, else the first option it can focus — **only until the listbox is interacted with**. aria picks among registered rows, so without it a committed value past the window would move where Tab lands, a disabled checked row would hide an enabled one past it, and a disabled prefix a window long would leave no row to land on (aria then counts the whole listbox as disabled and gives the listbox itself `tabindex="0"`). aria stops re-deriving its tab stop on the first keydown, click or focusin inside the listbox (`hasBeenInteracted`), so the panel latches `interacted` on the same three events (`_markInteracted`, capture-phase on the host, guarded to its own listbox) and stops pinning. Pinning for good would mount every row up to the next checked one when the user deselects the first (measured before the latch: 2,000 options, `v3` + `v1900`, deselect `v3` → 100 → 2,000 rows, 1,979 ms in jsdom) for a tab stop aria no longer moves. A snapshot taken once per `options` change was rejected: a committed value that arrives after the options (a form patched from a request) would go unpinned.
- **No scroll owner.** In `scrollMode="parent"` with no ancestor `mlv-scrollbar` viewport (`_noScrollOwner`), `_renderCount` is every option: nothing would grow the window on scroll, so the panel renders as it did before windowing rather than leaving the tail reachable by keyboard only. Until the lookup has run (`afterNextRender`, never on the server) the first render is still one window.
- **Reset.** Each `options` change is judged against the rows the window rendered (`windowSurvival`) by whether their **views** survive, not just their values: the grouped template re-creates rows whose values never moved.
  - `'none'` — a rendered position holds a different `value` (`Object.is`, the key both `@for`s track): back to one page, latch cleared. A typed or cleared query re-mounts one page, not every row (measured: back to all 5,000 options after a filter, 12.2 s → 36 ms in jsdom).
  - `'rows'` — the same values, but a rendered row changes group run: it starts a run where it did not (or stops), or its run turns labelled / headerless. Runs are tracked by position (`track $index`) and labelled and headerless runs render in different blocks, so the row's view is re-created. Limit kept (a scrolled list does not collapse under the user), latch cleared.
  - The latch also clears when the list turns grouped or flat (`_isGrouped`, decided over every option, so a group past the window counts — the whole flat / grouped branch swaps) and when `scrollMode` changes (the listbox itself is re-created). Both are `_window` source fields.
  - `'views'` — nothing re-mounts: the same array, a next page appended behind the window, a group renamed in place (only a header's text changes). Limit and latch kept.
  - Why the latch clears with the views: aria re-derives its tab stop from its registered rows as soon as its active row's `Option` leaves `items()`, interacted or not. Comparing values only, 350 options with row 0 focused, `v300` committed and every option then given `group: 'G'` put the tab stop on row 0 (row 300 unwindowed).
  - Where the active row's view survives a reset (another row was re-created), the pin re-applies although aria keeps its tab stop — an over-render bounded by the open-time cost, never a wrong tab stop.
- **Paging.** While rows are withheld the sentinel grows the window instead of emitting; `loadMore` fires only once every bound option is rendered — the same scroll point it always fired at.
- **Keys reach unrendered options.** A capture-phase `keydown` on the host (browser only, `fromEvent(…, { capture: true })`) runs before the listbox's own handler, renders the row the key moves to when it lies past the window — `_window` grows to `windowLimitFor(index)`, then a synchronous `detectChanges()`, so the rows are registered with aria by the time aria handles the key — and lets aria run its unchanged semantics. The key table mirrors aria's `ListboxPattern.keydown` for the panel's configuration (`MIRRORED_LISTBOX_CONFIG`: vertical, wrapping, `selectionMode="explicit"`, `softDisabled` off, 500 ms typeahead), modifier for modifier: End / Home (plus Ctrl/Cmd+Shift in a multi-select), ArrowDown off the last rendered row and ArrowUp wrapping from the first (plus Shift in a multi-select), a typeahead match, and Ctrl/Cmd+A in a multi-select (selects every option). Disabled options are skipped, as aria skips them. Typeahead mirrors aria's `ListTypeahead` state — accumulated lowercase query, the active index the burst started from, a reset after `MIRRORED_LISTBOX_CONFIG.typeaheadDelay`, a leading space ignored — and searches the **whole** list; aria then scans its registered rows in the same order and lands on the same option. Guarded to keys on the panel's own listbox (`closest('[role="listbox"]').id`). PageUp / PageDown: aria's listbox binds neither, so they are not handled (unchanged). A spec reads the live `Listbox` off the rendered panel and asserts its `orientation`, `wrap`, `selectionMode`, `softDisabled` and `typeaheadDelay` equal `MIRRORED_LISTBOX_CONFIG`, so an upstream default change goes red instead of the mirror silently pre-rendering a row aria no longer moves to. The arrow match reads raw `event.key`: the listbox is vertical-only, so `normalizeArrowKey` mirroring would be a no-op. Every key on the listbox also latches `interacted` (see _Growth_).
- **Activedescendant consumers** (`mlv-combobox`, `[mlvAutocomplete]`) keep focus on their input and drive `activeIndex` themselves; an index past the window grows it through `_window`, and the scroll-into-view effect is an `afterRenderEffect` so the grown row exists when it runs.
- **Set positions.** While truncated, each row carries `aria-setsize` / `aria-posinset` computed over the full list (`optionSetPositions`, one O(n) pass) — without them a browser counts the rows in the DOM and reads "1 of 100". Ungrouped: `k` of `n`. Grouped: a labelled run numbers its own options; the options of every headerless run are direct listbox children and number together, across any groups between them. A complete list carries none (the browser's own numbers are right). aria's `Option` binds neither attribute, so nothing competes.
- **Withheld selection.** aria's reconciliation effect drops every value in its `value` model that no registered option holds and writes the result back as `valueChange`. With a window that would also drop a value whose row has not been scrolled to yet. So while truncated `_committedSplit` withholds from aria's `value` each committed value whose option exists but is not rendered; `onValueChange` puts them back in a multi-select — committed order for every value aria still holds or never saw, then aria's additions in aria's order, the array aria would have emitted with every row rendered. A single-select passes through (aria replaces the value; a withheld one is superseded, not lost). A value matching **no** option still reaches aria, so the documented reconciliation emit is unchanged. Check-marks read `selectedValues()` and are unaffected.
- **Cost moved, not removed, for a deep target.** A contiguous prefix makes any deep target cost the pre-window price for every row up to it. Four triggers pay it: (1) a key that jumps far — End, a typeahead match, Ctrl/Cmd+A, and in `mlv-combobox` ArrowUp from no active option or from the first, which wraps to the last (Chrome prod: End at 1k options 776–783 ms; at 3k 39.9 s, the old open cost at 3k); (2) a roving panel — non-searchable `mlv-select`, `mlv-filter` — whose committed value sits deep in the list opens with the window pulled to that row (jsdom, 5,000 options: no committed value → 61 ms, committed index 999 → 612 ms, 1,999 → 1,665 ms; about 41 s in Chrome near index 3,000); (3) an `activeIndex` far down the list; (4) scrolling itself, which costs more per page the more rows are registered (18 ms for the second page → 295 ms for the eleventh, 1,100 rows) — aria's per-registration work, not the panel's. The total cost to reach any option never exceeds what opening the panel used to cost. A segmented window (a prefix plus the page around the target, with spacer geometry) and linear registration upstream are tracked separately in #497.
- **Consumer-visible deltas (patch, VERSIONING row 118).** Find-in-page (Ctrl/Cmd+F) reaches only rendered rows. The scrollbar thumb shrinks in steps as pages mount, since the scroll height grows with them. A panel whose scroll owner has no layout (a hidden panel, a jsdom consumer spec) with more than 100 options and `hasMore` no longer emits `loadMore` on its first render — the sentinel reads the zero metrics as "at the end", and the window grows first, which the layout guard refuses — so a consumer spec asserting that emission needs a layout stub or at most 100 options.

Measured after (Chrome via Playwright, production build, **no committed value** — the window is one page; from mounting the panel, clicking the trigger or pressing the key until the option rows exist, plus one frame). A committed value deep in the list opens at the cost of the rows up to it — see _Cost moved, not removed_ above:

| Options | Standalone panel                | `mlv-combobox` open / first key / Backspace     | `mlv-select` open    |
| ------- | ------------------------------- | ----------------------------------------------- | -------------------- |
| 1,000   | 14.6 ms (was 934 ms)            | 29.1 / 17.6 / 17.6 ms (was 805 / 36 / 1,123 ms) | 18.8 ms (was 795 ms) |
| 10,000  | 18.5 ms (did not open in 500 s) | 23.2 / 17.9 / 16.5 ms                           | 19.6 ms              |
| 100,000 | 27.3 ms                         | 30.1 / 22.8 / 14.9 ms                           | 29.6 ms              |

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

#### Content slots

| Slot                                              | Rendered                                                                   | Used by                                                                      |
| ------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| default `<ng-content />`                          | **inside** the listbox, in the flat `@for`'s `@empty`, while not `loading` | `mlv-select` (`.mlv-select__empty`), `mlv-combobox` (`.mlv-combobox__empty`) |
| `<ng-content select="[mlvDropdownPanelEmpty]" />` | **after** the listbox, while `options()` is empty and not `loading`        | `[mlvAutocomplete]` (`.mlv-dropdown-panel__empty`, #370)                     |

The named slot exists because a text row inside an option-less `role="listbox"` fails axe `aria-required-children` (a listbox may own only options and groups), while an empty listbox is only `incomplete` (`reviewEmpty`). The default slot keeps its position — moving it would change the accessibility tree of every select and combobox empty state (VERSIONING row 112), so their `aria-required-children` failure with no options is left to a follow-up. For a `ComponentPortal`, `projectableNodes` is indexed by `ngContentSelectors`, which is `['*', '[mlvDropdownPanelEmpty]']`: the named slot is index 1.
`.mlv-dropdown-panel__empty` is the matching row style (padding `--mlv-spacing-3`, centred, secondary text, `body-s`), mirroring the combobox and select empty rows.

`loadingText` fallback (#370): `OPTIONAL_MESSAGE_FALLBACKS`, a `Record` over every optional key of `MlvDropdownPanelI18n` (today `loading: 'Loading…'`), the same shape as select, tokenizer, date-range-picker, time-picker and autocomplete — a new optional key does not compile without an English fallback. The input's read type widened `string` → `string | undefined` (row 115, #348 shape (f)); it rides the `!` of `docs/migrations/2026-09-autocomplete-no-results-and-count.md`, shape (d).

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
| `mlv-dropdown-panel__empty`         | Empty-state row for the `[mlvDropdownPanelEmpty]` slot (`[mlvAutocomplete]`'s "No results found")                                                                                                                        |
| `mlv-dropdown-panel__sentinel`      | Zero-height (`height: 0; overflow: hidden`) `aria-hidden` marker hosting `[mlvInfiniteScroll]`; never occupies layout                                                                                                    |

#### Public Methods

- `isValueSelected(value: T): boolean` — whether `value` is in `selectedValues()` under the comparator in force. The predicate behind each row's check-mark. The template does **not** call it per row (it reads the materialised `_checkedRows` instead — same predicate, once per option per _selection change_ rather than per render); the two share one index and cannot answer differently. See _Check-mark identity_ below.
- `onValueChange(values: readonly T[]): void` — re-emits the aria listbox selection array (aria's `ngListbox` emits the values array directly; the previous `ListboxValueChangeEvent` wrapper is gone). In a multi-select whose option window withholds committed values from aria, merges them back first — see _Option window (#318)_.

### Check-mark identity (#132)

The check-mark is a membership test and has to give the same answer as every other membership test in the stack — `MlvSelectionService.isSelected`, `deselect`, and the `select` / `toggle` de-dup path, all of which run the service's comparator.

It used to run `new Set(selectedValues()).has(value)`, which answers under **SameValueZero** whatever the comparator is. Two disagreements followed:

- **`NaN`.** `Set.has(NaN)` is `true` while `findIndex(v => v === NaN)` is `-1`, so the panel ticked a row every other check reported unselected. Nothing masked this — it reproduced in `mlv-select` itself, because the `options.resolve()` normalisation that hides the object case below cannot collapse `NaN` onto its option either.
- **A custom `compareWith` + a fresh object.** `(a, b) => a.id === b.id` matches a deserialised `{ id: 2 }` to option B, so the display value is right, but `new Set([<deserialised>]).has(optionB.value)` is `false` — no tick. `mlv-select` / `mlv-combobox` masked this by resolving each written value onto the option's own instance before `setValues`; the standalone hosts (`mlv-filter`, `mlv-pagination`, `MlvEditorZoom`, `[mlvAutocomplete]`, the docs examples) had no such wrapper.

Now: `valueIndex(selectedValues(), compareWith)` (private `_selectedValueIndex`), queried with the option value.

- **The haystack is the selection, not the options** — argument order is observable and a consumer's comparator need not be symmetric. `valueIndex` applies `compare(indexedValue, queriedValue)`, so indexing the selection and querying with an option value reproduces `isSelected`'s `compare(selected, value)` exactly. Same reasoning as `MlvSelect._selectedValueIndex`.
- **Complexity is unchanged on the common path.** For the shared `defaultCompareWith` with no `NaN` present, `has()` is an O(1) `Map` lookup and the map is built once per selection change (the index lives in a `computed`), not once per row. A custom comparator, or a `NaN` on either side of the default, falls back to a scan of the **selection** — O(S) per row, where `S` is the number of committed values (1 for single-select), never the option count.
- **The comparator's default source is the service, not a fresh reference.** `MlvSelectionService.compareWith` defaults to the shared `defaultCompareWith`, and that identity is what lets `valueIndex` recognise the fast path at all.
- **The service must not be shared.** It is injected without `{ optional: true }`, so it has to be provided above every panel; every host in this repo provides it at **component** level, one instance per host. Provided once at the application root instead, one host's `service.compareWith.set(...)` silently re-checks every other panel's rows. Prefer `providers: [MlvSelectionService]` on the host; where the service genuinely has to be shared, set the `compareWith` input so the panel's identity rule is local to it.
- **The template reads a materialised array, not the predicate.** `_checkedRows` is a `computed<readonly boolean[]>` aligned index-for-index with `options()`, read as `_checkedRows()[index]` (the flat index both the grouped and the ungrouped branch already carry). `isValueSelected` stays public and correct, and shares `_selectedValueIndex` with it, but the template does not call it: a template method re-runs on **every** template execution, not only when the selection changes, so a custom comparator turned the grid into an `options × selection` scan per render — per arrow key. Measured at 200 options × 20 committed values: **3810 comparator calls on a bare `activeIndex` change → 0**, and 7830 → 4020 on first render. Booleans keyed by position rather than a `Set` of matched option values, because `Set` membership is SameValueZero: under an `Object.is` comparator a `-0` row would match a `+0` entry and tick a row the comparator calls unselected, reintroducing this very defect one level up.

### What aria is handed (`_ariaValues`)

**`@angular/aria` takes no comparator, anywhere.** `ngListbox` matches values to options with `===` in three places it owns:

- the option's `aria-selected`, computed as `listbox.value().includes(this.value())` (SameValueZero);
- `validate()`, which finds duplicates with `values.indexOf(val) !== idx`;
- an `afterRenderEffect` that filters its `value` model down to `items.some((i) => i.value() === v)` and **writes the result back** — which, `value` being a model, emits `valueChange`.

So a value matched to a row by `compareWith` alone was invisible to aria: on a standalone panel the row check-marked but reported `aria-selected="false"`, **and** the panel emitted a `valueChange` dropping it on first render, with no user interaction. A consumer following the documented wiring (`selected.set([...values])`, as `apps/docs/.../dropdown/examples/2` does) had its selection cleared one frame after the tick appeared.

The panel therefore binds the listbox's `[value]` to `_ariaValues` — `selectedValues()` with every value that matches a rendered option replaced by that option's own instance, via `valueIndex(options(), compareWith, (o) => o.value).resolve(v)`. That makes the array `===`-comparable to the options aria holds, settling `aria-selected` and the reconciliation emit together. `mlv-select` / `mlv-combobox` already normalise upstream in `_applyPendingValues` (same `valueIndex`, same `resolve`), which is why neither ever showed either symptom; this is the same move made where a standalone panel benefits from it.

Note the argument order is the **transpose** of `_selectedValueIndex`'s, deliberately: `valueIndex` applies `compare(indexedValue, queriedValue)`, and this index is queried with a committed value, giving `compare(option.value, committedValue)` — the order every other value-vs-options check in the stack uses. A value whose option exists but lies past the rendered window is withheld instead (see _Option window (#318)_). A value matching no option passes through unchanged, so aria still filters it and still re-emits; that is unchanged behaviour and the case `isReconciliationEmit` / `filteredOutCommitted` exist to absorb in an owning control.

### Residual gap — `NaN` is not a usable option value

Under the default `===`, `NaN` cannot be selected by anything in this stack, and the panel's check-mark is not what makes that so. With a `NaN` option and a committed `NaN` in `mlv-select`, the state after the fix is:

| Surface                                 | Reads     |
| --------------------------------------- | --------- |
| `selectionService.selectedValues()`     | `[NaN]`   |
| `hasValue()` / `displayValue` / trigger | `'NaN'`   |
| `isSelected(NaN)`                       | `false`   |
| Check-mark                              | absent    |
| `aria-selected`                         | `"false"` |

The tick, `aria-selected` and `isSelected` agree (all say "not selected"). **The trigger does not**, and that is the whole remaining disagreement — it renders `selectedValues()` through `toOption` directly, without requiring the value to have matched an option.

It is not fixed in the display on purpose. A committed value that matches no option is a _supported_ state — `5` against options `[1, 2]` gives `isSelected(5) === true`, no tick, and the trigger is the only surface that can show it — so gating `displayValue` on a match would break the general case to paper over one value. What is actually anomalous is narrower: `===` denies membership to a value the service is holding, because `NaN === NaN` is false. That is `defaultCompareWith` behaving as specified.

**`compareWith = Object.is` does not rescue it**, and must not be recommended: `Object.is(NaN, NaN)` satisfies the service and the check-mark, but aria's three `===` sites do not take the comparator, so the moment the listbox renders, aria filters the `NaN` out and re-emits; `mlv-select` reads that as a genuine deselect (the option _is_ visible, so it is not filtered-out-committed) and drops the value entirely — the trigger falls back to the placeholder. Verified identical before the #132 panel fix, so this is upstream. Both facts are pinned by tests in `select.spec.ts` so this section cannot drift.

Two upstream `@angular/aria` defects were found while pinning this and are not worked around in library code (only muted in the `NaN` specs, which would otherwise print a Node stack trace — narrowly, dropping just aria's two violation lines and forwarding every other warning to the real `console.warn`):

- `ngListbox.validate()` detects duplicate option values with `values.indexOf(val) !== idx`, and `indexOf` never matches `NaN` — so a listbox holding **one** `NaN` option is always reported as holding a duplicate.
- It then logs the element with `console.warn('Violations found on element: %o:', element)`, and Node's `%o` formatter throws `TypeError: Receiver must be an instance of class URL` while walking a jsdom element, which Angular's error handler surfaces as an `ERROR` stack trace in the suite output.

### Highlight parity between the two focus modes

The two `focusMode`s render the **same mark: an accent ring and nothing else.**

- **`roving`** — DOM focus lands on the option, so it picks up the ring
  `list-item.scss` paints on `:focus-visible`. The panel only re-offsets it to
  Form B (inset), because rows run edge to edge inside a viewport that clips
  horizontally and an outset ring would lose its left and right sides.
- **`activedescendant`** — focus stays on the owning trigger/input, so
  `:focus-visible` never matches. `.mlv-dropdown-panel__item--active` therefore
  declares the same outline and the same inset itself.

**The fill belongs to `:hover` alone.** The keyboard row is ringed, a hovered
row is tinted, and a row that is both shows both — two distinct marks rather
than one ambiguous one.

Two traps this arrangement exists to avoid, both of which were shipped briefly
and reverted:

- **Do not tint `__surface`.** `:hover` tints the whole rounded row through
  `--mlv-list-item-bg`; `__surface` is an inner, square, inset box. Painting the
  same token there produces a visibly different mark, not a matching one — and
  over a selected row it also overpaints the accent-pale selected fill with a
  neutral grey.
- **Do not give the active row a `z-index`.** The ring is inset, so it is drawn
  strictly inside the row's own border box and no adjacent row can reach it;
  there is nothing for a stacking bump to fix. What it _does_ do is enter
  `__group-header`'s stacking competition and, being later in DOM order, win any
  tie and paint over it — so arrowing across a group boundary clips the sticky
  header.

### Sticky group header vs the roving focus ring (#109)

`__group-header` is `z-index: 2`, not `1`. The header and the rows it labels are
siblings in **one** stacking context — `__group` is a plain `display: block`
box, `mlv-list` sets no `z-index` or `transform`, and the `mlv-scrollbar` host is
`position: relative` with `z-index: auto`, so none of them opens a context — and
the header precedes those rows in DOM order, so it loses every tie.

That matters only on the **roving** path (`mlv-select` without `searchable`),
where DOM focus lands on the option itself and `list-item.scss` gives a
`:focus-visible` row `z-index: 1`. At a tie the row won, painting its text and
ring over the pinned header. The `activedescendant` path is unaffected: focus
never reaches the option, so `:focus-visible` never matches, and the `--active`
rule deliberately declares no `z-index`.

The row's `z-index` is **not** the thing to drop instead — it is load-bearing.
That ring is Form A at a positive `outline-offset`, so it paints outside the
row's border box, and rows are flush (`margin: 0`); an adjacent hovered or
selected row is later in DOM order with an opaque `--mlv-list-item-bg` and would
paint over the ring's near edge.

`2` rather than a `--mlv-z-*` token, matching `list-item-group.scss`'s
`.mlv-list--inset .mlv-list-item-group__label` — the identical
sticky-header-over-list-rows job, which has always cleared the row at this
level. The `--mlv-z-*` ladder is for document chrome; both of these only ever
compete with their own sibling rows.

Pinned by `dropdown-panel-stacking.spec.ts` (4 tests), which resolves both
declarations — following a `var(--mlv-z-*)` indirection into `theme.scss` — and
asserts the header's effective integer is **strictly greater** than the row's,
that `__group` stays a plain block (isolating it would put header and rows in
one context together and reinstate the tie), that the two sticky group headers
agree on their level, and that the row keeps a `z-index` at all.

Before #75 only `roving` drew a ring, so `mlv-combobox`,
`mlv-select[searchable]` and `[mlvAutocomplete]` showed a visibly different
keyboard state from a plain `mlv-select` — and `mlv-select` disagreed with
itself depending on `searchable`, because `_activeIndex` is pinned to `-1`
unless `searchable` is set.

Pinned by the `activedescendant highlight parity` block in
`dropdown-panel.spec.ts`, which compiles **both** `dropdown-panel.scss` and
`list-item.scss` through Sass and asserts the panel's ring equals the one
`list-item.scss` declares, rather than restating it — so a change to either
that is not mirrored fails there instead of drifting apart visually. It also
asserts the active rule out-specifies every `outline` rule in `list-item.scss`,
declares no background on any selector, and declares no `z-index` while the
group header still does.

## Overlay positions (#154)

`DROPDOWN_POSITIONS` (`dropdown-positions.ts`) is the single ordered
`ConnectedPosition[]` behind all three option controls — `mlv-select` and
`mlv-combobox` pass it to `mlv-popup` as `dropdownPositions`, `[mlvAutocomplete]`
hands it to its own `flexibleConnectedTo(...).withPositions(...)`.

- **Four placements, `start`/`end` × below/above**, in that order:
  `start` below (8px gap) → `start` above (−8px) → `end` below → `end` above.
- **Order decides on the fitting path, and only breaks ties on the other one.**
  `FlexibleConnectedPositionStrategy.apply()` applies the first candidate whose
  box lies wholly inside the viewport and returns, so **a panel that fits never
  flips**: a field with room keeps the start-aligned placement it has always had
  and only a field without room reaches the fallbacks. Nothing about the
  preferred pair changed in #154. When nothing fits outright, CDK instead scores
  every candidate `_canFitWithFlexibleDimensions` accepts (with a `minWidth` on
  the config since #150, usually all of them) by bounding-box area and keeps the
  largest, `score > bestScore` handing an exact tie to the earlier entry. Ties
  there are the exception: the `start` box spans from the field's inline-start
  edge to the viewport's inline-end edge and the `end` box from the viewport's
  inline-start edge to the field's inline-end edge, equal only for a field
  centred on the viewport — past that midline the `end` entry wins on area
  outright, which is the #154 case.
- **Why the `end` pair exists.** Under `withFlexibleDimensions(true)` the
  bounding box spans from the _anchored_ edge to the viewport edge. With every
  position anchored to the field's inline-start edge, a narrow field near the
  viewport's inline-end edge got a box only as wide as the sliver after it — the
  panel #150 freed to grow had nowhere to grow into. The `end` pair anchors the
  panel's inline-end edge to the field so it grows back toward inline-start.
- **Logical, and no `offsetX`.** The pane is portaled to `<body>` and carries a
  `direction` resolved from its trigger (`MlvPopupService`;
  `MlvRtlService.resolveDirection` in the directive), so CDK mirrors
  `start`/`end` against it. `offsetX` is deliberately absent: CDK adds it as raw
  physical pixels and never flips it in RTL, so an `end`-aligned entry would
  need the opposite sign from its `start`-aligned twin. The field/panel gap
  lives on the block axis, where `offsetY` means the same in both directions.
- The same four placements, in the same order, already back menu panels
  (`MENU_POSITIONS`, `@malva-ui/core/popup`) and context menus
  (`CONTEXT_MENU_POSITIONS`, private to `[mlvContextMenuTrigger]`). They are
  spelled out here rather than resolved from `POPUP_POSITION_MAP` so this
  package — and with it `[mlvAutocomplete]`, which builds its own overlay —
  needs no dependency on the popup package.
- Pinned by `dropdown-positions.spec.ts` (the list's shape: order, logical names
  only, no `offsetX`) and end-to-end by the `#154` blocks in `select.spec.ts`,
  `combobox.spec.ts` and `autocomplete.spec.ts`, which drive the real CDK
  strategy over a stubbed viewport/origin/pane and assert the bounding box the
  fallback produces in LTR, under a global RTL flip and under a scoped
  `[dir="rtl"]`. The **order** itself is guarded behaviourally by one case in
  `select.spec.ts` — a 150px panel against a trigger with room on both sides, so
  both inline candidates fit outright and only the list order can separate them.
  Every other case is decided by geometry and survives an end-pair-first
  reordering, so that one test is what fails if the order is disturbed.

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

// Type-guard: MlvSelectOption-shaped value — an object with a non-nullish `label`
// and a `value` key (own or inherited). Presence, never truthiness: before #300 a
// falsy label or value (`false`, `0`, `''`, `NaN`, `null`) failed the guard, so
// defaultOptionTransform wrapped the whole object — a row reading
// "[object Object]" whose committed value was the option object. The label type
// is not checked, so an untyped `{ label: 2024, value: 2024 }` still passes.
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

**Where the constant lives (issue #67).** The implementation is in `@malva-ui/cdk/utils`' `default-compare-with.ts`; `reconciliation.ts` re-exports it (`import` + `export { defaultCompareWith }`, the same shape `option-matcher.ts` uses for `normalizeForMatch`), so this entry point's public surface is unchanged. It had to move down because `@malva-ui/core/form-utils`' `MlvSelectionService` carried its own inline `(a, b) => a === b` and this library **depends on** form-utils (`mlv-dropdown-panel` injects the service) — importing the dropdown's constant there would have inverted that dependency. One library below both, `@malva-ui/cdk/utils` is reachable from each (`family:core` may depend on `family:cdk`).

The re-export must forward the **identical binding**. A wrapper (`(a, b) => defaultCompareWith(a, b)`) compares unequal under `hazardOf`, so every fast path in this file silently reverts to the pairwise scan while every result stays correct — a regression no value-level assertion can see. `reconciliation.spec.ts` therefore asserts the reference across all three libraries and, separately, counts element reads through a `MlvSelectionService`'s default comparator: 1,000 on the keyed path against 50,000 pairwise.

That read-count guard is **forward-looking, not a realised win**: no production code composes `valueIndex` with the _service's_ comparator today. `mlv-select` (`select.ts:400`) and `mlv-combobox` feed `valueIndex` from their own `compareWith` **input**, which already defaulted to the shared reference, and then push that input into the service (`select.ts:622`, `combobox.ts:545`), overwriting the default. Moving the constant down changes no measured production path — it removes a trap for the first caller who does thread the service's comparator into a fast path, and makes the two defaults one binding instead of two that merely behave alike.

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
export interface MlvValueIndex<T, S = unknown> {
  /** `source.some((item) => compare(project(item), value))`. */
  has(value: T): boolean;
  /** `source.find((item) => compare(project(item), value))?.projected ?? value`. */
  resolve(value: T): T;
  /** `source.find((item) => compare(project(item), value))` — the source item itself. */
  find(value: T): S | undefined;
}

export function valueIndex<T>(source: readonly T[], compare: (a: T, b: T) => boolean): MlvValueIndex<T, T>;
export function valueIndex<S, T>(source: readonly S[], compare: (a: T, b: T) => boolean, project: (item: S) => T): MlvValueIndex<T, S>;
```

`find` (#349) answers "which **option** does this value belong to" — what a control needs to render the option's label rather than `toOption(value)`, which for a `{ label, value }` option can only rebuild the value as its own label. It shares the progressive walk with `has` / `resolve` (one cursor, one `Map`), so querying all three costs one walk. The `Map` stores the **source item** per projected key; `resolve` re-projects it on a keyed hit, which is one `project` call per hit — the same read its pairwise definition makes. `S` defaults to `unknown` rather than `T` because a projected index's `S` is the option type, and a default of `T` would have turned every existing `MlvValueIndex<T>` annotation of a projected index (`mlv-select`'s `_optionValueIndex`, `mlv-tokenizer`'s token index) into a compile error; the change is additive (VERSIONING row 114 class).

The `project` overload exists for laziness, not convenience. Mapping at the call site (`valueIndex(options.map((o) => o.value), compare)`) walks the whole accumulated list on every rebuild whether or not anything is ever queried — which is precisely the eager cost the lazy build removes. Passing the projection in defers it; the pairwise path then reaches through `project` per candidate, which is what the scans being replaced always did.

Both methods are **defined by the pairwise scan they replace** — including `resolve`'s `?? value` tail, which returned the query value when the matched option's own value was nullish. An index is observationally indistinguishable from the scan; only its cost differs.

Built for the option controls, which each cross-check their committed selection against the resolved option list from several places at once:

| Control        | Index                 | Haystack               | Sites                                                                             |
| -------------- | --------------------- | ---------------------- | --------------------------------------------------------------------------------- |
| `mlv-combobox` | `_optionValueIndex`   | resolved option values | `_allValuesMatched`, `_chipOptions`, `_applyPendingValues`, `_selection` (`find`) |
| `mlv-select`   | `_optionValueIndex`   | resolved option values | `_allValuesMatched`, `_applyPendingValues`                                        |
| `mlv-select`   | `_selectedValueIndex` | committed selection    | `_isNativeOptionSelected`                                                         |

**Which side you index is not a free choice.** `valueIndex` applies `compare(indexedValue, queriedValue)`, so the haystack must be whichever side the original scan passed as `compare`'s **first** argument. The option-side sites call `compare(option.value, committedValue)`; `_isNativeOptionSelected` calls `compare(selected, value)` and therefore indexes the selection. Getting this backwards transposes a consumer's `compareWith`, which is under no obligation to be symmetric — and no symmetric test comparator would ever notice.

Most of those were nested `selected × options` scans, and `resolvedOptions()` is the **accumulated** lazily-paged list — so every page append re-ran every scan over the whole accumulated list and a scroll session cost O(selected × options²) in total. Each control now holds a single `_optionValueIndex` computed (`valueIndex(resolvedOptions(), compareWith(), (o) => o.value)`) that rebuilds once per option-list or comparator change and serves all of them. `mlv-select`'s `_selectedValueIndex` is separate because it is keyed on a different signal (the selection) and rebuilds independently; its site is a template **method**, so it re-ran per option on every change-detection pass rather than only on signal changes.

**Strategy**, chosen once from `compare` alone via the same `hazardOf()`:

| `compare`                                                              | Container                                                        | Query cost                                           |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------- |
| `defaultCompareWith` / `Object.is`                                     | first-wins SameValueZero `Map`, grown to the walk cursor         | O(1) inside the prefix; resumes the walk beyond it   |
| a caller-supplied `compareWith`                                        | none                                                             | pairwise scan, unchanged                             |
| a recognised comparator, once the walk **passes** a hazard in `values` | latched off permanently — the prefix is abandoned, not consulted | pairwise scan, unchanged, for every subsequent query |

Note the third row is now reached _lazily_: a hazard sitting past the point the cursor ever reaches never disqualifies anything, because the values before it are all the index ever needed. `hazardOf(compare)` stays **eager** — it reads the comparator alone, needs no walk, and the strategy must be decided before the first query.

First-wins insertion is load-bearing: `resolve` and `find` are specified as `Array.prototype.find`, which returns the **earliest** match, so a later duplicate key must not overwrite an earlier one. `Map.set` on an existing SameValueZero key replaces the **value** while keeping the original key, so the `has` guard before each `set` is what keeps `resolve(0)` returning `+0` from `[+0, -0]` under `===` — and the walk has to actually reach the `-0` for that to be exercised at all.

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
- `dropdown-panel.spec.ts` (39 tests): activedescendant option ids / active highlight; `ariaLabel` names the inner listbox and is absent by default; self-owned themed `mlv-scrollbar` integration with its viewport removed from the composite widget's tab order; parent-scroll delegation renders the listbox without a nested scrollbar; **option groups** — one `role="group"` per consecutive run, `aria-labelledby` → presentational sticky header, headers excluded from `role="option"`, flat option-id alignment preserved across groups, flat `activeIndex` highlight when grouped, ungrouped arrays render with no group wrapper, headerless clusters for options without a `group`; plus **match highlighting** (`highlightQuery` wraps the matched substring in `<mark>` without changing label text) and the **loading affordance** (`loading` renders a `role="status"` row with `loadingText` and suppresses the empty projection). **Loading recede + paging** (7 tests): `loading` adds the `--loading` host modifier and `aria-busy` on the listbox while the options stay rendered (both cleared when it flips back); `loadingMore` renders the polite bottom `__loading-more` row with `loadingText`, no top row, and `aria-busy`; the sentinel emits `loadMore` exactly once when the scroll owner is scrolled within threshold while `hasMore` (and stays silent on the arming render); the auto-fill re-measure fires when an appended page still does not fill the scroll owner; `loadingMore` gates the sentinel (near-end scroll emits nothing until the page lands); a non-default `infiniteScrollThreshold` of 400 ignores a 500px distance and fires at 350px; nothing is emitted when `hasMore` is false. The paging tests stub `scrollHeight`/`clientHeight` on the panel's `.mlv-scrollbar__viewport` — jsdom reports `0` for every layout box, which otherwise reads as "already at the end" — and share an `arm()` helper that renders, stubs an overflowing-but-at-top viewport, and flips `hasMore`. **Parent-mode paging** (1 test): a `ParentScrollHost` renders the panel with `scrollMode="parent"` inside an `mlv-scrollbar`; the panel renders no scrollbar of its own, `_scrollContainer()` resolves to the **wrapping** `.mlv-scrollbar__viewport`, and scrolling that viewport within threshold emits `loadMore` exactly once (silent while parked at the top). **Missing scroll owner** (3 tests, `console.warn` spied): parent mode with no scrollbar ancestor warns once when `hasMore` flips true (and never again for that instance), stays silent while `hasMore` is false, and stays silent in self mode. **Activedescendant highlight parity** (5 tests, #75): `dropdown-panel.scss` **and** `list-item.scss` are both compiled through Sass and their emitted declarations read directly (jsdom applies no `styleUrl` and resolves neither `var()` nor `calc()`) — the active row's `outline` is asserted **equal to the one `list-item.scss` declares** for `:focus-visible` rather than to a restated literal (with a non-empty guard so it cannot pass vacuously on two empty strings), the inset matches the panel's own roving rule, the active selector out-specifies every `outline` rule in `list-item.scss`, and the row declares **no** background and **no** `z-index` while `__group-header` still declares one (asserted as "declared", not as a literal — #109 lifted it off `1`). The last two are what catch the first attempt at this fix, which tinted `__surface` and lifted the row over the sticky header. **Check-mark agrees with the comparator** (6 tests, #132): a `NaN` row stays unticked under the `===` default (where a `Set` ticked it) with no row reporting `aria-selected="true"`; a custom `compareWith` ticks the row it matches a _fresh_ object to, not the one `===` matches; an explicit `compareWith` input beats the service's; the default comparator still ticks exactly the reference-equal rows; and — the two that pin `_ariaValues` — a fresh-object selection matched only by `compareWith` emits **nothing** on first render (the panel used to emit `[]` from aria's reconciliation effect, clearing the consumer's selection a frame after the tick appeared) and renders `aria-selected="true"` on the matched row. The `NaN` specs narrow their `console.warn` mute to aria's two violation lines and forward everything else, so a warning this library starts emitting cannot hide behind it.
- `dropdown-panel-i18n.spec.ts` (5 tests, #370): the default `loadingText` is English "Loading…" with no i18n provider and under the testing pack, the `de` pack's `dropdownPanel.loading` in both rows, English for a hand-written pack without the slice, and an explicit `loadingText` beats the pack.
- `dropdown-panel-empty-slot.spec.ts` (4 tests, #370): the `[mlvDropdownPanelEmpty]` row renders after the listbox, not inside it; a full axe sweep of that state; withheld while `loading`; withheld while there are options.
- `dropdown-panel-window.spec.ts` (39 tests, #318): **rendering** — 5,000 options render exactly 100 rows carrying `aria-setsize="5000"` / `aria-posinset`, a list that fits carries neither attribute, a grouped truncated list numbers each labelled group and the headerless options at listbox level, the window does not grow without layout (jsdom's zero metrics), and the first page of 5,000 options renders in under 500 ms (was 12.5–12.9 s unwindowed; ~33 ms windowed). **Growing** — a near-end scroll grows by one page while rows are withheld and emits `loadMore` only once the window is complete, the window survives a page appended behind it and the same options regrouped, clearing a filter re-mounts one page, and in `scrollMode="parent"` the window grows from the wrapping scrollbar viewport and pages the source once complete; with no scroll owner at all it renders all 250 options, with no set-position attributes and no warning until `hasMore` is set. **Roving keys** — End focuses the true last option, ArrowUp on the first wraps to it, ArrowDown past row 99 lands on row 100, typeahead reaches a match at row 250, Ctrl+A in a multi-select emits all 350 values, Ctrl+Shift+End and Cmd+Shift+End extend a multi-select range to row 349 (350 values), and Shift+ArrowDown from row 99 emits `[v99, v100]`. **Key mirror** — the live aria `Listbox` equals `MIRRORED_LISTBOX_CONFIG`. **Roving default tab stop** — a disabled checked row is skipped for the enabled checked row past the window, a disabled 100-row prefix still renders row 100 as the tab stop (the listbox does not take `tabindex="0"`), a committed value set before interaction becomes the tab stop, and after focus, after a click on a disabled row (no focus moves), or after deselecting the first of two checked rows the window stays at 100 and the tab stop stays put; replacing the options under an interacted listbox pins the new default again, and so does every change that re-creates the rows of unchanged values — the list turning grouped, a group past the window turning it grouped, the active row moving to another run, its run losing its label, a `scrollMode` change — while a group renamed in place keeps the latch and the window. **Activedescendant** — `activeIndex` 250 renders that row, its id resolves and it is scrolled into view. **Withheld selection** — a multi-select keeps a committed value past the window through aria's reconciliation and merges it back in committed order on a user pick; a single-select committed row at 250 is rendered and is the tab stop. **axe** — full sweeps over a truncated flat list, a truncated grouped list and an activedescendant row past the window. Layout is simulated by stubbing the viewport's `clientHeight` and a `scrollHeight` proportional to the rendered rows (a static stub reads as "short page" and auto-fills every page). The far-jump tests bind 350 options, not thousands: a jump mounts every row up to its target, and at 2,000 options one Ctrl+A test timed out at 5 s on a loaded machine. Every behaviour test was ablated against its half of the change (keys, withheld merge, tab stop, layout guard, after-render scroll; then the interaction latch, each of its click and focusin listeners, the latch reset, the focusable filter and first-focusable fallback, both range branches, the Cmd variant, the config constant and the no-owner fallback; then, for the view-survival rule, the values-only rule, each of the grouped, `scrollMode`, run-start and labelled comparisons, an exact-label comparison and a limit that resets with the views) and goes red without it.
- `option-window.spec.ts` (13 tests, #318): `ariaDefaultTabStop` — first checked focusable, else first focusable, else `-1`; `windowLimitFor` page rounding (`-1` → 0); `windowSurvival` — `'views'` for the same array, appended rows, changes past the window and a group renamed in place, an empty `group` read as none; `'rows'` when a rendered row changes run (a moved boundary, labelled ↔ headerless); `'none'` for a changed rendered position, outranking a regrouping before it, `Object.is` over `NaN` / `-0`; `optionSetPositions` ungrouped and grouped (labelled runs local, headerless runs at listbox level across groups).
- `dropdown-panel-stacking.spec.ts` (4 tests, #109): the paint-order contract between the sticky `__group-header` and a `:focus-visible` option row on the roving path. Compiles `dropdown-panel.scss`, `list-item.scss`, `list-item-group.scss` and `theme.scss`, resolves each declared `z-index` to its effective integer through one `var(--mlv-z-*)` indirection, and asserts the header's is **strictly greater** than the row's — strictly, because the header precedes those rows in DOM order and loses every tie. Also pins the three facts the fix rests on: `__group` stays a plain `display: block` box (isolating it would put the header and rows in one context together and reinstate the tie), the header sits at the same level as `list-item-group.scss`'s own sticky `__toggler`, and the row keeps a non-zero `z-index` — its Form A ring paints outside a flush row's border box, so an adjacent hovered or selected row would otherwise paint over it. Reads compiled CSS rather than computed styles because component styles are not injected under this workspace's jsdom setup and jsdom does not resolve `var()` in `getComputedStyle`.
- `option-matcher.spec.ts` (77 tests): `normalizeForMatch`, `defaultOptionMatcher` (case/diacritic-insensitive, blank-query-matches-all), `filterOptions` (blank returns a copy, default + custom matcher), `matchSegments` (blank, mid/leading match, diacritic alignment, no-match). **Fast-path equivalence** — the file keeps verbatim copies of the pre-fast-path `normalizeForMatch` / `matchSegments` as oracles and asserts deep-equal output across a 26-case table (pure ASCII, accented label with ASCII and accented queries, marks already in NFD, match at index 0, match at the last character, whole-label match, empty label, empty and whitespace-only query, no-match, repeated substring, an ASCII label against a query folding to non-ASCII, a query folding to nothing, and eight `^`/`` ` `` cases — the two ASCII `Diacritic=Yes` code points, which the full pipeline strips, so an ASCII label carrying one is _not_ index-aligned with its fold and must not take the direct-slice path). **Fast-path guards** — a `traceNormalize` helper (reading the call count _before_ `mockRestore()`, which clears it) asserts an ASCII label + ASCII query causes zero `String.prototype.normalize` calls and a non-ASCII label exactly one, and a `^`-bearing ASCII label at least one; a `traceFolds` helper traces every `String.prototype.toLowerCase` receiver and asserts the ASCII label is folded once rather than once per code point, and that `filterOptions` with the default matcher folds each label (and the query) exactly once rather than twice. **Custom matcher** — invoked once per option with the trimmed query, in order, with ranking still applied. **Group runs** — two non-consecutive runs of the same group never merge, through both `rankPrefixMatchesFirst` and the fused `filterOptions` path; a missing `group` and an empty-string `group` are one run (`?? ''`); empty input returns an empty array. **Astral (surrogate-pair) code points** (11 tests) — regression cover for issue #58: the folded projection now pushes one `originIndex` entry per code _unit_, so `originIndex.length === folded.length` holds for every input. Covered: an emoji in both label and query, a bare astral query, an astral code point before / inside / spanning the match, several astral code points at once (a single-code-point off-by-one would not pass), a wholly-matched astral label (neither surrounding segment), astral + precomposed and decomposed accents in one label, a label of only astral code points, non-emoji astral (CJK ext. B U+2000B, math alphanumeric U+1D54F), and a no-match that must not corrupt the label. The equivalence oracle is **kept but no longer total**: it still encodes the pre-#58 desync, so astral inputs are excluded from its table (with a comment) and asserted against explicit expected output instead — the ASCII / accented / `^`-`` ` `` cases it does cover are what proves the fast path unchanged. **Differential fuzz** (4 tests) — an independent code-point reference implementation (`Array.from` + a code-point array search, no string indices, so the desync is unrepresentable) is compared against `matchSegments` over a 500-seed deterministic corpus (mulberry32) drawn from a mixed alphabet: ASCII, `^`/`` ` ``, precomposed accents, the same accents in NFD, a bare combining mark, BMP CJK, and astral code points; queries are mostly code-point slices of the label (sometimes upper-cased), the rest independently generated. Plus two implementation-free invariants over the same corpus (segments concatenate back to the exact label; at most one matched segment and never an empty one) and a **teeth check** that runs the corpus through the buggy oracle and requires it to diverge — and requires every divergence to involve an astral code point. **Astral vs. the ASCII fast path** — an astral label is never routed down it (an ASCII label cannot hold a surrogate pair), evidenced by `traceFolds` showing the label folded per code point rather than whole; an ASCII label with an astral query stays on the fast path and correctly reports no match.
- `active-descendant.spec.ts` (16 tests): `optionId` format (`<listboxId>-option-<index>`, panel-id parity); `MlvActiveDescendant` — start at `-1`, `move` wrap-around (first/last from `-1`, forward/backward wrap, count-0 → reset, lazy/live count), `first`/`last` (activate, no-op when empty, live count), `reset`.
- `select-option.spec.ts` (29 tests, #300): `isSelectOption` / `defaultOptionTransform` over a `{ label, value }` option whose value is `false`, `0`, `''`, `NaN`, `null` and `undefined` — each recognised and returned **by reference** with its value intact; an empty-string label, a label and value both falsy, an inherited `value` getter, `group` / `disabled` carried on a falsy-valued option, and `resolveOptions` over a mixed falsy list (no `[object Object]` label). Plus the unchanged answers: a truthy pair and a non-string label (`{ label: 2024, value: 2024 }`) still pass, and `null`, `undefined`, primitives, a label-only / value-only object and a nullish label are still wrapped as raw items.
- `highlight-match.pipe.spec.ts` (4 tests): nullish label, empty-string label yields one empty unmatched segment (#300), segmentation, empty query.
- `options-result.spec.ts` (3 tests): `toOptionsResult` normalises an array, a Promise, and an Observable to the same one-shot emission (moved here with the helper from `core-autocomplete`).
- `options-adapter.spec.ts` (21 tests): array source (local, ready, `items`, nullish → `[]`, `search()` no-op); observable source (loading until first emission, latest emission wins, reference change re-subscribes / resets `ready` / drops late emissions from the old observable); `MlvDataSource` (`MlvSelectDataSource` → remote, ready immediately, `setSearch({ query, keys: [] })` and `null` for a blank query; a paged remote stub → loading until the first slice, `loadMore()` accumulates pages, `loadingMore` vs `loading`, stale items kept, exhausted/in-flight `loadMore()` is a no-op, a new search resets to page 1; `debounce` coalesces rapid `search()` calls); **paging edge cases** — a double `loadMore()` on an in-memory source (which never reports `loading`) does not skip page 2, a re-emit of the applied page replaces its tail instead of duplicating rows, and `loadMore()` stays blocked until the requested page is applied then allows the next; `searchFn` (remote, lazy until `ensureLoaded()`, `eager` loads at construction, newer query supersedes an in-flight one, errors → `[]` + `ready`, arrays / Promises / Observables, a swapped function only re-arms the lazy gate — the previous result and `ready` survive until the new function answers, and it is invoked exactly once while the old one is never re-invoked — re-binding an _equivalent_ arrow twice leaves an in-flight call untouched and its result still applies, and a data source passed alongside is never connected). Adapters are built with `runInInjectionContext(TestBed.inject(Injector), …)` and effects flushed with `TestBed.tick()`; `RemoteStub` counts both requests and `connect()` calls.
- `reconciliation.spec.ts` (84 tests): `isReconciliationEmit` — true when nothing is added and every removed value is filtered out of view, true when the emit restates the committed selection, true for the empty-options initial load, false when a value is added, false when a still-visible value is removed (genuine deselect); `filteredOutCommitted` returns committed values that are neither incoming nor visible (empty when all are visible). Plus the fast-path suite: `defaultCompareWith` is `===` (reference equality for objects, `NaN !== NaN`, `+0 === -0`); a **differential fuzz** of 600 seeded random inputs per comparator (`defaultCompareWith`, `Object.is`, a custom by-id predicate, and a custom **asymmetric** `lexicallyBefore`) over a pool loaded with `NaN`, `±0`, and distinct-but-structurally-equal objects, checked against verbatim copies of both pre-change implementations; the **SameValueZero hazards** explicitly (a re-emitted `NaN` is an addition under `===`, not reconciliation; a committed `-0` is matched by neither an incoming nor a visible `+0` under `Object.is`; both hazards under a custom comparator); **order preservation** (committed order and duplicates survive, the committed instance is returned rather than a by-id-equal one); and that the **fast path is actually taken** — with R=50 committed and V=1000 visible, `visible` is walked exactly V times under either identity comparator and exactly R×V times under a custom one or when a hazard forces the fallback, measured through index accessors because `defaultCompareWith` cannot be wrapped in a spy without destroying the reference it is recognised by.
  Of those, the **`valueIndex`** suite is 42: a differential fuzz of 600 seeded random inputs per comparator (4 comparators, 4,800 index instances, **59,552 exact assertions**) against verbatim copies of the scans it replaces, written in the controls' original `options.some((o) => compare(o.value, v))` / `options.find(...)?.value ?? v` / `options.find(...)` shape (the last is `find`, checked by identity on both the projected and the plain index) — each index is queried in a **seeded random order**, with every query asked twice, because the progressive walk carries a cursor and an answer could otherwise depend on what was asked before it; empty haystack and empty query set; `resolve` returns the **first** match on the pairwise path _and_ on the keyed path (pinned with `values = [+0, -0]` under `===`, where a last-wins `Map` insertion would return `-0`) and the **indexed** instance, and keeps the `?? value` tail for a nullish indexed value; the SameValueZero hazards — `NaN` in the haystack bails under `===` but not under `Object.is`, `-0` disqualifies the index on the **keyed** side under `Object.is` while a `-0` **query** against a hazard-free haystack is answered pairwise per query, and `±0` under `===` needs no bail at all because a `Map` reproduces `+0 === -0`; and that the **fast path is actually taken** — with R=50 queries against V=1000 values, the haystack is read exactly V times under either identity comparator, exactly R×V under a custom comparator (with matching `compare` call counts), `1 + R×V` when a hazard at index 0 forces the bail, and `2×V` when one hazardous query falls back while the rest stay keyed. (Those four are all-miss workloads, so they hold identically for an eager, a lazy and a progressive build — they pin the _strategy_, not the walk.) `find` (#349) has its own 8: the option **instance** on a hit and `undefined` on a miss or an empty haystack; the **first** match on the keyed path (`±0` under `===`), after a walk that passed the duplicate, on the pairwise path (custom by-id comparator), after a `NaN` bail and for a hazardous `-0` query under `Object.is`; `resolve(v) === find(v)?.value ?? v`; and that it shares the progressive walk with `has` / `resolve` (read counts through `countingArray`). Ablating first-wins storage (`seen.set` without the `has` guard) fails four of them, the two identity-comparator fuzzes among them.

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
- `@malva-ui/cdk/utils` — `mlvNextId` (stable fallback id for the inner listbox when no `listboxId` is supplied), `normalizeForMatch` and `defaultCompareWith` (both re-exported for existing consumers; implementations now live here)
- `@malva-ui/cdk/data-source` — `MlvArrayDataSource`, extended by `MlvSelectDataSource`; `MlvDataSource` + `MlvSearchState`, the paged/remote branch of `MlvOptionsAdapter`
- `@lucide/angular` — `LucideCheck` icon
