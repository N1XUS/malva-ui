---
# Library: radio

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Radio library (`@malva-ui/core/radio`) provides accessible radio button components following WAI-ARIA patterns. Includes individual radio buttons and a group component that manages selection state, keyboard navigation (arrow keys), and reactive forms integration.

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
- **Implements:** `FocusableOption`

#### Inputs

| Name       | Type      | Default     |
| ---------- | --------- | ----------- |
| `value`    | `unknown` | `undefined` |
| `disabled` | `boolean` | `false`     |

#### Internal Signals

- `checked: signal(false)` — managed by parent group
- `name: signal('')` — set by parent group

#### Host Bindings

```ts
host: {
  'class': 'mlv-radio',
  '[class.mlv-radio--checked]': 'checked()',
  '[class.mlv-radio--disabled]': 'disabled()',
  '[attr.tabindex]': 'tabIndex',
  '(focus)': 'onFocus()',
}
```

#### Key Methods

- `focus()` — CDK `FocusableOption` interface
- `onFocus()` — Notifies parent group
- `onSelect()` — Calls `group.selectRadio(this)` if not disabled

#### Template Summary

Hidden native `<input type="radio">` with `aria-checked` + visual circle indicator (`.mlv-radio__visual::before` for inner dot with CSS transition) + `<ng-content>` for label.

---

### `MlvRadioGroup`

**File:** `libs/forms/radio/src/lib/radio-group/radio-group.ts`

- **Selector:** `mlv-radio-group`
- **Change Detection:** `OnPush`
- **Extends:** `MlvSignalFormControlBase<unknown>`
- **Implements:** `MlvRadioGroupAccessor`
- **Provides:** `RADIO_GROUP`, `MLV_FORM_CONTROL` tokens

#### Model (two-way binding)

| Name    | Type      |
| ------- | --------- |
| `value` | `unknown` |

#### Inputs

| Name       | Type                 | Default        | Description                  |
| ---------- | -------------------- | -------------- | ---------------------------- |
| `name`     | `string`             | auto-generated | Group name for native radios |
| `disabled` | `boolean`            | `false`        | Disable all radios           |
| `state`    | `MlvRadioGroupState` | `'default'`    | Theme state                  |
| `label`    | `string`             | `''`           | Group label                  |

#### Keyboard Navigation

`FocusKeyManager` (vertical, wrapping) — Arrow Up/Down moves focus and auto-selects the focused radio.

#### Tab Management

Exactly one radio has `tabIndex=0`: the checked radio while it is enabled, otherwise the first enabled radio (none while every radio is disabled). All others are `-1`. See `libs-radio.md` § _Tab Management_ (#307).

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

- `@angular/forms/signals` — signal-control contract
- `@angular/cdk/a11y` — `FocusKeyManager`, `FocusableOption`
- `@malva-ui/core/form-utils` — `MlvLabel`
