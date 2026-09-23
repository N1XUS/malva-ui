import { inject, Pipe, type PipeTransform } from '@angular/core';
import { MlvI18nResolverService } from './i18n-resolver.service';
import { MLV_LOCALE } from './locale';

/** @private Parameters `mlvTranslate` interpolates. */
type MlvTranslateParams = Record<string, string | number | boolean | Date>;

/**
 * Resolves an ICU MessageFormat string with parameters, in `MLV_LOCALE` — the
 * active language pack's locale, falling back to `LOCALE_ID`.
 *
 * **Impure, with its own memo.** A pure pipe re-runs only when its arguments
 * change, and a template's `{ count: n() }` literal keeps its identity while
 * `n()` holds — so a runtime language switch, which changes neither argument,
 * would leave the old language's plural category on screen. The pipe therefore
 * runs on every refresh of its view, reads `MLV_LOCALE` each time (which is also
 * what keeps the view subscribed to it), and returns the previous result
 * unchanged unless the template, the parameters object or the locale moved.
 *
 * @example
 * {{ _i18n().allItems | mlvTranslate: { total: totalItems() } }}
 */
@Pipe({ name: 'mlvTranslate', pure: false })
export class MlvTranslatePipe implements PipeTransform {
  /** @private The resolver service for ICU MessageFormat strings. */
  private readonly _resolver = inject(MlvI18nResolverService, {
    optional: true,
  });

  /** @private The locale the result is formatted in; part of the memo key. */
  private readonly _locale = inject(MLV_LOCALE);

  /** @private Template of the memoised result. */
  private _lastValue: string | undefined;

  /** @private Parameters object of the memoised result, compared by identity. */
  private _lastParams: MlvTranslateParams | undefined;

  /** @private Locale of the memoised result. */
  private _lastLocale: string | undefined;

  /** @private The memoised result. */
  private _lastResult = '';

  /**
   * Resolves an ICU MessageFormat string with the given parameters.
   *
   * @param value - The ICU template string to resolve
   * @param params - Optional parameters for ICU interpolation
   * @returns The resolved string
   */
  transform(value: string, params?: MlvTranslateParams): string {
    if (!params || !value.includes('{')) return value;

    const locale = this._locale();
    if (
      value === this._lastValue &&
      params === this._lastParams &&
      locale === this._lastLocale
    ) {
      return this._lastResult;
    }

    this._lastValue = value;
    this._lastParams = params;
    this._lastLocale = locale;
    this._lastResult = this._resolver
      ? this._resolver.resolve({ _: value }, '_', params)
      : // Fallback: simple parameter replacement without ICU parsing
        value.replace(/\{(\w+)\}/g, (_, key) =>
          String(params[key] ?? `{${key}}`),
        );
    return this._lastResult;
  }
}
