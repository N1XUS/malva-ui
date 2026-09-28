import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvTokenizerI18n {
  /** aria-label for the add token button. */
  addToken: string;
  /** aria-label for the list of selected tokens, used when no `label` is set. */
  selectedItems: string;
  /**
   * Counter of the tokens hidden by `maxVisible`, ICU:
   * `{count, plural, one {+{count} more} other {+{count} more}}`. `{count}`
   * rather than `#` keeps the count unformatted, as the English literal it
   * replaces rendered it.
   *
   * Optional so a hand-written or older pack still type-checks;
   * `mlv-tokenizer` falls back to English when it is missing. Every shipped
   * pack declares it.
   */
  moreItems?: string;
}

export const MLV_TOKENIZER_I18N = new InjectionToken<Signal<MlvTokenizerI18n>>(
  'MLV_TOKENIZER_I18N',
);

export const MLV_TOKENIZER_I18N_CONTEXT: Record<
  keyof MlvTokenizerI18n,
  MlvTranslationContext
> = {
  addToken: {
    component: 'mlv-tokenizer',
    usage: 'aria-label',
    description: 'Button to add a new token/tag',
  },
  selectedItems: {
    component: 'mlv-tokenizer',
    usage: 'aria-label',
    description: 'Label for the list of selected tokens/tags',
  },
  moreItems: {
    component: 'mlv-tokenizer',
    usage: 'label',
    icuParams: ['count'],
    pluralCategories: ['one', 'other'],
    description:
      'Counter of the tokens hidden beyond maxVisible, e.g. "+2 more"',
  },
};
