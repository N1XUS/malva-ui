/// <reference types='vitest' />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/libs/cdk/floating-container',
  plugins: [angular(), nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
  test: {
    name: 'cdk-floating-container',
    watch: false,
    passWithNoTests: true,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    setupFiles: [
      '../../../scripts/testing/setup-strip-css-layers.js',
      '../../../scripts/testing/setup-restore-dom-globals.js',
      'src/test-setup.ts',
    ],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../coverage/libs/cdk/floating-container',
      provider: 'v8' as const,
    },
  },
}));
