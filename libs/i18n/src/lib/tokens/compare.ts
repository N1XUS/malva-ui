import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvCompareI18n {
  /**
   * Fallback accessible name for the hidden range slider when the consumer
   * sets neither `ariaLabel` nor `ariaLabelledby`.
   */
  ariaLabel: string;
}

export const MLV_COMPARE_I18N = new InjectionToken<Signal<MlvCompareI18n>>(
  'MLV_COMPARE_I18N',
);

export const MLV_COMPARE_I18N_CONTEXT: Record<
  keyof MlvCompareI18n,
  MlvTranslationContext
> = {
  ariaLabel: {
    component: 'mlv-compare',
    usage: 'aria-label',
    description:
      'Accessible name of the before/after comparison slider when the consumer provides no label',
  },
};
