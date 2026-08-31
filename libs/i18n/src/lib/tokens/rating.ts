import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvRatingI18n {
  /** aria-label for the rating group host. */
  rating: string;
  /** Per-star aria-label. ICU: "Rate {value} out of {max}". */
  rateValue: string;
}

export const MLV_RATING_I18N = new InjectionToken<Signal<MlvRatingI18n>>(
  'MLV_RATING_I18N',
);

export const MLV_RATING_I18N_CONTEXT: Record<
  keyof MlvRatingI18n,
  MlvTranslationContext
> = {
  rating: {
    component: 'mlv-rating',
    usage: 'aria-label',
    description: 'Group label announcing the star-rating control',
  },
  rateValue: {
    component: 'mlv-rating',
    usage: 'aria-label',
    icuParams: ['value', 'max'],
    description: 'Individual star option, e.g. "Rate 3 out of 5"',
  },
};
