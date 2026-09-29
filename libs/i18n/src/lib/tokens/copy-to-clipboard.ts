import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvCopyToClipboardI18n {
  /** Default aria-label for the copy button. */
  copyToClipboard: string;
  /**
   * Polite live-region announcement after a successful copy, unless
   * `copiedAriaLabel` is bound.
   *
   * Optional so a hand-written or older pack still type-checks;
   * `mlv-copy-to-clipboard` falls back to English when it is missing. Every
   * shipped pack declares it.
   */
  copied?: string;
  /**
   * Tooltip on the copy indicator while idle.
   *
   * Optional, with an English fallback in `mlv-copy-to-clipboard`.
   */
  copyTooltip?: string;
  /**
   * Tooltip on the copy indicator while the "copied" state shows.
   *
   * Optional, with an English fallback in `mlv-copy-to-clipboard`.
   */
  copiedTooltip?: string;
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
  copied: {
    component: 'mlv-copy-to-clipboard',
    usage: 'live-announcement',
    description:
      'Screen-reader announcement confirming that the text was copied to the clipboard',
  },
  copyTooltip: {
    component: 'mlv-copy-to-clipboard',
    usage: 'label',
    description: 'Short tooltip on the copy icon: the action it performs',
  },
  copiedTooltip: {
    component: 'mlv-copy-to-clipboard',
    usage: 'label',
    description:
      'Short tooltip on the copy icon right after a successful copy (past participle)',
  },
};
