import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvStepperI18n {
  /** Tag text for optional steps. */
  optional: string;
}

export const MLV_STEPPER_I18N = new InjectionToken<Signal<MlvStepperI18n>>(
  'MLV_STEPPER_I18N',
);

export const MLV_STEPPER_I18N_CONTEXT: Record<
  keyof MlvStepperI18n,
  MlvTranslationContext
> = {
  optional: {
    component: 'mlv-stepper',
    usage: 'label',
    description: 'Tag shown on steps that are not required',
  },
};
