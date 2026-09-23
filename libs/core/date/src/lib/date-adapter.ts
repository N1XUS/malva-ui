import type { Provider, Type, WritableSignal } from '@angular/core';
import { InjectionToken, signal } from '@angular/core';
import { mlvDateLocaleDefault } from './date-locale-default';

/**
 * Formatting options accepted by Malva UI date adapters.
 *
 * Adapters may interpret these through `Intl.DateTimeFormat`, a library-specific
 * formatter, or another localization layer, but the default implementation uses
 * the standard `Intl` options shape.
 */
export type MlvDateFormatOptions = Intl.DateTimeFormatOptions;

/**
 * Application-level locale token consumed by Malva UI date adapters.
 *
 * Defaults to `MLV_LOCALE` from `@malva-ui/i18n` — the active language pack's
 * locale, falling back to Angular's `LOCALE_ID` — read once, when the token is
 * first injected. It never reads `navigator.language`, so a server render and
 * the browser that hydrates it format dates alike (#306).
 *
 * A string, not a signal, so it cannot follow a runtime language switch
 * itself; `MlvNativeDateAdapter` follows `MLV_LOCALE` directly while it is not
 * pinned. Providing this token (or passing `locale` to
 * {@link provideMlvDateAdapter}) **pins** the native adapter to that value —
 * even one equal to the current pack's locale — and it keeps it across every
 * language switch until `setLocale()` is called with the app locale. Provide
 * it where the adapter is provided (normally the application root). Read
 * `MLV_LOCALE` for the live value.
 */
export const MLV_DATE_LOCALE = new InjectionToken<string>('MLV_DATE_LOCALE', {
  providedIn: 'root',
  factory: mlvDateLocaleDefault,
});

/**
 * Injection token for the active Malva UI date adapter.
 *
 * Applications can provide a custom adapter implementation when they need
 * a different date object model or library-backed date math.
 */
export const MLV_DATE_ADAPTER = new InjectionToken<MlvDateAdapter<unknown>>(
  'MLV_DATE_ADAPTER',
);

/**
 * Registers a custom Malva UI date adapter and optionally overrides the locale.
 *
 * @param adapter Adapter class to instantiate for date operations.
 * @param locale Optional locale string passed to `MLV_DATE_LOCALE`.
 */
export function provideMlvDateAdapter<D>(
  adapter: Type<MlvDateAdapter<D>>,
  locale?: string,
): Provider[] {
  return [
    {
      provide: MLV_DATE_ADAPTER,
      useClass: adapter,
    },
    ...(locale
      ? [
          {
            provide: MLV_DATE_LOCALE,
            useValue: locale,
          },
        ]
      : []),
  ];
}

/**
 * Abstract date-manipulation and localization contract used by calendar-aware
 * Malva UI components.
 *
 * Implementations may wrap native `Date`, Luxon, Moment, date-fns-backed value
 * objects, or any other date representation, as long as they provide calendar
 * arithmetic, comparison, parsing, and localized labels through this surface.
 */
export abstract class MlvDateAdapter<D> {
  /** Reactive locale used by formatting and label methods. */
  readonly locale: WritableSignal<string> = signal('en-US');

  /** Sets the active locale for this adapter. */
  setLocale(locale: string): void {
    this.locale.set(locale);
  }

  /** Compares two dates by year, month, and day. */
  compareDate(first: D, second: D): number {
    const firstYear = this.getYear(first);
    const secondYear = this.getYear(second);

    if (firstYear !== secondYear) {
      return firstYear - secondYear;
    }

    const firstMonth = this.getMonth(first);
    const secondMonth = this.getMonth(second);

    if (firstMonth !== secondMonth) {
      return firstMonth - secondMonth;
    }

    return this.getDate(first) - this.getDate(second);
  }

  /** Returns `true` when both values represent the same calendar day. */
  sameDate(first: D | null, second: D | null): boolean {
    if (!first || !second) {
      return first === second;
    }

    return this.compareDate(first, second) === 0;
  }

  /** Produces a localized accessible label for a full calendar date. */
  getDateLabel(date: D): string {
    return this.format(date, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  /** Produces a localized month-and-year header label. */
  getMonthYearLabel(date: D): string {
    return this.format(date, {
      month: 'long',
      year: 'numeric',
    });
  }

  /** Produces a localized year label. */
  getYearLabel(date: D): string {
    return this.format(date, {
      year: 'numeric',
    });
  }

  /** Produces a localized day-of-month label. */
  getDayOfMonthLabel(date: D): string {
    return this.format(date, {
      day: 'numeric',
    });
  }

  /** Returns the adapter's representation of today's date. */
  abstract today(): D;
  /** Creates a safe clone of the provided date instance. */
  abstract clone(date: D): D;
  /** Creates a date instance from year, month, and day values. */
  abstract createDate(year: number, month: number, day: number): D;
  /** Returns the calendar year of the provided date. */
  abstract getYear(date: D): number;
  /** Returns the zero-based month index of the provided date. */
  abstract getMonth(date: D): number;
  /** Returns the day-of-month of the provided date. */
  abstract getDate(date: D): number;
  /** Returns the day-of-week index of the provided date. */
  abstract getDayOfWeek(date: D): number;
  /** Returns the number of days in the provided date's month. */
  abstract getNumDaysInMonth(date: D): number;
  /** Returns localized month names in the requested width. */
  abstract getMonthNames(style: 'long' | 'short' | 'narrow'): string[];
  /** Returns localized weekday names in the requested width. */
  abstract getDayOfWeekNames(style: 'long' | 'short' | 'narrow'): string[];
  /** Adds calendar days and returns a new date instance. */
  abstract addCalendarDays(date: D, days: number): D;
  /** Adds calendar months and returns a new date instance. */
  abstract addCalendarMonths(date: D, months: number): D;
  /** Adds calendar years and returns a new date instance. */
  abstract addCalendarYears(date: D, years: number): D;
  /** Formats the provided date using adapter-specific localization rules. */
  abstract format(date: D, displayFormat: MlvDateFormatOptions): string;
  /** Returns a stable ISO-like string for tracking and identity purposes. */
  abstract toIso8601(date: D): string;
  /** Deserializes an unknown value into the adapter's date type. */
  abstract deserialize(value: unknown): D | null;
  /** Returns `true` when the value is already a date instance understood by this adapter. */
  abstract isDateInstance(value: unknown): value is D;
  /** Returns `true` when the provided date instance is valid. */
  abstract isValid(date: D): boolean;
  /** Returns the wall-clock hour (0–23) of the provided date-time. */
  abstract getHours(date: D): number;
  /** Returns the wall-clock minute (0–59) of the provided date-time. */
  abstract getMinutes(date: D): number;
  /**
   * Creates a date-time from calendar fields plus a wall-clock time.
   * Implementations throw for out-of-range fields.
   */
  abstract createDateTime(
    year: number,
    month: number,
    day: number,
    hours: number,
    minutes: number,
  ): D;
  /** Adds elapsed minutes (may be negative) and returns a new date-time instance. */
  abstract addMinutes(date: D, minutes: number): D;
  /** Returns `first − second` in whole minutes, truncated toward zero. */
  abstract differenceInMinutes(first: D, second: D): number;
  /** Returns the current date-time in the adapter's zone. */
  abstract now(): D;

  /** Returns a date-time on the same calendar day as `date` at the given wall-clock time. */
  withTime(date: D, hours: number, minutes: number): D {
    return this.createDateTime(
      this.getYear(date),
      this.getMonth(date),
      this.getDate(date),
      hours,
      minutes,
    );
  }

  /**
   * Returns the start (00:00) of the provided date's calendar day.
   *
   * Routed through {@link withTime} rather than `createDate` so an adapter whose
   * `createDate` keeps a time component (or returns a date-only value object)
   * still gets a real midnight date-time.
   */
  startOfDay(date: D): D {
    return this.withTime(date, 0, 0);
  }

  /** Returns wall-clock minutes elapsed since the start of the day (0–1439). */
  minutesOfDay(date: D): number {
    return this.getHours(date) * 60 + this.getMinutes(date);
  }

  /**
   * Adds calendar days while preserving the wall-clock time, unlike
   * `addCalendarDays`, which implementations may normalize to midnight.
   */
  shiftDays(date: D, days: number): D {
    return this.withTime(
      this.addCalendarDays(date, days),
      this.getHours(date),
      this.getMinutes(date),
    );
  }

  /** Compares two date-times by calendar day, then by wall-clock minute. Seconds are ignored. */
  compareDateTime(first: D, second: D): number {
    const byDate = this.compareDate(first, second);
    if (byDate !== 0) {
      return byDate;
    }
    return this.minutesOfDay(first) - this.minutesOfDay(second);
  }

  /** Returns `true` when both values fall on the same calendar day and minute. */
  sameDateTime(first: D, second: D): boolean {
    return this.compareDateTime(first, second) === 0;
  }
}
