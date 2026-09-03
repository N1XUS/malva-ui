import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  PLATFORM_ID,
  ViewContainerRef,
  ViewEncapsulation,
  afterRenderEffect,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { attachPointerDrag } from '../drag/scheduler-pointer';
import {
  DOWN_ARROW,
  LEFT_ARROW,
  RIGHT_ARROW,
  UP_ARROW,
} from '@angular/cdk/keycodes';
import { MlvPopupService, type MlvPopupHandle } from '@malva-ui/core/popup';
import { MlvResizeObserverService, MlvRtlService } from '@malva-ui/cdk/utils';
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
  dayIndexOf,
  layoutRow,
  sliceRows,
  type MlvSchedulerLaneSegment,
  type MlvSchedulerRowSegment,
} from '../layout/scheduler-layout';
import {
  MLV_SCHEDULER_CONTEXT,
  type MlvSchedulerContext,
  type MlvSchedulerInteractionKind,
} from '../scheduler/scheduler-context';
import type {
  MlvSchedulerEvent,
  MlvSchedulerRangeSelectEvent,
} from '../scheduler/scheduler.types';

/** Lanes assumed while nothing can be measured (server, jsdom, zero-height host). */
const FALLBACK_VISIBLE_LANES = 3;

/** One rendered day cell. */
interface MlvSchedulerMonthCell<D, TData> {
  readonly dayIndex: number;
  readonly date: D;
  readonly dayNumber: string;
  readonly label: string;
  readonly outside: boolean;
  readonly today: boolean;
  /** Visible segments that start in this cell (spanning bars live in their start cell). */
  readonly segments: readonly MlvSchedulerLaneSegment<D, TData>[];
  /** Every segment touching this day, visible or not — the popover list. */
  readonly all: readonly MlvSchedulerRowSegment<D, TData>[];
  /** Hidden events of this day. */
  readonly hidden: readonly MlvSchedulerEvent<D, TData>[];
  readonly moreText: string;
  readonly moreLabel: string;
}

/** One rendered week row. */
interface MlvSchedulerMonthRow<D, TData> {
  readonly index: number;
  readonly cells: readonly MlvSchedulerMonthCell<D, TData>[];
}

/** @internal Position of a grid cell: a day. The month grid selects whole days only. */
interface MonthPos {
  readonly dayIndex: number;
}

/**
 * Month grid: week rows of day cells, lane-packed event bars, a per-row
 * "+N more" overflow and roving-tabindex keyboard navigation.
 */
@Component({
  selector: 'mlv-scheduler-month',
  templateUrl: './scheduler-month.html',
  styleUrl: './scheduler-month.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MlvSchedulerEventChip, MlvSchedulerDropList],
  host: {
    class: 'mlv-scheduler-month',
    '[style.--mlv-scheduler-row-length]': '_ctx.rowLength()',
  },
})
export class MlvSchedulerMonth<D = Date, TData = unknown> {
  /** @protected Root context. */
  protected readonly _ctx = inject(
    MLV_SCHEDULER_CONTEXT,
  ) as MlvSchedulerContext<D, TData>;
  /** @private Host element for focus queries. */
  private readonly _host = inject(ElementRef<HTMLElement>).nativeElement;
  /** @private Mirrors horizontal arrow keys in RTL. */
  private readonly _rtl = inject(MlvRtlService);
  /** @private Row height → visible lanes. */
  private readonly _resizeObserver = inject(MlvResizeObserverService);
  /** @private Overflow popover. */
  private readonly _popup = inject(MlvPopupService);
  /** @private Portal host for the popover template. */
  private readonly _vcr = inject(ViewContainerRef);
  /** @private Measurement runs outside the zone. */
  private readonly _zone = inject(NgZone);
  /** @private No measurement on the server. */
  private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  /** @private Closes the popover on destroy. */
  private readonly _destroyRef = inject(DestroyRef);
  /** @private Drag engine of the owning scheduler. */
  private readonly _drag = inject(MlvSchedulerDragService<D, TData>);

  /** @internal Model events plus the drag preview ghost. */
  protected readonly _events = computed(() =>
    this._drag.withPreview(this._ctx.normalizedEvents()),
  );

  /** @private Week-row container, observed for size. */
  private readonly _grid = viewChild.required<ElementRef<HTMLElement>>('grid');
  /** @private Lane-height probe (one lane tall). */
  private readonly _probe =
    viewChild.required<ElementRef<HTMLElement>>('probe');
  /** @private Popover template. */
  private readonly _popoverTemplate =
    viewChild.required<TemplateRef<unknown>>('popover');

  /** @protected Lanes that fit in a row; measured, `FALLBACK_VISIBLE_LANES` until then. */
  protected readonly _visibleLanes = signal(FALLBACK_VISIBLE_LANES);
  // Deliberately NOT published as a host custom property: `__lanes` is a
  // `grid-auto-rows` track list, so no stylesheet needs the count. The lane a
  // chip (or the `+N more` button) occupies is written per element as
  // `--mlv-scheduler-lane`. Do not add a `[style.--mlv-scheduler-visible-lanes]`
  // binding that nothing reads.
  /** @protected Cell shown in the overflow popover, `null` when closed. */
  protected readonly _popoverCell = signal<MlvSchedulerMonthCell<
    D,
    TData
  > | null>(null);
  /** @private Open popover handle. */
  private _popoverHandle: MlvPopupHandle | null = null;

  /** @protected Short weekday names for the header, in row order. */
  protected readonly _weekdays = computed(() => {
    const names = this._ctx.adapter.getDayOfWeekNames('short');
    return this._ctx
      .days()
      .slice(0, this._ctx.rowLength())
      .map((day) => names[this._ctx.adapter.getDayOfWeek(day)]);
  });

  /** @protected Grid accessible name. */
  protected readonly _gridLabel = computed(() =>
    this._ctx.translate('gridLabel', {
      view: 'month',
      period: this._ctx.adapter.getMonthYearLabel(this._ctx.date()),
    }),
  );

  /** @protected Rows → cells → segments, all derived from the visible days. */
  protected readonly _rows = computed<MlvSchedulerMonthRow<D, TData>[]>(() => {
    const adapter = this._ctx.adapter;
    const days = this._ctx.days();
    const rowLength = this._ctx.rowLength();
    const today = this._ctx.today();
    const anchorMonth = adapter.getMonth(this._ctx.date());
    const visibleLanes = this._visibleLanes();
    const segments = sliceRows(adapter, this._events(), days, rowLength, 'all');
    const byRow = new Map<number, MlvSchedulerRowSegment<D, TData>[]>();
    for (const segment of segments) {
      const row = Math.floor(segment.startIndex / rowLength);
      byRow.set(row, [...(byRow.get(row) ?? []), segment]);
    }
    const rows: MlvSchedulerMonthRow<D, TData>[] = [];
    for (let row = 0; row * rowLength < days.length; row++) {
      const rowSegments = byRow.get(row) ?? [];
      const layout = layoutRow(assignLanes(adapter, rowSegments), visibleLanes);
      const cells: MlvSchedulerMonthCell<D, TData>[] = [];
      for (
        let dayIndex = row * rowLength;
        dayIndex < Math.min(days.length, (row + 1) * rowLength);
        dayIndex++
      ) {
        const date = days[dayIndex];
        const isToday = adapter.sameDate(date, today);
        const label = adapter.getDateLabel(date);
        const hidden = (layout.hiddenByDay.get(dayIndex) ?? []).map(
          (segment) => segment.normalized.event,
        );
        cells.push({
          dayIndex,
          date,
          dayNumber: adapter.getDayOfMonthLabel(date),
          label: isToday
            ? this._ctx.translate('dayLabelToday', { date: label })
            : label,
          outside: adapter.getMonth(date) !== anchorMonth,
          today: isToday,
          segments: layout.visible.filter(
            (segment) => segment.startIndex === dayIndex,
          ),
          all: rowSegments.filter(
            (segment) =>
              segment.startIndex <= dayIndex && segment.endIndex >= dayIndex,
          ),
          hidden,
          moreText: this._ctx.translate('moreEvents', { count: hidden.length }),
          moreLabel: this._ctx.translate('moreEventsLabel', {
            count: hidden.length,
            date: label,
          }),
        });
      }
      rows.push({ index: row, cells });
    }
    return rows;
  });

  /** @private Today when visible, else the first day of the anchor month, else the first cell. */
  private readonly _defaultFocus = computed(() => {
    const adapter = this._ctx.adapter;
    const days = this._ctx.days();
    const todayIndex = dayIndexOf(adapter, days, this._ctx.today());
    if (todayIndex >= 0) return todayIndex;
    const first = adapter.createDate(
      adapter.getYear(this._ctx.date()),
      adapter.getMonth(this._ctx.date()),
      1,
    );
    const firstIndex = days.findIndex(
      (day) => adapter.compareDate(day, first) >= 0,
    );
    return Math.max(0, firstIndex);
  });

  /** @protected The one cell with `tabindex="0"`; resets when the visible days change. */
  protected readonly _focusedIndex = linkedSignal<number>(() => {
    this._ctx.days();
    return this._defaultFocus();
  });

  /** @internal Range selection anchor/head; `null` when nothing is selected. Resets when the range changes. */
  protected readonly _selection = linkedSignal<
    readonly D[],
    { anchor: MonthPos; head: MonthPos } | null
  >({
    source: this._ctx.days,
    computation: () => null,
  });

  /** @internal Selected day span. */
  protected readonly _selectedBounds = computed(() => {
    const s = this._selection();
    if (!s) return null;
    return {
      dayFrom: Math.min(s.anchor.dayIndex, s.head.dayIndex),
      dayTo: Math.max(s.anchor.dayIndex, s.head.dayIndex),
    };
  });

  /** @internal Whether a cell is inside the selection. Called from the template per cell. */
  protected _isSelected(dayIndex: number): boolean {
    const b = this._selectedBounds();
    return !!b && dayIndex >= b.dayFrom && dayIndex <= b.dayTo;
  }

  /** @private Timestamp until which a `click` on a cell is ignored (the click that trails a drag-select). */
  private _ignoreClicksUntil = 0;

  /** @private Cell under the pointer at pointerdown; becomes the anchor once the drag threshold is crossed. */
  private _pendingAnchor: MonthPos | null = null;

  /** @private Reads the cell position off an event target. */
  private _posOf(target: EventTarget | null): MonthPos | null {
    const cell = (target as Element | null)?.closest<HTMLElement>(
      '[data-day-index]',
    );
    if (!cell) return null;
    return { dayIndex: Number(cell.dataset['dayIndex']) };
  }

  /** @internal Remembers the pressed cell for the range-select tracker. */
  protected _onGridPointerDown(event: Event): void {
    this._pendingAnchor = this._posOf(event.target);
  }

  /** @internal Commits the selection as an all-day `rangeSelect` and clears it. */
  protected _commitSelection(
    source: MlvSchedulerRangeSelectEvent<D>['source'],
  ): void {
    const b = this._selectedBounds();
    this._selection.set(null);
    if (!b) return;
    const ctx = this._ctx;
    const adapter = ctx.adapter;
    const days = ctx.days();
    ctx.emitRangeSelect({
      start: adapter.startOfDay(days[b.dayFrom]),
      end: adapter.addCalendarDays(days[b.dayTo], 1),
      allDay: true,
      source,
    });
  }

  constructor() {
    afterRenderEffect(() => {
      const request = this._ctx.pendingFocus();
      if (!request) return;
      const element =
        request.kind === 'event'
          ? findEventElement(this._host, request.id)
          : findCellElement(
              this._host,
              dayIndexOf(this._ctx.adapter, this._ctx.days(), request.date),
              null,
            );
      untracked(() => {
        // Cleared even when nothing matched: `pendingFocus` is shared context
        // state, so a request this view cannot resolve would otherwise linger
        // and fire a stale focus jump on the next unrelated render.
        this._ctx.pendingFocus.set(null);
        if (element && request.kind === 'cell')
          this._focusedIndex.set(Number(element.dataset['dayIndex']));
      });
      element?.focus();
    });

    effect(() => {
      if (this._ctx.dragging()) this._closePopover();
    });

    // Installs the row-size observer and nothing else. Every read here is
    // untracked — `#grid` is a static element, and `_measureLanes` tracks
    // nothing — so this effect has no dependencies and runs exactly once. Were
    // the measurement tracked, `_visibleLanes` (and, through `_rows`, every
    // event edit) would tear the subscription down and re-create it, and the
    // effect would feed itself the value it just wrote.
    afterRenderEffect((onCleanup) => {
      if (!this._isBrowser) return;
      const grid = untracked(() => this._grid().nativeElement);
      let frame = 0;
      const subscription = this._zone.runOutsideAngular(() =>
        this._resizeObserver.observe(grid).subscribe(() => {
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(() => this._measureLanes());
        }),
      );
      this._measureLanes();
      onCleanup(() => {
        cancelAnimationFrame(frame);
        subscription.unsubscribe();
      });
    });

    // Re-measures when the *shape* of the grid changes rather than its box: a
    // month range spans 4–6 week rows and `_measureLanes` divides the row
    // container's height by that count, but `.mlv-scheduler-month__rows` keeps
    // its box size in any definite-height host, so a 6↔5 row transition fires
    // no `ResizeObserver` and would leave the lane count ~20% stale. Tracked
    // trigger, untracked body — the count this writes is never a dependency of
    // the effect that writes it.
    afterRenderEffect(() => {
      if (!this._isBrowser) return;
      this._ctx.days();
      this._ctx.rowLength();
      this._measureLanes();
    });

    afterRenderEffect((onCleanup) => {
      const grid = this._grid()?.nativeElement;
      if (!grid || !this._isBrowser) return;
      const detach = this._zone.runOutsideAngular(() =>
        attachPointerDrag(
          grid,
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
              if (!s || !pos) return;
              if (pos.dayIndex === s.head.dayIndex) return;
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
            ignore: (t) =>
              !!t.closest('.mlv-scheduler-event, .mlv-scheduler-month__more'),
          },
        ),
      );
      onCleanup(detach);
    });

    this._destroyRef.onDestroy(() => this._closePopover());
  }

  /**
   * @private Lanes = (row height − day-number height) / lane height; untouched
   * when nothing measures. Fully untracked: the row count is arithmetic on the
   * visible days rather than a `_rows()` read, so measuring never subscribes the
   * caller to the lane count it is about to write.
   */
  private _measureLanes(): void {
    untracked(() => {
      const grid = this._grid().nativeElement;
      const rowCount = Math.ceil(
        this._ctx.days().length / this._ctx.rowLength(),
      );
      const laneHeight = this._probe().nativeElement.offsetHeight;
      const dayNumber = grid.querySelector<HTMLElement>(
        '.mlv-scheduler-month__day-number',
      );
      if (!rowCount || !laneHeight || !dayNumber) return;
      const rowHeight = grid.clientHeight / rowCount;
      const available = rowHeight - dayNumber.offsetHeight - laneHeight / 2;
      const lanes = Math.max(1, Math.floor(available / laneHeight));
      if (lanes !== this._visibleLanes()) this._visibleLanes.set(lanes);
    });
  }

  /** @protected Click / dblclick / contextmenu on empty cell space. */
  protected _onCellPointer(
    kind: MlvSchedulerInteractionKind,
    cell: MlvSchedulerMonthCell<D, TData>,
    event: MouseEvent,
  ): void {
    if (kind === 'click' && performance.now() < this._ignoreClicksUntil) return;
    const target = event.target as HTMLElement;
    if (target.closest('.mlv-scheduler-event, .mlv-scheduler-month__more'))
      return;
    this._ctx.emitSlotInteraction(kind, {
      date: cell.date,
      allDay: true,
      element: event.currentTarget as HTMLElement,
      nativeEvent: event,
    });
  }

  /** @protected Roving cell focus. */
  protected _onCellFocus(cell: MlvSchedulerMonthCell<D, TData>): void {
    this._focusedIndex.set(cell.dayIndex);
  }

  /** @protected Keyboard navigation for a focused cell (chips handle their own keys). */
  protected _onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (!target.classList.contains('mlv-scheduler-month__cell')) return;
    const dayIndex = Number(target.dataset['dayIndex']);
    const days = this._ctx.days();
    const rowLength = this._ctx.rowLength();
    const rowStart = dayIndex - (dayIndex % rowLength);
    let handled = true;
    switch (this._rtl.normalizeArrowKey(event) ?? event.key) {
      case RIGHT_ARROW:
        this._moveFocus(dayIndex, 1);
        break;
      case LEFT_ARROW:
        this._moveFocus(dayIndex, -1);
        break;
      case DOWN_ARROW:
        this._moveFocus(dayIndex, rowLength);
        break;
      case UP_ARROW:
        this._moveFocus(dayIndex, -rowLength);
        break;
      case 'Home':
        this._focusCell(event.ctrlKey ? 0 : rowStart);
        break;
      case 'End':
        this._focusCell(
          event.ctrlKey
            ? days.length - 1
            : Math.min(days.length - 1, rowStart + rowLength - 1),
        );
        break;
      case 'PageUp':
        this._page(dayIndex, -1);
        break;
      case 'PageDown':
        this._page(dayIndex, 1);
        break;
      case ' ':
        this._emitKeyboardSlot(dayIndex, target, event);
        break;
      case 'Enter': {
        const chip = target.querySelector<HTMLElement>(
          '.mlv-scheduler-event:not(.mlv-scheduler-event--ghost)',
        );
        if (chip) chip.focus();
        else this._emitKeyboardSlot(dayIndex, target, event);
        break;
      }
      default:
        handled = false;
    }
    if (handled) event.preventDefault();
  }

  /**
   * @protected Opens the overflow popover for `cell` and emits `moreClick`.
   *
   * Pointer-only until Task 14: the `+N more` button is `tabindex="-1"` (the
   * cell is the tab stop) and this method neither moves focus into the panel nor
   * restores it on close. Task 14 owns the intra-cell `Tab` ring that reaches
   * the button and must add both halves of that focus round trip.
   */
  protected _openMore(
    cell: MlvSchedulerMonthCell<D, TData>,
    event: MouseEvent,
  ): void {
    event.stopPropagation();
    this._ctx.emitMoreClick({ date: cell.date, events: cell.hidden });
    this._closePopover();
    this._popoverCell.set(cell);
    this._popoverHandle = this._popup.open({
      origin: new ElementRef(event.currentTarget as HTMLElement),
      template: this._popoverTemplate(),
      vcr: this._vcr,
      positions: this._popup.resolvePositions(['bottom-start', 'top-start']),
      onClose: () => {
        this._popoverHandle = null;
        this._popoverCell.set(null);
      },
    });
  }

  /** @private Steps `delta` days inside the grid, or navigates when leaving it. */
  private _moveFocus(dayIndex: number, delta: number): void {
    const days = this._ctx.days();
    const next = dayIndex + delta;
    if (next >= 0 && next < days.length) {
      this._focusCell(next);
      return;
    }
    const adapter = this._ctx.adapter;
    const direction: -1 | 1 = delta < 0 ? -1 : 1;
    const target =
      Math.abs(delta) === 1
        ? nextVisibleDate(
            adapter,
            days[dayIndex],
            direction,
            this._ctx.hiddenDays(),
          )
        : adapter.addCalendarDays(days[dayIndex], 7 * direction);
    this._jump(target);
  }

  /**
   * @private Pages one month in `direction` from the day at `dayIndex`.
   * `addCalendarMonths` keeps the day of month but not the weekday, so with
   * `hiddenDays` the landing date can fall on a hidden column, which
   * `visibleDays` drops: the focus request would then never resolve. Skip on to
   * the nearest rendered day in the same direction when that happens.
   */
  private _page(dayIndex: number, direction: -1 | 1): void {
    const adapter = this._ctx.adapter;
    const hiddenDays = this._ctx.hiddenDays();
    const target = adapter.addCalendarMonths(
      this._ctx.days()[dayIndex],
      direction,
    );
    this._jump(
      hiddenDays.includes(adapter.getDayOfWeek(target))
        ? nextVisibleDate(adapter, target, direction, hiddenDays)
        : target,
    );
  }

  /** @private Navigates to the period containing `date` and focuses its cell after render. */
  private _jump(date: D): void {
    this._ctx.pendingFocus.set({ kind: 'cell', date, minutes: null });
    this._ctx.goTo(date);
  }

  /** @private Focuses the cell at `dayIndex`. */
  private _focusCell(dayIndex: number): void {
    this._focusedIndex.set(dayIndex);
    findCellElement(this._host, dayIndex, null)?.focus();
  }

  /** @private `slotClick` from the keyboard. */
  private _emitKeyboardSlot(
    dayIndex: number,
    element: HTMLElement,
    nativeEvent: KeyboardEvent,
  ): void {
    this._ctx.emitSlotInteraction('click', {
      date: this._ctx.days()[dayIndex],
      allDay: true,
      element,
      nativeEvent,
    });
  }

  /** @private Disposes the overflow popover, if one is open. */
  private _closePopover(): void {
    this._popoverHandle?.close();
    this._popoverHandle = null;
  }
}
