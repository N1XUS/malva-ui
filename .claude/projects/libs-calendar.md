---
# Library: calendar

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The Calendar library (`@malva-ui/core/calendar`) provides a fully accessible, keyboard-navigable date picker component with three view modes: **month**, **year**, and **multi-year**. It supports date constraints (min/max), custom disabled-date logic, single-date and range selection, and adapter-backed localization / date math.

Date math and localized labels go through the `MlvDateAdapter<D>` contract from `@malva-ui/core/date` (moved out of this library in 2026-09 — see [libs-date.md](libs-date.md)); the calendar itself only depends on that abstract surface.

## Public API

Exported from `libs/core/calendar/src/index.ts`:

| Export | Kind | Description |
|--------|------|-------------|
| `MlvCalendar` | Component | The calendar UI — selector `mlv-calendar` |
| `MlvCalendarView` | Type | `'month' \| 'year' \| 'multi-year'` |
| `MlvCalendarRangeValue` | Type | `{ start: D \| null; end: D \| null }` for range mode |

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

| Signal              | Type                              | Description                                                                                               |
| ------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `activeDate`        | `WritableSignal<D>`               | Currently navigated-to date (not necessarily selected)                                                    |
| `currentView`       | `WritableSignal<MlvCalendarView>` | Which view panel is shown                                                                                 |
| `_rangePreviewDate` | `WritableSignal<D \| null>`       | Transient hover/focus endpoint while a range has a start but no committed end; never mutates `rangeValue` |

#### Computed

| Signal              | Type                                         | Description                                                                                             |
| ------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `weekdays`          | `computed<string[]>`                         | Localized weekday labels from the active adapter, rotated by `firstDayOfWeek`                           |
| `monthDays`         | `computed<CalendarDayCell<D>[]>`             | Day cells for month grid, including leading/trailing adjacent-period dates to fill each week row        |
| `monthWeeks`        | `computed<CalendarDayCell<D>[][]>`           | `monthDays` grouped into week rows (chunks of 7) so the template can render each week as a `role="row"` |
| `years`             | `computed<number[]>`                         | 24 years shown in multi-year view                                                                       |
| `headerLabel`       | `computed<string>`                           | Localized display text for the header button                                                            |
| `_displayRange`     | `computed<MlvCalendarRangeValue<D> \| null>` | Chronologically normalized committed range, or the start-to-preview interval while choosing an end date |
| `isRangePreviewing` | `computed<boolean>`                          | Whether the calendar is displaying a transient range preview                                            |
| `hasCompletedRange` | `computed<boolean>`                          | Whether both committed range endpoints are present                                                      |

#### Methods

| Method                | Signature                      | Description                                                                                                                                                                                        |
| --------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `navigatePrev`        | `(): void`                     | Go to previous month / year / multi-year block while preserving free navigation in range mode                                                                                                      |
| `navigateNext`        | `(): void`                     | Go to next month / year / multi-year block while preserving free navigation in range mode                                                                                                          |
| `switchView`          | `(): void`                     | Cycle: month → year → multi-year → month                                                                                                                                                           |
| `selectDate`          | `(date: D): void`              | Select a date; no-op if disabled                                                                                                                                                                   |
| `selectMonth`         | `(month: number): void`        | Select month (0–11), switches to month view                                                                                                                                                        |
| `selectYear`          | `(year: number): void`         | Select year, switches to year view                                                                                                                                                                 |
| `isDateDisabled`      | `(date: D): boolean`           | Check min/max/disabledDates                                                                                                                                                                        |
| `isToday`             | `(date: D): boolean`           | Check if date is today                                                                                                                                                                             |
| `isSelected`          | `(date: D): boolean`           | Check if date matches `value`                                                                                                                                                                      |
| `isDisplayRangeStart` | `(date: D): boolean`           | Check whether a date is the chronological start of the committed or previewed display range                                                                                                        |
| `isDisplayRangeEnd`   | `(date: D): boolean`           | Check whether a date is the chronological end of the committed or previewed display range                                                                                                          |
| `isInDisplayRange`    | `(date: D): boolean`           | Check whether a date belongs to the committed or previewed display range                                                                                                                           |
| `previewRange`        | `(date: D): void`              | Preview a valid end date from the current start during hover or keyboard focus without committing the range                                                                                        |
| `clearRangePreview`   | `(): void`                     | Clear the transient preview when focus or pointer leaves the date grid                                                                                                                             |
| `onKeydown`           | `(event: KeyboardEvent): void` | Keyboard navigation handler                                                                                                                                                                        |
| `focus`               | `(): void`                     | Focuses the active cell (the roving `tabindex="0"` day/month/year button). Public entry point for popup hosts (`mlv-day-picker`, `mlv-date-range-picker`) that want focus to land inside the grid. |

#### Host Bindings

```ts
host: {
  'class': 'mlv-calendar',
  '(keydown)': 'onKeydown($event)',
  // NOTE: the host is intentionally NOT focusable (no tabindex). Focus is
  // owned by the active grid cell via the roving-tabindex pattern.
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
- **Month view** (`@if currentView === 'month'`): valid `role="grid"` structure
  - Weekday header row — `role="row"` containing `role="columnheader"` cells
  - `div.mlv-calendar__days` is a `role="rowgroup"` holding one `div.mlv-calendar__week` per week (`role="row"`). Each week is grouped from `monthWeeks()` (chunks of 7 from `monthDays()`) and uses `display: contents` in CSS so its day cells still participate in the parent 7-column grid.
  - Each day cell wrapper is a `role="gridcell"` (carrying `[attr.aria-selected]`) that contains a circular `button[mlvButton]`. The **button keeps native button semantics** (no `role="gridcell"` override) and carries the roving `[attr.tabindex]` (`0` for the active date, `-1` otherwise).
  - Leading/trailing days from adjacent months are shown when needed to complete the week rows and are visually dimmed
  - Single-date selection uses the `primary` button variant. An unfinished range previews the hovered/focused endpoint and every date between it and the selected start with directional caps; a committed range becomes one seamless primary-colored band.
  - Range endpoints are normalized chronologically, so hovering before the selected start swaps that anchor to the trailing cap. Week-row boundaries receive their own visual caps without changing the selected values.
- **Year view** (`@if currentView === 'year'`): `role="group"` (labelled) containing a 4-column grid of 12 circular `mlvButton` month selectors (plain buttons, no `role` override), disabled when a month contains no selectable date within min/max and custom disabled-date rules. `aria-pressed` + roving `[attr.tabindex]` mark the current month.
- **Multi-year view** (`@if currentView === 'multi-year'`): `role="group"` containing a 4-column grid of 24 `mlvButton` year selectors with the same availability rules, `aria-pressed`, and roving `[attr.tabindex]`.

All month labels, weekday labels, year labels, header labels, and day ARIA labels come from the active `MlvDateAdapter` rather than hardcoded native `Date` calls.

#### Styles Summary (`calendar.scss`)

- Host surface uses shared Malva UI tokens directly (`--mlv-elevation-bg-2`, `--mlv-border-subtle`, `--mlv-shadow-1`) rather than component-scoped alias variables for static values
- Header is a raised neutral panel containing compact transparent Malva UI buttons and a faded title wrapper for long localized labels
- Day cells use circular Malva UI buttons; selected states use the `primary` variant, idle states use `transparent`, adjacent-month days are dimmed, and today uses the shared focus border token
- Range cells remove the column gap and expand to the full grid track: previews use pale accent interiors with primary endpoints, while completed ranges use a continuous primary background. Logical inline radii cap only range and week-row boundaries, including right-to-left layouts.
- Month selection buttons are fixed-size circular controls so localized short month labels do not turn into oval buttons
- Year selection buttons remain full-width within the 4-column grid and disable unavailable periods instead of allowing navigation into dead ranges

---

## Directives

None.

## Services

None owned here. The date adapter (`MlvDateAdapter<D>`, `MlvNativeDateAdapter`, `MLV_DATE_ADAPTER`, `MLV_DATE_LOCALE`, `provideMlvDateAdapter`) lives in `@malva-ui/core/date` — see [libs-date.md](libs-date.md).

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
import { MlvNativeDateAdapter, provideMlvDateAdapter } from '@malva-ui/core/date';

bootstrapApplication(AppComponent, {
  providers: [...provideMlvDateAdapter(MlvNativeDateAdapter, 'ro-RO')],
});
```

---

## Accessibility Notes

- **Roving tabindex** (single tab stop per view): the host is **not** focusable. Exactly one grid cell button carries `tabindex="0"` (the active day / current month / current year); all others are `tabindex="-1"`. This replaces the previous model where the host was `tabindex="0"` and every day button was natively tabbable (~35 tab stops).
- **Focus follows the active cell**: after arrow / Page / Home / End navigation changes `activeDate`, focus is moved to the newly-active cell via `afterNextRender` (scheduled only from the keyboard handlers, so programmatic `activeDate` changes never steal focus). Focus follows across month/year boundaries.
- **`focus()` entry point**: consumers embedding the calendar in a popup can call `MlvCalendar.focus()` to move focus into the grid; it targets the roving `tabindex="0"` cell.
- Full arrow-key navigation in month, year, and multi-year views; `Enter`/`Space` selects; `PageUp`/`PageDown` change month; `Home`/`End` jump to first/last.
- Valid ARIA grid semantics for the month view: `role="grid"` → `role="row"` (weekday header + one `role="rowgroup"` of week `role="row"`s) → `role="gridcell"` (carrying `aria-selected`) → native `button`.
- Year / multi-year selection grids are labelled `role="group"`s of plain buttons (no `role="listitem"` — the previous `aria-pressed` + `role="listitem"` combo was invalid); the current option is indicated with `aria-pressed` and the roving `tabindex`.
- Day buttons carry `aria-disabled`, `aria-current="date"` for today, and localized `aria-label` attributes generated by the active adapter.
- Range previews follow both pointer hover and keyboard focus. Because the preview is transient, `aria-selected` continues to describe only committed values until the user selects the second endpoint.
- Header and month-selection labels use `mlvFade` where needed to avoid truncation breaking layout.

---

## Internationalization (i18n)

Strings resolve through `MLV_CALENDAR_I18N` (`@malva-ui/i18n`): `previousPeriod`, `nextPeriod`, plus two ICU strings resolved via `MlvI18nResolverService` — `switchView` (`"Switch to {view, select, year {year} multiYear {multi-year} other {month}} view"`, exposed as the `_switchViewLabel` computed) and `selectMonthForYear` (`"Select month for {year}"`, used by `getYearViewLabel()`). Provide `provideMlvI18nTesting()` in specs.

## Dependencies

- `@angular/core` ^22.0.0 — signals, `computed()`, `model()`, `afterNextRender`, `ElementRef`, `Injector` (roving-focus management)
- `@angular/common` — native control flow
- `@malva-ui/core/date` — `MLV_DATE_ADAPTER`, `MlvNativeDateAdapter`, `MlvDateAdapter`, `MlvDateFormatOptions` (the adapter contract, moved out of this library in 2026-09)
