---
# Library: input

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Input library (`@malva-ui/core/input`) provides a fully accessible, state-aware text input component that integrates with Angular signal, reactive, and template-driven forms. Supports multiple input types, validation states, and optional prefix/suffix content.

## Public API

Exported from `libs/forms/input/src/index.ts`:

| Export | Kind | Description |
|--------|------|-------------|
| `MlvInput` | Component | Text input form control — `mlv-input` |
| `MlvInputType` | Type | `'text' \| 'password' \| 'email' \| 'number' \| 'tel' \| 'search' \| 'url'` |
| `MlvInputState` | Type | `'default' \| 'success' \| 'info' \| 'warning' \| 'error'` (alias of `MlvFormState`) |
| `MlvInputInputMode` | Type | `'none' \| 'text' \| 'decimal' \| 'numeric' \| 'tel' \| 'search' \| 'email' \| 'url'` |
| `InputPrefixDirective` | Directive | Left-side slot — `[mlvInputPrefix]` |
| `InputSuffixDirective` | Directive | Right-side slot — `[mlvInputSuffix]` |
| `MlvInputNative` | Directive | Marks a consumer-projected native `<input>` for adoption — `input[mlvInputNative]` |

---

## Components

### `MlvInput`

**File:** `libs/forms/input/src/lib/input/input.ts`
**Template:** `libs/forms/input/src/lib/input/input.html`
**Styles:** `libs/forms/input/src/lib/input/input.css`

- **Selector:** `mlv-input`
- **Change Detection:** `OnPush`
- **Extends:** `MlvSignalFormControlBase<string>` (signal-forms `FormValueControl` — migrated 2026-07-22, slice 1 of docs/plans/signal-forms-migration.md)

#### Inputs (own)

| Name               | Type                        | Default  | Description                                                                                                                                                                            |
| ------------------ | --------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`             | `MlvInputType`              | `'text'` | Native input type                                                                                                                                                                      |
| `placeholder`      | `string`                    | `''`     | Placeholder text                                                                                                                                                                       |
| `autocomplete`     | `string`                    | `''`     | Native `autocomplete` hint forwarded to the underlying `<input>`. Empty string suppresses the attribute                                                                                |
| `inputMode`        | `MlvInputInputMode \| null` | `null`   | Native `inputmode` attribute forwarded to the underlying `<input>`; controls the virtual keyboard on mobile                                                                            |
| `ariaLabel`        | `string \| null`            | `null`   | Rendered as `aria-label` on the underlying `<input>`; use when no visible `<mlv-label>` is present                                                                                     |
| `ariaAutocomplete` | `string \| null`            | `null`   | Forwarded to `aria-autocomplete` (typically `'list'`); use with `role="combobox"` (e.g. `mlv-combobox`)                                                                                |
| `projectControl`   | `boolean`                   | `false`  | Opt-in: adopt a consumer-projected `<input mlvInputNative>` as the control element instead of rendering the internal `<input>`. See "Native-input projection (aria forwarding)" below. |

> The `min`, `max`, `step`, `maxLength`, `minLength`, `pattern`, `name`, `autocomplete`, `autofocus`, `role`, `ariaExpanded`, `ariaHasPopup`, `ariaControls`, `ariaActiveDescendant`, `value`, and `bare` inputs are also forwarded to / control the underlying `<input>`; see `input.ts` for the full list.

#### Inputs (from MlvSignalFormControlBase)

`state`, `readonly`, `disabled`, `id` (auto-generated), `label`, `hint`, `message`

#### Computed

- `messageId: computed()` — `id()` + `'-message'` for `aria-describedby`

#### Host Bindings

```ts
host: {
  'class': 'mlv-input',
  '[class]': '"mlv-input--" + state()',
  '[class.mlv-input--disabled]': 'disabled()',
  '[class.mlv-input--focused]': 'focused()',
}
```

#### Outputs

| Name         | Type                 | Description                                                                                                                                                                                                                        |
| ------------ | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inputFocus` | `output<FocusEvent>` | Re-emitted from the native input's `focus` handler. The native `focus` event does not bubble to the `mlv-input` host, so composite controls (e.g. `mlv-combobox`) subscribe to this instead of binding `(focus)` on `<mlv-input>`. |
| `inputBlur`  | `output<FocusEvent>` | Re-emitted from the native input's `blur` handler (after `onTouched()`), so composite controls can run blur-driven logic (close dropdowns, revert text).                                                                           |

#### Key Methods

- `onInput(event: Event)` — Updates value signal + notifies form control
- `onFocus(event: FocusEvent)` — Sets focused state + emits `inputFocus`
- `onBlur(event: FocusEvent)` — Clears focus flag, emits the signal-form `touch` output, and emits `inputBlur`
- `focus()` — Imperatively focuses the underlying native `<input>`
- `select()` — Imperatively selects the current text inside the native `<input>`
- `setFocused(focused)` — Inherited from the signal base; updates the focus signal driving the wrapper state.

`computedDisabled` is a computed **property**, not a method — the effective
component/form disabled state.

#### Template Summary

`MlvFormControlWrapper` → optional `MlvLabel` with hint → optional `InputPrefixDirective` slot → native `<input>` with full ARIA attributes (`aria-invalid`, `aria-describedby`) → optional `InputSuffixDirective` slot → `MlvMessage`

---

## Directives

### `InputPrefixDirective`

**File:** `libs/forms/input/src/lib/input-sides.directive.ts` | **Selector:** `[mlvInputPrefix]`

Provides `templateRef` for left-side content (icons, currency symbols).

### `InputSuffixDirective`

**File:** `libs/forms/input/src/lib/input-sides.directive.ts` | **Selector:** `[mlvInputSuffix]`

Provides `templateRef` for right-side content (toggle buttons, units).

### `MlvInputNative`

**File:** `libs/core/input/src/lib/input/input-native.ts` | **Selector:** `input[mlvInputNative]` | **exportAs:** `mlvInputNative`

Marks a consumer-projected native `<input>` that `mlv-input` should adopt as its control element when `projectControl` is set. Applies the shared `mlv-input__native` styling hook and exposes `nativeElement` so the host `mlv-input`'s `focus()` / `select()` / `nativeElement` resolve to the projected input.

---

## Native-input projection (aria forwarding)

`@angular/aria`'s combobox trigger directive (`[ngCombobox]`, formerly `input[ngComboboxInput]`) must sit **directly on the interactive `<input>`**. Because Angular cannot attach an external directive to a component's internal template element, `mlv-input` exposes an opt-in projection slot:

- Set `projectControl` on `<mlv-input>` and project an `<input mlvInputNative …>` carrying whatever attribute directives you need.
- In this mode `mlv-input` does **not** render its own `<input>`; it provides the wrapper chrome, the `mlv-input__native` styling hook, and forwards `focus()` / `select()` / `nativeElement` to the projected input. The projected input owns its own value/keyboard wiring (e.g. aria's `[(value)]`/`[(expanded)]`), so CVA on the inner `mlv-input` is not used in this mode.

```html
<mlv-input bare projectControl>
  <input mlvInputNative ngCombobox [(value)]="query" [(expanded)]="open" />
</mlv-input>
```

This is the groundwork the `mlv-combobox` aria migration (Phase 2 Task 2.7) will consume. Covered by `input-native.spec.ts`.

---

## Usage Examples

```html
<!-- Basic -->
<mlv-input [formControl]="nameCtrl" label="Full Name" placeholder="Your name" />

<!-- Signal form with automatic touched-error state -->
<mlv-input [formField]="profileForm.email" type="email" label="Email" hint="We'll send updates here" />

<!-- Password with show/hide toggle -->
<mlv-input [formControl]="pwCtrl" [type]="show() ? 'text' : 'password'" label="Password">
  <ng-template mlvInputSuffix>
    <button type="button" (click)="show.update(v => !v)">{{ show() ? 'Hide' : 'Show' }}</button>
  </ng-template>
</mlv-input>

<!-- Currency input -->
<mlv-input [formControl]="amountCtrl" type="number" label="Amount">
  <ng-template mlvInputPrefix>$</ng-template>
  <ng-template mlvInputSuffix>USD</ng-template>
</mlv-input>
```

---

## Dependencies

- `@malva-ui/core/form-utils` — `MlvSignalFormControlBase`, `MlvFormControlWrapper`, all wrapper directives, `MlvLabel`, `MlvHint`, `MlvMessage`
- `@angular/forms/signals` — signal-form field binding (consumer side); reactive forms and `ngModel` remain compatible

## Signal-forms constraint alignment (2026-07)

- `maxLength`/`minLength`/`step` write-accept `undefined` (→ `null`); `min`/`max` write-accept `number|string|null|undefined` (contract binds `NonNullable<TValue>|undefined` = `string`); `name` write-accepts `undefined`; `pattern` write-accepts `string | RegExp | readonly RegExp[]` (normalised to a single OR-combined source for the native attribute). Reason: `[formField]` auto-binds same-named `FormUiControl` members; strict AOT failed on the old narrower types (caught only by `docs:build`).

## Signal-forms cutover (2026-07, slice 1)

- `value = model<string>('')` — the `FormValueControl` model; replaces the old one-way `value` input + `internalValue` signal + CVA plumbing (`writeValue`/`registerOn*`/`setDisabledState` gone; `NG_VALUE_ACCESSOR` provider removed). `clearValue()` stays (`value.set('')`).
- Blur reports `touch` output (base `_markTouched`) instead of CVA `onTouched`.
- Reactive `[formControl]` / `ngModel` / `[formField]` all bind the signal contract — locked by `input-binding-matrix.spec.ts` (3 modes green).
- Bound validation `errors` make `resolvedState()` return `error` after `touched`; an explicit non-default `[state]` still wins. The same resolved state drives the input host, internal `MlvFormControlWrapper`, and native `aria-invalid`.
- Composite one-way binders (`[value]="searchQuery()"` in combobox etc.) keep working — a model accepts one-way binding; template renders `value() ?? ''` defensively.

---

## Field surface (2026-08)

- `ariaLabel` moved to `MlvSignalFormUiControlBase`; `MlvInput` no longer declares it (same name, same `string | null` type, same `aria-label` binding).
- New `ariaDescribedBy` (`string | null`, `null`) — an explicit `aria-describedby` override for the native `<input>`, taking precedence over the ids derived from `description`/`message`. Composite controls that render their own chrome (`mlv-combobox`, `mlv-tokenizer`, `mlv-pin-input`) point the inner bare input at their own description/message ids through it.
- Inherited `required` renders the `mlv-label` marker and sets `aria-required` on the native `<input>`.
- Inherited `description` renders `<mlv-description>` below the control (wrapped mode only — `bare` renders no chrome).
- The non-reactive `messageId` string field is gone; `<mlv-message>` now carries the base's `_messageId()` so `aria-describedby` resolves even when a consumer sets `[id]`.

## Type & padding ramp fix (2026-08-26)

`.mlv-input__native` previously declared a flat, non-ramped
`padding: var(--mlv-spacing-1)` on top of the wrapper's own (already ramped)
container padding — a doubled inline padding no other control carried, and
one that grew disproportionately at `tight`. It now matches
`mlv-select`/`mlv-combobox`/`mlv-time-picker`/`mlv-number-input`: the
wrapper's `.mlv-form-control-wrapper__control-container` padding is zeroed
in `input.scss` and `.mlv-input__native` owns the full ramped
`var(--mlv-control-padding)` itself. Its font-size also moved off a
hardcoded `--mlv-font-size-l` onto `var(--form-ctrl-font-size, var(--mlv-font-size-m))`
— the same density-ramped chain `mlv-number-input`/`mlv-textarea` already
used. See `.claude/projects/libs-form-utils.md` → _Control-text type &
padding ramp_.

**Padding ownership in `bare` mode.** The fix above applies unconditionally
in `mlv-input`'s default (non-`bare`) mode, where it owns its own wrapper.
`bare` mode (`projectControl`'s sibling flag — "used by composite controls
that own their own surrounding container", per the `bare` input's own
doc comment) is different: `mlv-combobox`, `mlv-tokenizer`, and
`mlv-select`'s in-dropdown search field all project a bare `<mlv-input>`
inside a trigger/row that **already** applies the full ramped padding
itself. `bare()` is now reflected as a host class,
`[class.mlv-input--bare]`, and `input.scss` adds
`&--bare &__native { padding: 0; }` so the bare native element contributes
no inset of its own — one padded box per control, owned by whichever
element (the wrapper, or the composite's own trigger row) actually draws
the field's boundary. Font-size is unaffected by `bare` — it still reads
`var(--form-ctrl-font-size, var(--mlv-font-size-m))` regardless.

## Naming from a projected `<mlv-label>` (2026-09, #197)

`MlvInput` reports `_externalLabelStrategy()` **`'native'`**: `id()` lands on its
own native `<input>`, so an `<mlv-label>` projected beside it into
`mlv-form-field` names it with a plain `for` and clicking the label focuses the
field — no `for`/`id` pair to hand-write. The exception is `projectControl`,
where the native input is the consumer's own and carries whatever `id` they
gave it; the strategy is `'none'` then, so the field points at nothing rather
than at the wrong element.

Full contract, the `'native'` vs `'aria'` split and the dev-mode warning:
`.claude/projects/libs-form-utils.md` → _`MlvFormField` → Accessible name_.
