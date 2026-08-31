import { InjectionToken, type Signal } from '@angular/core';
import type { MlvTranslationContext } from '../types';

export interface MlvDialogI18n {
  /** aria-label for the close button. */
  closeDialog: string;
  /** Default label for the confirming action of `MlvDialogService.confirm()`. */
  confirm: string;
  /** Default label for the dismissing action of `MlvDialogService.confirm()`. */
  cancel: string;
}

export const MLV_DIALOG_I18N = new InjectionToken<Signal<MlvDialogI18n>>(
  'MLV_DIALOG_I18N',
);

export const MLV_DIALOG_I18N_CONTEXT: Record<
  keyof MlvDialogI18n,
  MlvTranslationContext
> = {
  closeDialog: {
    component: 'mlv-dialog',
    usage: 'aria-label',
    description: 'Close the modal dialog',
  },
  confirm: {
    component: 'mlv-dialog',
    usage: 'button-text',
    description:
      'Default label of the button that confirms a confirmation dialog',
  },
  cancel: {
    component: 'mlv-dialog',
    usage: 'button-text',
    description:
      'Default label of the button that dismisses a confirmation dialog without confirming',
  },
};
