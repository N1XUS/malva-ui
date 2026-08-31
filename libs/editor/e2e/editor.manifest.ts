import type { MlvComponentManifest } from '@malva-ui/cdk/testing-e2e';

export const editorManifest: MlvComponentManifest = {
  route: '/editor',
  label: 'Editor',
  applies: {
    keyboard: true,
    innerKeyboard: true,
    states: true,
    mouse: false,
    dataFlow: true,
    intents: true,
  },
  skipReasons: {
    mouse:
      'Editor pointer behavior is covered by deterministic bespoke toolbar, table, and upload scenarios; the generic inspector mouse contract does not model rich-text state.',
  },
  expectedStates: [
    {
      example: 1,
      selector: 'mlv-editor',
      classes: ['mlv-editor'],
    },
    {
      example: 2,
      selector: 'mlv-editor',
      classes: ['mlv-editor'],
    },
  ],
};

/**
 * The `/editor-ai` AI Kit docs page hosts the two AI scenarios: example 1 is
 * the streaming AI assistant, example 2 the suggestion-review demo.
 */
export const editorAiManifest: MlvComponentManifest = {
  route: '/editor-ai',
  label: 'Editor AI Kit',
  applies: {
    keyboard: true,
    innerKeyboard: true,
    states: true,
    mouse: false,
    dataFlow: true,
    intents: true,
  },
  skipReasons: {
    mouse:
      'AI pointer behavior is covered by the deterministic bespoke streaming and review scenarios; the generic inspector mouse contract does not model rich-text state.',
  },
  expectedStates: [
    {
      example: 1,
      selector: 'mlv-editor',
      classes: ['mlv-editor'],
    },
    {
      example: 2,
      selector: 'mlv-editor',
      classes: ['mlv-editor'],
    },
  ],
};
