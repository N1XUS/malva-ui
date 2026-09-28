import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvDateRangePickerI18n {
  /** aria-label for the date range popup trigger. */
  selectDateRange: string;
  /** aria-label for the start month calendar. */
  startMonth: string;
  /** aria-label for the end month calendar. */
  endMonth: string;
  /**
   * aria-label for the footer clear button. Must contain {@link clear}, the
   * button's visible text (WCAG 2.5.3, Label in Name).
   */
  clearDateRange: string;
  /**
   * aria-label for the footer apply button. Must contain {@link apply}, the
   * button's visible text (WCAG 2.5.3, Label in Name).
   */
  applyDateRange: string;
  /** Default placeholder text. */
  placeholder: string;
  /**
   * Visible text of the footer clear button; {@link clearDateRange} names it
   * and must contain this text.
   *
   * Optional so a hand-written or older pack still type-checks;
   * `mlv-date-range-picker` falls back to English when it is missing. Every
   * shipped pack declares it.
   */
  clear?: string;
  /**
   * Visible text of the footer apply button; {@link applyDateRange} names it
   * and must contain this text.
   *
   * Optional so a hand-written or older pack still type-checks;
   * `mlv-date-range-picker` falls back to English when it is missing. Every
   * shipped pack declares it.
   */
  apply?: string;
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
  clear: {
    component: 'mlv-date-range-picker',
    usage: 'button-text',
    description:
      'Visible text of the clear button; the clearDateRange label must contain it',
  },
  apply: {
    component: 'mlv-date-range-picker',
    usage: 'button-text',
    description:
      'Visible text of the apply button; the applyDateRange label must contain it',
  },
};
