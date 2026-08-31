import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvDateRangePickerI18n {
  /** aria-label for the date range popup trigger. */
  selectDateRange: string;
  /** aria-label for the start month calendar. */
  startMonth: string;
  /** aria-label for the end month calendar. */
  endMonth: string;
  /** aria-label for the clear button. */
  clearDateRange: string;
  /** aria-label for the apply button. */
  applyDateRange: string;
  /** Default placeholder text. */
  placeholder: string;
}

export const MLV_DATE_RANGE_PICKER_I18N = new InjectionToken<
  Signal<MlvDateRangePickerI18n>
>('MLV_DATE_RANGE_PICKER_I18N');

export const MLV_DATE_RANGE_PICKER_I18N_CONTEXT: Record<
  keyof MlvDateRangePickerI18n,
  MlvTranslationContext
> = {
  selectDateRange: {
    component: 'mlv-date-range-picker',
    usage: 'aria-label',
    description: 'Opens the date range selection panel',
  },
  startMonth: {
    component: 'mlv-date-range-picker',
    usage: 'aria-label',
    description: 'Left calendar panel for range start',
  },
  endMonth: {
    component: 'mlv-date-range-picker',
    usage: 'aria-label',
    description: 'Right calendar panel for range end',
  },
  clearDateRange: {
    component: 'mlv-date-range-picker',
    usage: 'aria-label',
    description: 'Clear the selected date range',
  },
  applyDateRange: {
    component: 'mlv-date-range-picker',
    usage: 'aria-label',
    description: 'Confirm and apply the selected date range',
  },
  placeholder: {
    component: 'mlv-date-range-picker',
    usage: 'placeholder',
    description: 'Placeholder shown when no range is selected',
  },
};
