import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';

import {
  IMPLICIT_CONSUMERS,
  WORKSPACE_ROOT,
  codePackages,
  commandTokens,
  hasFailure,
  nodeModulesPackages,
  nxPackageOf,
  projectCommands,
  scanRoot,
  stringLiterals,
  stylePackages,
  typedPackageOf,
  workflowCommands,
} from './check-root-dependencies.mjs';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const temporaryDirectories = [];

after(() => {
  for (const dir of temporaryDirectories) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * Materialises a workspace root: the root `package.json` from `manifest`,
 * every `files` entry verbatim, and one `node_modules/<name>/package.json`
 * per `installed` entry. Returns the root and the tracked-file list the scan
 * is handed (everything except `node_modules/`, as git would list it).
 */
function fixtureRoot(manifest, files = {}, installed = {}) {
  const root = mkdtempSync(join(tmpdir(), 'mlv-root-deps-'));
  temporaryDirectories.push(root);

  const write = (relativePath, contents) => {
    const full = join(root, relativePath);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, contents);
  };

  write('package.json', JSON.stringify(manifest, null, 2));
  for (const [path, contents] of Object.entries(files)) write(path, contents);
  for (const [name, installedManifest] of Object.entries(installed)) {
    write(
      `node_modules/${name}/package.json`,
      JSON.stringify({ name, version: '1.0.0', ...installedManifest }),
    );
  }
  return { root, files: ['package.json', ...Object.keys(files)] };
}

/** Scans a fixture with an empty allow-list unless one is given. */
function scan({ root, files }, implicit = []) {
  return scanRoot(root, { files, implicit });
}

/** Every fixture needs one code file, or the scan fails as vacuous. */
const SOME_CODE = { 'src/main.ts': "import { of } from 'rxjs';\n" };

// ─── Extraction ──────────────────────────────────────────────────────────────

test('codePackages reads every import form and nothing that only looks like one', () => {
  const names = codePackages(
    [
      "import { a } from '@scope/pkg/deep/path';",
      "import 'side-effect';",
      "export * from 're-exported';",
      "const lazy = () => import('dynamic');",
      "const req = require('required');",
      "import type { T } from 'types-only';",
      "import { x } from './relative';",
      "import { readFileSync } from 'node:fs';",
      'const template = `<mlv-radio value="express">Express</mlv-radio>`;',
      "// import { y } from 'commented-out';",
      "const cli = 'node node_modules/jiti/lib/jiti-cli.mjs';",
    ].join('\n'),
  );
  assert.deepEqual([...names].sort(), [
    '@scope/pkg',
    'dynamic',
    'jiti',
    're-exported',
    'required',
    'side-effect',
    'types-only',
  ]);
});

test('stylePackages reads @use / @import / @forward and skips sass modules and relative paths', () => {
  const names = stylePackages(
    [
      "@use 'sass:map';",
      "@use '../../mixins' as mixins;",
      '@import "tailwindcss";',
      "@import 'flag-icons/css/flag-icons.min.css';",
      "@forward '~@scope/theme/tokens';",
    ].join('\n'),
  );
  assert.deepEqual([...names].sort(), [
    '@scope/theme',
    'flag-icons',
    'tailwindcss',
  ]);
});

test('nodeModulesPackages keeps both segments of a scoped path', () => {
  assert.deepEqual(
    [
      ...nodeModulesPackages(
        'x node_modules/@angular/cli/lib/config y node_modules/ts-morph/dist',
      ),
    ],
    ['@angular/cli', 'ts-morph'],
  );
});

test('workflowCommands keeps run: lines and block bodies, not comments or step names', () => {
  const commands = workflowCommands(
    [
      'jobs:',
      '  ci:',
      '    steps:',
      '      # keeps: prettier would not run here',
      '      - name: husky setup',
      '      - run: yarn install --immutable',
      '      - name: Lint',
      '        run: |',
      '          npx eslint .',
      '          npx lint-staged',
      '      - name: after',
      '        with:',
      '          verdaccio: true',
    ].join('\n'),
  );
  const tokens = commandTokens(commands);
  assert.ok(tokens.includes('eslint'));
  assert.ok(tokens.includes('lint-staged'));
  assert.ok(tokens.includes('yarn'));
  for (const absent of ['prettier', 'husky', 'verdaccio']) {
    assert.ok(!tokens.includes(absent), `${absent} is not a command here`);
  }
});

test('stringLiterals and projectCommands expose only the command text', () => {
  assert.equal(
    stringLiterals(
      "// eslint in a comment\nexport default { '*.ts': ['prettier --write'] };",
    ),
    '*.ts\nprettier --write',
  );
  assert.equal(
    projectCommands({
      targets: {
        a: { executor: 'nx:run-commands', options: { command: 'node a.mjs' } },
        b: { options: { commands: ['node b.mjs', { command: 'node c.mjs' }] } },
        c: { executor: '@nx/js:verdaccio', options: { port: 4873 } },
      },
    }),
    'node a.mjs\nnode b.mjs\nnode c.mjs',
  );
});

test('nxPackageOf and typedPackageOf map to the owning package', () => {
  assert.equal(nxPackageOf('@nx/angular:package'), '@nx/angular');
  assert.equal(nxPackageOf('nx:run-commands'), 'nx');
  assert.equal(nxPackageOf('@nx/vite/plugin'), '@nx/vite');
  assert.equal(typedPackageOf('@types/node'), 'node');
  assert.equal(typedPackageOf('@types/babel__core'), '@babel/core');
  assert.equal(typedPackageOf('lodash-es'), null);
});

// ─── Scan ────────────────────────────────────────────────────────────────────

test('a planted dependency with no consumer is reported, and is not once something imports it', () => {
  const manifest = { dependencies: { rxjs: '^7', planted: '^1' } };

  const red = scan(fixtureRoot(manifest, SOME_CODE));
  assert.deepEqual(red.unused, ['planted']);
  assert.equal(hasFailure(red), true);

  const green = scan(
    fixtureRoot(manifest, {
      ...SOME_CODE,
      'tools/use.mjs': "import 'planted';\n",
    }),
  );
  assert.deepEqual(green.unused, []);
  assert.equal(hasFailure(green), false);
});

test('a string that merely spells a package name is not a consumer', () => {
  const result = scan(
    fixtureRoot(
      { dependencies: { rxjs: '^7', express: '^4' } },
      {
        ...SOME_CODE,
        'src/radio.spec.ts':
          'const t = `<mlv-radio value="express">Express</mlv-radio>`;\n',
      },
    ),
  );
  assert.deepEqual(result.unused, ['express']);
});

test('a required peer of a consumed package counts; an optional peer does not', () => {
  const result = scan(
    fixtureRoot(
      {
        dependencies: {
          rxjs: '^7',
          framework: '^1',
          'required-peer': '^1',
          'optional-peer': '^1',
        },
      },
      { ...SOME_CODE, 'src/app.ts': "import 'framework';\n" },
      {
        framework: {
          peerDependencies: { 'required-peer': '^1', 'optional-peer': '^1' },
          peerDependenciesMeta: { 'optional-peer': { optional: true } },
        },
      },
    ),
  );
  assert.deepEqual(result.unused, ['optional-peer']);
  assert.deepEqual(result.evidence['required-peer'], [
    'required peer of framework',
  ]);
});

test('executors, plugins, hook binaries, postcss plugins, tsconfig types and workspace manifests are consumers', () => {
  const result = scan(
    fixtureRoot(
      {
        workspaces: ['libs/*'],
        scripts: { prepare: 'husky' },
        dependencies: {
          rxjs: '^7',
          '@tool/executor': '1',
          '@tool/plugin': '1',
          husky: '1',
          '@tool/cli': '1',
          'postcss-plugin': '1',
          'workspace-dep': '1',
          'workspace-peer': '1',
          'lint-bin': '1',
        },
        devDependencies: { '@types/node': '1', '@types/rxjs-extra': '1' },
      },
      {
        ...SOME_CODE,
        'apps/a/project.json': JSON.stringify({
          targets: { build: { executor: '@tool/executor:build' } },
        }),
        'nx.json': JSON.stringify({
          plugins: [{ plugin: '@tool/plugin/plugin' }],
        }),
        '.husky/commit-msg':
          '# @tool/cli is not named here\nyarn toolcli --edit $1\n',
        'lint-staged.config.mjs':
          "export default { '*.ts': 'lintbin --fix' };\n",
        'postcss.config.json': JSON.stringify({
          plugins: { 'postcss-plugin': {} },
        }),
        'tsconfig.base.json': '{ "compilerOptions": { "types": ["node"] } }',
        'libs/a/package.json': JSON.stringify({
          dependencies: { 'workspace-dep': '1' },
          peerDependencies: { 'workspace-peer': '1' },
        }),
      },
      {
        husky: { bin: { husky: 'bin.js' } },
        '@tool/cli': { bin: { toolcli: 'cli.js' } },
        'lint-bin': { bin: 'index.js' },
      },
    ),
  );
  // `@types/rxjs-extra` describes a package nothing imports, so it stays unused;
  // `lint-bin`'s string `bin` is named after the package (`lint-bin`), not `lintbin`.
  assert.deepEqual(result.unused, ['@types/rxjs-extra', 'lint-bin']);
  assert.ok(result.evidence['@tool/cli'][0].includes('`toolcli`'));
  assert.ok(result.evidence['@types/node'][0].includes('(types)'));
});

test('@types/<x> is consumed exactly when <x> is', () => {
  const result = scan(
    fixtureRoot(
      {
        dependencies: { rxjs: '^7', 'lodash-es': '4' },
        devDependencies: { '@types/lodash-es': '4', '@types/unused-lib': '1' },
      },
      {
        ...SOME_CODE,
        'apps/pipe.ts': "import { kebabCase } from 'lodash-es';\n",
      },
    ),
  );
  assert.deepEqual(result.unused, ['@types/unused-lib']);
});

test('a duplicate entry and an @types package under dependencies are reported', () => {
  const result = scan(
    fixtureRoot(
      {
        dependencies: {
          rxjs: '^7',
          sortablejs: '1',
          '@types/lodash-es': '4',
          'lodash-es': '4',
        },
        devDependencies: { sortablejs: '1' },
      },
      { ...SOME_CODE, 'a.ts': "import 'sortablejs';\nimport 'lodash-es';\n" },
    ),
  );
  assert.deepEqual(result.unused, []);
  assert.deepEqual(result.duplicates, ['sortablejs']);
  assert.deepEqual(result.typesInDependencies, ['@types/lodash-es']);
  assert.equal(hasFailure(result), true);
});

test('a clean entry vouches for its package and seeds the required-peer walk; a deferred one silences only itself', () => {
  const fixture = fixtureRoot(
    {
      dependencies: {
        rxjs: '^7',
        builder: '1',
        'builder-peer': '1',
        candidate: '1',
        'candidate-peer': '1',
      },
    },
    SOME_CODE,
    {
      builder: { peerDependencies: { 'builder-peer': '1' } },
      candidate: { peerDependencies: { 'candidate-peer': '1' } },
    },
  );
  const result = scan(fixture, [
    { package: 'builder', kind: 'clean', reason: 'an executor loads it' },
    { package: 'candidate', kind: 'deferred', reason: 'pending' },
  ]);
  assert.deepEqual(result.unused, ['candidate-peer']);
  assert.deepEqual(result.deferred, ['candidate']);
  assert.deepEqual(result.staleEntries, []);
});

test('a stale allow-list entry fails: undeclared, already consumed, or listed twice', () => {
  const result = scan(
    fixtureRoot({ dependencies: { rxjs: '^7', kept: '1' } }, SOME_CODE),
    [
      { package: 'gone', kind: 'clean', reason: 'r' },
      { package: 'rxjs', kind: 'clean', reason: 'r' },
      { package: 'kept', kind: 'clean', reason: 'r' },
      { package: 'kept', kind: 'deferred', reason: 'r' },
    ],
  );
  assert.deepEqual(
    result.staleEntries.map((entry) => [
      entry.package,
      entry.problem.split(':')[0],
    ]),
    [
      ['gone', 'not a root dependency'],
      ['rxjs', 'has a consumer'],
      ['kept', 'listed twice'],
    ],
  );
  assert.equal(hasFailure(result), true);
});

test('an entry another clean entry already pulls in as a required peer is stale; of a mutual pair, only the first', () => {
  const result = scan(
    fixtureRoot(
      {
        dependencies: {
          rxjs: '^7',
          register: '1',
          compiler: '1',
          left: '1',
          right: '1',
          pending: '1',
        },
      },
      SOME_CODE,
      {
        register: { peerDependencies: { compiler: '1' } },
        left: { peerDependencies: { right: '1', pending: '1' } },
        right: { peerDependencies: { left: '1' } },
      },
    ),
    [
      { package: 'register', kind: 'clean', reason: 'r' },
      { package: 'compiler', kind: 'clean', reason: 'r' },
      { package: 'left', kind: 'clean', reason: 'r' },
      { package: 'right', kind: 'clean', reason: 'r' },
      { package: 'pending', kind: 'deferred', reason: 'r' },
    ],
  );
  // `left` and `right` each require the other: reporting both would leave
  // neither covered once both entries were deleted, so only the first goes.
  assert.deepEqual(
    result.staleEntries.map((entry) => [entry.package, entry.problem]),
    [
      ['compiler', 'has a consumer: required peer of register'],
      ['left', 'has a consumer: required peer of right'],
      ['pending', 'has a consumer: required peer of left'],
    ],
  );
  assert.deepEqual(result.unused, []);
  assert.equal(hasFailure(result), true);
});

test('a node_modules path anywhere in a project.json, and importHelpers in a tsconfig, are consumers', () => {
  const result = scan(
    fixtureRoot(
      { dependencies: { rxjs: '^7', '@scope/preset': '1', tslib: '2' } },
      {
        ...SOME_CODE,
        'apps/a/project.json': JSON.stringify({
          targets: {
            check: {
              executor: 'nx:run-commands',
              options: { config: 'node_modules/@scope/preset/config.json' },
            },
          },
        }),
        'tsconfig.base.json':
          '{ "compilerOptions": { "importHelpers": true } }',
      },
    ),
  );
  assert.deepEqual(result.unused, []);
  assert.ok(result.evidence.tslib[0].includes('importHelpers'));
});

test('a scan that read no code fails rather than reporting a verdict', () => {
  const result = scan(
    fixtureRoot({ dependencies: {} }, { 'README.md': '# nothing\n' }),
  );
  assert.equal(result.scannedCode, 0);
  assert.equal(hasFailure(result), true);
});

// ─── The real workspace ──────────────────────────────────────────────────────

test('every IMPLICIT_CONSUMERS entry says what it is and why', () => {
  for (const entry of IMPLICIT_CONSUMERS) {
    assert.ok(
      ['clean', 'deferred'].includes(entry.kind),
      `${entry.package}: kind`,
    );
    assert.ok(entry.reason.trim().length > 20, `${entry.package}: reason`);
  }
});

test('the workspace root manifest is clean', () => {
  const result = scanRoot(WORKSPACE_ROOT);
  assert.ok(
    result.scannedCode > 1000,
    `scanned ${result.scannedCode} code files`,
  );
  assert.deepEqual(
    {
      unused: result.unused,
      duplicates: result.duplicates,
      typesInDependencies: result.typesInDependencies,
      stale: result.staleEntries.map(
        (entry) => `${entry.package}: ${entry.problem}`,
      ),
    },
    { unused: [], duplicates: [], typesInDependencies: [], stale: [] },
  );
});
