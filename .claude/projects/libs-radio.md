---
# Library: radio

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Radio library (`@malva-ui/core/radio`) provides accessible radio button components following WAI-ARIA patterns. Includes individual radio buttons and a group component that manages selection state, keyboard navigation (arrow keys), and reactive forms integration.

> **Host `aria-label` / `aria-labelledby` forwarding** — a consumer writing
> `<mlv-radio aria-label="Select row" />` (e.g. a radio with no projected text)
> would otherwise leave the attribute on the role-less host element, which ARIA
> prohibits (axe `aria-prohibited-attr`). `MlvRadio` captures a **static**
> host `aria-label`/`aria-labelledby` via `HostAttributeToken` in its constructor,
> imperatively removes it from the host (`Renderer2.removeAttribute`), and forwards
> it onto the inner `<input type="radio">` — the real accessible-name target —
> through the `[attr.aria-label]` / `[attr.aria-labelledby]` template bindings
> (`_ariaLabel` / `_ariaLabelledBy` signals). When no host ARIA attribute is
> supplied the signals stay `null`, so no empty `aria-label` is emitted on the
> input and any group-provided labelling mechanism is left untouched. For
> **dynamic** labels use the `ariaLabel` / `ariaLabelledBy` **inputs** (they win
> over a captured static attribute via the
> `_resolvedAriaLabel`/`_resolvedAriaLabelledBy` computeds) — never bind
> `[attr.aria-label]` on the host, which Angular writes straight onto the host
> element where it cannot be intercepted. Same pattern as `mlv-checkbox` and
> `mlv-switch`.

## Public API

Exported from `libs/forms/radio/src/index.ts`:

| Export | Kind | Description |
|--------|------|-------------|
| `MlvRadio` | Component | Radio button — `mlv-radio` |
| `MlvRadioGroup` | Component | Group container — `mlv-radio-group` |
| `MlvRadioGroupState` | Type | `'default' \| 'success' \| 'info' \| 'warning' \| 'error'` |

---

## Components

### `MlvRadio`

**File:** `libs/forms/radio/src/lib/radio/radio.ts`
**Styles:** `libs/forms/radio/src/lib/radio/radio.scss`

- **Selector:** `mlv-radio`
- **Change Detection:** `OnPush`
- **Focus management:** `MlvRadioGroup` adapts radio instances to `FocusKeyManager` and uses `disabled()` as the skip predicate, preserving `[disabled]` as a signal input.

#### Inputs

| Name             | Type                  | Default     |
| ---------------- | --------------------- | ----------- |
| `value`          | `unknown`             | `undefined` |
| `ariaLabel`      | `string \| undefined` | `undefined` |
| `ariaLabelledBy` | `string \| undefined` | `undefined` |
| `disabled`       | `boolean`             | `false`     |

#### Internal Signals

- `checked: signal(false)` — managed by parent group
- `name: signal('')` — set by parent group

#### Host Bindings

```ts
host: {
  'class': 'mlv-radio',
  '[class.mlv-radio--checked]': 'checked()',
  '[class.mlv-radio--disabled]': 'disabled()',
}
```

The host is **not** focusable. The single focus target is the visually-hidden
native `<input type="radio">` (kept in the a11y tree via the clip-path pattern,
which restores native radio grouping and Space selection). The host is
`position: relative` so that absolutely positioned input is contained by the
radio — otherwise, in a drawer or dialog body, it lands in the scrollbar host
outside the scroll viewport and a click on the label scrolls the
`overflow: hidden` body to it. Its `tabindex` is the
roving tabindex (`tabIndex` signal) managed by `MlvRadioGroup`.

#### Key Methods

- `focus()` — CDK `FocusableOption`; focuses the native input (not the host)

#### Internal methods (`@internal`, template-facing)

- `onFocus()` — Notifies parent group
- `onSelect()` — Native selection (click, Space, arrow keys); calls `group.selectRadio(this)` if not disabled

#### Keyboard & Focus

- **Single tab stop:** the native input carries the roving tabindex; the host is not tabbable.
- **Space** selects natively; **ArrowUp/ArrowLeft** and **ArrowDown/ArrowRight** move+select within the group (via `FocusKeyManager`, skipping disabled radios, wrapping).
- **`:focus-visible`** ring is promoted from the hidden input onto `.mlv-radio__visual` using `--mlv-border-focus`.

#### Template Summary

Visually-hidden (clip-path) native `<input #nativeInput type="radio" [attr.tabindex]="tabIndex()">` with `aria-checked` + visual circle indicator (`.mlv-radio__visual::before` for inner dot with CSS transition) + `<ng-content>` for label.

---

### `MlvRadioGroup`

**File:** `libs/forms/radio/src/lib/radio-group/radio-group.ts`

- **Selector:** `mlv-radio-group`
- **Change Detection:** `OnPush`
- **Extends:** `MlvSignalFormControlBase<unknown>` from `@malva-ui/core/form-utils`
- **Implements:** `FormValueControl<unknown>`, `MlvRadioGroupAccessor`
- **Provides:** `RADIO_GROUP`, `MLV_FORM_CONTROL` tokens

#### Model (two-way binding)

| Name    | Type      |
| ------- | --------- |
| `value` | `unknown` |

#### Inputs

| Name       | Type                                    | Default            | Description                                                                                                        |
| ---------- | --------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `name`     | `string`                                | auto-generated     | Group name for native radios                                                                                       |
| `disabled` | `boolean`                               | `false`            | _(inherited)_ Disable all radios; also settable via `FormControl.disable()` (merged into `computedDisabled()`)     |
| `readonly` | `boolean`                               | `false`            | _(inherited)_ Locks selection while keeping the group legible/focusable; reflected as `mlv-radio-group--readonly`  |
| `state`    | `MlvRadioGroupState` (`= MlvFormState`) | `'default'`        | _(inherited)_ Validation state; reflected as `mlv-radio-group--state-*` with an inline-start accent on the content |
| `label`    | `string`                                | `''`               | _(inherited)_ Group label (rendered via `mlv-label`)                                                               |
| `id`       | `string`                                | auto (`mlvNextId`) | _(inherited)_ Bound to the host `id` attribute                                                                     |

> `MlvRadioGroupState` remains exported as a public type alias for backwards compatibility; it is now defined as `MlvFormState` from `@malva-ui/core/form-utils`.

#### Keyboard Navigation

`FocusKeyManager` (vertical, wrapping) — Arrow Up/Down moves focus, skips disabled radios via `disabled()`, and auto-selects the focused radio.

#### Tab Management

Only the checked radio (or first radio if none checked) has `tabIndex=0`. All others are `-1`.

> **Does not use `MlvFocusableGroupBase`** (deliberate). That base is _focus-driven_ roving, whereas radio's tab stop is _selection-driven_ and its arrows couple selection, radio names, and the forms value in the same effect. Adopting the focus-only base would change behavior, so radio keeps its own manager.

#### Template Summary

`div[role="radiogroup"][aria-label]` + optional `mlv-label` + `<ng-content>` + `(keydown)` handler.

#### ARIA

- `role="radiogroup"` on container
- `[attr.aria-checked]` on native inputs
- Only active radio is tabbable (`tabIndex=0`)

---

## Internal Token

```ts
export const RADIO_GROUP = new InjectionToken<MlvRadioGroupAccessor>('RADIO_GROUP');

interface MlvRadioGroupAccessor {
  selectRadio(radio: MlvRadio): void;
  onChildFocus(radio: MlvRadio): void;
}
```

---

## Usage Examples

```html
<!-- Basic group -->
<mlv-radio-group [(value)]="selected">
  <mlv-radio [value]="'a'">Option A</mlv-radio>
  <mlv-radio [value]="'b'">Option B</mlv-radio>
</mlv-radio-group>

<!-- With label -->
<mlv-radio-group label="Choose size" [(value)]="size">
  <mlv-radio [value]="'s'">Small</mlv-radio>
  <mlv-radio [value]="'m'">Medium</mlv-radio>
  <mlv-radio [value]="'l'">Large</mlv-radio>
</mlv-radio-group>

<!-- Disabled radio -->
<mlv-radio-group [(value)]="val">
  <mlv-radio [value]="1">One</mlv-radio>
  <mlv-radio [value]="2" [disabled]="true">Two (disabled)</mlv-radio>
</mlv-radio-group>

<!-- Reactive forms -->
<mlv-radio-group formControlName="option">
  <mlv-radio [value]="'yes'">Yes</mlv-radio>
  <mlv-radio [value]="'no'">No</mlv-radio>
</mlv-radio-group>
```

---

## Dependencies

- `@angular/forms/signals` — `FormValueControl` contract
- `@angular/cdk/a11y` — `FocusKeyManager`, `FocusableOption`
- `@malva-ui/core/form-utils` — `MlvSignalFormControlBase`, `MLV_FORM_CONTROL`, `MlvFormState`, `MlvLabel`
- `@malva-ui/cdk/utils` — `mlvNextId` (group `name` default)

---

## Field surface (2026-08)

- `MlvRadioGroup` now renders `<mlv-description>` (from the inherited `description` input) and `<mlv-message>` (from the inherited `message` input) below the projected radios. **`message` was previously accepted but never rendered** — setting it now produces a visible status line.
- Inherited `required` renders the `mlv-label` marker and sets `aria-required` on the `role="radiogroup"` host.
- The host `aria-label` is now `ariaLabel() ?? label()`, and `aria-describedby` is the base's `_describedBy()`.

## Label type scale (2026-08-26)

`.mlv-radio` now carries the shared control-text ramp (CH-R3) via
`density.density-*` mixins, mirroring `mlv-checkbox` — `--mlv-font-size-s`
(tight) / `-m` (compact, comfortable) / `-l` (spacious) / `-xl` (airy). It
previously had no type ramp at all. `&__label`'s `gap` also moved from the
raw literal `0.25rem` to `var(--mlv-spacing-1)` (same value, tokenized). See
`.claude/projects/libs-form-utils.md` → _Control-text type & padding ramp_.
