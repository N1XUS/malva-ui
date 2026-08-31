import { InjectionToken } from '@angular/core';
import type { MlvSwitch } from './switch/switch';

export interface MlvSwitchGroupAccessor {
  onChildFocus(sw: MlvSwitch): void;
}

export const SWITCH_GROUP = new InjectionToken<MlvSwitchGroupAccessor>(
  'SWITCH_GROUP',
);
