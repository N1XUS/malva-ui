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

/** A row segment with its lane assigned. */
export interface MlvSchedulerLaneSegment<D = Date, TData = unknown>
  extends MlvSchedulerRowSegment<D, TData> {
  readonly lane: number;
}

function laneSortKey<D, TData>(
  adapter: MlvDateAdapter<D>,
  a: MlvSchedulerRowSegment<D, TData>,
  b: MlvSchedulerRowSegment<D, TData>,
): number {
  if (a.startIndex !== b.startIndex) return a.startIndex - b.startIndex;
  const spanA = a.endIndex - a.startIndex;
  const spanB = b.endIndex - b.startIndex;
  if (spanA !== spanB) return spanB - spanA;
  if (a.normalized.allDay !== b.normalized.allDay)
    return a.normalized.allDay ? -1 : 1;
  const byStart = adapter.compareDateTime(
    a.normalized.start,
    b.normalized.start,
  );
  if (byStart !== 0) return byStart;
  return a.normalized.event.id < b.normalized.event.id
    ? -1
    : a.normalized.event.id > b.normalized.event.id
      ? 1
      : 0;
}

/** First-fit lane packing: longest spans first, then all-day, then start time, then id. Stable. */
export function assignLanes<D, TData>(
  adapter: MlvDateAdapter<D>,
  segments: readonly MlvSchedulerRowSegment<D, TData>[],
): MlvSchedulerLaneSegment<D, TData>[] {
  const sorted = [...segments].sort((a, b) => laneSortKey(adapter, a, b));
  const lanes: Array<Array<readonly [number, number]>> = [];
  return sorted.map((segment) => {
    let lane = lanes.findIndex((intervals) =>
      intervals.every(
        ([start, end]) => segment.endIndex < start || segment.startIndex > end,
      ),
    );
    if (lane < 0) {
      lane = lanes.length;
      lanes.push([]);
    }
    lanes[lane].push([segment.startIndex, segment.endIndex]);
    return { ...segment, lane };
  });
}

/** What a row renders once lanes past `visibleLanes` collapse into "+N more". */
export interface MlvSchedulerRowLayout<D = Date, TData = unknown> {
  readonly visible: readonly MlvSchedulerLaneSegment<D, TData>[];
  /** Day index → hidden segments covering that day (rendering order). Only days with hidden events are present. */
  readonly hiddenByDay: ReadonlyMap<
    number,
    readonly MlvSchedulerLaneSegment<D, TData>[]
  >;
  readonly laneCount: number;
}

/**
 * Applies a per-row lane budget. When the row needs more lanes than
 * `visibleLanes`, the last visible lane is given to the "+N more" button, so
 * lanes `>= visibleLanes − 1` are hidden everywhere in the row.
 */
export function layoutRow<D, TData>(
  segments: readonly MlvSchedulerLaneSegment<D, TData>[],
  visibleLanes: number,
): MlvSchedulerRowLayout<D, TData> {
  const laneCount = segments.reduce(
    (max, segment) => Math.max(max, segment.lane + 1),
    0,
  );
  if (laneCount <= visibleLanes) {
    return { visible: segments, hiddenByDay: new Map(), laneCount };
  }
  const threshold = Math.max(0, visibleLanes - 1);
  const visible: MlvSchedulerLaneSegment<D, TData>[] = [];
  const hiddenByDay = new Map<number, MlvSchedulerLaneSegment<D, TData>[]>();
  for (const segment of segments) {
    if (segment.lane < threshold) {
      visible.push(segment);
      continue;
    }
    for (let day = segment.startIndex; day <= segment.endIndex; day++) {
      const list = hiddenByDay.get(day) ?? [];
      list.push(segment);
      hiddenByDay.set(day, list);
    }
  }
  return { visible, hiddenByDay, laneCount };
}

/** A column segment with its side-by-side placement. */
export interface MlvSchedulerClusteredSegment<D = Date, TData = unknown>
  extends MlvSchedulerColumnSegment<D, TData> {
  /** Zero-based column inside the overlap cluster. */
  readonly column: number;
  /** Column count of the cluster (width = 100% / columns). */
  readonly columns: number;
}

/** Sweep-line overlap clustering per day column. Touching segments do not overlap. */
export function clusterColumns<D, TData>(
  segments: readonly MlvSchedulerColumnSegment<D, TData>[],
): MlvSchedulerClusteredSegment<D, TData>[] {
  const sorted = [...segments].sort(
    (a, b) =>
      a.dayIndex - b.dayIndex ||
      a.startMinutes - b.startMinutes ||
      b.endMinutes - a.endMinutes ||
      (a.normalized.event.id < b.normalized.event.id
        ? -1
        : a.normalized.event.id > b.normalized.event.id
          ? 1
          : 0),
  );
  const out: MlvSchedulerClusteredSegment<D, TData>[] = [];
  let cluster: Array<{
    segment: MlvSchedulerColumnSegment<D, TData>;
    column: number;
  }> = [];
  let columnEnds: number[] = [];
  let clusterDay = -1;
  let clusterEnd = -Infinity;
  const flush = (): void => {
    const columns = columnEnds.length;
    for (const { segment, column } of cluster)
      out.push({ ...segment, column, columns });
    cluster = [];
    columnEnds = [];
    clusterEnd = -Infinity;
  };
  for (const segment of sorted) {
    if (
      cluster.length &&
      (segment.dayIndex !== clusterDay || segment.startMinutes >= clusterEnd)
    ) {
      flush();
    }
    clusterDay = segment.dayIndex;
    let column = columnEnds.findIndex((end) => end <= segment.startMinutes);
    if (column < 0) {
      column = columnEnds.length;
      columnEnds.push(segment.endMinutes);
    } else {
      columnEnds[column] = segment.endMinutes;
    }
    cluster.push({ segment, column });
    clusterEnd = Math.max(clusterEnd, segment.endMinutes);
  }
  flush();
  return out;
}
