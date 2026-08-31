import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvTimePickerI18n {
  /** aria-label for the AM/PM period column. */
  period: string;
  /** Default aria-label for the time picker component. */
  timePicker: string;
}

export const MLV_TIME_PICKER_I18N = new InjectionToken<
  Signal<MlvTimePickerI18n>
>('MLV_TIME_PICKER_I18N');

export const MLV_TIME_PICKER_I18N_CONTEXT: Record<
  keyof MlvTimePickerI18n,
  MlvTranslationContext
> = {
  period: {
    component: 'mlv-time-picker',
    usage: 'aria-label',
    description: 'AM/PM selector column label',
  },
  timePicker: {
    component: 'mlv-time-picker',
    usage: 'aria-label',
    description: 'Accessible name for the time picker widget',
  },
};
