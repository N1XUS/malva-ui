/// <reference types='vitest' />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/editor',
  plugins: [angular(), nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
  test: {
    name: 'editor',
    watch: false,
    passWithNoTests: true,
    globals: true,
    environment: 'jsdom',
    include: [
      '{src,ai,collaboration,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    setupFiles: [
      '../../scripts/testing/setup-strip-css-layers.js',
      '../../scripts/testing/setup-restore-dom-globals.js',
      'src/test-setup.ts',
      '../../scripts/testing/setup-assert-zoneless.js',
    ],
    // Tiptap boots a real ProseMirror instance per fixture, so this suite's
    // slowest file legitimately runs ~3.7s uncontended — barely inside the 5s
    // default, with nothing left for CI variance. It timed out the first time
    // it was co-scheduled with the docs suite.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/editor',
      provider: 'v8' as const,
    },
  },
}));
