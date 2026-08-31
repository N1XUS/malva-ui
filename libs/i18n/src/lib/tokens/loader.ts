import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvLoaderI18n {
  /** Default aria-label for the loading indicator. */
  loading: string;
}

export const MLV_LOADER_I18N = new InjectionToken<Signal<MlvLoaderI18n>>(
  'MLV_LOADER_I18N',
);

export const MLV_LOADER_I18N_CONTEXT: Record<
  keyof MlvLoaderI18n,
  MlvTranslationContext
> = {
  loading: {
    component: 'mlv-loader',
    usage: 'aria-label',
    description: 'Accessible label for loading spinner/bar',
  },
};
