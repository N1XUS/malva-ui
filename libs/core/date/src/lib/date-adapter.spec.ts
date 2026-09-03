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

  it('leaves MLV_DATE_LOCALE on its default when no locale is passed', () => {
    TestBed.configureTestingModule({
      providers: [...provideMlvDateAdapter(MlvNativeDateAdapter)],
    });
    expect(typeof TestBed.inject(MLV_DATE_LOCALE)).toBe('string');
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
