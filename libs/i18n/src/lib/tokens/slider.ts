import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvSliderI18n {
  /** aria-label for the single / minimum (range) thumb. */
  minValue: string;
  /** aria-label for the maximum thumb in range mode. */
  maxValue: string;
  /** Fallback aria-label for the thumb when no `label` is set. */
  value: string;
}

export const MLV_SLIDER_I18N = new InjectionToken<Signal<MlvSliderI18n>>(
  'MLV_SLIDER_I18N',
);

export const MLV_SLIDER_I18N_CONTEXT: Record<
  keyof MlvSliderI18n,
  MlvTranslationContext
> = {
  minValue: {
    component: 'mlv-slider',
    usage: 'aria-label',
    description: 'Minimum / single value thumb of the range slider',
  },
  maxValue: {
    component: 'mlv-slider',
    usage: 'aria-label',
    description: 'Maximum value thumb of the range slider',
  },
  value: {
    component: 'mlv-slider',
    usage: 'aria-label',
    description: 'Generic thumb label when no explicit label is provided',
  },
};
