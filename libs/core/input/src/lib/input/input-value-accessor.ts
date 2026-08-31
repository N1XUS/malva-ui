import type { Signal } from '@angular/core';
import { InjectionToken } from '@angular/core';

/**
 * @internal Minimal host contract consumed by input-attached behavior
 * directives without importing the concrete input component.
 */
export interface MlvInputValueAccessor {
  readonly value: Signal<string>;
}

/** @internal Injection token for the active input value signal. */
export const MLV_INPUT_VALUE = new InjectionToken<MlvInputValueAccessor>(
  'MLV_INPUT_VALUE',
);
