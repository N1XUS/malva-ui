import { inject, Injectable } from '@angular/core';
import IntlMessageFormat from 'intl-messageformat';
import { MLV_LOCALE } from './locale';

/**
 * Resolves ICU MessageFormat strings with parameters.
 * Plain strings (no `{` placeholders) pass through unchanged.
 * Compiled ICU templates are cached for performance.
 *
 * Templates are compiled in `MLV_LOCALE` — the active language pack's locale,
 * falling back to `LOCALE_ID` — so plural categories (`one` / `few` / `many` /
 * `other`) and `#` number formatting follow the language the string is written
 * in, not the host runtime's default locale. `resolve()` reads that signal, so
 * a `computed()` or template calling it re-resolves when the pack is switched.
 */
@Injectable({ providedIn: 'root' })
export class MlvI18nResolverService {
  /** @private The locale templates are compiled in; see `MLV_LOCALE`. */
  private readonly _locale = inject(MLV_LOCALE);

  /**
   * @private Cache of compiled ICU MessageFormat instances, keyed by locale and
   * template — a template compiled for one locale carries that locale's plural
   * rules and number format, so the same text under another locale is a
   * different entry.
   */
  private readonly _cache = new Map<string, IntlMessageFormat>();

  /**
   * Resolves an ICU MessageFormat string with the given parameters.
   *
   * Reads `MLV_LOCALE` whenever the template has placeholders and parameters,
   * so a reactive caller re-resolves on a runtime language switch.
   *
   * @param i18n - The component's i18n object (e.g. from `inject(MLV_PAGINATION_I18N)()`)
   * @param key - The key to resolve
   * @param params - Optional parameters for ICU interpolation
   * @returns The resolved string
   */
  resolve<T extends Record<string, string | number | boolean | Date>>(
    i18n: Record<string, string>,
    key: string,
    params?: T,
  ): string {
    const template = i18n[key];
    if (!params || !template.includes('{')) return template;

    const locale = this._locale();
    const cacheKey = `${locale}\u0000${template}`;
    let compiled = this._cache.get(cacheKey);
    if (!compiled) {
      compiled = new IntlMessageFormat(template, locale);
      this._cache.set(cacheKey, compiled);
    }
    return compiled.format(params) as string;
  }
}
