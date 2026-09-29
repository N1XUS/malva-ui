import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

/**
 * Messages of `mlv-tree`.
 *
 * The slice is optional on `MlvLanguage`, and so is every key in it, so a
 * hand-written or older pack still type-checks; `mlv-tree` falls back to
 * English for anything missing. Every shipped pack declares the slice.
 */
export interface MlvTreeI18n {
  /** aria-label of a collapsed node's toggle. ICU `{label}` (the node label). */
  expandNode?: string;
  /** aria-label of an expanded node's toggle. ICU `{label}` (the node label). */
  collapseNode?: string;
  /** aria-label of the spinner shown while a node's lazy children load. */
  loadingChildren?: string;
  /** aria-label of a node's checkbox in `selectMode="multi"`. ICU `{label}`. */
  selectNode?: string;
}

/**
 * Messages of `mlv-tree`. `provideMlvI18n()` resolves it to the active pack's
 * `tree` slice, or to an empty object when the pack has none. The tree injects
 * it optionally, so its names stay English with no i18n provider.
 */
export const MLV_TREE_I18N = new InjectionToken<Signal<MlvTreeI18n>>(
  'MLV_TREE_I18N',
);

export const MLV_TREE_I18N_CONTEXT: Record<
  keyof MlvTreeI18n,
  MlvTranslationContext
> = {
  expandNode: {
    component: 'mlv-tree',
    usage: 'aria-label',
    icuParams: ['label'],
    description:
      'Button that expands a tree node to show its children. `{label}` is the node label and must be preserved in the translation.',
  },
  collapseNode: {
    component: 'mlv-tree',
    usage: 'aria-label',
    icuParams: ['label'],
    description:
      'Button that collapses a tree node to hide its children. `{label}` is the node label and must be preserved in the translation.',
  },
  loadingChildren: {
    component: 'mlv-tree',
    usage: 'aria-label',
    description:
      'Accessible name of the spinner shown while the children of a tree node load',
  },
  selectNode: {
    component: 'mlv-tree',
    usage: 'aria-label',
    icuParams: ['label'],
    description:
      'Checkbox that selects a tree node. `{label}` is the node label and must be preserved in the translation.',
  },
};
