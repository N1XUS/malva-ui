import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

/**
 * Messages of the `[mlvAutocomplete]` directive.
 *
 * The slice is optional on `MlvLanguage`, and so is every key in it, so a
 * hand-written or older pack still type-checks; `[mlvAutocomplete]` falls back
 * to English for anything missing. Every shipped pack declares the slice, worded
 * as that pack words `mlv-combobox`.
 */
export interface MlvAutocompleteI18n {
  /** Empty-state row, and its announcement, when a query matches no suggestion. */
  noResults?: string;
  /** Loading affordance text of the panel's spinner rows, unless `mlvAutocompleteLoadingText` is bound. */
  loading?: string;
  /** Polite result-count announcement, ICU: `{count, plural, one {# result available} other {# results available}}`. */
  resultsAvailable?: string;
}

/**
 * Messages of `[mlvAutocomplete]`. `provideMlvI18n()` resolves it to the active
 * pack's `autocomplete` slice, or to an empty object when the pack has none.
 * The directive injects it optionally, so it also works — in English — with no
 * i18n provider at all.
 */
export const MLV_AUTOCOMPLETE_I18N = new InjectionToken<
  Signal<MlvAutocompleteI18n>
>('MLV_AUTOCOMPLETE_I18N');

export const MLV_AUTOCOMPLETE_I18N_CONTEXT: Record<
  keyof MlvAutocompleteI18n,
  MlvTranslationContext
> = {
  noResults: {
    component: 'mlv-autocomplete',
    usage: 'message',
    description:
      'Empty-state row shown, and announced, when a query matches no suggestion',
  },
  loading: {
    component: 'mlv-autocomplete',
    usage: 'message',
    description:
      'Loading affordance text shown while an async search or a further page resolves',
  },
  resultsAvailable: {
    component: 'mlv-autocomplete',
    usage: 'live-announcement',
    icuParams: ['count'],
    pluralCategories: ['one', 'other'],
    description:
      'Polite screen-reader announcement of the number of suggestions a query produced',
  },
};
