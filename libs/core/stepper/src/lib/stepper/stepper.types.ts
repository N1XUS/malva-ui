/**
 * Indicator state of a single step — what its indicator, label and connector
 * look like. Derived from the stepper's `activeIndex` unless the step sets
 * `state` explicitly. Never decides selection: `'active'` is the look of the
 * selected step, and an explicit `'active'` on another step only borrows it.
 */
export type MlvStepState = 'pending' | 'active' | 'completed' | 'error';

/** MlvLayout orientation of the stepper. */
export type MlvStepperOrientation = 'horizontal' | 'vertical';
