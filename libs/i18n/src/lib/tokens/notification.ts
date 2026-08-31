import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvNotificationI18n {
  /** aria-label for the dismiss button. */
  dismiss: string;
}

export const MLV_NOTIFICATION_I18N = new InjectionToken<
  Signal<MlvNotificationI18n>
>('MLV_NOTIFICATION_I18N');

export const MLV_NOTIFICATION_I18N_CONTEXT: Record<
  keyof MlvNotificationI18n,
  MlvTranslationContext
> = {
  dismiss: {
    component: 'mlv-notification-item',
    usage: 'aria-label',
    description: 'Dismiss/close the notification',
  },
};
