import { assertBoolean, assertDeepEqual } from './binding-assertions';

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
 *
 * **Runner-agnostic.** The returned promise rejects with an
 * `AssertionError`-shaped error on the first failed expectation, which every
 * test runner reports as a failing test — this helper imports no runner of its
 * own, so it works under Vitest, Jest, Jasmine/Karma and Web Test Runner alike.
 * Under Vitest the error carries `actual` / `expected` / `showDiff`, so the
 * reporter prints the same expected/received diff a failed `expect` produced;
 * every other runner reads both values off the message, which carries them too.
 * See `./binding-assertions` for why it is written this way (#243).
 *
 * @param options The mode adapter, the sample value and the interactions that
 *   drive one binding mode's run.
 */
export async function verifyFormsBinding<T>(
  options: MlvFormsBindingMatrixOptions<T>,
): Promise<void> {
  const { adapter } = options;
  const label = `[${adapter.mode}]`;

  // form → control → form round trip
  await adapter.setValue(options.sample);
  assertDeepEqual(
    adapter.getValue(),
    options.sample,
    `${label} form-side write round-trip`,
  );

  // user interaction → form side
  await options.interact();
  assertDeepEqual(
    adapter.getValue(),
    options.expectedAfterInteraction,
    `${label} user interaction result`,
  );

  // blur → touched
  if (options.blur) {
    assertBoolean(adapter.isTouched(), false, `${label} untouched before blur`);
    await options.blur();
    assertBoolean(adapter.isTouched(), true, `${label} touched after blur`);
  }

  // disabled propagation
  if (adapter.setDisabled && adapter.isDisabled) {
    await adapter.setDisabled(true);
    assertBoolean(adapter.isDisabled(), true, `${label} disabled propagated`);
    await adapter.setDisabled(false);
    assertBoolean(adapter.isDisabled(), false, `${label} re-enabled`);
  }
}
