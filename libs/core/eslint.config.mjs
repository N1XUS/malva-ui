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
          // Most of these are real runtime peers of the published `@malva-ui/core`
          // package: its secondary entry points compile leaf-library sources that
          // import them, but every leaf (list, input, select, form-utils, …) is a
          // separate Nx project, so the `core` wrapper's own file scan cannot see
          // the imports. Mirrors the identical situation in libs/cdk.
          ignoredDependencies: [
            // Consumer schematics execute inside Angular CLI, which supplies
            // these schematic runtimes. They are not runtime peers of the
            // Angular component entry points.
            '@angular-devkit/schematics',
            '@schematics/angular',
            // Core's dedicated test harness and setup file only.
            '@analogjs/vitest-angular',
            '@angular/compiler',
            '@angular/aria',
            '@angular/cdk',
            '@angular/common',
            '@angular/core',
            '@angular/forms',
            '@angular/router',
            '@lucide/angular',
            '@malva-ui/cdk',
            '@malva-ui/i18n',
            'rxjs',
            // Not a peer — it's the bundled (non-peer) `dependencies` entry for the
            // `tile` secondary entry point's drag/sort engine (see
            // libs/core/tile/CLAUDE.md and `allowedNonPeerDependencies` in
            // libs/core/ng-package.json). Same file-scan blindness as above: the
            // import lives in the `core-tile` leaf project, not in this wrapper.
            'sortablejs',
            // Same story: bundled (non-peer) `dependencies` entry for the
            // `filter` secondary entry point's deep value equality (see
            // "Bundled runtime dependencies" in .claude/projects/libs-core.md
            // and `allowedNonPeerDependencies` in libs/core/ng-package.json).
            // The import lives in the `core-filter` leaf project, so this
            // wrapper's own file scan cannot see it.
            'fast-equals',
            // Same story again: bundled (non-peer) `dependencies` entry for the
            // `drawer` secondary entry point's `MlvDrawerSectionsService`
            // (`cloneDeep` / `sortBy`), whose import lives in the `core-drawer`
            // leaf project. Declared as of #242 — it was imported and declared
            // nowhere, so npm never installed it for a consumer.
            'lodash-es',
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
    // Test fixtures often use empty headings intentionally (editable mode hydrated by form binding)
    // and throwaway host-component selectors that don't need the `mlv` prefix.
    files: ['**/*.spec.ts'],
    rules: {
      '@angular-eslint/template/elements-content': 'off',
      '@angular-eslint/component-selector': 'off',
    },
  },
];
