import nx from '@nx/eslint-plugin';
import baseConfig from '../../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}'],
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
        'error',
        {
          type: 'element',
          prefix: 'mlv',
          style: 'kebab-case',
        },
      ],
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          // This block re-declares the rule wholesale, so the root config's
          // `allow` list does not merge in — it is restated here. The
          // second entry is the spec-only `stripCssLayersFromText()` helper
          // under `scripts/testing`; without it every compiled-CSS spec in
          // this project fails as "Imports of apps are forbidden".
          allow: [
            '^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$',
            '@malva-ui/internal-testing',
          ],
          depConstraints: [
            {
              sourceTag: 'scope:ui',
              onlyDependOnLibsWithTags: ['scope:ui'],
            },
            {
              sourceTag: 'scope:docs',
              onlyDependOnLibsWithTags: ['scope:docs', 'scope:ui'],
            },
          ],
          // The core project re-exports @malva-ui/core/date-range-picker while this
          // library imports secondary entry points from the core project
          // (e.g. @malva-ui/core/form-utils). This creates a false circular dependency
          // at the Nx project graph level.
          ignoredCircularDependencies: [['core-date-range-picker', 'core']],
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
