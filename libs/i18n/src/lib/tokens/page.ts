import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvPageI18n {
  /** Accessible name of the `mlv-page-summary` key-facts group. */
  pageSummary: string;
  /** aria-label of the header control that re-expands collapsed chrome. */
  expandHeader: string;
}

export const MLV_PAGE_I18N = new InjectionToken<Signal<MlvPageI18n>>(
  'MLV_PAGE_I18N',
);

export const MLV_PAGE_I18N_CONTEXT: Record<
  keyof MlvPageI18n,
  MlvTranslationContext
> = {
  pageSummary: {
    component: 'mlv-page-summary',
    usage: 'aria-label',
    description:
      'Names the strip of key facts rendered directly under the page header',
  },
  expandHeader: {
    component: 'mlv-page-header',
    usage: 'aria-label',
    description:
      'Button that re-expands the collapsed page header and scrolls back to the top',
  },
};
