import { InjectionToken } from '@angular/core';
import type { MlvRadio } from './radio/radio';

export interface MlvRadioGroupAccessor {
  selectRadio(radio: MlvRadio): void;
  onChildFocus(radio: MlvRadio): void;
}

export const RADIO_GROUP = new InjectionToken<MlvRadioGroupAccessor>(
  'RADIO_GROUP',
);
