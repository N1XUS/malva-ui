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
