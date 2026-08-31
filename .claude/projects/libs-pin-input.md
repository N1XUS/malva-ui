---
# Library: pin-input

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library.

## Overview

The `pin-input` library (`@malva-ui/core/pin-input`) provides `mlv-pin-input`: a row of single-character input cells that behave as one logical Signal Forms control. Intended for OTP codes, numeric PINs, and short verification sequences.

## Public API

Exported from `libs/core/pin-input/src/index.ts`:

| Export | Kind | Description |
|--------|------|-------------|
| `MlvPinInput` | Component | OTP / PIN entry — `mlv-pin-input` |
| `MlvPinInputSeparator` | Structural directive | Custom separator template — `*mlvPinInputSeparator` |

---

## Components

### `MlvPinInput`

**Selector:** `mlv-pin-input` | **Extends:** `MlvSignalFormControlBase<string>` | **Implements:** `FormValueControl<string>`, `MlvFormControl` | **Change Detection:** `OnPush`

Each cell is rendered as a nested `mlv-input` instance bound to plain positional signal state. The component exposes one `value = model<string>('')` to Angular forms; no nested `FormControl`s or CVA transport remain. Cell keyboard / paste / focus events are wired through to coordinate auto-advance, value distribution, and focus management.

#### Inputs (own)

| Name          | Type                               | Default  | Description                                                                                                                                                                                                                                       |
| ------------- | ---------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `length`      | `number`                           | `6`      | Number of cells rendered                                                                                                                                                                                                                          |
| `type`        | `'text' \| 'password' \| 'number'` | `'text'` | Input type applied to each cell                                                                                                                                                                                                                   |
| `placeholder` | `string`                           | `'·'`    | Placeholder character shown in empty cells                                                                                                                                                                                                        |
| `separator`   | `string`                           | `''`     | Separator placement: `''` disables, `'each'` inserts one between every pair of cells, comma-separated indices (e.g. `'1,3'`) insert a separator before each listed cell index, a single index (e.g. `'3'`) inserts one separator at that position |

#### Inputs (from `FormControlBase`)

`state`, `readonly`, `disabled`, `loading`, `clearable`, `id` (auto-generated), `label`, `hint`, `message`

Setting `label` renders a `<mlv-label>` whose `for` attribute points at the first cell's id. `hint` is rendered as a `<mlv-hint>` inside that label. `message` is rendered as a `<mlv-message>` below the cell row and picks up the current `state` for theming. `disabled` (via `computedDisabled()`) is propagated to every per-cell `FormControl`.

#### Outputs

| Name        | Type                       | Description                                           |
| ----------- | -------------------------- | ----------------------------------------------------- |
| `completed` | `OutputEmitterRef<string>` | Fires the full joined value when every cell is filled |

#### Host bindings

| Binding                           | Value                               |
| --------------------------------- | ----------------------------------- |
| `class`                           | `mlv-pin-input`                     |
| `[class]`                         | `"mlv-pin-input--state-" + state()` |
| `[class.mlv-pin-input--disabled]` | `computedDisabled()`                |
| `[class.mlv-pin-input--focused]`  | `focused()`                         |
| `[attr.role]`                     | `"group"`                           |
| `[attr.aria-label]`               | `label() \|\| "PIN entry"`          |
| `[attr.aria-disabled]`            | `computedDisabled() \|\| null`      |

#### Keyboard Interaction

| Key                     | Action                                                 |
| ----------------------- | ------------------------------------------------------ |
| Any printable character | Fill current cell, advance to next                     |
| `Backspace`             | Clear current cell; if already empty, move to previous |
| `Delete`                | Clear current cell without moving                      |
| `ArrowLeft`             | Move focus to previous cell                            |
| `ArrowRight`            | Move focus to next cell                                |
| `Home`                  | Move focus to first cell                               |
| `End`                   | Move focus to last cell                                |

#### Paste Behaviour

Pasting any string distributes characters across cells starting from the **first cell** (index 0), regardless of which cell has focus. Whitespace is stripped before distribution.

#### Separators

Separators render as a span with class `mlv-pin-input__separator` and `aria-hidden="true"` between cells. By default each slot contains a `LucideDot` icon. To provide a custom separator template:

```html
<mlv-pin-input [length]="6" separator="each">
  <ng-template mlvPinInputSeparator>
    <span class="dash">—</span>
  </ng-template>
</mlv-pin-input>
```

Separator position strings are interpreted as follows:

| Value          | Result for `length=6`                |
| -------------- | ------------------------------------ |
| `''` (default) | `[ ][ ][ ][ ][ ][ ]` — no separators |
| `'each'`       | `[ ]·[ ]·[ ]·[ ]·[ ]·[ ]`            |
| `'3'`          | `[ ][ ][ ]·[ ][ ][ ]`                |
| `'1,3'`        | `[ ]·[ ][ ]·[ ][ ][ ]`               |

Out-of-range values (≤0 or ≥`length`) are ignored. A single separator position means "a separator before the cell at that index".

#### Forms Integration

- `value: ModelSignal<string>` — splits external writes into positional cell state and emits the joined value after edits
- `touch` — emitted from cell blur via `_markTouched()`
- `disabled` — the field-bound signal is propagated directly to every nested `mlv-input`
- Binding-matrix coverage verifies `[formControl]`, `ngModel`, and `[formField]` value/touched/disabled round trips

---

## ARIA

Each cell is a `<mlv-input>` instance whose underlying native `<input>` receives:

```html
<input aria-label="Digit N of L" autocomplete="one-time-code" inputmode="numeric" [id]="<pinInputId>-cell-<index>" />
```

The host element carries `role="group"` and `aria-label` equal to the configured `label` (falling back to `"PIN entry"`). When a `label` input is set, the `<mlv-label>` renders with `for="<pinInputId>-cell-0"` so clicking the label focuses the first cell.

---

## Usage Examples

```html
<!-- Basic OTP -->
<mlv-pin-input [(ngModel)]="otp" />

<!-- Custom length -->
<mlv-pin-input [length]="4" [(ngModel)]="pin" />

<!-- Masked mode -->
<mlv-pin-input type="password" [length]="4" [(ngModel)]="pin" />

<!-- Reactive Forms -->
<mlv-pin-input [length]="6" [formControl]="otpCtrl" />

<!-- With label, hint, and error message -->
<mlv-pin-input [length]="6" [formControl]="otpCtrl" label="One-time code" hint="Sent to +1 ••• 1234" [state]="otpCtrl.invalid && otpCtrl.touched ? 'error' : 'default'" [message]="otpCtrl.invalid && otpCtrl.touched ? 'Code is invalid' : ''" />

<!-- completed event -->
<mlv-pin-input [length]="6" (completed)="onOtpComplete($event)" />

<!-- Separator every cell -->
<mlv-pin-input [length]="6" separator="each" [(ngModel)]="code" />

<!-- Grouped in halves -->
<mlv-pin-input [length]="6" separator="3" [(ngModel)]="code" />

<!-- Custom separator template -->
<mlv-pin-input [length]="6" separator="each">
  <ng-template mlvPinInputSeparator>
    <span class="dash">—</span>
  </ng-template>
</mlv-pin-input>
```

---

## Internationalization (i18n)

Strings resolve through `MLV_PIN_INPUT_I18N` (`@malva-ui/i18n`): `digit` — an ICU string (`"Digit {position} of {length}"`) resolved per cell via `MlvI18nResolverService` — and `pinEntry`, the group `aria-label` fallback when no `label` input is set. Provide `provideMlvI18nTesting()` in specs.

## Dependencies

- `@angular/core` `[@angular/core_VERSION_PLACEHOLDER]` — Signals, DI, `viewChildren`, `effect`, `ChangeDetectionStrategy`, `ViewEncapsulation`
- `@angular/forms/signals` `[@angular/forms_VERSION_PLACEHOLDER]` — custom-control contract supplied by the shared signal base
- `@malva-ui/core/form-utils` — `MlvSignalFormControlBase`, `MLV_FORM_CONTROL`, `MlvFormControl`, `MlvLabel`, `MlvHint`, `MlvMessage`
- `@malva-ui/core/input` — `MlvInput` rendered once per cell

---

## Field surface (2026-08)

- Inherited `required` renders the `mlv-label` marker and is forwarded to every cell, so each cell input carries `aria-required`.
- Inherited `description` renders `<mlv-description>` below the cells. Every cell receives `[ariaDescribedBy]="_describedBy()"` (the new `MlvInput` override input), so the description and message are announced from any cell.
- `<mlv-message>` now carries the base's `_messageId()`; previously it had no id and nothing referenced it.
