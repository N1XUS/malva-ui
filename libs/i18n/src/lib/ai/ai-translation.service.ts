import {
  inject,
  Injectable,
  makeEnvironmentProviders,
  type EnvironmentProviders,
} from '@angular/core';
import type { MlvAiTranslationConfig, MlvTranslationRequest } from '../types';
import { MLV_AI_TRANSLATION_CONFIG } from './ai-translation.config';

/**
 * Runtime AI translation service for missing keys. Nothing in the library
 * calls it.
 *
 * @deprecated since 0.2.0 — removed in 1.0, with the rest of the runtime AI
 * translation API. There is no replacement. Nothing in the library calls this
 * service, its configuration's `enabled`, `cache` and `targetLocale` are never
 * read, and the one shipped provider, `claudeProvider()`, sends a secret API key
 * from whatever runtime calls it. Ship translated strings in a language pack
 * (`provideMlvI18n()`); if your own `MlvTranslationProvider` calls a server you
 * control, call that server directly.
 */
@Injectable({ providedIn: 'root' })
export class MlvAiTranslationService {
  /** @private Optional AI translation config (provider, target locale); `null` when not provided. */
  private readonly _config = inject(MLV_AI_TRANSLATION_CONFIG, {
    optional: true,
  });

  /** @private In-memory cache of resolved translations, keyed by `locale:key`. */
  private readonly _cache = new Map<string, string>();

  /**
   * Translates a missing key using the configured AI provider.
   * Resolves to `null` when no provider is configured, when the provider
   * returns no text, and when it throws — a failure never rejects.
   */
  async translate(request: MlvTranslationRequest): Promise<string | null> {
    if (!this._config?.provider) return null;

    const cacheKey = `${request.targetLocale}:${request.key}`;
    const cached = this._cache.get(cacheKey);
    if (cached) return cached;

    try {
      const results = await this._config.provider.translate([request]);
      const result = results[0];
      if (result?.translatedText) {
        this._cache.set(cacheKey, result.translatedText);
        return result.translatedText;
      }
    } catch {
      // Silently fall back to source text
    }

    return null;
  }
}

/**
 * Provides the configuration `MlvAiTranslationService` reads.
 *
 * @deprecated since 0.2.0 — removed in 1.0, with the rest of the runtime AI
 * translation API. There is no replacement. Nothing in the library calls
 * `MlvAiTranslationService`, the configuration's `enabled`, `cache` and
 * `targetLocale` are never read, and the one shipped provider,
 * `claudeProvider()`, sends a secret API key from whatever runtime calls it.
 * Ship translated strings in a language pack (`provideMlvI18n()`); if your own
 * `MlvTranslationProvider` calls a server you control, call that server
 * directly.
 */
export function provideMlvAiTranslation(
  config: MlvAiTranslationConfig,
): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: MLV_AI_TRANSLATION_CONFIG, useValue: config },
  ]);
}
