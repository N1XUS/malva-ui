# Date adapter: `@malva-ui/core/calendar` → `@malva-ui/core/date`

Date: 2026-09-03.

## 1. New home

`MlvDateAdapter`, `MlvDateFormatOptions`, `MLV_DATE_ADAPTER`, `MLV_DATE_LOCALE`,
`provideMlvDateAdapter` and `MlvNativeDateAdapter` now live in their own
component-less secondary entry point, `@malva-ui/core/date`. They are no longer
exported from `@malva-ui/core/calendar`. There is no deprecated alias.

The `@malva-ui/core` root barrel re-exports the new entry point, so deep
imports from the root keep working unchanged.

### What consumers change

Rewrite the import specifier. Every exported symbol keeps its name:

```diff
-import { MlvNativeDateAdapter, provideMlvDateAdapter } from '@malva-ui/core/calendar';
+import { MlvNativeDateAdapter, provideMlvDateAdapter } from '@malva-ui/core/date';
```

`MlvCalendar`, `MlvCalendarView` and `MlvCalendarRangeValue` stay in
`@malva-ui/core/calendar`; a file that uses both now imports from both.

### Why

The adapter is the contract every date-aware component shares —
`mlv-calendar`, `mlv-day-picker`, `mlv-date-range-picker` and the new
`@malva-ui/scheduler`. Keeping it inside the calendar forced every consumer to
depend on the `mlv-calendar` component just to reach the abstraction, and the
scheduler package would have pulled the calendar in for the same reason.

## 2. Time-of-day members (breaking for custom adapters)

`@malva-ui/scheduler` needs wall-clock arithmetic and a clock it can substitute,
so `MlvDateAdapter<D>` grew six **abstract** members. Any adapter that extends
`MlvDateAdapter<D>` directly must implement them; `MlvNativeDateAdapter` already
does, so applications on the default adapter change nothing.

| Member                                             | Contract                                                                                 |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `getHours(date)`                                   | wall-clock hour, 0–23                                                                    |
| `getMinutes(date)`                                 | wall-clock minute, 0–59                                                                  |
| `createDateTime(year, month, day, hours, minutes)` | like `createDate` plus a time; throws on out-of-range fields                             |
| `addMinutes(date, minutes)`                        | elapsed-minute arithmetic (negative allowed)                                             |
| `differenceInMinutes(first, second)`               | `first − second`, truncated toward zero                                                  |
| `now()`                                            | the current date-time in the adapter's zone; the only clock any Malva UI component reads |

New **concrete** helpers, inherited by every adapter (override only if your
library does better): `withTime`, `startOfDay`, `minutesOfDay`, `shiftDays`
(adds calendar days and keeps the wall-clock time — `addCalendarDays` may
normalize to midnight), `compareDateTime`, `sameDateTime` (minute resolution;
seconds ignored).
