import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvBottomNavI18n {
  /** Fallback aria-label for the bottom navigation landmark. */
  navigation: string;
  /** aria-label for the overflow "More" trigger button. */
  moreOptions: string;
  /** Visible label under the overflow "More" trigger. */
  more: string;
  /** Accessible label for the overflow menu panel. */
  moreMenu: string;
}

export const MLV_BOTTOM_NAV_I18N = new InjectionToken<Signal<MlvBottomNavI18n>>(
  'MLV_BOTTOM_NAV_I18N',
);

export const MLV_BOTTOM_NAV_I18N_CONTEXT: Record<
  keyof MlvBottomNavI18n,
  MlvTranslationContext
> = {
  navigation: {
    component: 'mlv-bottom-nav',
    usage: 'aria-label',
    description: 'Landmark label for the bottom navigation bar',
  },
  moreOptions: {
    component: 'mlv-bottom-nav',
    usage: 'aria-label',
    description: 'Trigger button that reveals overflowed navigation items',
  },
  more: {
    component: 'mlv-bottom-nav',
    usage: 'button-text',
    maxLength: 12,
    description: 'Visible short label on the overflow trigger',
  },
  moreMenu: {
    component: 'mlv-bottom-nav',
    usage: 'label',
    description: 'Accessible label for the overflow menu of hidden items',
  },
};
