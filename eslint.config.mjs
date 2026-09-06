import nx from '@nx/eslint-plugin';
import unusedImports from 'eslint-plugin-unused-imports';
import angular from 'angular-eslint';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  {
    // Register the @angular-eslint plugin at the workspace root so inline
    // `eslint-disable @angular-eslint/*` directives in library sources resolve
    // even when ESLint is invoked from the repo root (e.g. via lint-staged),
    // which does not load the per-project Angular flat configs. Rules are left
    // unconfigured here; enforcement lives in each project's eslint.config.mjs.
    // Unused-directive reporting is disabled here so root-level `eslint --fix`
    // does not strip directives that ARE required under the project configs.
    files: ['**/*.ts'],
    plugins: { '@angular-eslint': angular.tsPlugin },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: {},
  },
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: {
      'unused-imports': unusedImports,
    },
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          // Secondary-entry-point leaf projects are compiled by their family
          // package target, so Nx does not mark each leaf as independently
          // buildable even though ng-packagr builds it. Family constraints
          // below remain fully enforced.
          enforceBuildableLibDependency: false,
          // `@malva-ui/internal-testing` is a spec-only helper under
          // `scripts/testing`, not a workspace library, so it has no tags to
          // constrain and never reaches a published bundle.
          allow: [
            '^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$',
            '@malva-ui/internal-testing',
          ],
          depConstraints: [
            {
              sourceTag: 'family:core',
              onlyDependOnLibsWithTags: [
                'family:core',
                'family:cdk',
                'family:i18n',
              ],
            },
            {
              sourceTag: 'family:cdk',
              onlyDependOnLibsWithTags: ['family:cdk'],
            },
            {
              sourceTag: 'family:i18n',
              onlyDependOnLibsWithTags: ['family:i18n'],
            },
            // The editor sits above core rather than inside it: it composes
            // core's button, dialog, popup, input, menu and colour-picker
            // surfaces, so it may depend on every family core may. Nothing in
            // core may depend back on it — that direction is what makes the
            // package separable at all, and this constraint is what keeps it
            // that way, since `family:core` cannot reach `family:editor`.
            {
              sourceTag: 'family:editor',
              onlyDependOnLibsWithTags: [
                'family:editor',
                'family:core',
                'family:cdk',
                'family:i18n',
              ],
            },
            // The scheduler sits above core like the editor: it composes the
            // calendar date adapter, button, segmented, popup, scrollbar and
            // tooltip. Nothing in core may depend back on it.
            {
              sourceTag: 'family:scheduler',
              onlyDependOnLibsWithTags: [
                'family:scheduler',
                'family:core',
                'family:cdk',
                'family:i18n',
              ],
            },
            // The taskboard is the second package that sits above core rather
            // than inside it. Nothing in core may depend back on it, and it
            // reaches only the CDK and i18n families itself; the docs app
            // documents it, so `family:docs` must be able to import it.
            {
              sourceTag: 'family:taskboard',
              onlyDependOnLibsWithTags: [
                'family:taskboard',
                'family:cdk',
                'family:i18n',
              ],
            },
            {
              sourceTag: 'family:docs',
              onlyDependOnLibsWithTags: [
                'family:docs',
                'family:editor',
                'family:scheduler',
                'family:taskboard',
                'family:core',
                'family:cdk',
                'family:i18n',
              ],
            },
            {
              sourceTag: 'scope:ui',
              onlyDependOnLibsWithTags: ['scope:ui'],
            },
            {
              sourceTag: 'scope:docs',
              onlyDependOnLibsWithTags: ['scope:docs', 'scope:ui'],
            },
          ],
        },
      ],
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
      // Keep in sync with unused-imports/no-unused-vars: the repo convention is that
      // an `_` prefix marks intentionally unused vars/args (see best-practices.md).
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {},
  },
];
