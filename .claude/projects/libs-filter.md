---

# Library: filter

## Overview

`@malva-ui/core/filter` provides a compact field filter and a metadata-driven Smart Filter Bar. Both use an immutable, backend-neutral condition model instead of embedding Data Table-specific predicates.

## Public API

### `MlvFilter` (`mlv-filter`)

- Inputs: `label`, `key`, `appearance`, `options`, `editor`, `multiple`, `allowMultipleConditions`, `operators`, `operatorLabels`, `defaultOperator`, `placeholder`, `applyMode`, `disabled`, `loading`, `invalid`, `ariaDescribedBy`, and `valueEditor`. `appearance` defaults to `field`; `query` presents a natural-language sentence chip with a labelled remove action.
- Models: `conditions`, `conditionStrategy`, and `opened`.
- Outputs: `applied` and `cleared`.
- Option editors support one or many values. Text/number editors support operator selection, optional multiple conditions, OR-by-default composition (overridable with `conditionStrategy`), and either live or explicit Apply/Cancel behavior.
- The bounded options editor renders the shared `mlv-dropdown-panel` (`@malva-ui/core/dropdown`) inside the popover — the same primitive `mlv-select` / `mlv-combobox` use — so option rows, per-option `disabled`, selection tokens and listbox keyboard behavior come from `@angular/aria` instead of a hand-rolled roving-tabindex list. `mlv-filter` provides `MlvSelectionService` for the panel and names the listbox with `[ariaLabel]="label()"`; a disabled or loading filter marks every row disabled so a panel already open when loading starts stops offering picks it would reject, and `maxHeight` keeps the option slab at the previous 20rem budget rather than the panel's taller viewport-derived default. The panel keeps its default `scrollMode="self"` here rather than the `scrollMode="parent"` that `mlv-select` / `mlv-combobox` bind inside their own `mlv-popup` (see `libs-dropdown.md`) — the popover's pinned title/Clear header and (explicit-mode) Cancel/Apply footer must stay outside the scroll region, so the option list needs its own self-owned, bounded (320px / 20rem) scroll area rather than scrolling the whole popup content underneath them. Selection round-trips to conditions: single-select commits `equals` and closes the popover (clicking the selected row again deselects it, aria's toggle semantics), multi-select accumulates one `in` condition and keeps it open.
- aria's listbox owns a `value` model that it reconciles against the options actually _registered_ in the DOM, re-emitting `valueChange` from that reconciliation and not only from user picks. `mlv-filter` filters both shapes of noise before anything rewrites the draft: an emit that restates the selection unchanged (compared as a multiset via `fast-equals`, so duplicates and structured values are handled) and an emit that drops committed values with no rendered option (`isReconciliationEmit` from `@malva-ui/core/dropdown`, compared with `Object.is` to mirror aria's own matching). A committed value whose option has not arrived yet — async options, a saved view restored ahead of its choices, a removed choice — therefore survives opening the popover, and `filteredOutCommitted` re-adds it to a genuine multi-select pick instead of letting one extra pick discard the rest. Closing on a restated single-select emit is live-mode only: an explicit draft is resolved by Apply/Cancel alone.
- **Clear reseed.** The panel's Clear action always empties the _committed_ conditions (`[]`, live mode commits immediately; explicit mode stages it for Apply/Cancel). For a free-form (non-options) editor the _draft_ reseeds to one empty condition instead of zero, so the popover never dead-ends with no condition row to fill back in; a bounded options editor's draft clears to `[]` outright since its rows come from `options`, not a user-typed condition. Applying the reseeded draft unchanged still commits `[]` and emits `cleared`.

### Custom value editor

- `MlvFilterValueEditorDef` (`ng-template[mlvFilterValueEditor]`) replaces the built-in value input of a free-form condition with any consumer control (date picker, tokenizer, remote picker). Project it into `mlv-filter`, or pass a `TemplateRef` to the `valueEditor` input — the input wins over the projected content child.
- The directive's own `mlvFilterValueEditor` key input (default `''`) targets one smart-filter-bar definition key; an empty key is the fallback for every free-form field. `mlv-smart-filter-bar` collects every `MlvFilterValueEditorDef` projected as its content children and resolves the template for each definition itself: an exact `mlvFilterValueEditor` key match on that definition's `key` wins; otherwise the key-less (`''`) fallback template applies if one is projected; otherwise the built-in editor renders. At most one exact-key and one fallback template are consulted — a second template for the same key or a second key-less template is never disambiguated further (first match by content-child order).
- Template context (`MlvFilterValueEditorContext`): `$implicit` (current value, or the `between` range array), `condition`, `index`, `operator`, `disabled`, `placeholder`, `setValue(value)`, and `commit()`. `setValue` writes the draft and commits immediately in live mode; `commit()` applies the draft in explicit mode and is a no-op in live mode.
- The slot replaces both the single-value input and the `between` range pair, is not rendered for valueless operators (`empty` / `not-empty`), and never replaces the lib-owned operator select. Opening the editor focuses the first focusable control inside the rendered value cell.

### `MlvSmartFilterBar` (`mlv-smart-filter-bar`)

- `definitions` is the required metadata source for available fields, editor types, operators, defaults, required fields, and initial visibility.
- Models: `filters`, `visibleKeys`, `searchValue`, and `filtersVisible`.
- Execution inputs: `appearance`, `searchTrigger`, `searchDebounce`, `filterApplyMode`, `autoExecute`, `showSearch`, `loading`, and `disabled`. `appearance` defaults to `classic`; `query` adds searchable filter discovery, sentence chips, Clear all, and an Apply action only for explicit field mode.
- Outputs: `execute`, `refresh`, and `resetCompleted`.
- Public actions: `executeQuery()`, `refreshQuery()`, `clear()`, and `resetToDefaults()`.
- Required definitions remain visible and block `execute` and `refresh` while empty. A blocked query exposes localized summary and field errors, expands the filter row, and focuses the first incomplete field.
- Active filters remain visible and cannot be hidden in the manager until their conditions are cleared; removed metadata keys are pruned and surviving state/visibility is normalized to metadata order.
- The `query`-appearance **Add filter** trigger (`.mlv-smart-filter-bar__add`) is a dashed, secondary-text-toned chip — `border: dashed var(--mlv-border-normal)` with a leading `lucidePlus` glyph — that darkens to `--mlv-text-primary` on hover; it inherits `mlvButton`'s default `--mlv-btn-radius` (`--mlv-radius-button` = `--mlv-radius-l`, 8px) rather than overriding it, matching the dominant corner radius of the sibling `--query` filter-trigger sentence chips.
- Asynchronous and changing definition sets initialize new defaults without re-adding previously hidden defaults.
- The available-filters manager is a focus-trapped modal, stages visibility edits, and commits or discards the draft through Apply/Cancel.
- Loading disables query, toolbar, filter, and manager controls consistently.

### Neutral model

The entry point exports `MlvFilterOperator`, `MlvFilterCondition`, `MlvFilterConditionStrategy`, `MlvFilterApplyMode`, `MlvSmartFilterBarAppearance`, `MlvFilterOption`, `MlvFilterDefinition`, `MlvFilterFieldState`, and `MlvFilterExecutionPayload`. Definitions may override built-in translated operator labels with domain-specific `operatorLabels`. Execution payloads deeply clone supported nested option values so consumers cannot mutate internal state through an emitted snapshot, retain the flat `filters` model, and include its equivalent grouped `expression`.

### Grouped expressions

`MlvFilterExpression` is a recursive, readonly condition/group tree. Use `mlvFilterFieldsToExpression()` to adapt the existing flat field state without changing its public contract: fields compose in a top-level `and`; multi-condition fields become an ordered group using their `strategy`; empty fields are omitted as no-ops.

`mlvFilterExpressionToFields()` is intentionally conservative. It normalizes boolean identities before flattening: empty `and` is true and maps to `[]`; empty `or` is false and maps to `null` when it is the whole expression or an AND child, but is ignored inside a larger OR; a true AND child dominates an OR and maps to `[]`. It then flattens nested `and` groups and same-field `or` groups, but returns `null` for cross-field `or` and mixed same-field compositions that cannot be represented by one field strategy without changing their meaning. Direct condition leaves and singleton groups normalize to the semantically-neutral `and` strategy; a one-condition flat field therefore cannot round-trip its irrelevant strategy marker.

`mlvMatchesFilterExpression(value, expression, readValue)` evaluates a tree against any domain model through the supplied `(value, key) => unknown` reader. Empty groups follow boolean identities: `and` is true and `or` is false. `contains`, `not-contains`, `starts-with`, and `ends-with` stringify nullish values as empty strings and compare case/diacritic-insensitively. `equals`/`not-equals` and `in`/`not-in` use strict identity; membership requires an array operand and does not expand an array-valued field. Numeric comparisons accept finite numbers or nonblank numeric strings; `between` is inclusive, requires exactly two ordered finite bounds, and invalid numeric/range inputs do not match. `empty`/`not-empty` ignore their operands and recognize nullish values, `''`, and empty arrays.

## Accessibility and i18n

- Native buttons plus dialog/listbox semantics provide keyboard activation; bounded options inherit the `mlv-dropdown-panel` listbox — `@angular/aria` owns Arrow/Home/End navigation, type-ahead, and skipping disabled options.
- Popovers focus their editor on open and restore the invoking control on close; a bounded editor lands on the listbox's roving tab stop, which aria parks on the committed option (first focusable otherwise). The available-filter manager traps focus while open.
- Required validation uses `aria-invalid`, field descriptions, and a localized alert summary.
- Every built-in label, operator, strategy, action, summary, and accessible name resolves through `MLV_FILTER_I18N`; definitions and inputs supply domain copy.
- English and Spanish language packs cover the full operator set.

## Verification

Run `yarn nx run-many -t vite:test typecheck lint -p core-filter`.
