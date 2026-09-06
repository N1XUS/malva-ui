import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvCalendarI18n {
  /** aria-label for the previous period navigation button. */
  previousPeriod: string;
  /** aria-label for the next period navigation button. */
  nextPeriod: string;
  /**
   * aria-label for the header button that switches view mode.
   * ICU select on the target view:
   * "Switch to {view, select, year {year} multiYear {multi-year} other {month}} view".
   */
  switchView: string;
  /** aria-label for the year view grid. ICU: "Select month for {year}". */
  selectMonthForYear: string;
  /** Visible label of the mobile sheet's confirm action. */
  done: string;
  /** aria-label for the mobile sheet's horizontal year strip. */
  selectYear: string;
  /** aria-label for the mobile sheet's scrolling month list. */
  monthList: string;
}

export const MLV_CALENDAR_I18N = new InjectionToken<Signal<MlvCalendarI18n>>(
  'MLV_CALENDAR_I18N',
);

export const MLV_CALENDAR_I18N_CONTEXT: Record<
  keyof MlvCalendarI18n,
  MlvTranslationContext
> = {
  previousPeriod: {
    component: 'mlv-calendar',
    usage: 'aria-label',
    description: 'Navigate to previous month/year',
  },
  nextPeriod: {
    component: 'mlv-calendar',
    usage: 'aria-label',
    description: 'Navigate to next month/year',
  },
  switchView: {
    component: 'mlv-calendar',
    usage: 'aria-label',
    icuParams: ['view'],
    description:
      'Header button that cycles between month, year and multi-year views',
  },
  selectMonthForYear: {
    component: 'mlv-calendar',
    usage: 'aria-label',
    icuParams: ['year'],
    description: 'Year view grid label, e.g. "Select month for 2026"',
  },
  done: {
    component: 'mlv-calendar-sheet',
    usage: 'button-text',
    description:
      'Confirms the pending selection and closes the full-screen calendar sheet',
  },
  selectYear: {
    component: 'mlv-calendar-sheet',
    usage: 'aria-label',
    description: 'Horizontal year strip above the scrolling month list',
  },
  monthList: {
    component: 'mlv-calendar-sheet',
    usage: 'aria-label',
    description: 'Scrolling list of consecutive months in the calendar sheet',
  },
};
