// libs/core/table/e2e/table.manifest.ts
import type { MlvComponentManifest } from '@malva-ui/cdk/testing-e2e';

export const tableManifest: MlvComponentManifest = {
  route: '/table',
  label: 'Table',
  applies: {
    keyboard: false,
    innerKeyboard: false,
    states: true,
    mouse: false,
    dataFlow: false,
    intents: false,
  },
  skipReasons: {
    keyboard: 'A native table owns no focus or key handling',
    innerKeyboard: 'A native table has no roving focus',
    mouse: 'Hover feedback is CSS only and emits nothing',
    dataFlow: 'The table enhances consumer markup and holds no value',
    intents: 'The table has no icon slots or shape variants',
  },
  /**
   * Example 3 — responsive overflow with cell hover.
   * Example 4 — responsive Pop In with main / secondary rows.
   */
  expectedStates: [
    {
      example: 3,
      selector: 'table.mlv-table',
      classes: ['mlv-table', 'mlv-table--responsive', 'mlv-table--hover-cell'],
    },
    {
      example: 4,
      selector: 'table.mlv-table',
      classes: ['mlv-table', 'mlv-table--responsive', 'mlv-table--pop-in'],
    },
  ],
};
