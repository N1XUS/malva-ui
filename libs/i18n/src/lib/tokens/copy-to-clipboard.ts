import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvCopyToClipboardI18n {
  /** Default aria-label for the copy button. */
  copyToClipboard: string;
}

export const MLV_COPY_TO_CLIPBOARD_I18N = new InjectionToken<
  Signal<MlvCopyToClipboardI18n>
>('MLV_COPY_TO_CLIPBOARD_I18N');

export const MLV_COPY_TO_CLIPBOARD_I18N_CONTEXT: Record<
  keyof MlvCopyToClipboardI18n,
  MlvTranslationContext
> = {
  copyToClipboard: {
    component: 'mlv-copy-to-clipboard',
    usage: 'aria-label',
    description: 'Action to copy text to clipboard',
  },
};
