import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvPaginationI18n {
  /** aria-label for the pagination navigation landmark. */
  navigationLabel: string;
  /** aria-label for the previous page button. */
  previousPage: string;
  /** aria-label for the next page button. */
  nextPage: string;
  /** aria-label for a numbered page button. ICU: "Page {page}". */
  page: string;
  /** aria-label for the "jump to page" number input. */
  goToPage: string;
  /** Suffix after item count, e.g. "items". */
  items: string;
  /** Range display. ICU: "{start}–{end} of {total}". */
  itemRange: string;
  /** Item count with plural. ICU: "{count, plural, one {# item} other {# items}}". */
  itemCount: string;
  /** Per-page selector. ICU: "{count} items per page". */
  itemsPerPage: string;
  /** "All" option. ICU: "All ({total})". */
  allItems: string;
}

export const MLV_PAGINATION_I18N = new InjectionToken<
  Signal<MlvPaginationI18n>
>('MLV_PAGINATION_I18N');

export const MLV_PAGINATION_I18N_CONTEXT: Record<
  keyof MlvPaginationI18n,
  MlvTranslationContext
> = {
  navigationLabel: {
    component: 'mlv-pagination',
    usage: 'aria-label',
    maxLength: 20,
    description: 'Landmark label for the pagination navigation region',
  },
  previousPage: {
    component: 'mlv-pagination',
    usage: 'aria-label',
    description: 'Navigate to previous page of results',
  },
  nextPage: {
    component: 'mlv-pagination',
    usage: 'aria-label',
    description: 'Navigate to next page of results',
  },
  page: {
    component: 'mlv-pagination',
    usage: 'aria-label',
    icuParams: ['page'],
    description: 'Accessible label for a numbered page button',
  },
  goToPage: {
    component: 'mlv-pagination',
    usage: 'aria-label',
    maxLength: 20,
    description: 'Label for the input that jumps to a specific page number',
  },
  items: {
    component: 'mlv-pagination',
    usage: 'label',
    maxLength: 20,
    description: 'Noun "items" as suffix after count',
  },
  itemRange: {
    component: 'mlv-pagination',
    usage: 'label',
    icuParams: ['start', 'end', 'total'],
    description: 'Shows visible range, e.g. "1-10 of 50"',
  },
  itemCount: {
    component: 'mlv-pagination',
    usage: 'label',
    icuParams: ['count'],
    description: 'Total item count with plural form',
  },
  itemsPerPage: {
    component: 'mlv-pagination',
    usage: 'label',
    icuParams: ['count'],
    description: 'Dropdown option: how many items shown per page',
  },
  allItems: {
    component: 'mlv-pagination',
    usage: 'label',
    icuParams: ['total'],
    description: '"Show all" option with total count in parentheses',
  },
};
