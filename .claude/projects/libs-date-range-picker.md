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
- Two side-by-side calendar panels (left = month M, right = M+1) with coordinated range selection — see _Panel month coordination_. **One panel only in the mobile full-screen sheet** — see _Mobile full-screen sheet_.
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
| `.mlv-date-range-picker__panel--sheet`  | Panel modifier, applied while the popup is a full-screen sheet                                            |
| `.mlv-date-range-picker__calendars`     | Flex row wrapping two calendars                                                                           |
| `.mlv-date-range-picker__calendar`      | Wrapper around one `mlv-calendar`                                                                         |
| `.mlv-date-range-picker__calendar--end` | The second (later-month) wrapper; hidden under `--sheet`                                                  |
| `.mlv-date-range-picker__divider`       | Vertical divider between calendars; hidden under `--sheet`                                                |
| `.mlv-date-range-picker__footer`        | Clear/Apply action row                                                                                    |
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

- `@malva-ui/core/calendar` — `mlv-calendar` with `[range]="true"` mode
- `@malva-ui/core/date` — `MLV_DATE_ADAPTER`, `MlvNativeDateAdapter`, `MlvDateAdapter` (date math and localized labels; moved out of `@malva-ui/core/calendar` in 2026-09)
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
  `overflow: hidden` edge. Measured in Chrome at 375x812 with the block ablated:
  29px of a 264px calendar visible, 235px unreachable, and no user gesture reaches it — `overflow: hidden`
  paints no scrollbar and refuses touch panning.
- **The modifier tracks sheet mode, not a media query.** The trigger is the panel
  being width-capped, which is exactly `mlv-popup`'s full-screen state; keying off
  `isFullscreen()` also keeps SCSS and TS from drifting apart when a consumer
  overrides only one of `$mlv-breakpoint-md` / `provideMlvBreakpoints()`.
- **It does not change mid-open.** `isFullscreen()` is resolved once per open
  (#126 / #144), so a viewport crossing `md` while the picker is open neither
  drops the second month out of an anchored dropdown nor strips the sheet's
  header and close button off a full-screen one; the next open re-resolves.
  See `libs-popup.md` → _Mode is resolved once per open_.
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
  no second threshold to keep in sync. **The cost of that band grew when #140
  landed.** This modifier was written while both panels painted the _same_ month,
  so hiding the second one lost nothing; now that the panels are locked one month
  apart, the band hides a genuinely distinct, fully-visible M+1. The trade is
  still worth it — one rule with one threshold, deleted whole by #130 — but it is
  no longer free, and a container query at the 593px the row actually needs is the
  alternative if #130 slips.
- **The end date can be off-screen, and the range looks like it ends early.** The
  visible panel is anchored to the range _start_ (`leftCalendarActiveDate` falls
  back to `pending?.start ?? value?.start`, and `_navigatedAnchor` resets on every
  open), so reopening the sheet on a committed cross-month range shows the start
  month. Measured at 375x812 with 20 Sep – 20 Oct 2026 committed: the sheet paints
  September and the highlight stops at the `4` in September's trailing overflow
  row — the same rendering an end of 4 Oct produces, with nothing distinguishing
  them. The trigger still reads the true range. This is the sharpest cost of
  one-month sheet mode and the clearest argument for #130's continuous month list.
- **Removable.** Every declaration is scoped under the one modifier; #130 replaces
  the sheet body with a dedicated mobile calendar and deletes the block whole.

---

## Field surface (2026-08)

- Inherited `required` renders the `mlv-label` marker and sets `aria-required` on the trigger.
- Inherited `ariaLabel` names the `role="button"` trigger.
- Inherited `description` renders `<mlv-description>` below the control; `aria-describedby` is the base's `_describedBy()`.
- The public `messageId` computed is gone — `<mlv-message>` carries the base's `_messageId()`.
