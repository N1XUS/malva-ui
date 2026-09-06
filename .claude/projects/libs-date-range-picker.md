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
- Two side-by-side calendar panels (left = month M, right = M+1) with coordinated range selection — **one panel only in the mobile full-screen sheet** (see _Mobile full-screen sheet_ below)
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

| Class                                   | Description                                                    |
| --------------------------------------- | -------------------------------------------------------------- |
| `.mlv-date-range-picker`                | Host element                                                   |
| `.mlv-date-range-picker__trigger`       | Clickable trigger button/div                                   |
| `.mlv-date-range-picker__value`         | Formatted range text                                           |
| `.mlv-date-range-picker__placeholder`   | Placeholder text when no range                                 |
| `.mlv-date-range-picker__separator`     | Arrow between start/end dates                                  |
| `.mlv-date-range-picker__trigger-icon`  | Calendar icon                                                  |
| `.mlv-date-range-picker__panel`         | Popup panel container                                          |
| `.mlv-date-range-picker__panel--sheet`  | Panel modifier, applied while the popup is a full-screen sheet |
| `.mlv-date-range-picker__calendars`     | Flex row wrapping two calendars                                |
| `.mlv-date-range-picker__calendar`      | Wrapper around one `mlv-calendar`                              |
| `.mlv-date-range-picker__calendar--end` | The second (later-month) wrapper; hidden under `--sheet`       |
| `.mlv-date-range-picker__divider`       | Vertical divider between calendars; hidden under `--sheet`     |
| `.mlv-date-range-picker__footer`        | Clear/Apply action row                                         |
| `--open` modifier                       | When popup is open                                             |
| `--disabled` modifier                   | Disabled state                                                 |
| `--selecting` modifier                  | After start date chosen, awaiting end                          |
| `--state-*` modifiers                   | Validation state border color                                  |

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

### Mobile full-screen sheet: one month, not two (#121)

The panel carries `.mlv-date-range-picker__panel--sheet` while `rangePopup.isFullscreen()`
is true, and that modifier hides `.mlv-date-range-picker__calendar--end` and
`.mlv-date-range-picker__divider` and centres the surviving month.

- **Why.** The two-panel row needs 593px of inline space (1rem row padding, two
  264px calendars, a 1px rule with 1rem margins). An anchored dropdown gets it —
  the CDK pane is sized to the content, so the desktop layout never clips at any
  viewport width. The sheet is the only mode that caps the panel at the viewport,
  and below roughly 612px the second month falls past `__panel`'s
  `overflow: hidden` edge. Measured in Chrome at 375x812: 29px of a 264px panel
  visible, 236px unreachable, and no user gesture reaches it — `overflow: hidden`
  paints no scrollbar and refuses touch panning.
- **The modifier tracks sheet mode, not a media query.** The trigger is the panel
  being width-capped, which is exactly `mlv-popup`'s full-screen state; keying off
  `isFullscreen()` also keeps SCSS and TS from drifting apart when a consumer
  overrides only one of `$mlv-breakpoint-md` / `provideMlvBreakpoints()`.
- **Range selection is unaffected.** The pending range lives on
  `MlvDateRangePicker`, not on either `mlv-calendar`, so a range spanning two
  months is assembled in one panel through the calendar's own `‹` / `›` month
  navigation and survives the month change.
- **Keyboard.** `display: none` takes the hidden calendar's four roving tab stops
  out of the tab order and out of the a11y tree. Before the fix they stayed
  focusable inside the clipped region, and focusing one made the browser scroll
  the `overflow: hidden` panel to `scrollLeft: 236` — revealing the second month
  by pushing the first one out, with no way back.
- **Between ~612px and 768px** the sheet is wide enough for two months and still
  shows one. That is deliberate: sheet mode behaves one way at every width, with
  no second threshold to keep in sync.
- **Removable.** Every declaration is scoped under the one modifier; #130 replaces
  the sheet body with a dedicated mobile calendar and deletes the block whole.

---

## Field surface (2026-08)

- Inherited `required` renders the `mlv-label` marker and sets `aria-required` on the trigger.
- Inherited `ariaLabel` names the `role="button"` trigger.
- Inherited `description` renders `<mlv-description>` below the control; `aria-describedby` is the base's `_describedBy()`.
- The public `messageId` computed is gone — `<mlv-message>` carries the base's `_messageId()`.
