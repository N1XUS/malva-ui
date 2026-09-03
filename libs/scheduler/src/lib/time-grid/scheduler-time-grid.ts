import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  PLATFORM_ID,
  ViewEncapsulation,
  afterNextRender,
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
import { attachPointerDrag } from '../drag/scheduler-pointer';
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

/** Pixel offset that puts `minutes` at the top of the viewport. */
export function scrollOffsetFor(
  minutes: number,
  minMinutes: number,
  slotDuration: number,
  slotHeightPx: number,
): number {
  return Math.max(0, ((minutes - minMinutes) / slotDuration) * slotHeightPx);
}

/** Weekdays (0 = Sunday) `MlvSchedulerBusinessHours.days` defaults to, per `isBusinessSlot`. */
const DEFAULT_BUSINESS_DAYS: readonly number[] = [1, 2, 3, 4, 5];

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

interface MlvSchedulerSlot {
  readonly minutes: number;
  readonly label: string;
  readonly business: boolean;
  readonly hour: boolean;
}

interface MlvSchedulerTimeColumn<D, TData> {
  readonly dayIndex: number;
  readonly date: D;
  readonly label: string;
  readonly weekday: string;
  readonly dayNumber: string;
  readonly today: boolean;
  readonly slots: readonly MlvSchedulerSlot[];
  readonly segments: readonly MlvSchedulerClusteredSegment<D, TData>[];
  /** All-day lane segments starting on this day. */
  readonly laneSegments: readonly MlvSchedulerLaneSegment<D, TData>[];
}

/** Focus position inside the grid: `minutes === null` is the all-day row. */
interface MlvSchedulerGridFocus {
  readonly dayIndex: number;
  readonly minutes: number | null;
}

/** @internal Position of a grid cell: a day and a slot start, or `null` minutes for the all-day row. */
interface GridPos {
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
  /** @protected Visible span in minutes. */
  protected readonly _spanMinutes = computed(
    () => this._ctx.maxMinutes() - this._ctx.minMinutes(),
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

  /** @protected Hour labels for the gutter, with their block offset in percent. */
  protected readonly _hours = computed(() => {
    const min = this._ctx.minMinutes();
    const max = this._ctx.maxMinutes();
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
        offset: ((minutes - min) / (max - min)) * 100,
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

  /** @protected One entry per visible day. */
  protected readonly _columns = computed<MlvSchedulerTimeColumn<D, TData>[]>(
    () => {
      const adapter = this._ctx.adapter;
      const days = this._ctx.days();
      const min = this._ctx.minMinutes();
      const max = this._ctx.maxMinutes();
      const slotDuration = this._ctx.slotDuration();
      const window = this._businessWindow();
      const today = this._ctx.today();
      const weekdays = adapter.getDayOfWeekNames('short');
      const clustered = clusterColumns(
        sliceColumns(adapter, this._events(), days, min, max),
      );
      const lanes = this._allDayLayout().visible;
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
            business:
              !!window &&
              window.days.includes(dayOfWeek) &&
              minutes >= window.start &&
              minutes < window.end,
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
          segments: clustered.filter(
            (segment) => segment.dayIndex === dayIndex,
          ),
          laneSegments: lanes.filter(
            (segment) => segment.startIndex === dayIndex,
          ),
        };
      });
    },
  );

  /** @protected Now-line offset in percent, `null` when hidden. */
  protected readonly _nowOffset = computed(() => {
    if (!this._ctx.showCurrentTime()) return null;
    const minutes = this._ctx.nowMinutes();
    const min = this._ctx.minMinutes();
    const max = this._ctx.maxMinutes();
    if (minutes < min || minutes > max) return null;
    return ((minutes - min) / (max - min)) * 100;
  });

  /** @private Today if visible else the first day; slot = the initial scroll time. */
  private readonly _defaultFocus = computed<MlvSchedulerGridFocus>(() => {
    const todayIndex = dayIndexOf(
      this._ctx.adapter,
      this._ctx.days(),
      this._ctx.today(),
    );
    return {
      dayIndex: Math.max(0, todayIndex),
      minutes: this._snapToSlot(this._initialMinutes()),
    };
  });
  /** @protected The one cell with `tabindex="0"`; resets when days or hours change. */
  protected readonly _focus = linkedSignal<MlvSchedulerGridFocus>(() => {
    this._ctx.days();
    this._ctx.minMinutes();
    return this._defaultFocus();
  });

  /** @internal Range selection anchor/head; `null` when nothing is selected. Resets when the range changes. */
  protected readonly _selection = linkedSignal<
    readonly D[],
    { anchor: GridPos; head: GridPos } | null
  >({
    source: this._ctx.days,
    computation: () => null,
  });

  /** @internal Selected rectangle: day span and minute span (or all-day). */
  protected readonly _selectedBounds = computed(() => {
    const s = this._selection();
    if (!s) return null;
    const allDay = s.anchor.minutes === null;
    const a = s.anchor.minutes ?? 0;
    const h = s.head.minutes ?? a;
    return {
      allDay,
      dayFrom: Math.min(s.anchor.dayIndex, s.head.dayIndex),
      dayTo: Math.max(s.anchor.dayIndex, s.head.dayIndex),
      from: allDay ? 0 : Math.min(a, h),
      to: allDay ? 0 : Math.max(a, h),
    };
  });

  /** @internal Whether a cell is inside the selection. Called from the template per cell. */
  protected _isSelected(dayIndex: number, minutes: number | null): boolean {
    const b = this._selectedBounds();
    if (!b || dayIndex < b.dayFrom || dayIndex > b.dayTo) return false;
    if (b.allDay) return minutes === null;
    return minutes !== null && minutes >= b.from && minutes <= b.to;
  }

  /** @private Timestamp until which a `click` on a cell is ignored (the click that trails a drag-select). */
  private _ignoreClicksUntil = 0;

  /** @private Cell under the pointer at pointerdown; becomes the anchor once the drag threshold is crossed. */
  private _pendingAnchor: GridPos | null = null;

  /** @private Reads the cell position off an event target. */
  private _posOf(target: EventTarget | null): GridPos | null {
    const cell = (target as Element | null)?.closest<HTMLElement>(
      '[data-day-index][data-minutes]',
    );
    if (!cell) return null;
    const minutes =
      cell.dataset['minutes'] === 'all-day'
        ? null
        : Number(cell.dataset['minutes']);
    return { dayIndex: Number(cell.dataset['dayIndex']), minutes };
  }

  /** @internal Remembers the pressed cell for the range-select tracker. */
  protected _onSheetPointerDown(event: Event): void {
    this._pendingAnchor = this._posOf(event.target);
  }

  /** @internal Commits the selection as a `rangeSelect` and clears it. */
  protected _commitSelection(
    source: MlvSchedulerRangeSelectEvent<D>['source'],
  ): void {
    const b = this._selectedBounds();
    this._selection.set(null);
    if (!b) return;
    const ctx = this._ctx;
    const adapter = ctx.adapter;
    const days = ctx.days();
    if (b.allDay) {
      ctx.emitRangeSelect({
        start: adapter.startOfDay(days[b.dayFrom]),
        end: adapter.addCalendarDays(days[b.dayTo], 1),
        allDay: true,
        source,
      });
      return;
    }
    const start = adapter.withTime(
      days[b.dayFrom],
      Math.floor(b.from / 60),
      b.from % 60,
    );
    const endMinutes = Math.min(b.to + ctx.slotDuration(), ctx.maxMinutes());
    const endDay = days[b.dayTo];
    const end =
      endMinutes >= 1440
        ? adapter.startOfDay(adapter.addCalendarDays(endDay, 1))
        : adapter.withTime(
            endDay,
            Math.floor(endMinutes / 60),
            endMinutes % 60,
          );
    ctx.emitRangeSelect({ start, end, allDay: false, source });
  }

  constructor() {
    afterRenderEffect(() => {
      const request = this._ctx.pendingFocus();
      if (!request) return;
      let element: HTMLElement | null;
      if (request.kind === 'event') {
        element = findEventElement(this._host, request.id);
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
      if (!element) return;
      untracked(() => {
        this._ctx.pendingFocus.set(null);
        if (request.kind === 'cell') this._focus.set(this._positionOf(element));
      });
      element.focus();
    });

    afterRenderEffect(() => {
      const request = this._ctx.scrollRequest();
      if (!request) return;
      this._scrollTo(parseTime(request.time));
    });

    afterNextRender(() => this._scrollTo(this._initialMinutes()));

    afterRenderEffect((onCleanup) => {
      const sheet = this._sheet()?.nativeElement;
      if (!sheet || !this._isBrowser) return;
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
            onMove: (_p, event) => {
              const s = this._selection();
              const pos = this._posOf(event.target);
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
              if (!moved) return;
              this._ignoreClicksUntil = performance.now() + 300;
              this._zone.run(() => this._commitSelection('pointer'));
            },
            onCancel: () => {
              this._pendingAnchor = null;
              this._zone.run(() => this._selection.set(null));
            },
          },
          {
            capture: false,
            threshold: 5,
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
    column: MlvSchedulerTimeColumn<D, TData>,
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
    column: MlvSchedulerTimeColumn<D, TData>,
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
    const last = this._ctx.maxMinutes() - slotDuration;
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
    if (handled) event.preventDefault();
  }

  /** @private Grows/shrinks the keyboard selection by one cell from the focused cell, clamped to the visible range. */
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
      const slot = this._ctx.slotDuration();
      const step = slot * (arrow === DOWN_ARROW ? 1 : -1);
      minutes = Math.min(
        this._ctx.maxMinutes() - slot,
        Math.max(this._ctx.minMinutes(), minutes + step),
      );
    }
    this._selection.set({
      anchor: current.anchor,
      head: { dayIndex, minutes },
    });
    this._announceSelection();
  }

  /** @private Reads the selection bounds back as a `selectionHint` announcement. */
  private _announceSelection(): void {
    const b = this._selectedBounds();
    if (!b) return;
    const ctx = this._ctx;
    const adapter = ctx.adapter;
    const days = ctx.days();
    const endMinutes = Math.min(b.to + ctx.slotDuration(), ctx.maxMinutes());
    const start = b.allDay
      ? adapter.getDateLabel(days[b.dayFrom])
      : ctx.formatDateTime(
          adapter.withTime(
            days[b.dayFrom],
            Math.floor(b.from / 60),
            b.from % 60,
          ),
        );
    // Same roll-over as `_commitSelection`: the exclusive end of the last slot
    // is 1440, which is the next day's midnight, not an invalid `24:00` time.
    const end = b.allDay
      ? adapter.getDateLabel(days[b.dayTo])
      : ctx.formatDateTime(
          endMinutes >= 1440
            ? adapter.startOfDay(adapter.addCalendarDays(days[b.dayTo], 1))
            : adapter.withTime(
                days[b.dayTo],
                Math.floor(endMinutes / 60),
                endMinutes % 60,
              ),
        );
    ctx.announce(ctx.translate('selectionHint', { start, end }));
  }

  /** @private `08:00`, or the business-hours start. */
  private _initialMinutes(): number {
    const start = this._ctx.businessHours()?.start;
    return start ? parseTime(start) : 8 * 60;
  }

  /** @private Clamps to the visible range and snaps down to a slot start. */
  private _snapToSlot(minutes: number): number {
    const min = this._ctx.minMinutes();
    const slot = this._ctx.slotDuration();
    const last = this._ctx.maxMinutes() - slot;
    const clamped = Math.min(last, Math.max(min, minutes));
    return min + Math.floor((clamped - min) / slot) * slot;
  }

  /** @private Scrolls the viewport so `minutes` sits at the top; nothing measurable → no-op. */
  private _scrollTo(minutes: number): void {
    const slot = this._host.querySelector<HTMLElement>(
      '.mlv-scheduler-time-grid__slot',
    );
    if (!slot) return;
    const viewport = this._scrollbar().viewportElement;
    viewport.scrollTop = scrollOffsetFor(
      this._snapToSlot(minutes),
      this._ctx.minMinutes(),
      this._ctx.slotDuration(),
      slot.offsetHeight,
    );
  }

  /** @private */
  private _positionOf(element: HTMLElement): MlvSchedulerGridFocus {
    const minutes = element.dataset['minutes'];
    return {
      dayIndex: Number(element.dataset['dayIndex']),
      minutes: minutes === 'all-day' ? null : Number(minutes),
    };
  }

  /** @private Steps one visible day, navigating past the range edge. */
  private _moveDay(position: MlvSchedulerGridFocus, direction: -1 | 1): void {
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

  /** @private */
  private _focusCell(dayIndex: number, minutes: number | null): void {
    this._focus.set({ dayIndex, minutes });
    findCellElement(this._host, dayIndex, minutes)?.focus();
  }

  /**
   * @private First chip whose segment starts inside the slot, or the first all-day chip of the day.
   * Skips the drag-preview ghost — it is `aria-hidden`/`tabindex="-1"` and must never receive focus.
   */
  private _chipAt(position: MlvSchedulerGridFocus): HTMLElement | null {
    const column = this._columns()[position.dayIndex];
    if (!column) return null;
    const minutes = position.minutes;
    if (minutes === null) {
      const first = column.laneSegments.find((s) => !s.normalized.ghost);
      return first
        ? findEventElement(this._host, first.normalized.event.id)
        : null;
    }
    const end = minutes + this._ctx.slotDuration();
    const segment = column.segments.find(
      (s) =>
        !s.normalized.ghost &&
        s.startMinutes >= minutes &&
        s.startMinutes < end,
    );
    return segment
      ? findEventElement(this._host, segment.normalized.event.id)
      : null;
  }

  /** @private */
  private _slotDate(day: D, minutes: number): D {
    return minutes >= MINUTES_PER_DAY
      ? this._ctx.adapter.addCalendarDays(day, 1)
      : this._ctx.adapter.withTime(day, Math.floor(minutes / 60), minutes % 60);
  }

  /** @private */
  private _emitKeyboardSlot(
    position: MlvSchedulerGridFocus,
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
