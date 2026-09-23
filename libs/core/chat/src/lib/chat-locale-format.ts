import { inject } from '@angular/core';
import {
  DATE_PIPE_DEFAULT_OPTIONS,
  DATE_PIPE_DEFAULT_TIMEZONE,
} from '@angular/common';

/**
 * @internal Locale-aware time and date formatting for `mlv-chat`'s own text —
 * a bubble's visible time, the matching accessible name on its article, and
 * the default date separator.
 *
 * `Intl.DateTimeFormat` rather than Angular's `formatDate` / `DatePipe`: the
 * locale is `MLV_LOCALE` (the active language pack's), and Angular throws for
 * any locale whose CLDR data the app never registered with
 * `registerLocaleData` — `uk` in an app built for `en-US`, say — while `Intl`
 * carries every locale it knows. Kept out of the barrel.
 *
 * The time zone is still `DatePipe`'s: see {@link injectChatTimezoneOffset}.
 */

/** @private Formatter options per kind, matching Angular's `shortTime` / `mediumDate`. */
const CHAT_FORMATS = {
  time: { timeStyle: 'short' },
  date: { dateStyle: 'medium' },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

/** @private Cached formatters keyed by kind, locale and zone; each is immutable. */
const formatters = new Map<string, Intl.DateTimeFormat>();

/**
 * @private Returns the cached formatter for `kind` in `locale`, reading the
 * wall clock in UTC when `utc` is set and in the runtime's zone otherwise.
 */
function chatFormatter(
  kind: keyof typeof CHAT_FORMATS,
  locale: string,
  utc: boolean,
): Intl.DateTimeFormat {
  const key = `${kind}\u0000${locale}\u0000${utc ? 'utc' : 'local'}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(
      locale,
      utc ? { ...CHAT_FORMATS[kind], timeZone: 'UTC' } : CHAT_FORMATS[kind],
    );
    formatters.set(key, formatter);
  }
  return formatter;
}

/**
 * @private Formats `date` with the `kind` formatter, at the fixed UTC offset
 * `offset` when one is given (see {@link injectChatTimezoneOffset}).
 *
 * Shifting the instant by the offset and reading it back in UTC yields the
 * wall clock at that offset. Angular's `formatDate` shifts into the runtime
 * zone instead, which puts it an hour ahead whenever that wall clock falls in
 * the hour the runtime zone skips at its spring-forward transition (02:00–02:59
 * on that date in New York); this form has no such hour.
 */
function formatChat(
  kind: keyof typeof CHAT_FORMATS,
  date: Date,
  locale: string,
  offset: number | null,
): string {
  if (offset === null) return chatFormatter(kind, locale, false).format(date);
  return chatFormatter(kind, locale, true).format(
    new Date(date.getTime() - offset * 60_000),
  );
}

/**
 * @internal The UTC offset the app configured for `DatePipe`, in
 * `Date#getTimezoneOffset()` minutes (behind UTC positive), or `null` for the
 * runtime's own zone. Must run in an injection context; both tokens are static,
 * so read it once per component.
 *
 * Picks and parses the zone exactly as `DatePipe` does (review #306 F2): the
 * zone is `DATE_PIPE_DEFAULT_OPTIONS.timezone`, else the legacy
 * `DATE_PIPE_DEFAULT_TIMEZONE` — deprecated, but `DatePipe` still reads it —
 * and it is parsed the way Angular's `timezoneToOffset` parses it: a fixed
 * offset (`'+0530'`, `'+05:30'`) or an abbreviation `Date.parse` knows
 * (`'UTC'`, `'GMT'`, `'EST'`). Anything else — an IANA name such as
 * `'Europe/Berlin'` included — falls back to the runtime's zone, as it does
 * for `DatePipe`.
 *
 * The rendered time therefore matches `DatePipe`'s everywhere except the
 * runtime zone's spring-forward hour, where `DatePipe` is an hour ahead and
 * the chat is correct (review #306 R2-1; see `formatChat`). Example: a New
 * York runtime with `'+0530'` rendered a message sent at 2026-03-07T20:30Z as
 * 03:00 and now renders 02:00, the actual time at +05:30.
 */
export function injectChatTimezoneOffset(): number | null {
  const timezone =
    inject(DATE_PIPE_DEFAULT_OPTIONS, { optional: true })?.timezone ??
    inject(DATE_PIPE_DEFAULT_TIMEZONE, { optional: true }) ??
    undefined;
  if (!timezone) return null;
  const offset =
    Date.parse(`Jan 01, 1970 00:00:00 ${timezone.replace(/:/g, '')}`) / 60_000;
  return Number.isNaN(offset) ? null : offset;
}

/**
 * @internal Short time of day (`15:35`, `3:35 PM`) in `locale`, at the UTC
 * `offset` from {@link injectChatTimezoneOffset} (`null`: the runtime's zone).
 */
export function formatChatTime(
  date: Date,
  locale: string,
  offset: number | null,
): string {
  return formatChat('time', date, locale, offset);
}

/**
 * @internal Medium calendar date (`05.06.2024`, `Jun 5, 2024`) in `locale`, at
 * the UTC `offset` from {@link injectChatTimezoneOffset} (`null`: the runtime's
 * zone).
 */
export function formatChatDate(
  date: Date,
  locale: string,
  offset: number | null,
): string {
  return formatChat('date', date, locale, offset);
}
