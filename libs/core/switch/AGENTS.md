---
# Library: switch

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Switch library (`@malva-ui/core/switch`) provides accessible toggle switch components implementing the WAI-ARIA switch pattern. Supports grouped switches with keyboard navigation and reactive forms integration via `ControlValueAccessor`.

## Public API

Exported from `libs/forms/switch/src/index.ts`:

| Export | Kind | Description |
|--------|------|-------------|
| `MlvSwitch` | Component | Toggle switch — `mlv-switch` |
| `MlvSwitchState` | Type | `'default' \| 'success' \| 'info' \| 'warning' \| 'error'` |
| `MlvSwitchGroup` | Component | Group container — `mlv-switch-group` |
| `MlvSwitchGroupState` | Type | Same values as `MlvSwitchState` |

---

## Components

### `MlvSwitch`

**File:** `libs/forms/switch/src/lib/switch/switch.ts`
**Template:** `libs/forms/switch/src/lib/switch/switch.html`
**Styles:** `libs/forms/switch/src/lib/switch/switch.scss`

- **Selector:** `mlv-switch`
- **Change Detection:** `OnPush`
- **Encapsulation:** `None`
- **Implements:** `ControlValueAccessor`, `FocusableOption`

#### Model (two-way binding)

| Name      | Type      | Default |
| --------- | --------- | ------- |
| `checked` | `boolean` | `false` |

#### Inputs

| Name       | Type             | Default     | Description                    |
| ---------- | ---------------- | ----------- | ------------------------------ |
| `disabled` | `boolean`        | `false`     | Component-level disabled       |
| `state`    | `MlvSwitchState` | `'default'` | Semantic state for track color |

#### Host Bindings

```ts
host: {
  'class': 'mlv-switch',
  '[class.mlv-switch--disabled]': 'disabled',
  '[class.mlv-switch--checked]': 'checked()',
  '[attr.tabindex]': 'tabIndex',
  '(focus)': 'onFocus()',
}
```

`tabIndex` is managed by `MlvSwitchGroup` (0 for active, -1 for others).

#### Key Methods

- `focus()` — CDK `FocusableOption`
- `toggle()` — Flip checked state (no-op if disabled)
- `onFocus()` — Notify parent group via `SWITCH_GROUP` token
- `writeValue(v: boolean)` / `setDisabledState(v)` — CVA implementation

#### Template Summary

`<label>` wrapping:

- Hidden `<input type="checkbox" role="switch" [attr.aria-checked]>`
- `.mlv-switch__track.mlv-switch__track--{state}` (visual track + thumb)
- `.mlv-switch__text` via `<ng-content>`

#### Styles

- Track: `40px × 24px`, `border-radius: 12px`
- Thumb: `20px × 20px`, animates `translateX(16px)` when checked
- Transition: `0.2s ease-in-out`
- Uses `--mlv-border-normal`, `--mlv-background-accent-1`, `--mlv-background-base`

---

### `MlvSwitchGroup`

**File:** `libs/forms/switch/src/lib/switch-group/switch-group.ts`

- **Selector:** `mlv-switch-group`
- **Change Detection:** `OnPush`
- **Encapsulation:** `None`
- **Implements:** `AfterContentInit`, `MlvSwitchGroupAccessor`

#### Inputs

| Name    | Type                  | Default     |
| ------- | --------------------- | ----------- |
| `label` | `string`              | `''`        |
| `state` | `MlvSwitchGroupState` | `'default'` |

#### Keyboard Navigation

`FocusKeyManager` — arrow up/down navigates between switches. First switch is `tabIndex=0`, rest are `-1`.

#### Template Summary

`div[role="group"][aria-label]` + optional `mlv-label` + `<ng-content>` + `(keydown)` handler.

---

## Internal Token

```ts
export const SWITCH_GROUP = new InjectionToken<MlvSwitchGroupAccessor>('SWITCH_GROUP');

interface MlvSwitchGroupAccessor {
  onChildFocus(sw: MlvSwitch): void;
}
```

---

## Usage Examples

```html
<!-- Standalone -->
<mlv-switch [(checked)]="darkMode">Dark Mode</mlv-switch>

<!-- State-based styling -->
<mlv-switch [(checked)]="isOnline" [state]="isOnline() ? 'success' : 'error'">Status</mlv-switch>

<!-- Group with keyboard navigation -->
<mlv-switch-group label="Permissions">
  <mlv-switch [(checked)]="canRead">Read</mlv-switch>
  <mlv-switch [(checked)]="canWrite">Write</mlv-switch>
  <mlv-switch [(checked)]="canDelete">Delete</mlv-switch>
</mlv-switch-group>

<!-- Reactive forms -->
<mlv-switch formControlName="enableNotifications">Notifications</mlv-switch>

<!-- Disabled -->
<mlv-switch [disabled]="true">Locked</mlv-switch>
```

---

## Dependencies

- `@angular/forms` — CVA
- `@angular/cdk/a11y` — `FocusKeyManager`, `FocusableOption`
- `@malva-ui/cdk/accessibility` — `MlvClick`
- `@malva-ui/core/form-utils` — `MlvLabel`
- `@malva-ui/styles` — design tokens, `_mixins.scss`
