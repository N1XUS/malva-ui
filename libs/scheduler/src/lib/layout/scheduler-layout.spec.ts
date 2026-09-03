import { TestBed } from '@angular/core/testing';
import { MlvNativeDateAdapter } from '@malva-ui/core/date';
import type { MlvSchedulerEvent } from '../scheduler/scheduler.types';
import {
  assignLanes,
  clusterColumns,
  computeVisibleRange,
  dayIndexOf,
  isLaneEvent,
  layoutRow,
  normalizeEvent,
  resolveMove,
  resolveResize,
  rowLength,
  sliceColumns,
  sliceRows,
  spansMultipleDays,
  startOfWeek,
  visibleDays,
} from './scheduler-layout';

const d = (day: number, h = 0, m = 0, month = 8) =>
  new Date(2026, month, day, h, m);
const ev = (
  id: string,
  start: Date,
  end: Date,
  extra: Partial<MlvSchedulerEvent> = {},
): MlvSchedulerEvent => ({
  id,
  title: id,
  start,
  end,
  ...extra,
});

describe('scheduler-layout: range and days', () => {
  let adapter: MlvNativeDateAdapter;
  beforeEach(() => {
    TestBed.configureTestingModule({});
    adapter = TestBed.inject(MlvNativeDateAdapter);
  });

  it('finds the start of the week for Monday- and Sunday-first weeks', () => {
    expect(startOfWeek(adapter, d(2), 1)).toEqual(new Date(2026, 7, 31)); // Wed 2 Sep → Mon 31 Aug
    expect(startOfWeek(adapter, d(2), 0)).toEqual(new Date(2026, 7, 30));
    expect(startOfWeek(adapter, new Date(2026, 7, 31), 1)).toEqual(
      new Date(2026, 7, 31),
    );
  });

  it('computes month / week / day ranges', () => {
    const month = computeVisibleRange(adapter, 'month', d(15), 1);
    expect(month.start).toEqual(new Date(2026, 7, 31)); // Sep 2026 starts on a Tuesday
    expect(month.end).toEqual(new Date(2026, 9, 5)); // Sep 30 is a Wednesday → week ends Sun Oct 4, exclusive Mon Oct 5
    const week = computeVisibleRange(adapter, 'week', d(2, 13), 1);
    expect(week.start).toEqual(new Date(2026, 7, 31));
    expect(week.end).toEqual(d(7));
    const day = computeVisibleRange(adapter, 'day', d(2, 13), 1);
    expect(day.start).toEqual(d(2));
    expect(day.end).toEqual(d(3));
    expect(day.view).toBe('day');
  });

  it('lists visible days, skipping hidden weekdays', () => {
    const week = computeVisibleRange(adapter, 'week', d(2), 1);
    expect(visibleDays(adapter, week, []).length).toBe(7);
    const working = visibleDays(adapter, week, [0, 6]);
    expect(working.length).toBe(5);
    expect(working[0]).toEqual(new Date(2026, 7, 31));
    expect(working[4]).toEqual(d(4));
    expect(rowLength([0, 6])).toBe(5);
    expect(rowLength([])).toBe(7);
    expect(rowLength([0, 0, 9])).toBe(6);
    expect(dayIndexOf(adapter, working, d(2, 15))).toBe(2);
    expect(dayIndexOf(adapter, working, d(5))).toBe(-1);
  });
});

describe('scheduler-layout: normalization', () => {
  let adapter: MlvNativeDateAdapter;
  beforeEach(() => {
    TestBed.configureTestingModule({});
    adapter = TestBed.inject(MlvNativeDateAdapter);
  });

  it('repairs end <= start', () => {
    const timed = normalizeEvent(adapter, ev('a', d(2, 9), d(2, 9)), 60);
    expect(timed.end).toEqual(d(2, 10));
    const allDay = normalizeEvent(
      adapter,
      ev('b', d(2, 9), d(1), { allDay: true }),
      60,
    );
    expect(allDay.start).toEqual(d(2));
    expect(allDay.end).toEqual(d(3));
    expect(allDay.allDay).toBe(true);
  });

  it('classifies lane events and multi-day events', () => {
    expect(
      isLaneEvent(
        adapter,
        normalizeEvent(adapter, ev('a', d(2, 9), d(2, 10)), 60),
      ),
    ).toBe(false);
    expect(
      isLaneEvent(
        adapter,
        normalizeEvent(adapter, ev('b', d(2, 9), d(3, 9)), 60),
      ),
    ).toBe(true); // 24h timed
    expect(
      isLaneEvent(
        adapter,
        normalizeEvent(adapter, ev('c', d(2), d(3), { allDay: true }), 60),
      ),
    ).toBe(true);
    expect(
      spansMultipleDays(
        adapter,
        normalizeEvent(adapter, ev('d', d(2, 22), d(3, 2)), 60),
      ),
    ).toBe(true);
    expect(
      spansMultipleDays(
        adapter,
        normalizeEvent(adapter, ev('e', d(2, 22), d(3, 0)), 60),
      ),
    ).toBe(false); // ends at midnight
    expect(
      spansMultipleDays(
        adapter,
        normalizeEvent(adapter, ev('f', d(2), d(3), { allDay: true }), 60),
      ),
    ).toBe(false);
  });
});

describe('scheduler-layout: slicing', () => {
  let adapter: MlvNativeDateAdapter;
  let week: readonly Date[];
  beforeEach(() => {
    TestBed.configureTestingModule({});
    adapter = TestBed.inject(MlvNativeDateAdapter);
    week = visibleDays(
      adapter,
      computeVisibleRange(adapter, 'week', d(2), 1),
      [],
    ); // Mon 31 Aug … Sun 6 Sep
  });

  it('slices all-day and multi-day events into row segments with continuation flags', () => {
    const events = [
      normalizeEvent(adapter, ev('a', d(1), d(4), { allDay: true }), 60), // Tue–Thu
      normalizeEvent(
        adapter,
        ev('b', new Date(2026, 7, 29), d(2), { allDay: true }),
        60,
      ), // Sat 29 Aug – Tue 1 Sep
      normalizeEvent(adapter, ev('c', d(5, 23), d(7, 1)), 60), // timed Sat 23:00 → Mon 01:00 (lane event, 26h)
      normalizeEvent(adapter, ev('d', d(2, 9), d(2, 10)), 60), // timed single-day
    ];
    const rows = sliceRows(adapter, events, week, 7, 'all');
    const byId = Object.fromEntries(
      rows.map((s) => [s.normalized.event.id, s]),
    );
    expect(byId['a']).toMatchObject({
      startIndex: 1,
      endIndex: 3,
      continuesBefore: false,
      continuesAfter: false,
    });
    expect(byId['b']).toMatchObject({
      startIndex: 0,
      endIndex: 1,
      continuesBefore: true,
      continuesAfter: false,
    });
    expect(byId['c']).toMatchObject({
      startIndex: 5,
      endIndex: 6,
      continuesBefore: false,
      continuesAfter: true,
    });
    expect(byId['d']).toMatchObject({ startIndex: 2, endIndex: 2 });
    expect(
      sliceRows(adapter, events, week, 7, 'lane').map(
        (s) => s.normalized.event.id,
      ),
    ).toEqual(['a', 'b', 'c']);
  });

  it('splits row segments at row boundaries for a month grid', () => {
    const month = visibleDays(
      adapter,
      computeVisibleRange(adapter, 'month', d(15), 1),
      [],
    );
    const events = [
      normalizeEvent(adapter, ev('a', d(5), d(9), { allDay: true }), 60),
    ]; // Sat 5 → Tue 8 inclusive
    const rows = sliceRows(adapter, events, month, 7, 'all');
    expect(rows.length).toBe(2);
    expect(rows[0]).toMatchObject({
      startIndex: 5,
      endIndex: 6,
      continuesBefore: false,
      continuesAfter: true,
    });
    expect(rows[1]).toMatchObject({
      startIndex: 7,
      endIndex: 8,
      continuesBefore: true,
      continuesAfter: false,
    });
    expect(rows[0].key).not.toBe(rows[1].key);
  });

  it('collapses hidden weekdays inside a segment', () => {
    const working = visibleDays(
      adapter,
      computeVisibleRange(adapter, 'week', d(2), 1),
      [0, 6],
    );
    const events = [
      normalizeEvent(adapter, ev('a', d(4), d(8), { allDay: true }), 60),
    ]; // Fri 4 → Mon 7 (Sat/Sun hidden)
    const rows = sliceRows(adapter, events, working, 5, 'all');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      startIndex: 4,
      endIndex: 4,
      continuesAfter: true,
    });
  });

  it('slices timed events into per-day column segments, clipped to the visible hours', () => {
    const events = [
      normalizeEvent(adapter, ev('a', d(2, 9), d(2, 10, 30)), 60),
      normalizeEvent(adapter, ev('b', d(2, 22), d(3, 2)), 60), // crosses midnight
      normalizeEvent(adapter, ev('c', d(2, 6), d(2, 9)), 60), // starts before 08:00
      normalizeEvent(adapter, ev('d', d(2, 5), d(2, 7)), 60), // fully outside 08:00–18:00
      normalizeEvent(adapter, ev('e', d(2), d(4), { allDay: true }), 60), // lane event: skipped
      normalizeEvent(adapter, ev('f', d(1, 23), d(2, 0)), 60), // ends exactly at midnight: no Wednesday segment
    ];
    const cols = sliceColumns(adapter, events, week, 8 * 60, 18 * 60);
    const of = (id: string) => cols.filter((s) => s.normalized.event.id === id);
    expect(of('a')).toEqual([
      expect.objectContaining({
        dayIndex: 2,
        startMinutes: 540,
        endMinutes: 630,
        continuesBefore: false,
        continuesAfter: false,
      }),
    ]);
    expect(of('b')).toEqual([]); // 22:00–02:00 lies outside 08:00–18:00 on both days
    expect(of('c')).toEqual([
      expect.objectContaining({
        dayIndex: 2,
        startMinutes: 480,
        endMinutes: 540,
        continuesBefore: true,
      }),
    ]);
    expect(of('d')).toEqual([]);
    expect(of('e')).toEqual([]);
    expect(of('f')).toEqual([]);
    expect(
      cols.every((s) => s.key === `${s.normalized.event.id}:c${s.dayIndex}`),
    ).toBe(true);
  });

  it('gives a cross-midnight event a clipped segment on each day', () => {
    const events = [normalizeEvent(adapter, ev('b', d(2, 22), d(3, 2)), 60)];
    const cols = sliceColumns(adapter, events, week, 0, 1440);
    expect(
      cols.map((s) => [
        s.dayIndex,
        s.startMinutes,
        s.endMinutes,
        s.continuesBefore,
        s.continuesAfter,
      ]),
    ).toEqual([
      [2, 1320, 1440, false, true],
      [3, 0, 120, true, false],
    ]);
    const clipped = sliceColumns(adapter, events, week, 8 * 60, 18 * 60);
    expect(clipped).toEqual([]); // 22:00–02:00 lies entirely outside 08:00–18:00 on both days
  });
});

describe('scheduler-layout: lanes and overflow', () => {
  let adapter: MlvNativeDateAdapter;
  let week: readonly Date[];
  beforeEach(() => {
    TestBed.configureTestingModule({});
    adapter = TestBed.inject(MlvNativeDateAdapter);
    week = visibleDays(
      adapter,
      computeVisibleRange(adapter, 'week', d(2), 1),
      [],
    );
  });

  const rows = (...events: MlvSchedulerEvent[]) =>
    sliceRows(
      adapter,
      events.map((e) => normalizeEvent(adapter, e, 60)),
      week,
      7,
      'all',
    );

  it('puts the longest all-day span first and packs first-fit', () => {
    const lanes = assignLanes(
      adapter,
      rows(
        ev('short', d(1, 9), d(1, 10)),
        ev('long', d(1), d(4), { allDay: true }),
        ev('mid', d(2), d(4), { allDay: true }),
        ev('later', d(4, 9), d(4, 10)),
      ),
    );
    const laneOf = (id: string) =>
      lanes.find((s) => s.normalized.event.id === id)?.lane;
    // Sort: long (Tue, span 2) → short (Tue, span 0) → mid (Wed, span 1) → later (Fri).
    expect(laneOf('long')).toBe(0); // [1,3]
    expect(laneOf('short')).toBe(1); // [1,1] collides with lane 0
    expect(laneOf('mid')).toBe(1); // [2,3] does not collide with [1,1]
    expect(laneOf('later')).toBe(0); // [4,4] is free in lane 0
  });

  it('is deterministic for equal spans: earlier start time, then id', () => {
    const lanes = assignLanes(
      adapter,
      rows(
        ev('b', d(1, 10), d(1, 11)),
        ev('a', d(1, 10), d(1, 11)),
        ev('c', d(1, 9), d(1, 11)),
      ),
    );
    expect(lanes.map((s) => [s.normalized.event.id, s.lane])).toEqual([
      ['c', 0],
      ['a', 1],
      ['b', 2],
    ]);
  });

  it('hides lanes beyond the visible count and counts hidden events per day', () => {
    const lanes = assignLanes(
      adapter,
      rows(
        ev('span', d(1), d(4), { allDay: true }), // Tue–Thu lane 0
        ev('t1', d(2, 9), d(2, 10)), // Wed lane 1
        ev('t2', d(2, 11), d(2, 12)), // Wed lane 2
        ev('t3', d(2, 13), d(2, 14)), // Wed lane 3
        ev('f1', d(4, 9), d(4, 10)), // Fri lane 0
      ),
    );
    const layout = layoutRow(lanes, 3);
    expect(layout.laneCount).toBe(4);
    expect(layout.visible.map((s) => s.normalized.event.id).sort()).toEqual([
      'f1',
      'span',
      't1',
    ]);
    expect(
      layout.hiddenByDay.get(2)?.map((s) => s.normalized.event.id),
    ).toEqual(['t2', 't3']);
    expect(layout.hiddenByDay.has(4)).toBe(false);
    const fits = layoutRow(lanes, 4);
    expect(fits.visible.length).toBe(5);
    expect(fits.hiddenByDay.size).toBe(0);
    const none = layoutRow(lanes, 1);
    expect(none.visible).toEqual([]);
    expect(none.hiddenByDay.get(1)?.length).toBe(1);
  });
});

describe('scheduler-layout: clusters', () => {
  let adapter: MlvNativeDateAdapter;
  let week: readonly Date[];
  beforeEach(() => {
    TestBed.configureTestingModule({});
    adapter = TestBed.inject(MlvNativeDateAdapter);
    week = visibleDays(
      adapter,
      computeVisibleRange(adapter, 'week', d(2), 1),
      [],
    );
  });

  const cols = (...events: MlvSchedulerEvent[]) =>
    sliceColumns(
      adapter,
      events.map((e) => normalizeEvent(adapter, e, 60)),
      week,
      0,
      1440,
    );

  it('lays overlapping events side by side and keeps separate clusters full width', () => {
    const laid = clusterColumns(
      cols(
        ev('a', d(2, 9), d(2, 11)),
        ev('b', d(2, 10), d(2, 12)),
        ev('c', d(2, 10, 30), d(2, 11)),
        ev('d', d(2, 14), d(2, 15)),
        ev('e', d(3, 9), d(3, 10)),
      ),
    );
    const of = (id: string) => laid.find((s) => s.normalized.event.id === id)!;
    expect([of('a').column, of('a').columns]).toEqual([0, 3]);
    expect([of('b').column, of('b').columns]).toEqual([1, 3]);
    expect([of('c').column, of('c').columns]).toEqual([2, 3]);
    expect([of('d').column, of('d').columns]).toEqual([0, 1]);
    expect([of('e').column, of('e').columns]).toEqual([0, 1]);
  });

  it('treats touching events as non-overlapping and reuses freed columns', () => {
    const laid = clusterColumns(
      cols(
        ev('a', d(2, 9), d(2, 10)),
        ev('b', d(2, 10), d(2, 11)),
        ev('c', d(2, 9, 30), d(2, 12)),
      ),
    );
    const of = (id: string) => laid.find((s) => s.normalized.event.id === id)!;
    expect([of('a').column, of('b').column, of('c').column]).toEqual([0, 0, 1]);
    expect(laid.every((s) => s.columns === 2)).toBe(true);
  });
});

describe('scheduler-layout: move and resize resolution', () => {
  let adapter: MlvNativeDateAdapter;
  let week: readonly Date[];
  beforeEach(() => {
    TestBed.configureTestingModule({});
    adapter = TestBed.inject(MlvNativeDateAdapter);
    week = visibleDays(
      adapter,
      computeVisibleRange(adapter, 'week', d(2), 1),
      [],
    );
  });
  const n = (e: MlvSchedulerEvent) => normalizeEvent(adapter, e, 60);

  it('moves a timed event to another day keeping time and duration', () => {
    const next = resolveMove(
      adapter,
      n(ev('a', d(2, 9), d(2, 10, 30))),
      { dayIndex: 4, minutes: null, allDay: null },
      week,
      60,
    );
    expect(next).toEqual({ start: d(4, 9), end: d(4, 10, 30), allDay: false });
  });

  it('moves a timed event to a slot keeping duration', () => {
    const next = resolveMove(
      adapter,
      n(ev('a', d(2, 9), d(2, 10, 30))),
      { dayIndex: 2, minutes: 14 * 60 + 15, allDay: false },
      week,
      60,
    );
    expect(next).toEqual({
      start: d(2, 14, 15),
      end: d(2, 15, 45),
      allDay: false,
    });
  });

  it('converts between all-day and timed', () => {
    const toAllDay = resolveMove(
      adapter,
      n(ev('a', d(2, 9), d(2, 10))),
      { dayIndex: 3, minutes: null, allDay: true },
      week,
      60,
    );
    expect(toAllDay).toEqual({ start: d(3), end: d(4), allDay: true });
    const toTimed = resolveMove(
      adapter,
      n(ev('b', d(2), d(4), { allDay: true })),
      { dayIndex: 1, minutes: 600, allDay: false },
      week,
      45,
    );
    expect(toTimed).toEqual({
      start: d(1, 10),
      end: d(1, 10, 45),
      allDay: false,
    });
  });

  it('shifts a multi-day all-day event keeping its span and clamps the day index', () => {
    const next = resolveMove(
      adapter,
      n(ev('a', d(2), d(5), { allDay: true })),
      { dayIndex: 9, minutes: null, allDay: null },
      week,
      60,
    );
    expect(next).toEqual({ start: d(6), end: d(9), allDay: true });
    const first = resolveMove(
      adapter,
      n(ev('a', d(2), d(5), { allDay: true })),
      { dayIndex: -3, minutes: null, allDay: null },
      week,
      60,
    );
    expect(first.start).toEqual(new Date(2026, 7, 31));
  });

  it('resizes the end on the time axis with a minimum of one snap', () => {
    const grown = resolveResize(
      adapter,
      n(ev('a', d(2, 9), d(2, 10))),
      { dayIndex: 2, minutes: 12 * 60 + 30 },
      week,
      15,
    );
    expect(grown).toEqual({ start: d(2, 9), end: d(2, 12, 30), allDay: false });
    const collapsed = resolveResize(
      adapter,
      n(ev('a', d(2, 9), d(2, 10))),
      { dayIndex: 2, minutes: 8 * 60 },
      week,
      15,
    );
    expect(collapsed.end).toEqual(d(2, 9, 15));
    const midnight = resolveResize(
      adapter,
      n(ev('a', d(2, 22), d(2, 23))),
      { dayIndex: 2, minutes: 1440 },
      week,
      15,
    );
    expect(midnight.end).toEqual(d(3));
  });

  it('resizes lane events by day', () => {
    const allDay = resolveResize(
      adapter,
      n(ev('a', d(2), d(3), { allDay: true })),
      { dayIndex: 5, minutes: null },
      week,
      15,
    );
    expect(allDay).toEqual({ start: d(2), end: d(6), allDay: true });
    const tooShort = resolveResize(
      adapter,
      n(ev('a', d(2), d(4), { allDay: true })),
      { dayIndex: 0, minutes: null },
      week,
      15,
    );
    expect(tooShort.end).toEqual(d(3));
    const timedLane = resolveResize(
      adapter,
      n(ev('b', d(1, 9), d(2, 17))),
      { dayIndex: 4, minutes: null },
      week,
      15,
    );
    expect(timedLane).toEqual({ start: d(1, 9), end: d(4, 17), allDay: false });
    const midnightEnd = resolveResize(
      adapter,
      n(ev('c', d(1, 9), d(3, 0))),
      { dayIndex: 4, minutes: null },
      week,
      15,
    );
    expect(midnightEnd.end).toEqual(d(5));
  });
});
