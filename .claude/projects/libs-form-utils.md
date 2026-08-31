---
# Library: form-utils

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Form Utils library (`@malva-ui/core/form-utils`) provides foundational building blocks for accessible, state-aware forms. Includes form field wrappers, label/hint/message components, a `ControlValueAccessor` base class, and a `MlvSelectionService` for dropdown/select components.

## Public API

Exported from `libs/forms/form-utils/src/index.ts`:

| Export | Kind | Description |
|--------|------|-------------|
| `MlvFormState` | Type | `'default' \| 'success' \| 'info' \| 'warning' \| 'error'` |
| `MlvErrorDisplayStrategy` | Type | `'touched' \| 'dirty' \| 'submit' \| 'immediate'` |

> **Tone-unification exclusion (intentional).** `MlvFormState` deliberately keeps the input name **`state`** and the **`'error'`** member. It expresses *form-validation* semantics (used by `mlv-input`, `mlv-textarea`, `mlv-select`, `mlv-checkbox`/`mlv-checkbox-group`, `mlv-switch`/`mlv-switch-group`, `mlv-radio-group`, `mlv-day-picker`, `mlv-time-picker`, `mlv-date-range-picker`, `mlv-form-field`, `mlv-message`, and the CVA base `FormControlBase` — inherited by `mlv-rating`, `mlv-radio-group`, `mlv-color-picker-popup`), **not** the display-surface visual `tone` unified via `MlvTone` in `@malva-ui/cdk/utils`. Its only change in the API-unification refactor was renaming the old long-form info member → **`'info'`** so the token vocabulary matches everything else (`--state-info` / `--info` BEM modifiers, `state() === "info"` host bindings).
| `MlvFormField` | Component | Auto-validation wrapper — `mlv-form-field` |
| `MlvLabel` | Component | Form label — `mlv-label` |
| `MlvHint` | Component | Label hint — `mlv-hint`; renders a question-mark icon + tooltip |
| `MlvDescription` | Component | Persistent help text below the control — `mlv-description` |
| `MlvMessage` | Component | Validation message — `mlv-message` |
| `FormControlBase<T>` | Abstract Directive | Base for custom form controls |
| `MlvFormControlWrapper` | Component | Control wrapper with prefix/suffix — `mlv-form-control-wrapper` |
| `MlvFormControlWrapperControl` | Directive | Control template slot — `[mlvFormControlWrapperControl]` |
| `FormControlWrapperControlAppend` | Directive | Suffix slot — `[mlvFormControlWrapperControlAppend]` |
| `FormControlWrapperControlPrepend` | Directive | Prefix slot — `[mlvFormControlWrapperControlPrepend]` |
| `MlvSelectionService<T>` | Service | Selection state management for dropdowns |
| `toAriaValues<V>` | Function | Normalises a CVA value (`T` / `T[]` / `null`) into the `V[]` array `@angular/aria` selection patterns require |
| `fromAriaValues<V>` | Function | Collapses an aria `V[]` selection array back to the CVA shape (`V \| null` single, `V[]` multi) |
| `MlvFocusableGroupBase<T>` | Abstract Directive | Roving-tabindex focus scaffold for composite groups; extended by `mlv-checkbox-group` / `mlv-switch-group` |
| `MlvClearMlvButton` | Component | Shared clear-X button (`mlv-clear-button`) used by the wrapper and inlined by select/combobox |
| `MlvFocusableGroupItem` | Interface | Per-item contract for the base: `FocusableOption` + `tabIndex: WritableSignal<number>` |

---

## Focusable group base

**File:** `libs/core/form-utils/src/lib/focusable-group-base.ts`

`@Directive()` abstract base owning **only** the focus / roving-tabindex concern shared by composite groups whose single tab stop follows focus.

- `MlvFocusableGroupBase<T extends MlvFocusableGroupItem>` — subclass supplies `_items: Signal<readonly T[]>` (live children, e.g. `contentChildren`) and `_isDisabled(item): boolean` (arrow-nav skip predicate); base wires a vertical + wrapping `FocusKeyManager`, the `change`→tabindex sync (only the active child is `tabindex=0`), public `onKeydown` (ArrowUp/Down + `preventDefault`), public `onChildFocus` (`setActiveItem`), initial tab stop on the first child, and `DestroyRef` teardown (unsubscribe + destroy, including before every rebuild).
- `MlvFocusableGroupItem` — `FocusableOption` whose `tabIndex` is a `WritableSignal<number>` the group flips `0`/`-1`; satisfied by `mlv-checkbox` / `mlv-switch`.
- Adopted by `MlvCheckboxGroup` + `MlvSwitchGroup` (deduped their identical manager lifecycle; the `change`-sub was previously missing on switch — see libs-switch.md).
- **Not adopted by `mlv-radio-group`** (deliberate): radio's tab stop follows the _checked_ radio (selection-driven, not focus-driven), its arrows move selection across all four keys, and its effect couples radio-name + CVA selection — a focus-only base cannot express that without behavior change, so radio keeps its own `FocusKeyManager`.

---

## `@angular/aria` CVA value bridge

**File:** `libs/core/form-utils/src/lib/aria-value-bridge.ts`

Pure helpers that translate between the CVA single/multi value shape used by `FormControlBase<T>` and the array-only selection model (`value: ModelSignal<V[]>`) that `@angular/aria` selection patterns (`ngListbox`, `ngMenu`, `ngTree`, …) expose — single-select is a 1-element array in aria. Used by components that keep their `T`/`T[]` CVA contract while driving an aria pattern underneath.

```ts
toAriaValues<V>(value: V | readonly V[] | null | undefined): V[];
//  null | undefined        -> []          (cleared)
//  array                   -> [...array]  (multi-select, shallow copy)
//  any other value         -> [value]     (single-select)

fromAriaValues<V>(values: readonly V[] | null | undefined, multiple: boolean): V | V[] | null;
//  multiple === true       -> [...values] (empty stays [])
//  multiple === false      -> values[0] ?? null
```

Round-trips: `fromAriaValues(toAriaValues(v, multi), multi)` yields the canonical form of `v` (including `null`/clear and falsy primitives). An incoming array is treated as an already-expanded multi value. Covered by `aria-value-bridge.spec.ts` (round trip incl. null/clear).

---

## Components

### `MlvFormField`

**File:** `libs/forms/form-utils/src/lib/form-field/form-field.ts`
**Selector:** `mlv-form-field` | **Change Detection:** `OnPush`

#### Inputs

| Name              | Type                                          | Default     | Description                     |
| ----------------- | --------------------------------------------- | ----------- | ------------------------------- |
| `state`           | `MlvFormState`                                | `'default'` | Visual state                    |
| `errorMessages`   | `Record<string, string \| ((err) => string)>` | `{}`        | Custom validator error messages |
| `displayStrategy` | `MlvErrorDisplayStrategy`                     | `'touched'` | When to show errors             |

**Built-in error messages:** `required`, `email`, `min`, `max`, `minlength`, `maxlength`, `pattern`

**`MlvErrorDisplayStrategy`:**

- `'touched'` — show after blur
- `'dirty'` — show after first change
- `'submit'` — show after form submission
- `'immediate'` — always show

When the selected strategy makes an error visible, `resolvedState()` becomes `error` and the field applies the error border token to the projected control wrapper as well as rendering the error message. The direct-child CSS scope prevents an outer field from recoloring controls owned by a nested field.

---

### `MlvLabel`

**File:** `libs/forms/form-utils/src/lib/label/label.ts`
**Selector:** `mlv-label`

#### Inputs

| Name       | Type                 | Default |
| ---------- | -------------------- | ------- |
| `for`      | `string`             | `''`    |
| `required` | `boolean` (`coerce`) | `false` |

Renders `<label [attr.for]="for">`. Supports nested `<mlv-hint>`, projected into
`.mlv-label__hint` — which renders as an icon + tooltip, not inline text (see `MlvHint`).

`required` renders `<span class="mlv-label__required" aria-hidden="true">*</span>` plus a
`.cdk-visually-hidden` node carrying the translated `formUtils.required` word (falls back to
`'required'` when `provideMlvI18n()` was never called). Controls extending
`MlvSignalFormUiControlBase` forward their own `required` input here; standalone `mlv-label`
usage can set it directly.

---

### `MlvHint`

**File:** `libs/core/form-utils/src/lib/hint/hint.ts`
**Selector:** `mlv-hint` | **Change Detection:** `OnPush`

Secondary hint for the control named by the enclosing `mlv-label`. Authored as **projected
content** (`<mlv-hint>Sent to your phone</mlv-hint>`) — that is the whole public API, there are
no inputs — but it **renders as a small `circle-question-mark` icon button** (`LucideCircleQuestionMark`,
`[size]="14"`) that reveals the text in an `[mlvTooltip]` on hover **and** on keyboard focus.
Use `mlv-description` for sentence-length help text that should stay permanently visible below
the control.

**Why an icon and not inline text.** The hint used to render as text directly inside the
label's `display: inline-flex` row, so a long hint became a flex sibling of the label text and
forced the label to wrap mid-phrase. An icon is a fixed-size sibling, so the label row stays on
one line at any hint length.

#### DOM

```html
<mlv-hint class="mlv-hint">
  <!-- rendered only while the projected text is non-empty -->
  <button type="button" class="mlv-hint__trigger" aria-label="<hint text>" [mlvTooltip]="<hint text>">
    <svg lucideCircleQuestionMark aria-hidden="true" />
  </button>
  <span class="mlv-hint__source" aria-hidden="true"><!-- projected content --></span>
</mlv-hint>
```

#### How the tooltip string is obtained

`mlvTooltip` needs a `string`, but the public API is content projection. The projected content
is rendered into `.mlv-hint__source`, which is `display: none` (`textContent` still resolves on
a non-displayed element) and read into a private `_text` signal:

- The first read happens in `afterNextRender`, so it never runs during SSR.
- A `MutationObserver` (`childList` + `characterData` + `subtree`) keeps `_text` in sync, which
  is what makes the interpolated form every control uses — `<mlv-hint>{{ hint() }}</mlv-hint>` —
  update at runtime. An `effect()` would **not** work here: `textContent` is not a reactive read,
  and the mutated text node belongs to the _parent_ view. The observer is disconnected via
  `DestroyRef.onDestroy`. Re-setting the signal to an identical string is a no-op, so there is no
  render loop.

#### Accessibility

- `.mlv-hint__source` is `aria-hidden`. Previously the hint text sat inside the `<label>` and
  leaked into the labelled control's accessible name (`"Full name Shown on every comment"`).
  Hiding it yields a clean control name; the same string is placed on the trigger's `aria-label`,
  so the hint stays reachable to assistive tech via the icon.
- The trigger is a real `<button type="button">`, so it is in the tab order, activates on
  Enter/Space, and gets a `:focus-visible` ring (`--mlv-border-focus`). `MlvTooltip` opens on
  `focusin` as well as `mouseenter`, so keyboard users get the hint, and closes on `Escape`.
- **No trigger is rendered while the projected text is empty.** An empty `<mlv-hint>` would
  otherwise leave a nameless icon button behind — an AXE `button-name` violation. (This is why
  the component uses an `@if` rather than `MlvTooltip`'s `tooltipDisabled`.)
- The click handler calls **both** `preventDefault()` and `stopPropagation()`. The trigger is a
  `<button>` nested inside a `<label>`: `preventDefault()` stops the label's native
  "focus the labelled control" behaviour, and `stopPropagation()` stops click handlers bound on
  `mlv-label` itself — `mlv-select` binds one there to open its dropdown — from firing when the
  user only wanted to read the hint.

#### Styling

`hint.css` is a plain global stylesheet (`ViewEncapsulation.None`), so it selects the BEM block
class `.mlv-hint` bound from `host`, not `:host` (which never matches outside a shadow tree).
`mlv-label` styles `.mlv-label__hint` as `display: inline-flex; align-self: center` so the icon
sits on the row's centre line instead of the text baseline the label row is built on.

---

### `MlvDescription`

**File:** `libs/core/form-utils/src/lib/description/description.ts`
**Selector:** `mlv-description`

Persistent help text rendered **below** the control, in front of `mlv-message`, through the
wrapper's `mlv-description` projection slot. Stays visible while a validation message shows.
Controls extending the signal base render it from their `description` input and point
`aria-describedby` at it via `_describedBy()`.

---

### `MlvMessage`

**File:** `libs/forms/form-utils/src/lib/message/message.ts`
**Selector:** `mlv-message`

#### Inputs

| Name    | Type           | Default     |
| ------- | -------------- | ----------- |
| `state` | `MlvFormState` | `'default'` |

Animated enter/leave (fade + slide). Sets `aria-live` / `role` based on state.

---

### `MlvFormControlWrapper`

**File:** `libs/core/form-utils/src/lib/form-control-wrapper/form-control-wrapper.ts`
**Selector:** `mlv-form-control-wrapper`

Visual shell for form controls. Projects label, control, prefix/suffix, and message via directive slots.

#### Inputs

**None.** The wrapper takes no inputs — every state modifier is read from the
optional `MLV_FORM_CONTROL` connector injected from the host control
(`focused()`, `disabled()`, `readonly()`, `loading()`, `pill?.()`, and
`resolvedState?.() ?? state()`). A wrapper used outside a control renders in the
default state.

#### Outputs

| Name    | Type           | Description                                                 |
| ------- | -------------- | ----------------------------------------------------------- |
| `clear` | `output<void>` | Emitted when the user activates the wrapper's clear button. |

#### Host Bindings

```ts
host: {
  'class': 'mlv-form-control-wrapper',
  '[class]': '_stateClass()',
  '[class.mlv-form-control-wrapper--focused]': 'formControl?.focused()',
  '[class.mlv-form-control-wrapper--disabled]': 'formControl?.disabled()',
  '[class.mlv-form-control-wrapper--readonly]': 'formControl?.readonly()',
  '[class.mlv-form-control-wrapper--loading]': 'formControl?.loading()',
  '[class.mlv-form-control-wrapper--pill]': 'formControl?.pill?.() ?? false',
}
```

> **One validation ring (SF-R6).** Only `state="error"` colours the container
> border (`--container-border-color: var(--mlv-border-error)`). `success`,
> `info` and `warning` deliberately paint no ring — their meaning lives
> entirely in the adjacent `mlv-message` text, so a form with mixed states
> reads as one alarm rather than four coloured perimeters. `disabled` and
> `readonly` stay fully achromatic, differentiated by fill and text colour
> only. The default-state hover border also moved off the raw palette stop
> (`neutral-300`) onto `--mlv-border-strong`, which is the same pixel in
> light but fixes a dark-mode bug where a hovered field drew a near-white
> border. The focused-state ring width is `var(--mlv-stroke-width)` (not a
> literal `1px`).

#### Control-text type & padding ramp (2026-08-26)

`.mlv-form-control-wrapper` declares the **one** density-scaled type/padding
ramp every text-style control obeys — `--form-ctrl-font-size` (block) /
`--form-ctrl-h-padding` (inline, combined into `--mlv-control-padding` with
the constant `--mlv-spacing-1` block half):

| density     | `--form-ctrl-font-size`   | `--form-ctrl-h-padding` |
| ----------- | ------------------------- | ----------------------- |
| tight       | `--mlv-font-size-s` (12)  | `--mlv-spacing-2`       |
| compact     | `--mlv-font-size-m` (14)  | `--mlv-spacing-2-5`     |
| comfortable | `--mlv-font-size-m` (14)  | `--mlv-spacing-3`       |
| spacious    | `--mlv-font-size-l` (16)  | `--mlv-spacing-4`       |
| airy        | `--mlv-font-size-xl` (18) | `--mlv-spacing-5`       |

Matches CH-R3 in `docs/superpowers/specs/2026-08-24-visual-language-spec.md`.
Both custom properties are declared once here and **inherited** by every
descendant of the wrapper — `mlv-input`, `mlv-textarea`, `mlv-number-input`,
the `mlv-select` / `mlv-combobox` / `mlv-day-picker` / `mlv-time-picker`
trigger text, and (via projection) `mlv-label`, `mlv-description` and
`mlv-message` all render inside the wrapper's DOM. A control's own SCSS must
read `var(--form-ctrl-font-size, var(--mlv-font-size-m))` /
`var(--mlv-control-padding)` rather than a literal or a different token —
see `mlv-input__native` and `mlv-number-input__native` for the reference
pattern.

`mlv-label` is the one exception: it is a **sibling** of the wrapper (both
are projected children of the owning control), not a descendant, so it
cannot inherit `--form-ctrl-font-size` through the DOM. `label.scss` instead
carries its own copy of the same five values via the `density.*` mixins, so
a label still reads at the size of the field it names at every density.

**2026-08-26 fix.** Before this pass, `mlv-input__native` declared a flat,
non-ramped `padding: var(--mlv-spacing-1)` on top of the wrapper's own
(already ramped) container padding — a doubled, non-scaling inline padding
found on no other control. It now follows the same pattern as
`mlv-select`/`mlv-combobox`/`mlv-time-picker`/`mlv-number-input`: the
wrapper's `__control-container` padding is zeroed and `mlv-input__native`
owns the full `var(--mlv-control-padding)` itself. Several controls also
carried a hardcoded `--mlv-font-size-l` instead of the ramp (`mlv-input`,
`mlv-number-input`, `mlv-tokenizer`'s overflow badge, `mlv-combobox`'s empty
row) or diverged from the ramp's exact steps (`mlv-switch`'s `compact` /
`airy` label size). `mlv-checkbox` and `mlv-radio` had no label type ramp at
all. All are now on the shared ramp; see
`docs/superpowers/specs/2026-08-24-visual-language-spec.md` CH-R3 and the
form-density-standardization report
(`.superpowers/sdd/form-density-standardization-report.md`) for the full
before/after inventory. `mlv-pin-input`'s cell text and `mlv-rating` (no
visible text) are documented exceptions and stay off the ramp.

**Superseded (2026-08-26, round 2 of the same day).** The "zero the
container, `mlv-input__native` owns the full padding" fix above turned out to
be correct only for controls whose entire row lives inside one element they
own outright (`mlv-select`/`mlv-combobox`/`mlv-time-picker`/`mlv-number-input`).
`mlv-input`'s prefix/suffix (`*mlvFormControlPrepend`/`*mlvFormControlAppend`)
are separate siblings rendered by the wrapper's own generic slots — zeroing
the container stripped their only inset while the native input's now-full
padding pushed text in from the other side, breaking every prefix/suffix
consumer (`mlv-search-field`, currency-style `mlv-input` prefix/suffix
examples). `mlv-input__native` now declares **no** padding of its own in
either mode; the row's one shared inset comes from whichever ancestor already
supplies it — the wrapper's own un-zeroed default for `mlv-input`'s default
mode, or the embedding composite's own trigger row in `bare` mode. See the
report's Round 3 §1 for the full before/after.

**Affordance-glyph size ramp (2026-08-26, round 3).** A second shared token,
`--form-ctrl-icon-size: calc(var(--form-ctrl-height) * var(--mlv-icon-in-container-ratio))`,
declared alongside the type/padding ramp above — reuses CH-R4's
`--mlv-icon-in-container-ratio` (0.45) anchored to the field's own height.
Every form-control affordance glyph (leading/trailing icons, chevrons, the
generic clear button) now reads this instead of a fixed `1.25rem`, a
row-text-relative `em`, or a button-local ratio pinned to a fixed density.
Resolves to 12.6 / 16.2 / 19.8 / 23.4 / 27px across tight → airy. See the
report's Round 3 §3–4 for the full consumer table, the two "direct
declaration beats inherited value" gotchas it surfaced, and the matching
`--mlv-text-tertiary` → `--mlv-text-primary` colour ramp (mirroring
`.mlv-select__arrow`).

---

## Directives

| Directive                          | Selector                                | Purpose                            |
| ---------------------------------- | --------------------------------------- | ---------------------------------- |
| `MlvFormControlWrapperControl`     | `[mlvFormControlWrapperControl]`        | Marks template as the main control |
| `FormControlWrapperControlPrepend` | `[mlvFormControlWrapperControlPrepend]` | Left-side prefix content           |
| `FormControlWrapperControlAppend`  | `[mlvFormControlWrapperControlAppend]`  | Right-side suffix content          |

---

## Abstract Base Class: `FormControlBase<T>`

**File:** `libs/forms/form-utils/src/lib/form-control-base/form-control-base.ts`

Implements `ControlValueAccessor`. Extend to create custom form controls.

#### Inputs

`state`, `readonly`, `disabled` (coerced), `id` (auto-generated), `label`, `hint`, `message`

#### Protected Members

- `onChange: (v: unknown) => void`
- `onTouched: () => void`
- `internalDisabled: signal(boolean)`
- `focused: signal(boolean)`

#### CVA Methods

`writeValue`, `registerOnChange`, `registerOnTouched`, `setDisabledState`

---

## Services

### `MlvSelectionService<T>`

**File:** `libs/forms/form-utils/src/lib/selection.service.ts` | **Provided:** component-level (inject per component)

#### Signals

| Signal           | Type               | Description            |
| ---------------- | ------------------ | ---------------------- |
| `multiple`       | `signal(boolean)`  | Single vs multi-select |
| `selectedValues` | `signal<T[]>([])`  | Current selections     |
| `displayValue`   | `computed<string>` | Human-readable label   |

#### Methods

| Method                          | Description                                |
| ------------------------------- | ------------------------------------------ |
| `select(value: T)`              | Add to selection (replaces in single mode) |
| `deselect(value: T)`            | Remove from selection                      |
| `isSelected(value: T): boolean` | Check if selected                          |
| `clear()`                       | Clear all                                  |
| `setValues(values: T[])`        | Replace all                                |
| `toggle(value: T)`              | Add or remove                              |
| `requestFocusFirst()`           | Emit to focus first list item              |

---

## Usage Examples

```html
<!-- Form field with auto error display -->
<mlv-form-field displayStrategy="touched">
  <mlv-label for="email">
    Email
    <!-- renders as a question-mark icon; the text shows in a tooltip -->
    <mlv-hint>We'll contact you here</mlv-hint>
  </mlv-label>
  <input id="email" type="email" [formControl]="emailCtrl" />
</mlv-form-field>

<!-- Control wrapper with prefix/suffix -->
<mlv-form-control-wrapper [focused]="isFocused()" state="default">
  <ng-template mlvFormControlWrapperControlPrepend>$</ng-template>
  <ng-template mlvFormControlWrapperControl>
    <input type="number" />
  </ng-template>
  <ng-template mlvFormControlWrapperControlAppend>USD</ng-template>
</mlv-form-control-wrapper>
```

---

## Dependencies

- `@angular/core`, `@angular/forms` — CVA, reactive forms
- `@angular/cdk/coercion` — boolean coercion
- `@lucide/angular` — `LucideCircleQuestionMark` for the `mlv-hint` trigger
- `@malva-ui/core/tooltip` — `MlvTooltip`, which reveals the `mlv-hint` text
- `@malva-ui/core/button` — `MlvClearMlvButton` chrome

## Clearable value-gating (2026-07)

- `MlvFormControl` connector: new required `hasValue: Signal<boolean>` + optional `ownsClearButton?: Signal<boolean>`.
- `FormControlBase` declares `hasValue` **abstract** — every control derives it from its own store (text length, selection count, nullable value, token/file count; always-valued controls like slider/color-picker/time-picker return `true`).
- Wrapper clear condition: `clearable() && hasValue() && !ownsClearButton?.()` — no dangling X on empty controls; controls flagging `ownsClearButton` (select, combobox) render `mlv-clear-button` inline before their chevron instead.
- `MlvClearMlvButton` (`mlv-clear-button`): compact transparent circular X, i18n `clear` aria-label, `(clear)` output.

## Pill controls (2026-08)

- `MlvSignalFormUiControlBase` gained the shared `pill` input (`BooleanInput`) —
  the **single place** that makes every wrapped control (input, select,
  textarea, day-picker, tokenizer, search-field, …) fully rounded.
- `MlvFormControl` connector: optional `pill?: Signal<boolean>`; the wrapper
  binds `mlv-form-control-wrapper--pill`, which sets the container
  `border-radius: var(--mlv-radius-full)` directly (wins at every density) and
  widens inline padding (`* 1.35`) so content clears the round caps.
- Mirrors `shape="pill"` on `mlvButton` and `shape="pill"` on `[mlvActionBar]`.

## Testing entry: `@malva-ui/core/form-utils/testing`

- `MlvFormsBindingAdapter<T>` / `MlvFormsBindingMatrixOptions<T>` / `verifyFormsBinding()` — shared assertion driver for the forms bindings matrix (reactive `[formControl]`, template-driven `ngModel`, signal forms `[formField]`): form-side write round-trip, user-interaction propagation, blur→touched, disabled propagation. Every control migrated per docs/plans/signal-forms-migration.md runs it once per mode (reference: `input-binding-matrix.spec.ts` in core-input — all 3 modes green on 22.0.7, incl. `[formField]` binding the CVA directly).
- `UiFormControl` / `UI_FORM_CONTROL` deleted (dead — nothing consumed them; form-field uses `contentChild(NgControl)`).

## Signal forms Phase 1 (2026-07)

- `MlvSignalFormUiControlBase` / `MlvSignalFormControlBase<T>` / `MlvSignalCheckboxControlBase` — the `FormValueControl` / `FormCheckboxControl` era counterparts of `FormControlBase`. Base owns the Malva field surface + connector, signal-forms field bindings (`errors`/`disabled`/`readonly`/`touched`/`dirty` inputs bound automatically by `[formField]`; field-bound booleans use `WriteT = unknown` transforms to satisfy the contract) and the `touch` output (replaces `onTouched`). Subclass supplies `value = model<T>(...)` (or `checked`) + `hasValue`. No CVA members — dual implementation is prohibited by the contract, controls swap bases atomically.
- Signal controls expose `resolvedState()`: the explicit `[state]` input wins when non-default; otherwise a non-empty bound `errors` collection becomes `error` after `touched` is true. `MlvFormControlWrapper` prefers this optional connector signal (falling back to legacy `state()`), and migrated hosts/messages/`aria-invalid` consume it so signal-form validation needs no consumer-authored state plumbing.
- **RISK GATE PASSED** (`signal-form-control-base.spec.ts`): a pure `FormValueControl` on the new base binds green under `[formControl]`, `ngModel`, AND `[formField]` on 22.0.7 — Phase 2 cutover unblocked.

## Field surface additions (2026-08)

- `MlvSignalFormUiControlBase` gained three shared inputs, so every control extending it inherits them:
  - `required` (`InputSignalWithTransform<boolean, unknown>`, `coerceBooleanProperty`) — also a
    signal-forms field binding, so a `required()` schema rule drives it automatically. Controls forward
    it to `<mlv-label [required]>` and set `aria-required` on their focus target.
  - `description` (`string`, `''`) — persistent help text rendered below the control as
    `<mlv-description>`, in front of the validation `message`. Both stay visible together.
  - `ariaLabel` (`string | null`, `null`) — accessible name for the focus target when no visible label
    exists. Previously duplicated per control (`mlv-input`, `mlv-select`, `mlv-checkbox`, …); those
    duplicates were removed so `[ariaLabel]` now works on every base-extending control.
- Protected helpers on the base: `_descriptionId()` / `_messageId()` (`<id>-description` / `<id>-message`)
  and `_describedBy()` — the space-separated `aria-describedby` value, `null` when neither element is
  rendered so no dangling IDREF is emitted. Controls render `<mlv-description [id]="_descriptionId()">`
  and `<mlv-message [id]="_messageId()">` to match.
- `MlvFormControlWrapper` gained two below-control projection slots next to `mlv-message`:
  `mlv-description` and `[mlvFormControlWrapperAside]` (control-owned auxiliary readout, e.g. the
  `mlv-textarea` character counter, which previously matched no slot and never reached the DOM).
- `MlvFormField.autoErrorMessage` no longer falls back to the literal `Validation error: <key>`; unknown
  validator keys resolve to the translated `formUtils.invalidValue` and a dev-mode `console.warn` names
  the key once per application run.

- `MlvFormField` dual source: `contentChild(FormField)` (signal path — reads `FieldState.errors()/touched()/dirty()` reactively, prefers rule-supplied `message`, maps `kind.toLowerCase()` onto the legacy error keys) with the `NgControl`+events path kept for reactive/template-driven. The legacy effect early-returns for `[formField]` children (the signals interop exposes a shim NgControl without `.events`). `submit` strategy proxies to touched under the signal path.
