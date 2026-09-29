# Library: view-variant

> **Keep this file up to date.** Update it whenever this library's public API,
> packaging, tests, or implementation changes.

## Overview

`@malva-ui/core/view-variant` provides controlled, generic saved-view
navigation and dirty-state actions for consumer-owned named snapshots. It never
persists data, looks up authorization, owns dirty state, or confirms discarded
changes; hosts supply those values and respond to the emitted requests.

## Public API

| Export                                | Kind      | Purpose                                                                                                                     |
| ------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------- |
| `MlvViewVariantScope`                 | Type      | Ownership scope: `system`, `team`, or `personal`.                                                                           |
| `MlvViewVariantAction`                | Type      | Supported action: create, clone, update, rename, delete, or share.                                                          |
| `MlvViewVariantCapabilities`          | Interface | Immutable per-view permissions for clone, update, rename, delete, and share.                                                |
| `MlvViewVariant<TState>`              | Interface | Immutable named saved view with host-owned durable `state`, scope, capabilities, and optional persistence/display metadata. |
| `MlvViewVariantBusyAction`            | Interface | Immutable in-progress action with an optional target view identifier.                                                       |
| `MlvViewVariantCreateRequest<TState>` | Interface | Immutable request for a new personal or team view; its scope excludes `system`.                                             |
| `MlvViewVariantGroupLabels`           | Interface | Immutable labels for the system, team, and personal view groups.                                                            |
| `MlvViewVariantList<TState>`          | Component | Controlled, searchable System/Team/My views navigation with create and overflow action requests.                            |
| `MlvViewVariantStatus<TState>`        | Component | Controlled dirty/read-only status band with permission-aware reset, clone, update, and create requests.                     |

### `MlvViewVariantList<TState>`

Required input: `variants`. Models: `activeId` (default `null`) and `query`
(default empty). Inputs: `canCreate` (default `false`), `createScopes`
(default `['personal']`), `groupLabels` (`MlvViewVariantGroupLabels | undefined`,
default `undefined` — an override; unset, the three group headings come from
the i18n `systemViews` / `teamViews` / `personalViews` keys, #371),
`busyAction`, `errorMessage`, and `deferSelection` (default `false`).

Outputs: `variantSelect`, `createRequest`, `renameRequest`, `deleteRequest`,
`shareRequest`, `retryRequest`, and `dismissError`. Groups always render in
System, Team, Personal order after the local case- and diacritic-insensitive
query is applied. By default it emits `variantSelect` before optimistically
writing `activeId`. Set `deferSelection` when selection requires host approval:
the component then emits without writing the model, so rejected requests keep
the actual active row current and can be selected again. Re-clicking the true
active row remains a no-op in either mode. Create is only shown for a permitted
non-system scope; row overflow actions are only shown for the corresponding
capability.

### `MlvViewVariantStatus<TState>`

Inputs: `variant` (default `null`), `dirty` (default `false`), `canCreate`
(default `false`), `busyAction`, and `errorMessage`. Outputs: `resetRequest`,
`cloneRequest`, `updateRequest`, `createRequest`, `retryRequest`, and
`dismissError`.

The internal modes are `unsaved`, `locked-clean`, `locked-dirty`,
`editable-dirty`, and `editable-clean`. `editable-clean` intentionally renders
no status band. The other modes expose only allowed actions: update requires a
dirty update-capable active view, clone requires clone capability, and create
requires `canCreate`. Only the matching pending action becomes busy. Errors are
polite `role="status"` content with retry and dismiss requests.

### Localized strings (#371)

- Both components inject the new optional `MLV_VIEW_VARIANT_I18N` slice
  (`MlvViewVariantI18n` in `@malva-ui/i18n`, `MlvLanguage.viewVariant?`) through
  the internal `injectViewVariantMessages()` (`view-variant-i18n.ts`, not
  exported): a `computed` merging the defined keys over English
  `OPTIONAL_MESSAGE_FALLBACKS`, so an app without the slice renders the old
  English byte for byte.
- 25 keys, all optional: list — `searchViews`, `newView`, `newTeamView`,
  `newPersonalView`, `retry`, `dismiss`, `systemViews`, `teamViews`,
  `personalViews`, `readOnly`, `moreActions` / `variantActions` (`{name}`),
  `rename`, `share`, `delete`, `noMatches`; status — `duplicateView`,
  `resetChanges`, `updateView`, `saveAsNew`, `reset`, `readOnlySystemView`,
  `duplicateToSave`, `unsavedChanges`, `unsavedView`.
- `groupLabels` stays an override (owner decision); an app that bound it for
  translation can drop the binding once it ships the slice.
- Every shipped pack translates the slice; `retry` / `dismiss` / `reset` equal
  the pack's `dataTable.retry` / `notification.dismiss` / `filter.reset`
  (pinned by `locale-contract.spec.ts`). Live switch: `view-variant-i18n.spec.ts`.

### `mlvViewStateEqual()`

`mlvViewStateEqual(first, second, normalize)` compares the JSON serialization
of two host-normalized states. The host normalizer must omit transient values
and return stable object-key and array ordering. This helper intentionally is
not generic deep equality and never reorders values itself.

## Verification

Run the focused checks:

```sh
yarn nx test core-view-variant --skipNxCache
yarn nx typecheck core-view-variant --skipNxCache
yarn tsc --noEmit -p libs/core/view-variant/tsconfig.spec.json
yarn nx lint core-view-variant --skipNxCache
yarn nx run styles:check-padding-tokens --skipNxCache
yarn nx run docs:check-doc-api --skipNxCache
```
