---
# Library: number-input

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library.

## Overview

The `number-input` library (`@malva-ui/core/number-input`) provides a themed numeric stepper input component (`mlv-number-input`) that extends `FormControlBase<number>` and integrates with Angular Reactive Forms via CVA.

## Public API

Exported from `libs/core/number-input/src/index.ts`:

| Export | Kind | Description |
|--------|------|-------------|
| `MlvNumberInput` | Component | Numeric stepper — `mlv-number-input` |

---

## Components

### `MlvNumberInput`

**Selector:** `mlv-number-input` | **Extends:** `FormControlBase<number>` | **Change Detection:** `OnPush`

#### Inputs (own)

| Name               | Type                         | Default        | Description                                                                   |
| ------------------ | ---------------------------- | -------------- | ----------------------------------------------------------------------------- |
| `min`              | `number \| null`             | `null`         | Minimum value                                                                 |
| `max`              | `number \| null`             | `null`         | Maximum value                                                                 |
| `step`             | `number`                     | `1`            | Step for arrow keys and buttons                                               |
| `largeStep`        | `number \| null`             | `null`         | Large step for Shift+Arrow; auto = 10 × step                                  |
| `placeholder`      | `string`                     | `''`           | Placeholder text                                                              |
| `precision`        | `number \| null`             | `null`         | Decimal precision; inferred from step when null                               |
| `scrollable`       | `BooleanInput`               | `true`         | Enable scroll-wheel stepping when focused                                     |
| `stack`            | `'horizontal' \| 'vertical'` | `'horizontal'` | Layout direction for the decrement/increment controls                         |
| `controlAlignment` | `'left' \| 'right'`          | `'right'`      | Side used for the vertical control stack; no visual effect in horizontal mode |

Inherited: `state`, `readonly`, `disabled`, `id`, `label`, `hint`, `message`, `loading`, `clearable`, `errors`, `touched`, `dirty`

#### Computed Signals

- `isAtMin` — true when value ≤ min
- `isAtMax` — true when value ≥ max
- `effectiveLargeStep` — largeStep ?? step × 10
- `effectivePrecision` — precision ?? inferred from step
- `resolvedState` — an explicit non-default `state`; otherwise `error` when a bound field has validation errors and is touched, or `default`

#### Keyboard Navigation

| Key               | Action      |
| ----------------- | ----------- |
| `ArrowUp`         | +step       |
| `ArrowDown`       | -step       |
| `Shift+ArrowUp`   | +largeStep  |
| `Shift+ArrowDown` | -largeStep  |
| `Home`            | jump to min |
| `End`             | jump to max |

#### Interaction Model

- **Long-press**: 400ms delay → 150ms interval → largeStep cadence after 1500ms
- **Readonly / disabled** (#298): every user write goes through `_write()` and is refused while `!_canWrite()` — steppers (`[disabled]="!_canWrite() || isAtMin()"`, so they are also disabled while readonly), a long press already running when readonly or disabled flips on (the interval clears itself on its next tick — no `pointerup` needed, since a stepper that turns `disabled` under the pointer may never get one; pinned with vitest fake timers), ArrowUp/Down, Shift+Arrow, Home/End, the wheel, and the typed-draft commit on blur/Enter (a draft typed before readonly flipped on is discarded and the display resets to the value). A refused key or wheel event is **not** `preventDefault()`ed, so caret keys and page scroll keep working. The form direction and the min/max clamp effect still write `value` directly. `clearValue()` is not gated yet (#301).
- **Scroll wheel**: when `scrollable()` && focused && `_canWrite()`; `preventDefault()` on every event it acts on (and on none that it does not). Bound in the constructor as `fromEvent(input, 'wheel', { passive: false })` rather than a `(wheel)` template binding (changed in #76) — a listener binding notifies the change-detection scheduler on every event of a hundreds-of-events gesture, most of which the handler early-returns from. `{ passive: false }` is mandatory and explicit, because a passive listener cannot `preventDefault()`. The subscription is released from its `effect`'s `onCleanup`, not `takeUntilDestroyed`: `#inputRef` lives inside an `ng-template`, so it resolves after the first render and would leak a generation per re-instantiation.
- **Text entry**: raw string held while typing, parsed/clamped on blur or Enter
- **Stepper layout**: horizontal controls render as square buttons on both sides of the input; vertical controls stack increment over decrement on the configured side

#### ARIA

- `role="spinbutton"` on native input
- `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- `aria-invalid="true"` when the resolved state is error
- Readonly: the native `readonly` attribute, which HTML-AAM maps to `aria-readonly` on the spinbutton. **No** explicit `aria-readonly` — ARIA in HTML says authors SHOULD NOT set it on an element that carries `readonly`.
- Buttons: `aria-label="Decrement"` / `"Increment"`, `tabindex="-1"`

#### Density

`MlvCompactComfortableDensity` as hostDirective; `MLV_DENSITY_ELEMENT = 'number-input'`

---

## Usage Examples

```html
<!-- Basic -->
<mlv-number-input label="Quantity" [min]="0" [max]="99" [(ngModel)]="qty" />

<!-- Decimal -->
<mlv-number-input label="Price" [step]="0.01" [precision]="2" [formControl]="priceCtrl" />

<!-- Large step -->
<mlv-number-input label="Timeout (ms)" [min]="0" [max]="30000" [step]="100" [largeStep]="1000" [(ngModel)]="t" />

<!-- Vertical controls on the left -->
<mlv-number-input label="Seats" stack="vertical" controlAlignment="left" [(ngModel)]="seats" />

<!-- Disabled -->
<mlv-number-input label="Count" disabled [ngModel]="42" />
```

---

## Internationalization (i18n)

The stepper button `aria-label`s resolve through `MLV_NUMBER_INPUT_I18N` (`@malva-ui/i18n`): `decrement` and `increment`. Provide `provideMlvI18nTesting()` in specs that instantiate the component.

## Dependencies

| Package                     | Role                                                     |
| --------------------------- | -------------------------------------------------------- |
| `@angular/core`             | Signals, DI, DestroyRef                                  |
| `@angular/forms`            | CVA, NG_VALUE_ACCESSOR                                   |
| `@angular/cdk/coercion`     | Boolean coercion                                         |
| `@malva-ui/core/form-utils` | FormControlBase, MlvFormControlWrapper, MLV_FORM_CONTROL |
| `@malva-ui/cdk/density`     | MlvCompactComfortableDensity, MLV_DENSITY_ELEMENT        |
| `@lucide/angular`           | LucideMinus, LucidePlus                                  |

## File Structure

```
libs/core/number-input/
  project.json
  ng-package.json
  tsconfig.json / tsconfig.lib.json / tsconfig.spec.json
  vite.config.mts
  src/
    index.ts
    test-setup.ts
    lib/number-input/
      number-input.ts
      number-input.html
      number-input.scss
      number-input.spec.ts
      number-input-binding-matrix.spec.ts
      number-input-readonly.spec.ts   # #298 write permission + axe sweeps
```

---

## Field surface (2026-08)

- `ariaLabel` (inherited from `MlvSignalFormUiControlBase`) is now forwarded to `[attr.aria-label]` on the `role="spinbutton"` input — previously the binding existed nowhere and was inert.
- Inherited `required` renders the `mlv-label` marker and sets `aria-required` on the spinbutton input.
- Inherited `description` renders `<mlv-description>` below the control; `aria-describedby` is the base's `_describedBy()` (description + message ids, `null` when neither renders).
- The public `messageId` computed is gone — `<mlv-message>` carries the base's `_messageId()`.

## Naming from a projected `<mlv-label>` (2026-09, #197)

`MlvNumberInput` reports `_externalLabelStrategy()` **`'native'`**: `id()` lands
on the native `<input>`, which is labelable, so an `<mlv-label>` projected beside
it into `mlv-form-field` names it with a plain `for`.

Full contract, the `'native'` vs `'aria'` split and the dev-mode warning:
`.claude/projects/libs-form-utils.md` → _`MlvFormField` → Accessible name_.
