# Library: date

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library.

## Overview

The Date library (`@malva-ui/core/date`, Nx project `core-date`) owns the shared Malva UI **date-adapter contract**. It ships no component: it is the abstraction every date-aware component (`mlv-calendar`, `mlv-day-picker`, `mlv-date-range-picker`, `mlv-scheduler`) uses for date math, comparison, parsing and localized labels, so an application can swap native `Date` for Luxon, Moment, date-fns value objects or any other representation once, app-wide.

Until 2026-09 these symbols lived in `@malva-ui/core/calendar`. The move is a hard move with no alias — see [docs/migrations/2026-09-core-date.md](../../docs/migrations/2026-09-core-date.md). The `@malva-ui/core` root barrel still re-exports everything.

## Public API

Exported from `libs/core/date/src/index.ts`:

| Export                  | Kind            | Description                                                                                                                                                                                     |
| ----------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MlvDateAdapter<D>`     | Abstract class  | Date manipulation and localization contract for date-aware components                                                                                                                           |
| `MlvDateFormatOptions`  | Type            | `Intl.DateTimeFormatOptions` — the options shape accepted by `format()`                                                                                                                         |
| `MLV_DATE_ADAPTER`      | InjectionToken  | App-level token for providing a custom `MlvDateAdapter` implementation (no root default — components fall back to `MlvNativeDateAdapter` when it is absent)                                     |
| `MLV_DATE_LOCALE`       | InjectionToken  | App-level locale string consumed by adapters; defaults to `MLV_LOCALE` (`@malva-ui/i18n`: active pack's `locale` → `LOCALE_ID`), snapshot at first injection. Never `navigator.language` (#306) |
| `MlvNativeDateAdapter`  | Service         | Default adapter built on native `Date` and `Intl.DateTimeFormat` (`providedIn: 'root'`)                                                                                                         |
| `provideMlvDateAdapter` | Provider helper | `provideMlvDateAdapter(AdapterClass, locale?)` registers an adapter class and optional locale                                                                                                   |

## Services

### `MlvDateAdapter<D>`

**File:** `libs/core/date/src/lib/date-adapter.ts`

Abstract contract. Responsibilities:

- clone / create / validate date instances (`today`, `clone`, `createDate`, `isDateInstance`, `isValid`, `deserialize`)
- read calendar fields (`getYear`, `getMonth`, `getDate`, `getDayOfWeek`, `getNumDaysInMonth`)
- calendar arithmetic (`addCalendarDays`, `addCalendarMonths`, `addCalendarYears`) and comparison (`compareDate`, `sameDate`)
- localized month / weekday names and formatted labels (`getMonthNames`, `getDayOfWeekNames`, `format`, `toIso8601`)
- `getDayPeriodNames(): readonly [string, string]` (#370) — **not abstract**, so a custom subclass still compiles: the base implementation reads `Intl.DateTimeFormat(locale(), { hour: 'numeric', hour12: true })`'s `dayPeriod` part at 10:00 and 15:00 (`['AM', 'PM']` for `en-US`, `['am', 'pm']` for `en-GB`, `['午前', '午後']` for `ja`) and falls back to `['AM', 'PM']` for an invalid locale or an engine without the part. Override it for a calendar whose day periods `Intl` does not name. Used by `mlv-time-picker`.
- `locale` is a `WritableSignal<string>` read by every formatting method
- time-of-day (added 2026-09 for `@malva-ui/scheduler`) — abstract: `getHours` (0–23), `getMinutes` (0–59), `createDateTime(year, month, day, hours, minutes)` (throws on out-of-range fields), `addMinutes` (elapsed minutes, negative allowed), `differenceInMinutes(first, second)` (`first − second`, truncated toward zero), `now()` (the current date-time in the adapter's zone — the single clock seam, so no component constructs a `Date`); inherited helpers: `withTime` (same calendar day, new time), `startOfDay` (implemented as `withTime(date, 0, 0)`, so an adapter whose `createDate` keeps a time component still gets a real midnight), `minutesOfDay` (0–1439), `shiftDays` (calendar days, keeps the wall-clock time), `compareDateTime` (day, then minute; seconds ignored), `sameDateTime`

Components consume the contract through `inject(MLV_DATE_ADAPTER, { optional: true }) ?? inject(MlvNativeDateAdapter)`.

### `MlvNativeDateAdapter`

**File:** `libs/core/date/src/lib/native-date-adapter.ts`

Default adapter. Native `Date` for date math (dates are normalized to local midnight by `clone` / `addCalendar*`), `Intl.DateTimeFormat` for month names, weekday names and accessible labels. `createDate` throws on an out-of-range month or day. Time-of-day: `addMinutes` uses `getTime()` deltas (real elapsed time across DST); `createDateTime` / `withTime` use wall-clock setters and resolve a non-existent spring-forward time the way the browser does; `now()` returns `new Date()`.

**Locale follows the language pack (#306).** `locale` is a `linkedSignal` over `MLV_LOCALE`; the adapter is **following** or **pinned**, held as state (`_pinned`), never inferred by comparing values:

- **Following** — `MLV_DATE_LOCALE` not provided. Reports `MLV_LOCALE`, takes over every switch; `computed()`s over `format()` / `get*Label()` re-format on `switchLanguage()`. Holds even when the default's snapshot predates the pack.
- **Pinned** — `MLV_DATE_LOCALE` provided (directly or `provideMlvDateAdapter(A, locale)`), **any value, the pack's current one included**; or `setLocale()` with a value ≠ `MLV_LOCALE`. Kept across **every** switch, including one passing through it. `setLocale(<current MLV_LOCALE>)` → following again.
- Provenance, not value: `MLV_DATE_LOCALE`'s default factory (`mlvDateLocaleDefault`) writes the private root `MLV_DATE_LOCALE_DEFAULT_RECORD`; a provided token never runs it, so `record.resolved !== injected value` ⇒ provided. Residual: a **child-injector** provision equal to what the root default already resolved reads as defaulted → follows. Provide it where the adapter is provided.
- Review #306 F1 specs pin both old value-comparison failures: explicit `'de'` in a `de` app; pin released by a switch passing through it.
- Custom `MlvDateAdapter` subclasses keep the base `signal('en-US')` + `setLocale()`; they do not follow `MLV_LOCALE` unless they read it themselves.
- No constructor `setLocale()` any more: the first value is settled by the `linkedSignal` computation.

### Provider tokens

- `MLV_DATE_ADAPTER` — injects the active adapter instance
- `MLV_DATE_LOCALE` — provides the app-level locale string; providing it (any value) **pins** the native adapter across language switches — omit it to follow the pack (read `MLV_LOCALE` for the live app locale)
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

## Documentation surface

- `.claude/projects/libs-date.md` (this file, symlinked as `libs/core/date/CLAUDE.md`) is what `scripts/generate-ai-docs.mjs` publishes for the `@malva-ui/core/date` entry point.
- `docs/migrations/2026-09-core-date.md` covers the move out of `@malva-ui/core/calendar` and the six new abstract time-of-day members.
- The docs site has a **Date Adapter** page (`apps/docs/src/app/pages/date`, route `/date`, Utilities group). It carries the narrative plus the generated API tab: the tab is extracted from a page's library barrel, so without a page mapping to `libs/core/date` these symbols would be absent from the site entirely. `provideMlvDateAdapter` is documented in the page prose because the extractor emits classes, interfaces, types and `InjectionToken`s, not plain functions.

## Testing

`yarn nx run core-date:test` — `libs/core/date/src/lib/date-adapter.spec.ts` covers the provider helper (including that omitting the `locale` argument leaves an application-provided `MLV_DATE_LOCALE` untouched), `createDate` validation, `isValid`, and (from 2026-09) the time-of-day contract plus its DST behaviour. `date-locale.spec.ts` (#306) pins the `MLV_DATE_LOCALE` default (pack → `LOCALE_ID`, `navigator.language` ignored) and the adapter's follow / pin rules, including a default snapshotted before the pack loaded.

The suite runs in a **pinned timezone**: `libs/core/date/vite.config.mts` sets `process.env.TZ = 'Europe/Berlin'` in the config module, so every pooled worker inherits the zone before its first `Date`/`Intl` call caches it (`test.env.TZ` is applied too late to reach ICU). Europe/Berlin springs forward on 2026-03-29 (02:00 → 03:00) and falls back on 2026-10-25 (03:00 → 02:00); the DST cases assert that `addMinutes` / `differenceInMinutes` count **elapsed** minutes across both transitions while `withTime` / `startOfDay` / `minutesOfDay` stay on the **wall clock**, and one guard case asserts the resolved zone so an ineffective pin fails loudly instead of silently testing UTC.
