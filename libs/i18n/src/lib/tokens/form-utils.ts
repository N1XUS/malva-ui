import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvFormUtilsI18n {
  /** aria-label for the clear button in form controls. */
  clear: string;
  /** Visually-hidden word announced after the label of a required control. */
  required: string;
  /** Generic validation message used when no specific message exists for a validator. */
  invalidValue: string;
}

export const MLV_FORM_UTILS_I18N = new InjectionToken<Signal<MlvFormUtilsI18n>>(
  'MLV_FORM_UTILS_I18N',
);

export const MLV_FORM_UTILS_I18N_CONTEXT: Record<
  keyof MlvFormUtilsI18n,
  MlvTranslationContext
> = {
  clear: {
    component: 'mlv-form-control-wrapper',
    usage: 'aria-label',
    description: 'Clear the current form control value',
  },
  required: {
    component: 'mlv-label',
    usage: 'label',
    description:
      'Visually-hidden word rendered next to the asterisk marker of a required field label, e.g. "required". Lowercase, no punctuation.',
  },
  invalidValue: {
    component: 'mlv-form-field',
    usage: 'message',
    description:
      'Generic validation message shown when a validator has no dedicated message, e.g. "This value is invalid".',
  },
};
