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
- Two side-by-side calendar panels (left = month M, right = M+1) with coordinated range selection — see _Panel month coordination_. **The mobile full-screen sheet renders `mlv-calendar-sheet` instead** — one continuous scroll of months, see _Mobile full-screen sheet_.
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

| Class                                   | Description                                                                                               |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `.mlv-date-range-picker`                | Host element                                                                                              |
| `.mlv-date-range-picker__trigger`       | Clickable trigger button/div                                                                              |
| `.mlv-date-range-picker__value`         | Formatted range text                                                                                      |
| `.mlv-date-range-picker__placeholder`   | Placeholder text when no range (`--mlv-text-tertiary`, the token `mlv-input` paints `::placeholder` with) |
| `.mlv-date-range-picker__separator`     | Arrow between start/end dates                                                                             |
| `.mlv-date-range-picker__trigger-icon`  | Calendar icon                                                                                             |
| `.mlv-date-range-picker__panel`         | Popup panel container                                                                                     |
| `.mlv-date-range-picker__panel--sheet`  | Panel modifier while the popup is a full-screen sheet: leftover height to the body, dropdown chrome off   |
| `.mlv-date-range-picker__calendars`     | Flex row wrapping two calendars (anchored dropdown only)                                                  |
| `.mlv-date-range-picker__calendar`      | Wrapper around one `mlv-calendar` (anchored dropdown only)                                                |
| `.mlv-date-range-picker__calendar--end` | The second (later-month) wrapper (anchored dropdown only)                                                 |
| `.mlv-date-range-picker__divider`       | Vertical divider between calendars (anchored dropdown only)                                               |
| `.mlv-date-range-picker__footer`        | Clear/Apply action row (anchored dropdown only)                                                           |
| `.mlv-date-range-picker__done`          | Sheet confirm action, projected into the popup's own header row (sheet only)                              |
| `--open` modifier                       | When popup is open                                                                                        |
| `--disabled` modifier                   | Disabled state                                                                                            |
| `--selecting` modifier                  | After start date chosen, awaiting end                                                                     |
| `--state-*` modifiers                   | Validation state border color                                                                             |

## Panel month coordination

The two panels are **locked one month apart** and driven from a single anchor
that the picker owns. The left panel paints the anchor month, the right paints
the month after it. Navigating either panel moves both, so the offset is an
invariant and the left panel can never overtake the right — there is no state
in which the panels overlap, cross, or drift apart.

| Piece                                 | Role                                                                                                                                                                             |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_navigatedAnchor: signal<D \| null>` | The month the user navigated to, or `null` to follow the selection. Reset to `null` on every open, so the picker reopens on the selected range rather than wherever it was left. |
| `leftCalendarActiveDate`              | `_navigatedAnchor()` when set, else the pending/committed range start, else today.                                                                                               |
| `rightCalendarActiveDate`             | `leftCalendarActiveDate() + 1 month`.                                                                                                                                            |
| `_onLeftActiveDateChange(d)`          | Writes `d` to the anchor.                                                                                                                                                        |
| `_onRightActiveDateChange(d)`         | Writes `d - 1 month` to the anchor.                                                                                                                                              |

Both panels are bound one-way — `[activeDate]="leftCalendarActiveDate()"` plus
`(activeDateChange)` — rather than `[(activeDate)]`, because the two panels are
not independent: a write has to be translated into the shared anchor before it
comes back out as two months.

**Both panels carry `[followSelection]="false"`.** Without it `mlv-calendar`
re-anchors its own `activeDate` on the current selection, and since both panels
receive the same `[rangeValue]="_pendingRange()"` they resolve the same anchor
(`end ?? start`) and paint the same month, overwriting the parent's binding.
See `libs-calendar.md` → _`followSelection`_.

**`followSelection` gates only the two constructor effects.** `selectDate()`,
`selectMonth()`, `selectYear()` and all three keyboard handlers write
`activeDate` regardless — twelve call sites in `calendar.ts`. So
`(activeDateChange)` fires on every day click and every arrow key, not only on
chevron navigation, and the handlers must tell the two apart themselves. Two
mechanisms do that, and both are load-bearing:

- **The handlers ignore a change that stays inside the month the panel already
  shows.** A day-level move is not navigation, and pinning `_navigatedAnchor`
  on one would stop the panels following the selection for the rest of the
  session — the next externally-set range would leave them stranded.
- **Both computeds carry month-level `equal`.** `activeDate` is _both_ the
  visible month and the focused cell, and `leftCalendarActiveDate` allocates a
  fresh date on every range change. Without a custom `equal`, that new identity
  re-binds `[activeDate]` on each keystroke and drags the focus ring back onto
  the range start — clicking 31 October left the ring on the 20th.

`_navigatedAnchor` is always a first-of-month (`_startOfMonth`), so the right
panel's `-1` / `+1` round trip cannot clamp. Anchoring on a raw `activeDate`
turns 31 Oct into 30 Sep and back into 30 Oct; 31 Mar comes back as 28 Mar,
because February is the clamp target. With month-level `equal` in place that
clamping is no longer observable in the rendered months, so this is an
invariant held by construction rather than one a failing test would catch.

This is what #138 fixed. Before it neither computed was bound at all: both
panels fell back to `MlvCalendar`'s own default and painted the current month
twice, and once a range spanned two months both self-snapped onto the end
month — so the left panel stopped showing the month the user had picked the
start date in.

**Picking the start in the right panel shifts the pair forward.** The anchor
follows the range start, so with nothing selected yet, clicking a day in the
right panel makes that day the start and the panels move from M / M+1 to
M+1 / M+2. This only happens for the _start_: once a start exists, choosing the
end in the right panel leaves the anchor — and both months — where they are.
Verified in a browser on `/date-range-picker`: opening on September / October
and clicking 20 September then 31 October holds both panels on September /
October, while clicking 31 October first moves them to October / November.

**Known edge — the two chevrons can disagree.** `canNavigatePrev()` /
`canNavigateNext()` read _that panel's own_ `activeDate`, so with a locked
offset the pair can be gated inconsistently. With `max = 15 Oct 2026` and the
panels on September / October, the two "next" chevrons render differently —
the left enabled, the right disabled — although both perform the same
locked-offset move. Clicking the enabled one lands the right panel on November
with every date disabled. The symmetric `min` case exists: with
`min = 10 Sep 2026`, the right panel's "previous" chevron moves the pair to
August / September and leaves the left panel with nothing selectable.

What a user sees is two identical-looking chevrons in one dialog behaving
differently, which is the part worth fixing; the dead panel is the smaller
problem. The offset invariant holds throughout and no invalid date becomes
selectable, so this is a wart rather than a correctness bug. The fix is to gate
both chevrons on the _pair_ — the left's `canNavigatePrev` **and** the right's
`canNavigateNext` — which needs a change in `mlv-calendar` and is left to a
follow-up.

Note this only bites when `max` (or `min`) falls **mid-month** in the outer
panel. A `max` at a month end disables both chevrons together, because
`canNavigateNext` already evaluates whether the next month has any selectable
date.

## Dependencies

- `@malva-ui/core/calendar` — `mlv-calendar` with `[range]="true"` mode for the anchored dropdown; `mlv-calendar-sheet` with `range` for the mobile full-screen sheet
- `@malva-ui/core/date` — `MLV_DATE_ADAPTER`, `MlvNativeDateAdapter`, `MlvDateAdapter` (date math and localized labels; moved out of `@malva-ui/core/calendar` in 2026-09)
- `@malva-ui/core/popup` — `mlv-popup` for the floating panel overlay; `[mlvPopupHeaderActions]` for the sheet's `Done` action
- `@malva-ui/core/button` — `mlvButton` on the footer `Clear` / `Apply` and the sheet's `Done`
- `@malva-ui/i18n` — `MLV_DATE_RANGE_PICKER_I18N`, plus `MLV_CALENDAR_I18N` for the sheet's shared `done` label
- `@malva-ui/core/form-utils` — `MlvSignalFormControlBase` signal-control base class
- `@malva-ui/cdk/utils` — theme/utility injection tokens
- `@malva-ui/cdk/accessibility` — `MlvTabbableElementService` for moving focus into the popup panel on open
- `@angular/cdk/a11y` — `A11yModule` / `cdkTrapFocus` for trapping Tab within the `role="dialog"` panel

## Notes

- Pending range (in-popup selection) is separate from committed range (form control value); Apply commits, Clear resets.
- `_isSelecting` computed flag drives the `--selecting` modifier when start is chosen but end is not yet.
- **Mobile fullscreen:** the `mlv-popup` opts into `mobileMode="auto"` (`[mobileTitle]="label() || _i18n().selectDateRange"`), so below the `md` breakpoint (< 768px) the picker opens in a full-screen sheet with a header + close button and scroll-locked page — rendering `mlv-calendar-sheet` rather than the two panels, see _Mobile full-screen sheet_ below. Because the **inner** panel already carries `role="dialog"` + `cdkTrapFocus`, the inner trap is disabled while the sheet is full-screen via `[cdkTrapFocus]="!rangePopup.isFullscreen()"` (reading the popup's public `isFullscreen` signal through the `#rangePopup` ref) so the outer full-screen trap is the only active one — the close button in the sheet header stays reachable. `_onPanelOpened()` / `_onPanelClosed()` focus-in/restore are unchanged. See `libs-popup.md` → _Mobile fullscreen inputs_.

### Mobile full-screen sheet: one continuous month list (#130)

Below the `md` breakpoint the panel renders **`mlv-calendar-sheet`** instead of
the two-panel row. It is a different body, not the same one with a month hidden:
`@if (rangePopup.isFullscreen())` swaps the whole `__calendars` + `__footer`
block for the sheet, so nothing in the dropdown layout is styled away.

```html
@if (rangePopup.isFullscreen()) {
<mlv-calendar-sheet range [(rangeValue)]="_pendingRange" [min]="min()" [max]="max()" [disabledDates]="disabledDates()" />
} @else { … the two panels and the Clear/Apply footer … }
```

- **What it fixes.** #121's stopgap hid `__calendar--end` and `__divider` with
  `display: none`, because two 264px calendars need 593px of inline space and
  the sheet is the one mode that caps the panel at the viewport. That left two
  measured costs: a distinct M+1 hidden between ~612px and 768px, and a
  committed cross-month range showing only its start month, with the highlight
  stopping mid-row and nothing to say it continued. The continuous list has both
  endpoints on screen in the same scroll, so both costs are gone and **the whole
  #121 block is deleted** — SCSS, doc rows and the specs that pinned it.
- **Confirm, not commit-on-tap.** A tap in the sheet writes `_pendingRange` only.
  The single commit path is a `Done` button projected through
  `[mlvPopupHeaderActions]` into the popup's own header row, which the popup
  stamps only while full-screen — so the anchored dropdown never sees it and
  keeps its footer `Apply`. Dismissing (✕, backdrop, Escape) commits nothing;
  `toggleDropdown()` re-seeds `_pendingRange` from the committed value on every
  open, so a discarded selection cannot survive into the next one.
- **No month grouping.** `role="group"` + "Start month" / "End month" name the
  two panels apart. The sheet has one list, so it carries neither — announcing a
  structure that is not there is worse than announcing none. The anchored
  dropdown keeps both groups, now unconditionally (#121 had made them
  conditional precisely because the sheet showed one calendar under the same
  markup; that reason is gone with the markup).
- **Focus.** `_onPanelOpened()` prefers `.mlv-calendar-sheet__day[tabindex="0"]`
  before falling back to the generic first-tabbable scan. The year strip's
  listbox is the first tabbable node in the sheet, so the scan alone would leave
  a keyboard user on the year scrubber with the calendar untouched.
- **Geometry.** `.mlv-date-range-picker__panel--sheet` carries
  `flex: 1 1 0; min-height: 0` and passes the same pair to
  `.mlv-calendar-sheet` — the way `mlv-time-picker__panel--sheet` claims its
  space, and for the same reason: every percentage here is inert, because
  `.mlv-popup__inner`'s own `min-height: 100%` does not resolve against a
  content-derived containing block (popup.scss § `--fullscreen`, measured at
  #116). `height: 100%` would leave the sheet at its natural size at the top
  with the rest of the viewport blank. `min-height: 0` is what lets the month
  scroller shrink below its content instead of growing the panel past the sheet.
- **Chrome, and the lack of it.** `__panel` is a dropdown surface — a hairline
  border, `--mlv-radius-l` and `--mlv-shadow-floating` — and the sheet reused it
  unchanged, so a viewport-filling surface painted a shadow it has nothing to
  float above (#149 review). The modifier resets all three
  (`border: none; border-radius: 0; box-shadow: none`); the anchored dropdown
  keeps them. The fill stays — `mlv-popup` paints its own surface behind it.
  Alongside that, the `<mlv-popup>` passes `class="mlv-popup--flush"` so the
  sheet body takes no inset either: `mlv-calendar-sheet` owns its inline spacing
  throughout, and the popup's shared inset doubled up on it and left a
  full-width sheet header over a body that floated inside it. Together they put
  the month grid flush against the sheet's own edges. See `libs-popup.md` →
  _Full-bleed sheets_.
- **Direction.** Which body the panel gets is a breakpoint question, not a
  direction one. The sheet mirrors inside itself — see `libs-calendar.md` →
  _Calendar sheet_ and `calendar-sheet-rtl.spec.ts`.

---

## Field surface (2026-08)

- Inherited `required` renders the `mlv-label` marker and sets `aria-required` on the trigger.
- Inherited `ariaLabel` names the `role="button"` trigger.
- Inherited `description` renders `<mlv-description>` below the control; `aria-describedby` is the base's `_describedBy()`.
- The public `messageId` computed is gone — `<mlv-message>` carries the base's `_messageId()`.
