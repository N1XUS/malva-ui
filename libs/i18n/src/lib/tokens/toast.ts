import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvToastI18n {
  /** aria-label for the dismiss button. */
  dismiss: string;
}

export const MLV_TOAST_I18N = new InjectionToken<Signal<MlvToastI18n>>(
  'MLV_TOAST_I18N',
);

export const MLV_TOAST_I18N_CONTEXT: Record<
  keyof MlvToastI18n,
  MlvTranslationContext
> = {
  dismiss: {
    component: 'mlv-toast-item',
    usage: 'aria-label',
    description: 'Dismiss/close the toast notification',
  },
};
