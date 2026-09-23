import { Injectable, inject, linkedSignal, untracked } from '@angular/core';
import { MLV_LOCALE } from '@malva-ui/i18n';
import {
  MLV_DATE_LOCALE,
  MlvDateAdapter,
  type MlvDateFormatOptions,
} from './date-adapter';
import { MLV_DATE_LOCALE_DEFAULT_RECORD } from './date-locale-default';

/**
 * Default Malva UI date adapter backed by native `Date` and `Intl.DateTimeFormat`.
 *
 * This implementation keeps the adapter contract lightweight while still
 * providing localized labels, month names, weekday names, parsing, and
 * calendar arithmetic for apps that do not need a third-party date library.
 *
 * Its `locale` is either **following** or **pinned**, and which one is state,
 * never inferred from the values:
 *
 * - **Following** — `MLV_DATE_LOCALE` was not provided. The adapter reports
 *   `MLV_LOCALE` (the active language pack's locale, falling back to
 *   `LOCALE_ID`) and takes over every runtime language switch, even when the
 *   default was read before the pack loaded.
 * - **Pinned** — `MLV_DATE_LOCALE` was provided (any value, including one
 *   equal to the current pack's locale), or `setLocale()` was called with a
 *   value that differs from `MLV_LOCALE`. The adapter keeps that locale across
 *   every switch, including one that passes through it.
 *
 * `setLocale()` with the current `MLV_LOCALE` value returns the adapter to
 * following.
 */
@Injectable({
  providedIn: 'root',
})
export class MlvNativeDateAdapter extends MlvDateAdapter<Date> {
  /** @private Locale this adapter was configured with through `MLV_DATE_LOCALE`. */
  private readonly _initialLocale = inject(MLV_DATE_LOCALE);

  /**
   * @private Whether the adapter keeps its own locale instead of following
   * `MLV_LOCALE`. Starts `true` when `MLV_DATE_LOCALE` was provided: its default
   * factory records what it resolved, and a provided token never runs it (see
   * `MLV_DATE_LOCALE_DEFAULT_RECORD` for the one residual). Rewritten only by
   * `setLocale()`.
   *
   * State rather than a value comparison (review #306 F1): comparing the
   * adapter's value with the app locale released a pin whenever a switch passed
   * through it, and only if something read `locale()` in between.
   */
  private _pinned =
    inject(MLV_DATE_LOCALE_DEFAULT_RECORD).resolved !== this._initialLocale;

  /** @private The app locale this adapter follows while not pinned. */
  private readonly _appLocale = inject(MLV_LOCALE);

  /**
   * Reactive locale used by formatting and label methods. Follows `MLV_LOCALE`
   * while not pinned; `setLocale()` writes it directly.
   */
  override readonly locale = linkedSignal<string, string>({
    source: this._appLocale,
    computation: (app, previous) => {
      if (!this._pinned) return app;
      return previous ? previous.value : this._initialLocale;
    },
  });

  /** @private Cache of `Intl.DateTimeFormat` instances keyed by locale + format options. */
  private readonly _intlCache = new Map<string, Intl.DateTimeFormat>();

  /**
   * Sets the adapter's locale. A value that differs from `MLV_LOCALE` pins it
   * there across every later language switch; the current `MLV_LOCALE` value
   * returns the adapter to following the language pack.
   */
  override setLocale(locale: string): void {
    this._pinned = locale !== untracked(this._appLocale);
    this.locale.set(locale);
  }

  /** Returns today's date normalized to local midnight. */
  override today(): Date {
    return this._normalizeDate(new Date());
  }

  /** Clones and normalizes a native `Date`. */
  override clone(date: Date): Date {
    return this._normalizeDate(date);
  }

  /** Creates a valid local date or throws when the input is invalid. */
  override createDate(year: number, month: number, day: number): Date {
    if (month < 0 || month > 11) {
      throw new Error(`Invalid month index "${month}". Expected 0-11.`);
    }

    if (day < 1) {
      throw new Error(`Invalid day "${day}". Expected a value greater than 0.`);
    }

    const result = new Date(year, month, day);
    if (
      result.getFullYear() !== year ||
      result.getMonth() !== month ||
      result.getDate() !== day
    ) {
      throw new Error(`Invalid date "${year}-${month + 1}-${day}".`);
    }

    return this._normalizeDate(result);
  }

  /** Returns the year part of the given date. */
  override getYear(date: Date): number {
    return date.getFullYear();
  }

  /** Returns the zero-based month index of the given date. */
  override getMonth(date: Date): number {
    return date.getMonth();
  }

  /** Returns the day-of-month of the given date. */
  override getDate(date: Date): number {
    return date.getDate();
  }

  /** Returns the weekday index of the given date. */
  override getDayOfWeek(date: Date): number {
    return date.getDay();
  }

  /** Returns the number of days in the given date's month. */
  override getNumDaysInMonth(date: Date): number {
    return new Date(this.getYear(date), this.getMonth(date) + 1, 0).getDate();
  }

  /** Returns localized month names using `Intl.DateTimeFormat`. */
  override getMonthNames(style: 'long' | 'short' | 'narrow'): string[] {
    return Array.from({ length: 12 }, (_, monthIndex) =>
      this.format(new Date(2020, monthIndex, 1), { month: style }),
    );
  }

  /** Returns localized weekday names using `Intl.DateTimeFormat`. */
  override getDayOfWeekNames(style: 'long' | 'short' | 'narrow'): string[] {
    return Array.from({ length: 7 }, (_, dayOffset) =>
      this.format(new Date(2020, 10, 1 + dayOffset), { weekday: style }),
    );
  }

  /** Adds calendar days while preserving local calendar semantics. */
  override addCalendarDays(date: Date, days: number): Date {
    const result = this.clone(date);
    result.setDate(result.getDate() + days);
    return this._normalizeDate(result);
  }

  /** Adds calendar months and clamps the day when needed. */
  override addCalendarMonths(date: Date, months: number): Date {
    return this._createClampedDate(
      this.getYear(date),
      this.getMonth(date) + months,
      this.getDate(date),
    );
  }

  /** Adds calendar years and clamps the day when needed. */
  override addCalendarYears(date: Date, years: number): Date {
    return this._createClampedDate(
      this.getYear(date) + years,
      this.getMonth(date),
      this.getDate(date),
    );
  }

  /** Formats a date with the current locale and `Intl` options. */
  override format(date: Date, displayFormat: MlvDateFormatOptions): string {
    return this._getFormatter(displayFormat).format(date);
  }

  /** Returns a stable `YYYY-MM-DD` string for the given local date. */
  override toIso8601(date: Date): string {
    const year = this.getYear(date);
    const month = `${this.getMonth(date) + 1}`.padStart(2, '0');
    const day = `${this.getDate(date)}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /** Deserializes native `Date`, ISO-like strings, and timestamps. */
  override deserialize(value: unknown): Date | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    if (this.isDateInstance(value)) {
      return this.isValid(value) ? this.clone(value) : null;
    }

    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      return this.isValid(parsed) ? this._normalizeDate(parsed) : null;
    }

    return null;
  }

  /** Returns `true` when the value is a native `Date` instance. */
  override isDateInstance(value: unknown): value is Date {
    return value instanceof Date;
  }

  /** Returns `true` when the `Date` has a valid timestamp. */
  override isValid(date: Date): boolean {
    return !Number.isNaN(date.getTime());
  }

  /** Returns the local wall-clock hour. */
  override getHours(date: Date): number {
    return date.getHours();
  }

  /** Returns the local wall-clock minute. */
  override getMinutes(date: Date): number {
    return date.getMinutes();
  }

  /** Creates a local date-time; throws for an invalid calendar date or time. */
  override createDateTime(
    year: number,
    month: number,
    day: number,
    hours: number,
    minutes: number,
  ): Date {
    const result = this.createDate(year, month, day);
    if (
      !Number.isInteger(hours) ||
      !Number.isInteger(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      throw new Error(
        `Invalid time "${hours}:${minutes}". Expected hours 0-23 and minutes 0-59.`,
      );
    }
    result.setHours(hours, minutes, 0, 0);
    return result;
  }

  /** Adds elapsed minutes using real time, so DST transitions keep their true length. */
  override addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60_000);
  }

  /** Returns `first − second` in whole minutes, truncated toward zero. */
  override differenceInMinutes(first: Date, second: Date): number {
    return Math.trunc((first.getTime() - second.getTime()) / 60_000);
  }

  /** Returns the current local date-time. */
  override now(): Date {
    return new Date();
  }

  /** @private Strips the time component, returning a new `Date` at local midnight. */
  private _normalizeDate(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  /** @private Builds a date for the given fields, clamping the day to the target month's length. */
  private _createClampedDate(year: number, month: number, day: number): Date {
    const normalizedMonth = new Date(year, month, 1);
    const normalizedYear = normalizedMonth.getFullYear();
    const normalizedMonthIndex = normalizedMonth.getMonth();
    const daysInTargetMonth = new Date(
      normalizedYear,
      normalizedMonthIndex + 1,
      0,
    ).getDate();

    return this.createDate(
      normalizedYear,
      normalizedMonthIndex,
      Math.min(day, daysInTargetMonth),
    );
  }

  /** @private Returns a cached (or freshly created) `Intl.DateTimeFormat` for the current locale and format. */
  private _getFormatter(
    displayFormat: MlvDateFormatOptions,
  ): Intl.DateTimeFormat {
    const cacheKey = `${this.locale()}::${JSON.stringify(displayFormat)}`;
    const formatter = this._intlCache.get(cacheKey);

    if (formatter) {
      return formatter;
    }

    const nextFormatter = new Intl.DateTimeFormat(this.locale(), displayFormat);
    this._intlCache.set(cacheKey, nextFormatter);
    return nextFormatter;
  }
}
