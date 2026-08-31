// libs/core/button/e2e/button.manifest.ts
import type { MlvComponentManifest } from '@malva-ui/cdk/testing-e2e';

export const buttonManifest: MlvComponentManifest = {
  route: '/button',
  label: 'Button',
  applies: {
    keyboard: true,
    innerKeyboard: false,
    states: true,
    mouse: true,
    dataFlow: false,
    intents: true,
  },
  skipReasons: {
    innerKeyboard: 'Button has no inner roving focus',
    dataFlow:
      'Plain button has no form value; output emissions are covered by the mouse kit',
  },
  expectedStates: [
    {
      example: 1,
      selector: 'button.mlv-button--variant-primary',
      classes: ['mlv-button'],
    },
    {
      example: 1,
      selector: 'button.mlv-button--variant-secondary',
      classes: ['mlv-button'],
    },
    {
      example: 1,
      selector: 'button.mlv-button--variant-outlined',
      classes: ['mlv-button'],
    },
    {
      example: 1,
      selector: 'button.mlv-button--variant-accent',
      classes: ['mlv-button'],
    },
    {
      example: 1,
      selector: 'button.mlv-button--variant-transparent',
      classes: ['mlv-button'],
    },
    {
      example: 1,
      selector: 'button.mlv-button--variant-elevated',
      classes: ['mlv-button'],
    },
    {
      example: 1,
      selector: 'button.mlv-button--variant-error',
      classes: ['mlv-button'],
    },
    {
      example: 1,
      selector: 'button.mlv-button--variant-warning',
      classes: ['mlv-button'],
    },
    {
      example: 1,
      selector: 'button.mlv-button--variant-info',
      classes: ['mlv-button'],
    },
  ],
  expectedMouse: [],
};
