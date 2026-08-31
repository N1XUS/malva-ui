import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

/** Translatable strings used by `mlv-search-field`. */
export interface MlvSearchFieldI18n {
  /** Default input placeholder. */
  placeholder: string;
  /** Accessible label for the search input. */
  search: string;
  /** Accessible label for the submit-search action. */
  submit: string;
  /** Accessible label for the clear-search action. */
  clear: string;
  /** Accessible label for the action that closes the search overlay. */
  closeOverlay: string;
}

/** Reactive translations for `mlv-search-field`. */
export const MLV_SEARCH_FIELD_I18N = new InjectionToken<
  Signal<MlvSearchFieldI18n>
>('MLV_SEARCH_FIELD_I18N');

/** Translation context supplied to AI and tooling. */
export const MLV_SEARCH_FIELD_I18N_CONTEXT: Record<
  keyof MlvSearchFieldI18n,
  MlvTranslationContext
> = {
  placeholder: {
    component: 'mlv-search-field',
    usage: 'placeholder',
    description: 'Placeholder shown in an empty search field',
  },
  search: {
    component: 'mlv-search-field',
    usage: 'aria-label',
    description: 'Accessible label for the search input',
  },
  submit: {
    component: 'mlv-search-field',
    usage: 'aria-label',
    description: 'Accessible label for submitting a search',
  },
  clear: {
    component: 'mlv-search-field',
    usage: 'aria-label',
    description: 'Accessible label for clearing a search',
  },
  closeOverlay: {
    component: 'mlv-search-field',
    usage: 'button-text',
    description:
      'Label for the button that dismisses the full-screen search overlay',
  },
};
