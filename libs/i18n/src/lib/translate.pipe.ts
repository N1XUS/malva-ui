import { inject, Pipe, type PipeTransform } from '@angular/core';
import { MlvI18nResolverService } from './i18n-resolver.service';

/**
 * Resolves an ICU MessageFormat string with parameters.
 *
 * @example
 * {{ _i18n().allItems | mlvTranslate: { total: totalItems() } }}
 */
@Pipe({ name: 'mlvTranslate' })
export class MlvTranslatePipe implements PipeTransform {
  /** @private The resolver service for ICU MessageFormat strings. */
  private readonly _resolver = inject(MlvI18nResolverService, {
    optional: true,
  });

  /**
   * Resolves an ICU MessageFormat string with the given parameters.
   *
   * @param value - The ICU template string to resolve
   * @param params - Optional parameters for ICU interpolation
   * @returns The resolved string
   */
  transform(
    value: string,
    params?: Record<string, string | number | boolean | Date>,
  ): string {
    if (!params || !value.includes('{')) return value;

    if (this._resolver) {
      return this._resolver.resolve({ _: value }, '_', params);
    }

    // Fallback: simple parameter replacement without ICU parsing
    return value.replace(/\{(\w+)\}/g, (_, key) =>
      String(params[key] ?? `{${key}}`),
    );
  }
}
