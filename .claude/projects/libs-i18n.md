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

The i18n library (`@malva-ui/i18n`) provides a signal-based, per-component internationalization system for the Malva UI component library. It uses ICU MessageFormat for pluralization and parameterization, lazy-loaded language packs via secondary entry points, and an optional AI-powered translation pipeline.

**Published package:** `@malva-ui/i18n`
**Secondary entry points:** `@malva-ui/i18n/en`, `/de`, `/fr`, `/it`, `/es`,
`/pt`, `/uk`, `/ro`, `/ja`, `/nl`, `/pl`, `/tr`, `/zh-Hans`, and `/id`, plus
`/testing`

## Architecture

- **Per-component injection tokens** — each component with translatable strings gets a typed `InjectionToken<Signal<ComponentI18n>>`. Components inject this token and read strings reactively.
- **Signal-based** — language switching updates all component strings automatically via Angular signals.
- **APP_INITIALIZER** — `provideMlvI18n()` blocks rendering until the lazy-loaded language pack resolves, eliminating fallback/flash-of-untranslated-content issues.
- **ICU MessageFormat** — strings support pluralization (`{count, plural, one {# item} other {# items}}`), parameter interpolation (`{start}–{end} of {total}`), and select rules via the `intl-messageformat` package.

---

## Public API

Exported from `libs/i18n/src/index.ts`:

| Export                       | Kind           | Description                                           |
| ---------------------------- | -------------- | ----------------------------------------------------- |
| `MlvLanguage`                | Interface      | Aggregate of all 40 component i18n interfaces         |
| `MlvTranslationProvider`     | Interface      | AI provider contract for batch translation            |
| `MlvTranslationRequest`      | Interface      | Single translation request                            |
| `MlvTranslationResult`       | Interface      | Single translation result                             |
| `MlvTranslationContext`      | Interface      | Context metadata for AI translators                   |
| `MlvAiTranslationConfig`     | Interface      | Runtime AI translation configuration                  |
| `MLV_*_I18N`                 | InjectionToken | Per-component i18n tokens (40 total)                  |
| `Mlv*I18n`                   | Interface      | Per-component string interfaces (40 total)            |
| `MLV_*_I18N_CONTEXT`         | Record         | Per-component translation context metadata (40 total) |
| `MlvI18nService`             | Service        | Central language state management                     |
| `MlvI18nResolverService`     | Service        | ICU MessageFormat resolution with caching             |
| `MlvTranslatePipe`           | Pipe           | Template pipe for ICU string resolution               |
| `provideMlvI18n`             | Function       | Root provider factory with lazy loading               |
| `MLV_AI_TRANSLATION_CONFIG`  | InjectionToken | AI translation configuration token                    |
| `MLV_AI_TRANSLATION_ENABLED` | InjectionToken | Per-subtree AI toggle                                 |
| `MlvAiTranslationService`    | Service        | Runtime AI translation with caching                   |
| `provideMlvAiTranslation`    | Function       | AI translation provider factory                       |
| `claudeProvider`             | Function       | Claude adapter factory                                |
| `MlvClaudeProviderConfig`    | Interface      | Claude adapter configuration                          |

---

## Services

### `MlvI18nService`

**File:** `libs/i18n/src/lib/i18n.service.ts`

Central service managing the active language pack. Not `providedIn: 'root'` — provided by `provideMlvI18n()`.

| Method                                      | Description                                               |
| ------------------------------------------- | --------------------------------------------------------- |
| `setLanguage(lang: MlvLanguage)`            | Sets the active language pack (called by APP_INITIALIZER) |
| `switchLanguage(loader)`                    | Switches via lazy import; the latest request wins         |
| `select<K>(key: K): Signal<MlvLanguage[K]>` | Returns a computed signal for a component's i18n slice    |

### `MlvI18nResolverService`

**File:** `libs/i18n/src/lib/i18n-resolver.service.ts`

`providedIn: 'root'`. Resolves ICU MessageFormat strings with parameters. Caches compiled IntlMessageFormat instances.

| Method                        | Description                                     |
| ----------------------------- | ----------------------------------------------- |
| `resolve(i18n, key, params?)` | Resolves an ICU string with optional parameters |

### `MlvAiTranslationService`

**File:** `libs/i18n/src/lib/ai/ai-translation.service.ts`

`providedIn: 'root'`. Runtime AI translation for missing keys. In-memory cache.

---

## Pipe

### `MlvTranslatePipe` (`mlvTranslate`)

**File:** `libs/i18n/src/lib/translate.pipe.ts`

Resolves ICU MessageFormat strings in templates:

```html
{{ _i18n().allItems | mlvTranslate: { total: totalItems() } }}
```

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

| Token                        | Interface                | Component                        | Keys                                                                                                                                                                                                                                                                          |
| ---------------------------- | ------------------------ | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MLV_ALERT_I18N`             | `MlvAlertI18n`           | mlv-alert                        | dismiss                                                                                                                                                                                                                                                                       |
| `MLV_AVATAR_GROUP_I18N`      | `MlvAvatarGroupI18n`     | mlv-avatar-group                 | noMembers, memberCount (ICU `{total}`), visibleMembers (ICU `{total}` `{visible}`), moreMembers (ICU `{count}`), allMembers                                                                                                                                                   |
| `MLV_BOTTOM_NAV_I18N`        | `MlvBottomNavI18n`       | mlv-bottom-nav                   | navigation, moreOptions, more, moreMenu                                                                                                                                                                                                                                       |
| `MLV_BREADCRUMB_I18N`        | `MlvBreadcrumbI18n`      | mlv-breadcrumb                   | hiddenItems, label, showMore (ICU)                                                                                                                                                                                                                                            |
| `MLV_CALENDAR_I18N`          | `MlvCalendarI18n`        | mlv-calendar, mlv-calendar-sheet | previousPeriod, nextPeriod, switchView (ICU), selectMonthForYear (ICU), done, selectYear, monthList                                                                                                                                                                           |
| `MLV_CHAT_I18N`              | `MlvChatI18n`            | mlv-chat                         | 16 keys (chatLabel, today, yesterday, statusSending/Sent/Delivered/Read/Failed, retry, newMessages, typing, playAudio, pauseAudio, imageFallbackAlt, moreMedia, loadingOlder)                                                                                                 |
| `MLV_CHIP_I18N`              | `MlvChipI18n`            | mlv-chip                         | remove                                                                                                                                                                                                                                                                        |
| `MLV_COLOR_PICKER_I18N`      | `MlvColorPickerI18n`     | mlv-color-picker                 | 14 keys (hue, opacity, pickColor ICU, etc.)                                                                                                                                                                                                                                   |
| `MLV_COMBOBOX_I18N`          | `MlvComboboxI18n`        | mlv-combobox                     | 6 keys (searchPlaceholder, toggleOptions, noResults, pressEnterToAdd ICU `{query}`, loading, resultsAvailable ICU)                                                                                                                                                            |
| `MLV_COMPARE_I18N`           | `MlvCompareI18n`         | mlv-compare                      | ariaLabel (fallback accessible name of the hidden range slider)                                                                                                                                                                                                               |
| `MLV_COPY_TO_CLIPBOARD_I18N` | `MlvCopyToClipboardI18n` | mlv-copy-to-clipboard            | copyToClipboard                                                                                                                                                                                                                                                               |
| `MLV_DATA_TABLE_I18N`        | `MlvDataTableI18n`       | mlv-data-table                   | Search, filtering, sorting, resizing, editing, pinning, tree labels, and the error state (errorTitle, errorMessage, retry)                                                                                                                                                    |
| `MLV_DATE_RANGE_PICKER_I18N` | `MlvDateRangePickerI18n` | mlv-date-range-picker            | 6 keys                                                                                                                                                                                                                                                                        |
| `MLV_DAY_PICKER_I18N`        | `MlvDayPickerI18n`       | mlv-day-picker                   | placeholder, selectDay                                                                                                                                                                                                                                                        |
| `MLV_DIALOG_I18N`            | `MlvDialogI18n`          | mlv-dialog                       | closeDialog, confirm, cancel                                                                                                                                                                                                                                                  |
| `MLV_DRAWER_I18N`            | `MlvDrawerI18n`          | mlv-drawer                       | drawer, closeDrawer                                                                                                                                                                                                                                                           |
| `MLV_EDITOR_I18N`            | `MlvEditorI18n`          | mlv-editor                       | 101 keys: labels, formatting, links, tables, uploads, counts, block drag/move, and AI transforms/review-bar/announcements                                                                                                                                                     |
| `MLV_FILE_UPLOAD_I18N`       | `MlvFileUploadI18n`      | mlv-file-upload                  | 7 keys (incl. errorSingleFile, errorFileType `{name}`, errorFileSize `{name}` `{size}`)                                                                                                                                                                                       |
| `MLV_FILTER_I18N`            | `MlvFilterI18n`          | mlv-filter                       | Filter actions, summaries, visibility, conditions, and operator labels                                                                                                                                                                                                        |
| `MLV_FORM_UTILS_I18N`        | `MlvFormUtilsI18n`       | form-control-wrapper             | clear, required, invalidValue                                                                                                                                                                                                                                                 |
| `MLV_LOADER_I18N`            | `MlvLoaderI18n`          | mlv-loader                       | loading                                                                                                                                                                                                                                                                       |
| `MLV_NOTIFICATION_I18N`      | `MlvNotificationI18n`    | mlv-notification-item            | dismiss                                                                                                                                                                                                                                                                       |
| `MLV_NUMBER_INPUT_I18N`      | `MlvNumberInputI18n`     | mlv-number-input                 | decrement, increment                                                                                                                                                                                                                                                          |
| `MLV_PAGINATION_I18N`        | `MlvPaginationI18n`      | mlv-pagination                   | 9 keys (incl. ICU)                                                                                                                                                                                                                                                            |
| `MLV_PIN_INPUT_I18N`         | `MlvPinInputI18n`        | mlv-pin-input                    | digit (ICU), pinEntry                                                                                                                                                                                                                                                         |
| `MLV_POPUP_I18N`             | `MlvPopupI18n`           | mlv-popup                        | close (mobile fullscreen close button)                                                                                                                                                                                                                                        |
| `MLV_PROGRESS_I18N`          | `MlvProgressI18n`        | mlv-progress                     | progress                                                                                                                                                                                                                                                                      |
| `MLV_RATING_I18N`            | `MlvRatingI18n`          | mlv-rating                       | rating, rateValue (ICU)                                                                                                                                                                                                                                                       |
| `MLV_SCHEDULER_I18N`         | `MlvSchedulerI18n`       | mlv-scheduler                    | 22 keys: toolbar labels, ICU `view` select (previous/next/gridLabel), plural overflow (`moreEvents` + `moreEventsLabel`), slot/day/event aria-labels, dragHint, 5 live announcements                                                                                          |
| `MLV_SCROLLBAR_I18N`         | `MlvScrollbarI18n`       | mlv-scrollbar                    | scrollableRegion                                                                                                                                                                                                                                                              |
| `MLV_SEARCH_FIELD_I18N`      | `MlvSearchFieldI18n`     | mlv-search-field                 | placeholder, search, submit, clear                                                                                                                                                                                                                                            |
| `MLV_SELECT_I18N`            | `MlvSelectI18n`          | mlv-select                       | 5 keys (placeholder, searchPlaceholder, noResults, loading, resultsAvailable ICU)                                                                                                                                                                                             |
| `MLV_SIDEBAR_I18N`           | `MlvSidebarI18n`         | mlv-sidebar                      | navigation, notifications (ICU), switchWorkspace (ICU), workspaceMenu, expand, collapse, openNavigation, closeNavigation                                                                                                                                                      |
| `MLV_SLIDER_I18N`            | `MlvSliderI18n`          | mlv-slider                       | minValue, maxValue, value                                                                                                                                                                                                                                                     |
| `MLV_STEPPER_I18N`           | `MlvStepperI18n`         | mlv-stepper                      | optional                                                                                                                                                                                                                                                                      |
| `MLV_TABS_I18N`              | `MlvTabsI18n`            | mlv-tabs                         | moreTabs                                                                                                                                                                                                                                                                      |
| `MLV_TASKBOARD_I18N`         | `MlvTaskboardI18n`       | mlv-taskboard                    | 24 keys: boardLabel, addCard, emptyCell, cardLabel (ICU `{label}`), laneName (ICU `{lane}`), keyboardInstructions, grabbed, targetValid/targetInvalid, moved, moveRejected, moveCancelled, releasedInPlace, wipState, selectionCount (ICU plural), and nine `reason*` phrases |
| `MLV_TILE_I18N`              | `MlvTileI18n`            | mlv-tile                         | close, generic tile label, parameterized drag-handle label, keyboard instructions, parameterized move/rejection announcements, and the empty/restricted drop-target strings                                                                                                   |
| `MLV_TIME_PICKER_I18N`       | `MlvTimePickerI18n`      | mlv-time-picker                  | period, timePicker                                                                                                                                                                                                                                                            |
| `MLV_TOAST_I18N`             | `MlvToastI18n`           | mlv-toast-item                   | dismiss                                                                                                                                                                                                                                                                       |
| `MLV_TOKENIZER_I18N`         | `MlvTokenizerI18n`       | mlv-tokenizer                    | addToken                                                                                                                                                                                                                                                                      |

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

`libs/i18n/tests/locale-contract.spec.ts` validates exact key parity, ICU named
arguments, select branches, required plural branches, compilation, and
representative formatting across all fourteen packs.

### Adding a new language

Use the AI translation CLI:

```bash
node scripts/malva-ui-translate.mjs --target uk --provider claude --api-key <key>
```

Or create manually under `libs/i18n/<locale>/src/lib/<locale>.ts` following the
English pack structure, with `ng-package.json` and entry `src/index.ts`. Adding
another shipped locale also requires extending the all-locale contract and the
strict update list above.

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

### Build-time CLI

`scripts/malva-ui-translate.mjs` — batch-translates English pack to target locales using the Anthropic API. Supports `--dry-run`, multiple `--target` locales, and custom `--model`.

### Runtime service

`MlvAiTranslationService` with `provideMlvAiTranslation()` — opt-in per-subtree runtime translation for missing keys. Uses `MlvTranslationProvider` interface for provider-agnostic backends. Ships with `claudeProvider()` adapter.
