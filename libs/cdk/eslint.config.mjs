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
          // The `cdk` project root only re-exports the @malva-ui/cdk/* secondary entry
          // points, so the project graph cannot see these runtime peers — but the
          // compiled entry-point sources bundled into the published package need them.
          ignoredDependencies: [
            '@angular/cdk',
            '@angular/common',
            '@angular/core',
            '@angular/forms',
            'rxjs',
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
    // Override or add rules here
    rules: {},
  },
  {
    // Throwaway test-host component selectors don't need the `mlv` prefix.
    files: ['**/*.spec.ts'],
    rules: {
      '@angular-eslint/component-selector': 'off',
    },
  },
];
