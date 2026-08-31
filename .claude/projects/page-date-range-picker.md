---
name: page-date-range-picker
description: Documentation for the Date Range Picker docs page at apps/docs/src/app/pages/date-range-picker/
type: project
---

# Docs Page: date-range-picker

**Route:** `/date-range-picker`
**Component:** `DateRangePickerPageComponent`
**Path:** `apps/docs/src/app/pages/date-range-picker/`
**Nav icon:** `LucideCalendarDays`
**Nav group:** Forms (formsGroup)

## Examples

| #   | File          | Title               | What it demonstrates                                          |
| --- | ------------- | ------------------- | ------------------------------------------------------------- |
| 1   | `examples/1/` | Basic usage         | Standalone picker with formatted range display                |
| 2   | `examples/2/` | Inside a form field | Label, hint, and validation state                             |
| 3   | `examples/3/` | Min/max constraints | Date range limited to today → today+60 days                   |
| 4   | `examples/4/` | Reactive forms      | `FormGroup` binding with booking summary                      |
| 5   | `examples/5/` | Signal forms        | `[formField]` range binding with live value and touched state |

## Wiring

- Route added to `apps/docs/src/app/app.routes.ts` after `day-picker`
- Sidebar entry in `formsGroup` in `apps/docs/src/app/app.ts`
- Icon: `LucideCalendarDays`
