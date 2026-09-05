import { TestBed } from '@angular/core/testing';
import { ApplicationInitStatus } from '@angular/core';
import { provideMlvI18n } from './provide-i18n';
import { MlvI18nService } from './i18n.service';
import { MLV_DIALOG_I18N } from './tokens/dialog';
import { MLV_DATA_TABLE_I18N } from './tokens/data-table';
import { MLV_TASKBOARD_I18N } from './tokens/taskboard';
import type { MlvLanguage } from './types';

const mockEn: MlvLanguage = {
  alert: { dismiss: 'Dismiss alert' },
  breadcrumb: { hiddenItems: 'Hidden breadcrumb items' },
  calendar: { previousPeriod: 'Previous period', nextPeriod: 'Next period' },
  chip: { remove: 'Remove' },
  colorPicker: {
    hue: 'Hue',
    opacity: 'Opacity',
    colorInputMode: 'Color input mode',
    hexColorValue: 'Hex color value',
    redChannel: 'Red channel',
    greenChannel: 'Green channel',
    blueChannel: 'Blue channel',
    alphaChannel: 'Alpha channel',
    hslHue: 'Hue',
    hslSaturation: 'Saturation',
    hslLightness: 'Lightness',
    hslAlpha: 'Alpha',
    colorPicker: 'Color picker',
  },
  combobox: { searchPlaceholder: 'Search...' },
  copyToClipboard: { copyToClipboard: 'Copy to clipboard' },
  dataTable: {
    addRow: 'Add row',
    addNewRow: 'Add new row',
    columns: 'Columns',
    toggleColumnVisibility: 'Toggle column visibility',
    filters: 'Filters',
    toggleFilters: 'Toggle filters',
    searchPlaceholder: 'Search rows...',
    searchLabel: 'Search rows',
    filterColumn: 'Filter {column}',
    filterColumnActive: 'Filter {column}, active',
    activeFilterCount: '{count} filters active',
    selectAllRows: 'Select all rows',
    saveChanges: 'Save changes',
    cancelEditing: 'Cancel editing',
    editRow: 'Edit row',
    unpin: 'Unpin',
    closeFilters: 'Close filters',
    clearAll: 'Clear all',
    apply: 'Apply',
    filterByColumn: 'Filter by {column}',
    sortByColumn: 'Sort by {column}',
    sort: 'Sort',
    sortMenu: 'Sort rows',
    ascending: 'Ascending',
    descending: 'Descending',
    clearSort: 'Clear sort',
    resizeColumn: 'Resize {column} column',
    columnWidthPixels: '{width} pixels',
    expandRow: 'Expand row',
    collapseRow: 'Collapse row',
    pinColumn: 'Pin column',
    changePinSide: 'Change pin side',
    unpinColumn: 'Unpin column',
  },
  dateRangePicker: {
    selectDateRange: 'Select date range',
    startMonth: 'Start month',
    endMonth: 'End month',
    clearDateRange: 'Clear date range',
    applyDateRange: 'Apply date range',
    placeholder: 'Select date range...',
  },
  dayPicker: { placeholder: 'Select date...' },
  dialog: { closeDialog: 'Close dialog' },
  fileUpload: {
    selectedFiles: 'Selected files',
    uploadComplete: 'Upload complete',
    uploadFailed: 'Upload failed',
    removeFile: 'Remove file',
  },
  filter: {
    filters: 'Filters ({count})',
    openFilter: 'Filter by {label}',
    clearFilter: 'Clear {label} filter',
    moreValues: '+ {count} more',
    apply: 'Apply',
    clear: 'Clear',
    go: 'Go',
    refresh: 'Refresh',
    showFilters: 'Show filters',
    hideFilters: 'Hide filters',
    manageFilters: 'Manage filters',
    availableFilters: 'Available filters ({count})',
    searchAvailableFilters: 'Search available filters...',
    addFilter: 'Add filter',
    removeFilter: 'Remove {label} filter',
    clearAll: 'Clear all',
    noFiltersAvailable: 'No filters available',
    requiredFilter: '{label} is required.',
    requiredFilters:
      '{count, plural, one {Complete the required filter before running the query.} other {Complete all # required filters before running the query.}}',
    required: 'Required',
    active: 'Active',
    reset: 'Reset',
    cancel: 'Cancel',
    addCondition: 'Add condition',
    removeCondition: 'Remove condition',
    valuePlaceholder: 'Value',
    selectValue: 'Select value...',
    contains: 'Contains',
    notContains: 'Does not contain',
    startsWith: 'Starts with',
    endsWith: 'Ends with',
    equals: 'Equals',
    notEquals: 'Does not equal',
    greaterThan: 'Greater than',
    greaterThanOrEqual: 'Greater than or equal to',
    lessThan: 'Less than',
    lessThanOrEqual: 'Less than or equal to',
    between: 'Between',
    in: 'Is one of',
    notIn: 'Is not one of',
    empty: 'Is empty',
    notEmpty: 'Is not empty',
    and: 'AND',
    or: 'OR',
  },
  formUtils: { clear: 'Clear' },
  loader: { loading: 'Loading' },
  notification: { dismiss: 'Dismiss' },
  pagination: {
    previousPage: 'Previous page',
    nextPage: 'Next page',
    items: 'items',
    itemRange: '{start}\u2013{end} of {total}',
    itemCount: '{count, plural, one {# item} other {# items}}',
    itemsPerPage: '{count} items per page',
    allItems: 'All ({total})',
  },
  progress: { progress: 'Progress' },
  scrollbar: { scrollableRegion: 'Scrollable region' },
  searchField: {
    placeholder: 'Search...',
    search: 'Search',
    submit: 'Submit search',
    clear: 'Clear search',
    closeOverlay: 'Close search',
  },
  select: { placeholder: 'Select...' },
  stepper: { optional: 'Optional' },
  tabs: { moreTabs: 'More tabs' },
  taskboard: {
    boardLabel: 'Taskboard',
    addCard: 'Add card',
    emptyCell: 'No cards',
    cardLabel: 'Task {label}',
    laneName: 'Lane {lane}',
    keyboardInstructions:
      'Press Space to pick up a card, the arrow keys to choose a slot, Space again to drop it, and Escape to cancel.',
    grabbed:
      'Grabbed {label}. Use the arrow keys to choose a slot, Space to drop, Escape to cancel.',
    targetValid: 'Move to {column}, position {position} of {count}. {lane}',
    targetInvalid: 'Cannot move to {column}: {reason}. {lane}',
    moved: 'Moved {label} to {column}, position {position}. {lane}',
    moveRejected: '{label} was not moved: {reason}.',
    moveCancelled: 'Cancelled moving {label}.',
    releasedInPlace: '{label} was left in place.',
    wipState: '{count} of {limit}',
    selectionCount:
      '{count, plural, =0 {No cards selected} one {# card selected} other {# cards selected}}',
    reasonInvalidDrop: 'that slot is not a valid target',
    reasonCancelled: 'the move was cancelled',
    reasonBeforeMoveRejected: 'the application rejected the move',
    reasonBeforeMoveError: 'the application could not complete the move',
    reasonStale: 'the board changed while the move was pending',
    reasonLocked: 'the card, its column, or its lane is locked',
    reasonTransition: 'that column transition is not allowed',
    reasonWip: 'the work-in-progress limit is reached',
    reasonPolicy: 'the board does not allow that target',
  },
  tile: {
    close: 'Close',
    tileLabel: 'tile',
    moveTile: 'Move {label}',
    keyboardInstructions:
      'Use Alt+ArrowUp and Alt+ArrowDown to reorder tiles. Use Alt+ArrowLeft to move a tile out one level. Use Alt+ArrowRight to move a tile into the previous eligible container.',
    movedUp: 'Moved {label} up.',
    movedDown: 'Moved {label} down.',
    movedOut: 'Moved {label} out one level.',
    movedInto: 'Moved {label} into the previous eligible container.',
    moveRejected: '{label} cannot move in that direction.',
  },
  timePicker: { period: 'Period', timePicker: 'Time picker' },
  toast: { dismiss: 'Dismiss' },
  tokenizer: { addToken: 'Add token', selectedItems: 'Selected items' },
};

describe('provideMlvI18n', () => {
  it('should provide MlvI18nService and component tokens', async () => {
    TestBed.configureTestingModule({
      providers: [provideMlvI18n(async () => ({ default: mockEn }))],
    });

    await TestBed.inject(ApplicationInitStatus).donePromise;

    const service = TestBed.inject(MlvI18nService);
    expect(service).toBeTruthy();

    const dialog = TestBed.inject(MLV_DIALOG_I18N);
    expect(dialog().closeDialog).toBe('Close dialog');

    const dataTable = TestBed.inject(MLV_DATA_TABLE_I18N);
    expect(dataTable()).toMatchObject({
      sort: 'Sort',
      sortMenu: 'Sort rows',
      ascending: 'Ascending',
      descending: 'Descending',
      clearSort: 'Clear sort',
    });
  });

  it('should resolve every taskboard feedback slice the board announces', async () => {
    TestBed.configureTestingModule({
      providers: [provideMlvI18n(async () => ({ default: mockEn }))],
    });

    await TestBed.inject(ApplicationInitStatus).donePromise;

    const taskboard = TestBed.inject(MLV_TASKBOARD_I18N);

    // Keyboard instructions and the built-in affordances.
    expect(taskboard()).toMatchObject({
      boardLabel: 'Taskboard',
      addCard: 'Add card',
      emptyCell: 'No cards',
      keyboardInstructions:
        'Press Space to pick up a card, the arrow keys to choose a slot, Space again to drop it, and Escape to cancel.',
    });

    // Drop validity — the accepted and refused keyboard targets.
    expect(taskboard()).toMatchObject({
      targetValid: 'Move to {column}, position {position} of {count}. {lane}',
      targetInvalid: 'Cannot move to {column}: {reason}. {lane}',
    });

    // Move, cancellation, and the no-op release.
    expect(taskboard()).toMatchObject({
      grabbed:
        'Grabbed {label}. Use the arrow keys to choose a slot, Space to drop, Escape to cancel.',
      moved: 'Moved {label} to {column}, position {position}. {lane}',
      moveRejected: '{label} was not moved: {reason}.',
      moveCancelled: 'Cancelled moving {label}.',
      releasedInPlace: '{label} was left in place.',
    });

    // WIP readout, the swimlane qualifier, and the selection announcement.
    expect(taskboard()).toMatchObject({
      wipState: '{count} of {limit}',
      laneName: 'Lane {lane}',
      selectionCount:
        '{count, plural, =0 {No cards selected} one {# card selected} other {# cards selected}}',
    });

    // Every restriction reason the board can name in a refusal.
    expect(taskboard()).toMatchObject({
      reasonInvalidDrop: 'that slot is not a valid target',
      reasonCancelled: 'the move was cancelled',
      reasonBeforeMoveRejected: 'the application rejected the move',
      reasonBeforeMoveError: 'the application could not complete the move',
      reasonStale: 'the board changed while the move was pending',
      reasonLocked: 'the card, its column, or its lane is locked',
      reasonTransition: 'that column transition is not allowed',
      reasonWip: 'the work-in-progress limit is reached',
      reasonPolicy: 'the board does not allow that target',
    });
  });
});
