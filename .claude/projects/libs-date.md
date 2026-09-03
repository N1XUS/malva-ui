# Library: date

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library.

## Overview

The Date library (`@malva-ui/core/date`, Nx project `core-date`) owns the shared Malva UI **date-adapter contract**. It ships no component: it is the abstraction every date-aware component (`mlv-calendar`, `mlv-day-picker`, `mlv-date-range-picker`, `mlv-scheduler`) uses for date math, comparison, parsing and localized labels, so an application can swap native `Date` for Luxon, Moment, date-fns value objects or any other representation once, app-wide.

Until 2026-09 these symbols lived in `@malva-ui/core/calendar`. The move is a hard move with no alias — see [docs/migrations/2026-09-core-date.md](../../docs/migrations/2026-09-core-date.md). The `@malva-ui/core` root barrel still re-exports everything.

## Public API

Exported from `libs/core/date/src/index.ts`:

| Export                  | Kind            | Description                                                                                                                                                 |
| ----------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MlvDateAdapter<D>`     | Abstract class  | Date manipulation and localization contract for date-aware components                                                                                       |
| `MlvDateFormatOptions`  | Type            | `Intl.DateTimeFormatOptions` — the options shape accepted by `format()`                                                                                     |
| `MLV_DATE_ADAPTER`      | InjectionToken  | App-level token for providing a custom `MlvDateAdapter` implementation (no root default — components fall back to `MlvNativeDateAdapter` when it is absent) |
| `MLV_DATE_LOCALE`       | InjectionToken  | App-level locale string consumed by adapters; defaults to `navigator.language`, then `en-US`                                                                |
| `MlvNativeDateAdapter`  | Service         | Default adapter built on native `Date` and `Intl.DateTimeFormat` (`providedIn: 'root'`)                                                                     |
| `provideMlvDateAdapter` | Provider helper | `provideMlvDateAdapter(AdapterClass, locale?)` registers an adapter class and optional locale                                                               |

## Services

### `MlvDateAdapter<D>`

**File:** `libs/core/date/src/lib/date-adapter.ts`

Abstract contract. Responsibilities:

- clone / create / validate date instances (`today`, `clone`, `createDate`, `isDateInstance`, `isValid`, `deserialize`)
- read calendar fields (`getYear`, `getMonth`, `getDate`, `getDayOfWeek`, `getNumDaysInMonth`)
- calendar arithmetic (`addCalendarDays`, `addCalendarMonths`, `addCalendarYears`) and comparison (`compareDate`, `sameDate`)
- localized month / weekday names and formatted labels (`getMonthNames`, `getDayOfWeekNames`, `format`, `toIso8601`)
- `locale` is a `WritableSignal<string>` read by every formatting method

Components consume the contract through `inject(MLV_DATE_ADAPTER, { optional: true }) ?? inject(MlvNativeDateAdapter)`.

### `MlvNativeDateAdapter`

**File:** `libs/core/date/src/lib/native-date-adapter.ts`

Default adapter. Native `Date` for date math (dates are normalized to local midnight by `clone` / `addCalendar*`), `Intl.DateTimeFormat` for month names, weekday names and accessible labels. `createDate` throws on an out-of-range month or day.

### Provider tokens

- `MLV_DATE_ADAPTER` — injects the active adapter instance
- `MLV_DATE_LOCALE` — provides the app-level locale string
- `provideMlvDateAdapter(AdapterClass, locale?)` — helper for app configuration

## Usage

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { MlvNativeDateAdapter, provideMlvDateAdapter } from '@malva-ui/core/date';

bootstrapApplication(AppComponent, {
  providers: [...provideMlvDateAdapter(MlvNativeDateAdapter, 'ro-RO')],
});
```

A custom adapter extends `MlvDateAdapter<D>` and implements every abstract member; register it with `provideMlvDateAdapter(MyLuxonAdapter)`.

## Testing

`yarn nx run core-date:test` — `libs/core/date/src/lib/date-adapter.spec.ts` covers the provider helper, `createDate` validation, `isValid`, and (from 2026-09) the time-of-day contract.
