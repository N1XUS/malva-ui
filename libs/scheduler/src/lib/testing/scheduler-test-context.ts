import { computed, signal, type Signal, type TemplateRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MlvNativeDateAdapter, type MlvDateAdapter } from '@malva-ui/core/date';
import {
  MLV_SCHEDULER_I18N,
  MlvI18nResolverService,
  type MlvSchedulerI18n,
} from '@malva-ui/i18n';
import { vi } from 'vitest';
import {
  computeVisibleRange,
  hiddenWeekdays,
  normalizeEvent,
  visibleDays,
  type MlvSchedulerNormalizedEvent,
} from '../layout/scheduler-layout';
import type {
  MlvSchedulerContext,
  MlvSchedulerFocusRequest,
  MlvSchedulerScrollRequest,
} from '../scheduler/scheduler-context';
import type {
  MlvSchedulerChangeSource,
  MlvSchedulerEvent,
  MlvSchedulerEventContext,
  MlvSchedulerNextRange,
  MlvSchedulerView,
} from '../scheduler/scheduler.types';

/**
 * Writable knobs of the fake context.
 *
 * `view`, `date` and `hiddenDays` **seed** the context but do not drive it the
 * way the real `MlvScheduler` does: `days` is a plain writable signal computed
 * once from them (see there), so writing `view`, `date` or `hiddenDays` later
 * changes `range` / `rowLength` but leaves `days` exactly as seeded. Write
 * `days` directly to change the rendered columns mid-spec.
 */
export interface MlvSchedulerTestContextOptions {
  /** Seeds `view` and, through it, the initial `range` and `days`. */
  view?: MlvSchedulerView;
  /** Seeds `date` and, through it, the initial `range` and `days`. */
  date?: Date;
  /** Seeds the `events` signal the fake `normalizedEvents` derives from. */
  events?: MlvSchedulerEvent[];
  /** Seeds `editable`. */
  editable?: boolean;
  /** Seeds `selectable`. */
  selectable?: boolean;
  /** Seeds `hiddenDays`, `rowLength` and the initial `days`. */
  hiddenDays?: number[];
  /** `minMinutes` — minutes of day, not `'HH:mm'`. */
  minTime?: number;
  /** `maxMinutes` — minutes of day, not `'HH:mm'`. */
  maxTime?: number;
  /** Seeds `slotDuration` (and `snap`, unless `snap` is given). */
  slotDuration?: number;
  /**
   * Drag / resize / keyboard granularity. Defaults to `30` — the real
   * `MlvScheduler` resolves `snapDuration ?? slotDuration`, and `slotDuration`
   * defaults to `30`. Pass `15` (or any divisor of 60) only in a spec that
   * deliberately exercises a finer grid.
   */
  snap?: number;
  eventDef?: TemplateRef<MlvSchedulerEventContext> | null;
}

/**
 * A hand-built `MlvSchedulerContext` for unit specs of internal parts. Emits
 * are `vi.fn()` spies; `commitChange` records calls and returns `commitResult`.
 * Call inside a `TestBed` with `provideMlvI18nTesting()`.
 */
export function createSchedulerTestContext(
  options: MlvSchedulerTestContextOptions = {},
) {
  const adapter = TestBed.inject(
    MlvNativeDateAdapter,
  ) as unknown as MlvDateAdapter<Date>;
  const i18n = TestBed.inject(MLV_SCHEDULER_I18N) as Signal<MlvSchedulerI18n>;
  const resolver = TestBed.inject(MlvI18nResolverService);
  const view = signal<MlvSchedulerView>(options.view ?? 'week');
  const date = signal(options.date ?? new Date(2026, 8, 2));
  const events = signal<MlvSchedulerEvent[]>(options.events ?? []);
  const editable = signal(options.editable ?? true);
  const selectable = signal(options.selectable ?? true);
  const hiddenDays = signal(options.hiddenDays ?? []);
  const minMinutes = signal(options.minTime ?? 0);
  const maxMinutes = signal(options.maxTime ?? 1440);
  const slotDuration = signal(options.slotDuration ?? 30);
  /** Writable so a spec can toggle the time grid's centred initial scroll on. */
  const scrollToCurrentTime = signal(false);
  const snap = signal(options.snap ?? options.slotDuration ?? 30);
  /** Seeds the `*mlvSchedulerEventDef` template a chip renders instead of its default body. */
  const eventDef = signal<TemplateRef<MlvSchedulerEventContext> | null>(
    options.eventDef ?? null,
  );
  const range = computed(() => computeVisibleRange(adapter, view(), date(), 1));
  /**
   * The visible days. Seeded once from the requested view / date / hiddenDays
   * (with the default options: Mon 31 Aug – Sun 6 Sep 2026) but **writable**
   * and NOT derived: a later write to `view`, `date` or `hiddenDays` does not
   * reach it, so a spec can shrink the range to a single day and exercise the
   * cross-range navigation without the seed fighting back.
   */
  const days = signal<readonly Date[]>(
    visibleDays(adapter, range(), hiddenDays()),
  );
  const announcements: string[] = [];
  const commits: {
    kind: 'move' | 'resize';
    id: string;
    next: MlvSchedulerNextRange<Date>;
    source: MlvSchedulerChangeSource;
  }[] = [];
  const state = { commitResult: true, suppressedAt: 0 };
  const context: MlvSchedulerContext<Date> = {
    adapter,
    i18n,
    view,
    date,
    range,
    days,
    // Through `hiddenWeekdays()`, so the fake context repairs `hiddenDays`
    // exactly as the real root does: out-of-range entries are dropped and an
    // all-seven set hides nothing (`rowLength` stays 7).
    rowLength: computed(() => 7 - hiddenWeekdays(hiddenDays()).size),
    hiddenDays,
    today: computed(() => adapter.today()),
    nowMinutes: computed(() => 10 * 60),
    normalizedEvents: computed(() =>
      events().map((e) => normalizeEvent(adapter, e, 60)),
    ),
    minMinutes,
    maxMinutes,
    slotDuration,
    snap,
    defaultEventDuration: computed(() => 60),
    businessHours: computed(() => null),
    editable,
    selectable,
    showCurrentTime: computed(() => true),
    scrollToCurrentTime,
    dragGroup: computed(() => 'mlv-scheduler'),
    eventDef,
    dragHintId: 'mlv-scheduler-hint-test',
    pendingFocus: signal<MlvSchedulerFocusRequest<Date> | null>(null),
    scrollRequest: signal<MlvSchedulerScrollRequest | null>(null),
    dragging: signal(false),
    translate: (key, params) =>
      resolver.resolve(
        i18n() as unknown as Record<string, string>,
        key,
        params,
      ),
    formatTime: (d) =>
      adapter.format(d, { hour: 'numeric', minute: '2-digit' }),
    formatDateTime: (d) =>
      adapter.format(d, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
    goTo: vi.fn((d: Date) => date.set(d)),
    next: vi.fn(),
    previous: vi.fn(),
    announce: (message) => announcements.push(message),
    emitEventInteraction: vi.fn(),
    emitSlotInteraction: vi.fn(),
    emitRangeSelect: vi.fn(),
    emitMoreClick: vi.fn(),
    emitExternalDrop: vi.fn(),
    commitChange: vi.fn(
      (
        kind: 'move' | 'resize',
        normalized: MlvSchedulerNormalizedEvent<Date>,
        next: MlvSchedulerNextRange<Date>,
        source: MlvSchedulerChangeSource,
      ): boolean => {
        commits.push({ kind, id: normalized.event.id, next, source });
        if (state.commitResult) {
          events.update((list) =>
            list.map((e) =>
              e.id === normalized.event.id
                ? {
                    ...e,
                    start: next.start,
                    end: next.end,
                    allDay: next.allDay,
                  }
                : e,
            ),
          );
        }
        return state.commitResult;
      },
    ),
    suppressNextClick: () => (state.suppressedAt = performance.now()),
    claimSuppressedClick: () => {
      const s =
        state.suppressedAt !== 0 &&
        performance.now() - state.suppressedAt < 300;
      state.suppressedAt = 0;
      return s;
    },
    setDragging: vi.fn(),
  };
  return {
    context,
    events,
    editable,
    selectable,
    view,
    date,
    hiddenDays,
    days,
    snap,
    minMinutes,
    maxMinutes,
    scrollToCurrentTime,
    eventDef,
    announcements,
    commits,
    state,
  };
}
