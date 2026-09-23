import type { Signal } from '@angular/core';
import { InjectionToken } from '@angular/core';
import type { MlvRadio } from './radio/radio';

export interface MlvRadioGroupAccessor {
  selectRadio(radio: MlvRadio): void;
  onChildFocus(radio: MlvRadio): void;
  /**
   * Whether the whole group is disabled. Each radio disables its own native
   * input with it, so a disabled group leaves the tab order and ignores
   * Space — not only the mouse, which CSS alone was blocking.
   */
  readonly computedDisabled: Signal<boolean>;
  /**
   * Whether a user interaction may change the selection right now — `false`
   * while the group is readonly or disabled. A radio cancels its native click
   * when this is `false`, so the browser never checks it behind the model.
   */
  canSelect(): boolean;
}

export const RADIO_GROUP = new InjectionToken<MlvRadioGroupAccessor>(
  'RADIO_GROUP',
);
