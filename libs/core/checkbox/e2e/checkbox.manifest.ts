// libs/core/checkbox/e2e/checkbox.manifest.ts
import type { MlvComponentManifest } from '@malva-ui/cdk/testing-e2e';

export const checkboxManifest: MlvComponentManifest = {
  route: '/checkbox',
  label: 'Checkbox',
  applies: {
    keyboard: true,
    innerKeyboard: true,
    states: true,
    mouse: true,
    dataFlow: true,
    intents: false,
  },
  skipReasons: {
    intents: 'Checkbox has no icon slots or shape variants to test',
  },
  /**
   * Example 1 — basic checkbox (host element: mlv-checkbox.mlv-checkbox).
   * Example 2 — states (disabled, indeterminate, etc.)
   * Example 3 — checkbox-group with FocusKeyManager.
   */
  expectedStates: [
    {
      example: 1,
      selector: 'mlv-checkbox',
      classes: ['mlv-checkbox'],
    },
    {
      example: 2,
      selector: 'mlv-checkbox.mlv-checkbox--disabled',
      classes: ['mlv-checkbox', 'mlv-checkbox--disabled'],
    },
  ],
  /**
   * Mouse kit: click the visual box element (.mlv-checkbox__visual) to toggle.
   * The inspector in example 1 records 'change' on (checkedChange).
   */
  expectedMouse: [
    {
      example: 1,
      trigger: 'mlv-checkbox .mlv-checkbox__visual',
      expectEvent: 'change',
    },
  ],
};
