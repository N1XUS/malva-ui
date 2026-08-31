import { InjectionToken } from '@angular/core';
import type { MlvStepperOrientation } from './stepper.types';

/** Interface exposed by the stepper container to child step components. */
export interface MlvStepperAccessor {
  /** Current active step index (0-based). */
  readonly activeIndex: () => number;
  /** Orientation of the stepper layout. */
  readonly orientation: () => MlvStepperOrientation;
  /** Called by a step when the user clicks on its header to navigate. */
  selectStep(index: number): void;
}

/** Injection token for `MlvStepper` → `MlvStep` communication. */
export const MLV_STEPPER = new InjectionToken<MlvStepperAccessor>(
  'MLV_STEPPER',
);
