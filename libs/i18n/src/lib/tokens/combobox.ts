import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvComboboxI18n {
  /** Default placeholder for the search input. */
  searchPlaceholder: string;
  /** Accessible label for the dropdown toggle (chevron) button. */
  toggleOptions: string;
  /** Empty-state row when a search yields no options. */
  noResults: string;
  /** Free-entry affordance row, ICU: `Press Enter to add "{query}"` — keep the `{query}` placeholder and quotes. */
  pressEnterToAdd: string;
  /** Loading affordance text (dropdown spinner row and the field's loading variant). */
  loading: string;
  /** Polite live-region result count, ICU: `{count, plural, one {# result available} other {# results available}}`. */
  resultsAvailable: string;
}

export const MLV_COMBOBOX_I18N = new InjectionToken<Signal<MlvComboboxI18n>>(
  'MLV_COMBOBOX_I18N',
);

export const MLV_COMBOBOX_I18N_CONTEXT: Record<
  keyof MlvComboboxI18n,
  MlvTranslationContext
> = {
  searchPlaceholder: {
    component: 'mlv-combobox',
    usage: 'placeholder',
    description: 'Placeholder text in the combobox search input',
  },
  toggleOptions: {
    component: 'mlv-combobox',
    usage: 'aria-label',
    description: 'Accessible label for the dropdown toggle (chevron) button',
  },
  noResults: {
    component: 'mlv-combobox',
    usage: 'message',
    description: 'Empty-state row shown when a search yields no options',
  },
  pressEnterToAdd: {
    component: 'mlv-combobox',
    usage: 'message',
    icuParams: ['query'],
    description:
      'Free-entry affordance row prompting the user to press Enter to add their typed query as a new option. Keep the {query} placeholder and the surrounding quote marks.',
  },
  loading: {
    component: 'mlv-combobox',
    usage: 'message',
    description:
      "Loading affordance text shown in the dropdown spinner row and the field's loading variant",
  },
  resultsAvailable: {
    component: 'mlv-combobox',
    usage: 'live-announcement',
    icuParams: ['count'],
    pluralCategories: ['one', 'other'],
    description:
      'Polite screen-reader announcement of the number of results available after a search',
  },
};
