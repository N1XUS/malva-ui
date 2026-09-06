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
import {
  TOUCH_GESTURE_DELAY,
  attachPointerDrag,
  elementAt,
} from '../drag/scheduler-pointer';
import {
  DOWN_ARROW,
  LEFT_ARROW,
  RIGHT_ARROW,
  UP_ARROW,
} from '@angular/cdk/keycodes';
import { MlvPopupService, type MlvPopupHandle } from '@malva-ui/core/popup';
import {
  MlvResizeObserverService,
  MlvRtlService,
  mlvNextId,
} from '@malva-ui/cdk/utils';
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
  hiddenWeekdays,
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
  /** Position of this day within the visible range; the grid's cell identity. */
  readonly dayIndex: number;
  /** Start of the day this cell renders. */
  readonly date: D;
  /** Localized day of month, e.g. `'4'` — decorative, the cell carries the name. */
  readonly dayNumber: string;
  /** Accessible name of the cell: the full date, suffixed with "today" when it is. */
  readonly label: string;
  /** Whether the day falls outside the anchor month (leading / trailing days). */
  readonly outside: boolean;
  /** Whether the day is today AND `showCurrentTime` is on. Drives the pill and the label suffix. */
  readonly today: boolean;
  /** Visible segments that start in this cell (spanning bars live in their start cell). */
  readonly segments: readonly MlvSchedulerLaneSegment<D, TData>[];
  /** Every segment touching this day, visible or not — the popover list. */
  readonly all: readonly MlvSchedulerRowSegment<D, TData>[];
  /** Hidden events of this day. */
  readonly hidden: readonly MlvSchedulerEvent<D, TData>[];
  /** Visible text of the overflow button, e.g. `'+3 more'`. Empty when nothing overflows. */
  readonly moreText: string;
  /** Accessible name of the overflow button; starts with `moreText` (WCAG 2.5.3). */
  readonly moreLabel: string;
}

/** One rendered week row. */
interface MlvSchedulerMonthRow<D, TData> {
  readonly index: number;
  readonly cells: readonly MlvSchedulerMonthCell<D, TData>[];
}

/** @internal Position of a grid cell: a day. The month grid selects whole days only. */
interface MlvSchedulerMonthPos {
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
  /** @protected Day shown in the overflow popover, `null` when closed. */
  protected readonly _popoverDayIndex = signal<number | null>(null);
  /**
   * @protected Cell shown in the overflow popover, `null` when closed.
   *
   * Derived from the day index rather than snapshotted at open time: an
   * `[(events)]` edit (a drag commit, a consumer write) while the panel is open
   * rebuilds `_rows()`, and a stored cell object would keep listing the day as
   * it stood when the button was pressed.
   */
  protected readonly _popoverCell = computed(() => {
    const dayIndex = this._popoverDayIndex();
    return dayIndex === null ? null : this._cellAt(dayIndex);
  });
  /** @protected Panel id, referenced by the `+N more` button's `aria-controls`. */
  protected readonly _popoverId = mlvNextId('mlv-scheduler-month-popover');
  /** @private Open popover handle. */
  private _popoverHandle: MlvPopupHandle | null = null;
  /** @private The `+N more` button the open popover belongs to; `null` when closed. */
  private _popoverTrigger: HTMLElement | null = null;

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
    // `showCurrentTime` is documented as "the now-line AND the today
    // highlight", and the month has no now-line: without this the input has no
    // observable effect here at all. `today()` also stops ticking once it is
    // off, so an ungated highlight would go stale over midnight anyway.
    const showToday = this._ctx.showCurrentTime();
    const anchorMonth = adapter.getMonth(this._ctx.date());
    const visibleLanes = this._visibleLanes();
    const segments = sliceRows(adapter, this._events(), days, rowLength, 'all');
    const byRow = new Map<number, MlvSchedulerRowSegment<D, TData>[]>();
    for (const segment of segments) {
      const row = Math.floor(segment.startIndex / rowLength);
      const bucket = byRow.get(row);
      if (bucket) bucket.push(segment);
      else byRow.set(row, [segment]);
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
        const isToday = showToday && adapter.sameDate(date, today);
        const label = adapter.getDateLabel(date);
        const hidden = (layout.hiddenByDay.get(dayIndex) ?? []).map(
          (segment) => segment.normalized.event,
        );
        const moreText = this._ctx.translate('moreEvents', {
          count: hidden.length,
        });
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
          moreText,
          // WCAG 2.5.3 Label in Name: the accessible name has to CONTAIN the
          // visible one, and `moreEventsLabel` ("3 more events on 4 March")
          // drops the leading "+" of "+3 more", so a speech-input user reading
          // the button aloud matches nothing. Lead with the visible label and
          // let the translated string carry the date context after it.
          moreLabel: `${moreText}, ${this._ctx.translate('moreEventsLabel', {
            count: hidden.length,
            date: label,
          })}`,
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
    { anchor: MlvSchedulerMonthPos; head: MlvSchedulerMonthPos } | null
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
  private _pendingAnchor: MlvSchedulerMonthPos | null = null;

  /** @private Reads the cell position off an event target. */
  private _posOf(target: EventTarget | null): MlvSchedulerMonthPos | null {
    const cell = (target as Element | null)?.closest<HTMLElement>(
      '[data-day-index]',
    );
    if (!cell) return null;
    return { dayIndex: Number(cell.dataset['dayIndex']) };
  }

  /** @internal Remembers the pressed cell for the range-select tracker. */
  protected _onGridPointerDown(event: Event): void {
    const pos = this._posOf(event.target);
    this._pendingAnchor = pos;
    // A press outside a pending selection abandons it, the way plain keyboard
    // navigation does: the range is anchored on the cell it was started from,
    // so a later `Enter` must activate what the user has just pressed rather
    // than commit a range they have since moved away from.
    const bounds = this._selectedBounds();
    if (
      bounds &&
      !(pos && pos.dayIndex >= bounds.dayFrom && pos.dayIndex <= bounds.dayTo)
    ) {
      this._selection.set(null);
    }
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
          ? findEventElement(this._host, request.id, request.dayIndex)
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

    // The panel is hidden — not disposed — while a drag is in flight, and
    // disposed once it settles. It owns the SortableJS instance that drags its
    // own chips out (the spec requires that), and disposing it on drag start
    // destroys that instance mid-flight: `unregister()` then releases the drag
    // through `_releaseDragOwnedBy`, so an overflowed chip would snap back the
    // instant it moved. Hiding is also what makes the drop reachable — the
    // fallback drag hit-tests with `elementFromPoint`, which would otherwise
    // keep returning the panel stacked over the grid.
    effect(() => {
      if (this._ctx.dragging()) return;
      untracked(() => this._closePopover());
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
      if (!this._isBrowser) return;
      // `_grid` is `viewChild.required`: it throws rather than returning
      // undefined, so no `?.`/null branch here — the other two readers of the
      // same query (the observer effect and `_measureLanes`) do not have one.
      const grid = this._grid().nativeElement;
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
            onMove: (at, event) => {
              const s = this._selection();
              // The cell under the POINTER, not the event's target: a touch
              // pointer is implicitly captured by the cell it went down on, so
              // the target never changes for the whole gesture (see `elementAt`).
              const pos = this._posOf(
                elementAt(this._host.ownerDocument, at, event.target),
              );
              if (!s || !pos) return;
              if (pos.dayIndex === s.head.dayIndex) return;
              this._zone.run(() =>
                this._selection.set({ anchor: s.anchor, head: pos }),
              );
            },
            onEnd: (_p, moved) => {
              this._pendingAnchor = null;
              // Only a drag that actually painted a selection commits one and
              // swallows the click that trails it. A drag over a grid with
              // `selectable` off (or one whose `onStart` found no cell) paints
              // nothing, and must leave the following click alone.
              if (!moved || !this._selection()) return;
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
            // Touch arms on a short press so a swipe still scrolls the page.
            touchDelay: TOUCH_GESTURE_DELAY,
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
    const days = this._ctx.days();
    const rowLength = this._ctx.rowLength();
    const rowStart = dayIndex - (dayIndex % rowLength);
    let handled = true;
    switch (arrow ?? event.key) {
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
        // The `+N more` button is a stop of the same ring, and it is the only
        // one when every lane of the row is taken by bars that started on an
        // earlier day: that cell renders no chip at all, so without this
        // fallback its hidden events would have no keyboard path (WCAG 2.1.1).
        const stop =
          this._firstChipOf(dayIndex) ??
          target.querySelector<HTMLElement>('.mlv-scheduler-month__more');
        if (stop) stop.focus();
        else this._emitKeyboardSlot(dayIndex, target, event);
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
   * @private Grows/shrinks the keyboard selection by one day (←→) or one week
   * row (↑↓) from the focused cell, clamped to the visible range.
   */
  private _extendSelection(arrow: number): void {
    const focus: MlvSchedulerMonthPos = { dayIndex: this._focusedIndex() };
    const current = this._selection() ?? { anchor: focus, head: focus };
    const rowLength = this._ctx.rowLength();
    const delta =
      arrow === RIGHT_ARROW
        ? 1
        : arrow === LEFT_ARROW
          ? -1
          : arrow === DOWN_ARROW
            ? rowLength
            : -rowLength;
    const target = current.head.dayIndex + delta;
    const length = this._ctx.days().length;
    // Clamp on the axis the key moves. A horizontal step stops at the first /
    // last day of the range; a vertical one that would leave the grid stays
    // put, because clamping it into range turns "one week down" into a
    // sideways jump of however many days are left in the last row.
    const dayIndex =
      Math.abs(delta) === 1
        ? Math.min(length - 1, Math.max(0, target))
        : target >= 0 && target < length
          ? target
          : current.head.dayIndex;
    // A clamped extension changes nothing: re-announcing would repeat the same
    // range every time the key is held against the edge.
    if (this._selection() && dayIndex === current.head.dayIndex) return;
    this._selection.set({ anchor: current.anchor, head: { dayIndex } });
    this._announceSelection();
  }

  /** @private Reads the selected day span back as a `selectionHint` announcement. */
  private _announceSelection(): void {
    const b = this._selectedBounds();
    if (!b) return;
    const ctx = this._ctx;
    const days = ctx.days();
    ctx.announce(
      ctx.translate('selectionHint', {
        start: ctx.adapter.getDateLabel(days[b.dayFrom]),
        end: ctx.adapter.getDateLabel(days[b.dayTo]),
      }),
    );
  }

  /**
   * @protected Opens the overflow popover for `cell` and emits `moreClick`.
   *
   * The `+N more` button stays `tabindex="-1"` (the cell is the roving tab
   * stop) and is reached with `Tab` from a chip of the same cell — the chip's
   * intra-cell ring includes it. Keyboard activation is the button's own
   * `click`, so this method closes the focus round trip: it moves focus to the
   * first chip of the panel on open, and back to the button on close.
   *
   * The button TOGGLES its own panel. The overlay has no backdrop and excludes
   * the trigger from the service's dismiss listener (see below), so a second
   * press reaches this method with the panel still open; without the early
   * return it would close and immediately reopen, throwing focus onto the first
   * chip again. A toggle-close emits no `moreClick` — the output means "the
   * button opened its popover".
   */
  protected _openMore(
    cell: MlvSchedulerMonthCell<D, TData>,
    event: MouseEvent,
  ): void {
    event.stopPropagation();
    const trigger = event.currentTarget as HTMLElement;
    if (this._popoverHandle && this._popoverTrigger === trigger) {
      this._closePopover();
      trigger.focus();
      return;
    }
    this._ctx.emitMoreClick({ date: cell.date, events: cell.hidden });
    this._closePopover();
    this._popoverDayIndex.set(cell.dayIndex);
    const handle = this._popup.open({
      origin: new ElementRef(trigger),
      template: this._popoverTemplate(),
      vcr: this._vcr,
      positions: this._popup.resolvePositions(['bottom-start', 'top-start']),
      // No backdrop: a CDK backdrop covers the viewport, and the fallback drag
      // resolves its drop target with `elementFromPoint`, so a chip dragged out
      // of the panel would never see a month cell underneath. Dismissal keeps
      // working through the service's document click listener, with the trigger
      // excluded so the press that opens the panel does not close it again.
      hasBackdrop: false,
      dismissExcludeElements: [trigger],
      onClose: () => {
        this._popoverHandle = null;
        this._popoverTrigger = null;
        this._popoverDayIndex.set(null);
        // The overlay is disposed before this runs, so focus that was inside
        // the panel has already fallen back to `<body>`: that — and only that —
        // is the case to restore. A close triggered while focus sits elsewhere
        // (the user clicked another cell) must not steal it back.
        const doc = trigger.ownerDocument;
        if (!doc.activeElement || doc.activeElement === doc.body) {
          trigger.focus();
        }
      },
    });
    this._popoverHandle = handle;
    this._popoverTrigger = trigger;
    // `attach()` renders the template portal synchronously, so the panel's
    // chips already exist here.
    handle.overlayRef.overlayElement
      .querySelector<HTMLElement>('.mlv-scheduler-event')
      ?.focus();
  }

  /**
   * @protected Keyboard on the `+N more` button, closing the intra-cell ring the
   * chips already implement (`MlvSchedulerEventChip._tabWithinCell`): the button
   * is the ring's last stop, so `Shift+Tab` steps back to the cell's last chip
   * instead of leaving the grid, and `Escape` returns to the owning cell the way
   * it does from a chip. Plain `Tab` leaves the ring natively, and activation is
   * the button's own `click`.
   */
  protected _onMoreKeydown(event: KeyboardEvent): void {
    const button = event.currentTarget as HTMLElement;
    const cellEl = button.closest<HTMLElement>('.mlv-scheduler-month__cell');
    if (!cellEl) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      cellEl.focus();
      return;
    }
    if (event.key !== 'Tab' || !event.shiftKey) return;
    const chips = cellEl.querySelectorAll<HTMLElement>(
      '.mlv-scheduler-event:not(.mlv-scheduler-event--ghost)',
    );
    const previous = chips[chips.length - 1];
    // No chip at all: every lane is taken by bars that started on an earlier
    // day, so the button is the cell's only stop and Shift+Tab leaves natively.
    if (!previous) return;
    event.preventDefault();
    previous.focus();
  }

  /** @private The rendered cell for a day index, or `null` when out of range. */
  private _cellAt(dayIndex: number): MlvSchedulerMonthCell<D, TData> | null {
    const row = this._rows()[Math.floor(dayIndex / this._ctx.rowLength())];
    return row?.cells.find((cell) => cell.dayIndex === dayIndex) ?? null;
  }

  /**
   * @private First focusable chip of a day, or `null` when the cell renders
   * none. Skips the drag-preview ghost through the segment's own `ghost` flag
   * rather than a `:not(--ghost)` DOM query, matching the time grid's
   * `_chipAt`: one definition of "is this a real chip", and no second query.
   *
   * `dayIndex` is passed on to `findEventElement`: `sliceRows` emits one
   * segment per week row (and per `hiddenDays`-split run) and every one of them
   * carries the same `data-event-id`, so an id alone resolves a multi-row
   * all-day event to its first bar — a chip in another week than the cell the
   * key was pressed in.
   */
  private _firstChipOf(dayIndex: number): HTMLElement | null {
    const segment = this._cellAt(dayIndex)?.segments.find(
      (candidate) => !candidate.normalized.ghost,
    );
    return segment
      ? findEventElement(this._host, segment.normalized.event.id, dayIndex)
      : null;
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
    // Through `hiddenWeekdays()`, not the raw array: an all-seven `hiddenDays`
    // hides nothing (`visibleDays` ignores it), so testing the raw array would
    // send every landing date off to `nextVisibleDate` for a column that is in
    // fact rendered.
    this._jump(
      hiddenWeekdays(hiddenDays).has(adapter.getDayOfWeek(target))
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
    this._popoverTrigger = null;
  }
}
