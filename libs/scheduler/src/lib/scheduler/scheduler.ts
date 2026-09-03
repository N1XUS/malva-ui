import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  PLATFORM_ID,
  ViewEncapsulation,
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
import { parseTime } from '../layout/scheduler-time';
import {
  computeVisibleRange,
  normalizeEvent,
  rowLength as computeRowLength,
  visibleDays,
  type MlvSchedulerNextRange,
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

  /** Active adapter: a provided `MLV_DATE_ADAPTER`, else the native fallback. */
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
  /** First visible hour of the time grid, `'HH:mm'`. */
  readonly minTime = input('00:00');
  /** Last visible hour of the time grid, `'HH:mm'`; `'24:00'` allowed. */
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
  /** "+N more" pressed (the popover opens regardless). */
  readonly moreClick = output<MlvSchedulerMoreClickEvent<D, TData>>();

  // ─── Slots ─────────────────────────────────────────────────────────────
  /** @protected Custom chip content. */
  protected readonly eventDefRef = contentChild(MlvSchedulerEventDef);
  /** @protected Custom toolbar. */
  protected readonly headerDefRef = contentChild(MlvSchedulerHeaderDef);

  // ─── Context surface ───────────────────────────────────────────────────
  /** Translation strings. */
  readonly i18n: Signal<MlvSchedulerI18n> = inject(MLV_SCHEDULER_I18N);
  /** @private ICU resolver. */
  private readonly _resolver = inject(MlvI18nResolverService);
  /** @private Only the browser ticks the clock. */
  private readonly _isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  /** @private The minute ticker runs outside the zone. */
  private readonly _zone = inject(NgZone);
  /** @private Guards microtask announcements after destroy. */
  private readonly _destroyRef = inject(DestroyRef);
  /** Host element, used by views for focus queries through the context. */
  readonly elementRef = inject(ElementRef<HTMLElement>);
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
  /** Alias required by the context. */
  readonly range = this.visibleRange;
  /** Days rendered by the active view, after `hiddenDays`. */
  readonly days = computed(() =>
    visibleDays(this.adapter, this.visibleRange(), this.hiddenDays()),
  );
  /** Visible days per month week row. */
  readonly rowLength = computed(() => computeRowLength(this.hiddenDays()));
  /** @private Bumped every minute while `showCurrentTime`; `today` / `nowMinutes` depend on it. */
  private readonly _clockTick = signal(0);
  /** Today per the adapter, refreshed with the clock tick. */
  readonly today = computed(() => {
    this._clockTick();
    return this.adapter.today();
  });
  /** Wall-clock minutes of day, refreshed with the clock tick. */
  readonly nowMinutes = computed(() => {
    this._clockTick();
    return this.adapter.minutesOfDay(this.adapter.now());
  });
  /** `events` with repaired ends and all-day boundaries. */
  readonly normalizedEvents = computed(() => {
    const duration = this.defaultEventDuration();
    return this.events().map((event) =>
      normalizeEvent(this.adapter, event, duration),
    );
  });
  /** First visible minute of day. */
  readonly minMinutes = computed(() => parseTime(this.minTime()));
  /** Last visible minute of day. */
  readonly maxMinutes = computed(() => parseTime(this.maxTime()));
  /** Effective snap: `snapDuration` or `slotDuration`. */
  readonly snap = computed(() => this.snapDuration() ?? this.slotDuration());
  /** The projected chip template, if any. */
  readonly eventDef = computed<TemplateRef<
    MlvSchedulerEventContext<D, TData>
  > | null>(
    () =>
      (this.eventDefRef()?.templateRef as
        | TemplateRef<MlvSchedulerEventContext<D, TData>>
        | undefined) ?? null,
  );
  /** `id` of the visually hidden keyboard hint chips reference via `aria-describedby`. */
  readonly dragHintId = mlvNextId('mlv-scheduler-hint');
  /** What the active view should focus after its next render. */
  readonly pendingFocus = signal<MlvSchedulerFocusRequest<D> | null>(null);
  /** @private Backing signal of `scrollRequest`. */
  private readonly _scrollRequest = signal<MlvSchedulerScrollRequest | null>(
    null,
  );
  /** The latest `scrollToTime()` call waiting for the time grid. */
  readonly scrollRequest = this._scrollRequest.asReadonly();
  /** @private Backing signal of `dragging`. */
  private readonly _dragging = signal(false);
  /** `true` while a SortableJS drag owns the pointer. */
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
  /** @protected Live-region text. */
  protected readonly _liveMessage = signal('');
  /** @private Monotonic sequence so a stale microtask never overwrites a newer announcement. */
  private _announceSequence = 0;
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
      });
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
    this._announceRange();
  }

  /** Switches the view. */
  setView(view: MlvSchedulerView): void {
    this.view.set(view);
  }

  /**
   * Scrolls the time grid so `time` (`'HH:mm'`) sits at the top. No-op in
   * the month view.
   */
  scrollToTime(time: string): void {
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

  /** @internal */
  formatTime(date: D): string {
    return this.adapter.format(date, { hour: 'numeric', minute: '2-digit' });
  }

  /** @internal */
  formatDateTime(date: D): string {
    return this.adapter.format(date, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  /** @internal */
  announce(message: string): void {
    const sequence = ++this._announceSequence;
    this._liveMessage.set('');
    queueMicrotask(() => {
      if (this._destroyRef.destroyed || sequence !== this._announceSequence)
        return;
      this._liveMessage.set(message);
    });
  }

  /** @internal */
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

  /** @internal */
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

  /** @internal */
  emitRangeSelect(payload: MlvSchedulerRangeSelectEvent<D>): void {
    this.rangeSelect.emit(payload);
  }

  /** @internal */
  emitMoreClick(payload: MlvSchedulerMoreClickEvent<D, TData>): void {
    this.moreClick.emit(payload);
  }

  /** @internal */
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

  /** @internal */
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
        this.date.set(this.adapter.addCalendarDays(date, direction));
        break;
    }
    this._announceRange();
  }

  /** @private "Showing {period}". Read after the signal write so the title is fresh. */
  private _announceRange(): void {
    this.announce(this.translate('rangeChanged', { period: this.title() }));
  }
}
