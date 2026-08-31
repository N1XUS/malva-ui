---
# Library: day-picker

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Day Picker library (`@malva-ui/core/day-picker`) provides a date selection component with a calendar popup and signal/reactive/template-driven forms support.

## Public API

Exported from `libs/forms/day-picker/src/index.ts`:

| Export | Kind | Description |
|--------|------|-------------|
| `MlvDayPicker` | Component | Date picker input — `mlv-day-picker` |
| `MlvDayPickerState` | Type | `'default' \| 'success' \| 'info' \| 'warning' \| 'error'` |

---

## Components

### `MlvDayPicker`

**File:** `libs/forms/day-picker/src/lib/day-picker/day-picker.ts`
**Template:** `libs/forms/day-picker/src/lib/day-picker/day-picker.html`
**Styles:** `libs/forms/day-picker/src/lib/day-picker/day-picker.css`

- **Selector:** `mlv-day-picker`
- **Change Detection:** `OnPush`
- **Extends:** `MlvSignalFormControlBase<D | null>`

#### Model (two-way binding)

| Name    | Type           | Default |
| ------- | -------------- | ------- |
| `value` | `Date \| null` | `null`  |

#### Inputs

| Name          | Type                | Default            | Description                 |
| ------------- | ------------------- | ------------------ | --------------------------- |
| `placeholder` | `string`            | `'Select date...'` | Shown when no date selected |
| `state`       | `MlvDayPickerState` | `'default'`        | Visual/validation state     |
| `disabled`    | `boolean`           | `false`            | Disables date selection     |
| `label`       | `string`            | `''`               | Optional label              |
| `message`     | `string`            | `''`               | Validation/error message    |
| `min`         | `Date \| null`      | `null`             | Minimum selectable date     |
| `max`         | `Date \| null`      | `null`             | Maximum selectable date     |
| `dateFormat`  | `string`            | `'yyyy-MM-dd'`     | Display format string       |

#### Internal Signals

- `isOpen: signal(false)` — popup visibility
- `displayValue` — formatted date string or `''`
- `inputId` — auto-generated unique ID

#### Host Bindings

```ts
host: {
  'class': 'mlv-day-picker',
  '[class.mlv-day-picker--disabled]': 'disabled()',
}
```

#### Key Methods

- `toggleDropdown()` — open/close calendar popup
- `onDateSelected(date: Date | null)` — handle date selection; closes popup
- External form writes update the public `value` model.

#### Template Summary

Optional label → `MlvPopupContainer` with trigger (displays `displayValue` or placeholder + calendar icon, `role="combobox"`) → `MlvPopup` containing `MlvCalendar` (bound to `value`, `min`, `max`). Optional message display.

Keyboard: Enter/Space opens, Escape closes.

---

## Usage Examples

```html
<!-- Basic -->
<mlv-day-picker [(value)]="selectedDate" label="Date" />

<!-- With constraints -->
<mlv-day-picker [(value)]="date" [min]="minDate" [max]="maxDate" />

<!-- Error state -->
<mlv-day-picker [(value)]="date" state="error" message="Required" />

<!-- Reactive forms -->
<mlv-day-picker [formControl]="dateCtrl" label="Birth Date" />

<!-- Disabled -->
<mlv-day-picker [(value)]="date" [disabled]="true" />
```

---

## Dependencies

- `@angular/forms/signals` — `FormValueControl` contract
- `@malva-ui/core/popup` — `MlvPopup`, `MlvPopupContent`, `MlvPopupContainer`
- `@malva-ui/core/calendar` — `MlvCalendar`
- `@lucide/angular` — `LucideCalendar` icon
