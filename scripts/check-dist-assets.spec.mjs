import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';

import {
  ASSET_REFERENCE,
  WORKSPACE_ROOT,
  checkBuildEdges,
  checkPackageAssets,
  collectDocumentedAssets,
  collectGeneratedAssets,
  hasFailure,
  readProject,
} from './check-dist-assets.mjs';
import { readReleaseProjects } from './check-package-dependencies.mjs';
import {
  collectAssetProblems,
  collectBrokenExports,
  hasSideEffects,
  isPackedByFiles,
  resolveThroughExports,
} from './dist-exports.mjs';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const temporaryDirectories = [];

after(() => {
  for (const dir of temporaryDirectories) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * Materialises a directory from a `path → contents` map and returns its root.
 * A non-string value is written as JSON.
 */
function fixtureTree(files) {
  const root = mkdtempSync(join(tmpdir(), 'mlv-dist-assets-'));
  temporaryDirectories.push(root);
  for (const [path, contents] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(
      full,
      typeof contents === 'string' ? contents : JSON.stringify(contents),
    );
  }
  return root;
}

/** A built package: its manifest plus whatever files it ships. */
const fixtureDist = (manifest, files = {}) =>
  fixtureTree({ 'package.json': manifest, ...files });

const NAME = '@malva-ui/fixture';

/** Just the problem messages, which is what a failure prints. */
const messages = (problems) => problems.map((problem) => problem.message);

// ─── collectBrokenExports ────────────────────────────────────────────────────

test('collectBrokenExports reports a literal target missing from dist', () => {
  const dist = fixtureDist({}, { 'present.mjs': '' });
  const pkg = {
    exports: { '.': { default: './present.mjs' }, './gone': './gone.mjs' },
  };
  assert.deepEqual(collectBrokenExports(pkg, dist), ['./gone → ./gone.mjs']);
});

// #310: a `./styles/*` subpath is a Node pattern, not a file name. Read
// literally, `existsSync('styles/*')` is false, so the publish preflight would
// have rejected the very export that fixes the consumer import.
test('collectBrokenExports accepts a subpath pattern whose target matches a file', () => {
  const dist = fixtureDist({}, { 'styles/malva-ui.css': 'a{}' });
  const pkg = { exports: { './styles/*': './styles/*' } };
  assert.deepEqual(collectBrokenExports(pkg, dist), []);
});

test('collectBrokenExports reports a subpath pattern that matches no file', () => {
  const dist = fixtureDist({}, { 'other/malva-ui.css': 'a{}' });
  const pkg = {
    exports: {
      './styles/*': './styles/*',
      './themes/*.css': './themes/*.css',
    },
  };
  assert.deepEqual(collectBrokenExports(pkg, dist), [
    './styles/* → ./styles/*',
    './themes/*.css → ./themes/*.css',
  ]);
});

test('collectBrokenExports honours the suffix of a pattern target', () => {
  const dist = fixtureDist({}, { 'styles/tokens.md': '#' });
  const pkg = { exports: { './styles/*.css': './styles/*.css' } };
  assert.deepEqual(collectBrokenExports(pkg, dist), [
    './styles/*.css → ./styles/*.css',
  ]);
});

test('collectBrokenExports follows nested conditions and fallback arrays', () => {
  const dist = fixtureDist({}, { 'ok.mjs': '' });
  const pkg = {
    exports: {
      '.': { node: { import: './ok.mjs', require: './missing.cjs' } },
      './fallback': ['./ok.mjs', './also-missing.mjs'],
    },
  };
  assert.deepEqual(collectBrokenExports(pkg, dist), [
    '. (node) (require) → ./missing.cjs',
    './fallback [1] → ./also-missing.mjs',
  ]);
});

test('collectBrokenExports skips a null target, which excludes rather than names a file', () => {
  const dist = fixtureDist({}, { 'styles/a.css': '' });
  const pkg = {
    exports: { './styles/*': './styles/*', './styles/private/*': null },
  };
  assert.deepEqual(collectBrokenExports(pkg, dist), []);
});

test('collectBrokenExports still checks module and typings', () => {
  const dist = fixtureDist({});
  assert.deepEqual(
    collectBrokenExports({ module: './a.mjs', typings: './a.d.ts' }, dist),
    ['module → ./a.mjs', 'typings → ./a.d.ts'],
  );
});

// ─── hasSideEffects ──────────────────────────────────────────────────────────

test('hasSideEffects reads an absent flag as "has side effects", like every bundler', () => {
  assert.equal(hasSideEffects({}, 'styles/a.css'), true);
});

test('hasSideEffects applies a boolean to every file', () => {
  assert.equal(hasSideEffects({ sideEffects: false }, 'styles/a.css'), false);
  assert.equal(hasSideEffects({ sideEffects: true }, 'fesm2022/a.mjs'), true);
});

test('hasSideEffects matches a glob list relative to the package root', () => {
  const pkg = { sideEffects: ['./styles/*.css'] };
  assert.equal(hasSideEffects(pkg, 'styles/malva-ui.css'), true);
  assert.equal(hasSideEffects(pkg, 'styles/nested/a.css'), false);
  // JS stays tree-shakable: the list is what core ships, so this is the
  // guarantee that the stylesheet opt-in does not cost consumers any JS.
  assert.equal(hasSideEffects(pkg, 'fesm2022/malva-ui-core.mjs'), false);
});

test('hasSideEffects matches a slash-less glob at any depth', () => {
  const pkg = { sideEffects: ['*.css'] };
  assert.equal(hasSideEffects(pkg, 'theme.css'), true);
  assert.equal(hasSideEffects(pkg, 'styles/nested/a.css'), true);
  assert.equal(hasSideEffects(pkg, 'index.mjs'), false);
});

// ─── isPackedByFiles ─────────────────────────────────────────────────────────

test('isPackedByFiles packs everything when there is no files allowlist', () => {
  assert.equal(isPackedByFiles({}, 'styles/a.css'), true);
});

test('isPackedByFiles honours files, directories and the always-packed trio', () => {
  const pkg = { files: ['theme.css', 'schematics/', 'styles/*.css'] };
  assert.equal(isPackedByFiles(pkg, 'theme.css'), true);
  assert.equal(isPackedByFiles(pkg, 'schematics/ng-add/index.cjs'), true);
  assert.equal(isPackedByFiles(pkg, 'styles/a.css'), true);
  assert.equal(isPackedByFiles(pkg, 'styles/tokens.md'), false);
  assert.equal(isPackedByFiles(pkg, 'package.json'), true);
  assert.equal(isPackedByFiles(pkg, 'README.md'), true);
  assert.equal(isPackedByFiles(pkg, 'LICENSE'), true);
});

// ─── resolveThroughExports / collectAssetProblems ────────────────────────────

// The two consumer failures #310 measured, reproduced on a fixture: a dist with
// only generated JS subpaths refuses a bare stylesheet specifier outright.
test('resolveThroughExports refuses a subpath the exports map does not declare', () => {
  const dist = fixtureDist(
    { name: NAME, exports: { '.': { default: './index.mjs' } } },
    { 'index.mjs': '', 'styles/malva-ui.css': 'a{}' },
  );
  const result = resolveThroughExports(NAME, dist, ['styles/malva-ui.css']);
  assert.match(
    result.get('styles/malva-ui.css').error,
    /^ERR_PACKAGE_PATH_NOT_EXPORTED/,
  );
});

test('resolveThroughExports resolves through a pattern export to the shipped file', () => {
  const dist = fixtureDist(
    { name: NAME, exports: { './styles/*': './styles/*' } },
    { 'styles/malva-ui.css': 'a{}' },
  );
  const result = resolveThroughExports(NAME, dist, ['styles/malva-ui.css']);
  assert.ok('resolved' in result.get('styles/malva-ui.css'));
  assert.match(
    result.get('styles/malva-ui.css').resolved,
    /styles[/\\]malva-ui\.css$/,
  );
});

test('collectAssetProblems reports a documented file that is not in dist', () => {
  const dist = fixtureDist({
    name: NAME,
    exports: { './styles/*': './styles/*' },
  });
  assert.deepEqual(
    messages(
      collectAssetProblems(NAME, { sideEffects: true }, dist, [
        'styles/gone.css',
      ]),
    ),
    ['styles/gone.css: missing — not in the built package'],
  );
});

test('collectAssetProblems reports a shipped file no bare specifier reaches', () => {
  const manifest = { name: NAME, exports: { '.': { default: './index.mjs' } } };
  const dist = fixtureDist(manifest, {
    'index.mjs': '',
    'styles/tokens.md': '#',
  });
  const [problem] = collectAssetProblems(NAME, manifest, dist, [
    'styles/tokens.md',
  ]);
  assert.equal(problem.subpath, 'styles/tokens.md');
  assert.match(
    problem.message,
    /^styles\/tokens\.md: not exported — `@malva-ui\/fixture\/styles\/tokens\.md` does not resolve \(ERR_PACKAGE_PATH_NOT_EXPORTED/,
  );
});

test('collectAssetProblems reports an export that resolves to a different file', () => {
  const manifest = { name: NAME, exports: { './styles/*': './legacy/*' } };
  const dist = fixtureDist(manifest, {
    'styles/a.md': '#',
    'legacy/a.md': '#',
  });
  assert.deepEqual(
    messages(collectAssetProblems(NAME, manifest, dist, ['styles/a.md'])),
    [
      'styles/a.md: not exported — `@malva-ui/fixture/styles/a.md` resolves to legacy/a.md instead',
    ],
  );
});

test('collectAssetProblems reports a stylesheet a bundler would drop as side-effect free', () => {
  const manifest = {
    name: NAME,
    exports: { './styles/*': './styles/*' },
    sideEffects: false,
  };
  const dist = fixtureDist(manifest, {
    'styles/a.css': 'a{}',
    'styles/t.md': '#',
  });
  assert.deepEqual(
    messages(
      collectAssetProblems(NAME, manifest, dist, [
        'styles/a.css',
        'styles/t.md',
      ]),
    ),
    [
      "styles/a.css: side-effect free — `sideEffects` lets webpack drop `import '@malva-ui/fixture/styles/a.css'` in a production build",
    ],
  );
});

test('collectAssetProblems reports a file the files allowlist does not pack', () => {
  const manifest = {
    name: NAME,
    files: ['index.mjs'],
    exports: { './theme.css': './theme.css' },
    sideEffects: true,
  };
  const dist = fixtureDist(manifest, { 'index.mjs': '', 'theme.css': 'a{}' });
  assert.deepEqual(
    messages(collectAssetProblems(NAME, manifest, dist, ['theme.css'])),
    ['theme.css: not packed — the `files` allowlist leaves it out'],
  );
});

test('collectAssetProblems is clean for the shape @malva-ui/core ships', () => {
  const manifest = {
    name: NAME,
    exports: {
      './styles/*': './styles/*',
      './package.json': { default: './package.json' },
      '.': { types: './index.d.ts', default: './index.mjs' },
    },
    sideEffects: ['./styles/*.css'],
  };
  const dist = fixtureDist(manifest, {
    'index.mjs': '',
    'index.d.ts': '',
    'styles/malva-ui.css': 'a{}',
    'styles/page-view-transitions.css': 'a{}',
    'styles/tokens.md': '#',
  });
  assert.deepEqual(
    collectAssetProblems(NAME, manifest, dist, [
      'styles/malva-ui.css',
      'styles/page-view-transitions.css',
      'styles/tokens.md',
    ]),
    [],
  );
  assert.deepEqual(collectBrokenExports(manifest, dist), []);
});

// ─── collectGeneratedAssets ──────────────────────────────────────────────────

test('collectGeneratedAssets owes every file a same-project build prerequisite writes into the package', () => {
  const project = {
    name: 'fixture',
    root: 'libs/fixture',
    projectJson: {
      targets: {
        build: {
          dependsOn: ['^build', 'build-styles', { target: 'codegen' }],
        },
        'build-styles': {
          outputs: [
            '{projectRoot}/styles/a.css',
            '{workspaceRoot}/libs/fixture/styles/tokens.md',
            // Outside the package root: not something it ships.
            '{workspaceRoot}/dist/elsewhere/b.css',
          ],
        },
        // Compiler input, bundled rather than copied.
        codegen: { outputs: ['{projectRoot}/src/generated/icons.ts'] },
        // Not a prerequisite of `build`.
        docs: { outputs: ['{projectRoot}/docs/api.md'] },
      },
    },
  };
  const { assets, problems } = collectGeneratedAssets(project);
  assert.deepEqual([...assets.keys()], ['styles/a.css', 'styles/tokens.md']);
  assert.equal(
    assets.get('styles/a.css'),
    'libs/fixture/project.json → build-styles.outputs',
  );
  assert.deepEqual(problems, []);
});

test('collectGeneratedAssets reports an output it cannot map to a file instead of skipping it', () => {
  const project = {
    name: 'fixture',
    root: 'libs/fixture',
    projectJson: {
      targets: {
        build: { dependsOn: ['assets'] },
        assets: {
          outputs: ['{projectRoot}/assets', '{projectRoot}/fonts/*.woff2'],
        },
      },
    },
  };
  const { assets, problems } = collectGeneratedAssets(project);
  assert.equal(assets.size, 0);
  assert.equal(problems.length, 2);
  assert.match(problems[0], /`\{projectRoot\}\/assets` is not a single file/);
});

// ─── collectDocumentedAssets ─────────────────────────────────────────────────

test('ASSET_REFERENCE reads both documented forms and stops at a glob', () => {
  const text = [
    '"styles": ["node_modules/@malva-ui/core/styles/page-view-transitions.css"]',
    "@import '@malva-ui/core/styles/malva-ui.css';",
    'every `@malva-ui/core/styles/*.css` file',
    "import { MlvButton } from '@malva-ui/core/button';",
    // A manifest a tool reads by file path, never a consumer import: holding
    // it to the bare-specifier standard would demand a public exports path.
    'read `@malva-ui/core/package.json` or `@malva-ui/core/schematics/collection.json`',
  ].join('\n');
  assert.deepEqual(
    [...text.matchAll(ASSET_REFERENCE)].map(
      (match) => `${match[1]} ${match[2]}`,
    ),
    ['core styles/page-view-transitions.css', 'core styles/malva-ui.css'],
  );
});

test('collectDocumentedAssets records file:line locations and skips what it must not read', () => {
  const workspace = fixtureTree({
    'libs/x/README.md':
      'Intro\nAdd `node_modules/@malva-ui/core/styles/a.css`\n',
    'libs/x/src/lib/x.ts': '/** @malva-ui/core/styles/a.css */\n',
    // A config file is a source like any other: it is where a consumer's
    // `styles` array names a stylesheet.
    'libs/x/project.json': '{ "styles": ["@malva-ui/core/styles/a.css"] }',
    // A spec may name a path to assert it is absent; every positive reference
    // a spec makes is duplicated in the source it tests.
    'libs/x/src/lib/x.spec.ts':
      "expect(styles).not.toContain('@malva-ui/core/styles/legacy.css');",
    'libs/x/src/lib/x.test.mjs': '// @malva-ui/core/styles/legacy.css',
    'libs/x/node_modules/pkg/index.md': '@malva-ui/core/styles/never.css',
    'libs/x/generated/api.md': '@malva-ui/core/styles/stale.css',
    'apps/docs/src/page.html': '<code>@malva-ui/tailwind/theme.css</code>',
    '.claude/projects/libs-x.md': '@malva-ui/core/styles/b.md',
    // `.claude/projects` is read one level deep and Markdown only — the flat
    // `*.md` glob the target's inputs declare — so agent memory notes (history,
    // like the changelog) and anything that is not a doc stay out.
    '.claude/projects/memory/note.md': '@malva-ui/core/styles/memory.css',
    '.claude/projects/notes.json': '"@malva-ui/core/styles/claude.css"',
    'README.md': '@import "@malva-ui/core/styles/root.css";',
    'CHANGELOG.md': 'removed @malva-ui/core/styles/old.css',
    'docs/migrations/m.md': 'gone: @malva-ui/core/styles/older.css',
  });
  // The per-library CLAUDE.md links into .claude/projects, scanned on its own.
  symlinkSync(
    join(workspace, '.claude/projects/libs-x.md'),
    join(workspace, 'libs/x/CLAUDE.md'),
  );

  const { references, scanned } = collectDocumentedAssets(workspace);
  assert.equal(scanned, 6);
  assert.deepEqual(Object.fromEntries(references.get('@malva-ui/core')), {
    'styles/a.css': [
      'libs/x/README.md:2',
      'libs/x/project.json:1',
      'libs/x/src/lib/x.ts:1',
    ],
    'styles/b.md': ['.claude/projects/libs-x.md:1'],
    'styles/root.css': ['README.md:1'],
  });
  assert.deepEqual(Object.fromEntries(references.get('@malva-ui/tailwind')), {
    'theme.css': ['apps/docs/src/page.html:1'],
  });
});

// ─── checkPackageAssets ──────────────────────────────────────────────────────

test('checkPackageAssets checks generated and documented assets together, with every location', () => {
  const workspace = fixtureTree({
    'dist/libs/fixture/package.json': {
      name: NAME,
      exports: { '.': { default: './index.mjs' } },
      sideEffects: false,
    },
    'dist/libs/fixture/index.mjs': '',
    'dist/libs/fixture/styles/a.css': 'a{}',
  });
  const project = {
    name: 'fixture',
    root: 'libs/fixture',
    packageName: NAME,
    distDir: 'dist/libs/fixture',
    projectJson: {
      targets: {
        build: { dependsOn: ['build-styles'] },
        'build-styles': {
          outputs: ['{projectRoot}/styles/a.css', '{projectRoot}/styles/b.css'],
        },
      },
    },
  };
  const documented = new Map([['styles/a.css', ['libs/fixture/README.md:3']]]);
  const { assets, problems } = checkPackageAssets(
    workspace,
    project,
    documented,
  );

  assert.deepEqual(assets, ['styles/a.css', 'styles/b.css']);
  assert.equal(problems.length, 3);
  assert.equal(
    problems[0].message,
    'styles/b.css: missing — not in the built package',
  );
  assert.match(
    problems[1].message,
    /^styles\/a\.css: not exported — `@malva-ui\/fixture\/styles\/a\.css` does not resolve \(ERR_PACKAGE_PATH_NOT_EXPORTED/,
  );
  assert.equal(
    problems[2].message,
    "styles/a.css: side-effect free — `sideEffects` lets webpack drop `import '@malva-ui/fixture/styles/a.css'` in a production build",
  );
  assert.deepEqual(problems[0].locations, [
    'libs/fixture/project.json → build-styles.outputs',
  ]);
  assert.deepEqual(problems[1].locations, [
    'libs/fixture/project.json → build-styles.outputs',
    'libs/fixture/README.md:3',
  ]);
});

// ─── checkBuildEdges ─────────────────────────────────────────────────────────

test('checkBuildEdges reports a release project the target does not build, and one it should not', () => {
  const workspace = fixtureTree({
    'project.json': {
      targets: {
        'check-dist-assets': {
          dependsOn: [{ target: 'build', projects: ['core', 'retired'] }],
        },
      },
    },
  });
  assert.deepEqual(checkBuildEdges(workspace, ['core', 'cdk']), [
    'project.json → check-dist-assets.dependsOn does not build release project `cdk`',
    'project.json → check-dist-assets.dependsOn builds `retired`, which is not in nx.json release.projects',
  ]);
});

test('checkBuildEdges reports a missing target rather than passing', () => {
  const workspace = fixtureTree({ 'project.json': { targets: {} } });
  assert.deepEqual(checkBuildEdges(workspace, ['core']), [
    'project.json declares no `check-dist-assets` target',
  ]);
});

// ─── hasFailure ──────────────────────────────────────────────────────────────

test('hasFailure fails a scan that read or found nothing, not only one with problems', () => {
  const clean = {
    scanned: 3,
    references: new Map([['@malva-ui/core', new Map()]]),
    workspaceProblems: [],
    packages: [{ problems: [] }],
  };
  assert.equal(hasFailure(clean), false);
  assert.equal(hasFailure({ ...clean, scanned: 0 }), true);
  assert.equal(hasFailure({ ...clean, references: new Map() }), true);
  assert.equal(
    hasFailure({
      ...clean,
      workspaceProblems: [{ message: 'x', locations: [] }],
    }),
    true,
  );
  assert.equal(
    hasFailure({
      ...clean,
      packages: [{ problems: [{ message: 'x', locations: [] }] }],
    }),
    true,
  );
});

// ─── The real workspace (source only — no dist needed) ───────────────────────

test('core owes the stylesheets its build-styles target generates', () => {
  const { assets, problems } = collectGeneratedAssets(
    readProject(WORKSPACE_ROOT, 'core'),
  );
  assert.deepEqual(problems, []);
  assert.deepEqual([...assets.keys()].sort(), [
    'styles/malva-ui.css',
    'styles/page-view-transitions.css',
    'styles/tokens.md',
  ]);
});

test('the docs scan finds the core and tailwind asset paths consumers are told to use', () => {
  const { references, scanned } = collectDocumentedAssets(WORKSPACE_ROOT);
  assert.ok(scanned > 1000, `scanned only ${scanned} files`);
  const core = references.get('@malva-ui/core');
  assert.ok(core?.has('styles/malva-ui.css'));
  assert.ok(core?.has('styles/page-view-transitions.css'));
  // The public JSDoc of `mlvPageViewTransitionHook` is one of the sources, so
  // the scan reads library TypeScript, not only Markdown.
  assert.ok(
    core
      .get('styles/page-view-transitions.css')
      .some((location) =>
        location.startsWith(
          'libs/core/page/src/lib/page/page-view-transition.ts:',
        ),
      ),
  );
  assert.ok(references.get('@malva-ui/tailwind')?.has('theme.css'));
});

test('the check-dist-assets target builds exactly the release projects', () => {
  assert.deepEqual(
    checkBuildEdges(WORKSPACE_ROOT, readReleaseProjects(WORKSPACE_ROOT)),
    [],
  );
});
