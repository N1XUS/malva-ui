import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvDataTableI18n {
  /** Button text: add a new row. */
  addRow: string;
  /** aria-label for add row button. */
  addNewRow: string;
  /** Button text: column visibility toggle. */
  columns: string;
  /** aria-label for column visibility toggle. */
  toggleColumnVisibility: string;
  /** Button text: filter toggle. */
  filters: string;
  /** aria-label for filter toggle. */
  toggleFilters: string;
  /** Placeholder for the global table search field. */
  searchPlaceholder: string;
  /** Accessible label for the global table search field. */
  searchLabel: string;
  /** Accessible label for a column filter trigger. ICU: "Filter {column}". */
  filterColumn: string;
  /** Accessible label for an active column filter trigger. ICU: "Filter {column}, active". */
  filterColumnActive: string;
  /** Summary of active filters. ICU plural with `count`. */
  activeFilterCount: string;
  /** aria-label for select-all checkbox. */
  selectAllRows: string;
  /** aria-label for save changes button. */
  saveChanges: string;
  /** aria-label for cancel editing button. */
  cancelEditing: string;
  /** aria-label for edit row button. */
  editRow: string;
  /** Button text: unpin column. */
  unpin: string;
  /** aria-label for close filters button. */
  closeFilters: string;
  /** Button text: clear all filters. */
  clearAll: string;
  /** Button text: apply filters. */
  apply: string;
  /** Placeholder for filter input. ICU: "Filter by {column}". */
  filterByColumn: string;
  /** aria-label for a sortable column header. ICU: "Sort by {column}". */
  sortByColumn: string;
  /** Button text: open the generic row sort menu. */
  sort: string;
  /** aria-label for the generic row sort menu. */
  sortMenu: string;
  /** Button text: apply ascending sort direction. */
  ascending: string;
  /** Button text: apply descending sort direction. */
  descending: string;
  /** Button text: clear the active sort. */
  clearSort: string;
  /** aria-label for a column resize separator. ICU: "Resize {column} column". */
  resizeColumn: string;
  /** Accessible separator value text. ICU: "{width} pixels". */
  columnWidthPixels: string;
  /** aria-label for expanding a tree row. */
  expandRow: string;
  /** aria-label for collapsing a tree row. */
  collapseRow: string;
  /** aria-label for pinning a column. */
  pinColumn: string;
  /** aria-label for changing a pinned column's side. */
  changePinSide: string;
  /** aria-label for unpinning a column. */
  unpinColumn: string;
  /** Heading of the table error state. */
  errorTitle: string;
  /** Default description of the table error state. */
  errorMessage: string;
  /** Button text: retry the failed request. */
  retry: string;
}

export const MLV_DATA_TABLE_I18N = new InjectionToken<Signal<MlvDataTableI18n>>(
  'MLV_DATA_TABLE_I18N',
);

export const MLV_DATA_TABLE_I18N_CONTEXT: Record<
  keyof MlvDataTableI18n,
  MlvTranslationContext
> = {
  addRow: {
    component: 'mlv-data-table',
    usage: 'button-text',
    description: 'Button to add a new table row',
  },
  addNewRow: {
    component: 'mlv-data-table',
    usage: 'aria-label',
    description: 'Accessible label for add row button',
  },
  columns: {
    component: 'mlv-data-table',
    usage: 'button-text',
    description: 'Button to toggle column visibility panel',
  },
  toggleColumnVisibility: {
    component: 'mlv-data-table',
    usage: 'aria-label',
    description: 'Accessible label for column visibility toggle',
  },
  filters: {
    component: 'mlv-data-table',
    usage: 'button-text',
    description: 'Button to toggle filter panel',
  },
  toggleFilters: {
    component: 'mlv-data-table',
    usage: 'aria-label',
    description: 'Accessible label for filter toggle',
  },
  searchPlaceholder: {
    component: 'mlv-data-table',
    usage: 'placeholder',
    description: 'Placeholder for the global table search field',
  },
  searchLabel: {
    component: 'mlv-data-table',
    usage: 'aria-label',
    description: 'Accessible label for the global table search field',
  },
  filterColumn: {
    component: 'mlv-data-table',
    usage: 'aria-label',
    icuParams: ['column'],
    description: 'Accessible label for a column filter trigger',
  },
  filterColumnActive: {
    component: 'mlv-data-table',
    usage: 'aria-label',
    icuParams: ['column'],
    description:
      'Accessible label for a column filter trigger with an applied filter',
  },
  activeFilterCount: {
    component: 'mlv-data-table',
    usage: 'message',
    icuParams: ['count'],
    pluralCategories: ['one', 'other'],
    description: 'Summary of active table filters',
  },
  selectAllRows: {
    component: 'mlv-data-table',
    usage: 'aria-label',
    description: 'Checkbox to select/deselect all table rows',
  },
  saveChanges: {
    component: 'mlv-data-table',
    usage: 'aria-label',
    description: 'Save pending inline edits',
  },
  cancelEditing: {
    component: 'mlv-data-table',
    usage: 'aria-label',
    description: 'Discard pending inline edits',
  },
  editRow: {
    component: 'mlv-data-table',
    usage: 'aria-label',
    description: 'Enter edit mode for a table row',
  },
  unpin: {
    component: 'mlv-data-table',
    usage: 'button-text',
    description: 'Unpin a pinned column',
  },
  closeFilters: {
    component: 'mlv-data-table',
    usage: 'aria-label',
    description: 'Close the filter dropdown panel',
  },
  clearAll: {
    component: 'mlv-data-table',
    usage: 'button-text',
    description: 'Clear all active filters',
  },
  apply: {
    component: 'mlv-data-table',
    usage: 'button-text',
    description: 'Apply selected filters',
  },
  filterByColumn: {
    component: 'mlv-data-table',
    usage: 'placeholder',
    icuParams: ['column'],
    description: 'Placeholder in per-column filter input',
  },
  sortByColumn: {
    component: 'mlv-data-table',
    usage: 'aria-label',
    icuParams: ['column'],
    description: 'Accessible label for a sortable column header button',
  },
  sort: {
    component: 'mlv-data-table',
    usage: 'button-text',
    description: 'Button that opens the generic row sort menu',
  },
  sortMenu: {
    component: 'mlv-data-table',
    usage: 'aria-label',
    description: 'Accessible label for the generic row sort menu',
  },
  ascending: {
    component: 'mlv-data-table',
    usage: 'button-text',
    description: 'Menu action that applies ascending sort direction',
  },
  descending: {
    component: 'mlv-data-table',
    usage: 'button-text',
    description: 'Menu action that applies descending sort direction',
  },
  clearSort: {
    component: 'mlv-data-table',
    usage: 'button-text',
    description: 'Menu action that clears the active sort',
  },
  resizeColumn: {
    component: 'mlv-data-table',
    usage: 'aria-label',
    icuParams: ['column'],
    description: 'Accessible label for a column resize separator',
  },
  columnWidthPixels: {
    component: 'mlv-data-table',
    usage: 'aria-valuetext',
    icuParams: ['width'],
    description: 'Column resize separator value with an explicit pixel unit',
  },
  expandRow: {
    component: 'mlv-data-table',
    usage: 'aria-label',
    description: 'Expand a hierarchical table row',
  },
  collapseRow: {
    component: 'mlv-data-table',
    usage: 'aria-label',
    description: 'Collapse a hierarchical table row',
  },
  pinColumn: {
    component: 'mlv-data-table',
    usage: 'aria-label',
    description: 'Pin a table column',
  },
  changePinSide: {
    component: 'mlv-data-table',
    usage: 'aria-label',
    description: 'Change the side of a pinned table column',
  },
  unpinColumn: {
    component: 'mlv-data-table',
    usage: 'aria-label',
    description: 'Unpin a table column',
  },
  errorTitle: {
    component: 'mlv-data-table',
    usage: 'message',
    description: 'Heading shown when the table data failed to load',
  },
  errorMessage: {
    component: 'mlv-data-table',
    usage: 'message',
    description:
      'Default description shown when the table data failed to load and no custom message was supplied',
  },
  retry: {
    component: 'mlv-data-table',
    usage: 'button-text',
    description: 'Button that asks the application to retry the failed request',
  },
};
