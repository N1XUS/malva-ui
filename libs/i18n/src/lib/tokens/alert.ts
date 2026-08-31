import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvAlertI18n {
  /** aria-label for the dismiss button. */
  dismiss: string;
}

export const MLV_ALERT_I18N = new InjectionToken<Signal<MlvAlertI18n>>(
  'MLV_ALERT_I18N',
);

export const MLV_ALERT_I18N_CONTEXT: Record<
  keyof MlvAlertI18n,
  MlvTranslationContext
> = {
  dismiss: {
    component: 'mlv-alert',
    usage: 'aria-label',
    description: 'Dismiss/close the alert banner',
  },
};
