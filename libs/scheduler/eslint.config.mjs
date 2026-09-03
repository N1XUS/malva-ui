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
          ignoredDependencies: [
            // Every peer range is a release placeholder
            // (`0.0.0-<name>-package-version`) that `scripts/publish.mjs`
            // resolves from the workspace root at publish time. The rule can
            // only compare a placeholder against the installed version and
            // always reports a mismatch. Mirrors libs/i18n, libs/cdk and
            // libs/core.
            '@angular/cdk',
            '@angular/common',
            '@angular/core',
            '@lucide/angular',
            '@malva-ui/cdk',
            '@malva-ui/core',
            '@malva-ui/i18n',
            'rxjs',
            // Bundled (non-peer) runtime dependency for the drag engine. The
            // SortableJS directive that imports it lands in a later task;
            // remove this entry as soon as a source file imports 'sortablejs'.
            'sortablejs',
          ],
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
    rules: {},
  },
  {
    // Spec host components use throwaway selectors that need no `mlv` prefix.
    files: ['**/*.spec.ts'],
    rules: {
      '@angular-eslint/template/elements-content': 'off',
      '@angular-eslint/component-selector': 'off',
    },
  },
];
