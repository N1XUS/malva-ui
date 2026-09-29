import { computed, inject, type Signal } from '@angular/core';
import { MLV_VIEW_VARIANT_I18N } from '@malva-ui/i18n';
import type { MlvViewVariantI18n } from '@malva-ui/i18n';

/**
 * @private English fallbacks for the `viewVariant` slice, used when there is no
 * `provideMlvI18n()`, or the active pack omits the slice or a key. Every key of
 * the slice is optional, so `Required<>` makes a new key fail to compile
 * without one. The strings are the English pack's and the old literals'.
 */
const OPTIONAL_MESSAGE_FALLBACKS: Readonly<Required<MlvViewVariantI18n>> = {
  searchViews: 'Search views',
  newView: 'New view',
  newTeamView: 'New team view',
  newPersonalView: 'New personal view',
  retry: 'Retry',
  dismiss: 'Dismiss',
  systemViews: 'System',
  teamViews: 'Team',
  personalViews: 'My views',
  readOnly: 'Read-only',
  moreActions: 'More actions for {name}',
  variantActions: 'Actions for {name}',
  rename: 'Rename',
  share: 'Share',
  delete: 'Delete',
  noMatches: 'No views match your search.',
  duplicateView: 'Duplicate view',
  resetChanges: 'Reset changes',
  updateView: 'Update view',
  saveAsNew: 'Save as new',
  reset: 'Reset',
  readOnlySystemView: 'This system view is read-only',
  duplicateToSave: 'Duplicate it to save your changes',
  unsavedChanges: 'You have unsaved view changes',
  unsavedView: 'This is an unsaved view',
};

/**
 * @internal Injects the view-variant messages: the active pack's `viewVariant`
 * slice with every missing key filled from the English fallbacks. The token is
 * injected optionally, so both components also work, in English, with no i18n
 * provider. Must run in an injection context (a field initializer).
 */
export function injectViewVariantMessages(): Signal<
  Required<MlvViewVariantI18n>
> {
  const i18n = inject(MLV_VIEW_VARIANT_I18N, { optional: true });
  return computed(() => {
    const slice = i18n?.() ?? {};
    const messages = { ...OPTIONAL_MESSAGE_FALLBACKS };
    for (const key of Object.keys(messages) as (keyof MlvViewVariantI18n)[]) {
      const value = slice[key];
      if (value !== undefined) messages[key] = value;
    }
    return messages;
  });
}
