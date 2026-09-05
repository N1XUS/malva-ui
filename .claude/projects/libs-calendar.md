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
| `MlvCalendarSheet` | Component | Full-screen mobile calendar layout — selector `mlv-calendar-sheet` |
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

| Name              | Type                             | Default   | Description                                                                                                                                        |
| ----------------- | -------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `min`             | `D \| null`                      | `null`    | Minimum selectable date                                                                                                                            |
| `max`             | `D \| null`                      | `null`    | Maximum selectable date                                                                                                                            |
| `disabledDates`   | `((date: D) => boolean) \| null` | `null`    | Custom callback; return `true` to disable a date                                                                                                   |
| `startView`       | `MlvCalendarView`                | `'month'` | Initial view when rendered                                                                                                                         |
| `firstDayOfWeek`  | `number`                         | `1`       | First day of the week (0 = Sunday, 1 = Monday)                                                                                                     |
| `range`           | `boolean`                        | `false`   | Enables range selection mode backed by `rangeValue`                                                                                                |
| `followSelection` | `boolean`                        | `true`    | Whether `activeDate` re-anchors on the current selection. Set `false` when a parent coordinates `activeDate` across several calendars — see below. |

#### `followSelection` — who owns `activeDate`

By default a calendar keeps its own view on whatever is selected: two
constructor effects re-anchor `activeDate` on `value` (single mode) or on
`rangeValue.end ?? rangeValue.start` (range mode). That is right for a calendar
that owns its view, and it is what `mlv-day-picker` and a standalone
`mlv-calendar` rely on.

It is wrong as soon as **one selection drives more than one calendar**.
`mlv-date-range-picker` hands both of its panels the same `rangeValue`, so both
effects resolve the same anchor and both panels snap to the same month —
overwriting whatever the parent bound to `activeDate`, because a one-way
binding only re-writes the model when its own expression changes.

`[followSelection]="false"` gates both effects. The calendar then paints only
what the parent binds, while `navigatePrev()` / `navigateNext()`, keyboard
navigation and view switching keep working normally — the input suppresses
re-anchoring, not navigation. A parent that sets it takes on the job of moving
`activeDate` when the selection changes.

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
  - **The band stops at the month's own days.** `--in-range`, `--range-preview`, `--range-complete` and the two week-row caps go through `_isCellInRange(day)`, which is `day.currentMonth && isInDisplayRange(day.date)`. A range spilling past a month boundary used to repaint a fragment of itself across the neighbour's outside days — a band the neighbouring month's grid already draws, floating in a month it has nothing to do with. The caps follow the painted run rather than the raw row edge, so removing that fill never leaves the band with a squared edge butting into an unpainted cell.
  - **Point markers are not guarded.** `--range-start`, `--range-end`, `--selected` and the `primary` variant mark one real, visible, clickable date rather than an interval, so an outside day that is an endpoint still renders as a primary circle — the same thing `--selected` has always done for a single selection shown from the neighbouring month. Outside days stay selectable; clicking one selects that date and moves `activeDate` onto it, so the grid navigates to the month that owns it.
  - **`aria-selected` reports what the cell paints** (`_cellSelected(day)`), so the accessibility tree and the grid never disagree: an outside cell announces itself as selected only when it is a committed endpoint (or, in single mode, the selected date); the month that owns the date reports the rest of the band. Preview endpoints never report as selected.
- **Year view** (`@if currentView === 'year'`): `role="group"` (labelled) containing a 4-column grid of 12 circular `mlvButton` month selectors (plain buttons, no `role` override), disabled when a month contains no selectable date within min/max and custom disabled-date rules. `aria-pressed` + roving `[attr.tabindex]` mark the current month.
- **Multi-year view** (`@if currentView === 'multi-year'`): `role="group"` containing a 4-column grid of 24 `mlvButton` year selectors with the same availability rules, `aria-pressed`, and roving `[attr.tabindex]`.

All month labels, weekday labels, year labels, header labels, and day ARIA labels come from the active `MlvDateAdapter` rather than hardcoded native `Date` calls.

#### Styles Summary (`calendar.scss`)

- Host surface uses shared Malva UI tokens directly (`--mlv-elevation-bg-2`, `--mlv-border-subtle`, `--mlv-shadow-1`) rather than component-scoped alias variables for static values
- Header is a raised neutral panel containing compact transparent Malva UI buttons and a faded title wrapper for long localized labels
- Day cells use circular Malva UI buttons; selected states use the `primary` variant, idle states use `transparent`, adjacent-month days are dimmed, and today uses the shared focus border token
- Range cells remove the column gap and expand to the full grid track: previews use pale accent interiors with primary endpoints, while completed ranges use a continuous primary background. Logical inline radii cap only range endpoints and the ends of the band's painted run within a week row, including right-to-left layouts. `mlv-calendar-sheet` uses the same two cap classes with the same radii, and resolves its endpoints to the same four logical corners by its own route; `calendar-sheet-styles.spec.ts` compares the two stylesheets on both counts so they cannot drift apart.
- Month selection buttons are fixed-size circular controls so localized short month labels do not turn into oval buttons
- Year selection buttons remain full-width within the 4-column grid and disable unavailable periods instead of allowing navigation into dead ranges

---

### `MlvCalendarSheet`

**File:** `libs/core/calendar/src/lib/calendar-sheet/calendar-sheet.ts`

- **Selector:** `mlv-calendar-sheet`
- **Change Detection:** `OnPush`
- **Encapsulation:** `None`
- **Template:** `libs/core/calendar/src/lib/calendar-sheet/calendar-sheet.html`
- **Styles:** `libs/core/calendar/src/lib/calendar-sheet/calendar-sheet.scss`

The mobile counterpart to `MlvCalendar`: a horizontal year strip, a fixed
weekday header and **one continuous vertical scroll of consecutive months**. It
is a **body only** — `mlv-popup` owns the surface, header, close button, focus
trap and scroll lock, and the host owns the confirm action. Added at #130 for
`mlv-day-picker` and `mlv-date-range-picker`; it is not a drop-in replacement
for `mlv-calendar` and has no view modes, no `‹` / `›` month navigation and no
card chrome.

Selection is **pending by construction**: writing `value` / `rangeValue` closes
nothing and commits nothing, so a host seeds it on open, commits it on `Done`
and drops it on dismiss.

#### Models (two-way binding)

| Name         | Type                                      | Default | Description                                           |
| ------------ | ----------------------------------------- | ------- | ----------------------------------------------------- |
| `value`      | `Model<D \| null>`                        | `null`  | The pending single-date selection                     |
| `rangeValue` | `Model<MlvCalendarRangeValue<D> \| null>` | `null`  | The pending range selection; used when `range` is set |

#### Inputs

| Name             | Type                             | Default | Description                                                                              |
| ---------------- | -------------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| `range`          | `boolean`                        | `false` | Range selection mode, driving `rangeValue` instead of `value`                            |
| `min`            | `D \| null`                      | `null`  | Minimum selectable date; also clamps how far back the month list can extend              |
| `max`            | `D \| null`                      | `null`  | Maximum selectable date; also clamps how far forward the month list can extend           |
| `disabledDates`  | `((date: D) => boolean) \| null` | `null`  | Custom predicate; return `true` to disable a date                                        |
| `firstDayOfWeek` | `number`                         | `1`     | First day of the week (0 = Sunday)                                                       |
| `windowMonths`   | `number`                         | `12`    | Half-extent, in months, of the window seeded around the selection — see _Bounded window_ |
| `maxMonths`      | `number`                         | `121`   | Ceiling on rendered month sections; growth stops here — see _Bounded window_             |
| `yearRange`      | `number`                         | `50`    | Half-extent, in years, of the year strip when `min` / `max` do not bound it              |

#### Methods

| Name               | Description                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `focusActiveDay()` | Moves keyboard focus to the grid's single roving tab stop, the way `mlv-calendar` hands focus to its own active day cell |

#### Bounded window, not virtualisation

The list is a **bounded window**, deliberately: it starts at `2 * windowMonths + 1`
sections around the anchor month (the pending selection, else today) and grows by
another `windowMonths` whenever the user scrolls within `96px` of either end.
Nothing is recycled and no viewport measurement decides what exists, so there is
no virtual-scroll bookkeeping to get wrong. Prepending compensates the scroll
offset by exactly the height it added, and the scroller carries
`overflow-anchor: none` so the browser's own scroll anchoring cannot
double-count the same insertion.

Three things stop the window growing, and the third is the one that always
applies:

- `min` / `max`, when set — growth never crosses either bound.
- `maxMonths` (default `121`, ten years of sections) — a hard ceiling on
  **scroll-driven** growth. `min` and `max` are both optional, so on an
  unrestricted picker they bound nothing, and every growth rebuilds the whole
  month array: the cost of the next growth climbs with the sections already
  rendered. Growth simply stops at the ceiling. Long-distance navigation is the
  year strip's job — scrubbing **reseeds** the window around its target rather
  than extending it, so the ceiling never puts a date out of reach.
  `_ensureMonthInWindow`, which the keyboard caret uses, is deliberately exempt:
  a caret outside the rendered list has nothing to focus, and stranding it would
  be worse than the sections it costs.
- An in-flight scroll of the sheet's own — a scrub's smooth scroll, or a growth
  whose sections have not rendered yet. Growing during the former would write
  `scrollTop` to compensate a prepend, which per CSSOM-View cancels the
  animation and strands the list away from the year the strip now shows. Growing
  during the latter would grow again on every `scroll` event of the same fling,
  since each still reads the pre-growth `scrollHeight`, so one fling would add
  several chunks.

#### Two-way scroll coupling

The year strip (`mlv-scrubber`, `orientation="horizontal"` — #130 is its first
horizontal consumer) and the month list drive each other:

- **List → strip.** A settled scroll (150ms after the last `scroll` event,
  matching the drum's own debounce) points the strip at the month sitting at the
  top of the viewport. The listener is registered outside the Angular zone, for
  the same reason `mlv-scrubber` does it: a `(scroll)` binding runs the
  dirty-marking wrapper at momentum-scroll frequency and this handler writes
  nothing reactive on most events.
- **Strip → list.** Scrubbing a year re-seats the window if needed and scrolls
  the list to that January.
- **No echo.** A scrub arms a flag that suppresses the next settle, released on
  a 500ms ceiling in case the requested scroll never moves the offset (a smooth
  scroll that is already there produces no `scroll` event). Edge extension
  deliberately does **not** arm it: its offset compensation holds the visible
  month still, so the year the next settle derives is the one already showing.
- **Reduced motion** is resolved in TypeScript, not left to CSS: per CSSOM-View
  an explicit `behavior` passed to `scrollTo()` overrides the computed
  `scroll-behavior`, so the stylesheet's reduced-motion rule alone would not stop
  the animation.

The `min` / `max` bound is enforced **twice** and deliberately: `_clampedWindow`
clamps what is rendered, and `_maybeExtendWindow` refuses to grow past the bound
in the first place. Either alone keeps the rendered months inside the bound, so
the specs pin the rendered result rather than one of the two lines — dropping
one is invisible to them, dropping both is not.

#### Semantics and keyboard

Each month section is a real `role="grid"` labelled by its own `<h3>` month
heading, with a visually-hidden `role="row"` of seven `role="columnheader"`
cells (the visible weekday strip is fixed above every grid, so it belongs to no
single one and is `aria-hidden`). The scroller wrapping the sections is a
`role="group"` — `aria-label` is not exposed on a generic element, so the
`monthList` string would otherwise name nothing. Day cells are `role="gridcell"` carrying
`aria-selected`; the selectable ones hold a `<button>` with the adapter's date
label, `aria-current="date"` on today, and a **single roving `tabindex="0"`**
across the whole list.

Arrow keys move by day and week, `PageUp` / `PageDown` by month, `Home` / `End`
to the ends of the current month, and `Enter` / `Space` select — all **continuous
across month boundaries**: the window grows to cover wherever the caret lands and
only `min` / `max` stop it — the `maxMonths` ceiling bounds scrolling, not the
caret, which must always have a cell to focus. Horizontal arrows go through
`MlvRtlService.normalizeArrowKey()`, so they mirror in RTL while the vertical
pair, `Home` and `End` do not.

#### Range highlighting

A range paints continuously across a section boundary, not just within a month:
a month whose opening boundary the range crosses paints its own label
(`__month-label--in-range`), so the band does not break at the section header.

What it deliberately does **not** paint is **adjacent-month filler**:
`__cell--adjacent` never takes `__cell--in-range` or a week-row cap, and reports
no `aria-selected` at all. Filler stands for days the neighbouring month's own
grid already renders, and a grid stamps a day button only for its own month — so
a fill there is a band with nothing under it, repeating the previous month's tail
as a detached shape inside the next month's grid. The label modifier is what
carries the band over the boundary.

The band is capped where it breaks: `__cell--range-row-start` /
`--range-row-end` take the logical `border-start-start-radius` /
`border-end-end-radius` family, so the caps mirror in RTL for free. "Where it
breaks" is the painted run inside the week row — the row's first and last cell
for a row lying wholly inside the month, and the first/last cell either side of
the filler otherwise, so the guard above never leaves the band with a squared
edge butting into a blank cell.

`mlv-calendar` does the same thing, class for class and radius for radius: it
guards its own outside days out of the band, caps the painted run, and keeps the
endpoint markers. The one difference is what an excluded cell still shows — the
sheet renders nothing in filler, while `mlv-calendar`'s outside days carry a
real, clickable day number and therefore keep `--range-start` / `--range-end`
and `--selected`. `calendar-sheet-styles.spec.ts` compares the two stylesheets'
cap radii so they cannot drift apart.

##### The endpoints are the band's caps, not circles inside it

`__day--range-start` / `--range-end` drop `max-width` and lose the radius on the
side facing into the range, so the endpoint fills its cell and the accent runs
straight into the pale fill — one unbroken pill, the shape `mlv-calendar` gets
from `__day--in-range`. Widening is not optional: the cell is wider than the
2.75rem circle at every phone width, so squaring one side of a still-inset
circle would move the seam a few pixels rather than close it.

Where the two surfaces differ is only the route, because the band is painted on
`__cell` here and on `__day` there. The one consequence is the **row edge**: on
`mlv-calendar` the day carries the row caps itself and rounds back, while here
the cap reads the cell's cap through
`__cell--range-row-end __day--range-start` (and its mirror). An endpoint that is
also where the row's painted run stops has no band on the flat side — it wraps
to the next row, and the cell rounds there — so it rounds back into a full pill.
Left square it would paint its corner over the cell's rounded one and the row
would read sheared, which is the defect the row caps exist to prevent.

The other states fall out of the same two rules: a **one-day range** is its own
start and end, so both flattenings apply and cancel back to a circle; a lone
`__day--selected` never enters these rules at all and keeps its 2.75rem inset
circle, which is the only shape the `mlv-day-picker` sheet ever shows. The
endpoints are read from the normalised `_displayRange()`, so a backwards-stored
pair still flattens towards the days in between.

#### SCSS / BEM

Block: `mlv-calendar-sheet`

| Class                                                            | Description                                                                |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `.mlv-calendar-sheet`                                            | Host; a three-region flex column                                           |
| `.mlv-calendar-sheet__years`                                     | Year-strip region wrapping `mlv-scrubber`                                  |
| `.mlv-calendar-sheet__weekdays`                                  | Fixed weekday header (decorative, `aria-hidden`)                           |
| `.mlv-calendar-sheet__weekday`                                   | One weekday abbreviation                                                   |
| `.mlv-calendar-sheet__months`                                    | The scrolling month list; the only scroller. `role="group"`, labelled      |
| `.mlv-calendar-sheet__month`                                     | One month `<section>`                                                      |
| `.mlv-calendar-sheet__month-label`                               | The month heading                                                          |
| `.mlv-calendar-sheet__month-label--in-range`                     | Heading a range crosses, so the band does not break at the section rule    |
| `.mlv-calendar-sheet__columnheaders`                             | Visually-hidden `role="row"` of column headers                             |
| `.mlv-calendar-sheet__columnheader`                              | One `role="columnheader"` cell                                             |
| `.mlv-calendar-sheet__week`                                      | One `role="row"` of seven cells                                            |
| `.mlv-calendar-sheet__cell`                                      | One `role="gridcell"`                                                      |
| `.mlv-calendar-sheet__cell--adjacent`                            | Filler cell from the previous/next month (no button, never in range)       |
| `.mlv-calendar-sheet__cell--in-range`                            | Current-month cell inside the painted range                                |
| `.mlv-calendar-sheet__cell--range-row-start` / `--range-row-end` | Logical inline caps where the band's painted run starts/ends in a week row |
| `.mlv-calendar-sheet__day`                                       | The selectable day button                                                  |
| `.mlv-calendar-sheet__day--selected`                             | The pending single selection                                               |
| `.mlv-calendar-sheet__day--today`                                | Today                                                                      |
| `.mlv-calendar-sheet__day--range-start` / `--range-end`          | The range's endpoints; fill the cell and flatten the side facing the range |

The host declares `height: 100%` as its standalone default; a consumer that
places it in a flex column (both pickers do) hands it `flex: 1 1 0; min-height: 0`
instead — see `libs-day-picker.md` / `libs-date-range-picker.md`.

#### Specs

- `calendar-sheet.spec.ts` — window seeding and clamping, pending selection,
  cross-boundary range painting, which cells carry the endpoint markers
  (including a one-day and a backwards-stored range, and a lone selection
  carrying none), keyboard model, grid semantics, adapter-driven localisation
- `calendar-sheet-scroll.spec.ts` — the two coupled scroll surfaces, plus the
  keyboard's scroll-into-view and the reduced-motion `behavior`. jsdom has no
  layout, so `offsetTop` / `offsetHeight` / `clientHeight` / `scrollHeight` /
  `scrollTo` are stubbed the way `scrubber.spec.ts` stubs the drum's metrics
  (day buttons included, so a caret leaving the viewport is measurable), every
  scroll is a **native** `scroll` event dispatched at the element that really
  scrolls, so the listener wiring is under test and not just the handler body,
  and `scrollTo()` calls are recorded rather than dropped
- `calendar-sheet-rtl.spec.ts` — mirrored horizontal arrows, unchanged vertical /
  `Home` / `End`, unchanged logical DOM order, and a scoped `[dir]` on an
  ancestor with the document still LTR
- `calendar-sheet-styles.spec.ts` — compiled-CSS assertions that jsdom cannot
  make from a rendered sheet (scroll anchoring, the flex column, reduced
  motion), plus two parity checks against `calendar.scss`, which it compiles
  alongside the sheet's own. The **week-row caps** are compared rule for rule:
  the `--range-row-start` / `--range-row-end` radii must be identical. The
  **endpoint shape** is compared as a resolved result instead — a small resolver
  walks every class rule a given element (and its cell) matches, in source
  order, and reduces the `border-radius` shorthand and long-hands to four
  logical corners. That is what makes the two surfaces comparable at all: they
  square the inward side by different routes, and only the painted corners are
  the same thing. It covers the mid-row endpoint, the endpoint that is also a
  row edge, the one-day range and the lone `--selected` day

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

Strings resolve through `MLV_CALENDAR_I18N` (`@malva-ui/i18n`): `previousPeriod`, `nextPeriod`, plus two ICU strings resolved via `MlvI18nResolverService` — `switchView` (`"Switch to {view, select, year {year} multiYear {multi-year} other {month}} view"`, exposed as the `_switchViewLabel` computed) and `selectMonthForYear` (`"Select month for {year}"`, used by `getYearViewLabel()`).

`MlvCalendarSheet` adds three plain strings to the same slice: `done` (the visible label of the sheet's confirm action, which both pickers render — it belongs to the sheet they share rather than being duplicated per picker), `selectYear` (the year strip's `aria-label`) and `monthList` (the scrolling month list's `aria-label`). Every month and weekday name comes from the date adapter, never from these packs.

Provide `provideMlvI18nTesting()` in specs.

## Dependencies

- `@angular/core` ^22.0.0 — signals, `computed()`, `model()`, `afterNextRender`, `ElementRef`, `Injector` (roving-focus management)
- `@angular/common` — native control flow
- `@angular/cdk/keycodes` — arrow / page key codes in `MlvCalendarSheet`'s grid keyboard model
- `@malva-ui/core/scrubber` — `mlv-scrubber` as `MlvCalendarSheet`'s horizontal year strip (#130 is the scrubber's first horizontal consumer)
- `@malva-ui/cdk/utils` — `MlvRtlService` for mirroring the sheet's horizontal arrow keys
- `@malva-ui/i18n` — `MLV_CALENDAR_I18N`
