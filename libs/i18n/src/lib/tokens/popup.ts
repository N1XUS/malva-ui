import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvPopupI18n {
  /** aria-label for the fullscreen (mobile) popup's close button. */
  close: string;
}

export const MLV_POPUP_I18N = new InjectionToken<Signal<MlvPopupI18n>>(
  'MLV_POPUP_I18N',
);

export const MLV_POPUP_I18N_CONTEXT: Record<
  keyof MlvPopupI18n,
  MlvTranslationContext
> = {
  close: {
    component: 'mlv-popup',
    usage: 'aria-label',
    description:
      'Accessible name for the close button shown in the mobile fullscreen popup header',
  },
};
