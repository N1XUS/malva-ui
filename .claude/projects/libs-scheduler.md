---

# Library: scheduler

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever the scheduler's API, behavior, dependencies, styling, or tests change.

## Overview

Month / week / day calendar views (`mlv-scheduler`) for timed, all-day and multi-day events with two-way model binding, pointer (SortableJS) and keyboard drag-move, resize from either edge, range selection, a replaceable toolbar, business hours, a current-time line, density, i18n and RTL.

## Identity

- **Path:** `libs/scheduler`
- **Import path:** `@malva-ui/scheduler` (a standalone published package; **not** re-exported from `@malva-ui/core`)
- **Nx project:** `scheduler` (tags `scope:ui`, `family:scheduler`, `type:ui`)
- **Packaging:** ng-packagr package root, entry `src/index.ts`
- **Peers:** `@malva-ui/core` (date adapter, popup, segmented, button, scrollbar), `@malva-ui/cdk`, `@malva-ui/i18n`, `@angular/cdk`, `@angular/common`, `@angular/core`, `@lucide/angular`
- **Dependencies:** `sortablejs ^1.15.7`, declared by `libs/scheduler/package.json` itself (`libs/core/package.json` declares its own copy; the workspace root carries `sortablejs` + `@types/sortablejs` as **devDependencies**, because `apps/docs`' external-drop example imports SortableJS directly) and allow-listed in `ng-package.json` `allowedNonPeerDependencies`
- **Docs page:** `/scheduler` in `apps/docs` (seven examples), API family `scheduler`

## Public API

`@malva-ui/scheduler` exports the component `MlvScheduler`, the two template-def directives `MlvSchedulerEventDef` and `MlvSchedulerHeaderDef`, and the types in `scheduler.types.ts`: `MlvSchedulerView`, `MlvSchedulerEvent<D, TData>`, `MlvSchedulerChangeSource`, `MlvSchedulerEventChange`, `MlvSchedulerNextRange`, `MlvSchedulerEventInteraction`, `MlvSchedulerSlotEvent`, `MlvSchedulerRangeSelectEvent`, `MlvSchedulerExternalDropEvent`, `MlvSchedulerVisibleRange`, `MlvSchedulerBusinessHours`, `MlvSchedulerCanChange`, `MlvSchedulerHeaderContext`, `MlvSchedulerHeaderApi`, `MlvSchedulerEventContext` and `MlvSchedulerMoreClickEvent`.

Deliberately **not** exported: the drag service and its drop-list directive, the SortableJS class names and the `__mlv-ghost` preview-id helper, the pointer-gesture helper, the layout engine and the month / time-grid / chip view components. They are implementation detail and may change without a migration note.

The i18n token is `MLV_SCHEDULER_I18N`, exported from **`@malva-ui/i18n`** (not from this package) together with `MlvSchedulerI18n`; the scheduler injects it and every locale pack ships the `scheduler` section.

Dates go through the `MlvDateAdapter<D>` from `@malva-ui/core/date` (`MLV_DATE_ADAPTER`, falling back to `MlvNativeDateAdapter`); the scheduler never constructs `Date` objects itself. Timezone conversion is out of scope: events are laid out in the adapter's wall-clock time.

### `MlvScheduler`

Selector `mlv-scheduler`, generic over `<D = Date, TData = unknown>`. Give the host a **bounded block size** (`style="block-size: 36rem"`, a grid/flex track, …) — the views fill the host and scroll inside it, and the month view measures its lanes against the row height it is given.

#### Inputs

| Name                   | Type                                | Default           | Description                                                                                                                                           |
| ---------------------- | ----------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `firstDayOfWeek`       | `number`                            | `1`               | `0` = Sunday … `6` = Saturday.                                                                                                                        |
| `hiddenDays`           | `readonly number[]`                 | `[]`              | Weekdays removed from every view.                                                                                                                     |
| `minTime`              | `string` (`'HH:mm'`)                | `'00:00'`         | First minute of the time axis.                                                                                                                        |
| `maxTime`              | `string` (`'HH:mm'`)                | `'24:00'`         | End of the time axis (exclusive).                                                                                                                     |
| `slotDuration`         | `number` (minutes)                  | `30`              | Row height unit and keyboard step in the time grid.                                                                                                   |
| `snapDuration`         | `number \| undefined`               | `slotDuration`    | Pointer snap for moves and resizes.                                                                                                                   |
| `defaultEventDuration` | `number` (minutes)                  | `60`              | Length of an event dropped onto a time column from the all-day row or from outside.                                                                   |
| `businessHours`        | `MlvSchedulerBusinessHours \| null` | `null`            | Shaded working range (`start`, `end`, optional `days`).                                                                                               |
| `editable`             | `BooleanInput`                      | `true`            | Enables drag-move, resize and their keyboard equivalents.                                                                                             |
| `selectable`           | `BooleanInput`                      | `true`            | Enables pointer / keyboard range selection.                                                                                                           |
| `showCurrentTime`      | `BooleanInput`                      | `true`            | Current-time line in the week / day views, and the month grid's today pill (and its `, today` label suffix).                                          |
| `scrollToCurrentTime`  | `BooleanInput`                      | `false`           | Centres the current time in the week / day viewport on the initial scroll instead of top-aligning the business-hours start.                           |
| `toolbar`              | `BooleanInput`                      | `true`            | Renders the default toolbar (ignored when a header template is projected).                                                                            |
| `canMove`              | `MlvSchedulerCanChange \| null`     | `null`            | Veto hook; return `false` to reject a move.                                                                                                           |
| `canResize`            | `MlvSchedulerCanChange \| null`     | `null`            | Veto hook for resizes.                                                                                                                                |
| `dragGroup`            | `string`                            | `'mlv-scheduler'` | SortableJS group name; foreign lists with the same name can drop onto the scheduler. Applied live — changing it re-targets the already-created lists. |
| `ariaLabel`            | `string \| undefined`               | i18n `scheduler`  | Accessible name of the host region.                                                                                                                   |

Density is applied through the `MlvDensityDirective` host directive, so `[mlvDensity]="'compact'"` works on the host like on every other Malva UI component (`MLV_DENSITY_ELEMENT` is `'scheduler'`).

#### Models

Each model emits the usual `<name>Change` output, so `[(events)]`, `[(view)]` and `[(date)]` all work as one-way bindings plus an explicit listener too.

| Name     | Change output  | Type                                     | Default           | Description                                                                      |
| -------- | -------------- | ---------------------------------------- | ----------------- | -------------------------------------------------------------------------------- |
| `events` | `eventsChange` | `readonly MlvSchedulerEvent<D, TData>[]` | `[]`              | Fully controlled event list; every change writes a **new** array, never mutates. |
| `view`   | `viewChange`   | `MlvSchedulerView`                       | `'month'`         | `'month' \| 'week' \| 'day'`.                                                    |
| `date`   | `dateChange`   | `D`                                      | `adapter.today()` | Anchor date; the visible range derives from it, `view` and `firstDayOfWeek`.     |

#### Outputs

| Name                 | Payload                         | Description                                                       |
| -------------------- | ------------------------------- | ----------------------------------------------------------------- |
| `eventMove`          | `MlvSchedulerEventChange`       | A drag or keyboard move landed (after `canMove`).                 |
| `eventResize`        | `MlvSchedulerEventChange`       | A resize landed (after `canResize`).                              |
| `eventClick`         | `MlvSchedulerEventInteraction`  | Chip activated by click, `Enter` or `Space`.                      |
| `eventDoubleClick`   | `MlvSchedulerEventInteraction`  | Chip double-clicked.                                              |
| `eventContextMenu`   | `MlvSchedulerEventInteraction`  | Chip context menu (the native event is not prevented).            |
| `slotClick`          | `MlvSchedulerSlotEvent`         | Empty slot or month cell activated.                               |
| `slotDoubleClick`    | `MlvSchedulerSlotEvent`         | Empty slot or month cell double-clicked.                          |
| `slotContextMenu`    | `MlvSchedulerSlotEvent`         | Empty slot or month cell context menu.                            |
| `rangeSelect`        | `MlvSchedulerRangeSelectEvent`  | Pointer drag across empty cells, or `Shift+Arrow` + `Enter`.      |
| `externalDrop`       | `MlvSchedulerExternalDropEvent` | A foreign SortableJS item of the same `dragGroup` was dropped.    |
| `visibleRangeChange` | `MlvSchedulerVisibleRange`      | Emitted on init and whenever the view or the range bounds change. |
| `moreClick`          | `MlvSchedulerMoreClickEvent`    | A month cell's `+N more` button opened its popover.               |

#### Public methods

| Method               | Description                                                                   |
| -------------------- | ----------------------------------------------------------------------------- |
| `next()`             | Moves the range forward by one view unit.                                     |
| `previous()`         | Moves the range backward by one view unit.                                    |
| `goToToday()`        | Anchors the range on today.                                                   |
| `goTo(date)`         | Anchors the range on `date`.                                                  |
| `setView(view)`      | Switches the view.                                                            |
| `scrollToTime(time)` | Scrolls the time grid so `'HH:mm'` sits at the top (no-op in the month view). |

#### Public signals

Read-only, and covered by the migration policy like any other public member. Useful when a heading or a data fetch lives outside the `*mlvSchedulerHeaderDef` slot.

| Signal         | Type                               | Description                                                                                                                      |
| -------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `title`        | `Signal<string>`                   | Localized range label: month-year, `"Aug 31 – Sep 6, 2026"`, or the full day label — the same string the built-in toolbar shows. |
| `visibleRange` | `Signal<MlvSchedulerVisibleRange>` | The rendered period, i.e. the value `visibleRangeChange` last emitted.                                                           |

`MlvScheduler` also implements the internal `MlvSchedulerContext` that the view components inject. Those members (`adapter`, `i18n`, `range` — the context's `@internal` alias of the public `visibleRange` —, `days`, `rowLength`, `today`, `nowMinutes`, `normalizedEvents`, `minMinutes`, `maxMinutes`, `snap`, `eventDef`, `dragHintId`, `pendingFocus`, `scrollRequest`, `dragging`, `translate()`, `announce()`, `commitChange()`, `emit*()`, …) are `@internal` plumbing between the root and its views: they are not part of the supported surface and are not covered by the migration policy. `title` and `visibleRange` are **not** in that set.

### `MlvSchedulerEventDef`

`ng-template[mlvSchedulerEventDef]` replaces the **content** of every event chip; the chip host keeps its accessible name, resize handles, drag behaviour and focus handling. Clicks and keys originating on a focusable control inside the template are left to that control — the chip emits no `eventClick` and starts no keyboard move for them. The context is `MlvSchedulerEventContext` — `$implicit` (the event), `view`, `allDay`, `continuesBefore`, `continuesAfter`.

The directive takes no inputs, so a template's context always resolves to `MlvSchedulerEventContext<Date, unknown>` — **both** type parameters fall back to their defaults, not only `TData`:

- `TData` degrades to `unknown`, which fails safe: a wrong member access on `data` is a compile error. Narrow the payload in a component method rather than in the markup (`apps/docs/src/app/pages/scheduler/examples/4` shows the pattern).
- `D` degrades to `Date`, which fails **silently**: on a non-`Date` adapter (Luxon, Temporal, …) `{{ event.start.getHours() }}` type-checks against the `Date` default and throws at runtime. Route date reads through a component method that takes the event, exactly as `data` does.

`MlvSchedulerHeaderDef` has the same `D = Date` degradation in `MlvSchedulerHeaderContext`.

### `MlvSchedulerHeaderDef`

`ng-template[mlvSchedulerHeaderDef]` replaces the built-in toolbar (`toolbar` is then ignored). The context is `MlvSchedulerHeaderContext`, whose `$implicit` is a `MlvSchedulerHeaderApi`: `title`, `view`, `range`, `next()`, `previous()`, `today()`, `setView()`.

### Types

- `MlvSchedulerEvent<D, TData>` — `id`, `title`, `start`, exclusive `end`, optional `allDay`, `tone` (`MlvTone`), `color` (any CSS colour, wins over `tone`), `draggable`, `resizable`, `data`. `end <= start` is repaired to `start + defaultEventDuration` (timed) or one day (all-day).
- `MlvSchedulerNextRange<D>` — `{ start, end (exclusive), allDay }`; the proposed range of a move or resize, and the shape `previous` and `canMove` / `canResize`' second argument share.
- `MlvSchedulerEventChange` — `{ event, previous: MlvSchedulerNextRange, source }`; `event` is the **new** object already written to the model.
- `MlvSchedulerEventInteraction` — `{ event, element, nativeEvent }`; `element` is the chip host, an anchor for consumer menus.
- `MlvSchedulerSlotEvent` — `{ date, allDay, element, nativeEvent }`.
- `MlvSchedulerRangeSelectEvent` — `{ start, end (exclusive), allDay, source }`.
- `MlvSchedulerExternalDropEvent` — `{ element, start, end, allDay }`; the foreign element is returned to its own list, nothing is inserted.
- `MlvSchedulerVisibleRange` — `{ view, start (inclusive), end (exclusive) }`.
- `MlvSchedulerBusinessHours` — `{ start: 'HH:mm', end: 'HH:mm', days?: readonly number[] }` (default Monday–Friday).
- `MlvSchedulerCanChange` — `(event, next: MlvSchedulerNextRange) => boolean`; `next` is the already-applied range, so a start-edge resize reaches it exactly like an end-edge one.
- `MlvSchedulerChangeSource` — `'pointer' | 'keyboard'`.
- `MlvSchedulerMoreClickEvent` — `{ date, events }`.

## Accessibility

The host is a labelled **`role="group"`** (`aria-label` ← the `ariaLabel` input, else the i18n `scheduler` string). A custom element carries no implicit role, so a name on it would be ARIA-prohibited; `group` is the weakest role that takes one, keeps the toolbar and the views in a single labelled region and requires no particular children.

The two views use different structures, because their DOM is:

| View                   | Structure                                                                                                                                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Month                  | one `role="grid"`: a `row` of `columnheader`s, then a `rowgroup` of week `row`s of `gridcell`s. The `+N` popover is a labelled `group`.                                                                                                                                        |
| Week / day (time grid) | the sheet is a labelled **`role="group"`**; the day headers + all-day band are their own two-row **`role="grid"`**; each day column is a **`role="listbox"`** (`aria-multiselectable` while `selectable`) whose slots are `role="option"`; the chip overlay is `presentation`. |

The time grid is **column-major** in the DOM — the per-day column element is the SortableJS hit area a chip drag needs — so it is described as one listbox per day rather than as a row-major grid, which would need `aria-owns` over dozens of phantom rows. Keyboard behaviour is identical either way: the "Grid cells" row of the table below applies to month cells, all-day cells and time-grid option slots alike.

Announcements go through **two alternating polite live regions** (`role="status"` + `aria-live="polite"`), written in turn: a screen reader re-announces a repeated message only when the text lands in a node that was previously empty, so two slots make "moved to Sep 5, 9:30 AM" audible twice in a row.

## Keyboard

Horizontal keys are logical: they mirror in RTL through `MlvRtlService.normalizeArrowKey()`. Vertical keys, `Home` / `End` and `PageUp` / `PageDown` never mirror.

| Where        | Keys                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Grid cells   | Month cells, all-day cells and the time grid's per-day option slots alike: `Arrow` moves the roving focus, `Home` / `End` row start / end, `Ctrl+Home` / `Ctrl+End` grid start / end, `PageUp` / `PageDown` previous / next range, `Space` slot click, `Enter` focuses the cell's first chip (or its `+N more` button) and, on an empty cell, emits the slot click                                                                                  |
| Selection    | `Shift+Arrow` extends a selection from the focused cell (only when `selectable`), `Enter` commits it as `rangeSelect`, `Escape` clears it                                                                                                                                                                                                                                                                                                           |
| Chips        | `Enter` / `Space` activate, `Alt+Arrow` moves by one snap step (one day / one week for a lane bar), `Alt+Shift+Arrow` resizes the **end** edge, `Ctrl+Alt+Arrow` (`⌃⌥Arrow` on macOS) resizes the **start** edge, `Escape` returns focus to the owning cell, `Tab` / `Shift+Tab` cycle the cell's chips and its `+N more` button. A timed chip resizes on the block axis only, so `Alt+Shift+←/→` and `Ctrl+Alt+←/→` fall through to the grid there |
| `+N more`    | `Enter` / `Space` toggle the popover — the first press opens it, a second closes it and returns focus to the button, and only the opening press emits `moreClick` —, `Shift+Tab` steps back to the cell's last chip (the button is the last stop of the intra-cell ring), `Escape` returns focus to the cell                                                                                                                                        |
| `+N` popover | `Escape`, an outside click, the end of a drag, or a second press on the `+N more` trigger close it and return focus to that button; opening it focuses the first chip inside                                                                                                                                                                                                                                                                        |

## Behaviour notes and caveats

- **The host needs a bounded block size.** The month view measures how many lanes fit a week row; with an auto-height host it can only show one lane and folds everything else into `+N more`.
- A month spanning bar is sized in cell **pitches**: its own box is the cell's `__lanes` content box, one pitch short of the cell's two inline paddings and its inline-end border, so it adds that gap back per crossed boundary. Change the cell's `padding` / `border-inline-end` and the bar's `inline-size` has to follow — a compiled-CSS spec asserts the two use the same tokens.
- All-day events use **exclusive** end dates at midnight; a timed event of ≥ 24 h is promoted to a lane bar, and a timed event crossing midnight is clipped per day in the time grid.
- The month grid shows as many lanes as fit its row height and folds the rest into a `+N more` button whose popover is an `MlvPopupService` overlay carrying the resolved direction. The button **toggles** its own popover, so `moreClick` fires on the press that opens it and not on the one that closes it. The button declares `aria-haspopup="dialog"` / `aria-expanded` / `aria-controls`, and its accessible name leads with the visible `+N more` text (WCAG 2.5.3).
- The popover's chips are a drop list of the same `dragGroup`, so an overflowed event drags out of the panel onto any cell. It opens **without a backdrop** (the fallback drag hit-tests with `elementFromPoint`, which a backdrop would answer instead of the cell below) and is dismissed by an outside click, `Escape`, or the end of a drag: while a drag runs it is hidden rather than disposed, because disposing it would destroy the SortableJS instance that owns the drag.
- Pointer drags use SortableJS with `forceFallback`; `onMove` always returns `false` — the DOM is never reordered, the **model** is. A ghost chip previews the drop; its id is the dragged event's id suffixed with `__mlv-ghost`, so never rely on chip ids being exactly the event ids while a drag is in flight. The preview is a copy of the dragged event, so it carries that event's `tone` / `color` and paints the same surface, marked out as a preview by a dashed border rather than by a colour of its own.
- A **multi-day timed** pointer range-drag paints the **continuous** interval from the first pressed slot to the last — whole middle days, the first day from the pressed slot down, the last day up to the released slot — and emits that same interval (`start` → `end`).
- The month grid body, the time-grid sheet and every event chip carry `user-select: none` (the root adds it too while a drag is in flight), so a range-drag or a chip drag never smears a native text selection over the grid. Text inside the views is therefore not selectable with the pointer.
- **On a touch screen a swipe always scrolls, on both axes** (`touch-action: pan-x pan-y pinch-zoom` on the time-grid sheet — the week sheet overflows horizontally on a phone). Drag-move, resize and range selection instead arm on a **short press** of ~200 ms without movement (SortableJS `delay: 200` + `delayOnTouchOnly` for chips, the same `touchDelay` in the pointer helper for selection and resize). Mouse drags still start at the 5 px threshold, and the keyboard equivalents are unaffected. A range drag resolves its head with `elementFromPoint` at the pointer's position, never from `event.target`: a touch pointer is implicitly captured by the cell it went down on, so the target reports that one cell for the whole gesture.
- A drop list is registered as a **pair** of elements: the whole cell / column is the hit area (it carries `data-mlv-scheduler-list`, receives hovers and foreign drops), while the inner box holding the chips is where a drag starts. SortableJS only starts a drag from a direct child of its container but hit-tests hovers by walking up from `elementFromPoint`, and no single element satisfies both.
- Each resizable chip renders a handle on **both** edges (none on an edge that continues into another day). The hit strip is ≥ 0.375 rem with `touch-action: none`; its painted grip appears on hover / `:focus-visible` and stays visible where there is no hover.
- `hiddenDays` steers **navigation** in the day view (`next()` / `previous()` skip hidden weekdays) but never blanks it: a one-day range whose weekday is hidden still renders that day, because an empty day grid would have no cell and therefore no tab stop. An anchor pointed straight at a hidden weekday — a `[date]` binding or `goTo()` — renders the day it was asked for.
- The time grid's **initial scroll** top-aligns `businessHours.start` (or `08:00`) and is re-applied whenever `view`, `minTime`, `maxTime` or `slotDuration` changes; `scrollToCurrentTime` centres the current wall-clock minute in the **visible** region instead — the exact minute, not a snapped slot, and centred below the sticky day-header / all-day band rather than in the raw viewport — falling back to that default when the current time is outside `[minTime, maxTime)`, on either bound. The clock is read off the adapter at scroll time, so the target is the time of day (a week without today still opens around now o'clock), the minute tick never moves the viewport, and the value is never a stale one cached while `showCurrentTime` was off. `scrollToTime()` stays top-aligned and is applied **once**, by whichever time grid is alive when it is issued — in the same tick as a switch to week / day it still wins over the initial scroll, it is consumed on apply so no time grid built later replays it, and a call made while the **month** view shows is dropped, not deferred.
- `minTime` / `maxTime` are validated as one window and **throw** when `minTime` is not earlier than `maxTime` (`Invalid scheduler time window …`). They are inputs, so the throw surfaces during change detection, not at construction.
- **Overnight business hours are out of contract.** `businessHours` with `end` earlier than `start` is not supported; split the shading into two schedulers or clamp to `'24:00'`.
- An invalid `D` (an `Invalid Date` in the native adapter) is not repaired: it propagates into the layout as an unplaced event. Validate before writing the model.
- `visibleRangeChange` emits **on init** and then only when the view or the range bounds actually change — never on an unrelated `events` write. A consumer that fetches on the output does not need to seed the first range itself.
- Not in scope (follow-ups): timeline / agenda / year views, resources, recurrence, non-Gregorian calendars, timezone conversion, a quick-info popover, a custom day-cell template, print / export and virtualization.

## i18n keys

The `scheduler` section of every locale pack (token `MLV_SCHEDULER_I18N` from `@malva-ui/i18n`, type `MlvSchedulerI18n`) declares: `scheduler`, `today`, `previous`, `next`, `month`, `week`, `day`, `viewSwitch`, `allDay`, `moreEvents`, `moreEventsLabel`, `gridLabel`, `slotLabel`, `dayLabelToday`, `eventLabel`, `eventLabelAllDay`, `dragHint`, `eventMoved`, `eventResized`, `moveRejected`, `rangeChanged`, `selectionHint`.

## Styling

BEM blocks `mlv-scheduler`, `mlv-scheduler-month`, `mlv-scheduler-time-grid`, `mlv-scheduler-event`; every rule ships inside `@layer mlv.components`.

Density-tunable custom properties on the root block: `--mlv-scheduler-slot-height`, `--mlv-scheduler-lane-height`, `--mlv-scheduler-month-row-min-height`, `--mlv-scheduler-column-min-width`, `--mlv-scheduler-gutter-width`, `--mlv-scheduler-event-min-height`.

Geometry the views write and the SCSS consumes (do not set these yourself): `--mlv-scheduler-day-count`, `--mlv-scheduler-row-length`, `--mlv-scheduler-slot-count`, `--mlv-scheduler-tracks`, `--mlv-scheduler-visible-lanes`, `--mlv-scheduler-all-day-lanes`, `--mlv-scheduler-lane`, `--mlv-scheduler-span`, `--mlv-scheduler-lane-shift`, `--mlv-scheduler-offset`, `--mlv-scheduler-event-top`, `--mlv-scheduler-event-height`, `--mlv-scheduler-event-start`, `--mlv-scheduler-event-width`, and the chip's resolved palette (`--mlv-scheduler-event-bg`, `--mlv-scheduler-event-color`, `--mlv-scheduler-event-text`, `--mlv-scheduler-event-bar`).

Grid cells and the `+N` popover use the inset **Form B**; chips and the `+N more` button use **Form A**, except chips inside the time-grid scroller, which switch to Form B so the ring is not clipped by the scroll container. Every animated block carries a `@include mixins.reduced-motion(...)` path.

## Tests

`yarn nx run scheduler:test` — the layout engine (pure functions), the root component, the month view, the time grid, the chip, the drag service, the pointer helper, keyboard move / resize / selection, compiled-CSS style specs (through `stripCssLayersFromText()`) and an axe pass in every view. Specs are zoneless (`await fixture.whenStable()` after a signal write) and synthesize pointer input with `new Event('pointerdown')` plus `Object.assign`, because jsdom has no `PointerEvent` and returns zeroed layout rects.
