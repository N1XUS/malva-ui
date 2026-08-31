---

# Library: date-range-picker

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Date Range Picker library (`@malva-ui/core/date-range-picker`) provides a dual-calendar popup for selecting a start and end date with signal/reactive/template-driven forms integration.

## Public API

Exported from `libs/core/date-range-picker/src/index.ts`:

| Export                    | Kind      | Description                                                        |
| ------------------------- | --------- | ------------------------------------------------------------------ |
| `MlvDateRangePicker`      | Component | Date range picker — `mlv-date-range-picker`                        |
| `MlvDateRangePickerValue` | Interface | `{ start: D \| null; end: D \| null }` — the committed value shape |
| `MlvDateRangePickerState` | Type      | `'default' \| 'success' \| 'info' \| 'warning' \| 'error'`         |

## Components

### `MlvDateRangePicker<D = Date>`

**Selector:** `mlv-date-range-picker` | **Change Detection:** `OnPush` | **Encapsulation:** `None`

Extends `MlvSignalFormControlBase<MlvDateRangePickerValue<D> | null>`.

#### Inputs (component-specific)

| Name            | Type                             | Default                  | Description                     |
| --------------- | -------------------------------- | ------------------------ | ------------------------------- |
| `placeholder`   | `string`                         | `'Select date range...'` | Shown when no range is selected |
| `min`           | `D \| null`                      | `null`                   | Minimum selectable date         |
| `max`           | `D \| null`                      | `null`                   | Maximum selectable date         |
| `disabledDates` | `((date: D) => boolean) \| null` | `null`                   | Custom disabled-date predicate  |

Inherits `state`, `disabled`, `loading`, `clearable`, `id`, `label`, `hint`, `message`, and signal field state from `MlvSignalFormControlBase`.

See CLAUDE.md for full API details.

## Dependencies

- `@malva-ui/core/calendar` — `MlvCalendar`, `MlvCalendarRangeValue`, date adapter
- `@malva-ui/core/popup` — overlay infrastructure
- `@malva-ui/core/form-utils` — `MlvSignalFormControlBase`, form wrapper components
- `@malva-ui/core/button` — Apply / Clear buttons in the panel footer
- `@lucide/angular` — `LucideCalendarDays`
