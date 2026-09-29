import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

/**
 * Messages of `mlv-view-variant-list` and `mlv-view-variant-status`.
 *
 * The slice is optional on `MlvLanguage`, and so is every key in it, so a
 * hand-written or older pack still type-checks; both components fall back to
 * English for anything missing. Every shipped pack declares the slice.
 */
export interface MlvViewVariantI18n {
  /** Placeholder and accessible name of the list's search field. */
  searchViews?: string;
  /** Create button text when the list offers one creation scope. */
  newView?: string;
  /** Create button text for the `team` scope when the list offers several. */
  newTeamView?: string;
  /** Create button text for the `personal` scope when the list offers several. */
  newPersonalView?: string;
  /** Button text: retry the failed request (list and status). */
  retry?: string;
  /** Button text: dismiss the error (list and status). */
  dismiss?: string;
  /** Heading of the system-owned group, unless `groupLabels` is bound. */
  systemViews?: string;
  /** Heading of the team-owned group, unless `groupLabels` is bound. */
  teamViews?: string;
  /** Heading of the personally owned group, unless `groupLabels` is bound. */
  personalViews?: string;
  /** Visually hidden marker after a locked view's name. */
  readOnly?: string;
  /** aria-label of a view's overflow menu button. ICU `{name}` (the view name). */
  moreActions?: string;
  /** Accessible name of a view's overflow menu. ICU `{name}`. */
  variantActions?: string;
  /** Overflow menu item: rename the view. */
  rename?: string;
  /** Overflow menu item: share the view. */
  share?: string;
  /** Overflow menu item: delete the view. */
  delete?: string;
  /** Empty state when the search matches no view. */
  noMatches?: string;
  /** Status button: duplicate the active view. */
  duplicateView?: string;
  /** Status button: discard changes to a saved view. */
  resetChanges?: string;
  /** Status button: overwrite the active view with the working state. */
  updateView?: string;
  /** Status button: save the working state as a new view. */
  saveAsNew?: string;
  /** Status button: discard an unsaved working view. */
  reset?: string;
  /** Status sentence for an unchanged locked view. */
  readOnlySystemView?: string;
  /** Status sentence for a changed locked view. */
  duplicateToSave?: string;
  /** Status sentence for a changed editable view. */
  unsavedChanges?: string;
  /** Status sentence when no saved view is active. */
  unsavedView?: string;
}

/**
 * Messages of the view-variant components. `provideMlvI18n()` resolves it to
 * the active pack's `viewVariant` slice, or to an empty object when the pack
 * has none. Both components inject it optionally, so they also work — in
 * English — with no i18n provider at all.
 */
export const MLV_VIEW_VARIANT_I18N = new InjectionToken<
  Signal<MlvViewVariantI18n>
>('MLV_VIEW_VARIANT_I18N');

/** @private Shorthand for the list's contexts. */
const list = 'mlv-view-variant-list';

/** @private Shorthand for the status band's contexts. */
const status = 'mlv-view-variant-status';

export const MLV_VIEW_VARIANT_I18N_CONTEXT: Record<
  keyof MlvViewVariantI18n,
  MlvTranslationContext
> = {
  searchViews: {
    component: list,
    usage: 'placeholder',
    description:
      'Placeholder and accessible name of the field that filters saved views by name',
  },
  newView: {
    component: list,
    usage: 'button-text',
    description: 'Button that asks the application to create a new saved view',
  },
  newTeamView: {
    component: list,
    usage: 'button-text',
    description:
      'Button that asks the application to create a new saved view shared with the team',
  },
  newPersonalView: {
    component: list,
    usage: 'button-text',
    description:
      'Button that asks the application to create a new saved view only the user sees',
  },
  retry: {
    component: list,
    usage: 'button-text',
    description:
      'Button that asks the application to retry a failed saved-view request',
  },
  dismiss: {
    component: list,
    usage: 'button-text',
    description: 'Button that hides a saved-view error message',
  },
  systemViews: {
    component: list,
    usage: 'label',
    description:
      'Heading of the group of built-in saved views provided by the application',
  },
  teamViews: {
    component: list,
    usage: 'label',
    description: 'Heading of the group of saved views shared with the team',
  },
  personalViews: {
    component: list,
    usage: 'label',
    description: 'Heading of the group of saved views that belong to the user',
  },
  readOnly: {
    component: list,
    usage: 'label',
    description:
      'Screen-reader-only marker read after the name of a saved view that cannot be edited',
  },
  moreActions: {
    component: list,
    usage: 'aria-label',
    icuParams: ['name'],
    description:
      'Icon button that opens the menu of actions for one saved view. `{name}` is the view name and must be preserved in the translation.',
  },
  variantActions: {
    component: list,
    usage: 'aria-label',
    icuParams: ['name'],
    description:
      'Accessible name of the menu of actions for one saved view. `{name}` is the view name and must be preserved in the translation.',
  },
  rename: {
    component: list,
    usage: 'button-text',
    description: 'Menu item that renames a saved view',
  },
  share: {
    component: list,
    usage: 'button-text',
    description: 'Menu item that shares a saved view',
  },
  delete: {
    component: list,
    usage: 'button-text',
    description: 'Menu item that deletes a saved view',
  },
  noMatches: {
    component: list,
    usage: 'message',
    description: 'Text shown when the search matches no saved view',
  },
  duplicateView: {
    component: status,
    usage: 'button-text',
    description: 'Button that saves a copy of the active saved view',
  },
  resetChanges: {
    component: status,
    usage: 'button-text',
    description:
      'Button that discards unsaved changes and restores the saved view',
  },
  updateView: {
    component: status,
    usage: 'button-text',
    description:
      'Button that overwrites the active saved view with the current changes',
  },
  saveAsNew: {
    component: status,
    usage: 'button-text',
    description: 'Button that saves the current state as a new saved view',
  },
  reset: {
    component: status,
    usage: 'button-text',
    description:
      'Button that discards the current unsaved view and restores the default',
  },
  readOnlySystemView: {
    component: status,
    usage: 'message',
    description:
      'Explains that the active built-in saved view cannot be edited',
  },
  duplicateToSave: {
    component: status,
    usage: 'message',
    description:
      'Tells the user that changes to a built-in saved view can only be kept by duplicating it',
  },
  unsavedChanges: {
    component: status,
    usage: 'message',
    description:
      'Tells the user that the active saved view has unsaved changes',
  },
  unsavedView: {
    component: status,
    usage: 'message',
    description:
      'Tells the user that the current view has not been saved under a name',
  },
};
