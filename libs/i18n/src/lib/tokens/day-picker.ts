import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvDayPickerI18n {
  /** Default placeholder text. */
  placeholder: string;
  /** Title of the full-screen mobile calendar sheet. */
  selectDay: string;
}

export const MLV_DAY_PICKER_I18N = new InjectionToken<Signal<MlvDayPickerI18n>>(
  'MLV_DAY_PICKER_I18N',
);

export const MLV_DAY_PICKER_I18N_CONTEXT: Record<
  keyof MlvDayPickerI18n,
  MlvTranslationContext
> = {
  placeholder: {
    component: 'mlv-day-picker',
    usage: 'placeholder',
    description: 'Placeholder shown when no date is selected',
  },
  selectDay: {
    component: 'mlv-day-picker',
    usage: 'label',
    description: 'Header title of the full-screen mobile calendar sheet',
  },
};
