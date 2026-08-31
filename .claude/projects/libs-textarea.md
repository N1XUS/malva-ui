---
# Library: textarea

> **Keep this file up to date.** Whenever this library's components, directives, services, or public API change, update this document.

## Overview

`@malva-ui/core/textarea` provides a multi-line text input form control (`mlv-textarea`). It extends `MlvSignalFormControlBase<string>` (from `@malva-ui/core/form-utils`) and is a signal-forms `FormValueControl<string>` — reactive (`[formControl]`/`formControlName`), template-driven (`ngModel`), and signal (`[formField]`) bindings all bind the `value` model directly (migrated 2026-07-22, slice 2 of docs/plans/signal-forms-migration.md). It supports optional auto-resize behaviour (textarea grows with content), a character counter with warning/error states, and a custom `mlv-scrollbar` overlay for a consistent cross-browser scrollbar appearance.

The component wraps the native `<textarea>` inside `mlv-form-control-wrapper`, giving it the same label/hint/message/clear infrastructure as `mlv-input`.

---

## Public API

| Export        | Kind      | Description                            |
| ------------- | --------- | -------------------------------------- |
| `MlvTextarea` | Component | Multi-line text input — `mlv-textarea` |

---

## Components

### `MlvTextarea`

**File:** `libs/core/textarea/src/lib/textarea/textarea.ts`
**Selector:** `mlv-textarea`
**Change Detection:** `OnPush`
**Encapsulation:** `ViewEncapsulation.None`
**Extends:** `MlvSignalFormControlBase<string>` (signal-forms `FormValueControl<string>`)
**Implements:** `MlvFormControl`

#### Providers

| Token              | Value         |
| ------------------ | ------------- |
| `MLV_FORM_CONTROL` | `MlvTextarea` |

> `NG_VALUE_ACCESSOR` is intentionally **not** provided — a signal-forms `FormValueControl` must not also implement `ControlValueAccessor`. Angular's reactive/ngModel compat binds the `value` model directly.

#### Host Bindings

| Binding                             | Value                                                 |
| ----------------------------------- | ----------------------------------------------------- |
| `class`                             | `'mlv-textarea'` (static)                             |
| `[class]`                           | State modifier classes derived from `resolvedState()` |
| `[class.mlv-textarea--disabled]`    | `computedDisabled()`                                  |
| `[class.mlv-textarea--focused]`     | `focused()`                                           |
| `[class.mlv-textarea--auto-resize]` | `autoResize()`                                        |

#### Inputs (own)

| Name          | Type                     | Default     | Description                                                                                |
| ------------- | ------------------------ | ----------- | ------------------------------------------------------------------------------------------ |
| `placeholder` | `string`                 | `''`        | Placeholder text shown when the textarea is empty.                                         |
| `rows`        | `number`                 | `3`         | Number of visible text rows; sets the default height.                                      |
| `minRows`     | `number \| undefined`    | `undefined` | Minimum row count when `autoResize` is active.                                             |
| `maxRows`     | `number \| undefined`    | `undefined` | Maximum row count when `autoResize` is active.                                             |
| `autoResize`  | `BooleanInput → boolean` | `false`     | When true, the textarea grows vertically to fit its content. Respects `minRows`/`maxRows`. |
| `maxLength`   | `number \| undefined`    | `undefined` | Maximum number of characters allowed. When set, a character counter is displayed.          |

#### Model

| Name    | Type                  | Default | Description                                                                                                                                                                                 |
| ------- | --------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value` | `ModelSignal<string>` | `''`    | The `FormValueControl` value model — replaces the former `internalValue` signal + CVA transport. Bound directly by `[formControl]`/`ngModel`/`[formField]`. Two-way bindable (`[(value)]`). |

#### Inputs (inherited from `MlvSignalFormControlBase<string>`)

| Name          | Type                         | Default                | Description                                                                                                                                                      |
| ------------- | ---------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `state`       | `MlvFormState`               | `'default'`            | Explicit visual state: `'default'` \| `'success'` \| `'info'` \| `'warning'` \| `'error'`. A non-default value takes precedence over automatic validation state. |
| `readonly`    | `boolean`                    | `false`                | Makes the textarea read-only. Also a signal-forms field binding (`[formField]` sets it).                                                                         |
| `disabled`    | `boolean`                    | `false`                | Disables the control. Signal-forms field binding — the bound field's disabled state drives it.                                                                   |
| `loading`     | `BooleanInput → boolean`     | `false`                | Shows a loading indicator (handled by form wrapper).                                                                                                             |
| `clearable`   | `BooleanInput → boolean`     | `false`                | Shows a clear (×) button that calls `clearValue()`.                                                                                                              |
| `errors`      | `readonly ValidationError[]` | `[]`                   | Signal-forms field binding — current validation errors of the bound field.                                                                                       |
| `touched`     | `boolean`                    | `false`                | Signal-forms field binding — whether the bound field is touched.                                                                                                 |
| `dirty`       | `boolean`                    | `false`                | Signal-forms field binding — whether the bound field is dirty.                                                                                                   |
| `id`          | `string`                     | auto (`mlv-control-N`) | ID applied to the native `<textarea>` element.                                                                                                                   |
| `label`       | `string`                     | `''`                   | Label text rendered in `mlv-label`.                                                                                                                              |
| `hint`        | `string`                     | `''`                   | Hint text rendered inside `mlv-hint` (nested in label).                                                                                                          |
| `description` | `string`                     | `''`                   | Persistent help text rendered in `mlv-description` below the control, in front of `message`. Referenced by `aria-describedby`.                                   |
| `message`     | `string`                     | `''`                   | Validation message rendered in `mlv-message`.                                                                                                                    |
| `required`    | `boolean` (coerced)          | `false`                | Renders the required marker in `mlv-label` and sets `aria-required` on the native `<textarea>`. Also a signal-forms field binding.                               |
| `ariaLabel`   | `string \| null`             | `null`                 | `aria-label` on the native `<textarea>` — use when no visible `mlv-label` is rendered.                                                                           |
| `pill`        | `boolean` (coerced)          | `false`                | Fully rounded (stadium) control container. Shared by every control extending the signal base.                                                                    |

> `maxLength` (`number | undefined`) doubles as the signal-forms `FormUiControl.maxLength` constraint member — its read/write type already matches the contract (`InputSignal<number | undefined>`), so no widening was needed (unlike `mlv-input`).

#### Outputs

| Name          | Type             | Description                                                                                                                                                                   |
| ------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `touch`       | `output<void>`   | Inherited from the base — emitted on blur (via `_markTouched`), the signal-forms replacement for CVA `onTouched`. `[formField]` subscribes and marks the bound field touched. |
| `valueChange` | `output<string>` | The `value` model's change output.                                                                                                                                            |

#### Signals & Computed Properties

| Name               | Kind              | Description                                                                                                         |
| ------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| `focused`          | `signal(boolean)` | Whether the textarea currently has focus.                                                                           |
| `charCount`        | `computed`        | Current character count (`(value() ?? '').length`).                                                                 |
| `isCountWarning`   | `computed`        | `true` when char count is ≥ 90 % of `maxLength`.                                                                    |
| `isCountError`     | `computed`        | `true` when char count has reached `maxLength`.                                                                     |
| `hasValue`         | `computed`        | `(value() ?? '').length > 0` — drives the wrapper's clear-button visibility.                                        |
| `minHeightStyle`   | `computed`        | CSS string for `min-height` of the scrollbar wrapper (derived from `rows`/`minRows`).                               |
| `maxHeightStyle`   | `computed`        | CSS string for `max-height` of the scrollbar wrapper (derived from `maxRows`), or `undefined`.                      |
| `computedDisabled` | `computed`        | `disabled()` — effective disabled state (no CVA `setDisabledState` side channel in the signal base).                |
| `resolvedState`    | `computed`        | Explicit non-default `state()`; otherwise `'error'` when the bound field has errors and is touched, or `'default'`. |

#### View Children

| Name           | Type                                                       | Description                                                               |
| -------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------- |
| `_textareaRef` | `viewChild<ElementRef<HTMLTextAreaElement>>('textareaEl')` | Reference to the native `<textarea>` element, used by `_runAutoResize()`. |

#### Content Slots

| Selector               | Description                                          |
| ---------------------- | ---------------------------------------------------- |
| `[mlvTextareaPrepend]` | Arbitrary content projected before the form wrapper. |
| `[mlvTextareaAppend]`  | Arbitrary content projected after the form wrapper.  |

#### Public Methods

| Method       | Signature                  | Description                                                                                |
| ------------ | -------------------------- | ------------------------------------------------------------------------------------------ |
| `onInput`    | `(event: Event): void`     | Handles the native `input` event; sets the `value` model (propagates to the bound field).  |
| `onBlur`     | `(): void`                 | Clears focused state and emits `touch` (via `_markTouched`).                               |
| `clearValue` | `(): void`                 | Resets the `value` model to `''` and marks the field touched (`_markTouched`).             |
| `setFocused` | `(focused: boolean): void` | Inherited from the base; updates the focus signal that drives the wrapper's focused state. |

#### Template Summary

1. Optional `[mlvTextareaPrepend]` slot.
2. `mlv-form-control-wrapper` (clearable, state, focused, disabled wired via inherited signals):
   - `mlv-label` (rendered when `label()` or `hint()` is set), with optional nested `mlv-hint`.
   - `mlv-scrollbar` wrapper whose `min-height`/`max-height` are bound inline; disabled when `autoResize` is true.
   - Native `<textarea #textareaEl>` with `aria-invalid`, `aria-label`, `aria-required`, `aria-describedby` (`_textareaDescribedBy()` — the base's description/message ids plus the counter id, `null` when none apply), and standard form bindings.
   - `mlv-description` (shown when `description()` is non-empty), carrying `_descriptionId()`.
   - `mlv-message` (shown when `message()` is non-empty), carrying `_messageId()`.
   - Character counter `<div mlvFormControlWrapperAside>` (shown when `maxLength` is set) with `aria-live="polite"` and `--warning` / `--error` class modifiers. **The `mlvFormControlWrapperAside` marker is required** — before 2026-08 the counter was a plain child of `mlv-form-control-wrapper`, matched no projection slot, and never reached the DOM (leaving `aria-describedby` pointing at a missing id).
3. Optional `[mlvTextareaAppend]` slot.

#### SCSS

BEM block: `.mlv-textarea`

| Class                           | Description                                                     |
| ------------------------------- | --------------------------------------------------------------- |
| `.mlv-textarea`                 | Block root                                                      |
| `.mlv-textarea__scrollbar`      | `mlv-scrollbar` wrapper; `flex: 1 1 auto`                       |
| `.mlv-textarea__field`          | Native `<textarea>`; no border/outline; hides native scrollbar  |
| `.mlv-textarea__count`          | Character counter; `text-align: right`; `--mlv-typography-ui-s` |
| `.mlv-textarea__count--warning` | Color: `--mlv-text-warning`                                     |
| `.mlv-textarea__count--error`   | Color: `--mlv-text-negative`                                    |
| `.mlv-textarea--auto-resize`    | Applied when `autoResize()` is true; allows free height growth  |
| `.mlv-textarea--disabled`       | Applied when `computedDisabled()` is true                       |
| `.mlv-textarea--focused`        | Applied when `focused()` is true                                |
| `.mlv-textarea--{state}`        | Applied for `resolvedState()` (e.g., `--error`, `--success`)    |

Key style decisions:

- Overrides `.mlv-form-control-wrapper__control-container` to `height: auto` so the textarea can grow.
- The clear button is repositioned with `margin-top`/`margin-inline-end` to align with the first text row.
- When `mlv-scrollbar` is disabled (auto-resize mode), its overflow is `visible`.

---

## Interfaces & Types

`MlvTextarea` relies on types from `@malva-ui/core/form-utils`:

| Type           | Values                                                     | Description             |
| -------------- | ---------------------------------------------------------- | ----------------------- |
| `MlvFormState` | `'default' \| 'success' \| 'info' \| 'warning' \| 'error'` | Visual validation state |

---

## Usage Examples

### Basic textarea with label

```html
<mlv-textarea label="Description" placeholder="Enter a description…" />
```

### Reactive form with validation message

```typescript
// component.ts
readonly descCtrl = new FormControl('', Validators.required);
```

```html
<mlv-textarea label="Description" hint="Maximum 500 characters" [maxLength]="500" [formControl]="descCtrl" [message]="descCtrl.invalid && descCtrl.touched ? 'Description is required' : ''" [state]="descCtrl.invalid && descCtrl.touched ? 'error' : 'default'" />
```

### Auto-resize with row constraints

```html
<mlv-textarea label="Notes" autoResize [minRows]="2" [maxRows]="8" placeholder="Type your notes…" />
```

### Clearable textarea in a reactive form

```html
<mlv-textarea label="Bio" clearable [rows]="5" [formControl]="bioCtrl" />
```

### Read-only textarea

```html
<mlv-textarea label="Summary" readonly [value]="summary()" />
```

### With prepend and append content slots

```html
<mlv-textarea label="Message">
  <div mlvTextareaPrepend>Prefix content</div>
  <div mlvTextareaAppend>Append content</div>
</mlv-textarea>
```

---

## Dependencies

### Angular / third-party

| Package                 | Usage                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `@angular/core`         | `Component`, `model`, `computed`, `effect`, `viewChild`, `input`, `ViewEncapsulation`, `ChangeDetectionStrategy` |
| `@angular/cdk/coercion` | `BooleanInput`, `coerceBooleanProperty`                                                                          |

### Internal (`@malva-ui/*`)

| Package                     | Exports used                                                                                                                                                   |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@malva-ui/core/form-utils` | `MlvSignalFormControlBase`, `MlvFormControlWrapper`, `MlvFormControlWrapperControl`, `MlvLabel`, `MlvHint`, `MlvMessage`, `MLV_FORM_CONTROL`, `MlvFormControl` |
| `@malva-ui/core/scrollbar`  | `MlvScrollbar`                                                                                                                                                 |
| `@malva-ui/styles`          | CSS custom properties (`--mlv-*` tokens), `mixins.base()`                                                                                                      |

---

## Signal-forms cutover (2026-07-22, slice 2)

- **Base swap:** `FormControlBase<string>` → `MlvSignalFormControlBase<string>`; dropped `implements ControlValueAccessor` and the `NG_VALUE_ACCESSOR` provider (kept `MLV_FORM_CONTROL`). A control may not implement both CVA and `FormValueControl`.
- **`value = model<string>('')`** replaces the former `internalValue` signal + CVA plumbing (`writeValue` removed; there is no `onChange`/`registerOn*`/`setDisabledState`). `charCount`/`isCountWarning`/`isCountError`/`hasValue` and the auto-resize effect all read `value()`; template renders `[value]="value() ?? ''"` defensively.
- **Touch:** blur emits the base `touch` output via `_markTouched()` (was CVA `onTouched`). `clearValue()` now does `value.set('')` + `_markTouched()` (preserves the old clear-marks-touched behaviour).
- **No constraint collisions:** the only `FormUiControl` same-named input is `maxLength` (`number | undefined`), whose type already matches the contract — no widening needed.
- **Matrix spec:** `textarea-binding-matrix.spec.ts` runs `verifyFormsBinding` green in all three modes (`[formControl]`, `ngModel`, `[formField]`). Existing `textarea.spec.ts` updated off removed CVA APIs (`internalValue` → `value`, `writeValue` → `value.set`, added `touch`-output + `clearValue` assertions).
