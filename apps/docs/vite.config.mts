/// <reference types='vitest' />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/docs',
  plugins: [
    angular(),
    nxViteTsPaths(),
    nxCopyAssetsPlugin(['*.md']),
  ],
  // Uncomment this if you are using workers.
  // worker: {
  //   plugins: () => [ nxViteTsPaths() ],
  // },
  test: {
    name: 'docs',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests,tools}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    setupFiles: [
      '../../scripts/testing/setup-strip-css-layers.js',
      '../../scripts/testing/setup-restore-dom-globals.js',
      'src/test-setup.ts',
    ],
    // This is by far the heaviest suite in the workspace: 36 files, 339 tests,
    // axe scans over whole showcase pages, and one 92-test file that alone runs
    // for over two minutes on a CI runner. Left unbounded, vitest sizes its
    // pool from the core count, and because nx runs three projects at a time
    // that put ~9 jsdom workers on a 4-vCPU runner. The suite then starved its
    // co-scheduled neighbours (editor's specs went from 3.7s to 19.7s and timed
    // out) and finally lost a worker outright. Two workers keeps it inside its
    // share of the box; the critical path is the single big file either way.
    maxWorkers: 2,
    minWorkers: 1,
    // axe over a full showcase page takes ~1.7s uncontended here and several
    // times that on a loaded runner, so the 5s default leaves no headroom.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/apps/docs',
      provider: 'v8' as const,
    },
  },
}));
