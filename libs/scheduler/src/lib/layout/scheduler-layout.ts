import type { MlvDateAdapter } from '@malva-ui/core/date';
import type {
  MlvSchedulerEvent,
  MlvSchedulerView,
  MlvSchedulerVisibleRange,
} from '../scheduler/scheduler.types';
import { MINUTES_PER_DAY } from './scheduler-time';

/** An event with its dates repaired and all-day snapping applied. */
export interface MlvSchedulerNormalizedEvent<D = Date, TData = unknown> {
  readonly event: MlvSchedulerEvent<D, TData>;
  readonly start: D;
  /** Exclusive, strictly after `start`. */
  readonly end: D;
  readonly allDay: boolean;
}

/** A run of consecutive visible days inside one row (month week row or the all-day row). */
export interface MlvSchedulerRowSegment<D = Date, TData = unknown> {
  /** `${event.id}:r${startIndex}` — stable per rendered segment. */
  readonly key: string;
  readonly normalized: MlvSchedulerNormalizedEvent<D, TData>;
  /** Inclusive index into the visible-days array. */
  readonly startIndex: number;
  /** Inclusive. */
  readonly endIndex: number;
  /** The event started before this segment's first day. */
  readonly continuesBefore: boolean;
  /** The event ends after this segment's last day. */
  readonly continuesAfter: boolean;
}

/** One day's slice of a timed event, clipped to the visible hours. */
export interface MlvSchedulerColumnSegment<D = Date, TData = unknown> {
  /** `${event.id}:c${dayIndex}`. */
  readonly key: string;
  readonly normalized: MlvSchedulerNormalizedEvent<D, TData>;
  readonly dayIndex: number;
  /** Minutes of day, already clipped to `[minMinutes, maxMinutes]`. */
  readonly startMinutes: number;
  readonly endMinutes: number;
  readonly continuesBefore: boolean;
  readonly continuesAfter: boolean;
}

/** Start of the week containing `date` (`firstDayOfWeek`: 0 = Sunday). */
export function startOfWeek<D>(
  adapter: MlvDateAdapter<D>,
  date: D,
  firstDayOfWeek: number,
): D {
  const day = adapter.startOfDay(date);
  const offset = (adapter.getDayOfWeek(day) - firstDayOfWeek + 7) % 7;
  return adapter.addCalendarDays(day, -offset);
}

/** The rendered period for `view` anchored at `date`. */
export function computeVisibleRange<D>(
  adapter: MlvDateAdapter<D>,
  view: MlvSchedulerView,
  date: D,
  firstDayOfWeek: number,
): MlvSchedulerVisibleRange<D> {
  switch (view) {
    case 'month': {
      const first = adapter.createDate(
        adapter.getYear(date),
        adapter.getMonth(date),
        1,
      );
      const last = adapter.addCalendarDays(
        adapter.addCalendarMonths(first, 1),
        -1,
      );
      return {
        view,
        start: startOfWeek(adapter, first, firstDayOfWeek),
        end: adapter.addCalendarDays(
          startOfWeek(adapter, last, firstDayOfWeek),
          7,
        ),
      };
    }
    case 'week': {
      const start = startOfWeek(adapter, date, firstDayOfWeek);
      return { view, start, end: adapter.addCalendarDays(start, 7) };
    }
    case 'day': {
      const start = adapter.startOfDay(date);
      return { view, start, end: adapter.addCalendarDays(start, 1) };
    }
  }
}

/** Every day in `range`, in order, minus the hidden weekdays. */
export function visibleDays<D>(
  adapter: MlvDateAdapter<D>,
  range: MlvSchedulerVisibleRange<D>,
  hiddenDays: readonly number[],
): readonly D[] {
  const days: D[] = [];
  let cursor = range.start;
  while (adapter.compareDate(cursor, range.end) < 0) {
    if (!hiddenDays.includes(adapter.getDayOfWeek(cursor))) {
      days.push(cursor);
    }
    cursor = adapter.addCalendarDays(cursor, 1);
  }
  return days;
}

/** Visible days per week row. */
export function rowLength(hiddenDays: readonly number[]): number {
  const hidden = new Set(hiddenDays.filter((day) => day >= 0 && day <= 6));
  return 7 - hidden.size;
}

/** Index of the visible day containing `date`, or `-1`. */
export function dayIndexOf<D>(
  adapter: MlvDateAdapter<D>,
  days: readonly D[],
  date: D,
): number {
  return days.findIndex((day) => adapter.sameDate(day, date));
}

/** Repairs `end <= start` and snaps all-day events to day boundaries. */
export function normalizeEvent<D, TData>(
  adapter: MlvDateAdapter<D>,
  event: MlvSchedulerEvent<D, TData>,
  defaultEventDuration: number,
): MlvSchedulerNormalizedEvent<D, TData> {
  if (event.allDay) {
    const start = adapter.startOfDay(event.start);
    let end = adapter.startOfDay(event.end);
    if (adapter.compareDate(end, start) <= 0) {
      end = adapter.addCalendarDays(start, 1);
    }
    return { event, start, end, allDay: true };
  }
  const start = event.start;
  let end = event.end;
  if (adapter.compareDateTime(end, start) <= 0) {
    end = adapter.addMinutes(start, defaultEventDuration);
  }
  return { event, start, end, allDay: false };
}

/** All-day events and timed events lasting a full day or more live in lanes, not on the time axis. */
export function isLaneEvent<D, TData>(
  adapter: MlvDateAdapter<D>,
  normalized: MlvSchedulerNormalizedEvent<D, TData>,
): boolean {
  return (
    normalized.allDay ||
    adapter.differenceInMinutes(normalized.end, normalized.start) >=
      MINUTES_PER_DAY
  );
}

/** Last calendar day the event touches (an exclusive midnight end does not touch the next day). */
export function lastDayOf<D, TData>(
  adapter: MlvDateAdapter<D>,
  normalized: MlvSchedulerNormalizedEvent<D, TData>,
): D {
  return normalized.allDay
    ? adapter.addCalendarDays(normalized.end, -1)
    : adapter.startOfDay(adapter.addMinutes(normalized.end, -1));
}

/** Whether the event touches more than one calendar day. */
export function spansMultipleDays<D, TData>(
  adapter: MlvDateAdapter<D>,
  normalized: MlvSchedulerNormalizedEvent<D, TData>,
): boolean {
  return (
    adapter.compareDate(lastDayOf(adapter, normalized), normalized.start) > 0
  );
}

/**
 * Slices events into row segments over `days`, splitting at every `rowLength`
 * boundary. `only: 'lane'` keeps all-day / ≥ 24 h events (the time grid's
 * all-day row); `'all'` keeps every event (the month grid).
 */
export function sliceRows<D, TData>(
  adapter: MlvDateAdapter<D>,
  events: readonly MlvSchedulerNormalizedEvent<D, TData>[],
  days: readonly D[],
  rowLength: number,
  only: 'all' | 'lane',
): MlvSchedulerRowSegment<D, TData>[] {
  const segments: MlvSchedulerRowSegment<D, TData>[] = [];
  for (const normalized of events) {
    if (only === 'lane' && !isLaneEvent(adapter, normalized)) continue;
    const firstDay = adapter.startOfDay(normalized.start);
    const lastDay = lastDayOf(adapter, normalized);
    let runStart = -1;
    const flush = (runEnd: number): void => {
      if (runStart < 0) return;
      segments.push({
        key: `${normalized.event.id}:r${runStart}`,
        normalized,
        startIndex: runStart,
        endIndex: runEnd,
        continuesBefore: adapter.compareDate(firstDay, days[runStart]) < 0,
        continuesAfter: adapter.compareDate(lastDay, days[runEnd]) > 0,
      });
      runStart = -1;
    };
    for (let index = 0; index < days.length; index++) {
      const day = days[index];
      const covered =
        adapter.compareDate(day, firstDay) >= 0 &&
        adapter.compareDate(day, lastDay) <= 0;
      if (!covered) {
        flush(index - 1);
        continue;
      }
      if (runStart < 0) runStart = index;
      const rowEndsHere = index % rowLength === rowLength - 1;
      if (rowEndsHere) flush(index);
    }
    flush(days.length - 1);
  }
  return segments;
}

/** Slices timed (non-lane) events into per-day column segments clipped to `[minMinutes, maxMinutes]`. */
export function sliceColumns<D, TData>(
  adapter: MlvDateAdapter<D>,
  events: readonly MlvSchedulerNormalizedEvent<D, TData>[],
  days: readonly D[],
  minMinutes: number,
  maxMinutes: number,
): MlvSchedulerColumnSegment<D, TData>[] {
  const segments: MlvSchedulerColumnSegment<D, TData>[] = [];
  for (const normalized of events) {
    if (isLaneEvent(adapter, normalized)) continue;
    for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
      const day = days[dayIndex];
      const byStart = adapter.compareDate(normalized.start, day);
      const byEnd = adapter.compareDate(normalized.end, day);
      if (byStart > 0 || byEnd < 0) continue;
      const segStart =
        byStart === 0 ? adapter.minutesOfDay(normalized.start) : 0;
      const segEnd =
        byEnd === 0 ? adapter.minutesOfDay(normalized.end) : MINUTES_PER_DAY;
      if (segEnd <= segStart) continue;
      const startMinutes = Math.max(segStart, minMinutes);
      const endMinutes = Math.min(segEnd, maxMinutes);
      if (endMinutes <= startMinutes) continue;
      segments.push({
        key: `${normalized.event.id}:c${dayIndex}`,
        normalized,
        dayIndex,
        startMinutes,
        endMinutes,
        continuesBefore: byStart < 0 || segStart < startMinutes,
        continuesAfter: byEnd > 0 || segEnd > endMinutes,
      });
    }
  }
  return segments;
}
