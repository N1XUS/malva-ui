---

# Library: search-field

## Overview

`@malva-ui/core/search-field` provides `MlvSearchField` (`mlv-search-field`), a search-specific composite control built from Malva input, button, and loader primitives. It supports debounced live queries and explicit submit queries without submitting a surrounding native form.

## Public API

### Types

- `MlvSearchFieldTrigger = 'live' | 'submit'`
- `MlvSearchFieldPresentation = 'field' | 'icon'`
- `MlvSearchFieldRole = 'searchbox' | 'combobox'`
- `MlvSearchFieldAriaAutocomplete = 'none' | 'list' | 'both'`
- `MlvSearchFieldNavigateDirection = 'up' | 'down' | 'home' | 'end' | 'pageUp' | 'pageDown'`
- `MlvSearchFieldNavigateEvent { direction: MlvSearchFieldNavigateDirection; event: KeyboardEvent }`
- `MlvSearchFieldCommitEvent { value: string; event: KeyboardEvent | MouseEvent }`
- `MlvSearchOverlayContentDef` (`[mlvSearchOverlayContent]`) + `MlvSearchOverlayContentContext`

### Inputs

| Input                  | Type                                     | Default       | Notes                                                                                                                                                                   |
| ---------------------- | ---------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value`                | `model<string>`                          | `''`          | Two-way draft query                                                                                                                                                     |
| `trigger`              | `MlvSearchFieldTrigger`                  | `'live'`      | Commit strategy                                                                                                                                                         |
| `debounce`             | `number`                                 | `200`         | Live-mode trailing delay in ms; negatives clamp to zero                                                                                                                 |
| `placeholder`          | `string \| undefined`                    | i18n          | Override for the language-pack default                                                                                                                                  |
| `ariaLabel`            | `string \| undefined`                    | i18n          | Override for the language-pack default                                                                                                                                  |
| `disabled`             | `boolean`                                | `false`       | —                                                                                                                                                                       |
| `loading`              | `boolean`                                | `false`       | —                                                                                                                                                                       |
| `clearable`            | `boolean`                                | `true`        | —                                                                                                                                                                       |
| `showSubmit`           | `boolean`                                | `true`        | Whether submit mode renders the trailing submit action. Off ⇒ commits from Enter alone and the search glyph moves to the leading edge — exactly one glyph either way    |
| `commitOnClear`        | `boolean`                                | `true`        | Whether clearing commits `''` through `search`. `false` in a composite control that owns commit orchestration independently of the two-way `value` model                |
| `presentation`         | `MlvSearchFieldPresentation`             | `'field'`     | `'icon'` renders a circular search button only and implies `overlay`                                                                                                    |
| `overlay`              | `boolean`                                | `false`       | Opens a full-screen search overlay instead of accepting input inline                                                                                                    |
| `role`                 | `MlvSearchFieldRole`                     | `'searchbox'` | `'combobox'` stamps `role="combobox"` on the input and turns on the `navigate` hooks. `'searchbox'` renders **no** `role` attribute (it is implicit on `type="search"`) |
| `ariaControls`         | `string \| null`                         | `null`        | → `aria-controls` on the input: the popup listbox's DOM id                                                                                                              |
| `ariaActiveDescendant` | `string \| null`                         | `null`        | → `aria-activedescendant`: the highlighted option's DOM id                                                                                                              |
| `ariaAutocomplete`     | `MlvSearchFieldAriaAutocomplete \| null` | `null`        | → `aria-autocomplete`                                                                                                                                                   |
| `ariaExpanded`         | `boolean \| null`                        | `null`        | → `aria-expanded`. Ignored while `overlay` is on, where the input reports the overlay's own state                                                                       |

### Outputs

| Output     | Payload                       | Notes                                                                              |
| ---------- | ----------------------------- | ---------------------------------------------------------------------------------- |
| `search`   | `string`                      | Committed query, per the selected `trigger`                                        |
| `navigate` | `MlvSearchFieldNavigateEvent` | Option-navigation key, only while `role="combobox"`                                |
| `commit`   | `MlvSearchFieldCommitEvent`   | Enter or the submit action, in every `trigger` mode, before the field's own commit |

Live mode deduplicates emitted values. Submit mode emits only from a non-composing Enter key or the trailing submit action. Clearing always cancels a pending live event and updates `value` to `''`; by default it also commits `''` immediately, unless `commitOnClear` is disabled. Loading keeps live input editable so a newer query can replace an in-flight request, while blocking duplicate explicit submissions. Submit mode surfaces loading on the submit button itself; without a submit action a standalone circular loader takes its place.

## Combobox hooks

The field never owns a suggestion popup — it exposes the WAI-ARIA combobox wiring and reports keys, and the consumer owns the listbox, the option list, and the highlight.

- `role="combobox"` is the single opt-in switch. It stamps `role="combobox"` on the underlying `<input>` and starts emitting `navigate`. The default `'searchbox'` renders no `role` attribute and never emits — a plain search field is byte-identical to before.
- **The host never carries the role** (#329). Angular feeds a _static_ `role="combobox"` / `role="searchbox"` to the `role` input **and** writes it to the `<mlv-search-field>` host, which used to nest a second, unnamed combobox with no `aria-expanded` / `aria-controls` around the input (axe `aria-required-attr`; `role="searchbox"`: an unnamed searchbox, `aria-input-field-name`) — on the README's own documented shape and docs example 5. The constructor reads it through `HostAttributeToken('role')` and removes it with `Renderer2.removeAttribute` (the checkbox / switch `id` shape; runs on the server, `ssr-smoke.spec.ts` pins the payload). Deliberately **not** a constant `'[attr.role]': 'null'` host binding (the issue's proposal): it wins the first-pass tie against a consumer's own host `[attr.role]` — a `search` landmark, the only way to put a non-`MlvSearchFieldRole` role on the host — and removes it until that value changes (ablated: `search-field-host-role.spec.ts`'s `[attr.role]` and `createComponent` specs go red). Untouched: a bound `[role]` (never reached the host), a host `[attr.role]`, and a `createComponent(…, { hostElement })` root host's own `role` (`HostAttributeToken` is `null` there). Migration: `docs/migrations/2026-09-search-field-host-role.md`.
- `ariaControls` / `ariaActiveDescendant` / `ariaAutocomplete` / `ariaExpanded` forward straight through `mlv-input`'s existing aria pass-through inputs, so they land on the focusable `<input>`. `aria-haspopup` stays unset for a combobox (`listbox` is its ARIA default); with `overlay` on it is `dialog` and `aria-expanded` reports the overlay instead.
- Meaningful only with `presentation="field"`, and mutually exclusive with `overlay` — an icon trigger has no input, and an overlay trigger is a read-only dialog opener.
- **`navigate` preventDefault policy:** `up`/`down`/`pageUp`/`pageDown` are consumed by the field before the event is handed over — inside a text input they jump the caret to the ends of the query or scroll the page, which is never what a combobox wants. `home`/`end` are reported **un**consumed, because an editable combobox keeps them as caret keys per WAI-ARIA; a consumer that wants "jump to first/last option" calls `preventDefault()` on the supplied event itself.
- **`commit` / `search` interplay:** `commit` fires on a non-composing Enter and on the submit action, in _every_ `trigger` mode, always before the field's own commit. Calling `preventDefault()` on the supplied event takes the commit over — the field skips its `search` emission and leaves the key consumed, so Enter resolves the highlighted option and never submits a surrounding form. Left alone, existing behaviour is unchanged: `submit` mode emits `search`, `live` mode has already emitted through the debounce and Enter still bubbles. `commit` is never offered for an interaction the field would ignore anyway — while `disabled`, while `loading`, or while `overlay` is enabled (Enter opens the dialog there).
- Escape keeps its existing meaning: it clears the field. Closing the popup is consumer state, driven from the same signal that feeds `ariaExpanded`.
- Pair with `@malva-ui/core/dropdown`: `MlvActiveDescendant` holds the index, `optionId(listboxId, index)` builds the id `mlv-dropdown-panel` renders, and the panel takes `focusMode="activedescendant"` + `[activeIndex]`. A panel used outside `mlv-select`/`mlv-combobox` must provide `MlvSelectionService` itself. See docs example 5.

## Overlay search

`MlvSearchField` extends `MlvOverlayHostBase` (`@malva-ui/cdk/overlay`), so `overlay`/`presentation="icon"` reuses the shared modal-overlay lifecycle: `opened` model, animation state, backdrop, Escape/backdrop dismissal, and focus restore to the trigger.

- The overlay is attached with a global position strategy at `100%`/`100%`, panel class `mlv-search-field__overlay-pane`. The panel carries `role="dialog"`, `aria-modal="true"`, and `cdkTrapFocus` with `cdkTrapFocusAutoCapture` — the same trap `mlv-drawer` uses (the dialog now relies on the CDK container's own trap). `autoCapture` also supplies the initial focus, so the overlay body needs no `mlvAutofocus` of its own.
- **The trigger activates on click and Enter/Space, never on focus.** WAI-ARIA treats a control that opens a dialog as a button. Opening on `focusin` drops a keyboard user who is merely tabbing past into a modal, and it fights `MlvOverlayHostBase`'s focus restore — the base returns focus to the trigger on close, which under a focus-opener reopens the overlay immediately. Space is `preventDefault`ed so it cannot scroll the page; Enter is consumed so it cannot submit a surrounding form.
- With `presentation="field"` the inline input becomes the trigger: it is rendered `readonly`, carries `aria-haspopup="dialog"` and `aria-expanded`, and cannot compete with the overlay's own input for typing. `presentation="icon"` renders a circular `<button>` instead.
- **Default overlay body:** a nested `mlv-search-field` — not a second hand-rolled input — configured as a pure input surface (`trigger="submit"`, `[showSubmit]="false"`, `[commitOnClear]="false"`). It relays `valueChange` to the host, which owns the debounce, dedupe and commit; the host handles Enter (`_onOverlayEnter`), committing per its own `trigger` and then closing.
- **Custom overlay body:** project `<ng-template mlvSearchOverlayContent>`. It replaces the default field and receives `MlvSearchOverlayContentContext` — `$implicit`/`query`, `loading`, `placeholder`, `ariaLabel`, `setQuery`, `submit`, `clear`, `close` — with an `ngTemplateContextGuard` for `let-` inference. The host keeps owning the overlay lifecycle and the `value`/`search` contract.
- The overlay surface remaps `.mlv-form-control-wrapper` custom properties for a light-on-dark translucent field (10% white fill, 30/40/50% white border ramp), matching the treatment `mlv-page-shell` uses for chrome-hosted fields.
- **Leave disposal waits for the surface's own `animationend`.** `.mlv-search-field__overlay` binds the base's target-guarded `_onPanelAnimationEnd($event)`, not `onAnimationEnd()`. `animationend` bubbles, and the overlay body is arbitrary — a custom `[mlvSearchOverlayContent]` results list fading rows in is ordinary — so a descendant's finite animation finishing inside the `--mlv-duration-fast` leave window used to dispose the overlay mid-fade and restore focus to the trigger early. The `mlv-search-field-overlay-leave` keyframes run on `.mlv-search-field__overlay` itself (the bound element), so the real path is unaffected, and the base's 350 ms fallback still covers reduced motion. Contract: `.claude/projects/libs-overlay.md` § _The panel's `animationend` is target-guarded_. Specs that only need a leave completed call `component.onAnimationEnd()` directly — that entry point is deliberately unfiltered.

## Accessibility and i18n

- Uses the native search input mode and a labelled trailing submit action. The implicit `searchbox` role is left implicit; `role="combobox"` is the only case that stamps an explicit role — on the `<input>` only, never the host — and it comes with the `aria-controls`/`aria-expanded`/`aria-activedescendant` inputs the pattern requires. `aria-expanded` is not defaulted: a combobox consumer binds `ariaExpanded`, or axe raises `aria-required-attr` on the input.
- Prevents a handled Enter key from submitting a parent form.
- Clear and submit actions are keyboard reachable and localized.
- Defaults come from `MLV_SEARCH_FIELD_I18N`; explicit component inputs win. The overlay's close action uses the `closeOverlay` key.
- Density is inherited by its Malva primitives and motion respects reduced-motion preferences (`mixins.reduced-motion`), including the backdrop and panel enter/leave animations.

## Verification

Run `npx nx test core-search-field`, `npx nx typecheck core-search-field`, and `npx nx lint core-search-field`.
