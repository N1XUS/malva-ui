import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvProgressI18n {
  /** Default aria-label for the progress indicator. */
  progress: string;
}

export const MLV_PROGRESS_I18N = new InjectionToken<Signal<MlvProgressI18n>>(
  'MLV_PROGRESS_I18N',
);

export const MLV_PROGRESS_I18N_CONTEXT: Record<
  keyof MlvProgressI18n,
  MlvTranslationContext
> = {
  progress: {
    component: 'mlv-progress',
    usage: 'aria-label',
    description: 'Accessible label for progress bar/circle',
  },
};
