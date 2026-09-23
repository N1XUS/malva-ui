import {
  computed,
  inject,
  InjectionToken,
  LOCALE_ID,
  signal,
  type Signal,
} from '@angular/core';
import { MlvI18nService } from './i18n.service';

/**
 * The locale Malva UI formats in — one signal for ICU plurals, dates and
 * times, so all of them follow the language the app is actually running in.
 *
 * Its value is the active language pack's `locale`
 * (`MlvLanguage.locale`), falling back to Angular's `LOCALE_ID` while no
 * pack is loaded, when the pack declares none, or when `provideMlvI18n()` is
 * not used at all. It never reads `navigator.language`, so a server render and
 * the browser that hydrates it agree.
 *
 * It is a signal: `MlvI18nService.switchLanguage()` moves it, and every
 * `computed()` or template that formats through it re-formats.
 *
 * The value is always a canonical BCP 47 tag (`Intl.getCanonicalLocales`):
 * `zh-hans` reads `zh-Hans`, and an underscore is read as a hyphen the way
 * Angular reads one in `LOCALE_ID` (`de_AT` → `de-AT`). A pack locale that is
 * still malformed falls back to `LOCALE_ID`, and a malformed `LOCALE_ID` to
 * `en-US`, instead of reaching `Intl` — where it would throw a `RangeError`
 * out of every plural and date. A value you provide yourself is used as given.
 *
 * Read by `MlvI18nResolverService` and `mlvTranslate` (plural categories and
 * `#` number formatting), by `MLV_DATE_LOCALE`'s default and
 * `MlvNativeDateAdapter` in `@malva-ui/core/date`, and by `mlv-chat`'s message
 * times and date separators.
 *
 * Provide it yourself only to decouple formatting from the pack, and provide it
 * in the application's environment providers — the root-provided resolver and
 * date adapter resolve it there, so a component-level provider reaches neither:
 * `{ provide: MLV_LOCALE, useValue: signal('de-CH').asReadonly() }`.
 *
 * @example
 * ```ts
 * private readonly _locale = inject(MLV_LOCALE);
 * protected readonly _price = computed(() =>
 *   new Intl.NumberFormat(this._locale(), { style: 'currency', currency: 'EUR' })
 *     .format(this.amount()),
 * );
 * ```
 */
export const MLV_LOCALE = new InjectionToken<Signal<string>>('MLV_LOCALE', {
  providedIn: 'root',
  factory: () => {
    const i18n = inject(MlvI18nService, { optional: true });
    const fallback = canonicalLocale(inject(LOCALE_ID)) ?? 'en-US';
    if (!i18n) return signal(fallback).asReadonly();
    return computed(() => canonicalLocale(i18n._locale()) ?? fallback);
  },
});

/**
 * @private Canonical BCP 47 form of `tag`, or `null` when there is none or
 * `Intl` rejects it (review #306 F3).
 *
 * `_` is folded to `-` first because Angular accepts `de_AT` as a `LOCALE_ID`
 * (its locale-data lookup does the same fold), while `Intl` throws on it.
 * `Intl.getCanonicalLocales` is an ECMAScript built-in, so this is as safe on
 * the server as in the browser.
 */
function canonicalLocale(tag: string | null | undefined): string | null {
  if (!tag) return null;
  try {
    return Intl.getCanonicalLocales(tag.replace(/_/g, '-'))[0] ?? null;
  } catch {
    return null;
  }
}
