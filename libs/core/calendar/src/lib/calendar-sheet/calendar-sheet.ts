import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import {
  DOWN_ARROW,
  LEFT_ARROW,
  RIGHT_ARROW,
  UP_ARROW,
} from '@angular/cdk/keycodes';
import type { AfterViewInit } from '@angular/core';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  NgZone,
  signal,
  untracked,
  viewChild,
  viewChildren,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MlvRtlService } from '@malva-ui/cdk/utils';
import { MlvScrubber } from '@malva-ui/core/scrubber';
import { MLV_CALENDAR_I18N } from '@malva-ui/i18n';
import { fromEvent } from 'rxjs';
import type { MlvCalendarRangeValue } from '../calendar/calendar';
import {
  MLV_DATE_ADAPTER,
  MlvNativeDateAdapter,
  type MlvDateAdapter,
} from '@malva-ui/core/date';

/**
 * @private Distance from either end of the month list, in pixels, at which the
 * window grows. Roughly a third of a month section, so growth lands before the
 * user reaches a hard stop but never fires from an idle mid-list scroll.
 */
const EDGE_THRESHOLD_PX = 96;

/**
 * @private Delay before a settled scroll position is read back, matching the
 * drum's own debounce so a momentum swipe is not sampled mid-flight.
 */
const SCROLL_DEBOUNCE_MS = 150;

/**
 * @private Ceiling on how long a self-initiated scroll suppresses the
 * scroll → year sync. A requested scroll that never moves the offset produces
 * no `scroll` event to clear the flag, so it is also released on a timer.
 */
const PROGRAMMATIC_SCROLL_TIMEOUT_MS = 500;

/** @private Monotonic counter backing per-instance month-label element ids. */
let nextCalendarSheetId = 0;

/** @private One cell of a month grid. Adjacent-month cells are not selectable. */
interface SheetDayCell<D> {
  /** The date the cell stands for, including adjacent-month filler. */
  date: D;
  /** A stable `YYYY-MM-DD` key, used for tracking and as the `data-date` hook. */
  iso: string;
  /** Whether the date belongs to the month this cell's grid renders. */
  currentMonth: boolean;
}

/** @private One month section rendered in the scrolling list. */
interface SheetMonth<D> {
  /** `<year>-<zero-based month>`, unique inside the window. */
  key: string;
  year: number;
  month: number;
  /** Localized month name, from the date adapter. */
  label: string;
  /** First day of the month, kept so callers need not rebuild it. */
  first: D;
  /** Week rows of exactly seven cells each. */
  weeks: SheetDayCell<D>[][];
}

/** @private Inclusive month window, both ends normalized to a first-of-month. */
interface SheetWindow<D> {
  start: D;
  end: D;
}

/**
 * Full-screen mobile calendar layout: a horizontal year strip, a fixed weekday
 * header and one continuous vertical scroll of consecutive months.
 *
 * It is the sheet body only — `mlv-popup` owns the surface, header, close
 * button, focus trap and scroll lock, and the host owns the confirm action.
 * Selection is written to the two-way {@link value} / {@link rangeValue} models
 * and is **pending** by construction: the sheet never commits anything, so a
 * host can seed it on open, commit it on Done and drop it on close.
 *
 * All date arithmetic and every visible month/weekday name go through
 * `MlvDateAdapter`.
 */
@Component({
  selector: 'mlv-calendar-sheet',
  imports: [MlvScrubber],
  templateUrl: './calendar-sheet.html',
  styleUrl: './calendar-sheet.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-calendar-sheet',
  },
})
export class MlvCalendarSheet<D = Date> implements AfterViewInit {
  /** @private The active date adapter — a provided `MLV_DATE_ADAPTER`, or the native fallback. */
  private readonly _adapter =
    (inject(MLV_DATE_ADAPTER, {
      optional: true,
    }) as MlvDateAdapter<D> | null) ??
    (inject(MlvNativeDateAdapter) as unknown as MlvDateAdapter<D>);

  /** @protected The component's i18n strings signal. */
  protected readonly _i18n = inject(MLV_CALENDAR_I18N);

  /** @private Mirrors horizontal arrow keys in the day grid under RTL. */
  private readonly _rtlService = inject(MlvRtlService);

  /**
   * @private Host element: the scope the day grid's horizontal arrow keys
   * resolve their direction against. The sheet renders inside the pickers'
   * full-screen popup pane, which CDK stamps with its trigger's `dir`, or
   * wherever a consumer places it, so the host can sit in a scoped direction
   * that differs from the document's.
   */
  private readonly _elementRef = inject(ElementRef<HTMLElement>);

  /**
   * @private Direction applying to this sheet, resolved once and cached behind
   * the shared `dir` observer rather than re-walked on every arrow keypress.
   * Read it only from the keydown handler: the pickers stamp the sheet into
   * their pane as an embedded view (as does any consumer `@if` / `@for`),
   * constructed before its host is inserted, and a read at construction would
   * cache the document's direction.
   */
  private readonly _direction = this._rtlService.elementDirection(
    this._elementRef,
  );

  /** @private Schedules post-render focus and scroll work. */
  private readonly _injector = inject(Injector);

  /** @private Zone reference; the scroll listener is registered outside it. */
  private readonly _ngZone = inject(NgZone);

  /** @private DestroyRef for listener and timer cleanup. */
  private readonly _destroyRef = inject(DestroyRef);

  /** @private Prefix for this instance's month-label element ids. */
  private readonly _idPrefix = `mlv-calendar-sheet-${nextCalendarSheetId++}`;

  /**
   * The pending single-date selection, two-way bindable.
   *
   * Writing it never closes anything — the sheet has no commit of its own.
   */
  readonly value = model<D | null>(null);

  /** The pending range selection, two-way bindable. Used when {@link range} is set. */
  readonly rangeValue = model<MlvCalendarRangeValue<D> | null>(null);

  /** Enables range selection mode, driving {@link rangeValue} instead of {@link value}. */
  readonly range = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /** Minimum selectable date. Also clamps how far back the month list can scroll. */
  readonly min = input<D | null>(null);

  /** Maximum selectable date. Also clamps how far forward the month list can scroll. */
  readonly max = input<D | null>(null);

  /** Optional predicate for disabling arbitrary dates. */
  readonly disabledDates = input<((date: D) => boolean) | null>(null);

  /** First day of the week, where `0` is Sunday. */
  readonly firstDayOfWeek = input(1);

  /**
   * Half-extent, in months, of the scroll window seeded around the selection.
   *
   * The list is a bounded window, not a virtualized infinite scroll: it starts
   * at `2 * windowMonths + 1` sections and grows by another `windowMonths` each
   * time the user reaches either end, clamped by `min` / `max` and, when those
   * are not set, by {@link maxMonths}.
   */
  readonly windowMonths = input(12);

  /**
   * Ceiling on how many month sections the list may hold at once.
   *
   * `min` / `max` are the only other bound and both are optional, so without
   * this an unrestricted picker would accumulate sections for as long as the
   * user keeps reaching an edge — and every growth rebuilds the whole array,
   * so the cost climbs with the months already rendered. Nothing is recycled or
   * virtualized: growth simply stops here, and long-distance navigation is the
   * year strip's job, which reseeds the window around its target rather than
   * extending it.
   *
   * The default is ten years of sections.
   */
  readonly maxMonths = input(121);

  /** Half-extent, in years, of the year strip when `min` / `max` do not bound it. */
  readonly yearRange = input(50);

  /** @private The scrolling month list element. */
  private readonly _monthsRef = viewChild<ElementRef<HTMLElement>>('monthsRef');

  /** @private The rendered month sections, in DOM order, index-aligned with `_months()`. */
  private readonly _monthEls =
    viewChildren<ElementRef<HTMLElement>>('monthRef');

  /**
   * @private The month window currently rendered, or `null` before the seeding
   * effect has run. Written by seeding, by edge extension and by a year scrub.
   */
  private readonly _window = signal<SheetWindow<D> | null>(null);

  /** @private Roving-focus target; `null` follows the pending selection. */
  private readonly _activeDate = signal<D | null>(null);

  /** @protected The year centred in the strip. Driven by scroll, and by scrubbing. */
  protected readonly _yearInView = signal<number>(
    this._adapter.getYear(this._adapter.today()),
  );

  /** @private Stable centre of the year strip's range; moves only when the sheet re-seeds. */
  private readonly _yearSeed = signal<number>(
    this._adapter.getYear(this._adapter.today()),
  );

  /** @private Debounce timer for scroll-driven year sync. */
  private _scrollTimer: ReturnType<typeof setTimeout> | null = null;

  /** @private Release timer for {@link _programmaticScroll}. */
  private _programmaticTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * @private Set while a scroll this component requested is in flight, so the
   * resulting `scroll` events cannot drive the year strip back to where the
   * list happens to be part-way through the animation.
   *
   * Only the year-scrub path arms it. Edge extension deliberately does not:
   * its offset compensation holds the visible month still, so the year the next
   * settle derives is the one already showing and an echo is impossible.
   */
  private _programmaticScroll = false;

  /** @private Marks that the list should be scrolled to the anchor after the next render. */
  private _scrollToAnchorPending = false;

  /** @protected Localized weekday abbreviations, rotated by `firstDayOfWeek`. */
  protected readonly _weekdays = computed(() => {
    this._adapter.locale();
    const days = this._adapter.getDayOfWeekNames('short');
    const start = this.firstDayOfWeek();
    return [...days.slice(start), ...days.slice(0, start)];
  });

  /** @protected Full weekday names for the grids' column headers. */
  protected readonly _weekdayNames = computed(() => {
    this._adapter.locale();
    const days = this._adapter.getDayOfWeekNames('long');
    const start = this.firstDayOfWeek();
    return [...days.slice(start), ...days.slice(0, start)];
  });

  /** @private First selectable month, or `null` when `min` is unset. */
  private readonly _lowerMonth = computed(() => {
    const min = this.min();
    return min ? this._startOfMonth(min) : null;
  });

  /** @private Last selectable month, or `null` when `max` is unset. */
  private readonly _upperMonth = computed(() => {
    const max = this.max();
    return max ? this._startOfMonth(max) : null;
  });

  /** @private The month the sheet anchors on: the pending selection, else today. */
  private readonly _anchorMonth = computed(() =>
    this._startOfMonth(this._anchorDay()),
  );

  /** @private The day the roving focus starts from when nothing has moved it. */
  private readonly _anchorDay = computed(() => {
    if (this.range()) {
      const value = this.rangeValue();
      return this._adapter.clone(
        value?.end ?? value?.start ?? this._adapter.today(),
      );
    }
    return this._adapter.clone(this.value() ?? this._adapter.today());
  });

  /** @private The window actually painted, after `min` / `max` clamping. */
  private readonly _clampedWindow = computed<SheetWindow<D>>(() => {
    const raw = this._window() ?? this._windowAround(this._anchorMonth());
    const lower = this._lowerMonth();
    const upper = this._upperMonth();

    let start =
      lower && this._adapter.compareDate(raw.start, lower) < 0
        ? lower
        : raw.start;
    let end =
      upper && this._adapter.compareDate(raw.end, upper) > 0 ? upper : raw.end;

    // A window whose ends crossed after clamping collapses onto the bound that
    // is still reachable rather than rendering nothing.
    if (this._adapter.compareDate(start, end) > 0) {
      if (upper && this._adapter.compareDate(start, upper) > 0) start = end;
      else end = start;
    }

    return { start, end };
  });

  /** @protected The months currently rendered in the list, oldest first. */
  protected readonly _months = computed<SheetMonth<D>[]>(() => {
    this._adapter.locale();
    const { start, end } = this._clampedWindow();
    const months: SheetMonth<D>[] = [];

    let cursor = start;
    // Hard ceiling so a pathological `min`/`max` pair cannot spin here.
    for (let i = 0; i < 1200; i++) {
      months.push(this._buildMonth(cursor));
      if (this._adapter.compareDate(cursor, end) >= 0) break;
      cursor = this._adapter.addCalendarMonths(cursor, 1);
    }

    return months;
  });

  /** @protected The years offered by the strip, ascending. */
  protected readonly _years = computed(() => {
    const seed = this._yearSeed();
    const span = Math.max(0, this.yearRange());
    const inView = this._yearInView();
    const min = this.min();
    const max = this.max();

    const low = Math.min(
      Math.max(seed - span, min ? this._adapter.getYear(min) : seed - span),
      inView,
    );
    const high = Math.max(
      Math.min(seed + span, max ? this._adapter.getYear(max) : seed + span),
      inView,
    );

    return Array.from({ length: high - low + 1 }, (_, index) => low + index);
  });

  /** @protected Chronologically ordered interval currently painted, if any. */
  protected readonly _displayRange = computed<SheetWindow<D> | null>(() => {
    if (!this.range()) return null;
    const value = this.rangeValue();
    if (!value?.start || !value.end) return null;

    return this._adapter.compareDate(value.start, value.end) <= 0
      ? { start: value.start, end: value.end }
      : { start: value.end, end: value.start };
  });

  constructor() {
    // Re-seat the window when the pending selection moves to a month the
    // window does not cover. Reads the window untracked so growing it — or
    // jumping it from the year strip — never bounces back to the selection.
    effect(() => {
      const anchor = this._anchorMonth();
      untracked(() => {
        const current = this._window();
        if (current && this._monthWithin(anchor, current)) return;

        this._window.set(this._windowAround(anchor));
        this._yearSeed.set(this._adapter.getYear(anchor));
        this._yearInView.set(this._adapter.getYear(anchor));
        this._scrollToAnchorPending = true;
      });
    });

    // Keep the roving focus on the pending selection until the user moves it.
    effect(() => {
      const anchor = this._anchorDay();
      untracked(() => {
        const active = this._activeDate();
        if (active && this._adapter.sameDate(active, anchor)) return;
        this._activeDate.set(anchor);
      });
    });

    afterNextRender(() => this._registerScrollListener());

    // Run after every render so a window written during change detection is
    // scrolled to once its sections exist.
    effect(() => {
      this._months();
      untracked(() => {
        if (!this._scrollToAnchorPending) return;
        this._scrollToAnchorPending = false;
        afterNextRender(() => this._scrollToMonth(this._anchorMonth(), false), {
          injector: this._injector,
        });
      });
    });

    this._destroyRef.onDestroy(() => {
      if (this._scrollTimer) clearTimeout(this._scrollTimer);
      if (this._programmaticTimer) clearTimeout(this._programmaticTimer);
    });
  }

  ngAfterViewInit(): void {
    this._scrollToMonth(this._anchorMonth(), false);
  }

  /**
   * Moves keyboard focus to the sheet's single day tab stop.
   *
   * Public so a host can hand focus to the grid once the popup has opened,
   * the way `mlv-calendar.focus()` does for the anchored dropdown.
   */
  focusActiveDay(): void {
    this._focusActiveCell();
  }

  /** @protected The DOM id of a month's label, unique per instance. */
  protected _monthLabelId(month: SheetMonth<D>): string {
    return `${this._idPrefix}-${month.key}`;
  }

  /** @protected Formats a year for the strip. */
  protected readonly _formatYear = (year: number): string =>
    this._adapter.getYearLabel(this._adapter.createDate(year, 0, 1));

  /** @protected Localized day-of-month text for a cell. */
  protected _dayNumber(date: D): string {
    this._adapter.locale();
    return this._adapter.getDayOfMonthLabel(date);
  }

  /** @protected Localized accessible name for a day cell. */
  protected _dayLabel(date: D): string {
    this._adapter.locale();
    return this._adapter.getDateLabel(date);
  }

  /** @protected Whether the date is outside `min`/`max` or rejected by `disabledDates`. */
  protected _isDisabled(date: D): boolean {
    const min = this.min();
    const max = this.max();
    if (min && this._adapter.compareDate(date, min) < 0) return true;
    if (max && this._adapter.compareDate(date, max) > 0) return true;
    const predicate = this.disabledDates();
    return !!predicate && predicate(date);
  }

  /** @protected Whether the date is the pending single selection. */
  protected _isSelected(date: D): boolean {
    if (this.range()) return false;
    return this._adapter.sameDate(date, this.value());
  }

  /** @protected Whether the date is today. */
  protected _isToday(date: D): boolean {
    return this._adapter.sameDate(date, this._adapter.today());
  }

  /** @protected Whether the date carries the roving `tabindex="0"`. */
  protected _isActive(date: D): boolean {
    return this._adapter.sameDate(date, this._activeDate());
  }

  /** @protected Whether the date lies inside the painted range, endpoints included. */
  protected _isInRange(date: D): boolean {
    const range = this._displayRange();
    if (!range) return false;
    return (
      this._adapter.compareDate(date, range.start) >= 0 &&
      this._adapter.compareDate(date, range.end) <= 0
    );
  }

  /** @protected Whether the date is the leading endpoint of the painted range. */
  protected _isRangeStart(date: D): boolean {
    const range = this._displayRange();
    return !!range && this._adapter.sameDate(date, range.start);
  }

  /** @protected Whether the date is the trailing endpoint of the painted range. */
  protected _isRangeEnd(date: D): boolean {
    const range = this._displayRange();
    return !!range && this._adapter.sameDate(date, range.end);
  }

  /**
   * @protected Whether the range crosses this month's opening boundary, so the
   * band must paint through the inline month label instead of breaking at it.
   */
  protected _isLabelInRange(month: SheetMonth<D>): boolean {
    if (!this._displayRange()) return false;
    const previousLast = this._adapter.addCalendarDays(month.first, -1);
    return this._isInRange(previousLast) && this._isInRange(month.first);
  }

  /**
   * @protected Whether the cell takes part in the painted range band.
   *
   * Adjacent-month filler never does. A grid's leading and trailing filler
   * stands for days the neighbouring month's own grid already renders, and this
   * grid stamps a day button only for its own month — so a fill on filler is a
   * band with nothing under it, repeating the previous month's tail as a
   * detached shape inside the next month's grid (#149 review). The band still
   * crosses the section boundary: {@link _isLabelInRange} paints the month
   * label, which spans the full width.
   */
  protected _isCellInRange(cell: SheetDayCell<D>): boolean {
    return cell.currentMonth && this._isInRange(cell.date);
  }

  /**
   * @protected Whether the cell caps the band at the start of its painted run
   * within the week row.
   *
   * The band is drawn cell by cell with square edges, so it needs a cap
   * wherever the paint begins — which is the row's first cell for a row lying
   * wholly inside the month, and the first cell after the leading
   * adjacent-month filler otherwise. Same rule, same radii and the same two
   * class names as `mlv-calendar`; the two calendars cap their bands
   * identically and must stay that way.
   */
  protected _isBandRowStart(week: SheetDayCell<D>[], index: number): boolean {
    return (
      this._isCellInRange(week[index]) &&
      (index === 0 || !this._isCellInRange(week[index - 1]))
    );
  }

  /**
   * @protected Whether the cell caps the band at the end of its painted run
   * within the week row. Mirror of {@link _isBandRowStart}.
   */
  protected _isBandRowEnd(week: SheetDayCell<D>[], index: number): boolean {
    return (
      this._isCellInRange(week[index]) &&
      (index === week.length - 1 || !this._isCellInRange(week[index + 1]))
    );
  }

  /**
   * @protected The `aria-selected` value for a grid cell, or `null` for
   * adjacent-month filler — which renders nothing and cannot be selected, so it
   * has no selected state to report in either direction.
   */
  protected _cellSelected(cell: SheetDayCell<D>): boolean | null {
    if (!cell.currentMonth) return null;
    return this.range()
      ? this._isInRange(cell.date)
      : this._isSelected(cell.date);
  }

  /** @protected Writes a tapped day into the pending selection. */
  protected _selectDate(date: D): void {
    if (this._isDisabled(date)) return;
    const next = this._adapter.clone(date);
    this._activeDate.set(next);

    if (!this.range()) {
      this.value.set(next);
      return;
    }

    const current = this.rangeValue();
    const start = current?.start ? this._adapter.clone(current.start) : null;
    const end = current?.end ? this._adapter.clone(current.end) : null;

    if (!start || end) {
      this.rangeValue.set({ start: next, end: null });
      return;
    }

    if (this._adapter.compareDate(next, start) < 0) {
      this.rangeValue.set({ start: next, end: start });
      return;
    }

    this.rangeValue.set({ start, end: next });
  }

  /** @protected Handles a year picked in the strip by click, keyboard or scroll. */
  protected _onYearScrubbed(year: number): void {
    if (year === this._yearInView()) return;

    const target = this._clampMonth(this._adapter.createDate(year, 0, 1));
    this._yearInView.set(year);

    const current = this._window();
    if (!current || !this._monthWithin(target, current)) {
      this._window.set(this._windowAround(target));
    }

    this._armProgrammaticScroll();
    afterNextRender(() => this._scrollToMonth(target, true), {
      injector: this._injector,
    });
  }

  /**
   * @protected Keyboard model for the day grid. Movement is continuous across
   * month boundaries: the window grows to cover wherever the caret lands, and
   * only `min` / `max` stop it.
   */
  protected _onKeydown(event: KeyboardEvent): void {
    const active = this._activeDate() ?? this._anchorDay();
    let next: D | null = null;

    switch (
      this._rtlService.normalizeArrowKey(event, this._direction()) ??
      event.key
    ) {
      case LEFT_ARROW:
        next = this._adapter.addCalendarDays(active, -1);
        break;
      case RIGHT_ARROW:
        next = this._adapter.addCalendarDays(active, 1);
        break;
      case UP_ARROW:
        next = this._adapter.addCalendarDays(active, -7);
        break;
      case DOWN_ARROW:
        next = this._adapter.addCalendarDays(active, 7);
        break;
      case 'PageUp':
        next = this._adapter.addCalendarMonths(active, -1);
        break;
      case 'PageDown':
        next = this._adapter.addCalendarMonths(active, 1);
        break;
      case 'Home':
        next = this._adapter.createDate(
          this._adapter.getYear(active),
          this._adapter.getMonth(active),
          1,
        );
        break;
      case 'End':
        next = this._adapter.createDate(
          this._adapter.getYear(active),
          this._adapter.getMonth(active),
          this._adapter.getNumDaysInMonth(active),
        );
        break;
      case 'Enter':
      case ' ':
        this._selectDate(active);
        event.preventDefault();
        return;
      default:
        return;
    }

    event.preventDefault();
    this._moveActive(next);
  }

  /**
   * @private Moves the roving focus, growing the window first so the target
   * cell exists. Refuses to leave the months `min` / `max` allow, which would
   * strand the tab stop on a section the clamped window never renders.
   */
  private _moveActive(date: D): void {
    const month = this._startOfMonth(date);
    const lower = this._lowerMonth();
    const upper = this._upperMonth();
    if (lower && this._adapter.compareDate(month, lower) < 0) return;
    if (upper && this._adapter.compareDate(month, upper) > 0) return;

    this._ensureMonthInWindow(month);
    this._activeDate.set(date);
    afterNextRender(
      () => {
        this._scrollActiveCellIntoView();
        this._focusActiveCell();
      },
      { injector: this._injector },
    );
  }

  /** @private Grows the window so `month` is inside it, preserving both ends otherwise. */
  private _ensureMonthInWindow(month: D): void {
    const current = this._window() ?? this._windowAround(this._anchorMonth());
    const start =
      this._adapter.compareDate(month, current.start) < 0
        ? month
        : current.start;
    const end =
      this._adapter.compareDate(month, current.end) > 0 ? month : current.end;
    if (start === current.start && end === current.end) return;
    this._window.set({ start, end });
  }

  /** @private Focuses the single day button carrying `tabindex="0"`. */
  private _focusActiveCell(): void {
    const scroller = this._monthsRef()?.nativeElement;
    const cell = scroller?.querySelector<HTMLElement>(
      '.mlv-calendar-sheet__day[tabindex="0"]',
    );
    cell?.focus();
  }

  /** @private Brings the active cell's month into view without a jarring jump. */
  private _scrollActiveCellIntoView(): void {
    const scroller = this._monthsRef()?.nativeElement;
    const cell = scroller?.querySelector<HTMLElement>(
      '.mlv-calendar-sheet__day[tabindex="0"]',
    );
    if (!scroller || !cell || typeof cell.offsetTop !== 'number') return;

    const top = cell.offsetTop;
    const viewport = scroller.clientHeight;
    if (top < scroller.scrollTop) {
      scroller.scrollTop = top;
    } else if (top + cell.offsetHeight > scroller.scrollTop + viewport) {
      scroller.scrollTop = top + cell.offsetHeight - viewport;
    }
  }

  /**
   * @private Registers the month list's scroll listener outside the template,
   * for the same reason `mlv-scrubber` does: a `(scroll)` binding runs inside
   * Angular's dirty-marking wrapper on every event, at momentum-scroll
   * frequency, and this handler writes nothing reactive on most events.
   */
  private _registerScrollListener(): void {
    const scroller = this._monthsRef()?.nativeElement;
    if (!scroller) return;

    this._ngZone.runOutsideAngular(() => {
      fromEvent(scroller, 'scroll', { passive: true })
        .pipe(takeUntilDestroyed(this._destroyRef))
        .subscribe(() => this._onScroll());
    });
  }

  /** @private Grows the window immediately; defers the year sync to the settle. */
  private _onScroll(): void {
    this._maybeExtendWindow();
    if (this._scrollTimer) clearTimeout(this._scrollTimer);
    this._scrollTimer = setTimeout(
      () => this._onScrollSettled(),
      SCROLL_DEBOUNCE_MS,
    );
  }

  /** @private Reads the settled position back into the year strip. */
  private _onScrollSettled(): void {
    if (this._programmaticScroll) {
      this._releaseProgrammaticScroll();
      return;
    }
    this._syncYearFromScroll();
  }

  /**
   * @private Extends the window when the list is scrolled to either end.
   *
   * Skipped entirely while one of the component's own scrolls is in flight: a
   * scrub reseeds the window centred on its target, so nothing needs to grow,
   * and growing anyway would write `scrollTop` directly to compensate the
   * prepend — which per CSSOM-View cancels the in-flight smooth scroll and
   * leaves the list somewhere the year strip is no longer pointing at.
   */
  private _maybeExtendWindow(): void {
    if (this._programmaticScroll || this._growthPending) return;

    const scroller = this._monthsRef()?.nativeElement;
    if (!scroller) return;

    const chunk = Math.max(1, this.windowMonths());
    const current = this._window() ?? this._windowAround(this._anchorMonth());
    if (this._monthSpan(current) >= Math.max(1, this.maxMonths())) return;
    const lower = this._lowerMonth();
    const upper = this._upperMonth();

    if (scroller.scrollTop <= EDGE_THRESHOLD_PX) {
      if (lower && this._adapter.compareDate(current.start, lower) <= 0) return;
      const start = this._clampMonth(
        this._adapter.addCalendarMonths(current.start, -chunk),
      );
      if (this._adapter.compareDate(start, current.start) >= 0) return;
      this._growLeading(scroller, { start, end: current.end });
      return;
    }

    const remaining =
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    if (remaining > EDGE_THRESHOLD_PX) return;
    if (upper && this._adapter.compareDate(current.end, upper) >= 0) return;

    const end = this._clampMonth(
      this._adapter.addCalendarMonths(current.end, chunk),
    );
    if (this._adapter.compareDate(end, current.end) <= 0) return;
    this._growTrailing({ start: current.start, end });
  }

  /**
   * @private Appends months. Nothing above the viewport changes, so unlike
   * {@link _growLeading} the offset needs no correction — only the guard that
   * keeps the rest of the fling from growing the window again.
   */
  private _growTrailing(next: SheetWindow<D>): void {
    this._growthPending = true;
    this._window.set(next);
    afterNextRender(() => (this._growthPending = false), {
      injector: this._injector,
    });
  }

  /** @private Number of month sections a window spans, inclusive. */
  private _monthSpan(window: SheetWindow<D>): number {
    return (
      (this._adapter.getYear(window.end) -
        this._adapter.getYear(window.start)) *
        12 +
      (this._adapter.getMonth(window.end) -
        this._adapter.getMonth(window.start)) +
      1
    );
  }

  /**
   * @private Prepends months and pushes the offset down by exactly the height
   * they added, so the month the user is looking at does not move.
   *
   * `overflow-anchor: none` on the scroller keeps the browser's own scroll
   * anchoring out of this: left on, it would shift the offset too and the two
   * corrections would double up.
   */
  private _growLeading(scroller: HTMLElement, next: SheetWindow<D>): void {
    const beforeTop = scroller.scrollTop;
    const beforeHeight = scroller.scrollHeight;
    this._growthPending = true;
    this._window.set(next);

    afterNextRender(
      () => {
        const grew = scroller.scrollHeight - beforeHeight;
        if (grew > 0) scroller.scrollTop = beforeTop + grew;
        this._growthPending = false;
      },
      { injector: this._injector },
    );
  }

  /** @private Points the year strip at the month sitting at the top of the viewport. */
  private _syncYearFromScroll(): void {
    const scroller = this._monthsRef()?.nativeElement;
    const elements = this._monthEls();
    const months = this._months();
    if (!scroller || !elements.length || elements.length !== months.length) {
      return;
    }

    const top = scroller.scrollTop;
    let index = 0;
    for (let i = 0; i < elements.length; i++) {
      if (elements[i].nativeElement.offsetTop <= top + 1) index = i;
      else break;
    }

    const year = months[index].year;
    if (year !== this._yearInView()) this._yearInView.set(year);
  }

  /** @private Scrolls the list so the given month starts at the top of the viewport. */
  private _scrollToMonth(month: D, smooth: boolean): void {
    const scroller = this._monthsRef()?.nativeElement;
    const elements = this._monthEls();
    const months = this._months();
    if (!scroller || !elements.length || elements.length !== months.length) {
      return;
    }

    const index = months.findIndex(
      (candidate) =>
        candidate.year === this._adapter.getYear(month) &&
        candidate.month === this._adapter.getMonth(month),
    );
    const element = elements[index >= 0 ? index : 0]?.nativeElement;
    if (!element) return;

    const top = element.offsetTop;
    const behavior: ScrollBehavior =
      smooth && !this._prefersReducedMotion() ? 'smooth' : 'instant';

    if (typeof scroller.scrollTo === 'function') {
      scroller.scrollTo({ top, behavior });
    } else {
      scroller.scrollTop = top;
    }
  }

  /**
   * @private Whether the user asked for reduced motion.
   *
   * Resolved here rather than left to CSS: per CSSOM-View an explicit
   * `behavior` passed to `scrollTo()` overrides the computed `scroll-behavior`,
   * so the stylesheet's reduced-motion rule alone would not stop the animation.
   * Guarded for SSR, where there is no `matchMedia`.
   */
  private _prefersReducedMotion(): boolean {
    return (
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  /**
   * @private Set from the moment a growth is requested until the months it
   * added have rendered.
   *
   * A fling fires many `scroll` events before Angular renders the new sections,
   * and every one of them still reads the pre-growth `scrollHeight`, so the
   * edge test stays true and each event grows the window again. Without this a
   * single fling adds several chunks at once.
   */
  private _growthPending = false;

  /** @private Arms the echo guard, with a timer in case no scroll event follows. */
  private _armProgrammaticScroll(): void {
    this._programmaticScroll = true;
    if (this._programmaticTimer) clearTimeout(this._programmaticTimer);
    this._programmaticTimer = setTimeout(
      () => this._releaseProgrammaticScroll(),
      PROGRAMMATIC_SCROLL_TIMEOUT_MS,
    );
  }

  /** @private Releases the echo guard. */
  private _releaseProgrammaticScroll(): void {
    this._programmaticScroll = false;
    if (this._programmaticTimer) {
      clearTimeout(this._programmaticTimer);
      this._programmaticTimer = null;
    }
  }

  /** @private A window of `windowMonths` on each side of `month`. */
  private _windowAround(month: D): SheetWindow<D> {
    const span = Math.max(0, this.windowMonths());
    return {
      start: this._adapter.addCalendarMonths(month, -span),
      end: this._adapter.addCalendarMonths(month, span),
    };
  }

  /** @private Whether `month` lies inside the inclusive window. */
  private _monthWithin(month: D, window: SheetWindow<D>): boolean {
    return (
      this._adapter.compareDate(month, window.start) >= 0 &&
      this._adapter.compareDate(month, window.end) <= 0
    );
  }

  /** @private Pulls a month inside the `min`/`max` bounds. */
  private _clampMonth(month: D): D {
    const lower = this._lowerMonth();
    const upper = this._upperMonth();
    if (lower && this._adapter.compareDate(month, lower) < 0) return lower;
    if (upper && this._adapter.compareDate(month, upper) > 0) return upper;
    return month;
  }

  /** @private First day of the month `date` falls in. */
  private _startOfMonth(date: D): D {
    return this._adapter.createDate(
      this._adapter.getYear(date),
      this._adapter.getMonth(date),
      1,
    );
  }

  /** @private Builds one month section, padded to whole weeks of seven cells. */
  private _buildMonth(month: D): SheetMonth<D> {
    const year = this._adapter.getYear(month);
    const index = this._adapter.getMonth(month);
    const first = this._adapter.createDate(year, index, 1);
    const length = this._adapter.getNumDaysInMonth(first);
    const offset =
      (this._adapter.getDayOfWeek(first) - this.firstDayOfWeek() + 7) % 7;

    const cells: SheetDayCell<D>[] = [];
    for (let lead = offset; lead > 0; lead--) {
      cells.push(
        this._cell(this._adapter.addCalendarDays(first, -lead), false),
      );
    }
    for (let day = 1; day <= length; day++) {
      cells.push(this._cell(this._adapter.createDate(year, index, day), true));
    }
    const last = this._adapter.createDate(year, index, length);
    let trail = 1;
    while (cells.length % 7 !== 0) {
      cells.push(
        this._cell(this._adapter.addCalendarDays(last, trail++), false),
      );
    }

    const weeks: SheetDayCell<D>[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }

    return {
      key: `${year}-${index}`,
      year,
      month: index,
      label: this._adapter.format(first, { month: 'long' }),
      first,
      weeks,
    };
  }

  /** @private Wraps a date as a grid cell with its stable identity key. */
  private _cell(date: D, currentMonth: boolean): SheetDayCell<D> {
    return { date, iso: this._adapter.toIso8601(date), currentMonth };
  }
}
