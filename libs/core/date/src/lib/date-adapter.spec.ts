import { TestBed } from '@angular/core/testing';
import {
  MLV_DATE_ADAPTER,
  MLV_DATE_LOCALE,
  provideMlvDateAdapter,
} from './date-adapter';
import { MlvNativeDateAdapter } from './native-date-adapter';

describe('provideMlvDateAdapter', () => {
  it('registers the adapter class and the locale', () => {
    TestBed.configureTestingModule({
      providers: [...provideMlvDateAdapter(MlvNativeDateAdapter, 'ro-RO')],
    });
    const adapter = TestBed.inject(MLV_DATE_ADAPTER);
    expect(adapter instanceof MlvNativeDateAdapter).toBe(true);
    expect(TestBed.inject(MLV_DATE_LOCALE)).toBe('ro-RO');
  });

  it('leaves an application-provided MLV_DATE_LOCALE untouched when no locale is passed', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: MLV_DATE_LOCALE, useValue: 'fr-FR' },
        ...provideMlvDateAdapter(MlvNativeDateAdapter),
      ],
    });
    expect(TestBed.inject(MLV_DATE_LOCALE)).toBe('fr-FR');
    expect(TestBed.inject(MLV_DATE_ADAPTER).locale()).toBe('fr-FR');
  });

  it('overrides an application-provided MLV_DATE_LOCALE when a locale is passed', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: MLV_DATE_LOCALE, useValue: 'fr-FR' },
        ...provideMlvDateAdapter(MlvNativeDateAdapter, 'ro-RO'),
      ],
    });
    expect(TestBed.inject(MLV_DATE_LOCALE)).toBe('ro-RO');
  });
});

describe('MlvNativeDateAdapter', () => {
  let adapter: MlvNativeDateAdapter;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    adapter = TestBed.inject(MlvNativeDateAdapter);
  });

  it('creates and reads calendar dates', () => {
    const d = adapter.createDate(2026, 8, 2);
    expect([
      adapter.getYear(d),
      adapter.getMonth(d),
      adapter.getDate(d),
    ]).toEqual([2026, 8, 2]);
  });

  it('rejects an out-of-range month and day', () => {
    expect(() => adapter.createDate(2026, 12, 1)).toThrow(
      /Invalid month index/,
    );
    expect(() => adapter.createDate(2026, 1, 31)).toThrow(/Invalid date/);
  });

  it('flags an invalid Date instance', () => {
    expect(adapter.isValid(new Date(NaN))).toBe(false);
    expect(adapter.isValid(new Date(2026, 8, 2))).toBe(true);
  });
});

describe('MlvNativeDateAdapter time-of-day extension', () => {
  let adapter: MlvNativeDateAdapter;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    adapter = TestBed.inject(MlvNativeDateAdapter);
  });

  it('reads hours and minutes', () => {
    const d = new Date(2026, 8, 2, 13, 45);
    expect(adapter.getHours(d)).toBe(13);
    expect(adapter.getMinutes(d)).toBe(45);
    expect(adapter.minutesOfDay(d)).toBe(13 * 60 + 45);
  });

  it('creates a date-time and rejects an invalid time', () => {
    const d = adapter.createDateTime(2026, 8, 2, 9, 30);
    expect([
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      d.getHours(),
      d.getMinutes(),
      d.getSeconds(),
    ]).toEqual([2026, 8, 2, 9, 30, 0]);
    expect(() => adapter.createDateTime(2026, 8, 2, 24, 0)).toThrow(
      /Invalid time/,
    );
    expect(() => adapter.createDateTime(2026, 8, 2, 9, 60)).toThrow(
      /Invalid time/,
    );
    expect(() => adapter.createDateTime(2026, 8, 2, 9.5, 0)).toThrow(
      /Invalid time/,
    );
  });

  it('adds minutes across midnight and subtracts', () => {
    const d = new Date(2026, 8, 2, 23, 30);
    const plus = adapter.addMinutes(d, 90);
    expect([plus.getDate(), plus.getHours(), plus.getMinutes()]).toEqual([
      3, 1, 0,
    ]);
    const minus = adapter.addMinutes(d, -45);
    expect([minus.getHours(), minus.getMinutes()]).toEqual([22, 45]);
    expect(d.getHours()).toBe(23); // input untouched
  });

  it('computes signed, truncated minute differences', () => {
    const a = new Date(2026, 8, 2, 10, 0);
    const b = new Date(2026, 8, 2, 8, 30, 40);
    expect(adapter.differenceInMinutes(a, b)).toBe(89);
    expect(adapter.differenceInMinutes(b, a)).toBe(-89);
  });

  it('withTime keeps the calendar date and startOfDay drops the time', () => {
    const d = new Date(2026, 8, 2, 13, 45);
    const t = adapter.withTime(d, 7, 5);
    expect([
      t.getFullYear(),
      t.getMonth(),
      t.getDate(),
      t.getHours(),
      t.getMinutes(),
    ]).toEqual([2026, 8, 2, 7, 5]);
    const s = adapter.startOfDay(d);
    expect([s.getDate(), s.getHours(), s.getMinutes()]).toEqual([2, 0, 0]);
  });

  it('shiftDays keeps the wall-clock time', () => {
    const d = new Date(2026, 8, 2, 13, 45);
    const shifted = adapter.shiftDays(d, 3);
    expect([
      shifted.getDate(),
      shifted.getHours(),
      shifted.getMinutes(),
    ]).toEqual([5, 13, 45]);
    const back = adapter.shiftDays(d, -2);
    expect([back.getMonth(), back.getDate(), back.getHours()]).toEqual([
      7, 31, 13,
    ]);
  });

  it('compareDateTime orders by date then wall-clock minutes', () => {
    const a = new Date(2026, 8, 2, 9, 0);
    const b = new Date(2026, 8, 2, 9, 30);
    const c = new Date(2026, 8, 3, 0, 0);
    expect(adapter.compareDateTime(a, b)).toBeLessThan(0);
    expect(adapter.compareDateTime(b, a)).toBeGreaterThan(0);
    expect(adapter.compareDateTime(b, c)).toBeLessThan(0);
    expect(adapter.compareDateTime(a, new Date(2026, 8, 2, 9, 0, 59))).toBe(0);
    expect(adapter.sameDateTime(a, new Date(2026, 8, 2, 9, 0))).toBe(true);
    expect(adapter.sameDateTime(a, b)).toBe(false);
  });

  it('now returns the current date-time', () => {
    expect(Math.abs(adapter.now().getTime() - Date.now())).toBeLessThan(1000);
  });
});

describe('MlvNativeDateAdapter across DST transitions', () => {
  let adapter: MlvNativeDateAdapter;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    adapter = TestBed.inject(MlvNativeDateAdapter);
  });

  it('runs in the pinned Europe/Berlin zone', () => {
    // The DST cases below only mean something in a zone that observes DST; the
    // pin is a module-scope `process.env.TZ` assignment in
    // `libs/core/date/vite.config.mts`, placed BEFORE `defineConfig` so every
    // pooled worker inherits it before its first `Date`/`Intl` call caches the
    // zone. `test.env.TZ` reaches ICU too late (see 3e5ae011).
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(
      'Europe/Berlin',
    );
    expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(-60);
    expect(new Date(2026, 6, 15).getTimezoneOffset()).toBe(-120);
  });

  it('addMinutes adds elapsed time across the spring-forward gap', () => {
    // 2026-03-29 01:30 CET + 60 real minutes lands at 03:30 CEST: the
    // 02:00-03:00 wall-clock hour does not exist.
    const before = new Date(2026, 2, 29, 1, 30);
    const after = adapter.addMinutes(before, 60);
    expect([
      adapter.getDate(after),
      adapter.getHours(after),
      adapter.getMinutes(after),
    ]).toEqual([29, 3, 30]);
  });

  it('addMinutes adds elapsed time across the fall-back repeat', () => {
    // 2026-10-25 01:30 CEST + 120 real minutes lands at 02:30 CET, the second
    // pass through the repeated 02:00-03:00 hour.
    const before = new Date(2026, 9, 25, 1, 30);
    const after = adapter.addMinutes(before, 120);
    expect([
      adapter.getDate(after),
      adapter.getHours(after),
      adapter.getMinutes(after),
    ]).toEqual([25, 2, 30]);
    expect(after.getTimezoneOffset()).toBe(-60);
  });

  it('differenceInMinutes reports elapsed, not wall-clock, minutes', () => {
    // Spring forward: 01:00 -> 04:00 spans three wall-clock hours but two real ones.
    expect(
      adapter.differenceInMinutes(
        new Date(2026, 2, 29, 4, 0),
        new Date(2026, 2, 29, 1, 0),
      ),
    ).toBe(120);
    // Fall back: 01:00 -> 04:00 spans three wall-clock hours but four real ones.
    expect(
      adapter.differenceInMinutes(
        new Date(2026, 9, 25, 4, 0),
        new Date(2026, 9, 25, 1, 0),
      ),
    ).toBe(240);
    expect(
      adapter.differenceInMinutes(
        new Date(2026, 9, 25, 1, 0),
        new Date(2026, 9, 25, 4, 0),
      ),
    ).toBe(-240);
  });

  it('withTime keeps the calendar day on both transition days', () => {
    const springForward = adapter.withTime(new Date(2026, 2, 29, 12, 0), 9, 15);
    expect([
      adapter.getMonth(springForward),
      adapter.getDate(springForward),
      adapter.getHours(springForward),
      adapter.getMinutes(springForward),
    ]).toEqual([2, 29, 9, 15]);

    const fallBack = adapter.withTime(new Date(2026, 9, 25, 12, 0), 9, 15);
    expect([
      adapter.getMonth(fallBack),
      adapter.getDate(fallBack),
      adapter.getHours(fallBack),
      adapter.getMinutes(fallBack),
    ]).toEqual([9, 25, 9, 15]);
  });

  it('withTime resolves the non-existent spring-forward hour forward', () => {
    // 02:30 does not exist on 2026-03-29; the native Date setters roll it to 03:30.
    const inTheGap = adapter.withTime(new Date(2026, 2, 29, 12, 0), 2, 30);
    expect([
      adapter.getDate(inTheGap),
      adapter.getHours(inTheGap),
      adapter.getMinutes(inTheGap),
    ]).toEqual([29, 3, 30]);
  });

  it('startOfDay lands on local midnight on both transition days', () => {
    for (const day of [
      new Date(2026, 2, 29, 18, 45),
      new Date(2026, 9, 25, 18, 45),
    ]) {
      const start = adapter.startOfDay(day);
      expect([
        adapter.getYear(start),
        adapter.getMonth(start),
        adapter.getDate(start),
        adapter.getHours(start),
        adapter.getMinutes(start),
        start.getSeconds(),
        start.getMilliseconds(),
      ]).toEqual([
        adapter.getYear(day),
        adapter.getMonth(day),
        adapter.getDate(day),
        0,
        0,
        0,
        0,
      ]);
    }
  });

  it('shiftDays keeps the wall-clock time across a transition', () => {
    const beforeSpring = new Date(2026, 2, 28, 9, 30);
    const afterSpring = adapter.shiftDays(beforeSpring, 2);
    expect([
      adapter.getMonth(afterSpring),
      adapter.getDate(afterSpring),
      adapter.getHours(afterSpring),
      adapter.getMinutes(afterSpring),
    ]).toEqual([2, 30, 9, 30]);
    // Real elapsed time is one hour short of 48h because an hour was skipped.
    expect(adapter.differenceInMinutes(afterSpring, beforeSpring)).toBe(
      2 * 24 * 60 - 60,
    );
  });

  it('minutesOfDay reads the wall clock, not the elapsed offset', () => {
    expect(adapter.minutesOfDay(new Date(2026, 2, 29, 3, 30))).toBe(
      3 * 60 + 30,
    );
    expect(adapter.minutesOfDay(new Date(2026, 9, 25, 2, 30))).toBe(
      2 * 60 + 30,
    );
  });
});

/**
 * #370: `mlv-time-picker` rendered English "AM" / "PM" in every locale. The
 * labels now come from `getDayPeriodNames()`, a non-abstract member with an
 * `Intl` default, so an existing custom adapter keeps compiling.
 */
describe('MlvDateAdapter.getDayPeriodNames', () => {
  let adapter: MlvNativeDateAdapter;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    adapter = TestBed.inject(MlvNativeDateAdapter);
  });

  it('returns "AM" / "PM" in English', () => {
    adapter.setLocale('en-US');
    expect(adapter.getDayPeriodNames()).toEqual(['AM', 'PM']);
    adapter.setLocale('en');
    expect(adapter.getDayPeriodNames()).toEqual(['AM', 'PM']);
  });

  it("follows the adapter locale's Intl day periods", () => {
    adapter.setLocale('ja');
    expect(adapter.getDayPeriodNames()).toEqual(['午前', '午後']);
    adapter.setLocale('uk');
    expect(adapter.getDayPeriodNames()).toEqual(['дп', 'пп']);
    adapter.setLocale('zh-Hans');
    expect(adapter.getDayPeriodNames()).toEqual(['上午', '下午']);
  });

  it('falls back to "AM" / "PM" for a locale Intl rejects', () => {
    adapter.setLocale('not a locale!');
    expect(adapter.getDayPeriodNames()).toEqual(['AM', 'PM']);
  });

  it('is inherited by an adapter that does not override it', () => {
    class MinimalAdapter extends MlvNativeDateAdapter {}
    const minimal = TestBed.runInInjectionContext(() => new MinimalAdapter());
    minimal.setLocale('ja');
    expect(minimal.getDayPeriodNames()).toEqual(['午前', '午後']);
  });
});
