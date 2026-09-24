/// <reference types='vitest' />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

// The adapter's DST specs describe a concrete spring-forward / fall-back day, so
// the suite runs in a fixed zone instead of the runner's local one.
// Europe/Berlin: 2026-03-29 02:00 -> 03:00 and 2026-10-25 03:00 -> 02:00.
// Set here, in the config module, so every pooled worker inherits it before its
// first `Date`/`Intl` call caches the zone; `date-adapter.spec.ts` asserts it.
process.env.TZ = 'Europe/Berlin';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../../node_modules/.vite/libs/core/date',
  plugins: [angular(), nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
  test: {
    name: 'core-date',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    setupFiles: [
      '../../../scripts/testing/setup-strip-css-layers.js',
      '../../../scripts/testing/setup-restore-dom-globals.js',
      'src/test-setup.ts',
      '../../../scripts/testing/setup-assert-zoneless.js',
    ],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../coverage/libs/core/date',
      provider: 'v8' as const,
    },
  },
}));
