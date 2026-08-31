// libs/cdk/testing-e2e/src/kit/index.ts
import { test } from '../fixtures/test';
import type { MlvComponentManifest } from './applicability';
import { registerStatesTests } from './states.kit';
import { registerMouseTests } from './mouse.kit';

export * from './applicability';

/**
 * Register a component spec. Always installs the kit-generated `states` and
 * `mouse` blocks (or explicit skip markers), then invokes the optional
 * `bespoke` callback for the hand-written category tests.
 */
export function defineComponentSpec(
  m: MlvComponentManifest,
  bespoke?: () => void,
): void {
  test.describe(`${m.label} [${m.route}]`, () => {
    if (m.applies.states) registerStatesTests(m);
    else
      test.skip(`states — skipped (${m.skipReasons?.states ?? 'not applicable'})`, () => {
        // not applicable — intentionally empty
      });

    if (m.applies.mouse) registerMouseTests(m);
    else
      test.skip(`mouse — skipped (${m.skipReasons?.mouse ?? 'not applicable'})`, () => {
        // not applicable — intentionally empty
      });

    if (!m.applies.keyboard)
      test.skip(`keyboard — skipped (${m.skipReasons?.keyboard ?? 'not applicable'})`, () => {
        // not applicable — intentionally empty
      });
    if (!m.applies.innerKeyboard)
      test.skip(`innerKeyboard — skipped (${m.skipReasons?.innerKeyboard ?? 'not applicable'})`, () => {
        // not applicable — intentionally empty
      });
    if (!m.applies.dataFlow)
      test.skip(`dataFlow — skipped (${m.skipReasons?.dataFlow ?? 'not applicable'})`, () => {
        // not applicable — intentionally empty
      });
    if (!m.applies.intents)
      test.skip(`intents — skipped (${m.skipReasons?.intents ?? 'not applicable'})`, () => {
        // not applicable — intentionally empty
      });

    bespoke?.();
  });
}
