import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: [
            '{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}',
            // Build/test tooling only — must not become peerDependencies of the published package.
            '{projectRoot}/vite.config.{js,cjs,mjs,ts,cts,mts}',
          ],
          // The peer range is the release placeholder
          // `0.0.0-angular-core-package-version`, which `scripts/publish.mjs`
          // resolves from the workspace root at publish time. The rule can only
          // compare it against the installed version and always reports a
          // mismatch. Mirrors libs/cdk and libs/core.
          ignoredDependencies: ['@angular/core'],
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'mlv',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'warn',
        {
          type: ['element', 'attribute'],
          prefix: 'mlv',
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    // Override or add rules here
    rules: {},
  },
];
