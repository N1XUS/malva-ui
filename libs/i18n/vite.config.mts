/// <reference types='vitest' />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/i18n',
  plugins: [angular(), nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
  test: {
    name: 'i18n',
    watch: false,
    passWithNoTests: true,
    globals: true,
    environment: 'jsdom',
    include: [
      '{src,en,de,fr,it,es,pt,uk,ro,testing,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    setupFiles: [
      '../../scripts/testing/setup-strip-css-layers.js',
      '../../scripts/testing/setup-restore-dom-globals.js',
      'src/test-setup.ts',
      '../../scripts/testing/setup-assert-zoneless.js',
    ],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/i18n',
      provider: 'v8' as const,
    },
  },
}));
