import type { BooleanInput } from '@angular/cdk/coercion';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  signal,
  untracked,
  ViewEncapsulation,
} from '@angular/core';
import { MlvButton, MlvButtonIcon } from '@malva-ui/core/button';
import {
  DOWN_ARROW,
  LEFT_ARROW,
  RIGHT_ARROW,
  UP_ARROW,
} from '@angular/cdk/keycodes';
import { MlvFade, MlvRtlService } from '@malva-ui/cdk/utils';
import { LucideChevronLeft, LucideChevronRight } from '@lucide/angular';
import {
  MLV_DATE_ADAPTER,
  type MlvDateAdapter,
  MlvNativeDateAdapter,
} from '@malva-ui/core/date';
import { MLV_CALENDAR_I18N, MlvI18nResolverService } from '@malva-ui/i18n';

export type MlvCalendarView = 'month' | 'year' | 'multi-year';

/**
 * Selected range value used by range-enabled calendar instances.
 */
export interface MlvCalendarRangeValue<D = Date> {
  start: D | null;
  end: D | null;
}

interface CalendarDayCell<D> {
  date: D;
  currentMonth: boolean;
}

@Component({
  selector: 'mlv-calendar',
  imports: [
    MlvButton,
    MlvButtonIcon,
    MlvFade,
    LucideChevronRight,
    LucideChevronLeft,
  ],
  templateUrl: './calendar.html',
  styleUrl: './calendar.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mlv-calendar',
    '[class.mlv-calendar--embedded]': 'embedded()',
    '(keydown)': 'onKeydown($event)',
  },
})
export class MlvCalendar<D = Date> {
  /** @private The active date adapter — a provided `MLV_DATE_ADAPTER`, or the native fallback. */
  private readonly _dateAdapter =
    (inject(MLV_DATE_ADAPTER, {
      optional: true,
    }) as MlvDateAdapter<D> | null) ??
    (inject(MlvNativeDateAdapter) as unknown as MlvDateAdapter<D>);

  /** @protected The component's i18n strings signal. */
  protected readonly _i18n = inject(MLV_CALENDAR_I18N);

  /** @private Resolver for ICU parameterized i18n strings. */
  private readonly _resolver = inject(MlvI18nResolverService);

  /**
   * @private Host element used to locate the roving-focus cell, and the scope
   * horizontal arrow keys resolve their direction against. Direction is scoped,
   * so a calendar inside a `dir="rtl"` subtree — or inside a popup pane, which
   * CDK stamps with its trigger's `dir` — must mirror even while the document
   * is LTR.
   */
  private readonly _elementRef = inject(ElementRef<HTMLElement>);

  /** @private Normalizes horizontal calendar navigation for RTL layouts. */
  private readonly _rtlService = inject(MlvRtlService);

  /**
   * @private Direction applying to this calendar, resolved once and cached
   * behind the shared `dir` observer rather than re-walked on every arrow
   * keypress — the day grid answers three separate keydown handlers.
   */
  private readonly _direction = this._rtlService.elementDirection(
    this._elementRef,
  );

  /** @private Injector for scheduling post-render focus of the active cell. */
  private readonly _injector = inject(Injector);

  /** Currently selected single date value. */
  readonly value = model<D | null>(null);
  /** Currently selected range value when range mode is enabled. */
  readonly rangeValue = model<MlvCalendarRangeValue<D> | null>(null);
  /** Minimum selectable date. */
  readonly min = input<D | null>(null);
  /** Maximum selectable date. */
  readonly max = input<D | null>(null);
  /** Optional predicate for disabling arbitrary dates. */
  readonly disabledDates = input<((date: D) => boolean) | null>(null);
  /** Initial view shown by the calendar. */
  readonly startView = input<MlvCalendarView>('month');
  /** First day of the week where `0` is Sunday. */
  readonly firstDayOfWeek = input(1);
  /** Enables range selection mode. */
  readonly range = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });
  /** Removes standalone surface chrome when rendered inside another container such as a popup. */
  readonly embedded = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });

  /**
   * Whether `activeDate` follows the current selection.
   *
   * A lone calendar keeps its view on whatever is selected: picking a date, or
   * receiving one from a form, scrolls the grid to that month. That is the
   * default and the right behaviour when the calendar owns its own view.
   *
   * Set to `false` when a **parent coordinates `activeDate` across several
   * calendars**. Two panels sharing one `rangeValue` would otherwise both
   * anchor on the same endpoint and paint the same month, overwriting whatever
   * the parent bound. `mlv-date-range-picker` sets it to `false` on both of its
   * panels and drives them from a single anchor, one month apart.
   */
  readonly followSelection = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });

  /**
   * Date currently focused by navigation and view state.
   *
   * Two-way bindable via `[(activeDate)]` so a parent can coordinate
   * navigation across multiple calendars (e.g. the side-by-side panels in
   * `mlv-date-range-picker`). Defaults to the selected value when present,
   * otherwise to today.
   */
  readonly activeDate = model<D>(this._getInitialActiveDate());
  /** Current calendar view mode. */
  readonly currentView = signal<MlvCalendarView>(this.startView());

  /** @private Transient range endpoint used only for pointer/keyboard preview. */
  private readonly _rangePreviewDate = signal<D | null>(null);

  /**
   * @protected Chronologically ordered interval currently painted in the grid.
   * A committed end date wins; otherwise the hovered/focused preview date is
   * paired with the selected anchor without mutating `rangeValue`.
   */
  protected readonly _displayRange = computed<{
    start: D;
    end: D;
  } | null>(() => {
    if (!this.range()) {
      return null;
    }

    const value = this.rangeValue();
    const anchor = value?.start;
    const candidate = value?.end ?? this._rangePreviewDate();
    if (!anchor || !candidate) {
      return null;
    }

    return this._dateAdapter.compareDate(anchor, candidate) <= 0
      ? { start: anchor, end: candidate }
      : { start: candidate, end: anchor };
  });

  /** Whether the painted interval is a transient hover/focus preview. */
  readonly isRangePreviewing = computed(() => {
    const value = this.rangeValue();
    return !!value?.start && !value.end && !!this._rangePreviewDate();
  });

  /** Whether both selected endpoints are set and the primary range band is committed. */
  readonly hasCompletedRange = computed(() => {
    const value = this.rangeValue();
    return !!value?.start && !!value.end;
  });

  /** Localized weekday labels rotated by `firstDayOfWeek`. */
  readonly weekdays = computed(() => {
    this._dateAdapter.locale();
    const days = this._dateAdapter.getDayOfWeekNames('short');
    const start = this.firstDayOfWeek();
    return [...days.slice(start), ...days.slice(0, start)];
  });

  /** Month grid cells, including adjacent-month overflow days. */
  readonly monthDays = computed<CalendarDayCell<D>[]>(() => {
    const date = this.activeDate();
    const year = this._dateAdapter.getYear(date);
    const month = this._dateAdapter.getMonth(date);
    const firstDay = this._dateAdapter.createDate(year, month, 1);
    const lastDay = this._dateAdapter.createDate(
      year,
      month,
      this._dateAdapter.getNumDaysInMonth(firstDay),
    );
    const startOffset =
      (this._dateAdapter.getDayOfWeek(firstDay) - this.firstDayOfWeek() + 7) %
      7;

    const days: CalendarDayCell<D>[] = [];

    for (let i = startOffset; i > 0; i--) {
      days.push({
        date: this._dateAdapter.addCalendarDays(firstDay, -i),
        currentMonth: false,
      });
    }

    for (let day = 1; day <= this._dateAdapter.getDate(lastDay); day++) {
      days.push({
        date: this._dateAdapter.createDate(year, month, day),
        currentMonth: true,
      });
    }

    let trailingDayOffset = 1;
    while (days.length % 7 !== 0) {
      days.push({
        date: this._dateAdapter.addCalendarDays(lastDay, trailingDayOffset++),
        currentMonth: false,
      });
    }

    return days;
  });

  /**
   * Month grid cells grouped into week rows (arrays of 7) so the template can
   * render each week as a `role="row"` inside the `role="grid"` structure.
   */
  readonly monthWeeks = computed<CalendarDayCell<D>[][]>(() => {
    const days = this.monthDays();
    const weeks: CalendarDayCell<D>[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }
    return weeks;
  });

  /** Localized month labels used by the year view. */
  readonly months = computed(() => {
    this._dateAdapter.locale();
    return this._dateAdapter.getMonthNames('short');
  });

  /** Consecutive 24-year block used by the multi-year view. */
  readonly years = computed(() => {
    const start = this._yearBlockStart(this.activeDate());
    return Array.from({ length: 24 }, (_, index) => start + index);
  });

  /** Localized header label for the active view. */
  readonly headerLabel = computed(() => {
    const date = this.activeDate();
    this._dateAdapter.locale();

    if (this.currentView() === 'month') {
      return this._dateAdapter.getMonthYearLabel(date);
    }

    if (this.currentView() === 'year') {
      return this._dateAdapter.getYearLabel(date);
    }

    const start = this._yearBlockStart(date);
    return `${this.getYearOptionLabel(start)} - ${this.getYearOptionLabel(start + 23)}`;
  });

  /**
   * @protected Localized aria-label for the view-switching header button.
   * Announces the view the button will switch to (month → year → multi-year → month).
   */
  protected readonly _switchViewLabel = computed(() => {
    const view = this.currentView();
    const nextView =
      view === 'month' ? 'year' : view === 'year' ? 'multiYear' : 'month';
    return this._resolver.resolve(
      this._i18n() as unknown as Record<string, string>,
      'switchView',
      { view: nextView },
    );
  });

  constructor() {
    effect(() => {
      if (this.range() || !this.followSelection()) {
        return;
      }

      const selected = this.value();

      if (!selected) {
        return;
      }

      const normalizedSelected = this._dateAdapter.clone(selected);
      if (
        !this._dateAdapter.sameDate(
          untracked(this.activeDate),
          normalizedSelected,
        )
      ) {
        this.activeDate.set(normalizedSelected);
      }
    });

    effect(() => {
      if (!this.range() || !this.followSelection()) {
        return;
      }

      const rangeValue = this.rangeValue();
      const anchor = rangeValue?.end ?? rangeValue?.start;

      if (!anchor) {
        return;
      }

      const normalizedAnchor = this._dateAdapter.clone(anchor);
      if (
        !this._dateAdapter.sameDate(
          untracked(this.activeDate),
          normalizedAnchor,
        )
      ) {
        this.activeDate.set(normalizedAnchor);
      }
    });
  }

  /** Navigates to the previous visible period when available. */
  navigatePrev(): void {
    if (!this.canNavigatePrev()) {
      return;
    }

    if (this.currentView() === 'month') {
      this.activeDate.set(
        this._dateAdapter.addCalendarMonths(this.activeDate(), -1),
      );
      return;
    }

    if (this.currentView() === 'year') {
      this.activeDate.set(
        this._dateAdapter.addCalendarYears(this.activeDate(), -1),
      );
      return;
    }

    this.activeDate.set(
      this._dateAdapter.addCalendarYears(this.activeDate(), -24),
    );
  }

  /** Navigates to the next visible period when available. */
  navigateNext(): void {
    if (!this.canNavigateNext()) {
      return;
    }

    if (this.currentView() === 'month') {
      this.activeDate.set(
        this._dateAdapter.addCalendarMonths(this.activeDate(), 1),
      );
      return;
    }

    if (this.currentView() === 'year') {
      this.activeDate.set(
        this._dateAdapter.addCalendarYears(this.activeDate(), 1),
      );
      return;
    }

    this.activeDate.set(
      this._dateAdapter.addCalendarYears(this.activeDate(), 24),
    );
  }

  /** Cycles between month, year, and multi-year views. */
  switchView(): void {
    const views: MlvCalendarView[] = ['month', 'year', 'multi-year'];
    const index = views.indexOf(this.currentView());
    this.currentView.set(views[(index + 1) % views.length]);
  }

  /** Selects a date or extends the current range selection. */
  selectDate(date: D): void {
    if (this.isDateDisabled(date)) {
      return;
    }

    const normalizedDate = this._dateAdapter.clone(date);
    this._rangePreviewDate.set(null);
    this.activeDate.set(normalizedDate);

    if (!this.range()) {
      this.value.set(normalizedDate);
      return;
    }

    const currentRange = this.rangeValue();
    const start = currentRange?.start
      ? this._dateAdapter.clone(currentRange.start)
      : null;
    const end = currentRange?.end
      ? this._dateAdapter.clone(currentRange.end)
      : null;

    if (!start || end) {
      this.rangeValue.set({
        start: normalizedDate,
        end: null,
      });
      return;
    }

    if (this._dateAdapter.compareDate(normalizedDate, start) < 0) {
      this.rangeValue.set({
        start: normalizedDate,
        end: start,
      });
      return;
    }

    this.rangeValue.set({
      start,
      end: normalizedDate,
    });
  }

  /** Selects a month in the current year and returns to month view. */
  selectMonth(month: number): void {
    if (this.isMonthDisabled(month)) {
      return;
    }

    const activeDate = this.activeDate();
    const nextDate = this._dateAdapter.createDate(
      this._dateAdapter.getYear(activeDate),
      month,
      Math.min(
        this._dateAdapter.getDate(activeDate),
        this._dateAdapter.getNumDaysInMonth(
          this._dateAdapter.createDate(
            this._dateAdapter.getYear(activeDate),
            month,
            1,
          ),
        ),
      ),
    );

    this.activeDate.set(nextDate);
    this.currentView.set('month');
  }

  /** Selects a year and returns to year view. */
  selectYear(year: number): void {
    if (this.isYearDisabled(year)) {
      return;
    }

    const activeDate = this.activeDate();
    const month = this._dateAdapter.getMonth(activeDate);
    const nextDate = this._dateAdapter.createDate(
      year,
      month,
      Math.min(
        this._dateAdapter.getDate(activeDate),
        this._dateAdapter.getNumDaysInMonth(
          this._dateAdapter.createDate(year, month, 1),
        ),
      ),
    );

    this.activeDate.set(nextDate);
    this.currentView.set('year');
  }

  /** Returns `true` when the date is outside the allowed selection rules. */
  isDateDisabled(date: D): boolean {
    const minDate = this.min();
    const maxDate = this.max();
    const disabledFn = this.disabledDates();

    if (minDate && this._dateAdapter.compareDate(date, minDate) < 0) {
      return true;
    }

    if (maxDate && this._dateAdapter.compareDate(date, maxDate) > 0) {
      return true;
    }

    return !!disabledFn && disabledFn(date);
  }

  /** Returns `true` when the date matches today according to the adapter. */
  isToday(date: D): boolean {
    return this._dateAdapter.sameDate(date, this._dateAdapter.today());
  }

  /** Returns `true` when the date matches the selected single value. */
  isSelected(date: D): boolean {
    if (this.range()) {
      return false;
    }

    return this._dateAdapter.sameDate(date, this.value());
  }

  /** Returns `true` when the date is the current range start. */
  isRangeStart(date: D): boolean {
    return this._dateAdapter.sameDate(date, this.rangeValue()?.start ?? null);
  }

  /** Returns `true` when the date is the current range end. */
  isRangeEnd(date: D): boolean {
    return this._dateAdapter.sameDate(date, this.rangeValue()?.end ?? null);
  }

  /** Returns `true` when the date is the leading endpoint currently painted. */
  isDisplayRangeStart(date: D): boolean {
    return this._dateAdapter.sameDate(
      date,
      this._displayRange()?.start ?? null,
    );
  }

  /** Returns `true` when the date is the trailing endpoint currently painted. */
  isDisplayRangeEnd(date: D): boolean {
    return this._dateAdapter.sameDate(date, this._displayRange()?.end ?? null);
  }

  /** Returns `true` when the date lies inside the selected or previewed interval. */
  isInDisplayRange(date: D): boolean {
    const range = this._displayRange();
    if (!range) {
      return false;
    }

    return (
      this._dateAdapter.compareDate(date, range.start) >= 0 &&
      this._dateAdapter.compareDate(date, range.end) <= 0
    );
  }

  /**
   * @protected Whether the cell takes part in the painted range band.
   *
   * Adjacent-month cells never do. The days a grid shows outside its own month
   * are the same days the neighbouring month's grid already paints, so a band
   * running over them repeats a fragment of the range as a detached shape
   * inside a month it does not belong to (#149 review). What stays on such a
   * day is the *point* state — `--selected`, or `--range-start` /
   * `--range-end` — because that marks one real, visible, clickable date
   * rather than an interval, exactly as `--selected` has always done in single
   * mode.
   */
  protected _isCellInRange(day: CalendarDayCell<D>): boolean {
    return day.currentMonth && this.isInDisplayRange(day.date);
  }

  /**
   * @protected Whether the cell caps the band at the start of its painted run
   * within the week row.
   *
   * The band is drawn cell by cell with square edges, so it needs a cap
   * wherever the paint begins. That used to be the row's first cell, which was
   * the same thing while adjacent-month cells were painted too; now the paint
   * can also begin partway into a row, right after the last filler day. Rows
   * that lie wholly inside the month are unaffected.
   */
  protected _isBandRowStart(
    week: CalendarDayCell<D>[],
    index: number,
  ): boolean {
    return (
      this._isCellInRange(week[index]) &&
      (index === 0 || !this._isCellInRange(week[index - 1]))
    );
  }

  /**
   * @protected Whether the cell caps the band at the end of its painted run
   * within the week row. Mirror of {@link _isBandRowStart}.
   */
  protected _isBandRowEnd(week: CalendarDayCell<D>[], index: number): boolean {
    return (
      this._isCellInRange(week[index]) &&
      (index === week.length - 1 || !this._isCellInRange(week[index + 1]))
    );
  }

  /**
   * @protected The `aria-selected` value for a grid cell.
   *
   * Reports what the cell paints, so the accessibility tree and the grid never
   * disagree. In range mode an adjacent-month cell paints only when it is a
   * committed endpoint, so only then does it announce itself as selected; the
   * month that owns the date reports the rest of the band. Preview endpoints
   * are excluded on both paths — a hovered date is not selected yet.
   */
  protected _cellSelected(day: CalendarDayCell<D>): boolean {
    if (!this.range()) {
      return this.isSelected(day.date);
    }

    return day.currentMonth
      ? this.isInRange(day.date)
      : this.isRangeStart(day.date) || this.isRangeEnd(day.date);
  }

  /** Previews a potential range end without changing the selected range value. */
  previewRange(date: D): void {
    const value = this.rangeValue();
    if (
      !this.range() ||
      !value?.start ||
      value.end ||
      this.isDateDisabled(date)
    ) {
      return;
    }

    this._rangePreviewDate.set(this._dateAdapter.clone(date));
  }

  /** Clears the transient range preview when pointer/focus leaves the day grid. */
  clearRangePreview(): void {
    this._rangePreviewDate.set(null);
  }

  /** Returns `true` when the date lies inside the selected range. */
  isInRange(date: D): boolean {
    const rangeValue = this.rangeValue();
    if (!rangeValue?.start || !rangeValue?.end) {
      return false;
    }

    return (
      this._dateAdapter.compareDate(date, rangeValue.start) >= 0 &&
      this._dateAdapter.compareDate(date, rangeValue.end) <= 0
    );
  }

  /** Returns `true` when the date is the active navigated date. */
  isActive(date: D): boolean {
    return this._dateAdapter.sameDate(date, this.activeDate());
  }

  /** Returns `true` when the given year matches the active year. */
  isCurrentYear(year: number): boolean {
    return this._dateAdapter.getYear(this.activeDate()) === year;
  }

  /** Returns `true` when the given month index matches the active month. */
  isCurrentMonthIndex(month: number): boolean {
    return this._dateAdapter.getMonth(this.activeDate()) === month;
  }

  /** Returns `true` when an entire month has no selectable dates. */
  isMonthDisabled(month: number): boolean {
    const activeDate = this.activeDate();
    return !this._hasSelectableDateInRange(
      this._dateAdapter.createDate(
        this._dateAdapter.getYear(activeDate),
        month,
        1,
      ),
      this._dateAdapter.createDate(
        this._dateAdapter.getYear(activeDate),
        month,
        this._dateAdapter.getNumDaysInMonth(
          this._dateAdapter.createDate(
            this._dateAdapter.getYear(activeDate),
            month,
            1,
          ),
        ),
      ),
    );
  }

  /** Returns `true` when an entire year has no selectable dates. */
  isYearDisabled(year: number): boolean {
    return !this._hasSelectableDateInRange(
      this._dateAdapter.createDate(year, 0, 1),
      this._dateAdapter.createDate(year, 11, 31),
    );
  }

  /** Returns `true` when navigating to the previous period is allowed. */
  canNavigatePrev(): boolean {
    const activeDate = this.activeDate();
    if (this.currentView() === 'month') {
      const previousMonth = this._dateAdapter.addCalendarMonths(activeDate, -1);
      return this._hasSelectableDateInRange(
        this._dateAdapter.createDate(
          this._dateAdapter.getYear(previousMonth),
          this._dateAdapter.getMonth(previousMonth),
          1,
        ),
        this._dateAdapter.createDate(
          this._dateAdapter.getYear(previousMonth),
          this._dateAdapter.getMonth(previousMonth),
          this._dateAdapter.getNumDaysInMonth(previousMonth),
        ),
      );
    }

    if (this.currentView() === 'year') {
      const previousYear = this._dateAdapter.addCalendarYears(activeDate, -1);
      return this._hasSelectableDateInRange(
        this._dateAdapter.createDate(
          this._dateAdapter.getYear(previousYear),
          0,
          1,
        ),
        this._dateAdapter.createDate(
          this._dateAdapter.getYear(previousYear),
          11,
          31,
        ),
      );
    }

    const blockStart = this._yearBlockStart(activeDate) - 24;
    return this._hasSelectableDateInRange(
      this._dateAdapter.createDate(blockStart, 0, 1),
      this._dateAdapter.createDate(blockStart + 23, 11, 31),
    );
  }

  /** Returns `true` when navigating to the next period is allowed. */
  canNavigateNext(): boolean {
    const activeDate = this.activeDate();
    if (this.currentView() === 'month') {
      const nextMonth = this._dateAdapter.addCalendarMonths(activeDate, 1);
      return this._hasSelectableDateInRange(
        this._dateAdapter.createDate(
          this._dateAdapter.getYear(nextMonth),
          this._dateAdapter.getMonth(nextMonth),
          1,
        ),
        this._dateAdapter.createDate(
          this._dateAdapter.getYear(nextMonth),
          this._dateAdapter.getMonth(nextMonth),
          this._dateAdapter.getNumDaysInMonth(nextMonth),
        ),
      );
    }

    if (this.currentView() === 'year') {
      const nextYear = this._dateAdapter.addCalendarYears(activeDate, 1);
      return this._hasSelectableDateInRange(
        this._dateAdapter.createDate(this._dateAdapter.getYear(nextYear), 0, 1),
        this._dateAdapter.createDate(
          this._dateAdapter.getYear(nextYear),
          11,
          31,
        ),
      );
    }

    const blockStart = this._yearBlockStart(activeDate) + 24;
    return this._hasSelectableDateInRange(
      this._dateAdapter.createDate(blockStart, 0, 1),
      this._dateAdapter.createDate(blockStart + 23, 11, 31),
    );
  }

  /** Produces a localized accessible label for a day cell. */
  getDayLabel(date: D): string {
    this._dateAdapter.locale();
    return this._dateAdapter.getDateLabel(date);
  }

  /** Produces a localized day-of-month label for a day cell. */
  getDayNumber(date: D): string {
    this._dateAdapter.locale();
    return this._dateAdapter.getDayOfMonthLabel(date);
  }

  /** Produces the localized ARIA label for the year-view month grid. */
  getYearViewLabel(): string {
    return this._resolver.resolve(
      this._i18n() as unknown as Record<string, string>,
      'selectMonthForYear',
      { year: this._dateAdapter.getYearLabel(this.activeDate()) },
    );
  }

  /** Produces a localized year label for multi-year buttons and ranges. */
  getYearOptionLabel(year: number): string {
    this._dateAdapter.locale();
    return this._dateAdapter.getYearLabel(
      this._dateAdapter.createDate(year, 0, 1),
    );
  }

  /** Stable tracking key for month grid cells. */
  trackDay(_index: number, day: CalendarDayCell<D>): string {
    return `${this._dateAdapter.toIso8601(day.date)}-${day.currentMonth ? 'current' : 'adjacent'}`;
  }

  /** Dispatches keyboard events to the active view's handler. */
  onKeydown(event: KeyboardEvent): void {
    switch (this.currentView()) {
      case 'month':
        this._handleMonthViewKeydown(event);
        break;
      case 'year':
        this._handleYearViewKeydown(event);
        break;
      case 'multi-year':
        this._handleMultiYearViewKeydown(event);
        break;
    }
  }

  /** @private Keyboard navigation for the month (day grid) view. */
  private _handleMonthViewKeydown(event: KeyboardEvent): void {
    let nextDate: D | null = null;

    switch (
      this._rtlService.normalizeArrowKey(event, this._direction()) ??
      event.key
    ) {
      case LEFT_ARROW:
        nextDate = this._dateAdapter.addCalendarDays(this.activeDate(), -1);
        break;
      case RIGHT_ARROW:
        nextDate = this._dateAdapter.addCalendarDays(this.activeDate(), 1);
        break;
      case UP_ARROW:
        nextDate = this._dateAdapter.addCalendarDays(this.activeDate(), -7);
        break;
      case DOWN_ARROW:
        nextDate = this._dateAdapter.addCalendarDays(this.activeDate(), 7);
        break;
      case 'PageUp':
        nextDate = this._dateAdapter.addCalendarMonths(this.activeDate(), -1);
        break;
      case 'PageDown':
        nextDate = this._dateAdapter.addCalendarMonths(this.activeDate(), 1);
        break;
      case 'Home':
        nextDate = this._dateAdapter.createDate(
          this._dateAdapter.getYear(this.activeDate()),
          this._dateAdapter.getMonth(this.activeDate()),
          1,
        );
        break;
      case 'End':
        nextDate = this._dateAdapter.createDate(
          this._dateAdapter.getYear(this.activeDate()),
          this._dateAdapter.getMonth(this.activeDate()),
          this._dateAdapter.getNumDaysInMonth(this.activeDate()),
        );
        break;
      case 'Enter':
      case ' ':
        this.selectDate(this.activeDate());
        event.preventDefault();
        return;
      default:
        return;
    }

    event.preventDefault();
    this.activeDate.set(nextDate);
    this._scheduleFocusActiveCell();
  }

  /** @private Keyboard navigation for the year (month grid, 4 columns) view. */
  private _handleYearViewKeydown(event: KeyboardEvent): void {
    const activeDate = this.activeDate();
    const currentMonth = this._dateAdapter.getMonth(activeDate);
    let nextMonth: number | null = null;

    switch (
      this._rtlService.normalizeArrowKey(event, this._direction()) ??
      event.key
    ) {
      case LEFT_ARROW:
        nextMonth = currentMonth - 1;
        break;
      case RIGHT_ARROW:
        nextMonth = currentMonth + 1;
        break;
      case UP_ARROW:
        nextMonth = currentMonth - 4;
        break;
      case DOWN_ARROW:
        nextMonth = currentMonth + 4;
        break;
      case 'Home':
        nextMonth = 0;
        break;
      case 'End':
        nextMonth = 11;
        break;
      case 'Enter':
      case ' ':
        this.selectMonth(currentMonth);
        event.preventDefault();
        return;
      default:
        return;
    }

    event.preventDefault();

    if (nextMonth < 0 || nextMonth > 11) return;

    const year = this._dateAdapter.getYear(activeDate);
    const day = Math.min(
      this._dateAdapter.getDate(activeDate),
      this._dateAdapter.getNumDaysInMonth(
        this._dateAdapter.createDate(year, nextMonth, 1),
      ),
    );
    this.activeDate.set(this._dateAdapter.createDate(year, nextMonth, day));
    this._scheduleFocusActiveCell();
  }

  /** @private Keyboard navigation for the multi-year (year grid, 4 columns) view. */
  private _handleMultiYearViewKeydown(event: KeyboardEvent): void {
    const activeDate = this.activeDate();
    const currentYear = this._dateAdapter.getYear(activeDate);
    const blockStart = this._yearBlockStart(activeDate);
    let nextYear: number | null = null;

    switch (
      this._rtlService.normalizeArrowKey(event, this._direction()) ??
      event.key
    ) {
      case LEFT_ARROW:
        nextYear = currentYear - 1;
        break;
      case RIGHT_ARROW:
        nextYear = currentYear + 1;
        break;
      case UP_ARROW:
        nextYear = currentYear - 4;
        break;
      case DOWN_ARROW:
        nextYear = currentYear + 4;
        break;
      case 'Home':
        nextYear = blockStart;
        break;
      case 'End':
        nextYear = blockStart + 23;
        break;
      case 'Enter':
      case ' ':
        this.selectYear(currentYear);
        event.preventDefault();
        return;
      default:
        return;
    }

    event.preventDefault();

    if (nextYear < blockStart || nextYear > blockStart + 23) return;

    const month = this._dateAdapter.getMonth(activeDate);
    const day = Math.min(
      this._dateAdapter.getDate(activeDate),
      this._dateAdapter.getNumDaysInMonth(
        this._dateAdapter.createDate(nextYear, month, 1),
      ),
    );
    this.activeDate.set(this._dateAdapter.createDate(nextYear, month, day));
    this._scheduleFocusActiveCell();
  }

  /**
   * Moves keyboard focus to the active cell of the current view (the day, month,
   * or year button carrying `tabindex="0"`). Public entry point for consumers
   * (e.g. `mlv-day-picker`, `mlv-date-range-picker`) that open the calendar in
   * a popup and want focus to land inside the grid.
   */
  focus(): void {
    this._focusActiveCell();
  }

  /**
   * @private Schedule a focus move to the active cell after the next render, so
   * the roving `tabindex="0"` element (re-rendered after `activeDate` changes)
   * exists in the DOM before we focus it. Only invoked from keyboard handlers,
   * so programmatic `activeDate` changes never steal focus.
   */
  private _scheduleFocusActiveCell(): void {
    afterNextRender(() => this._focusActiveCell(), {
      injector: this._injector,
    });
  }

  /** @private Focus the current view's active cell (roving `tabindex="0"`). */
  private _focusActiveCell(): void {
    const selector =
      this.currentView() === 'month'
        ? '.mlv-calendar__day--active'
        : '.mlv-calendar__selection-button--current';
    const host = this._elementRef.nativeElement as HTMLElement;
    const cell = host.querySelector(selector) as HTMLElement | null;
    cell?.focus();
  }

  /** @private Resolves the initial active date from the selected value/range, falling back to today. */
  private _getInitialActiveDate(): D {
    const selected =
      this.value() ?? this.rangeValue()?.start ?? this.rangeValue()?.end;

    return selected
      ? this._dateAdapter.clone(selected)
      : this._dateAdapter.today();
  }

  /** @private Returns the first year of the 24-year block containing the given date. */
  private _yearBlockStart(date: D): number {
    const year = this._dateAdapter.getYear(date);
    return year - (year % 24);
  }

  /** @private Whether at least one selectable (non-disabled, in-bounds) date exists in the inclusive range. */
  private _hasSelectableDateInRange(start: D, end: D): boolean {
    const minDate = this.min();
    const maxDate = this.max();

    if (minDate && this._dateAdapter.compareDate(end, minDate) < 0) {
      return false;
    }

    if (maxDate && this._dateAdapter.compareDate(start, maxDate) > 0) {
      return false;
    }

    let cursor =
      minDate && this._dateAdapter.compareDate(start, minDate) < 0
        ? this._dateAdapter.clone(minDate)
        : this._dateAdapter.clone(start);

    const effectiveEnd =
      maxDate && this._dateAdapter.compareDate(end, maxDate) > 0
        ? this._dateAdapter.clone(maxDate)
        : this._dateAdapter.clone(end);

    while (this._dateAdapter.compareDate(cursor, effectiveEnd) <= 0) {
      if (!this.isDateDisabled(cursor)) {
        return true;
      }

      cursor = this._dateAdapter.addCalendarDays(cursor, 1);
    }

    return false;
  }
}
