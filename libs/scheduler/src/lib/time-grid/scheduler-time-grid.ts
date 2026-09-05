import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  PLATFORM_ID,
  ViewEncapsulation,
  afterRenderEffect,
  computed,
  inject,
  linkedSignal,
  untracked,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  DOWN_ARROW,
  LEFT_ARROW,
  RIGHT_ARROW,
  UP_ARROW,
} from '@angular/cdk/keycodes';
import { MlvScrollbar } from '@malva-ui/core/scrollbar';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import {
  TOUCH_GESTURE_DELAY,
  attachPointerDrag,
  elementAt,
} from '../drag/scheduler-pointer';
import { MlvSchedulerDragService } from '../drag/scheduler-drag.service';
import { MlvSchedulerDropList } from '../drag/scheduler-drop-list';
import { MlvSchedulerEventChip } from '../event/scheduler-event';
import {
  findCellElement,
  findEventElement,
  nextVisibleDate,
} from '../layout/scheduler-focus';
import {
  assignLanes,
  clusterColumns,
  dayIndexOf,
  layoutRow,
  sliceColumns,
  sliceRows,
  type MlvSchedulerClusteredSegment,
  type MlvSchedulerLaneSegment,
} from '../layout/scheduler-layout';
import {
  DEFAULT_BUSINESS_DAYS,
  MINUTES_PER_DAY,
  parseTime,
  slotCount,
} from '../layout/scheduler-time';
import {
  MLV_SCHEDULER_CONTEXT,
  type MlvSchedulerContext,
  type MlvSchedulerInteractionKind,
} from '../scheduler/scheduler-context';
import type { MlvSchedulerRangeSelectEvent } from '../scheduler/scheduler.types';

/**
 * Pixel offset that puts `minutes` at the top of the viewport.
 *
 * @param headroomPx Pixels scrolled back ABOVE the target, i.e. how far down
 *   the viewport the target ends up. Callers pass what that means for them:
 *   half an hour-label for the top-aligned scroll (the label straddles its
 *   line, so a target flush with the top edge is cut in half), half the visible
 *   height for the centred one. Defaults to `0`; the result is clamped at `0`.
 */
export function scrollOffsetFor(
  minutes: number,
  minMinutes: number,
  slotDuration: number,
  slotHeightPx: number,
  headroomPx = 0,
): number {
  return Math.max(
    0,
    ((minutes - minMinutes) / slotDuration) * slotHeightPx - headroomPx,
  );
}

/**
 * `businessHours.start` / `.end` resolved to plain minutes once per input
 * change instead of once per rendered cell — a malformed `'HH:mm'` value then
 * throws once (in the computed), not up to 7 × 48 times per render.
 *
 * `start` must be strictly less than `end` — overnight windows (`end < start`,
 * e.g. a `22:00`–`06:00` night shift) are out of contract: the per-slot
 * `minutes >= start && minutes < end` comparison is then unsatisfiable for
 * every minute of the day, so the window resolves to no business hours at all
 * (no shading anywhere), not a wrapped overnight range.
 */
interface MlvSchedulerBusinessWindow {
  readonly days: readonly number[];
  readonly start: number;
  readonly end: number;
}

/** Shared empty result for the per-day segment lookups — avoids a fresh array per template read. */
const EMPTY: readonly never[] = [];

interface MlvSchedulerSlot {
  readonly minutes: number;
  readonly label: string;
  /** `true` only when a business window exists AND this slot falls outside it. */
  readonly outsideBusiness: boolean;
  readonly hour: boolean;
}

/** Static per-day scaffolding; chips are looked up separately (see `_segmentsByDay`). */
interface MlvSchedulerTimeColumn<D> {
  readonly dayIndex: number;
  readonly date: D;
  readonly label: string;
  readonly weekday: string;
  readonly dayNumber: string;
  readonly today: boolean;
  readonly slots: readonly MlvSchedulerSlot[];
}

/**
 * Position of one grid cell: a visible-day index plus the slot's start minute,
 * or `null` minutes for that day's all-day cell.
 *
 * One type for both roles the view needs it in — the roving tab stop and the
 * range-selection anchor/head — so the two can never drift apart, and one
 * decoder (`_positionOf`) reads it off an element for every code path.
 */
interface MlvSchedulerGridPos {
  readonly dayIndex: number;
  readonly minutes: number | null;
}

/**
 * Week / day time grid: sticky day header + all-day lanes, an hour gutter and
 * one column of slots per day with absolutely positioned event chips.
 */
@Component({
  selector: 'mlv-scheduler-time-grid',
  templateUrl: './scheduler-time-grid.html',
  styleUrl: './scheduler-time-grid.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvScrollbar, MlvSchedulerEventChip, MlvSchedulerDropList],
  host: {
    class: 'mlv-scheduler-time-grid',
    '[style.--mlv-scheduler-day-count]': '_ctx.days().length',
    '[style.--mlv-scheduler-slot-count]': '_slotCount()',
    '[style.--mlv-scheduler-all-day-lanes]': '_allDayLaneCount()',
  },
})
export class MlvSchedulerTimeGrid<D = Date, TData = unknown> {
  /** @protected Root context. */
  protected readonly _ctx = inject(
    MLV_SCHEDULER_CONTEXT,
  ) as MlvSchedulerContext<D, TData>;
  /** @private Host element for focus queries. */
  private readonly _host: HTMLElement = inject(ElementRef<HTMLElement>)
    .nativeElement;
  /** @private Mirrors horizontal arrows in RTL. */
  private readonly _rtl = inject(MlvRtlService);
  /** @private Drag engine of the owning scheduler. */
  private readonly _drag = inject(MlvSchedulerDragService<D, TData>);
  /** @private Scroll container. */
  private readonly _scrollbar = viewChild.required(MlvScrollbar);
  /** @private The `role="grid"` sheet; range-selection pointer tracking attaches here. */
  private readonly _sheet =
    viewChild.required<ElementRef<HTMLElement>>('sheet');
  /** @private Pointer listeners run outside change detection. */
  private readonly _zone = inject(NgZone);
  /** @private No pointer drag on the server. */
  private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  /**
   * @private `sequence` of the `scrollToTime()` request already standing when
   * this grid was constructed, i.e. one issued before this instance existed.
   *
   * The root never clears `scrollRequest`, and `scheduler.html` renders the
   * month view from a different branch than week / day — so month → week
   * builds a NEW time grid whose request effect would otherwise fire once on
   * its own first render and beat the documented initial scroll with a time
   * asked for long ago, possibly while the month view was showing, where
   * `scrollToTime()` is documented as a no-op. Anything at or below this
   * sequence is stale; the same instance still honours every new one.
   */
  private readonly _seenScrollSequence = untracked(
    () => this._ctx.scrollRequest()?.sequence ?? 0,
  );

  /** @internal Model events plus the drag preview ghost. */
  protected readonly _events = computed(() =>
    this._drag.withPreview(this._ctx.normalizedEvents()),
  );

  /** @protected Slots per column. */
  protected readonly _slotCount = computed(() =>
    slotCount(
      this._ctx.minMinutes(),
      this._ctx.maxMinutes(),
      this._ctx.slotDuration(),
    ),
  );
  /**
   * @protected Minutes actually covered by the RENDERED rows — `slotCount ×
   * slotDuration`, not `maxMinutes − minMinutes`.
   *
   * A column is `slotCount` rows tall and `slotCount` is a `ceil()`, so a
   * window whose span is not a whole number of slots (`08:00`–`17:30` at
   * `slotDuration: 60` → 10 rows = 600 min for a 570-minute span) paints one
   * row more than it names. Every percentage the view emits — chip top/height,
   * hour-label offsets, the now-line — resolves against that painted box, so
   * they must all divide by this, or everything drifts downward in proportion
   * to its offset and the hour labels leave the lines they annotate.
   */
  protected readonly _spanMinutes = computed(
    () => this._slotCount() * this._ctx.slotDuration(),
  );
  /** @private Start minute of the last rendered slot row. */
  private readonly _lastSlotMinutes = computed(
    () =>
      this._ctx.minMinutes() +
      (this._slotCount() - 1) * this._ctx.slotDuration(),
  );
  /** @protected Grid accessible name. */
  protected readonly _gridLabel = computed(() => {
    const range = this._ctx.range();
    const adapter = this._ctx.adapter;
    const period =
      range.view === 'day'
        ? adapter.getDateLabel(range.start)
        : `${adapter.getDateLabel(range.start)} – ${adapter.getDateLabel(adapter.addCalendarDays(range.end, -1))}`;
    return this._ctx.translate('gridLabel', { view: range.view, period });
  });

  /** @protected Hour labels for the gutter, with their block offset in percent of the rendered span. */
  protected readonly _hours = computed(() => {
    const min = this._ctx.minMinutes();
    const max = this._ctx.maxMinutes();
    const span = this._spanMinutes();
    const day = this._ctx.days()[0];
    const hours: { minutes: number; label: string; offset: number }[] = [];
    if (!day) return hours;
    for (let minutes = Math.ceil(min / 60) * 60; minutes < max; minutes += 60) {
      hours.push({
        minutes,
        label: this._ctx.adapter.format(
          this._ctx.adapter.withTime(day, minutes / 60, 0),
          { hour: 'numeric' },
        ),
        offset: ((minutes - min) / span) * 100,
      });
    }
    return hours;
  });

  /**
   * @private `businessHours.start` / `.end` parsed once per input change (see
   * `MlvSchedulerBusinessWindow`); `null` when there is no shading.
   */
  private readonly _businessWindow =
    computed<MlvSchedulerBusinessWindow | null>(() => {
      const hours = this._ctx.businessHours();
      if (!hours) return null;
      return {
        days: hours.days ?? DEFAULT_BUSINESS_DAYS,
        start: parseTime(hours.start),
        end: parseTime(hours.end),
      };
    });

  /** @protected All-day row layout (lanes never collapse: the row grows). */
  protected readonly _allDayLayout = computed(() => {
    const segments = sliceRows(
      this._ctx.adapter,
      this._events(),
      this._ctx.days(),
      this._ctx.days().length || 1,
      'lane',
    );
    return layoutRow(
      assignLanes(this._ctx.adapter, segments),
      Number.POSITIVE_INFINITY,
    );
  });
  /** @protected Rows the all-day area reserves (at least one). */
  protected readonly _allDayLaneCount = computed(() =>
    Math.max(1, this._allDayLayout().laneCount),
  );

  /**
   * @protected One entry per visible day: the STATIC scaffolding only —
   * headers, labels and the slot grid.
   *
   * Deliberately free of `_events()`. Chip layout lives in `_segmentsByDay` /
   * `_lanesByDay` below, so a drag preview (which rewrites the event list on
   * every snapped step) re-slices the events without also rebuilding every
   * slot's `Intl` + ICU label — `days × slots` of them, 336 at the default
   * week / 30-minute grid.
   */
  protected readonly _columns = computed<MlvSchedulerTimeColumn<D>[]>(() => {
    const adapter = this._ctx.adapter;
    const days = this._ctx.days();
    const min = this._ctx.minMinutes();
    const max = this._ctx.maxMinutes();
    const slotDuration = this._ctx.slotDuration();
    const window = this._businessWindow();
    const today = this._ctx.today();
    const weekdays = adapter.getDayOfWeekNames('short');
    return days.map((date, dayIndex) => {
      const dayOfWeek = adapter.getDayOfWeek(date);
      const dateLabel = adapter.getDateLabel(date);
      const isToday = adapter.sameDate(date, today);
      const slots: MlvSchedulerSlot[] = [];
      for (let minutes = min; minutes < max; minutes += slotDuration) {
        slots.push({
          minutes,
          label: this._ctx.translate('slotLabel', {
            date: dateLabel,
            time: this._ctx.formatTime(
              adapter.withTime(date, Math.floor(minutes / 60), minutes % 60),
            ),
          }),
          // Shading marks the hours OUTSIDE the window, so it can only exist
          // when there is a window: with `businessHours` unset (the documented
          // default, "no shading") every slot would otherwise be "not business"
          // and the whole grid would paint as out-of-hours.
          outsideBusiness:
            !!window &&
            !(
              window.days.includes(dayOfWeek) &&
              minutes >= window.start &&
              minutes < window.end
            ),
          hour: minutes % 60 === 0,
        });
      }
      return {
        dayIndex,
        date,
        label: isToday
          ? this._ctx.translate('dayLabelToday', { date: dateLabel })
          : dateLabel,
        weekday: weekdays[dayOfWeek],
        dayNumber: adapter.getDayOfMonthLabel(date),
        today: isToday,
        slots,
      };
    });
  });

  /** @private Timed chip segments of each visible day, keyed by day index. */
  private readonly _segmentsByDay = computed(() => {
    const byDay = new Map<number, MlvSchedulerClusteredSegment<D, TData>[]>();
    for (const segment of clusterColumns(
      sliceColumns(
        this._ctx.adapter,
        this._events(),
        this._ctx.days(),
        this._ctx.minMinutes(),
        this._ctx.maxMinutes(),
      ),
    )) {
      const bucket = byDay.get(segment.dayIndex);
      if (bucket) bucket.push(segment);
      else byDay.set(segment.dayIndex, [segment]);
    }
    return byDay;
  });

  /** @private All-day lane segments STARTING on each visible day, keyed by day index. */
  private readonly _lanesByDay = computed(() => {
    const byDay = new Map<number, MlvSchedulerLaneSegment<D, TData>[]>();
    for (const segment of this._allDayLayout().visible) {
      const bucket = byDay.get(segment.startIndex);
      if (bucket) bucket.push(segment);
      else byDay.set(segment.startIndex, [segment]);
    }
    return byDay;
  });

  /** @protected Timed chip segments of one day; `[]` when the day has none. */
  protected _segmentsOf(
    dayIndex: number,
  ): readonly MlvSchedulerClusteredSegment<D, TData>[] {
    return this._segmentsByDay().get(dayIndex) ?? EMPTY;
  }

  /** @protected All-day lane segments starting on one day; `[]` when it has none. */
  protected _lanesOf(
    dayIndex: number,
  ): readonly MlvSchedulerLaneSegment<D, TData>[] {
    return this._lanesByDay().get(dayIndex) ?? EMPTY;
  }

  /** @protected Now-line offset in percent of the rendered span, `null` when hidden. */
  protected readonly _nowOffset = computed(() => {
    if (!this._ctx.showCurrentTime()) return null;
    const minutes = this._ctx.nowMinutes();
    const min = this._ctx.minMinutes();
    if (minutes < min || minutes > this._ctx.maxMinutes()) return null;
    return ((minutes - min) / this._spanMinutes()) * 100;
  });

  /**
   * @private Today if visible else the first day; slot = the initial scroll time.
   *
   * `today()` is read `untracked`: it is the wall clock, so it changes identity
   * on every minute tick, and tracking it here would re-run the `_focus`
   * `linkedSignal` computation once a minute and throw away the cell the user
   * had roved to — while DOM focus stayed put, leaving the grid with its only
   * `tabindex="0"` somewhere else. The default is a starting position, not a
   * live one; it is recomputed when the visible days change, which is what a
   * date rollover produces anyway.
   */
  private readonly _defaultFocus = computed<MlvSchedulerGridPos>(() => {
    const days = this._ctx.days();
    const todayIndex = untracked(() =>
      dayIndexOf(this._ctx.adapter, days, this._ctx.today()),
    );
    return {
      dayIndex: Math.max(0, todayIndex),
      minutes: this._snapToSlot(this._initialMinutes()),
    };
  });
  /** @protected The one cell with `tabindex="0"`; resets when days or hours change. */
  protected readonly _focus = linkedSignal<MlvSchedulerGridPos>(() => {
    this._ctx.days();
    this._ctx.minMinutes();
    return this._defaultFocus();
  });

  /** @internal Range selection anchor/head; `null` when nothing is selected. Resets when the range changes. */
  protected readonly _selection = linkedSignal<
    readonly D[],
    { anchor: MlvSchedulerGridPos; head: MlvSchedulerGridPos } | null
  >({
    source: this._ctx.days,
    computation: () => null,
  });

  /**
   * @internal Selected span: the first and last day, and the minute the range
   * starts at ON `dayFrom` / ends at ON `dayTo` (or all-day).
   *
   * The two endpoints are ordered as `(dayIndex, minutes)` TUPLES, not by each
   * component on its own. Minute-wise `Math.min` / `Math.max` is only correct
   * while both endpoints sit on the same day: a backwards multi-day drag —
   * press Tue 14:00, release Wed 09:00 — would otherwise report
   * `from = 09:00`, `to = 14:00` and commit Tue 09:00 → Wed 14:30 instead of
   * Tue 14:00 → Wed 09:30. On a single day the tuple order degenerates to the
   * minute comparison, so an upward drag (14:00 → 09:00) still normalizes to
   * 09:00 → 14:30. `_isSelected`, `_selectionRange` and `_announceSelection`
   * all read this, so the paint, the commit and the hint cannot disagree.
   */
  protected readonly _selectedBounds = computed(() => {
    const s = this._selection();
    if (!s) return null;
    const allDay = s.anchor.minutes === null;
    const a = s.anchor.minutes ?? 0;
    const h = s.head.minutes ?? a;
    const anchorFirst =
      s.anchor.dayIndex === s.head.dayIndex
        ? a <= h
        : s.anchor.dayIndex < s.head.dayIndex;
    return {
      allDay,
      dayFrom: Math.min(s.anchor.dayIndex, s.head.dayIndex),
      dayTo: Math.max(s.anchor.dayIndex, s.head.dayIndex),
      from: allDay ? 0 : anchorFirst ? a : h,
      to: allDay ? 0 : anchorFirst ? h : a,
    };
  });

  /**
   * @internal Whether a cell is inside the selection. Called from the template per cell.
   *
   * The paint is CONTINUOUS, matching the interval `_selectionRange()` emits:
   * the first day runs from its start minute to the end of the day, the middle
   * days are filled, and the last day runs up to its end minute. Painting the
   * bounding rectangle instead would show a gap the committed range does not
   * have (a Mon 09:00 → Wed 10:00 drag would leave Monday 10:30–24:00 and
   * Wednesday 00:00–08:30 unpainted although both are inside the range).
   */
  protected _isSelected(dayIndex: number, minutes: number | null): boolean {
    const b = this._selectedBounds();
    if (!b || dayIndex < b.dayFrom || dayIndex > b.dayTo) return false;
    if (b.allDay) return minutes === null;
    if (minutes === null) return false;
    return (
      (dayIndex > b.dayFrom || minutes >= b.from) &&
      (dayIndex < b.dayTo || minutes <= b.to)
    );
  }

  /** @private Timestamp until which a `click` on a cell is ignored (the click that trails a drag-select). */
  private _ignoreClicksUntil = 0;

  /** @private Swallows the synthetic `click` the browser fires when the pointer is released after a drag. */
  private _suppressNextClick(): void {
    this._ignoreClicksUntil = performance.now() + 300;
  }

  /** @private Cell under the pointer at pointerdown; becomes the anchor once the drag threshold is crossed. */
  private _pendingAnchor: MlvSchedulerGridPos | null = null;

  /** @private Cell position of the nearest cell ancestor of an event target, or `null` outside every cell. */
  private _positionAt(target: EventTarget | null): MlvSchedulerGridPos | null {
    const cell = (target as Element | null)?.closest<HTMLElement>(
      '[data-day-index][data-minutes]',
    );
    return cell ? this._positionOf(cell) : null;
  }

  /**
   * @internal Remembers the pressed cell for the range-select tracker, and
   * abandons a pending selection when the press lands outside it.
   *
   * Same rule as plain keyboard navigation: the range is anchored on the cell
   * it was started from, so a press elsewhere means the user has moved on and a
   * later `Enter` must activate what they pressed, not commit a stale range.
   */
  protected _onSheetPointerDown(event: Event): void {
    const pos = this._positionAt(event.target);
    this._pendingAnchor = pos;
    if (
      this._selection() &&
      !(pos && this._isSelected(pos.dayIndex, pos.minutes))
    ) {
      this._selection.set(null);
    }
  }

  /**
   * @private The pending selection as a concrete half-open date range, or
   * `null` when nothing is selected.
   *
   * The single owner of the exclusive-end arithmetic: `_commitSelection` and
   * `_announceSelection` both read it, so the two can never disagree about the
   * end of the last slot — which is `MINUTES_PER_DAY`, i.e. the next day's
   * midnight, not an invalid `24:00` the adapter rejects.
   */
  private _selectionRange(): {
    start: D;
    end: D;
    allDay: boolean;
  } | null {
    const b = this._selectedBounds();
    if (!b) return null;
    const ctx = this._ctx;
    const adapter = ctx.adapter;
    const days = ctx.days();
    if (b.allDay) {
      return {
        start: adapter.startOfDay(days[b.dayFrom]),
        end: adapter.addCalendarDays(days[b.dayTo], 1),
        allDay: true,
      };
    }
    const start = adapter.withTime(
      days[b.dayFrom],
      Math.floor(b.from / 60),
      b.from % 60,
    );
    const endMinutes = Math.min(b.to + ctx.slotDuration(), ctx.maxMinutes());
    const endDay = days[b.dayTo];
    const end =
      endMinutes >= MINUTES_PER_DAY
        ? adapter.startOfDay(adapter.addCalendarDays(endDay, 1))
        : adapter.withTime(
            endDay,
            Math.floor(endMinutes / 60),
            endMinutes % 60,
          );
    return { start, end, allDay: false };
  }

  /** @internal Commits the selection as a `rangeSelect` and clears it. */
  protected _commitSelection(
    source: MlvSchedulerRangeSelectEvent<D>['source'],
  ): void {
    const range = this._selectionRange();
    this._selection.set(null);
    if (!range) return;
    this._ctx.emitRangeSelect({ ...range, source });
  }

  constructor() {
    afterRenderEffect(() => {
      const request = this._ctx.pendingFocus();
      if (!request) return;
      let element: HTMLElement | null;
      if (request.kind === 'event') {
        element = findEventElement(this._host, request.id, request.dayIndex);
      } else {
        const dayIndex = dayIndexOf(
          this._ctx.adapter,
          this._ctx.days(),
          request.date,
        );
        const minutes =
          request.minutes === null ? null : this._snapToSlot(request.minutes);
        element = findCellElement(this._host, dayIndex, minutes);
      }
      if (!element) {
        // Drop a request this pass could not place instead of leaving it armed.
        // Every producer writes it in the same tick as the state that renders
        // the target — `_jump` sets it beside its `goTo`, the chip beside its
        // `commitChange` — so one pass is all a satisfiable request needs. A
        // request that missed cannot be satisfied later either, and leaving it
        // set would hand the focus to whatever chip next claims that id.
        untracked(() => this._ctx.pendingFocus.set(null));
        return;
      }
      untracked(() => {
        this._ctx.pendingFocus.set(null);
        if (request.kind === 'cell') this._focus.set(this._positionOf(element));
      });
      element.focus();
    });

    // Re-applied whenever the axis itself changes, not once per instance:
    // `scheduler.html` renders week and day from the SAME `@default` branch, so
    // a week ↔ day switch reuses this component and an `afterNextRender` would
    // never run again — the day view would open at whatever scroll offset the
    // week was left at, while month → week (a fresh instance) landed on the
    // business-hours start. `scrollTop` is in pixels, so a new `minTime` /
    // `maxTime` / `slotDuration` no longer names the same time either.
    //
    // Registered BEFORE the `scrollRequest` effect below on purpose: two
    // `afterRenderEffect`s of the same phase run in registration order, so a
    // `scrollToTime()` issued in the same tick as a view switch has to be the
    // LATER writer for the explicit request to win.
    afterRenderEffect(() => {
      this._ctx.view();
      const minMinutes = this._ctx.minMinutes();
      const maxMinutes = this._ctx.maxMinutes();
      this._ctx.slotDuration();
      const centre = this._ctx.scrollToCurrentTime();
      untracked(() => {
        // The clock is read straight off the adapter rather than through the
        // context's `nowMinutes`: that computed's only dependency is a tick the
        // root bumps ONLY while `showCurrentTime` is on, so with the line
        // hidden it caches the minute it first saw and would re-centre that
        // forever. Reading the adapter here also keeps the viewport still under
        // a user who has scrolled away, because there is nothing to track.
        const adapter = this._ctx.adapter;
        const now = adapter.minutesOfDay(adapter.now());
        if (centre && now >= minMinutes && now < maxMinutes)
          this._scrollTo(now, 'center');
        else this._scrollTo(this._initialMinutes());
      });
    });

    // `_scrollTo` reads `minMinutes` / `slotDuration` to turn minutes into
    // pixels, so tracking its body would subscribe this effect to the axis
    // too — and because it is the LATER writer (see above), a request that is
    // never cleared would then re-apply itself on top of the initial scroll
    // every time the axis changed. It must fire for a new request only; a new
    // `sequence` still re-runs it, since that is read outside `untracked`.
    afterRenderEffect(() => {
      const request = this._ctx.scrollRequest();
      // A request this instance was born with is stale — see
      // `_seenScrollSequence`. Every later sequence is honoured as before.
      if (!request || request.sequence <= this._seenScrollSequence) return;
      untracked(() => this._scrollTo(parseTime(request.time)));
    });

    afterRenderEffect((onCleanup) => {
      const sheet = this._sheet().nativeElement;
      if (!this._isBrowser) return;
      const detach = this._zone.runOutsideAngular(() =>
        attachPointerDrag(
          sheet,
          {
            onStart: () => {
              const pos = this._pendingAnchor;
              if (!pos || !this._ctx.selectable()) return;
              this._zone.run(() =>
                this._selection.set({ anchor: pos, head: pos }),
              );
            },
            onMove: (at, event) => {
              const s = this._selection();
              // The slot under the POINTER, not the event's target: a touch
              // pointer is implicitly captured by the slot it went down on, so
              // the target never changes for the whole gesture (see `elementAt`).
              const pos = this._positionAt(
                elementAt(this._host.ownerDocument, at, event.target),
              );
              if (
                !s ||
                !pos ||
                (pos.minutes === null) !== (s.anchor.minutes === null)
              )
                return;
              if (
                pos.dayIndex === s.head.dayIndex &&
                pos.minutes === s.head.minutes
              )
                return;
              this._zone.run(() =>
                this._selection.set({ anchor: s.anchor, head: pos }),
              );
            },
            onEnd: (_p, moved) => {
              this._pendingAnchor = null;
              // Only a drag that actually painted a selection commits one and
              // swallows the click that trails it. A drag with `selectable`
              // off (or one whose `onStart` found no cell) paints nothing and
              // must leave the following click alone.
              if (!moved || !this._selection()) return;
              this._suppressNextClick();
              this._zone.run(() => this._commitSelection('pointer'));
            },
            onCancel: () => {
              this._pendingAnchor = null;
              // Escape cancels mid-gesture while the pointer is still down, so
              // the release still fires a native `click` on the cell. Without
              // this the cancelled drag would emit the `slotClick` the user
              // just backed out of.
              if (this._selection()) this._suppressNextClick();
              this._zone.run(() => this._selection.set(null));
            },
          },
          {
            capture: false,
            threshold: 5,
            // Touch arms on a short press, not on movement: the sheet is wider
            // than the scroller on a narrow screen, so a swipe has to pan it
            // rather than paint a range selection.
            touchDelay: TOUCH_GESTURE_DELAY,
            ignore: (t) => !!t.closest('.mlv-scheduler-event, button'),
          },
        ),
      );
      onCleanup(detach);
    });
  }

  /** @protected Pointer interaction on a slot. */
  protected _onSlotPointer(
    kind: MlvSchedulerInteractionKind,
    column: MlvSchedulerTimeColumn<D>,
    slot: MlvSchedulerSlot,
    event: MouseEvent,
  ): void {
    if (kind === 'click' && performance.now() < this._ignoreClicksUntil) return;
    if ((event.target as HTMLElement).closest('.mlv-scheduler-event')) return;
    this._ctx.emitSlotInteraction(kind, {
      date: this._slotDate(column.date, slot.minutes),
      allDay: false,
      element: event.currentTarget as HTMLElement,
      nativeEvent: event,
    });
  }

  /** @protected Pointer interaction on an all-day cell. */
  protected _onAllDayPointer(
    kind: MlvSchedulerInteractionKind,
    column: MlvSchedulerTimeColumn<D>,
    event: MouseEvent,
  ): void {
    if (kind === 'click' && performance.now() < this._ignoreClicksUntil) return;
    if ((event.target as HTMLElement).closest('.mlv-scheduler-event')) return;
    this._ctx.emitSlotInteraction(kind, {
      date: column.date,
      allDay: true,
      element: event.currentTarget as HTMLElement,
      nativeEvent: event,
    });
  }

  /** @protected Roving focus bookkeeping. */
  protected _onCellFocus(event: FocusEvent): void {
    this._focus.set(this._positionOf(event.currentTarget as HTMLElement));
  }

  /**
   * @protected Keyboard navigation for a focused slot / all-day cell.
   *
   * Guards on `event.target`, not `event.currentTarget`: an all-day chip is a
   * DOM descendant of its `.all-day-cell` (unlike a timed chip, which is a
   * sibling of the `.slot` elements under `.column`), so a keydown bubbling up
   * from a focused chip would otherwise reach this handler and be treated as
   * grid navigation. Only a keydown whose actual target is the cell itself —
   * never a bubbled one — carries these attributes.
   */
  protected _onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (
      !target.hasAttribute('data-minutes') ||
      !target.hasAttribute('data-day-index')
    )
      return;
    if (event.key === 'Escape' && this._selection()) {
      event.preventDefault();
      this._selection.set(null);
      return;
    }
    if (event.key === 'Enter' && this._selection()) {
      event.preventDefault();
      this._commitSelection('keyboard');
      return;
    }
    const arrow = this._rtl.normalizeArrowKey(event);
    if (event.shiftKey && arrow !== null && this._ctx.selectable()) {
      event.preventDefault();
      this._extendSelection(arrow);
      return;
    }
    const position = this._positionOf(target);
    const days = this._ctx.days();
    const slotDuration = this._ctx.slotDuration();
    const min = this._ctx.minMinutes();
    // The start of the last RENDERED row, not `maxMinutes − slotDuration`:
    // rows run `min, min + slot, …` while `< max`, so for a window whose span
    // is not a whole number of slots the two differ and the old expression
    // named a minute no cell carries. `_focusCell` would then write `_focus` to
    // a phantom position, focus nothing, and leave the grid with no
    // `tabindex="0"` at all — i.e. out of the tab order entirely.
    const last = this._lastSlotMinutes();
    let handled = true;
    switch (arrow ?? event.key) {
      case RIGHT_ARROW:
        this._moveDay(position, 1);
        break;
      case LEFT_ARROW:
        this._moveDay(position, -1);
        break;
      case DOWN_ARROW:
        this._focusCell(
          position.dayIndex,
          position.minutes === null
            ? min
            : Math.min(last, position.minutes + slotDuration),
        );
        break;
      case UP_ARROW:
        this._focusCell(
          position.dayIndex,
          position.minutes === null
            ? null
            : position.minutes === min
              ? null
              : position.minutes - slotDuration,
        );
        break;
      case 'Home':
        this._focusCell(0, event.ctrlKey ? min : position.minutes);
        break;
      case 'End':
        this._focusCell(
          days.length - 1,
          event.ctrlKey ? last : position.minutes,
        );
        break;
      case 'PageUp':
        this._jump(
          this._ctx.adapter.addCalendarDays(
            days[position.dayIndex],
            this._ctx.view() === 'day' ? -1 : -7,
          ),
          position.minutes,
        );
        break;
      case 'PageDown':
        this._jump(
          this._ctx.adapter.addCalendarDays(
            days[position.dayIndex],
            this._ctx.view() === 'day' ? 1 : 7,
          ),
          position.minutes,
        );
        break;
      case ' ':
        this._emitKeyboardSlot(position, target, event);
        break;
      case 'Enter': {
        const chip = this._chipAt(position);
        if (chip) chip.focus();
        else this._emitKeyboardSlot(position, target, event);
        break;
      }
      default:
        handled = false;
    }
    // A pending selection is anchored on the cell it was started from, so any
    // plain (unmodified) navigation or activation abandons it: a later `Enter`
    // must activate the focused cell, not commit a range the user has since
    // navigated away from, and the next `Shift+Arrow` must re-anchor on the
    // live focus rather than grow from the stale head.
    if (handled && this._selection()) this._selection.set(null);
    if (handled) event.preventDefault();
  }

  /**
   * @private Grows/shrinks the keyboard selection by one cell from the focused
   * cell, clamped to the visible range.
   *
   * A clamped extension — `Shift+ArrowDown` on the last row, `Shift+ArrowRight`
   * on the last day — leaves the head where it was and returns without writing
   * or re-announcing: repeating the identical hint on every further press is
   * noise, and a `linkedSignal` write of an equal-looking new object would
   * still invalidate every cell's `aria-selected` binding.
   */
  private _extendSelection(arrow: number): void {
    const focus = this._focus();
    const current = this._selection() ?? { anchor: focus, head: focus };
    const dayCount = this._ctx.days().length;
    let { dayIndex, minutes } = current.head;
    if (arrow === LEFT_ARROW || arrow === RIGHT_ARROW) {
      dayIndex = Math.min(
        dayCount - 1,
        Math.max(0, dayIndex + (arrow === RIGHT_ARROW ? 1 : -1)),
      );
    } else if (minutes !== null) {
      const step = this._ctx.slotDuration() * (arrow === DOWN_ARROW ? 1 : -1);
      minutes = Math.min(
        this._lastSlotMinutes(),
        Math.max(this._ctx.minMinutes(), minutes + step),
      );
    }
    if (
      this._selection() &&
      dayIndex === current.head.dayIndex &&
      minutes === current.head.minutes
    ) {
      return;
    }
    this._selection.set({
      anchor: current.anchor,
      head: { dayIndex, minutes },
    });
    this._announceSelection();
  }

  /**
   * @private Reads the selection back as a `selectionHint` announcement.
   *
   * The timed hint names `_selectionRange()`'s exclusive end verbatim, so it
   * always matches what a following `Enter` emits. The all-day hint names the
   * **inclusive** last day instead — "Mar 3 to Mar 5", not the exclusive
   * `Mar 6` — so it reads the bounds rather than the range for that half.
   */
  private _announceSelection(): void {
    const b = this._selectedBounds();
    const range = this._selectionRange();
    if (!b || !range) return;
    const ctx = this._ctx;
    const days = ctx.days();
    const start = b.allDay
      ? ctx.adapter.getDateLabel(days[b.dayFrom])
      : ctx.formatDateTime(range.start);
    const end = b.allDay
      ? ctx.adapter.getDateLabel(days[b.dayTo])
      : ctx.formatDateTime(range.end);
    ctx.announce(ctx.translate('selectionHint', { start, end }));
  }

  /** @private `08:00`, or the business-hours start. */
  private _initialMinutes(): number {
    const start = this._ctx.businessHours()?.start;
    return start ? parseTime(start) : 8 * 60;
  }

  /**
   * @private Clamps to the RENDERED rows and snaps down to a slot start.
   *
   * The ceiling is the last rendered row (`_lastSlotMinutes`), not
   * `maxMinutes − slotDuration`: for a window whose span is not a whole number
   * of slots the latter sits below the final row, so a `scrollToTime` near the
   * end of the day would stop one row short and a snapped focus request would
   * miss the row it names.
   */
  private _snapToSlot(minutes: number): number {
    const min = this._ctx.minMinutes();
    const slot = this._ctx.slotDuration();
    const clamped = Math.min(this._lastSlotMinutes(), Math.max(min, minutes));
    return min + Math.floor((clamped - min) / slot) * slot;
  }

  /**
   * @private Puts `minutes` at the top of the viewport (`'start'`) or in the
   * middle of it (`'center'`); nothing measurable → no-op.
   *
   * `'start'` snaps down to the slot that owns `minutes`, then scrolls half an
   * hour-label height back off: the label is centred ON its line
   * (`translate: 0 -50%`), so putting the line itself at the very top of the
   * visible area clips the label's upper half behind the sticky header.
   * `scrollOffsetFor` clamps the result at 0.
   *
   * `'center'` keeps the exact minute — the wall clock does not sit on a slot
   * boundary — clamped into `[minMinutes, maxMinutes]`, and gives back half the
   * VISIBLE region instead of the label headroom. The day-header row and the
   * all-day band are sticky inside the scroll viewport, so they cover its top
   * edge for the whole scroll: centring on `clientHeight / 2` would put the
   * minute half that band ABOVE the visual centre. No label correction is
   * needed — the target is nowhere near the top edge. The far end is clamped
   * by the browser.
   */
  private _scrollTo(
    minutes: number,
    align: 'start' | 'center' = 'start',
  ): void {
    const slot = this._host.querySelector<HTMLElement>(
      '.mlv-scheduler-time-grid__slot',
    );
    if (!slot) return;
    const viewport = this._scrollbar().viewportElement;
    if (align === 'center') {
      const target = Math.min(
        this._ctx.maxMinutes(),
        Math.max(this._ctx.minMinutes(), minutes),
      );
      const top = this._host.querySelector<HTMLElement>(
        '.mlv-scheduler-time-grid__top',
      );
      viewport.scrollTop = scrollOffsetFor(
        target,
        this._ctx.minMinutes(),
        this._ctx.slotDuration(),
        slot.offsetHeight,
        (viewport.clientHeight + (top?.offsetHeight ?? 0)) / 2,
      );
      return;
    }
    const label = this._host.querySelector<HTMLElement>(
      '.mlv-scheduler-time-grid__hour',
    );
    viewport.scrollTop = scrollOffsetFor(
      this._snapToSlot(minutes),
      this._ctx.minMinutes(),
      this._ctx.slotDuration(),
      slot.offsetHeight,
      (label?.offsetHeight ?? 0) / 2,
    );
  }

  /**
   * @private Reads a cell's position back off its own `data-day-index` /
   * `data-minutes` attributes — the single decoder of that pair.
   *
   * `data-minutes="all-day"` is the sentinel for the all-day row and decodes to
   * `null` minutes; every other value is a slot's start minute. The element
   * MUST be a cell (both attributes present); callers that start from an
   * arbitrary event target go through `_positionAt`, which resolves the cell
   * first and returns `null` when there is none.
   */
  private _positionOf(element: HTMLElement): MlvSchedulerGridPos {
    const minutes = element.dataset['minutes'];
    return {
      dayIndex: Number(element.dataset['dayIndex']),
      minutes: minutes === 'all-day' ? null : Number(minutes),
    };
  }

  /** @private Steps one visible day, navigating past the range edge. */
  private _moveDay(position: MlvSchedulerGridPos, direction: -1 | 1): void {
    const days = this._ctx.days();
    const next = position.dayIndex + direction;
    if (next >= 0 && next < days.length) {
      this._focusCell(next, position.minutes);
      return;
    }
    this._jump(
      nextVisibleDate(
        this._ctx.adapter,
        days[position.dayIndex],
        direction,
        this._ctx.hiddenDays(),
      ),
      position.minutes,
    );
  }

  /** @private Navigate and focus the same slot on `date` after render. */
  private _jump(date: D, minutes: number | null): void {
    this._ctx.pendingFocus.set({ kind: 'cell', date, minutes });
    this._ctx.goTo(date);
  }

  /**
   * @private Moves the roving tab stop to one cell and gives it DOM focus.
   *
   * Both halves matter: `_focus` is what the template's `tabindex` binding
   * reads, so a position no cell carries would leave the grid without a tab
   * stop at all. Callers therefore pass a `dayIndex` inside `days()` and a
   * minute that is a rendered row start (`_lastSlotMinutes` is the ceiling) or
   * `null` for the all-day row. `?.` on the query only guards a not-yet-
   * rendered grid, not an invalid position.
   */
  private _focusCell(dayIndex: number, minutes: number | null): void {
    this._focus.set({ dayIndex, minutes });
    findCellElement(this._host, dayIndex, minutes)?.focus();
  }

  /**
   * @private First chip whose segment starts inside the slot, or the first all-day chip of the day.
   * Skips the drag-preview ghost — it is `aria-hidden`/`tabindex="-1"` and must never receive focus.
   */
  private _chipAt(position: MlvSchedulerGridPos): HTMLElement | null {
    if (!this._columns()[position.dayIndex]) return null;
    const minutes = position.minutes;
    if (minutes === null) {
      const first = this._lanesOf(position.dayIndex).find(
        (s) => !s.normalized.ghost,
      );
      return first
        ? findEventElement(this._host, first.normalized.event.id)
        : null;
    }
    const end = minutes + this._ctx.slotDuration();
    const segment = this._segmentsOf(position.dayIndex).find(
      (s) =>
        !s.normalized.ghost &&
        s.startMinutes >= minutes &&
        s.startMinutes < end,
    );
    return segment
      ? findEventElement(this._host, segment.normalized.event.id)
      : null;
  }

  /**
   * @private The concrete date a slot stands for: `day` at `minutes`.
   *
   * `minutes` can reach `MINUTES_PER_DAY` (a `maxTime` of `'24:00'` with the
   * selection's exclusive end), which is the NEXT day's midnight — the adapter
   * rejects an hour of 24, so that case rolls the day over instead.
   */
  private _slotDate(day: D, minutes: number): D {
    return minutes >= MINUTES_PER_DAY
      ? this._ctx.adapter.addCalendarDays(day, 1)
      : this._ctx.adapter.withTime(day, Math.floor(minutes / 60), minutes % 60);
  }

  /**
   * @private Emits `slotClick` for a cell activated from the keyboard
   * (`Space`, or `Enter` on a cell with no chip).
   *
   * The payload is the same shape a pointer click produces — an all-day cell
   * reports the plain day with `allDay: true`, a slot reports its start
   * instant — so consumers need no source-specific branch; `element` is the
   * cell itself, which is what a consumer anchors a menu or popover to.
   */
  private _emitKeyboardSlot(
    position: MlvSchedulerGridPos,
    element: HTMLElement,
    nativeEvent: KeyboardEvent,
  ): void {
    const day = this._ctx.days()[position.dayIndex];
    this._ctx.emitSlotInteraction('click', {
      date:
        position.minutes === null ? day : this._slotDate(day, position.minutes),
      allDay: position.minutes === null,
      element,
      nativeEvent,
    });
  }
}
