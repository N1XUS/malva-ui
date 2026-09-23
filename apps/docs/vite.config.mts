/// <reference types='vitest' />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

export default defineConfig(() => ({
  root: import.meta.dirname,
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
      '../../scripts/testing/setup-assert-zoneless.js',
    ],
    // This is by far the heaviest suite in the workspace: 36 files, 340 tests,
    // axe scans over whole showcase pages, and specs that lazy-load the editor
    // page and pull the entire Tiptap graph through Vite's transform. The CI
    // runner has ~7.9GB of RAM with ~2GB already in use, and this suite kept
    // losing a worker to the kernel there — "Worker exited unexpectedly", no V8
    // heap message. A `free` trace of the run showed why: memory climbed
    // monotonically from 2.0GB to 6.9GB used with no plateau, and the kill
    // landed once ~1GB was left.
    //
    // One worker, not two. Vitest's `threads` pool keeps every worker isolate
    // in a single process, and each one imports the whole module graph
    // separately, so the second worker costs a second copy of it. Measured over
    // the full suite (max RSS, `/usr/bin/time -l`): 7.41GB at two workers,
    // 4.42GB at one. It is also *faster* — 68.3s to 52.3s, with import time
    // falling from 74.3s to 4.7s and user CPU from 177s to 60s — because
    // nothing is imported twice. CI shards this in two on top of that, which
    // brings the peak to 3.78GB and leaves ~2GB of headroom.
    maxWorkers: 1,
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
