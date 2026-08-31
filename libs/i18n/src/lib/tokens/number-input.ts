import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvNumberInputI18n {
  /** aria-label for the decrement (step down) button. */
  decrement: string;
  /** aria-label for the increment (step up) button. */
  increment: string;
}

export const MLV_NUMBER_INPUT_I18N = new InjectionToken<
  Signal<MlvNumberInputI18n>
>('MLV_NUMBER_INPUT_I18N');

export const MLV_NUMBER_INPUT_I18N_CONTEXT: Record<
  keyof MlvNumberInputI18n,
  MlvTranslationContext
> = {
  decrement: {
    component: 'mlv-number-input',
    usage: 'aria-label',
    description: 'Button that decreases the numeric value by one step',
  },
  increment: {
    component: 'mlv-number-input',
    usage: 'aria-label',
    description: 'Button that increases the numeric value by one step',
  },
};
