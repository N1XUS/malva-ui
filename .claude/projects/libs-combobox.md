---
# Library: combobox

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Combobox library (`@malva-ui/core/combobox`) provides a searchable dropdown supporting both single and multiple selection. It supports signal, reactive, and template-driven forms alongside custom templates, value creation, clearing, and an activedescendant keyboard model.

## Public API

Exported from `libs/core/combobox/src/index.ts`:

| Export | Kind | Description |
|--------|------|-------------|
| `MlvCombobox<T>` | Component | Main combobox — `mlv-combobox` |
| `MlvComboboxItemDef` | Directive | Custom option template — `[mlvComboboxItemDef]` |
| `MlvComboboxSelectedItemDef` | Directive | Custom selected-value template — `[mlvComboboxSelectedItemDef]` |

---

## Components

### `MlvCombobox<T>`

**File:** `libs/core/combobox/src/lib/combobox/combobox.ts`
**Template:** `libs/core/combobox/src/lib/combobox/combobox.html`
**Styles:** `libs/core/combobox/src/lib/combobox/combobox.scss`

- **Selector:** `mlv-combobox`
- **Change Detection:** `OnPush`
- **Extends:** `MlvSignalFormControlBase<T | T[] | null>`

#### Inputs (own)

| Name               | Type                                                                                                       | Default                                   | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `options`          | `MlvOptionsInput<T>` (`readonly T[] \| Observable<readonly T[]> \| MlvDataSource<T> \| null \| undefined`) | `[]`                                      | Selectable options. Arrays / observables are **local** (this component filters); an `MlvDataSource` is **remote** (source-side search + lazy paging). See _Async sources & remote search_.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `searchFn`         | `MlvOptionsSearchFn<T> \| null`                                                                            | `null`                                    | Remote search `(query) => T[] \| Promise<T[]> \| Observable<T[]>`. **Supersedes `options`** as the item source and disables local filtering. Lazy: first invoked on the first open (or immediately when a committed value still needs its label).                                                                                                                                                                                                                                                                                                                                                                                                           |
| `searchDebounce`   | `number`                                                                                                   | `200`                                     | Debounce (ms) applied to remote searches (`MlvDataSource` / `searchFn`) only. Local filtering stays instant.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `multiple`         | `boolean`                                                                                                  | `false`                                   | Multi-select mode (renders chips)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `placeholder`      | `string \| undefined`                                                                                      | `undefined` → i18n `'Search...'`          | Input placeholder. Falls back to `MLV_COMBOBOX_I18N.searchPlaceholder`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `allowCreate`      | `boolean`                                                                                                  | `false`                                   | Allow creating new values via Enter                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `toOption`         | `MlvSelectOptionTransform<T>`                                                                              | `defaultOptionTransform`                  | Transform `T` → `MlvSelectOption`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `compareWith`      | `(a: T, b: T) => boolean`                                                                                  | `defaultCompareWith` (reference equality) | Equality used to match option values against the selection and externally written values. Threaded into `MlvSelectionService.compareWith`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `matcher`          | `MlvOptionMatcher<T> \| undefined`                                                                         | shared substring matcher                  | Custom suggestion-filter predicate (fuzzy / secondary-field). Threaded into the shared `filterOptions`; results are always ranked prefix-matches-first. Mirrors `[mlvAutocompleteMatcher]`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `mobileMode`       | `MlvPopupMobileMode` (`'auto' \| 'fullscreen' \| 'off'`)                                                   | `'auto'`                                  | Passthrough to the dropdown `mlv-popup`. `'auto'` = full-screen sheet below the `md` breakpoint (&lt; 768px), anchored above; `'off'` = always anchored; `'fullscreen'` = always sheet. In full-screen mode the combobox projects an in-sheet search input into the popup header (see _Mobile fullscreen_ below).                                                                                                                                                                                                                                                                                                                                           |
| `mobileTitle`      | `string \| undefined`                                                                                      | `undefined`                               | Explicit full-screen sheet heading. When omitted, falls back to `label` (or, when unset, the resolved placeholder) via `_resolvedMobileTitle`. Only shown while full-screen.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `dropdownMinWidth` | `number \| string \| undefined`                                                                            | `undefined`                               | Raises the dropdown panel's minimum width above the trigger. The floor defaults to the trigger's measured width; this can only **raise** it — the trigger width stays in the emitted `max(<trigger>px, <authored>)`, so a narrower value never shrinks the panel. A number is treated as px; a string is any CSS length, resolved by the browser rather than converted here — but **not `%`** (it resolves against the bounding box, i.e. the free space to the viewport edge). Outranks both ceilings: a `dropdownMaxWidth` below it is ignored, and a floor wider than the space to the viewport edge overflows the viewport. See _Dropdown panel width_. |
| `dropdownMaxWidth` | `number \| string \| undefined`                                                                            | `undefined`                               | Caps the dropdown panel's width. With no value the viewport is the only ceiling (the flexible strategy's bounding box + `.cdk-overlay-pane { max-width: 100% }`); this can only **tighten** that — a value wider than the viewport is still clamped by it. It cannot pull the panel below its floor: a value under the effective `min-width` is silently ignored. Passed straight to `mlv-popup [maxWidth]`, which CDK applies to the bounding box under `flexibleDimensions` + `withPush(false)`.                                                                                                                                                          |
| `mlvDensity`       | `MlvDensity \| undefined`                                                                                  | `undefined`                               | Density for the dropdown option list. Forwarded to the dropdown `mlv-popup`, which stamps `mlv--{density}` on the detached overlay panel (outside the page's density cascade); rows respond via the `mlv-list-item` density ladder. Omitted → global `MlvDensityService`.                                                                                                                                                                                                                                                                                                                                                                                   |

#### Inputs (from MlvSignalFormControlBase)

`state`, `readonly`, `disabled`, `clearable`, `id`, `label`, `hint`, `message`, `loading`

`loading` is now **rendered**: it ORs into the dropdown's spinner row (`_panelLoading`) and suppresses `_ready`, so a consumer-driven load also holds the field's loading variant while a committed value's label is pending. Bind it to a flag that is genuinely about **option loading** — because it feeds `_ready`, an unrelated flag (a save in flight, a page-level spinner) will put the field into the loading variant whenever the committed value is not among the current results.

#### Outputs

| Name           | Type        | Description                                                                                                 |
| -------------- | ----------- | ----------------------------------------------------------------------------------------------------------- |
| `valueCreated` | `output<T>` | Emitted **only** when the user actually creates a brand-new value via Enter (ADD-only; never on duplicates) |

#### Computed / State Signals

| Signal                            | Description                                                                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isOpen`                          | Popup open state (two-way bound to `mlv-popup`)                                                                                                                                 |
| `searchQuery`                     | The input's text. For single-select this doubles as the committed label when not actively searching                                                                             |
| `resolvedOptions`                 | `_adapter.items()` passed through `toOption()`                                                                                                                                  |
| `filteredOptions`                 | Options filtered by the live search text — **local mode only**; remote sources render `resolvedOptions` as-is                                                                   |
| `selectedOptions` (protected)     | Selected values resolved to `MlvSelectOption` for chip / template rendering                                                                                                     |
| `_chipOptions` (protected)        | The chips actually rendered (both the trigger row and the full-screen sheet): `selectedOptions`, minus the values whose option has not resolved yet while `_awaitingValueLabel` |
| `_adapter` (protected)            | The shared `MlvOptionsAdapter<T>`; template-facing for the paging bindings (`hasMore` / `loadingMore` / `loadMore()`)                                                           |
| `_allValuesMatched` (protected)   | Whether every committed value has a matching option (by `compareWith`)                                                                                                          |
| `_ready` (protected)              | `_adapter.ready() && !loading()` — the first payload arrived and no consumer-driven load is running                                                                             |
| `_awaitingValueLabel` (protected) | The loading variant: `hasValue() && !_ready() && !_allValuesMatched()`                                                                                                          |
| `_panelLoading` (protected)       | `_adapter.loading() \|\| loading()` — the dropdown's top spinner row                                                                                                            |
| `_pressEnterToAdd` (protected)    | `MLV_COMBOBOX_I18N.pressEnterToAdd` resolved with `{ query }`                                                                                                                   |
| `_eagerDone` (private)            | Latches `true` on the first `ready()` of a **remote** source; gates the adapter's `eager` flag off so an inline-arrow `searchFn` cannot loop (see _Async sources_)              |
| `focused`                         | `true` while focused **or** open (keeps the focus ring while the dropdown shows)                                                                                                |

#### Host Bindings

```ts
host: {
  'class': 'mlv-combobox',
  '[class]': '"mlv-combobox--" + state()',
  '[class.mlv-combobox--disabled]': 'computedDisabled()',
  '[class.mlv-combobox--open]': 'isOpen()',
  '[class.mlv-combobox--multiple]': 'multiple()',
  '[class.mlv-combobox--loading]': '_awaitingValueLabel()',
}
```

#### Content Children

| Name               | Directive                    | Description                                                                               |
| ------------------ | ---------------------------- | ----------------------------------------------------------------------------------------- |
| `itemTemplate`     | `MlvComboboxItemDef`         | Custom option rendering in the dropdown                                                   |
| `selectedTemplate` | `MlvComboboxSelectedItemDef` | Custom rendering of the selected value(s) — **now actually rendered** (see Display below) |

#### Key Methods

- `onSearchInput(event)` — Updates the search text, opens the popup, resets the active option
- `onInputFocus()` / `onInputBlur()` — Open on focus / close-revert-and-mark-touched on blur (wired to `mlv-input`'s new `inputFocus` / `inputBlur` outputs)
- `onArrowDown` / `onArrowUp` / `onHome` / `onEnd` — Move the active option (activedescendant model, DOM focus stays in the input)
- `onEnterKey(event?)` — Select the active option, else an exact text match, else create (allowCreate)
- `onEscape(event)` — First press closes + reverts text; second press (already closed) clears the selection — only while `_canWrite()` (not readonly, not disabled; #301)
- `onClear()` — Clear the selection + query, emit `null`, re-search `''` for a remote source, refocus the input. Not gated itself (callable from app code); both user paths are gated before it — the inline X renders only while writable, `onEscape` checks `_canWrite()` (#301). Also bound to the wrapper's `(clear)`, which never fires: `ownsClearButton` is always `true`, so the wrapper renders no X of its own
- `onChevronMousedown(event)` — Chevron toggle (uses `mousedown` + `preventDefault` so the input keeps focus)
- `selectValues(values)` — Panel (pointer) selection path. Guards against aria **reconciliation emits** (see below) so a filter change never mutates the committed selection or runs commit side-effects
- `removeSelected(value)` — Deselect one value (multi-select chip close / keyboard remove)
- `setInitialFocus()` — Focuses the inner `mlv-input` (**not** the trigger `<div>`)
- `updateTriggerWidth(entries)` — Sync popup width to trigger via `MlvResizeObserver`

#### Display model (single vs multi)

- **Single-select:** the selected option's label is the **real input value** (`searchQuery` mirrors the committed label when not searching) — full contrast, exposed to AT. Typing replaces it; closing without a new selection reverts to the committed label. The placeholder stays the generic search hint (it is never used to show the value). When a `selectedTemplate` is provided, it renders as an overlay over the (transparented) input while the field is unfocused; the input keeps the label as its accessible value.
- **Multi-select:** selected values render as closable `mlv-chip`s before the search field. Chip close (mouse click or Backspace/Delete when focused) deselects that value. When a `selectedTemplate` is provided, it renders inside each chip.

#### Trigger-row height & vertical centring

The trigger row (`.mlv-combobox__trigger`, a `flex-wrap: wrap` row of chips + the `mlv-input` field + chevron) drives the control height:

- The form-control container is overridden to `height: auto; min-height: var(--form-ctrl-height)` so the **empty / single-select** field matches a plain `mlv-input`'s height and text centring at the current density, while **multi-select grows** vertically to fit chips that wrap onto additional lines.
- `align-content: center` centres the wrapped flex line(s) so the field/chips stay vertically centred per line (with `flex-wrap: wrap`, `align-items` alone leaves a single line top-packed).
- `.mlv-combobox__input` (the inner `mlv-input` host) is **layout-only** (`flex: 1; min-width: 0`). It must NOT re-declare the native input's padding/font/background — the `mlv-input` component (`bare` mode) owns those. A stale `padding: 0.5625rem 0` here previously stacked on top of the native input's own padding + the trigger's control-padding, inflating the empty field past the control height and pushing the placeholder off-centre.
- Small densities (`tight`) render marginally taller than a bare `mlv-input` because the `bare` native input's intrinsic height plus the trigger's chip-breathing padding exceeds the tightest control height; text stays centred.

#### Chevron

The dropdown chevron is a real `<button type="button" tabindex="-1">` with an i18n `aria-label` (`MLV_COMBOBOX_I18N.toggleOptions`). It is out of the tab order (the input is the single tab stop), `[disabled]` when the control is disabled, and no-ops when disabled/readonly. While `_awaitingValueLabel()` the chevron is **replaced** by an `mlv-loader` (`.mlv-combobox__loader`, `variant="circle" indeterminate`) — the field is inert then, so a toggle button would be a dead control.

#### Async sources & remote search

`options` and `searchFn` are normalised by the shared **`MlvOptionsAdapter<T>`** (`@malva-ui/core/dropdown`, `_adapter`) — the same engine behind `[mlvAutocomplete]` and `mlv-select`. It exposes `mode()`, `items()`, `loading()`, `loadingMore()`, `ready()`, `hasMore()`, `search()`, `ensureLoaded()`, `loadMore()`; see `libs-dropdown.md` → _Options adapter_ for the per-source contract.

- **Local mode** (`readonly T[]`, `Observable<readonly T[]>`) — `filteredOptions` runs the shared `filterOptions` over the typed query exactly as before. Behaviour for a plain array is unchanged.
- **Remote mode** (`MlvDataSource<T>`, or any `searchFn`) — the source owns filtering. `filteredOptions` returns `resolvedOptions` untouched, and `onSearchInput` forwards the query through `_adapter.search(value)` (`MlvDataSource` → `setSearch({ query, keys: [] })`; `searchFn` → invoked). Filtering locally as well would hide server results the local matcher does not like, and would empty the list while a newer query is still in flight.
- **Debounce.** `searchDebounce` (default `200`ms) applies to remote searches only.
- **Lazy first load.** A `searchFn` is not called until it is needed: a constructor effect calls `_adapter.ensureLoaded()` on the first `isOpen()`. The exception is the adapter's `eager` gate — `hasValue() && !_allValuesMatched() && !_eagerDone()` — which fires the initial load immediately when a committed value still has no resolvable label, so the loading variant resolves without the user opening the list. `_eagerDone` latches `true` the first time a **remote** source reports `ready()` and never flips back: an inline-arrow `searchFn` (`[searchFn]="(q) => api.find(q)"`) is a fresh reference on every change detection run, which re-arms the adapter's lazy gate on every pass, and without the latch a still-unmatched committed value would make each pass fire another request whose result triggers the next pass. The mode check in the latch matters — an array source is `ready()` from the first tick, so latching on readiness alone would disarm the gate before a late-bound `searchFn` ever became the active branch.
- **Remote reset whenever the query is dropped.** `_remoteQuery` tracks the last non-blank query sent to a remote source, and `_resetRemoteSearch()` re-searches `''` once so a blank input never sits above a list still filtered by the previous query. It is called from `_revertAndClose()` (blur / Escape), **both** branches of `_afterCommit()` (single-select reverts to the committed label; multi-select clears the query to type the next one), and `onClear()`. Local mode restores the full list implicitly — `filteredOptions` re-runs with a blank query — so these calls are what give remote mode the same behaviour.
- **The typed query survives every response.** `_applyPendingValues()` runs inside the forms-value effect, which tracks `resolvedOptions()` — so it re-runs on every remote response and every observable emission. It still re-normalises the committed values (that is what resolves a late label), but it calls `_syncDisplayText()` only when `_searching()` is `false`, read untracked. Without that guard each landing response reset the input to the committed label (or `''`), making remote search unusable. Every exit from a search — commit, revert, clear — calls `_syncDisplayText()` itself, so the label still returns when the search ends.
- **The list stays open while loading.** `_panelLoading` (`_adapter.loading() || loading()`) drives the panel's top spinner row and its `--loading` modifier; the panel keeps previous options mounted, readable and interactive (it recedes the default rows' colour rather than dimming them), so a re-search never blanks the dropdown.
- **Paging.** `[hasMore]`, `[loadingMore]` and `(loadMore)` are bound straight off the adapter, so an `MlvDataSource` with a finite `perPage` grows the list through the panel's infinite-scroll sentinel. The unpaged `MlvSelectDataSource` simply reports `hasMore: false`.

#### Loading variant (`--loading`)

`_awaitingValueLabel()` = `hasValue() && !_ready() && !_allValuesMatched()` — a value is committed but no option resolves its label yet (the classic "deserialized id, options still in flight" case). While it holds:

- the host carries `mlv-combobox--loading` (`cursor: progress`),
- the trigger row sets `aria-busy`,
- the inner `mlv-input` is `readonly`, renders an empty value, and shows `MLV_COMBOBOX_I18N.loading` as its placeholder,
- the chevron is replaced by the `mlv-loader` spinner,
- `_isInert()` returns `true`, so focus, click, typing and the arrow/Enter keys never open the list or select anything,
- `_chipOptions()` hides multi-select chips whose option has not resolved (no `[object Object]`-style placeholder labels).

**The clear affordance is the deliberate escape hatch.** `onClear()` and `onEscape()` are _not_ gated on `_isInert()`, so the inline X (and Escape while the list is closed) still discards the value even while its label is resolving. That is intentional: a value whose source never answers would otherwise be unremovable. Everything else — opening, typing, navigating, committing — is blocked. Both clear paths are still gated on **write permission** (#301): the X is withheld and Escape does not clear while readonly or disabled — `_canWrite()`, which does not include `_awaitingValueLabel()`.

The variant clears as soon as the source is `ready()` **or** every committed value matches an option — the `_applyPendingValues` effect tracks `resolvedOptions()`, so late-arriving options re-normalise the selection onto the real option instances and the committed label appears. Arrays are `ready()` immediately, so a synchronous `options` binding never shows the variant.

#### i18n keys used

`searchPlaceholder` (placeholder), `toggleOptions` (chevron `aria-label`), `noResults` (empty state + announcement), `pressEnterToAdd` (ICU `{query}` — the `allowCreate` empty state + announcement, resolved via `_pressEnterToAdd`), `loading` (panel `loadingText`, loading-variant placeholder, spinner `ariaLabel`), `resultsAvailable` (ICU `{count, plural, …}` — the polite result-count announcement). The two ICU strings are resolved with `MlvI18nResolverService`.

#### Template Summary

Form control wrapper (`(clear)="onClear()"`) → label/hint → popup container with a trigger row (`_chipOptions()` chips for multi + `mlv-input` + chevron button, or the `mlv-loader` while awaiting) → `MlvPopup` (`[hasBackdrop]="false"`, `[mobileMode]`, `[mobileTitle]`, `(afterOpened)`/`(afterClosed)`) with a `[mlvPopupHeaderContent]` template (the full-screen in-sheet chips + search input) and a `mlvPopupContent` template containing `MlvDropdownPanel scrollMode="parent"` with the filtered options plus the loading / paging bindings (`[loading]="_panelLoading()"`, `[loadingText]`, `[hasMore]`, `[loadingMore]`, `(loadMore)`). Parent mode delegates to the popup's themed scrollbar, ensuring the overlay has one scroll region. A `(mousedown)="$event.preventDefault()"` wrapper around the panel keeps DOM focus in the input while pointing at options (activedescendant + open state survive option/scrollbar clicks).

Dropdown popup chrome removes the default popup padding, and the shared dropdown listbox sets the option inset through `--mlv-list-padding-block` / `--mlv-list-padding-inline`.

#### Dropdown Positions

- Primary: below trigger (`bottom`, `offsetY: 8`)
- Fallback: above trigger (`top`, `offsetY: -8`)

#### Mobile fullscreen (in-sheet search input)

`mlv-combobox` opts its dropdown `mlv-popup` into `mobileMode="auto"` (overridable via the `mobileMode` / `mobileTitle` inputs). Below the `md` breakpoint (&lt; 768px) the dropdown opens as a full-screen sheet with a header bar, scroll-locked page, and slide-up animation; above it the dropdown stays trigger-anchored (byte-identical to before). See `libs-popup.md` → _Mobile fullscreen inputs_.

**The occlusion/focus-trap problem — and how it is solved.** `mlv-popup`'s full-screen sheet renders a **solid backdrop** (`.mlv-popup-fullscreen-backdrop`) and a **focus trap** (`[cdkTrapFocus]="modal() || isFullscreen()"`). The combobox's outer search field is a `mlv-input` in the **trigger row** (`.mlv-combobox__trigger`), in normal document flow **outside** the overlay panel — so in full-screen mode the backdrop would hide it and the trap would block `Tab` back to it, making type-to-filter impossible.

The fix is the popup's generic **`[mlvPopupHeaderContent]` slot** (see `libs-popup.md`): the combobox projects an **in-sheet search input** (a `mlv-input`, `.mlv-combobox__sheet-input`) — and, for multi-select, the selected chips (`.mlv-combobox__sheet-chips`) — into the popup's full-screen header, directly beneath the title/close row. The in-sheet input is bound to the **same** `searchQuery` signal and the **same** keyboard handlers (`onSearchInput` / `onArrowDown` / `onArrowUp` / `onHome` / `onEnd` / `onEnterKey` / `onEscape` / `onInputFocus` / `onInputBlur`) as the outer input — no logic is duplicated. It lives **inside** `mlvPopupContent`'s panel (the header is part of the trapped panel), so the focus trap composes cleanly.

Key behaviours (all gated on the popup's `isFullscreen()`, read via a `viewChild(MlvPopup)` → `_isFullscreen` computed):

- **Single `role="combobox"`.** `_outerIsCombobox = !(isFullscreen && isOpen)` drives the outer input's combobox ARIA (`role`, `aria-expanded/haspopup/autocomplete/controls/activedescendant`): the outer input keeps the role while anchored **or** full-screen-but-closed (it is the visible trigger then), and relinquishes it only while the sheet is open, when the in-sheet input carries the combobox ARIA (plus `aria-activedescendant` for keyboard nav and an `ariaLabel` from `_resolvedMobileTitle`). Exactly one combobox is exposed at a time.
- **Focus handoff.** On `(afterOpened)`, `_onPopupOpened()` focuses the in-sheet input by its deterministic id (`_sheetInputId = "<id>-sheet-input"`, located with `document.getElementById` because the sheet is a detached overlay embedded view outside this component's view queries — the same pattern `mlv-day-picker` uses). On `(afterClosed)`, `_onPopupClosed()` reverts stale search text (`_syncDisplayText`) and restores focus to the outer trigger input. Both are no-ops while anchored, so desktop is unchanged.
- **Blur does not dismiss the sheet.** `onInputBlur` returns early while `isFullscreen()` — the outer input blurs the moment focus is handed to the in-sheet input, and the trap keeps focus moving between the in-sheet input, chips, and options. The sheet is dismissed only via the X button, `Escape`, or a committed selection (all routed through `_onPopupClosed`). While anchored, blur still closes/reverts as before.
- **Chip removal** refocuses the in-sheet input while full-screen (`_focusActiveInput`), the outer input otherwise.
- **Loading variant parity.** The in-sheet input carries the same `_awaitingValueLabel()` bindings as the outer one (`[readonly]`, the `loading` placeholder, the emptied `[value]`), so a sheet opened over a still-resolving value is inert there too. The in-sheet chips already come from `_chipOptions()`.

`mlv-select` composes full-screen more simply (its trigger is a plain button and the dropdown panel is the whole interaction surface, so it needs no in-sheet input) — but both now support `mobileMode` end-to-end.

---

## Directives

### `MlvComboboxItemDef`

**Selector:** `[mlvComboboxItemDef]` | **File:** `libs/core/combobox/src/lib/combobox-template.directives.ts`

Provides `templateRef` for custom option rendering (`{ $implicit: MlvSelectOption<T> }`).

### `MlvComboboxSelectedItemDef`

**Selector:** `[mlvComboboxSelectedItemDef]` | **File:** `libs/core/combobox/src/lib/combobox-template.directives.ts`

Provides `templateRef` for custom selected-value rendering (`{ $implicit: MlvSelectOption<T> }`) — rendered inside chips (multi) or as the single-select display overlay.

---

## Usage Examples

```html
<!-- Basic single select -->
<mlv-combobox [options]="fruits" label="Fruit" />

<!-- Multi-select (chips) -->
<mlv-combobox [options]="items" [multiple]="true" label="Items" />

<!-- Allow creating new values -->
<mlv-combobox [options]="tags" [allowCreate]="true" (valueCreated)="addTag($event)" />

<!-- Object values with compareWith (survives serialize/deserialize) -->
<mlv-combobox [options]="users" [toOption]="userToOption" [compareWith]="(a, b) => a.id === b.id" [formControl]="ctrl" />

<!-- Grouped options (sticky, non-selectable headers via toOption `group`) -->
<mlv-combobox [options]="cities" [toOption]="cityToOption" />
<!-- cityToOption = (c) => ({ label: c.name, value: c, group: c.country }) -->

<!-- Custom option template -->
<mlv-combobox [options]="users">
  <ng-template mlvComboboxItemDef let-item> {{ item.label }} — {{ item.value.email }} </ng-template>
</mlv-combobox>

<!-- Clearable + disabled/readonly -->
<mlv-combobox [options]="opts" clearable [disabled]="isDisabled()" [readonly]="isReadonly()" />

<!-- Reactive forms -->
<mlv-combobox [formControl]="ctrl" [options]="opts" />

<!-- Observable source (loading variant holds until the first emission) -->
<mlv-combobox [options]="users$" [toOption]="userToOption" [formControl]="ctrl" />

<!-- Data source: source-side search + lazy paging -->
<mlv-combobox [options]="userDataSource" [toOption]="userToOption" [searchDebounce]="300" />

<!-- Remote search fn (supersedes [options]; no local filtering) -->
<mlv-combobox [searchFn]="searchUsers" [toOption]="userToOption" [loading]="resolvingInitialUser()" />
<!-- searchUsers = (query: string) => this.api.findUsers(query)
     Bind [loading] only to flags about *option* loading. It feeds `_ready`, so
     an unrelated flag (a save in flight, say) puts the field into the loading
     variant whenever the committed value is not in the current results. -->
```

---

## Dependencies

- `@angular/forms/signals` — signal-control contract with reactive/ngModel compatibility
- `@angular/cdk/overlay` — popup positioning
- `@angular/common` — `NgTemplateOutlet` (chip / selected-template rendering)
- `@malva-ui/core/popup` — `MlvPopup`, `MlvPopupContent`, `MlvPopupContainer`
- `@malva-ui/core/form-utils` — `MlvSignalFormControlBase`, `MlvSelectionService`, `toAriaValues`, `fromAriaValues`
- `@malva-ui/core/dropdown` — `MlvDropdownPanel`, `MlvSelectOption`, `MlvSelectOptionTransform`, `defaultOptionTransform`, `filterOptions`, `MlvActiveDescendant`, `optionId` (shared activedescendant bookkeeping + option-id format), `isReconciliationEmit`, `filteredOutCommitted` (shared aria reconciliation guard), `valueIndex` + `MlvValueIndex` (the shared option-value membership/resolution index), `MlvOptionsAdapter` + `MlvOptionsInput` / `MlvOptionsSearchFn` (the shared source adapter behind `options` / `searchFn`)
- `@malva-ui/core/input` — `MlvInput` (the trigger is a `mlv-input` carrying `role="combobox"`; exposes `inputFocus`/`inputBlur` outputs and `focus()`/`select()`)
- `@malva-ui/core/chip` — `MlvChip` (multi-select selected chips)
- `@malva-ui/core/loader` — `MlvLoader` (the loading variant's circular spinner in place of the chevron)
- `@malva-ui/i18n` — `MLV_COMBOBOX_I18N`, `MLV_FORM_UTILS_I18N`, `MlvI18nResolverService` (ICU `pressEnterToAdd` / `resultsAvailable`)
- `@malva-ui/cdk/utils` — `MlvResizeObserver`
- `@lucide/angular` — chevron icons

---

## Accessibility notes

- Exactly **one** `role="combobox"` — on the native `<input>` (forwarded via the `mlv-input` `role` input as a property binding, so no duplicate role leaks onto the `mlv-input` host). Alongside it: `aria-autocomplete="list"`, `aria-haspopup="listbox"`, `aria-expanded`, `aria-controls` (the rendered listbox id), and `aria-activedescendant` (the active option id). While the full-screen sheet is open the combobox ARIA moves from the outer trigger input to the in-sheet input (`_outerIsCombobox = !(isFullscreen && isOpen)`), so still exactly one combobox is exposed — see _Mobile fullscreen_ above.
- The dropdown chevron is a real labelled `<button type="button" tabindex="-1">` (kept out of the tab order), not a decorative `aria-hidden` span.
- **Activedescendant keyboard model:** DOM focus stays in the input; ArrowUp/ArrowDown/Home/End move the active option and update `aria-activedescendant`; typing keeps working mid-navigation (focus never leaves the input); Enter selects the active option; Escape closes (reverting text) then, when already closed, clears (writable only, #301).
- Tab from the open list closes the popup (via blur) and lets focus proceed naturally — no focus trap.
- A polite `aria-live` status region (`.mlv-combobox__sr-status`) announces the filtered result count / "No results" — both resolved from `MLV_COMBOBOX_I18N` (`resultsAvailable` is an ICU plural).
- The loading variant sets `aria-busy` on the trigger row and gives the `mlv-loader` an `ariaLabel` from `MLV_COMBOBOX_I18N.loading`; the field is `readonly` (not `disabled`) so it stays reachable and readable to AT while its value resolves.

---

## `@angular/aria` integration

The dropdown popup is the **migrated `@angular/aria` listbox** — `mlv-combobox` renders `mlv-dropdown-panel`, which host-applies `@angular/aria`'s `ngListbox`/`ngOption` (via `MlvListSelectable`/`MlvListItemSelectable`). No aria selectors are bound in `mlv-combobox` itself; the panel is consumed as-is.

**Trigger strategy — manual `role="combobox"` `mlv-input` trigger kept (not `ngCombobox`).** A full `ngCombobox` restructure was rejected (aria's `Combobox` renders its popup through `ngComboboxPopup`/`DeferredContent`, conflicting with the mandated CDK-overlay positioning). The manual trigger satisfies the full a11y contract with zero template restructure. Filtering stays consumer-side (`filteredOptions` computed).

**Activedescendant model (combobox-owned).** The combobox owns the active-option index and passes it to the shared panel through the in-context popup-content template:

- `mlv-dropdown-panel` exposes `focusMode` (`'roving' | 'activedescendant'`, default `'roving'`) and `activeIndex` inputs; the combobox pins `focusMode="activedescendant"` and binds `[activeIndex]`.
- **Shared bookkeeping (DRY).** The active-index state + wrap-around navigation is the shared `MlvActiveDescendant` class from `@malva-ui/core/dropdown` (`private _activeDescendant = new MlvActiveDescendant(() => this.filteredOptions().length)`); `onArrowDown/Up` → `move(±1)`, `onHome/End` → `first()/last()`, resets → `reset()`, and the template `activeIndex()` is `_activeDescendant.index`. `[mlvAutocomplete]` uses the same class (previously both carried a byte-identical private `_moveActive`).
- `MlvListSelectable` re-exposes aria's `focusMode` passthrough; `MlvListItemSelectable` re-exposes aria's `ngOption` `id` as `optionId`. The panel renders deterministic option ids (`<listboxId>-option-<index>`) via the shared `optionId()` helper — the combobox computes `_activeOptionId` with the **same** `optionId(this.listboxId(), index)` call, so the input's `aria-activedescendant` always matches the active row, and mirrors the highlight (`.mlv-dropdown-panel__item--active`).
- A service-bridge was intentionally avoided (out of scope for `MlvSelectionService`, which is limited to `compareWith`), and the input's DOM-focus retention makes typing-mid-navigation work — the reason the roving-focus `requestFocusFirst()` cross-component race no longer exists (the active index is combobox-owned state, not a `Subject` timing).

**Forms value ↔ aria bridge.** External `value` changes flow through `toAriaValues`, match current options via `compareWith`, and normalize onto option instances. `_emitValue()` uses `fromAriaValues` to collapse the aria array back to the public value shape. Both panel selection and Enter/create route through `_emitValue`.

The `aria-controls` linkage relies on `MlvListSelectable`'s `listboxId` forwarding — the trigger's `aria-controls` (`"<id>-listbox"`) resolves to the rendered listbox's real DOM id.

**Reconciliation-emit guard (data-loss regression fix).** The combobox binds `[options]="filteredOptions()"` into the aria listbox panel. `@angular/aria`'s `Listbox` runs an `afterRenderEffect` that reconciles its `value` model against only the currently-**rendered** options — whenever the rendered set changes it filters out values whose option is no longer present and re-emits `valueChange`. This is _not_ a user action, yet it reaches `selectValues`. Left unguarded it wiped the committed selection whenever typing filtered the selected option out of view (single-select lost its value on any re-search; multi/allowCreate dropped earlier picks while typing to add another), and a spurious re-emit could close a single-select popup mid-search. `selectValues` now detects a reconciliation emit — one that (a) adds no value not already committed and (b) only removes values whose option is currently filtered out of view (`_isReconciliationEmit`) — and **ignores it entirely** (no mutation, no `_afterCommit`). Genuine pointer selections still apply: an emit that adds a value or removes a still-visible one is a real interaction; in multi-select, committed values aria dropped only because they are filtered out of view are re-added (`_filteredOutCommitted`) so "type to add another" preserves earlier picks. `mlv-select` shares the panel but is unaffected — it has its own `valueChange` handler and its options do not change while open. The guard uses `compareWith` for all membership checks.

The guard's decision logic itself is no longer combobox-local: `_isReconciliationEmit` / `_filteredOutCommitted` keep their names but now delegate to the pure `isReconciliationEmit()` / `filteredOutCommitted()` functions in `@malva-ui/core/dropdown`, taking the visible set as a third parameter and `compareWith()` as the comparator. `selectValues` derives that set once per emit via the private `_visibleValues()` (`filteredOptions().map((o) => o.value)`) and passes it to both guards — it used to be re-mapped inside each, allocating the array twice per emit. `compareWith` also defaults to the **shared** `defaultCompareWith` rather than a per-instance inline arrow: identical `===` behaviour, but the guards recognise the reference and swap their R × V `compare()` scans for O(R + V) `Set` membership on every keystroke. `selectValues` is unchanged; the shared functions are unit-tested in `core-dropdown` (`reconciliation.spec.ts`) so `mlv-select` can adopt the same guard when it starts filtering its options.

**One shared option-value index (`_optionValueIndex`).** Three computeds cross-check the committed selection against `resolvedOptions()`, and each used to run its own nested `selected × options` scan:

| Site                  | Was                                                                     | Now                                          |
| --------------------- | ----------------------------------------------------------------------- | -------------------------------------------- |
| `_allValuesMatched`   | `selected.every((v) => opts.some((o) => compare(o.value, v)))`          | `selected.every((v) => index.has(v))`        |
| `_chipOptions`        | `selected.filter((s) => opts.some((o) => compare(o.value, s.value)))`   | `selected.filter((s) => index.has(s.value))` |
| `_applyPendingValues` | `pending.map((v) => opts.find((o) => compare(o.value, v))?.value ?? v)` | `pending.map((v) => index.resolve(v))`       |

`resolvedOptions()` is the **accumulated** lazily-paged list, so every page append re-ran all three over the whole accumulated list — a scroll session over a large remote list with many values selected cost O(selected × options²) in total. The private `_optionValueIndex` computed now holds one `valueIndex(resolvedOptions(), compareWith(), (o) => o.value)` (`@malva-ui/core/dropdown`) that rebuilds only when the option list or the comparator changes and serves all three. The projection is passed to `valueIndex` rather than applied first, because a `.map()` at the call site would walk the whole accumulated list eagerly on every rebuild — defeating the index's progressive walk, which otherwise reads nothing until a query asks and stops at the first match. It carries an explicit `Signal<MlvValueIndex<T>>` annotation as a precaution, not a necessity: it is a new node on the documented `_adapter` → `eager` → `_allValuesMatched` → `resolvedOptions` → `_adapter` inference cycle, so annotating keeps it from ever contributing to a circular inference — but `typecheck` and `core:build` both pass without it today.

Behaviour is unchanged in every case, including the equality edge values: `valueIndex` keys a `Map` only for a **recognised** identity comparator with no hazard value present, and answers a hazardous query pairwise. In particular `_applyPendingValues` is **not** a no-op under the default `===`: a written `-0` matched against a `+0` option is replaced by the option's `+0`, exactly as `find(...)?.value ?? v` always did.

The combobox has no native `<select>` surface, so it needs only this one index. `mlv-select` carries a second one (`_selectedValueIndex`) for `_isNativeOptionSelected`, which queries the other direction — see `libs-select.md`.

**Shared matcher + suggestion highlighting.** In **local mode** `filteredOptions` delegates to `filterOptions()` from `@malva-ui/core/dropdown` (the shared case- and diacritic-insensitive substring filter, blank query returns all) — the same utility that powers `[mlvAutocomplete]`; behaviour is unchanged for ASCII queries. In **remote mode** it returns `resolvedOptions` untouched (the source filters), so the reconciliation guard's "visible set" is the whole rendered list. The combobox also passes `[highlightQuery]="_highlightQuery()"` to the panel so the matched substring is emphasised (`<mark class="mlv-dropdown-panel__match">`) while searching; `_highlightQuery` is empty unless actively searching, so a committed single-select label is never highlighted.

**Option groups (group-aware filtering).** When `toOption` tags options with a `group` label, the shared `mlv-dropdown-panel` renders sticky, non-selectable section headers (APG `role="group"` + `aria-labelledby`). Filtering happens before grouping, headers never enter the forms value, and the activedescendant/reconciliation logic continues to operate only on option values.

**Field click keeps the list open.** The dropdown popup is backdrop-less (`[hasBackdrop]="false"`), so `mlv-popup` dismisses on any document click outside the floating panel. The trigger row (chips + input + chevron) lives outside that panel, so a click on the input to reposition the caret would otherwise dismiss the open list. The combobox passes the trigger element via `mlv-popup`'s `dismissExcludeElements` input (`_popupExcludeElements` computed from a `#trigger` `viewChild`), so clicks within the trigger are treated as "inside" and the list stays open while the caret moves.

---

## Testing

- Nx project: **`core-combobox`** (`libs/core/combobox/project.json`) — `yarn nx test core-combobox`.
- `combobox.spec.ts` covers accessibility, focus/touch behavior, external value synchronization, the forms↔aria bridge, multi-select chips, allow-create, `compareWith`, reconciliation guards, field-click exclusions, the i18n result-count announcement, and the mobile full-screen sheet.
- `describe('MlvCombobox — async sources')` (9 tests) covers the adapter integration: the loading variant for a preset value awaiting its label from an `Observable` source (host class, `.mlv-combobox__loader`, empty + `readOnly` input, click cannot open) and its resolution to the real label once the observable emits; a remote `searchFn` (query forwarded on first open and on every keystroke, panel spinner row, **no local filtering** — stale options stay until the server answers — the list stays open, then the i18n `No results found` empty state); the consumer's `[loading]` input rendering the panel spinner row alongside live options; and an `MlvSelectDataSource` rendering its items with the paging sentinel mounted. It also pins the query-preservation and remote-reset contracts: a landing remote response leaves the typed text (and the active search, proven by the surviving `<mark>` highlight) alone in single- **and** multi-select, and the source is re-asked for `''` after a multi-select commit and after `onClear()` (`['', 'zz', '']`). Paging is driven by a local `PagedTagSource` stub — an `MlvDataSource` with `perPage: 2` over 4 items whose fetches resolve on an explicit `flush()` — because the panel's scroll sentinel cannot fire in jsdom (every layout metric is `0`); it asserts the top spinner for page one, then the `__loading-more` row plus the unchanged option count while page two is in flight, then the accumulated four options.
- `describe('MlvCombobox — value-vs-options cost')` (5 tests) guards the shared `_optionValueIndex`. Two are **absolute**: an empty selection costs **exactly zero** option reads per page append (the walk is progressive, so a control with nothing committed never reads the list at all — an eager build regresses this to one full walk per append), and a single committed value costs at most one walk of the accumulated options. The other three are differential: appending a page of options must cost the same whether 1 or 50 values are committed (a **differential** assertion, so no magic constant — a nested scan would add `49 × options` reads), reads stay under a small constant multiple of the accumulated option count across four page appends with 50 committed values, and a custom `compareWith` still pays its pairwise scan (comparator calls scale with the selection). The instrument is a counting `value` accessor on the options `toOption` produces, because `defaultCompareWith` cannot be wrapped in a spy without destroying the reference `valueIndex` recognises it by.
- `describe('MlvCombobox — option-side comparator argument order')` (2 tests) pins `compare(option.value, committedValue)` at the option-side sites with a deliberately **asymmetric** comparator (`optionFirst`, true only when the _first_ argument is an option value carrying the second's suffix). One asserts the option matches; the other asserts its transpose `selectionFirst` does **not**. Transposing `valueIndex` internally, or transposing this call site's comparator, survives every other test in the suite — all of which use symmetric comparators.
- `describe('MlvCombobox — identity comparator edge values')` (7 tests) proves the SameValueZero bail end-to-end through `.mlv-combobox--loading` and the rendered chips: a committed `NaN` never matches a `NaN` option under `===` but does under `Object.is`; a committed `-0` matches a `+0` option under `===` **and takes the option's `+0` instance** (so `_applyPendingValues` is not the identity no-op it looks like), while under `Object.is` neither direction matches (hazard on the querying side, then on the keyed side); empty options and an empty selection.
- `describe('MlvCombobox — options whose label or value is falsy (#300)')` (11 tests): `{ label, value }` options valued `false`, `0`, `''`, `null` and labelled `''` render their own label (no `[object Object]` row) and filter by it (typing `zer` leaves `Zero`); clicking one commits the **value**, not the option object (`null` asserted in multi-select only — single-select `null` doubles as the empty value, a follow-up); a bound falsy value ticks exactly its own row. The committed input text / chips for a `{ label, value }` option are #349 (they transform the committed value, not its option) and are not asserted here.
- `combobox-binding-matrix.spec.ts` proves `[formControl]`, `ngModel`, and `[formField]` value/touch/disabled behavior.
- `test-setup.ts` stubs `window.matchMedia` to report a **desktop** viewport (`min-width` queries match) so the CDK `BreakpointObserver` no longer pins `MlvBreakpointService` to its initial `'sm'` tier. Without this, the default `mobileMode="auto"` would resolve to the full-screen sheet in every spec (jsdom has no `matchMedia`, so the observer never emits), breaking the anchored-behaviour assertions. Full-screen specs opt in explicitly via `mobileMode="fullscreen"`, which ignores the breakpoint.

## Dropdown panel width (#150)

- The trigger width is a **floor**, not a fixed width: `[minWidth]`, never `[width]`, so an option longer than the trigger grows the panel instead of being clipped.
- Ceiling with no author value = the viewport. The flexible connected strategy sizes its bounding box to the space up to the viewport edge, and CDK's `.cdk-overlay-pane { max-width: 100% }` caps the pane inside it.
- `dropdownMinWidth` raises the floor; `dropdownMaxWidth` tightens the ceiling. Neither can widen what it constrains:
  - `_resolvedDropdownMinWidth()` emits `max(<trigger>px, <authored>)`, so a `dropdownMinWidth` under the trigger width loses to the trigger.
  - a `dropdownMaxWidth` wider than the viewport is still clamped by the bounding box.
- **The floor outranks both ceilings.** CSS resolves the used width as `max(min-width, min(max-width, width))` — `min-width` is applied last and wins. Two consequences the API cannot hide:
  - A `dropdownMaxWidth` **below** the effective floor is silently ignored, and the panel renders past its bounding box (`.cdk-overlay-connected-position-bounding-box` has no `overflow: hidden`). `dropdownMaxWidth="200px"` on a 320px trigger yields a 320px panel. To go narrower than the trigger you must lower the floor, which this API deliberately does not allow.
  - A `dropdownMinWidth` **wider than the space to the viewport edge** pushes the panel off-screen. `.cdk-overlay-pane { max-width: 100% }` governs _content_-driven growth only; it cannot clamp a floor. The available space is measured from whichever trigger edge CDK anchored the panel to — `viewport.right − trigger.left` (LTR) for the preferred start-aligned pair, `trigger.right` once the `end`-aligned fallback engages (#154) — so a `40rem` floor on a start-anchored trigger at x=700 in a 1024px viewport puts 316px off the right edge.
- The `max()` is deliberate — `triggerWidth` is measured in px, the author value may be in any unit. Emitting both sides lets the browser resolve them; converting the author value to px here would freeze it against the root font size at open time. **`%` is the exception and is not supported**: under flexible dimensions CDK lays the pane out as a `static` flex item of the bounding box, so a percentage resolves against the free space to the viewport edge — the same markup gives a different floor depending on where the trigger sits, re-resolving on every resize and reposition. `ch` resolves against the pane's own font, not the option rows'.
- Under `flexibleDimensions` **with `withPush(false)`**, CDK **clears `max-width` on the pane** and applies `OverlayConfig.maxWidth` to the bounding box (`_setBoundingBoxStyles` / `_setOverlayElementStyles`). The switch is `_hasExactPosition() === !_hasFlexibleDimensions || _isPushed`, so with push enabled the cap moves back onto the pane instead. `MlvPopupService` derives `withPush` from `scrollStrategy` (`push = scrollStrategy !== 'reposition'`) and neither control binds one, so the bounding-box placement holds here — but a consumer writing `<mlv-popup [flexibleDimensions]="true" [maxWidth]="…" scrollStrategy="close">` gets the other branch. Specs assert the cap on `.cdk-overlay-connected-position-bounding-box`, the floor on `.cdk-overlay-pane`.
- Same contract in `mlv-select` (`dropdownMinWidth` / `dropdownMaxWidth`) and `[mlvAutocomplete]` (`mlvAutocompleteMinWidth` / `mlvAutocompleteMaxWidth`).
- **How far it may grow depends on which trigger edge is anchored (#154).** `dropdownPositions` is the shared `DROPDOWN_POSITIONS` from `@malva-ui/core/dropdown` — start-aligned below/above preferred, end-aligned below/above as the inline fallback — so a narrow trigger near the viewport's inline-end edge anchors its panel's inline-end edge to the trigger and grows back toward inline-start instead of being boxed into the sliver after it. `restrictPosition` stays `true`: the four positions are the whole list. See `libs-dropdown.md` → _Overlay positions (#154)_.

## Inline clear + chip Backspace (2026-07)

- `hasValue` = committed selection non-empty (search text alone is not a value); `ownsClearButton = true` — the clear X renders inline in the trigger row **before the chevron** (`.mlv-combobox__clear`, mousedown-prevented so the input keeps focus); the wrapper's trailing copy is suppressed.
- **Chip Backspace (tokenizer parity, multi only):** empty search input + Backspace arms the last chip (`.mlv-combobox__chip--armed` focus-ring, polite SR announcement, DOM focus stays in the input); next Backspace (or Delete) removes the armed chip via `removeSelected` and re-arms the new last; removing the final chip disarms with the input still focused. Typing, blur, trigger click, and click-removal disarm. Handlers: `onInputBackspace` / `onInputDelete`; wired on both the outer and in-sheet inputs.

---

## Field surface (2026-08)

- Inherited `required` renders the `mlv-label` marker and is forwarded to the inner `mlv-input` (`aria-required` on the native input).
- Inherited `ariaLabel` is forwarded to the inner input when no visible `label` is set. Also (via `_panelAriaLabel`) names the dropdown panel's `role="listbox"` — see _Dropdown panel accessible name_.
- Inherited `description` renders `<mlv-description>` below the control. The inner bare `mlv-input` receives `[ariaDescribedBy]="_describedBy()"`, so its `aria-describedby` points at the description/message elements the combobox itself renders.
- `<mlv-message>` carries `_messageId()`.

## Dropdown panel accessible name (2026-08)

`mlv-dropdown-panel`'s inner `role="listbox"` is an ARIA input field (axe `aria-input-field-name`, WCAG 4.1.2) and needs its own accessible name — it is not implicitly named by the trigger input it belongs to. `mlv-combobox` binds `[ariaLabel]="_panelAriaLabel()"` on its `<mlv-dropdown-panel>`, where `_panelAriaLabel` mirrors the outer trigger input's own resolution: the visible `label` when set, else the explicit `ariaLabel` input — `null` when neither is set (same as an unlabelled trigger, an existing condition outside this fix's scope). Mirrors `mlv-select` and `mlv-filter` (which passes its field `label` directly). Unaffected by the full-screen in-sheet input, which names itself from `_resolvedMobileTitle` — the panel keeps the (non-fullscreen) trigger's resolution in every mode.

## Padding ownership fix (2026-08-26)

`.mlv-combobox__trigger` owns the field's full ramped inset
(`padding: var(--mlv-control-padding)`; the wrapper's own container padding
is zeroed). The inner `mlv-input[bare]` previously carried its own
(pre-2026-08-26: flat, non-ramped) padding on top of that, doubling the
inset and making the combobox's text sit at a different offset than a plain
`mlv-input` or `mlv-select` trigger at the same density. `mlv-input` now
reflects `bare()` as a host class and zeroes its own native padding
whenever it is set (`mlv-input.scss`'s `&--bare &__native` rule) — the
trigger is the sole padded box. See `.claude/projects/libs-input.md` →
_Padding ownership in `bare` mode_.

## Naming from a projected `<mlv-label>` (2026-09, #197)

`MlvCombobox` reports `_externalLabelStrategy()` **`'native'`**: `id()` is
forwarded to the inner `mlv-input`, which puts it on a native `<input>` — a
labelable element even while it carries `role="combobox"` — so an `<mlv-label>`
projected beside it into `mlv-form-field` names it with a plain `for`.

Full contract, the `'native'` vs `'aria'` split and the dev-mode warning:
`.claude/projects/libs-form-utils.md` → _`MlvFormField` → Accessible name_.

## Its own label (2026-09, #216)

`MlvCombobox` was listed in #216 with the four `'aria'` controls but was
already correct — its `id()` reaches a native `<input>`, so its own
`<mlv-label>`'s `for` names a real element. It now binds `[for]="_ownLabelFor()"`
for one source of truth with the projected case; the rendered attribute is
byte-identical. `combobox-own-label.spec.ts` pins it, so a future change that
moved `id()` onto the `__trigger` div would fail rather than silently drop the
name.
