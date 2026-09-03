---
# Library: day-picker

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Day Picker library (`@malva-ui/core/day-picker`) provides a date selection component with a calendar popup. It is a signal forms control that also works with reactive and template-driven forms. Supports date range validation (min/max), custom date formatting, and multiple validation states.

## Public API

Exported from `libs/forms/day-picker/src/index.ts`:

| Export | Kind | Description |
|--------|------|-------------|
| `MlvDayPicker` | Component | Date picker input — `mlv-day-picker` |
| `MlvDayPickerState` | Type | `'default' \| 'success' \| 'info' \| 'warning' \| 'error'` (alias of `MlvFormState`) |

---

## Components

### `MlvDayPicker`

**File:** `libs/forms/day-picker/src/lib/day-picker/day-picker.ts`
**Template:** `libs/forms/day-picker/src/lib/day-picker/day-picker.html`
**Styles:** `libs/forms/day-picker/src/lib/day-picker/day-picker.css`

- **Selector:** `mlv-day-picker`
- **Change Detection:** `OnPush`
- **Extends:** `MlvSignalFormControlBase<D | null>` (`FormValueControl` contract)

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
- External form writes update the public `value` model without emitting a user interaction.

#### Template Summary

Optional label → `MlvPopupContainer` with trigger (displays `displayValue` or placeholder — `.mlv-day-picker__placeholder`, painted `--mlv-text-tertiary` like `mlv-input`'s `::placeholder` — + calendar icon, `role="combobox"`) → `MlvPopup` containing `MlvCalendar` (bound to `value`, `min`, `max`). Optional message display.

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

- `@angular/forms/signals` — `FormValueControl` contract and `[formField]` binding
- `@malva-ui/core/popup` — `MlvPopup`, `MlvPopupContent`, `MlvPopupContainer`
- `@malva-ui/core/calendar` — `MlvCalendar`
- `@lucide/angular` — `LucideCalendar` icon

---

## Accessibility notes (updated)

- The calendar popup is a modal dialog: `mlv-popup` is configured with `panelRole="dialog"` + `[modal]="true"` + `[ariaLabel]` (focus trap + `aria-modal`).
- On open, focus moves into the calendar; on close, focus is restored to the trigger.
- The trigger's `aria-controls` targets the calendar region id (`{id}-popup`), `tabindex` is `-1` when disabled, `aria-disabled` renders only when disabled, and the visible label is linked via `aria-labelledby` (a `<label for>` cannot name the `<div role="combobox">` trigger).

## Mobile fullscreen

The calendar `mlv-popup` opts into `mobileMode="auto"` (`[mobileTitle]="label() || _resolvedPlaceholder()"`), so below the `md` breakpoint (< 768px) the calendar opens as a full-screen sheet with a header bar + close button, scroll-locked page, and slide-up animation; on larger viewports it stays anchored to the trigger (unchanged). The existing `panelRole="dialog"` + `[modal]="true"` focus trap composes with the full-screen sheet, and `_onPopupOpened()` / `_onPopupClosed()` (focus-into-calendar / focus-restore) keep working. See `libs-popup.md` → _Mobile fullscreen inputs_.

---

## `@angular/aria` integration — evaluated, NOT adopted (2026-07-20)

Phase 3 of the aria migration listed `day-picker → ngCombobox + ngComboboxDialog recipe; calendar stays manual`. This was **spike-evaluated and rejected**; the manual `<div role="combobox">` trigger + CDK-overlay `mlv-popup` implementation is kept. Reasons (empirical, aria 22.0.5):

1. **`ngComboboxDialog` does not exist in aria 22.0.5.** The only combobox directives are `ngCombobox`, `ngComboboxPopup`, `ngComboboxWidget`. "dialog" is merely a `popupType` string value (`'listbox' | 'tree' | 'grid' | 'dialog'`) on `ComboboxPopup`.
2. **`popupType="dialog"` produces no native `<dialog>` element and no modal/centering behavior.** A spike (`[ngCombobox]` trigger + `ng-template[ngComboboxPopup] popupType="dialog"`) rendered the popup inline via aria's `DeferredContent`, in-flow inside the component subtree (`nativeDialogElementProduced: false`); the only effect on the trigger is `aria-haspopup="dialog"` — which the manual trigger already sets. The premise that a native dialog's default modal centering might change the positioning calculus does not apply.
3. **aria's popup rendering conflicts with the mandated CDK-overlay positioning** (same conflict documented for `select` Task 2.5 and `combobox` Task 2.7). `Combobox extends DeferredContentAware` and `ComboboxPopup` is a structural directive bound to aria's own `DeferredContent`, so the popup cannot be handed to `mlv-popup` (CDK overlay) for anchored-under-trigger positioning without fighting aria.
4. **Uniquely decisive here: the popup content is a calendar, which stays manual by plan.** aria's combobox coordination expects an aria popup _widget_ (`ngListbox`/`ngTree`/`ngGrid`) inside `ngComboboxWidget` to relay navigation keys / active-descendant to. A calendar is none of these, so `[ngCombobox]` on the trigger would have no aria widget to coordinate with — zero semantic gain, only added complexity and risk to the working focus-in/focus-restore + focus-trap contract.
5. **The existing manual trigger already satisfies the full a11y contract** (role=combobox, aria-haspopup=dialog, aria-expanded, aria-controls, aria-labelledby, disabled tabindex, Enter/Space open, Escape close, focus-into-calendar on open, focus-restore on close, `aria-modal` focus-trap via `mlv-popup`).

Decision: keep manual. No public API, template, or spec changes. This is the plan's sanctioned fallback ("if a pattern doesn't fit, keep the manual implementation").

---

## Field surface (2026-08)

- Inherited `required` renders the `mlv-label` marker and sets `aria-required` on the `role="combobox"` trigger.
- Inherited `ariaLabel` names the trigger when no visible `label` is set (a visible label still wins through `aria-labelledby`).
- Inherited `description` renders `<mlv-description>` below the control; the trigger's `aria-describedby` is the base's `_describedBy()`.
- The public `messageId` computed is gone — `<mlv-message>` now carries the base's `_messageId()`, which previously had no id at all on some paths.
