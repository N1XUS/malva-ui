---
name: libs-date-range-picker
description: Documentation for the @malva-ui/core/date-range-picker library — date range selection input
type: project
---

# Library: date-range-picker

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library.

## Overview

The Date Range Picker library (`@malva-ui/core/date-range-picker`) provides a date range selection input combining two `mlv-calendar` instances inside a `mlv-popup` overlay.

**Features:**

- Trigger button showing formatted date range or placeholder
- Two side-by-side calendar panels (left = month M, right = M+1) with coordinated range selection
- First click sets start date, second click sets end date
- Hover preview shows the potential range while selecting
- Clear and Apply buttons in the footer
- Full signal, reactive, and template-driven forms integration producing `MlvDateRangePickerValue<D> | null`
- Keyboard accessible: trigger opens popup, Escape closes, Tab navigates between calendars
- Modal focus management: the **inner panel** carries `role="dialog"` + `aria-modal="true"` + `cdkTrapFocus` (the single dialog role for this surface — the wrapping `mlv-popup` stays roleless/non-modal to avoid nesting a second dialog). On open, focus moves into the panel (first tabbable element, falling back to the `tabindex="-1"` panel container); Tab is trapped within; on close, focus returns to the trigger. Wired via the popup's `(afterOpened)="_onPanelOpened()"` / `(afterClosed)="_onPanelClosed()"`, `cdkTrapFocus` (`A11yModule`), and `MlvTabbableElementService` from `@malva-ui/cdk/accessibility`.
- State variants: `default`, `success`, `warning`, `error`, `info`

## Public API

Exported from `libs/core/date-range-picker/src/index.ts`:

| Export                       | Kind      | Description                                                                          |
| ---------------------------- | --------- | ------------------------------------------------------------------------------------ |
| `MlvDateRangePicker`         | Component | `mlv-date-range-picker`                                                              |
| `MlvDateRangePickerValue<D>` | Interface | `{ start: D \| null; end: D \| null }`                                               |
| `MlvDateRangePickerState`    | Type      | `'default' \| 'success' \| 'warning' \| 'error' \| 'info'` (alias of `MlvFormState`) |

## Component: `MlvDateRangePicker` (`mlv-date-range-picker`)

### Inputs

| Input         | Type                                                   | Default               | Description                                                        |
| ------------- | ------------------------------------------------------ | --------------------- | ------------------------------------------------------------------ |
| `placeholder` | `string`                                               | `'Select date range'` | Placeholder text when no range is selected                         |
| `disabled`    | `BooleanInput`                                         | `false`               | Disables the trigger                                               |
| `state`       | `MlvDateRangePickerState`                              | `'default'`           | Validation state for border color                                  |
| `min`         | `D \| MlvDateRangePickerValue<D> \| null \| undefined` | `null`                | Minimum date; signal-form range constraints use their `start` date |
| `max`         | `D \| MlvDateRangePickerValue<D> \| null \| undefined` | `null`                | Maximum date; signal-form range constraints use their `end` date   |

### Outputs

| Output        | Type                                    | Description    |
| ------------- | --------------------------------------- | -------------- |
| `rangeChange` | `MlvDateRangePickerValue<Date> \| null` | Emits on Apply |

### Forms contract

- Produces `MlvDateRangePickerValue<Date> | null`
- External `value` model writes populate the trigger display and pending range without user-change feedback.
- Implements Angular's signal-control contract and remains compatible with `[formControl]`, `formControlName`, and `ngModel`.

## SCSS / BEM

Block: `mlv-date-range-picker`

| Class                                  | Description                           |
| -------------------------------------- | ------------------------------------- |
| `.mlv-date-range-picker`               | Host element                          |
| `.mlv-date-range-picker__trigger`      | Clickable trigger button/div          |
| `.mlv-date-range-picker__value`        | Formatted range text                  |
| `.mlv-date-range-picker__placeholder`  | Placeholder text when no range        |
| `.mlv-date-range-picker__separator`    | Arrow between start/end dates         |
| `.mlv-date-range-picker__trigger-icon` | Calendar icon                         |
| `.mlv-date-range-picker__panel`        | Popup panel container                 |
| `.mlv-date-range-picker__calendars`    | Flex row wrapping two calendars       |
| `.mlv-date-range-picker__divider`      | Vertical divider between calendars    |
| `.mlv-date-range-picker__footer`       | Clear/Apply action row                |
| `--open` modifier                      | When popup is open                    |
| `--disabled` modifier                  | Disabled state                        |
| `--selecting` modifier                 | After start date chosen, awaiting end |
| `--state-*` modifiers                  | Validation state border color         |

## Dependencies

- `@malva-ui/core/calendar` — `mlv-calendar` with `[range]="true"` mode
- `@malva-ui/core/popup` — `mlv-popup` for the floating panel overlay
- `@malva-ui/core/form-utils` — `MlvSignalFormControlBase` signal-control base class
- `@malva-ui/cdk/utils` — theme/utility injection tokens
- `@malva-ui/cdk/accessibility` — `MlvTabbableElementService` for moving focus into the popup panel on open
- `@angular/cdk/a11y` — `A11yModule` / `cdkTrapFocus` for trapping Tab within the `role="dialog"` panel

## Notes

- Pending range (in-popup selection) is separate from committed range (form control value); Apply commits, Clear resets.
- `_isSelecting` computed flag drives the `--selecting` modifier when start is chosen but end is not yet.
- **Mobile fullscreen:** the `mlv-popup` opts into `mobileMode="auto"` (`[mobileTitle]="label() || _i18n().selectDateRange"`), so below the `md` breakpoint (< 768px) both calendars open in a full-screen sheet with a header + close button and scroll-locked page. Because the **inner** panel already carries `role="dialog"` + `cdkTrapFocus`, the inner trap is disabled while the sheet is full-screen via `[cdkTrapFocus]="!rangePopup.isFullscreen()"` (reading the popup's public `isFullscreen` signal through the `#rangePopup` ref) so the outer full-screen trap is the only active one — the close button in the sheet header stays reachable. `_onPanelOpened()` / `_onPanelClosed()` focus-in/restore are unchanged. See `libs-popup.md` → _Mobile fullscreen inputs_.

---

## Field surface (2026-08)

- Inherited `required` renders the `mlv-label` marker and sets `aria-required` on the trigger.
- Inherited `ariaLabel` names the `role="button"` trigger.
- Inherited `description` renders `<mlv-description>` below the control; `aria-describedby` is the base's `_describedBy()`.
- The public `messageId` computed is gone — `<mlv-message>` carries the base's `_messageId()`.
