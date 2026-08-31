import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvDrawerI18n {
  /** Fallback accessible name for the drawer dialog when no header/label is set. */
  drawer: string;
}

export const MLV_DRAWER_I18N = new InjectionToken<Signal<MlvDrawerI18n>>(
  'MLV_DRAWER_I18N',
);

export const MLV_DRAWER_I18N_CONTEXT: Record<
  keyof MlvDrawerI18n,
  MlvTranslationContext
> = {
  drawer: {
    component: 'mlv-drawer',
    usage: 'aria-label',
    description: 'Fallback accessible name for the drawer dialog surface',
  },
};
