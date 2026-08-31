import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvTokenizerI18n {
  /** aria-label for the add token button. */
  addToken: string;
  /** aria-label for the list of selected tokens, used when no `label` is set. */
  selectedItems: string;
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
};
