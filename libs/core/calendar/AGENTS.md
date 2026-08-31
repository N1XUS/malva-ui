---
# Library: calendar

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Calendar library (`@malva-ui/core/calendar`) provides a fully accessible, keyboard-navigable date picker component with three view modes: **month**, **year**, and **multi-year**. It supports date constraints (min/max), custom disabled-date logic, single-date and range selection, and adapter-backed localization / date math.

It also defines the shared Malva UI date-adapter contract used to abstract date math, localized labels, and formatting away from the native `Date` object. Applications can provide their own adapter implementation for libraries such as Luxon, Moment, or date-fns-based wrappers.

## Public API

Exported from `libs/forms/calendar/src/index.ts`:

| Export | Kind | Description |
|--------|------|-------------|
| `MlvCalendar` | Component | The calendar UI — selector `mlv-calendar` |
| `MlvCalendarView` | Type | `'month' \| 'year' \| 'multi-year'` |
| `MlvCalendarRangeValue` | Type | `{ start: D \| null; end: D \| null }` for range mode |
| `MlvDateAdapter` | Abstract class | Date manipulation and localization contract for calendar-aware components |
| `MLV_DATE_ADAPTER` | InjectionToken | App-level token for providing a custom `MlvDateAdapter` implementation |
| `MLV_DATE_LOCALE` | InjectionToken | App-level locale token consumed by date adapters |
| `MlvNativeDateAdapter` | Service | Default adapter built on native `Date` and `Intl.DateTimeFormat` |
| `provideMlvDateAdapter` | Provider helper | Registers a custom adapter class and optional locale for the app |

---

## Components

### `MlvCalendar`

**File:** `libs/forms/calendar/src/lib/calendar/calendar.ts`

- **Selector:** `mlv-calendar`
- **Change Detection:** `OnPush`
- **Template:** `libs/forms/calendar/src/lib/calendar/calendar.html`
- **Styles:** `libs/forms/calendar/src/lib/calendar/calendar.scss`

#### Model (two-way binding)

| Name         | Type                                      | Default | Description                                                       |
| ------------ | ----------------------------------------- | ------- | ----------------------------------------------------------------- |
| `value`      | `Model<D \| null>`                        | `null`  | The currently selected date object produced by the active adapter |
| `rangeValue` | `Model<MlvCalendarRangeValue<D> \| null>` | `null`  | Selected range when range mode is enabled                         |

#### Inputs

| Name             | Type                             | Default   | Description                                         |
| ---------------- | -------------------------------- | --------- | --------------------------------------------------- |
| `min`            | `D \| null`                      | `null`    | Minimum selectable date                             |
| `max`            | `D \| null`                      | `null`    | Maximum selectable date                             |
| `disabledDates`  | `((date: D) => boolean) \| null` | `null`    | Custom callback; return `true` to disable a date    |
| `startView`      | `MlvCalendarView`                | `'month'` | Initial view when rendered                          |
| `firstDayOfWeek` | `number`                         | `1`       | First day of the week (0 = Sunday, 1 = Monday)      |
| `range`          | `boolean`                        | `false`   | Enables range selection mode backed by `rangeValue` |

#### Internal State

| Signal        | Type                              | Description                                            |
| ------------- | --------------------------------- | ------------------------------------------------------ |
| `activeDate`  | `WritableSignal<D>`               | Currently navigated-to date (not necessarily selected) |
| `currentView` | `WritableSignal<MlvCalendarView>` | Which view panel is shown                              |

#### Computed

| Signal        | Type                             | Description                                                                                      |
| ------------- | -------------------------------- | ------------------------------------------------------------------------------------------------ |
| `weekdays`    | `computed<string[]>`             | Localized weekday labels from the active adapter, rotated by `firstDayOfWeek`                    |
| `monthDays`   | `computed<CalendarDayCell<D>[]>` | Day cells for month grid, including leading/trailing adjacent-period dates to fill each week row |
| `years`       | `computed<number[]>`             | 24 years shown in multi-year view                                                                |
| `headerLabel` | `computed<string>`               | Localized display text for the header button                                                     |

#### Methods

| Method           | Signature                      | Description                                                                                   |
| ---------------- | ------------------------------ | --------------------------------------------------------------------------------------------- |
| `navigatePrev`   | `(): void`                     | Go to previous month / year / multi-year block while preserving free navigation in range mode |
| `navigateNext`   | `(): void`                     | Go to next month / year / multi-year block while preserving free navigation in range mode     |
| `switchView`     | `(): void`                     | Cycle: month → year → multi-year → month                                                      |
| `selectDate`     | `(date: D): void`              | Select a date; no-op if disabled                                                              |
| `selectMonth`    | `(month: number): void`        | Select month (0–11), switches to month view                                                   |
| `selectYear`     | `(year: number): void`         | Select year, switches to year view                                                            |
| `isDateDisabled` | `(date: D): boolean`           | Check min/max/disabledDates                                                                   |
| `isToday`        | `(date: D): boolean`           | Check if date is today                                                                        |
| `isSelected`     | `(date: D): boolean`           | Check if date matches `value`                                                                 |
| `onKeydown`      | `(event: KeyboardEvent): void` | Keyboard navigation handler                                                                   |

#### Host Bindings

```ts
host: {
  'class': 'mlv-calendar',
  'tabindex': '0',
  '(keydown)': 'onKeydown($event)',
}
```

#### Keyboard Navigation (month view)

| Key                     | Action                  |
| ----------------------- | ----------------------- |
| `←` / `→`               | Move one day left/right |
| `↑` / `↓`               | Move one week up/down   |
| `Page Up` / `Page Down` | Previous/next month     |
| `Home`                  | First day of month      |
| `End`                   | Last day of month       |
| `Enter` / `Space`       | Select the active date  |

#### Template Structure (`calendar.html`)

- **Header row:** circular prev/next `mlvButton` controls and a central header button wrapped in `mlvFade` so long localized month/year labels do not overflow
- **Month view** (`@if currentView === 'month'`):
  - Weekday header row — `role="row"`, `role="columnheader"`
  - Day grid — every day cell is a circular `button[mlvButton]`
  - Leading/trailing days from adjacent months are shown when needed to complete the week rows and are visually dimmed
  - Single-date selection uses the `primary` button variant; range endpoints also use `primary`, while interior range days use a pale accent treatment
- **Year view** (`@if currentView === 'year'`): 4-column grid of 12 circular `mlvButton` month selectors, disabled when a month contains no selectable date within min/max and custom disabled-date rules
- **Multi-year view** (`@if currentView === 'multi-year'`): 4-column grid of 24 `mlvButton` year selectors with the same availability rules

All month labels, weekday labels, year labels, header labels, and day ARIA labels come from the active `MlvDateAdapter` rather than hardcoded native `Date` calls.

#### Styles Summary (`calendar.scss`)

- Host surface uses shared Malva UI tokens directly (`--mlv-elevation-bg-2`, `--mlv-border-subtle`, `--mlv-shadow-1`) rather than component-scoped alias variables for static values
- Header is a raised neutral panel containing compact transparent Malva UI buttons and a faded title wrapper for long localized labels
- Day cells use circular Malva UI buttons; selected states use the `primary` variant, idle states use `transparent`, adjacent-month days are dimmed, and today uses the shared focus border token
- Month selection buttons are fixed-size circular controls so localized short month labels do not turn into oval buttons
- Year selection buttons remain full-width within the 4-column grid and disable unavailable periods instead of allowing navigation into dead ranges

---

## Directives

None.

## Services

### `MlvNativeDateAdapter`

**File:** `libs/forms/calendar/src/lib/date-provider/native-date-adapter.ts`

Default adapter shipped by the library. Uses native `Date` for date math and `Intl.DateTimeFormat` for localized labels, month names, weekday names, and accessible date strings.

### `MlvDateAdapter<D>`

**File:** `libs/forms/calendar/src/lib/date-provider/date-adapter.ts`

Abstract contract for adapter-backed date operations. Key responsibilities:

- clone / create / validate date instances
- add calendar days, months, and years
- compare dates without relying on native object identity
- produce localized month names, weekday names, and formatted labels
- deserialize unknown values into the adapter’s date type

The calendar component itself only relies on this abstract contract for user-facing labels and calendar arithmetic.

### Provider Tokens

- `MLV_DATE_ADAPTER` — injects the active adapter instance
- `MLV_DATE_LOCALE` — provides the app-level locale string
- `provideMlvDateAdapter(AdapterClass, locale?)` — helper for app configuration

---

## Usage Examples

```html
<!-- Basic -->
<mlv-calendar [(value)]="selectedDate" />

<!-- Constrained range -->
<mlv-calendar [(value)]="selectedDate" [min]="minDate" [max]="maxDate" />

<!-- Custom disabled dates -->
<mlv-calendar [(value)]="selectedDate" [disabledDates]="isWeekend" />

<!-- Start in year view -->
<mlv-calendar [(value)]="selectedDate" startView="year" />

<!-- Sunday as first day -->
<mlv-calendar [(value)]="selectedDate" [firstDayOfWeek]="0" />

<!-- Range mode -->
<mlv-calendar [range]="true" [(rangeValue)]="selectedRange" />
```

```ts
export class MyComponent {
  selectedDate = signal<Date | null>(null);
  selectedRange = signal<MlvCalendarRangeValue<Date> | null>(null);
  minDate = new Date(2020, 0, 1);
  maxDate = new Date(2030, 11, 31);
  isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
}
```

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { MlvNativeDateAdapter, provideMlvDateAdapter } from '@malva-ui/core/calendar';

bootstrapApplication(AppComponent, {
  providers: [...provideMlvDateAdapter(MlvNativeDateAdapter, 'ro-RO')],
});
```

---

## Accessibility Notes

- `tabindex="0"` makes the component keyboard-focusable
- Full arrow-key navigation in month view
- ARIA grid semantics (`role="grid"`, `role="row"`, `role="gridcell"`)
- `aria-selected` and `aria-disabled` on day buttons
- All day buttons have localized `aria-label` attributes generated by the active adapter
- Header and month-selection labels use `mlvFade` where needed to avoid truncation breaking layout

---

## Dependencies

- `@angular/core` ^21.1.0 — signals, `computed()`, `model()`
- `@angular/common` — native control flow
