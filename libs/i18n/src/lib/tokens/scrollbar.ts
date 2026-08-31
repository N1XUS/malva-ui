import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvScrollbarI18n {
  /** Default aria-label for the scrollable region. */
  scrollableRegion: string;
}

export const MLV_SCROLLBAR_I18N = new InjectionToken<Signal<MlvScrollbarI18n>>(
  'MLV_SCROLLBAR_I18N',
);

export const MLV_SCROLLBAR_I18N_CONTEXT: Record<
  keyof MlvScrollbarI18n,
  MlvTranslationContext
> = {
  scrollableRegion: {
    component: 'mlv-scrollbar',
    usage: 'aria-label',
    description: 'Label for custom-scrollbar container',
  },
};
