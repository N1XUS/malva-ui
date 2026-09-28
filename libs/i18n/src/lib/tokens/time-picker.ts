import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvTimePickerI18n {
  /** aria-label for the AM/PM period column. */
  period: string;
  /**
   * Trigger text while the value is empty.
   *
   * Optional so a hand-written or older pack still type-checks;
   * `mlv-time-picker` falls back to English when it is missing. Every shipped
   * pack declares it.
   */
  placeholder?: string;
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
  placeholder: {
    component: 'mlv-time-picker',
    usage: 'placeholder',
    description: 'Trigger text shown when no time is selected',
  },
  timePicker: {
    component: 'mlv-time-picker',
    usage: 'aria-label',
    description: 'Accessible name for the time picker widget',
  },
};
