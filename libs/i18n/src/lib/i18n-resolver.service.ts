import { Injectable } from '@angular/core';
import IntlMessageFormat from 'intl-messageformat';

/**
 * Resolves ICU MessageFormat strings with parameters.
 * Plain strings (no `{` placeholders) pass through unchanged.
 * Compiled ICU templates are cached for performance.
 */
@Injectable({ providedIn: 'root' })
export class MlvI18nResolverService {
  /** @private Cache of compiled ICU MessageFormat instances. */
  private readonly _cache = new Map<string, IntlMessageFormat>();

  /**
   * Resolves an ICU MessageFormat string with the given parameters.
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

    let compiled = this._cache.get(template);
    if (!compiled) {
      compiled = new IntlMessageFormat(template);
      this._cache.set(template, compiled);
    }
    return compiled.format(params) as string;
  }
}
