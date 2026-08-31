import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvPinInputI18n {
  /** Per-cell aria-label. ICU: "Digit {position} of {length}". */
  digit: string;
  /** Fallback aria-label for the group when no `label` is set. */
  pinEntry: string;
}

export const MLV_PIN_INPUT_I18N = new InjectionToken<Signal<MlvPinInputI18n>>(
  'MLV_PIN_INPUT_I18N',
);

export const MLV_PIN_INPUT_I18N_CONTEXT: Record<
  keyof MlvPinInputI18n,
  MlvTranslationContext
> = {
  digit: {
    component: 'mlv-pin-input',
    usage: 'aria-label',
    icuParams: ['position', 'length'],
    description: 'Single PIN/OTP cell, e.g. "Digit 2 of 6"',
  },
  pinEntry: {
    component: 'mlv-pin-input',
    usage: 'aria-label',
    description: 'Group label for the PIN / OTP entry row',
  },
};
