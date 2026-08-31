import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

/** Translatable strings shared by filters and the smart filter bar. */
export interface MlvFilterI18n {
  filters: string;
  openFilter: string;
  clearFilter: string;
  moreValues: string;
  apply: string;
  clear: string;
  go: string;
  refresh: string;
  showFilters: string;
  hideFilters: string;
  manageFilters: string;
  availableFilters: string;
  searchAvailableFilters: string;
  addFilter: string;
  removeFilter: string;
  clearAll: string;
  noFiltersAvailable: string;
  requiredFilter: string;
  requiredFilters: string;
  required: string;
  active: string;
  reset: string;
  cancel: string;
  addCondition: string;
  removeCondition: string;
  valuePlaceholder: string;
  selectValue: string;
  contains: string;
  notContains: string;
  startsWith: string;
  endsWith: string;
  equals: string;
  notEquals: string;
  greaterThan: string;
  greaterThanOrEqual: string;
  lessThan: string;
  lessThanOrEqual: string;
  between: string;
  in: string;
  notIn: string;
  empty: string;
  notEmpty: string;
  and: string;
  or: string;
}

/** Reactive translations for filter components. */
export const MLV_FILTER_I18N = new InjectionToken<Signal<MlvFilterI18n>>(
  'MLV_FILTER_I18N',
);

const context = (
  usage: MlvTranslationContext['usage'],
  description: string,
  icuParams?: string[],
): MlvTranslationContext => ({
  component: 'mlv-filter',
  usage,
  description,
  ...(icuParams ? { icuParams } : {}),
});

/** Translation context supplied to AI and tooling. */
export const MLV_FILTER_I18N_CONTEXT: Record<
  keyof MlvFilterI18n,
  MlvTranslationContext
> = {
  filters: context('button-text', 'Filter-management button with count', [
    'count',
  ]),
  openFilter: context('aria-label', 'Open one field filter', ['label']),
  clearFilter: context('aria-label', 'Clear one field filter', ['label']),
  moreValues: context('label', 'Summary of additional selected values', [
    'count',
  ]),
  apply: context('button-text', 'Apply pending filter changes'),
  clear: context('button-text', 'Clear a filter value'),
  go: context('button-text', 'Execute smart-filter-bar query'),
  refresh: context('aria-label', 'Refresh smart-filter-bar results'),
  showFilters: context('button-text', 'Show filter fields'),
  hideFilters: context('button-text', 'Hide filter fields'),
  manageFilters: context('aria-label', 'Choose visible filters'),
  availableFilters: context('label', 'Available-filter list heading', [
    'count',
  ]),
  searchAvailableFilters: context(
    'placeholder',
    'Search the available-filter list',
  ),
  addFilter: context('button-text', 'Open the query Add filter menu'),
  removeFilter: context('aria-label', 'Remove a query filter', ['label']),
  clearAll: context('button-text', 'Clear every query filter'),
  noFiltersAvailable: context('message', 'No eligible query filters remain'),
  requiredFilter: context('message', 'Incomplete required filter', ['label']),
  requiredFilters: context(
    'message',
    'Summary shown when required filters block query execution',
    ['count'],
  ),
  required: context('label', 'Required field status in filter manager'),
  active: context('label', 'Active field status in filter manager'),
  reset: context('button-text', 'Reset filter visibility and values'),
  cancel: context('button-text', 'Cancel pending filter changes'),
  addCondition: context('button-text', 'Add another condition to a field'),
  removeCondition: context('aria-label', 'Remove a field condition'),
  valuePlaceholder: context('placeholder', 'Filter condition value'),
  selectValue: context('placeholder', 'Select a filter value'),
  contains: context('label', 'Contains filter operator'),
  notContains: context('label', 'Does-not-contain filter operator'),
  startsWith: context('label', 'Starts-with filter operator'),
  endsWith: context('label', 'Ends-with filter operator'),
  equals: context('label', 'Equals filter operator'),
  notEquals: context('label', 'Does-not-equal filter operator'),
  greaterThan: context('label', 'Greater-than filter operator'),
  greaterThanOrEqual: context('label', 'Greater-than-or-equal filter operator'),
  lessThan: context('label', 'Less-than filter operator'),
  lessThanOrEqual: context('label', 'Less-than-or-equal filter operator'),
  between: context('label', 'Between filter operator'),
  in: context('label', 'Is-one-of filter operator'),
  notIn: context('label', 'Is-not-one-of filter operator'),
  empty: context('label', 'Is-empty filter operator'),
  notEmpty: context('label', 'Is-not-empty filter operator'),
  and: context('label', 'Conjunction for multiple filter conditions'),
  or: context('label', 'Disjunction for multiple filter conditions'),
};
