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

/** Writable knobs of the fake context. */
export interface MlvSchedulerTestContextOptions {
  view?: MlvSchedulerView;
  date?: Date;
  events?: MlvSchedulerEvent[];
  editable?: boolean;
  selectable?: boolean;
  hiddenDays?: number[];
  minTime?: number;
  maxTime?: number;
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
  const snap = signal(options.snap ?? options.slotDuration ?? 30);
  const eventDef = signal<TemplateRef<MlvSchedulerEventContext> | null>(
    options.eventDef ?? null,
  );
  const range = computed(() => computeVisibleRange(adapter, view(), date(), 1));
  /**
   * The visible days. Seeded from the requested view/date (with the default
   * options: Mon 31 Aug – Sun 6 Sep 2026) but **writable**, so a spec can
   * shrink the range to a single day and exercise the cross-range navigation.
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
    rowLength: computed(() => 7 - new Set(hiddenDays()).size),
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
    eventDef,
    announcements,
    commits,
    state,
  };
}
