import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvTabsI18n {
  /** aria-label for the overflow "more tabs" dropdown trigger. */
  moreTabs: string;
}

export const MLV_TABS_I18N = new InjectionToken<Signal<MlvTabsI18n>>(
  'MLV_TABS_I18N',
);

export const MLV_TABS_I18N_CONTEXT: Record<
  keyof MlvTabsI18n,
  MlvTranslationContext
> = {
  moreTabs: {
    component: 'mlv-tabs',
    usage: 'aria-label',
    description: 'Trigger that shows hidden overflow tabs',
  },
};
