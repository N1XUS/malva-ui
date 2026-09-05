import {
  ChangeDetectionStrategy,
  Component,
  NgZone,
  PLATFORM_ID,
  ViewEncapsulation,
  afterRenderEffect,
  computed,
  contentChild,
  effect,
  forwardRef,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  type Signal,
  type TemplateRef,
} from '@angular/core';
import { NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import {
  coerceBooleanProperty,
  type BooleanInput,
} from '@angular/cdk/coercion';
import { LucideChevronLeft, LucideChevronRight } from '@lucide/angular';
import { MlvButton } from '@malva-ui/core/button';
import { MlvSegmented, MlvSegmentedItem } from '@malva-ui/core/segmented';
import {
  MLV_DATE_ADAPTER,
  MlvNativeDateAdapter,
  type MlvDateAdapter,
} from '@malva-ui/core/date';
import {
  MLV_DENSITY_ELEMENT,
  MlvDensityDirective,
} from '@malva-ui/cdk/density';
import { mlvNextId } from '@malva-ui/cdk/utils';
import {
  MLV_SCHEDULER_I18N,
  MlvI18nResolverService,
  type MlvSchedulerI18n,
} from '@malva-ui/i18n';
import { MlvSchedulerDragService } from '../drag/scheduler-drag.service';
import { nextVisibleDate } from '../layout/scheduler-focus';
import { parseTime } from '../layout/scheduler-time';
import {
  computeVisibleRange,
  normalizeEvent,
  rowLength as computeRowLength,
  visibleDays,
  type MlvSchedulerNormalizedEvent,
} from '../layout/scheduler-layout';
import { MlvSchedulerMonth } from '../month/scheduler-month';
import { MlvSchedulerTimeGrid } from '../time-grid/scheduler-time-grid';
import {
  MLV_SCHEDULER_CONTEXT,
  type MlvSchedulerContext,
  type MlvSchedulerFocusRequest,
  type MlvSchedulerInteractionKind,
  type MlvSchedulerScrollRequest,
} from './scheduler-context';
import { MlvSchedulerEventDef, MlvSchedulerHeaderDef } from './scheduler-defs';
import type {
  MlvSchedulerBusinessHours,
  MlvSchedulerCanChange,
  MlvSchedulerChangeSource,
  MlvSchedulerEvent,
  MlvSchedulerEventChange,
  MlvSchedulerEventContext,
  MlvSchedulerEventInteraction,
  MlvSchedulerExternalDropEvent,
  MlvSchedulerHeaderContext,
  MlvSchedulerMoreClickEvent,
  MlvSchedulerNextRange,
  MlvSchedulerRangeSelectEvent,
  MlvSchedulerSlotEvent,
  MlvSchedulerView,
  MlvSchedulerVisibleRange,
} from './scheduler.types';

const VIEWS: readonly MlvSchedulerView[] = ['month', 'week', 'day'];

/**
 * Calendar scheduler with month, week and day views, timed / all-day /
 * multi-day events, drag-move, resize, range selection and keyboard
 * equivalents. Dates go through the active `MlvDateAdapter`.
 */
@Component({
  selector: 'mlv-scheduler',
  templateUrl: './scheduler.html',
  styleUrl: './scheduler.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    MlvButton,
    MlvSegmented,
    MlvSegmentedItem,
    LucideChevronLeft,
    LucideChevronRight,
    MlvSchedulerMonth,
    MlvSchedulerTimeGrid,
  ],
  hostDirectives: [{ directive: MlvDensityDirective, inputs: ['mlvDensity'] }],
  providers: [
    { provide: MLV_DENSITY_ELEMENT, useValue: 'scheduler' },
    {
      provide: MLV_SCHEDULER_CONTEXT,
      useExisting: forwardRef(() => MlvScheduler),
    },
    MlvSchedulerDragService,
  ],
  host: {
    class: 'mlv-scheduler',
    // The custom element has no implicit role, so `aria-label` on it would be
    // an ARIA-prohibited attribute on a generic container and go unannounced.
    // `group` is the weakest role that takes a name, keeps the two grids and
    // the toolbar in one labelled region, and adds no required children.
    role: 'group',
    '[class]': '"mlv-scheduler--" + view()',
    '[class.mlv-scheduler--dragging]': 'dragging()',
    '[attr.aria-label]': 'ariaLabel() ?? i18n().scheduler',
  },
})
export class MlvScheduler<D = Date, TData = unknown>
  implements MlvSchedulerContext<D, TData>
{
  // ─── Models ────────────────────────────────────────────────────────────
  /** The events to render. Replaced with a new array (never mutated) after a move or resize. */
  readonly events = model<readonly MlvSchedulerEvent<D, TData>[]>([]);
  /** Active view. */
  readonly view = model<MlvSchedulerView>('month');

  /** @internal Active adapter: a provided `MLV_DATE_ADAPTER`, else the native fallback. */
  readonly adapter: MlvDateAdapter<D> =
    (inject(MLV_DATE_ADAPTER, {
      optional: true,
    }) as MlvDateAdapter<D> | null) ??
    (inject(MlvNativeDateAdapter) as unknown as MlvDateAdapter<D>);

  /** Anchor date; the visible range is derived from it, `view` and `firstDayOfWeek`. Defaults to today. */
  readonly date = model<D>(this.adapter.today());

  // ─── Inputs ────────────────────────────────────────────────────────────
  /** First day of the week, `0` = Sunday. */
  readonly firstDayOfWeek = input(1);
  /** Weekdays (0 = Sunday) removed from every view, e.g. `[0, 6]` for a working week. */
  readonly hiddenDays = input<readonly number[]>([]);
  /** First visible hour of the time grid, `'HH:mm'`; must be earlier than `maxTime`. */
  readonly minTime = input('00:00');
  /** Last visible hour of the time grid, `'HH:mm'`; `'24:00'` allowed, must be later than `minTime`. */
  readonly maxTime = input('24:00');
  /** Height unit of the time grid in **positive minutes**; must divide 60. */
  readonly slotDuration = input(30);
  /**
   * Drag / resize / selection granularity in **positive minutes**.
   * `undefined` follows `slotDuration`.
   */
  readonly snapDuration = input<number | undefined>(undefined);
  /** Duration in minutes for all-day → timed drops, external drops and `end <= start` repair. */
  readonly defaultEventDuration = input(60);
  /** Working-hours shading; `null` = none. */
  readonly businessHours = input<MlvSchedulerBusinessHours | null>(null);
  /** Master switch for move + resize (pointer and keyboard). */
  readonly editable = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });
  /** Enables pointer and keyboard range selection. */
  readonly selectable = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });
  /** Veto hook for moves. Return `false` to snap back without emitting. */
  readonly canMove = input<MlvSchedulerCanChange<D, TData> | null>(null);
  /** Veto hook for resizes. */
  readonly canResize = input<MlvSchedulerCanChange<D, TData> | null>(null);
  /** SortableJS group name; foreign lists sharing it can drop in (`externalDrop`). */
  readonly dragGroup = input('mlv-scheduler');
  /** Shows the now-line and today highlight. */
  readonly showCurrentTime = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });
  /**
   * Centres the current wall-clock time in the time grid's viewport on the
   * initial scroll, instead of top-aligning the business-hours start. Falls
   * back to that default when the current time is outside `[minTime, maxTime)`.
   * The target is the time of day, so a week without today still opens around
   * now o'clock. `scrollToTime()` stays top-aligned; the month view ignores it.
   */
  readonly scrollToCurrentTime = input<boolean, BooleanInput>(false, {
    transform: coerceBooleanProperty,
  });
  /** `false` hides the built-in toolbar even without a header def. */
  readonly toolbar = input<boolean, BooleanInput>(true, {
    transform: coerceBooleanProperty,
  });
  /** Accessible name of the host; defaults to the i18n `scheduler` string. */
  readonly ariaLabel = input<string | undefined>(undefined);

  // ─── Outputs ───────────────────────────────────────────────────────────
  /** After a drop or keyboard move wrote the model. */
  readonly eventMove = output<MlvSchedulerEventChange<D, TData>>();
  /** After a resize wrote the model. */
  readonly eventResize = output<MlvSchedulerEventChange<D, TData>>();
  /** Click without drag, or Enter / Space on a chip. */
  readonly eventClick = output<MlvSchedulerEventInteraction<D, TData>>();
  /** Double click on a chip. */
  readonly eventDoubleClick = output<MlvSchedulerEventInteraction<D, TData>>();
  /** `contextmenu` on a chip; the default is never prevented. */
  readonly eventContextMenu = output<MlvSchedulerEventInteraction<D, TData>>();
  /** Click on an empty slot / cell, or Space on a focused cell. */
  readonly slotClick = output<MlvSchedulerSlotEvent<D>>();
  /** Double click on an empty slot / cell. */
  readonly slotDoubleClick = output<MlvSchedulerSlotEvent<D>>();
  /** `contextmenu` on an empty slot / cell. */
  readonly slotContextMenu = output<MlvSchedulerSlotEvent<D>>();
  /** Pointer drag over empty slots / cells, or Shift+Arrow then Enter. */
  readonly rangeSelect = output<MlvSchedulerRangeSelectEvent<D>>();
  /** A foreign SortableJS item was dropped on a slot / cell. */
  readonly externalDrop = output<MlvSchedulerExternalDropEvent<D>>();
  /** On init and whenever the rendered period changes. */
  readonly visibleRangeChange = output<MlvSchedulerVisibleRange<D>>();
  /**
   * A "+N more" press that OPENS its popover. The button toggles, and the
   * closing press emits nothing.
   */
  readonly moreClick = output<MlvSchedulerMoreClickEvent<D, TData>>();

  // ─── Slots ─────────────────────────────────────────────────────────────
  /** @private The projected `*mlvSchedulerEventDef`, read only by `eventDef`. */
  private readonly _eventDefRef = contentChild(MlvSchedulerEventDef);
  /** @protected Custom toolbar. */
  protected readonly headerDefRef = contentChild(MlvSchedulerHeaderDef);

  // ─── Context surface ───────────────────────────────────────────────────
  /** @internal Resolved scheduler translation strings. */
  readonly i18n: Signal<MlvSchedulerI18n> = inject(MLV_SCHEDULER_I18N);
  /** @private ICU resolver. */
  private readonly _resolver = inject(MlvI18nResolverService);
  /** @private Only the browser ticks the clock. */
  private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  /** @private The minute ticker runs outside the zone. */
  private readonly _zone = inject(NgZone);
  /** @private Pointer drag engine; one per scheduler. */
  private readonly _drag = inject(MlvSchedulerDragService<D, TData>);

  /** Rendered period. */
  readonly visibleRange = computed<MlvSchedulerVisibleRange<D>>(() =>
    computeVisibleRange(
      this.adapter,
      this.view(),
      this.date(),
      this.firstDayOfWeek(),
    ),
  );
  /** @internal `visibleRange` under the name the view context reads. */
  readonly range = this.visibleRange;
  /**
   * @internal Days rendered by the active view, after `hiddenDays`.
   *
   * In the **day** view `hiddenDays` steers navigation (`next()` / `previous()`
   * skip hidden weekdays, see `_step`) but never blanks the grid: a one-day
   * range whose weekday is hidden would otherwise filter down to `[]`, and the
   * time grid would render its `role="group"` sheet with no column listbox, no
   * slot and therefore no roving tab stop. An anchor pointed straight at a
   * hidden weekday — a `[date]` binding or an explicit `goTo()` — renders that
   * day as asked.
   */
  readonly days = computed(() => {
    const range = this.visibleRange();
    const days = visibleDays(this.adapter, range, this.hiddenDays());
    if (days.length === 0 && range.view === 'day') {
      return visibleDays(this.adapter, range, []);
    }
    return days;
  });
  /** @internal Visible days per month week row. */
  readonly rowLength = computed(() => computeRowLength(this.hiddenDays()));
  /** @private Bumped every minute while `showCurrentTime`; `today` / `nowMinutes` depend on it. */
  private readonly _clockTick = signal(0);
  /**
   * @internal Today per the adapter, refreshed with the clock tick.
   *
   * `equal` compares by calendar day, not by identity: the adapter returns a
   * NEW date object on every call, so with the default `Object.is` this signal
   * would change identity on every 60 s tick and invalidate every consumer —
   * including the views' `linkedSignal` roving-focus defaults, which would then
   * silently discard the cell the user had roved to once a minute.
   */
  readonly today = computed(
    () => {
      this._clockTick();
      return this.adapter.today();
    },
    { equal: (a, b) => this.adapter.sameDate(a, b) },
  );
  /** @internal Wall-clock minutes of day, refreshed with the clock tick. */
  readonly nowMinutes = computed(() => {
    this._clockTick();
    return this.adapter.minutesOfDay(this.adapter.now());
  });
  /** @internal `events` with repaired ends and all-day boundaries. */
  readonly normalizedEvents = computed(() => {
    const duration = this.defaultEventDuration();
    return this.events().map((event) =>
      normalizeEvent(this.adapter, event, duration),
    );
  });
  /**
   * @private `[minTime, maxTime)` as minutes of day, validated as one pair.
   *
   * The time grid divides by `maxMinutes - minMinutes` for every hour line,
   * chip offset and chip height, so a window that is not strictly ascending
   * writes `NaN%` / `Infinity%` into the geometry custom properties — invalid
   * declarations the browser silently drops, leaving every chip stacked at the
   * container origin with no error anywhere. Fail loudly instead, the way
   * `slotCount` does for a non-positive `slotDuration`.
   */
  private readonly _timeWindow = computed(() => {
    const min = parseTime(this.minTime());
    const max = parseTime(this.maxTime());
    if (max <= min) {
      throw new Error(
        `Invalid scheduler time window "${this.minTime()}"–"${this.maxTime()}". minTime must be earlier than maxTime.`,
      );
    }
    return { min, max };
  });
  /** @internal First visible minute of day, parsed from `minTime`. */
  readonly minMinutes = computed(() => this._timeWindow().min);
  /** @internal Last visible minute of day, parsed from `maxTime`. */
  readonly maxMinutes = computed(() => this._timeWindow().max);
  /** @internal Effective snap: `snapDuration` or `slotDuration`. */
  readonly snap = computed(() => this.snapDuration() ?? this.slotDuration());
  /** @internal The projected chip template, if any. */
  readonly eventDef = computed<TemplateRef<
    MlvSchedulerEventContext<D, TData>
  > | null>(
    () =>
      (this._eventDefRef()?.templateRef as
        | TemplateRef<MlvSchedulerEventContext<D, TData>>
        | undefined) ?? null,
  );
  /** @internal `id` of the visually hidden keyboard hint chips reference via `aria-describedby`. */
  readonly dragHintId = mlvNextId('mlv-scheduler-hint');
  /** @internal What the active view should focus after its next render. */
  readonly pendingFocus = signal<MlvSchedulerFocusRequest<D> | null>(null);
  /** @private Backing signal of `scrollRequest`. */
  private readonly _scrollRequest = signal<MlvSchedulerScrollRequest | null>(
    null,
  );
  /** @internal The latest `scrollToTime()` call waiting for the time grid. */
  readonly scrollRequest = this._scrollRequest.asReadonly();
  /** @private Backing signal of `dragging`. */
  private readonly _dragging = signal(false);
  /** @internal `true` while a SortableJS drag owns the pointer. */
  readonly dragging = this._dragging.asReadonly();

  /** Localized title: month-year, "Aug 31 – Sep 6, 2026", or the full day label. */
  readonly title = computed(() => {
    const range = this.visibleRange();
    switch (this.view()) {
      case 'month':
        return this.adapter.getMonthYearLabel(this.date());
      case 'week': {
        const last = this.adapter.addCalendarDays(range.end, -1);
        return `${this.adapter.format(range.start, { day: 'numeric', month: 'short' })} – ${this.adapter.format(last, { day: 'numeric', month: 'short', year: 'numeric' })}`;
      }
      case 'day':
        return this.adapter.getDateLabel(this.date());
    }
  });

  /** @protected Context handed to a `*mlvSchedulerHeaderDef`. */
  protected readonly _headerContext = computed<MlvSchedulerHeaderContext<D>>(
    () => ({
      $implicit: {
        title: this.title(),
        view: this.view(),
        range: this.visibleRange(),
        next: () => this.next(),
        previous: () => this.previous(),
        today: () => this.goToToday(),
        setView: (view) => this.setView(view),
      },
    }),
  );
  /** @protected Previous-button label. */
  protected readonly _previousLabel = computed(() =>
    this.translate('previous', { view: this.view() }),
  );
  /** @protected Next-button label. */
  protected readonly _nextLabel = computed(() =>
    this.translate('next', { view: this.view() }),
  );
  /**
   * @protected The two polite live-region slots. Exactly one ever carries
   * text; `announce()` alternates between them (see there).
   */
  protected readonly _liveMessages = signal<readonly [string, string]>([
    '',
    '',
  ]);
  /** @private Index of the slot the next announcement writes into. */
  private _liveSlot: 0 | 1 = 0;
  /** @private Announcements made since the last render; see `announce()`. */
  private _liveBatch = 0;
  /** @private Last range handed to `visibleRangeChange`. */
  private _emittedRange: MlvSchedulerVisibleRange<D> | null = null;
  /** @private Timestamp of the last `suppressNextClick()`; `0` once claimed or expired. */
  private _suppressClickAt = 0;

  constructor() {
    this._drag.attach(this);

    effect(() => {
      const range = this.visibleRange();
      untracked(() => {
        const previous = this._emittedRange;
        if (
          previous &&
          previous.view === range.view &&
          this.adapter.sameDate(previous.start, range.start) &&
          this.adapter.sameDate(previous.end, range.end)
        ) {
          return;
        }
        this._emittedRange = range;
        this.visibleRangeChange.emit(range);
        // The single place a period change is announced. Announcing from
        // `goTo()` / `_step()` instead would speak for a jump that resolves to
        // the period already on screen, and stay silent when a `[date]` or
        // `[view]` binding moves the range without going through them. The
        // first range is the one the user is already looking at, so it is
        // emitted but not announced.
        if (previous) this._announceRange();
      });
    });

    // One announcement batch per painted frame: see `announce()`.
    afterRenderEffect(() => {
      this._liveMessages();
      this._liveBatch = 0;
    });

    effect((onCleanup) => {
      if (!this._isBrowser || !this.showCurrentTime()) return;
      const id = this._zone.runOutsideAngular(() =>
        setInterval(() => this._clockTick.update((tick) => tick + 1), 60_000),
      );
      onCleanup(() => clearInterval(id));
    });
  }

  // ─── Public methods ────────────────────────────────────────────────────
  /** Moves one period forward (month / week / day per `view`). */
  next(): void {
    this._step(1);
  }

  /** Moves one period back. */
  previous(): void {
    this._step(-1);
  }

  /** Jumps to today. (Named `goToToday` because `today` is the current-date signal.) */
  goToToday(): void {
    this.goTo(this.adapter.today());
  }

  /** Jumps to `date` (the period containing it becomes visible). */
  goTo(date: D): void {
    this.date.set(date);
  }

  /** Switches the view. */
  setView(view: MlvSchedulerView): void {
    this.view.set(view);
  }

  /**
   * Scrolls the time grid so `time` (`'HH:mm'`) sits at the top.
   *
   * No-op in the month view: the call is dropped, not deferred. Recording it
   * would leave a request standing for whichever time grid appears next, which
   * would then open on a time asked for while another view was showing instead
   * of on its documented initial scroll.
   */
  scrollToTime(time: string): void {
    if (this.view() === 'month') return;
    this._scrollRequest.update((previous) => ({
      time,
      sequence: (previous?.sequence ?? 0) + 1,
    }));
  }

  // ─── Context methods ───────────────────────────────────────────────────
  /** @internal Resolves an ICU string of the scheduler pack. */
  translate(
    key: keyof MlvSchedulerI18n,
    params?: Record<string, string | number | boolean | Date>,
  ): string {
    return this._resolver.resolve(
      this.i18n() as unknown as Record<string, string>,
      key,
      params,
    );
  }

  /** @internal Localized time of day for a chip label, e.g. "9:30 AM". */
  formatTime(date: D): string {
    return this.adapter.format(date, { hour: 'numeric', minute: '2-digit' });
  }

  /** @internal Localized date + time, used whenever a label crosses a day boundary. */
  formatDateTime(date: D): string {
    return this.adapter.format(date, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  /**
   * @internal Announces `message` politely.
   *
   * Assistive tech only speaks a live region whose text actually **changed**,
   * so repeating a message verbatim (two rejected moves in a row, two steps
   * onto the same period) has to look like a change in the DOM. The usual
   * clear-then-set trick cannot deliver that under zoneless change detection:
   * both writes land before the scheduled render, so the region is painted
   * once with the final text and an identical repeat is silent.
   *
   * Instead the component renders two live regions and alternates: the new
   * message goes into the slot the previous one did not use, and that slot is
   * emptied. One render pass, one text insertion into a region that was empty,
   * announced every time — repeats included.
   *
   * Emptying the other slot is skipped for the second and further calls of one
   * change-detection pass, because they share the render the first one is
   * waiting for. A keyboard move that leaves the visible period is exactly
   * that: `commitChange()` announces the move and the `visibleRangeChange`
   * effect announces the new period, both before anything is painted, and
   * clearing would drop the move. `_liveBatch` is reset after every render, so
   * two announcements a pass apart still get a cleared destination each.
   */
  announce(message: string): void {
    const slot = this._liveSlot;
    this._liveSlot = slot === 0 ? 1 : 0;
    const keepOther = this._liveBatch > 0;
    this._liveBatch++;
    this._liveMessages.update(([first, second]) =>
      slot === 0
        ? [message, keepOther ? second : '']
        : [keepOther ? first : '', message],
    );
  }

  /** @internal Fans one chip interaction out to `eventClick` / `eventDoubleClick` / `eventContextMenu`. */
  emitEventInteraction(
    kind: MlvSchedulerInteractionKind,
    payload: MlvSchedulerEventInteraction<D, TData>,
  ): void {
    const target =
      kind === 'click'
        ? this.eventClick
        : kind === 'dblclick'
          ? this.eventDoubleClick
          : this.eventContextMenu;
    target.emit(payload);
  }

  /** @internal Fans one cell interaction out to `slotClick` / `slotDoubleClick` / `slotContextMenu`. */
  emitSlotInteraction(
    kind: MlvSchedulerInteractionKind,
    payload: MlvSchedulerSlotEvent<D>,
  ): void {
    const target =
      kind === 'click'
        ? this.slotClick
        : kind === 'dblclick'
          ? this.slotDoubleClick
          : this.slotContextMenu;
    target.emit(payload);
  }

  /** @internal Re-emits a committed range selection as `rangeSelect`. */
  emitRangeSelect(payload: MlvSchedulerRangeSelectEvent<D>): void {
    this.rangeSelect.emit(payload);
  }

  /** @internal Re-emits a month cell's "+N more" activation as `moreClick`; the view calls this only for the press that OPENS the popover, never for the one that toggles it shut. */
  emitMoreClick(payload: MlvSchedulerMoreClickEvent<D, TData>): void {
    this.moreClick.emit(payload);
  }

  /** @internal Re-emits a foreign SortableJS drop as `externalDrop`; nothing is written to `events`. */
  emitExternalDrop(payload: MlvSchedulerExternalDropEvent<D>): void {
    this.externalDrop.emit(payload);
  }

  /** @internal See `MlvSchedulerContext.commitChange`. */
  commitChange(
    kind: 'move' | 'resize',
    normalized: MlvSchedulerNormalizedEvent<D, TData>,
    next: MlvSchedulerNextRange<D>,
    source: MlvSchedulerChangeSource,
  ): boolean {
    const current = this.events().find(
      (event) => event.id === normalized.event.id,
    );
    if (!current) return false;
    const hook = kind === 'move' ? this.canMove() : this.canResize();
    if (hook && !hook(current, next)) {
      this.announce(this.translate('moveRejected', { title: current.title }));
      return false;
    }
    const updated: MlvSchedulerEvent<D, TData> = {
      ...current,
      start: next.start,
      end: next.end,
      allDay: next.allDay,
    };
    this.events.update((list) =>
      list.map((event) => (event.id === updated.id ? updated : event)),
    );
    const change: MlvSchedulerEventChange<D, TData> = {
      event: updated,
      previous: {
        start: normalized.start,
        end: normalized.end,
        allDay: normalized.allDay,
      },
      source,
    };
    if (kind === 'move') {
      this.eventMove.emit(change);
      this.announce(
        this.translate('eventMoved', {
          title: updated.title,
          start: next.allDay
            ? this.adapter.getDateLabel(next.start)
            : this.formatDateTime(next.start),
        }),
      );
    } else {
      this.eventResize.emit(change);
      this.announce(
        this.translate('eventResized', {
          title: updated.title,
          end: next.allDay
            ? this.adapter.getDateLabel(
                this.adapter.addCalendarDays(next.end, -1),
              )
            : this.formatDateTime(next.end),
        }),
      );
    }
    return true;
  }

  /** @internal Opens a 300 ms window in which the click that trails a drop is swallowed. */
  suppressNextClick(): void {
    this._suppressClickAt = performance.now();
  }

  /** @internal A stale suppression (no click followed the drop) must not eat a later click. */
  claimSuppressedClick(): boolean {
    const suppressed =
      this._suppressClickAt !== 0 &&
      performance.now() - this._suppressClickAt < 300;
    this._suppressClickAt = 0;
    return suppressed;
  }

  /**
   * @internal Time grid → root: clears the request it has just applied.
   *
   * Guarded on `sequence` so a `scrollToTime()` issued between the scroll and
   * this call survives: only the request that was actually applied is dropped.
   */
  consumeScrollRequest(sequence: number): void {
    this._scrollRequest.update((current) =>
      current && current.sequence === sequence ? null : current,
    );
  }

  /** @internal Drag service → root: mirrors a running SortableJS drag onto `dragging`. */
  setDragging(dragging: boolean): void {
    this._dragging.set(dragging);
  }

  // ─── Template handlers ─────────────────────────────────────────────────
  /** @protected `mlv-segmented` hands back `unknown`; only known views are applied. */
  protected _onViewSwitch(value: unknown): void {
    if (VIEWS.includes(value as MlvSchedulerView))
      this.setView(value as MlvSchedulerView);
  }

  /** @private Steps the anchor by one period and announces. */
  private _step(direction: -1 | 1): void {
    const date = this.date();
    switch (this.view()) {
      case 'month':
        this.date.set(this.adapter.addCalendarMonths(date, direction));
        break;
      case 'week':
        this.date.set(this.adapter.addCalendarDays(date, 7 * direction));
        break;
      case 'day':
        // A single-day range that lands on a hidden weekday would filter down
        // to no rendered day at all, so the day view steps over them: with
        // `hiddenDays=[0, 6]`, "next" from a Friday reaches Monday.
        this.date.set(
          nextVisibleDate(this.adapter, date, direction, this.hiddenDays()),
        );
        break;
    }
  }

  /**
   * @private "Showing {period}". Called from the `visibleRangeChange` effect
   * only, so it speaks exactly when the rendered period actually changed;
   * `title()` is read there rather than passed in, so it is always the title
   * of the range that just won.
   */
  private _announceRange(): void {
    this.announce(this.translate('rangeChanged', { period: this.title() }));
  }
}
