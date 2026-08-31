import type { Provider } from '@angular/core';
import { InjectionToken } from '@angular/core';

export interface MlvUiAnimationDefaults {
  enterDuration?: string;
  leaveDuration?: string;
}

export const UI_ANIMATION_DEFAULTS = new InjectionToken<MlvUiAnimationDefaults>(
  'UI_ANIMATION_DEFAULTS',
);

export function provideUiAnimationDefaults(
  defaults: MlvUiAnimationDefaults,
): Provider {
  return { provide: UI_ANIMATION_DEFAULTS, useValue: defaults };
}
