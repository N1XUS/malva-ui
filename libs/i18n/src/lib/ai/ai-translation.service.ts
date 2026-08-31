import {
  inject,
  Injectable,
  makeEnvironmentProviders,
  type EnvironmentProviders,
} from '@angular/core';
import type { MlvAiTranslationConfig, MlvTranslationRequest } from '../types';
import { MLV_AI_TRANSLATION_CONFIG } from './ai-translation.config';

/**
 * Runtime AI translation service for missing keys.
 * Opt-in per component subtree via MLV_AI_TRANSLATION_ENABLED.
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
   * Returns null if AI translation is not configured or disabled.
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
 * Provides runtime AI translation support.
 *
 * @example
 * ```ts
 * providers: [
 *   provideMlvAiTranslation({
 *     provider: claudeProvider({ apiKey: '...' }),
 *     targetLocale: 'de',
 *     cache: 'indexeddb',
 *     enabled: false,
 *   }),
 * ]
 * ```
 */
export function provideMlvAiTranslation(
  config: MlvAiTranslationConfig,
): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: MLV_AI_TRANSLATION_CONFIG, useValue: config },
  ]);
}
