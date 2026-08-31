import { InjectionToken, type Signal } from '@angular/core';
import type { MlvAiTranslationConfig } from '../types';

/** Injection token for global AI translation configuration. */
export const MLV_AI_TRANSLATION_CONFIG =
  new InjectionToken<MlvAiTranslationConfig>('MLV_AI_TRANSLATION_CONFIG');

/** Per-subtree toggle for AI translation. */
export const MLV_AI_TRANSLATION_ENABLED = new InjectionToken<Signal<boolean>>(
  'MLV_AI_TRANSLATION_ENABLED',
);
