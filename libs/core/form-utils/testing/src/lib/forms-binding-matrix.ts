import { expect } from 'vitest';

/**
 * One binding mode's view of the form side while running the bindings matrix.
 * Concrete adapters are built by the control's spec for each of the three
 * binding modes (reactive `[formControl]`, template-driven `ngModel`, signal
 * forms `[formField]`), so the shared {@link verifyFormsBinding} assertions
 * stay identical across modes and across controls.
 */
export interface MlvFormsBindingAdapter<T> {
  /** Mode label used in assertion messages. */
  readonly mode: 'reactive' | 'template-driven' | 'signal-forms';

  /** Writes a value from the FORM side into the control. */
  setValue(value: T): void | Promise<void>;

  /** Reads the form side's current value. */
  getValue(): T;

  /** Whether the form side considers the control touched. */
  isTouched(): boolean;

  /** Disables from the form side. Omit when the mode cannot express it. */
  setDisabled?(disabled: boolean): void | Promise<void>;

  /** Whether the COMPONENT reports disabled (e.g. `computedDisabled()`). */
  isDisabled?(): boolean;
}

/**
 * Options for one {@link verifyFormsBinding} run.
 */
export interface MlvFormsBindingMatrixOptions<T> {
  /** The mode adapter under test. */
  adapter: MlvFormsBindingAdapter<T>;

  /** Value written from the form side; must round-trip unchanged. */
  sample: T;

  /**
   * Simulates a USER interaction on the rendered control that must surface on
   * the form side as {@link expectedAfterInteraction}.
   */
  interact: () => void | Promise<void>;

  /** Form-side value expected after {@link interact}. */
  expectedAfterInteraction: T;

  /** Simulates the user leaving the field; drives the touched assertion. */
  blur?: () => void | Promise<void>;
}

/**
 * Shared assertion driver for the forms bindings matrix: form→control value
 * write, control→form user interaction, touched propagation on blur, and
 * disabled propagation — identical expectations for every binding mode. A
 * control's spec calls this once per mode; a migrated control (CVA →
 * FormValueControl) must keep all three runs green.
 */
export async function verifyFormsBinding<T>(
  options: MlvFormsBindingMatrixOptions<T>,
): Promise<void> {
  const { adapter } = options;
  const label = `[${adapter.mode}]`;

  // form → control → form round trip
  await adapter.setValue(options.sample);
  expect(adapter.getValue(), `${label} form-side write round-trip`).toEqual(
    options.sample,
  );

  // user interaction → form side
  await options.interact();
  expect(adapter.getValue(), `${label} user interaction result`).toEqual(
    options.expectedAfterInteraction,
  );

  // blur → touched
  if (options.blur) {
    expect(adapter.isTouched(), `${label} untouched before blur`).toBe(false);
    await options.blur();
    expect(adapter.isTouched(), `${label} touched after blur`).toBe(true);
  }

  // disabled propagation
  if (adapter.setDisabled && adapter.isDisabled) {
    await adapter.setDisabled(true);
    expect(adapter.isDisabled(), `${label} disabled propagated`).toBe(true);
    await adapter.setDisabled(false);
    expect(adapter.isDisabled(), `${label} re-enabled`).toBe(false);
  }
}
