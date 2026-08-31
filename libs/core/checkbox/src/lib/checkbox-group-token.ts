import { InjectionToken } from '@angular/core';
import type { MlvCheckbox } from './checkbox/checkbox';

export interface MlvCheckboxGroupAccessor {
  onChildFocus(checkbox: MlvCheckbox): void;
}

export const CHECKBOX_GROUP = new InjectionToken<MlvCheckboxGroupAccessor>(
  'CHECKBOX_GROUP',
);
