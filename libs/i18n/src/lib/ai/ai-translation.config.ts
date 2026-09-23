import { InjectionToken, type Signal } from '@angular/core';
import type { MlvAiTranslationConfig } from '../types';

/**
 * Injection token for global AI translation configuration.
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
export const MLV_AI_TRANSLATION_CONFIG =
  new InjectionToken<MlvAiTranslationConfig>('MLV_AI_TRANSLATION_CONFIG');

/**
 * Intended as a per-subtree toggle for AI translation. Nothing in the library
 * reads it.
 *
 * @deprecated since 0.2.0 — removed in 1.0, with the rest of the runtime AI
 * translation API. There is no replacement; providing it has never had an
 * effect, so delete the provider.
 */
export const MLV_AI_TRANSLATION_ENABLED = new InjectionToken<Signal<boolean>>(
  'MLV_AI_TRANSLATION_ENABLED',
);
