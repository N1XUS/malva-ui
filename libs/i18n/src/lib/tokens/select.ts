import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvSelectI18n {
  /** Default placeholder text. */
  placeholder: string;
  /** Placeholder of the in-dropdown search field (`searchable`). */
  searchPlaceholder: string;
  /** Empty-state row when a search yields no options. */
  noResults: string;
  /** Loading affordance text (dropdown spinner row and the field's loading variant). */
  loading: string;
  /** Polite live-region result count, ICU: `{count, plural, one {# result available} other {# results available}}`. */
  resultsAvailable: string;
}

export const MLV_SELECT_I18N = new InjectionToken<Signal<MlvSelectI18n>>(
  'MLV_SELECT_I18N',
);

export const MLV_SELECT_I18N_CONTEXT: Record<
  keyof MlvSelectI18n,
  MlvTranslationContext
> = {
  placeholder: {
    component: 'mlv-select',
    usage: 'placeholder',
    description: 'Placeholder when no option is selected',
  },
  searchPlaceholder: {
    component: 'mlv-select',
    usage: 'placeholder',
    description: 'Placeholder of the in-dropdown search field (searchable)',
  },
  noResults: {
    component: 'mlv-select',
    usage: 'message',
    description: 'Empty-state row shown when a search yields no options',
  },
  loading: {
    component: 'mlv-select',
    usage: 'message',
    description:
      "Loading affordance text shown in the dropdown spinner row and the field's loading variant",
  },
  resultsAvailable: {
    component: 'mlv-select',
    usage: 'live-announcement',
    icuParams: ['count'],
    pluralCategories: ['one', 'other'],
    description:
      'Polite screen-reader announcement of the number of results available after a search',
  },
};
