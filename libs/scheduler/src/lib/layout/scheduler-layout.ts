import type { MlvDateAdapter } from '@malva-ui/core/date';
import type {
  MlvSchedulerEvent,
  MlvSchedulerNextRange,
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
  /** Set on the drag preview copy rendered while a pointer drag is in progress. */
  readonly ghost?: boolean;
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

/**
 * The weekday indices in `hiddenDays` that can actually hide a rendered day:
 * `getDayOfWeek` only ever returns an integer `0`–`6`, so anything else is
 * dropped. A set covering **every** weekday is ignored rather than rendering an
 * empty grid — `visibleDays`, `rowLength`, `nextVisibleDate` and the month
 * keyboard handler share this repair so they can never disagree about how wide
 * a week row is or which columns exist.
 *
 * Internal: exported for the other layout / view modules only, never from
 * `src/index.ts`.
 */
export function hiddenWeekdays(
  hiddenDays: readonly number[],
): ReadonlySet<number> {
  const hidden = new Set(
    hiddenDays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
  );
  return hidden.size >= 7 ? new Set<number>() : hidden;
}

/**
 * Every day in `range`, in order, minus the hidden weekdays. A `hiddenDays`
 * covering all seven weekdays is ignored (see `hiddenWeekdays`).
 */
export function visibleDays<D>(
  adapter: MlvDateAdapter<D>,
  range: MlvSchedulerVisibleRange<D>,
  hiddenDays: readonly number[],
): readonly D[] {
  const hidden = hiddenWeekdays(hiddenDays);
  const days: D[] = [];
  let cursor = range.start;
  while (adapter.compareDate(cursor, range.end) < 0) {
    if (!hidden.has(adapter.getDayOfWeek(cursor))) {
      days.push(cursor);
    }
    cursor = adapter.addCalendarDays(cursor, 1);
  }
  return days;
}

/** Visible days per week row; never `0`, so a row loop always terminates. */
export function rowLength(hiddenDays: readonly number[]): number {
  return 7 - hiddenWeekdays(hiddenDays).size;
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

/**
 * All-day events and timed events covering a full day or more live in lanes,
 * not on the time axis.
 *
 * The span is measured on the **wall clock** (whole calendar days plus the
 * difference in minutes-of-day), not in elapsed minutes: a 00:00 → 24:00 event
 * on a spring-forward day elapses 1380 minutes but still covers the whole day,
 * and an autumn event elapses 1500 without covering two.
 */
export function isLaneEvent<D, TData>(
  adapter: MlvDateAdapter<D>,
  normalized: MlvSchedulerNormalizedEvent<D, TData>,
): boolean {
  if (normalized.allDay) return true;
  const days = Math.round(
    adapter.differenceInMinutes(
      adapter.startOfDay(normalized.end),
      adapter.startOfDay(normalized.start),
    ) / MINUTES_PER_DAY,
  );
  const span =
    days * MINUTES_PER_DAY +
    adapter.minutesOfDay(normalized.end) -
    adapter.minutesOfDay(normalized.start);
  return span >= MINUTES_PER_DAY;
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
 * Slices events into row segments over `days`, splitting at every `rowWidth`
 * boundary (`rowLength(hiddenDays)` days for a month grid, `days.length` for a
 * single row). `only: 'lane'` keeps all-day / ≥ 24 h events (the time grid's
 * all-day row); `'all'` keeps every event (the month grid).
 */
export function sliceRows<D, TData>(
  adapter: MlvDateAdapter<D>,
  events: readonly MlvSchedulerNormalizedEvent<D, TData>[],
  days: readonly D[],
  rowWidth: number,
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
      const rowEndsHere = index % rowWidth === rowWidth - 1;
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
    // The same "last day touched" the row slicer uses: an exclusive midnight
    // end does not reach the next day, and no segment is produced there.
    const lastDay = lastDayOf(adapter, normalized);
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
        continuesAfter:
          adapter.compareDate(lastDay, day) > 0 || segEnd > endMinutes,
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

/**
 * First-fit lane packing. Segments are ordered by first day, then by
 * **descending** span (the longest bar in a row takes the top lane), then
 * all-day before timed, then by start time, then by event id — so the result is
 * deterministic for any input order. The returned array is in that order, not
 * the input's; the input is left untouched.
 */
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
  /** Segments the row draws, in `assignLanes` order. Empty when no lane fits. */
  readonly visible: readonly MlvSchedulerLaneSegment<D, TData>[];
  /** Day index → hidden segments covering that day (rendering order). Only days with hidden events are present. */
  readonly hiddenByDay: ReadonlyMap<
    number,
    readonly MlvSchedulerLaneSegment<D, TData>[]
  >;
  /** Lanes the row would need without a budget — `0` for an empty row. */
  readonly laneCount: number;
}

/**
 * Applies a per-row lane budget. When the row needs more lanes than
 * `visibleLanes`, the last visible lane is given to the "+N more" button, so
 * lanes `>= visibleLanes − 1` are hidden everywhere in the row.
 *
 * Precondition: `segments` carries the `lane` numbers `assignLanes` produced
 * for **one** row — the budget is applied per row, and `hiddenByDay` is keyed
 * by day index within that row. A `visibleLanes` of `1` or less hides
 * everything, leaving the row to its "+N more" button alone.
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

/**
 * Sweep-line overlap clustering per day column. Touching segments do not overlap.
 *
 * Drag-preview ghosts (`normalized.ghost`) take no part in the packing and are
 * appended last with `column: 0, columns: 1` — full width, over their
 * siblings — so a preview never resizes the events it is dragged across, and
 * the event being dragged keeps the geometry it had before the drag started.
 */
export function clusterColumns<D, TData>(
  segments: readonly MlvSchedulerColumnSegment<D, TData>[],
): MlvSchedulerClusteredSegment<D, TData>[] {
  // The drag-preview ghost is an overlay, not a neighbour: while it still
  // overlaps the event it previews (any short move), packing it as a real
  // column would halve BOTH — the preview would lie about the drop width and
  // the faded source would jump sideways under the pointer. It is therefore
  // excluded from column assignment and emitted full width, above its
  // siblings. Lane views (month, all-day) already give the ghost its own lane.
  const ghosts = segments.filter((segment) => segment.normalized.ghost);
  const sorted = segments
    .filter((segment) => !segment.normalized.ghost)
    .sort(
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
  for (const segment of ghosts) out.push({ ...segment, column: 0, columns: 1 });
  return out;
}

/** Where a drag ended. */
export interface MlvSchedulerDropTarget {
  /** Index into the view's visible-days array; clamped into range by the resolvers. */
  readonly dayIndex: number;
  /**
   * Snapped minutes of day for a time-column target, `null` for a day cell (a
   * month cell or the all-day row), which keeps the event's own time of day.
   */
  readonly minutes: number | null;
  /** `true` / `false` convert the event's kind; `null` keeps the event's own kind. */
  readonly allDay: boolean | null;
}

/** Whole calendar days an all-day event covers. */
export function daySpan<D, TData>(
  adapter: MlvDateAdapter<D>,
  normalized: MlvSchedulerNormalizedEvent<D, TData>,
): number {
  return Math.max(
    1,
    Math.round(
      adapter.differenceInMinutes(
        adapter.startOfDay(normalized.end),
        adapter.startOfDay(normalized.start),
      ) / MINUTES_PER_DAY,
    ),
  );
}

function clampIndex(index: number, length: number): number {
  return Math.min(length - 1, Math.max(0, index));
}

/**
 * `minutes` of day applied to `day`. `MINUTES_PER_DAY` and beyond resolve to
 * the next day's midnight — legal for an **end**, which may sit at the close of
 * the window, but never for a start: `minutesFromOffset` clamps a start to one
 * snap below `maxMinutes` (`bound: 'start'`) so it cannot land here.
 */
function atMinutes<D>(adapter: MlvDateAdapter<D>, day: D, minutes: number): D {
  if (minutes >= MINUTES_PER_DAY) {
    return adapter.startOfDay(adapter.addCalendarDays(day, 1));
  }
  return adapter.withTime(day, Math.floor(minutes / 60), minutes % 60);
}

/** Resolves a drop: keeps duration, converts kind when the target says so, keeps time-of-day for day-cell targets. */
export function resolveMove<D, TData>(
  adapter: MlvDateAdapter<D>,
  normalized: MlvSchedulerNormalizedEvent<D, TData>,
  target: MlvSchedulerDropTarget,
  days: readonly D[],
  defaultEventDuration: number,
): MlvSchedulerNextRange<D> {
  const day = adapter.startOfDay(
    days[clampIndex(target.dayIndex, days.length)],
  );
  const allDay = target.allDay ?? normalized.allDay;
  if (allDay) {
    const span = normalized.allDay ? daySpan(adapter, normalized) : 1;
    return {
      start: day,
      end: adapter.addCalendarDays(day, span),
      allDay: true,
    };
  }
  if (normalized.allDay) {
    const start = atMinutes(adapter, day, target.minutes ?? 0);
    return {
      start,
      end: adapter.addMinutes(start, defaultEventDuration),
      allDay: false,
    };
  }
  const duration = adapter.differenceInMinutes(
    normalized.end,
    normalized.start,
  );
  const start =
    target.minutes === null
      ? adapter.withTime(
          day,
          adapter.getHours(normalized.start),
          adapter.getMinutes(normalized.start),
        )
      : atMinutes(adapter, day, target.minutes);
  return { start, end: adapter.addMinutes(start, duration), allDay: false };
}

/** Which edge of an event a resize gesture drags. */
export type MlvSchedulerResizeEdge = 'start' | 'end';

/**
 * Resolves a resize of one edge. Lane targets (`minutes === null`) resize by whole days; time targets by
 * minutes. The opposite edge never moves, and the result is clamped so the event keeps at least one snap
 * step (one day for an all-day bar).
 */
export function resolveResize<D, TData>(
  adapter: MlvDateAdapter<D>,
  normalized: MlvSchedulerNormalizedEvent<D, TData>,
  target: { readonly dayIndex: number; readonly minutes: number | null },
  days: readonly D[],
  snapDuration: number,
  edge: MlvSchedulerResizeEdge = 'end',
): MlvSchedulerNextRange<D> {
  const day = adapter.startOfDay(
    days[clampIndex(target.dayIndex, days.length)],
  );
  if (edge === 'start') {
    if (normalized.allDay) {
      let start = day;
      const maxStart = adapter.addCalendarDays(
        adapter.startOfDay(normalized.end),
        -1,
      );
      if (adapter.compareDate(start, maxStart) > 0) start = maxStart;
      return { start, end: normalized.end, allDay: true };
    }
    let start =
      target.minutes === null
        ? adapter.withTime(
            day,
            adapter.getHours(normalized.start),
            adapter.getMinutes(normalized.start),
          )
        : atMinutes(adapter, day, target.minutes);
    const maxStart = adapter.addMinutes(
      normalized.end,
      -Math.max(1, snapDuration),
    );
    if (adapter.compareDateTime(start, maxStart) > 0) start = maxStart;
    return { start, end: normalized.end, allDay: false };
  }
  if (normalized.allDay) {
    let end = adapter.addCalendarDays(day, 1);
    const minEnd = adapter.addCalendarDays(
      adapter.startOfDay(normalized.start),
      1,
    );
    if (adapter.compareDate(end, minEnd) < 0) end = minEnd;
    return { start: normalized.start, end, allDay: true };
  }
  let end: D;
  if (target.minutes === null) {
    const endMinutes = adapter.minutesOfDay(normalized.end);
    end =
      endMinutes === 0
        ? adapter.addCalendarDays(day, 1)
        : atMinutes(adapter, day, endMinutes);
  } else {
    end = atMinutes(adapter, day, target.minutes);
  }
  const minEnd = adapter.addMinutes(
    normalized.start,
    Math.max(1, snapDuration),
  );
  if (adapter.compareDateTime(end, minEnd) < 0) end = minEnd;
  return { start: normalized.start, end, allDay: false };
}
