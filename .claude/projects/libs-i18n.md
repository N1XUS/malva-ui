---
# Library: i18n

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including service, pipe, token, type, or public API changes.

## Strict all-locale update rule

Every user-facing string or locale-key change must update and validate all
shipped packs — `en`, `de`, `fr`, `it`, `es`, `pt`, `uk`, `ro`, `ja`, `nl`,
`pl`, `tr`, `zh-Hans`, and `id` — in the same change. English must never be
updated alone. Keep key paths and ICU named parameters aligned across every
pack; preserve select branches and use the target locale's required CLDR plural
categories.

## Overview

The i18n library (`@malva-ui/i18n`) provides a signal-based, per-component internationalization system for the Malva UI component library. It uses ICU MessageFormat for pluralization and parameterization, and lazy-loaded language packs via secondary entry points. The shipped packs are drafted with an unpublished maintainer script (`scripts/malva-ui-translate.mjs`). The runtime AI translation API is deprecated — see [AI Translation](#ai-translation).

**Published package:** `@malva-ui/i18n`
**Secondary entry points:** `@malva-ui/i18n/en`, `/de`, `/fr`, `/it`, `/es`,
`/pt`, `/uk`, `/ro`, `/ja`, `/nl`, `/pl`, `/tr`, `/zh-Hans`, and `/id`, plus
`/testing`

## Architecture

- **Per-component injection tokens** — each component with translatable strings gets a typed `InjectionToken<Signal<ComponentI18n>>`. Components inject this token and read strings reactively.
- **Signal-based** — language switching updates all component strings automatically via Angular signals.
- **APP_INITIALIZER** — `provideMlvI18n()` blocks rendering until the lazy-loaded language pack resolves, eliminating fallback/flash-of-untranslated-content issues.
- **ICU MessageFormat** — strings support pluralization (`{count, plural, one {# item} other {# items}}`), parameter interpolation (`{start}–{end} of {total}`), and select rules via the `intl-messageformat` package.
- **One formatting locale — `MLV_LOCALE`** (#306, owner ruling D3). `InjectionToken<Signal<string>>`, `providedIn: 'root'`.
  - Value: active pack's `locale` → `LOCALE_ID` (no pack loaded yet / pack declares none / no `provideMlvI18n()`). Never `navigator.language` — SSR and hydration agree.
  - Canonical (review #306 F3): `Intl.getCanonicalLocales` after folding `_` → `-` (Angular accepts `de_AT` as `LOCALE_ID`). Malformed pack locale → `LOCALE_ID`; malformed `LOCALE_ID` → `en-US`. Reason: `new IntlMessageFormat(t, 'de_AT' | 'not a locale' | '')` and `Intl.DateTimeFormat` throw `RangeError` at construction. No dev warning — `libs/i18n` has no warning precedent. A provided `MLV_LOCALE` is used as given.
  - `MlvI18nResolverService` now injects it → `new MlvI18nResolverService()` outside an injection context throws NG0203; obtain via `inject()` / `TestBed.inject()`.
  - Signal: `switchLanguage()` moves it; resolver, pipe, date adapter and chat re-format.
  - Readers: `MlvI18nResolverService`, `mlvTranslate`, `MLV_DATE_LOCALE`'s default + `MlvNativeDateAdapter` (`@malva-ui/core/date`), `mlv-chat` time/date text.
  - Before #306 the resolver compiled with no locale → `intl-messageformat`'s runtime default (browser language): a `uk` pack on an `en-US` browser rendered "3 учасника" (`en` rules put 3 in `other`, so the `few` branch never ran), an `en` pack on a `uk` browser rendered "21 member" (`uk` rules put 21 in `one`).
  - Override only at environment level (`{ provide: MLV_LOCALE, useValue: signal('de-CH').asReadonly() }` in app providers): root-provided resolver / adapter resolve it there; a component-level provider reaches neither.

---

## Public API

Exported from `libs/i18n/src/index.ts`:

| Export                       | Kind           | Description                                                                |
| ---------------------------- | -------------- | -------------------------------------------------------------------------- |
| `MlvLanguage`                | Interface      | All 44 component i18n interfaces (2 optional), plus optional `locale`      |
| `MLV_LOCALE`                 | InjectionToken | `Signal<string>`: active pack's `locale` → `LOCALE_ID`; formatting locale  |
| `MlvLanguageModule`          | Type           | A loaded pack module: `{ default }` or `{ <locale>Language }`              |
| `resolveMlvLanguage`         | Function       | Unwraps the `MlvLanguage` out of either module shape                       |
| `MlvTranslationProvider`     | Interface      | **Deprecated** — AI provider contract for batch translation                |
| `MlvTranslationRequest`      | Interface      | **Deprecated** — single translation request                                |
| `MlvTranslationResult`       | Interface      | **Deprecated** — single translation result                                 |
| `MlvTranslationContext`      | Interface      | Context metadata typing every `MLV_*_I18N_CONTEXT` record (not deprecated) |
| `MlvAiTranslationConfig`     | Interface      | **Deprecated** — runtime AI translation configuration                      |
| `MLV_*_I18N`                 | InjectionToken | Per-component i18n tokens (44 total)                                       |
| `Mlv*I18n`                   | Interface      | Per-component string interfaces (44 total)                                 |
| `MLV_*_I18N_CONTEXT`         | Record         | Per-component translation context metadata (44 total)                      |
| `MlvI18nService`             | Service        | Central language state management                                          |
| `MlvI18nResolverService`     | Service        | ICU MessageFormat resolution with caching                                  |
| `MlvTranslatePipe`           | Pipe           | Template pipe for ICU string resolution                                    |
| `provideMlvI18n`             | Function       | Root provider factory with lazy loading                                    |
| `MLV_AI_TRANSLATION_CONFIG`  | InjectionToken | **Deprecated** — AI translation configuration token                        |
| `MLV_AI_TRANSLATION_ENABLED` | InjectionToken | **Deprecated** — per-subtree AI toggle; nothing reads it                   |
| `MlvAiTranslationService`    | Service        | **Deprecated** — runtime AI translation with caching                       |
| `provideMlvAiTranslation`    | Function       | **Deprecated** — AI translation provider factory                           |
| `claudeProvider`             | Function       | **Deprecated** — Claude adapter factory; never pass it a real key          |
| `MlvClaudeProviderConfig`    | Interface      | **Deprecated** — Claude adapter configuration                              |

Every **Deprecated** row is the runtime AI translation API: `@deprecated since
0.2.0 — removed in 1.0`, no replacement. See [AI Translation](#ai-translation)
for why.

---

## Services

### `MlvI18nService`

**File:** `libs/i18n/src/lib/i18n.service.ts`

Central service managing the active language pack. Not `providedIn: 'root'` — provided by `provideMlvI18n()`.

| Method                                      | Description                                                             |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| `setLanguage(lang: MlvLanguage)`            | Sets the active language pack (called by APP_INITIALIZER)               |
| `switchLanguage(loader)`                    | Switches via lazy import (`MlvLanguageModule`); the latest request wins |
| `select<K>(key: K): Signal<MlvLanguage[K]>` | Returns a computed signal for a component's i18n slice                  |

### `MlvI18nResolverService`

**File:** `libs/i18n/src/lib/i18n-resolver.service.ts`

`providedIn: 'root'`. Resolves ICU MessageFormat strings with parameters. Caches compiled IntlMessageFormat instances.

- Compiles in `MLV_LOCALE()` → plural categories + `#` number format follow the pack, not the runtime.
- Cache key `${locale}\u0000${template}` — same text under another locale is a separate entry.
- Reads the signal only when it formats (placeholders + params); a `computed()` / template calling `resolve()` re-resolves on a pack switch. Plain strings return untouched, no signal read.

| Method                        | Description                                     |
| ----------------------------- | ----------------------------------------------- |
| `resolve(i18n, key, params?)` | Resolves an ICU string with optional parameters |

### `MlvAiTranslationService`

**File:** `libs/i18n/src/lib/ai/ai-translation.service.ts`

- **Deprecated since 0.2.0 — removed in 1.0**, no replacement — see [AI Translation](#ai-translation).
- `providedIn: 'root'`; runtime AI translation for missing keys; in-memory cache.
- Nothing in the library calls it.
- `translate()` never rejects: `null` when no provider is configured, when the provider returns no text, and when it throws.

---

## Pipe

### `MlvTranslatePipe` (`mlvTranslate`)

**File:** `libs/i18n/src/lib/translate.pipe.ts`

Resolves ICU MessageFormat strings in templates:

```html
{{ _i18n().allItems | mlvTranslate: { total: totalItems() } }}
```

- **`pure: false`** since #306, with its own memo (template, params identity, locale). A pure pipe skips `transform` while its arguments are unchanged — a template's `{ count: n() }` literal keeps its identity while `n()` holds — so a pack switch left the old plural category on screen.
- Reads `MLV_LOCALE` every run: that read is also what keeps the view subscribed to it. Unchanged inputs return the memoised string; no re-parse.

---

## Provider Factory

### `provideMlvI18n(loader)`

**File:** `libs/i18n/src/lib/provide-i18n.ts`

Must be called in the application's root providers:

```ts
export const appConfig = {
  providers: [provideMlvI18n(() => import('@malva-ui/i18n/en'))],
};
```

Internally provides: `MlvI18nService`, `APP_INITIALIZER` for lazy loading, and all 40 per-component injection tokens.

### `MlvLanguageModule` and `resolveMlvLanguage()` — the two loaded shapes

**File:** `libs/i18n/src/lib/language-module.ts`

`provideMlvI18n()` and `MlvI18nService.switchLanguage()` both take
`() => Promise<MlvLanguageModule>`, which is the union of

- `{ default: MlvLanguage }` — a hand-written pack, and what a locale entry
  point resolves to **inside this workspace**, where `tsconfig.base.json` maps
  `@malva-ui/i18n/en` to source; and
- `{ <locale>Language: MlvLanguage }` — what the **published** package emits.
  Each locale's `index.ts` exports its pack both ways, but ng-packagr keeps only
  the named export when it flattens an entry point, so
  `dist/libs/i18n/types/malva-ui-i18n-en.d.ts` is
  `export { en as enLanguage }` and carries no default at all (#227).

`resolveMlvLanguage(module)` unwraps whichever arrived, and it **throws**,
naming the exported keys, when neither shape is there. That replaces the old
`setLanguage(m.default)`, which passed `undefined` straight into the service and
surfaced as an unrelated-looking crash in the first component to read a string.

**One module, one pack.** That is the constraint a consumer inherits, and it has
two halves:

- `default` wins whenever it is there, and is returned **unread** — a pack may hold
  whatever slices it likes, including one named `contractLanguage`. The one
  `default` that is not the pack is an interop-synthesised module namespace,
  recognised by what a namespace **is** (`__esModule`, `Symbol.toStringTag ===
'Module'`, or a `default` pointing back at the module), never by what it
  contains. Detecting it by "has a key ending in `Language`" — the first cut —
  silently replaced any pack carrying such a slice with that slice, and
  TypeScript could not see it, because the excess-property check does not fire
  through a variable.
- With no `default`, two `<locale>Language` exports **throw**. A barrel that `export *`s two
  locales type-checks (a distributed union accepts extra properties), and the
  first cut returned whichever `Object.entries` yielded first — so the active
  language depended on the order the barrel was written in.

`MlvLanguageExportName` enumerates the fourteen names rather than being written
as a template-literal index signature keyed on `` `${string}Language` ``:
an index signature constrains only keys that exist, so a module with no matching
key satisfies it vacuously — `@malva-ui/i18n/testing` type-checks against it —
which would make the parameter accept every module in existence.

It is **not exported**. Its members are the names ng-packagr happens to emit, so
a barrel export would version the library against a build tool's naming
(`VERSIONING.md` §2/§3/§5) — the very change the gate exists to _detect_. The
declaration still reaches the published `.d.ts` as a referenced type, the way
`MlvNamedLanguageModule` does. `MlvLanguageModule` is the public type.

---

## Per-Component Tokens

Each component with translatable strings has a token file under `libs/i18n/src/lib/tokens/`:

New keys are inserted **alphabetically by component key** everywhere the set is
enumerated — `MlvLanguage` and its imports in `src/lib/types.ts`, the barrel in
`src/index.ts`, the imports and provider list in `src/lib/provide-i18n.ts`, the
mock map in `testing/src/lib/i18n-test-providers.ts`, and every language pack
(`scheduler` before `scrollbar` before `searchField`). The **language packs**
carry one pre-existing exception: `popup` sits after `tile` rather than between
`pinInput` and `progress`; the token files, the barrel, the provider list and
the mock map place it alphabetically. `tests/locale-contract.spec.ts` pins each
pack's key **order** against `en`, so that placement is identical in all 14
packs and a pack that is reordered alone fails the suite.

A message key added to an **existing** interface is declared optional (`key?:
string`) with an English fallback in the consuming component, so a
hand-written `MlvLanguage` keeps compiling — `VERSIONING.md` §3's "new optional
i18n key with a shipped default" (minor); a new required key is a major. Every
shipped pack still declares it: `locale-contract.spec.ts` compares each pack's
key set with `en`'s. `MlvFilterI18n`'s five condition-control names are the
first (#330); `mlv-filter` keeps the fallbacks in `OPTIONAL_MESSAGE_FALLBACKS`,
typed as a record over the interface's optional keys so the next one cannot
ship without a fallback. `MlvTimePickerI18n.placeholder` is the second (#348),
with the same `OPTIONAL_MESSAGE_FALLBACKS` shape in `mlv-time-picker`.

#370 adds seven more on existing interfaces — `MlvSelectI18n.itemsSelected`
(ICU plural `{count}`), `MlvTokenizerI18n.moreItems` (ICU plural `{count}`),
`MlvDateRangePickerI18n.clear` / `apply` (visible footer labels) and
`MlvTimePickerI18n.hours` / `minutes` / `seconds` (drum-column names) — each
with an `OPTIONAL_MESSAGE_FALLBACKS` entry in its component holding the exact
English it used to hard-code. It also adds the first **optional slices**:
`MlvLanguage.autocomplete?` (`MlvAutocompleteI18n`: `noResults`, `loading`,
`resultsAvailable` ICU `{count}`, worded exactly as `combobox`) and
`MlvLanguage.dropdownPanel?` (`MlvDropdownPanelI18n`: `loading`), with every
key inside them optional too. A required new slice would break every
hand-written `MlvLanguage` (row 104); optional, it is row 115. For a pack with
no such slice `provideMlvI18n()` resolves the token to a frozen empty object,
so each key falls back in the component. Both slices are injected
`{ optional: true }`, so `[mlvAutocomplete]` and `mlv-dropdown-panel` keep
their English with no i18n provider at all. `locale-contract.spec.ts` pins
that every shipped pack words `autocomplete` and `dropdownPanel.loading`
exactly as its own `combobox` slice (one term per pack, not two), that the
`clearDateRange` / `applyDateRange` aria-labels contain the visible
`clear` / `apply` word (WCAG 2.5.3), and plural branches per locale.

#371 routes the last hard-coded English in five components through packs,
same shape: optional keys on existing interfaces — `MlvDataTableI18n`
(`selectRow` ICU `{index}`, `loadingMore`, `loadingData`, `noData`, `pinStart`,
`pinEnd`, `actionsHeader`), `MlvCopyToClipboardI18n` (`copied`, `copyTooltip`,
`copiedTooltip`), `MlvEditorI18n.placeholder`, `MlvFileUploadI18n`
(`dropFiles`, `browseFiles`) — and two optional slices,
`MlvLanguage.tree?` (`MlvTreeI18n`: `expandNode` / `collapseNode` /
`selectNode` ICU `{label}`, `loadingChildren`) and `MlvLanguage.viewVariant?`
(`MlvViewVariantI18n`, 25 keys; `moreActions` / `variantActions` ICU
`{name}`), every key optional. Each component holds the exact old English in
`OPTIONAL_MESSAGE_FALLBACKS`; `locale-contract.spec.ts` pins en byte-identical
to those literals, with one deliberate exception: the data-table pin labels
read "Pin to start" / "Pin to end" (were "Pin left" / "Pin right";
`MlvPinSide` mirrors in RTL — `docs/migrations/2026-09-data-table-pin-logical-labels.md`).
It also pins that each pack words `viewVariant.retry` / `dismiss` / `reset`
exactly as its own `dataTable.retry` / `notification.dismiss` /
`filter.reset`, and that non-en packs translate every new key (homograph
allowlist for words a locale shares with English).

| Token                        | Interface                | Component                         | Keys                                                                                                                                                                                                                                                                          |
| ---------------------------- | ------------------------ | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MLV_ALERT_I18N`             | `MlvAlertI18n`           | mlv-alert                         | dismiss                                                                                                                                                                                                                                                                       |
| `MLV_AUTOCOMPLETE_I18N`      | `MlvAutocompleteI18n`    | [mlvAutocomplete]                 | optional slice (#370): noResults, loading, resultsAvailable (ICU `{count}`) — all optional, English fallbacks in the directive                                                                                                                                                |
| `MLV_AVATAR_GROUP_I18N`      | `MlvAvatarGroupI18n`     | mlv-avatar-group                  | noMembers, memberCount (ICU `{total}`), visibleMembers (ICU `{total}` `{visible}`), moreMembers (ICU `{count}`), allMembers                                                                                                                                                   |
| `MLV_BOTTOM_NAV_I18N`        | `MlvBottomNavI18n`       | mlv-bottom-nav                    | navigation, moreOptions, more, moreMenu                                                                                                                                                                                                                                       |
| `MLV_BREADCRUMB_I18N`        | `MlvBreadcrumbI18n`      | mlv-breadcrumb                    | hiddenItems, label, showMore (ICU)                                                                                                                                                                                                                                            |
| `MLV_CALENDAR_I18N`          | `MlvCalendarI18n`        | mlv-calendar, mlv-calendar-sheet  | previousPeriod, nextPeriod, switchView (ICU), selectMonthForYear (ICU), done, selectYear, monthList                                                                                                                                                                           |
| `MLV_CHAT_I18N`              | `MlvChatI18n`            | mlv-chat                          | 16 keys (chatLabel, today, yesterday, statusSending/Sent/Delivered/Read/Failed, retry, newMessages, typing, playAudio, pauseAudio, imageFallbackAlt, moreMedia, loadingOlder)                                                                                                 |
| `MLV_CHIP_I18N`              | `MlvChipI18n`            | mlv-chip                          | remove                                                                                                                                                                                                                                                                        |
| `MLV_COLOR_PICKER_I18N`      | `MlvColorPickerI18n`     | mlv-color-picker                  | 14 keys (hue, opacity, pickColor ICU, etc.)                                                                                                                                                                                                                                   |
| `MLV_COMBOBOX_I18N`          | `MlvComboboxI18n`        | mlv-combobox                      | 6 keys (searchPlaceholder, toggleOptions, noResults, pressEnterToAdd ICU `{query}`, loading, resultsAvailable ICU)                                                                                                                                                            |
| `MLV_COMPARE_I18N`           | `MlvCompareI18n`         | mlv-compare                       | ariaLabel (fallback accessible name of the hidden range slider)                                                                                                                                                                                                               |
| `MLV_COPY_TO_CLIPBOARD_I18N` | `MlvCopyToClipboardI18n` | mlv-copy-to-clipboard             | copyToClipboard; optional copied (live region), copyTooltip, copiedTooltip (#371)                                                                                                                                                                                             |
| `MLV_DATA_TABLE_I18N`        | `MlvDataTableI18n`       | mlv-data-table                    | Search, filtering, sorting, resizing, editing, pinning, tree labels, and the error state (errorTitle, errorMessage, retry); optional selectRow (ICU `{index}`), loadingMore, loadingData, noData, pinStart, pinEnd, actionsHeader (#371)                                      |
| `MLV_DATE_RANGE_PICKER_I18N` | `MlvDateRangePickerI18n` | mlv-date-range-picker             | 6 keys (selectDateRange, startMonth, endMonth, clearDateRange, applyDateRange, placeholder), optional clear / apply (#370, visible footer labels)                                                                                                                             |
| `MLV_DAY_PICKER_I18N`        | `MlvDayPickerI18n`       | mlv-day-picker                    | placeholder, selectDay                                                                                                                                                                                                                                                        |
| `MLV_DIALOG_I18N`            | `MlvDialogI18n`          | mlv-dialog                        | closeDialog, confirm, cancel                                                                                                                                                                                                                                                  |
| `MLV_DRAWER_I18N`            | `MlvDrawerI18n`          | mlv-drawer                        | drawer, closeDrawer                                                                                                                                                                                                                                                           |
| `MLV_DROPDOWN_PANEL_I18N`    | `MlvDropdownPanelI18n`   | mlv-dropdown-panel                | optional slice (#370): loading (default `loadingText`) — optional                                                                                                                                                                                                             |
| `MLV_EDITOR_I18N`            | `MlvEditorI18n`          | mlv-editor                        | 132 keys: labels, formatting, text styles (with a `styleValue` trigger-name template), heading links, links, tables, uploads, counts, block drag/move, AI transforms/review-bar/announcements, collaboration; 28 optional: placeholder (#371), 14 from #514, 13 from #515     |
| `MLV_FILE_UPLOAD_I18N`       | `MlvFileUploadI18n`      | mlv-file-upload                   | 8 keys (incl. replaceFile, errorSingleFile, errorFileType `{name}`, errorFileSize `{name}` `{size}`); optional dropFiles, browseFiles (#371, the `title` / `actionLabel` defaults)                                                                                            |
| `MLV_FILTER_I18N`            | `MlvFilterI18n`          | mlv-filter                        | Filter actions, summaries, visibility, conditions, operator labels; condition-control names (`removeCondition` ICU `{label}` `{index}`, optional `conditionStrategy` `{label}`, `conditionOperator` / `conditionValue` / `rangeFrom` / `rangeTo` `{label}` `{index}`)         |
| `MLV_FORM_UTILS_I18N`        | `MlvFormUtilsI18n`       | form-control-wrapper              | clear, required, invalidValue                                                                                                                                                                                                                                                 |
| `MLV_LOADER_I18N`            | `MlvLoaderI18n`          | mlv-loader                        | loading                                                                                                                                                                                                                                                                       |
| `MLV_NOTIFICATION_I18N`      | `MlvNotificationI18n`    | mlv-notification-item             | dismiss                                                                                                                                                                                                                                                                       |
| `MLV_NUMBER_INPUT_I18N`      | `MlvNumberInputI18n`     | mlv-number-input                  | decrement, increment                                                                                                                                                                                                                                                          |
| `MLV_PAGE_I18N`              | `MlvPageI18n`            | mlv-page-summary, mlv-page-header | pageSummary, expandHeader                                                                                                                                                                                                                                                     |
| `MLV_PAGINATION_I18N`        | `MlvPaginationI18n`      | mlv-pagination                    | 9 keys (incl. ICU)                                                                                                                                                                                                                                                            |
| `MLV_PIN_INPUT_I18N`         | `MlvPinInputI18n`        | mlv-pin-input                     | digit (ICU), pinEntry                                                                                                                                                                                                                                                         |
| `MLV_POPUP_I18N`             | `MlvPopupI18n`           | mlv-popup                         | close (mobile fullscreen close button)                                                                                                                                                                                                                                        |
| `MLV_PROGRESS_I18N`          | `MlvProgressI18n`        | mlv-progress                      | progress                                                                                                                                                                                                                                                                      |
| `MLV_RATING_I18N`            | `MlvRatingI18n`          | mlv-rating                        | rating, rateValue (ICU)                                                                                                                                                                                                                                                       |
| `MLV_SCHEDULER_I18N`         | `MlvSchedulerI18n`       | mlv-scheduler                     | 24 keys: toolbar labels, ICU `view` select (previous/next/gridLabel), plural overflow (`moreEvents` + `moreEventsLabel`), slot/day/event aria-labels, dragHint, 5 live announcements, context-menu aria-labels (`eventMenu`, `slotMenu`)                                      |
| `MLV_SCROLLBAR_I18N`         | `MlvScrollbarI18n`       | mlv-scrollbar                     | scrollableRegion                                                                                                                                                                                                                                                              |
| `MLV_SEARCH_FIELD_I18N`      | `MlvSearchFieldI18n`     | mlv-search-field                  | placeholder, search, submit, clear                                                                                                                                                                                                                                            |
| `MLV_SELECT_I18N`            | `MlvSelectI18n`          | mlv-select                        | 5 keys (placeholder, searchPlaceholder, noResults, loading, resultsAvailable ICU), optional itemsSelected (#370, ICU `{count}`)                                                                                                                                               |
| `MLV_SIDEBAR_I18N`           | `MlvSidebarI18n`         | mlv-sidebar                       | navigation, notifications (ICU), switchWorkspace (ICU), workspaceMenu, expand, collapse, openNavigation, closeNavigation                                                                                                                                                      |
| `MLV_SLIDER_I18N`            | `MlvSliderI18n`          | mlv-slider                        | minValue, maxValue, value                                                                                                                                                                                                                                                     |
| `MLV_STEPPER_I18N`           | `MlvStepperI18n`         | mlv-stepper                       | optional                                                                                                                                                                                                                                                                      |
| `MLV_TABS_I18N`              | `MlvTabsI18n`            | mlv-tabs                          | moreTabs                                                                                                                                                                                                                                                                      |
| `MLV_TASKBOARD_I18N`         | `MlvTaskboardI18n`       | mlv-taskboard                     | 24 keys: boardLabel, addCard, emptyCell, cardLabel (ICU `{label}`), laneName (ICU `{lane}`), keyboardInstructions, grabbed, targetValid/targetInvalid, moved, moveRejected, moveCancelled, releasedInPlace, wipState, selectionCount (ICU plural), and nine `reason*` phrases |
| `MLV_TILE_I18N`              | `MlvTileI18n`            | mlv-tile                          | close, generic tile label, parameterized drag-handle label, keyboard instructions, parameterized move/rejection announcements, and the empty/restricted drop-target strings                                                                                                   |
| `MLV_TIME_PICKER_I18N`       | `MlvTimePickerI18n`      | mlv-time-picker                   | period, optional placeholder (#348), timePicker, optional hours / minutes / seconds (#370); AM / PM come from `MlvDateAdapter.getDayPeriodNames()`, not the pack                                                                                                              |
| `MLV_TOAST_I18N`             | `MlvToastI18n`           | mlv-toast-item                    | dismiss                                                                                                                                                                                                                                                                       |
| `MLV_TOKENIZER_I18N`         | `MlvTokenizerI18n`       | mlv-tokenizer                     | addToken, selectedItems, optional moreItems (#370, ICU `{count}`)                                                                                                                                                                                                             |
| `MLV_TREE_I18N`              | `MlvTreeI18n`            | mlv-tree                          | optional slice (#371): expandNode, collapseNode, selectNode (ICU `{label}`), loadingChildren — all optional, English fallbacks in `tree-subtree.ts`                                                                                                                           |
| `MLV_VIEW_VARIANT_I18N`      | `MlvViewVariantI18n`     | mlv-view-variant-list, -status    | optional slice (#371): 25 keys (search, create, groups, row actions ICU `{name}`, status messages and actions) — all optional; `groupLabels` input still overrides the groups                                                                                                 |

---

## Language Packs

Every shipped pack is a typed secondary entry point:

| Code      | Language              | Entry point              | Source                                 |
| --------- | --------------------- | ------------------------ | -------------------------------------- |
| `en`      | English               | `@malva-ui/i18n/en`      | `libs/i18n/en/src/lib/en.ts`           |
| `de`      | German                | `@malva-ui/i18n/de`      | `libs/i18n/de/src/lib/de.ts`           |
| `fr`      | French                | `@malva-ui/i18n/fr`      | `libs/i18n/fr/src/lib/fr.ts`           |
| `it`      | Italian               | `@malva-ui/i18n/it`      | `libs/i18n/it/src/lib/it.ts`           |
| `es`      | Spanish               | `@malva-ui/i18n/es`      | `libs/i18n/es/src/lib/es.ts`           |
| `pt`      | Portuguese (Portugal) | `@malva-ui/i18n/pt`      | `libs/i18n/pt/src/lib/pt.ts`           |
| `uk`      | Ukrainian             | `@malva-ui/i18n/uk`      | `libs/i18n/uk/src/lib/uk.ts`           |
| `ro`      | Romanian              | `@malva-ui/i18n/ro`      | `libs/i18n/ro/src/lib/ro.ts`           |
| `ja`      | Japanese              | `@malva-ui/i18n/ja`      | `libs/i18n/ja/src/lib/ja.ts`           |
| `nl`      | Dutch                 | `@malva-ui/i18n/nl`      | `libs/i18n/nl/src/lib/nl.ts`           |
| `pl`      | Polish                | `@malva-ui/i18n/pl`      | `libs/i18n/pl/src/lib/pl.ts`           |
| `tr`      | Turkish               | `@malva-ui/i18n/tr`      | `libs/i18n/tr/src/lib/tr.ts`           |
| `zh-Hans` | Simplified Chinese    | `@malva-ui/i18n/zh-Hans` | `libs/i18n/zh-Hans/src/lib/zh-Hans.ts` |
| `id`      | Indonesian            | `@malva-ui/i18n/id`      | `libs/i18n/id/src/lib/id.ts`           |

Every pack's first key is `locale` — its BCP 47 tag, what `MLV_LOCALE` reports
while it is active (#306). Tag = directory code except `pt` → **`pt-PT`**: the
pack is European Portuguese ("ficheiro"), and CLDR `pt` puts 0 in `one` while
`pt-PT` puts it in `other`. `locale` is not a message: never translated, skipped
by the contract's key flattening and by `scripts/malva-ui-translate.mjs`, which
writes it into every pack it generates.

`libs/i18n/tests/locale-contract.spec.ts` validates exact key parity, ICU named
arguments, select branches, required plural branches, compilation, and
representative formatting across all fourteen packs, and that each pack declares
its expected canonical tag with plural + date data in the runtime. It also asserts that
`packs` covers every locale directory on disk, and that no pack has a top-level
key ending in `Language` — which keeps the resolver's module scan from ever
meeting a pack slice.

`libs/i18n/tests/published-package.spec.ts` is the **consumer gate**: it writes a
throwaway project under `tmp/` whose `node_modules/@malva-ui/i18n` symlinks to
`dist/libs/i18n` — so `@malva-ui/i18n/en` resolves through the generated
`exports` map, exactly as an installed consumer does — and type-checks
`provideMlvI18n(() => import('@malva-ui/i18n/<locale>'))` for every locale with
`tsc`. It exists because every in-repo consumer resolves the path mapping to
**source**, so nothing else in the workspace ever type-checks against the built
package; that is how #227 shipped. The `test` target therefore declares
`dependsOn: ["build"]` (CI already selects `build`, so the edge is a cache hit
there and ~2s cold locally) rather than adding a target name CI would have to be
taught.

Its locale set is **derived from the built package** — the `exports` map of
`dist/libs/i18n/package.json`, each entry point classified by whether its own
`.d.ts` exports a `MlvLanguage`-typed constant — and never listed in the spec.
That is what makes "a locale with no `MlvLanguageExportName` entry fails this
gate" a true statement: ng-packagr auto-discovers entry points from
per-directory `ng-package.json` files, so a fifteenth locale enters the gate the
moment it builds. The comparison runs both ways, so a name in the union that no
longer matches a published locale fails too. It also asserts the non-locale
entry points (`.`, `./testing`), so a locale that stopped emitting a
`<locale>Language` name cannot drop out of the derived set unnoticed, holds a
floor under the locale count, and resolves each built `.mjs` through
`resolveMlvLanguage` so the published shape is proven at runtime and not only at
the type level.

Four locale lists exist, none of them generated: `MlvLanguageExportName`, the
`packs` map in `locale-contract.spec.ts`, `DOCS_LOCALE_CODES` in `apps/docs`,
and the derived set above. The first is cross-checked against the derived set;
the other two are cross-checked against the locale directories on disk in their
own specs — the same set one build step earlier — rather than against `dist/`,
which would make a content-parity suite and an app spec depend on this library's
build.

### Adding a new language

Maintainers can draft a pack with the repo's translation script
(`scripts/malva-ui-translate.mjs` — unpublished, see
[AI Translation](#ai-translation)). It reads the key from `ANTHROPIC_API_KEY`;
set that from your secret store, never type the key on the command line:

```bash
node scripts/malva-ui-translate.mjs --target uk
```

Or create manually under `libs/i18n/<locale>/src/lib/<locale>.ts` following the
English pack structure — `locale: '<tag>'` first — with `ng-package.json` and entry `src/index.ts`. Adding
another shipped locale also requires extending the all-locale contract, the
strict update list above, `MlvLanguageExportName` in
`src/lib/language-module.ts`, and `DOCS_LOCALE_CODES` / `DOCS_LOCALE_METADATA`
in `apps/docs`. Nothing in `tests/published-package.spec.ts` needs editing — it
derives its locale set from the build — and each of the other three lists has a
spec that fails when it is the one left behind.

---

## Component Integration Pattern

Components consume i18n tokens like this:

```ts
// Simple aria-label replacement
protected readonly _i18n = inject(MLV_DIALOG_I18N);
// Template: [attr.aria-label]="_i18n().closeDialog"

// Input default with i18n fallback
readonly ariaLabel = input<string | undefined>(undefined);
protected readonly _resolvedAriaLabel = computed(() => this.ariaLabel() ?? this._i18n().loading);
// Host: '[attr.aria-label]': '_resolvedAriaLabel()'

// ICU parameterized strings
private readonly _resolver = inject(MlvI18nResolverService);
protected readonly _resolvedRange = computed(() =>
  this._resolver.resolve(this._i18n() as unknown as Record<string, string>, 'itemRange', {
    start: this._rangeStart(),
    end: this._rangeEnd(),
    total: this.totalItems(),
  })
);
```

---

## Dependencies

| Package              | Role                                |
| -------------------- | ----------------------------------- |
| `@angular/core`      | Peer — signals, DI, APP_INITIALIZER |
| `intl-messageformat` | Peer — ICU MessageFormat parsing    |

## Build Notes

- Production builds use Angular partial compilation so the package and its
  locale secondary entry points are safe to distribute to applications.
- The source package manifest uses release placeholders for its own version and
  root-managed Angular peer version. Nx Release versions only the workspace
  root; `scripts/publish.mjs` resolves the built manifest from that root before
  npm publication.

---

## AI Translation

### Maintainer script (unpublished)

- `scripts/malva-ui-translate.mjs` — batch-translates the English pack to target locales using the Anthropic API. Supports `--dry-run`, multiple `--target` locales and custom `--model`; reads the key from `ANTHROPIC_API_KEY`.
- **Repo tooling, not part of `@malva-ui/i18n`:** `scripts/` is not published and the package has no `bin`, so it is not a consumer replacement for the runtime API below. It runs in Node on a maintainer's machine; its key never reaches a browser.

### Runtime API — deprecated (#292)

- **`@deprecated since 0.2.0 — removed in 1.0`** on all ten symbols: `MlvAiTranslationService`, `provideMlvAiTranslation`, `MLV_AI_TRANSLATION_CONFIG`, `MLV_AI_TRANSLATION_ENABLED`, `claudeProvider`, `MlvClaudeProviderConfig`, `MlvAiTranslationConfig`, `MlvTranslationProvider`, `MlvTranslationRequest`, `MlvTranslationResult`. Behaviour unchanged while deprecated (VERSIONING.md §3, minor).
- **Why (the whole API):** nothing in the library calls `MlvAiTranslationService`; the config's `enabled` / `cache` / `targetLocale` are never read; and the one shipped provider is unsafe in the browser (next bullet). Decision D26: deprecate, do not repair.
- **The key risk is `claudeProvider()`'s alone.** It sends `apiKey` with every request from whatever runtime calls it. Registered in an application config that reaches the browser, the key ships to every visitor and is readable by any of them; no option on the function can protect it. **Never pass it a real key there.** The two former JSDoc examples that did are gone. A consumer-written `MlvTranslationProvider` that calls the consumer's own server holds no key.
- **No replacement.** Ship translated strings in a language pack (`provideMlvI18n()`) or a per-component `MLV_*_I18N` override. If your own provider calls a server you control, call that server directly. Machine translation belongs in your own build or behind that server — not the maintainer script above, which is not published.
- **Not deprecated:** `MlvTranslationContext` — it types every `MLV_*_I18N_CONTEXT` record.
- Known state, not fixed (deprecated, not repaired): nothing calls the service; `MLV_AI_TRANSLATION_ENABLED` and the config's `enabled` / `cache` / `targetLocale` are never read; `claudeProvider()`'s default `model` (`claude-sonnet-4-5-20241022`) is not a published Anthropic model id, so every request made without an explicit `model` fails (its JSDoc says so); `response.ok` is never checked; failures resolve to `null`.
- Pinned by `src/lib/ai/ai-translation.deprecation.spec.ts`:
  - every export declared under `lib/ai/` (derived from the barrel) plus the four contract types carries a complete tag; `MlvTranslationContext` carries none;
  - no comment anywhere in the `lib/ai/` files or the four contract interfaces matches `/\bapiKey\b\s*[:,}=]/` (property, shorthand `{ apiKey }`, assignment) — JSDoc body, `@example`, member JSDoc and plain comments alike, not only top-level `@example` tags;
  - a self-test pins that the scan sees a fenced body example, a member `@example` and a shorthand key, and skips code and prose naming the member.
  - Tag grammar: `scripts/check-deprecations.mjs`.
- Removal at 1.0 is VERSIONING.md §3 row "removed exported symbol" (major) and owes a `docs/migrations/` entry then.
