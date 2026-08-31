import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvChipI18n {
  /** aria-label for the chip remove/close button. */
  remove: string;
}

export const MLV_CHIP_I18N = new InjectionToken<Signal<MlvChipI18n>>(
  'MLV_CHIP_I18N',
);

export const MLV_CHIP_I18N_CONTEXT: Record<
  keyof MlvChipI18n,
  MlvTranslationContext
> = {
  remove: {
    component: 'mlv-chip',
    usage: 'aria-label',
    description: 'Remove this chip/tag',
  },
};
