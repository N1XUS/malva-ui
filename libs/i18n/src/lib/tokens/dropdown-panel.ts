import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

/**
 * Messages of `mlv-dropdown-panel`, used when its owner passes none.
 *
 * `mlv-select`, `mlv-combobox` and `[mlvAutocomplete]` hand the panel their own
 * `loading` text; this slice is the default for a panel used on its own. The
 * slice is optional on `MlvLanguage`, and so is its key, so a hand-written or
 * older pack still type-checks; the panel falls back to English when it is
 * missing. Every shipped pack declares it.
 */
export interface MlvDropdownPanelI18n {
  /** Default text of the loading and loading-more rows, when `loadingText` is not bound. */
  loading?: string;
}

/**
 * Messages of `mlv-dropdown-panel`. `provideMlvI18n()` resolves it to the
 * active pack's `dropdownPanel` slice, or to an empty object when the pack has
 * none. The panel injects it optionally, so it also works — in English — with
 * no i18n provider at all.
 */
export const MLV_DROPDOWN_PANEL_I18N = new InjectionToken<
  Signal<MlvDropdownPanelI18n>
>('MLV_DROPDOWN_PANEL_I18N');

export const MLV_DROPDOWN_PANEL_I18N_CONTEXT: Record<
  keyof MlvDropdownPanelI18n,
  MlvTranslationContext
> = {
  loading: {
    component: 'mlv-dropdown-panel',
    usage: 'message',
    description:
      'Default loading affordance text of the dropdown panel spinner rows',
  },
};
