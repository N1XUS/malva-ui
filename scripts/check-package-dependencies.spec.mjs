import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';

import {
  DECLARATION_EXCEPTIONS,
  WORKSPACE_ROOT,
  checkPackage,
  collectSpecifiers,
  exceptionKey,
  findEntryPoints,
  groupFindings,
  hasFailure,
  isRelative,
  lineOf,
  packageNameOf,
  readReleaseProjects,
  resolveRelative,
  scanWorkspace,
} from './check-package-dependencies.mjs';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const temporaryDirectories = [];

after(() => {
  for (const dir of temporaryDirectories) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * Materialises a package on disk from a `path → contents` map and returns its
 * root. A `package.json` is written from `manifest`; every other path is
 * written verbatim, creating parent directories as needed.
 */
function fixturePackage(manifest, files) {
  const root = mkdtempSync(join(tmpdir(), 'mlv-deps-'));
  temporaryDirectories.push(root);

  const write = (relativePath, contents) => {
    const full = join(root, relativePath);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, contents);
  };

  write('package.json', JSON.stringify(manifest, null, 2));
  for (const [path, contents] of Object.entries(files)) write(path, contents);
  return root;
}

/** The standard single-entry-point shape every published package here uses. */
const ENTRY_POINT = JSON.stringify({ lib: { entryFile: 'src/index.ts' } });

/** Runs the check over a fixture, returning it rooted at the fixture itself. */
const check = (root) => checkPackage(root, 'fixture', root);

/** Just the `dependency` names a fixture reports, in report order. */
const undeclared = (root) => check(root).findings.map((f) => f.dependency);

// ─── packageNameOf ───────────────────────────────────────────────────────────

test('packageNameOf resolves a subpath back to the package npm installs', () => {
  assert.equal(packageNameOf('@angular/common/http'), '@angular/common');
  assert.equal(packageNameOf('@malva-ui/cdk/density'), '@malva-ui/cdk');
  assert.equal(packageNameOf('rxjs/operators'), 'rxjs');
});

test('packageNameOf returns the package itself when there is no subpath', () => {
  assert.equal(packageNameOf('@angular/router'), '@angular/router');
  assert.equal(packageNameOf('lodash-es'), 'lodash-es');
});

test('packageNameOf ignores paths, which are resolved from disk not installed', () => {
  assert.equal(packageNameOf('./thing'), null);
  assert.equal(packageNameOf('../lib/thing'), null);
  assert.equal(packageNameOf('/abs/thing'), null);
});

// Both spellings resolve to the same builtin, and neither is installable.
test('packageNameOf ignores Node builtins in either spelling', () => {
  assert.equal(packageNameOf('node:fs'), null);
  assert.equal(packageNameOf('fs'), null);
  assert.equal(packageNameOf('path'), null);
  assert.equal(packageNameOf('node:fs/promises'), null);
});

test('packageNameOf ignores a bare scope, which names no package', () => {
  assert.equal(packageNameOf('@angular'), null);
  assert.equal(packageNameOf(''), null);
});

test('isRelative accepts only the two path prefixes, not a scope', () => {
  assert.equal(isRelative('./x'), true);
  assert.equal(isRelative('../x'), true);
  assert.equal(isRelative('@angular/router'), false);
  assert.equal(isRelative('rxjs'), false);
});

// ─── collectSpecifiers ───────────────────────────────────────────────────────

test('collectSpecifiers reads every import form a published source can use', () => {
  const specifiers = collectSpecifiers(`
    import 'side-effect';
    import def from 'default-import';
    import * as ns from 'namespace-import';
    import { named } from 'named-import';
    import type { T } from 'type-import';
    export { thing } from 'export-from';
    export * from 'export-star';
    export type { U } from 'export-type-from';
    const lazy = () => import('dynamic-import');
    const legacy = require('require-call');
  `).map(({ specifier }) => specifier);

  for (const expected of [
    'side-effect',
    'default-import',
    'namespace-import',
    'named-import',
    'type-import',
    'export-from',
    'export-star',
    'export-type-from',
    'dynamic-import',
    'require-call',
  ]) {
    assert.ok(
      specifiers.includes(expected),
      `expected ${expected} among ${specifiers.join(', ')}`,
    );
  }
});

// The whole reason this goes through the TypeScript scanner rather than a
// regex: a regex over `(import|export).*from ['"]…['"]` matches the prose and
// the test name below, and every such match is a package the gate would demand
// a declaration for.
test('collectSpecifiers does not see an import written inside a comment', () => {
  const specifiers = collectSpecifiers(`
    // import { RouterLink } from '@angular/router';
    /* export * from 'not-a-package'; */
    import { real } from 'real-package';
  `).map(({ specifier }) => specifier);

  assert.deepEqual(specifiers, ['real-package']);
});

test('collectSpecifiers does not see an import written inside a string', () => {
  const specifiers = collectSpecifiers(
    'it("warns on import { x } from \'phantom-package\'", () => {});',
  ).map(({ specifier }) => specifier);

  assert.deepEqual(specifiers, []);
});

test('lineOf reports the 1-based line a specifier was written on', () => {
  const source = "import a from 'a';\nimport b from 'b';\n";
  const [, second] = collectSpecifiers(source);
  assert.equal(lineOf(source, second.pos), 2);
});

// ─── resolveRelative ─────────────────────────────────────────────────────────

test('resolveRelative finds a sibling module by appending an extension', () => {
  const root = fixturePackage(
    { name: 'x' },
    {
      'src/index.ts': '',
      'src/thing.ts': '',
    },
  );
  assert.equal(
    resolveRelative(join(root, 'src/index.ts'), './thing'),
    join(root, 'src/thing.ts'),
  );
});

test("resolveRelative finds a directory's index", () => {
  const root = fixturePackage(
    { name: 'x' },
    {
      'src/index.ts': '',
      'src/lib/index.ts': '',
    },
  );
  assert.equal(
    resolveRelative(join(root, 'src/index.ts'), './lib'),
    join(root, 'src/lib/index.ts'),
  );
});

// TypeScript lets an ESM-style specifier name the `.ts` that emits it.
test('resolveRelative maps an ESM-style .js specifier onto its .ts source', () => {
  const root = fixturePackage(
    { name: 'x' },
    {
      'src/index.ts': '',
      'src/thing.ts': '',
    },
  );
  assert.equal(
    resolveRelative(join(root, 'src/index.ts'), './thing.js'),
    join(root, 'src/thing.ts'),
  );
});

test('resolveRelative returns null rather than guessing at a missing file', () => {
  const root = fixturePackage({ name: 'x' }, { 'src/index.ts': '' });
  assert.equal(resolveRelative(join(root, 'src/index.ts'), './gone'), null);
});

// ─── findEntryPoints ─────────────────────────────────────────────────────────

test('findEntryPoints returns one entry file per ng-package.json, nested included', () => {
  const root = fixturePackage(
    { name: 'x' },
    {
      'ng-package.json': ENTRY_POINT,
      'src/index.ts': '',
      'nested/ng-package.json': ENTRY_POINT,
      'nested/src/index.ts': '',
    },
  );

  const { entryFiles, manifests, manifestsWithoutEntryFile } =
    findEntryPoints(root);
  assert.deepEqual(entryFiles, [
    join(root, 'nested/src/index.ts'),
    join(root, 'src/index.ts'),
  ]);
  assert.equal(manifests, 2);
  assert.deepEqual(manifestsWithoutEntryFile, []);
});

test('findEntryPoints ignores a directory with no ng-package.json above it', () => {
  const root = fixturePackage(
    { name: 'x' },
    {
      'ng-package.json': ENTRY_POINT,
      'src/index.ts': '',
      'testing-e2e/src/index.ts': "import { test } from '@playwright/test';",
    },
  );

  assert.deepEqual(findEntryPoints(root).entryFiles, [
    join(root, 'src/index.ts'),
  ]);
});

// The third under-scanning hole, and the one the report used to miss entirely.
// Each secondary entry point is reachable ONLY through its own manifest — the
// root barrel re-exports through bare self-name subpaths that resolve to the
// package itself and are never followed — so a manifest whose `lib.entryFile`
// this cannot read takes its whole subtree out of the walk in silence.
test('findEntryPoints counts a manifest that yields no entry file', () => {
  const root = fixturePackage(
    { name: 'x' },
    {
      'ng-package.json': ENTRY_POINT,
      'src/index.ts': '',
      'nested/ng-package.json': JSON.stringify({
        lib: { entryFileX: 'src/index.ts' },
      }),
      'nested/src/index.ts': '',
    },
  );

  const { entryFiles, manifests, manifestsWithoutEntryFile } =
    findEntryPoints(root);
  assert.equal(entryFiles.length, 1);
  assert.equal(manifests, 2);
  assert.deepEqual(manifestsWithoutEntryFile, [
    join(root, 'nested/ng-package.json'),
  ]);
});

// The regression in full, at the level the guard actually reports: an entry
// point silently leaves the walk AND the dependency it alone imported stops
// being demanded. Both halves are asserted, because fixing only the count
// would leave the finding invisible.
test('checkPackage flags an entry point whose manifest lost its entryFile', () => {
  const files = {
    'ng-package.json': ENTRY_POINT,
    'src/index.ts': '',
    'drawer/src/index.ts': "import { cloneDeep } from 'lodash-es';",
  };

  const intact = fixturePackage(
    { name: '@fixture/pkg' },
    {
      ...files,
      'drawer/ng-package.json': ENTRY_POINT,
    },
  );
  assert.deepEqual(undeclared(intact), ['lodash-es']);
  assert.deepEqual(check(intact).manifestsWithoutEntryFile, []);

  const broken = fixturePackage(
    { name: '@fixture/pkg' },
    {
      ...files,
      'drawer/ng-package.json': JSON.stringify({
        lib: { entryFileX: 'src/index.ts' },
      }),
    },
  );
  const result = check(broken);
  assert.deepEqual(
    result.findings,
    [],
    'the finding is gone — that is the bug',
  );
  assert.deepEqual(result.manifestsWithoutEntryFile, [
    join('drawer', 'ng-package.json'),
  ]);
});

// ─── checkPackage ────────────────────────────────────────────────────────────

test('checkPackage reports a bare import the manifest declares nowhere', () => {
  const root = fixturePackage(
    { name: '@fixture/pkg', peerDependencies: { '@angular/core': '22' } },
    {
      'ng-package.json': ENTRY_POINT,
      'src/index.ts': "export * from './lib/thing';",
      'src/lib/thing.ts':
        "import { inject } from '@angular/core';\nimport { RouterLink } from '@angular/router';\n",
    },
  );

  const { findings } = check(root);
  assert.deepEqual(
    findings.map((f) => f.dependency),
    ['@angular/router'],
  );
  assert.equal(findings[0].package, '@fixture/pkg');
  assert.equal(findings[0].line, 2);
});

test('checkPackage accepts a declaration from dependencies or peerDependencies', () => {
  const root = fixturePackage(
    {
      name: '@fixture/pkg',
      dependencies: { 'lodash-es': '^4' },
      peerDependencies: { rxjs: '~7' },
    },
    {
      'ng-package.json': ENTRY_POINT,
      'src/index.ts':
        "import { cloneDeep } from 'lodash-es';\nimport { Subject } from 'rxjs';\n",
    },
  );

  assert.deepEqual(undeclared(root), []);
});

test('checkPackage accepts a subpath of a declared package', () => {
  const root = fixturePackage(
    { name: '@fixture/pkg', peerDependencies: { '@angular/common': '22' } },
    {
      'ng-package.json': ENTRY_POINT,
      'src/index.ts': "import { HttpClient } from '@angular/common/http';",
    },
  );

  assert.deepEqual(undeclared(root), []);
});

// A secondary entry point of the package itself is the same package to npm.
test("checkPackage accepts a self-import through the package's own name", () => {
  const root = fixturePackage(
    { name: '@fixture/pkg' },
    {
      'ng-package.json': ENTRY_POINT,
      'src/index.ts': "export * from '@fixture/pkg/other';",
    },
  );

  assert.deepEqual(undeclared(root), []);
});

// The precision that makes the graph walk worth its complexity: this file is
// inside the entry point's `src/` tree, and a directory walk would report it.
test('checkPackage ignores a source no entry file reaches', () => {
  const root = fixturePackage(
    { name: '@fixture/pkg' },
    {
      'ng-package.json': ENTRY_POINT,
      'src/index.ts': "export * from './lib/shipped';",
      'src/lib/shipped.ts': 'export const shipped = 1;',
      'src/lib/testing/helper.ts': "import { expect } from 'vitest';",
      'src/lib/shipped.spec.ts': "import { expect } from 'vitest';",
    },
  );

  assert.deepEqual(undeclared(root), []);
  assert.equal(check(root).scanned, 2);
});

test('checkPackage follows a relative import out of the entry point directory', () => {
  const root = fixturePackage(
    { name: '@fixture/pkg' },
    {
      'ng-package.json': ENTRY_POINT,
      'src/index.ts': "export * from '../shared/thing';",
      'shared/thing.ts': "import { RouterLink } from '@angular/router';",
    },
  );

  assert.deepEqual(undeclared(root), ['@angular/router']);
});

// A subtree nothing read is a subtree whose imports were never examined, which
// is the one way a graph walk can pass green on a tree it should fail.
test('checkPackage reports an unresolvable relative import rather than skipping it', () => {
  const root = fixturePackage(
    { name: '@fixture/pkg' },
    {
      'ng-package.json': ENTRY_POINT,
      'src/index.ts': "export * from './lib/gone';",
    },
  );

  const { unresolved } = check(root);
  assert.equal(unresolved.length, 1);
  assert.equal(unresolved[0].specifier, './lib/gone');
});

test('checkPackage reports a missing entry file as unresolved', () => {
  const root = fixturePackage(
    { name: '@fixture/pkg' },
    {
      'ng-package.json': ENTRY_POINT,
    },
  );

  assert.equal(check(root).unresolved.length, 1);
});

test('checkPackage reports no entry points for a package that compiles no TypeScript', () => {
  const root = fixturePackage(
    { name: '@fixture/pkg' },
    {
      'theme.css': ':root { --x: 1; }',
    },
  );

  const result = check(root);
  assert.equal(result.entryPoints, 0);
  assert.equal(result.scanned, 0);
  assert.deepEqual(result.findings, []);
});

test('checkPackage visits each source once however many times it is imported', () => {
  const root = fixturePackage(
    { name: '@fixture/pkg' },
    {
      'ng-package.json': ENTRY_POINT,
      'src/index.ts': "export * from './a';\nexport * from './b';",
      'src/a.ts': "export * from './shared';",
      'src/b.ts': "export * from './shared';",
      'src/shared.ts': "import { RouterLink } from '@angular/router';",
    },
  );

  assert.deepEqual(undeclared(root), ['@angular/router']);
  assert.equal(check(root).scanned, 4);
});

// ─── Exceptions ──────────────────────────────────────────────────────────────

// #243 emptied DECLARATION_EXCEPTIONS, so every rule about an entry's shape now
// has nothing to iterate and would pass having asserted nothing. The rules are
// therefore stated once, as a function, and checked BOTH ways: against
// synthetic entries, which is what keeps them alive while the list is empty,
// and against the real list, which is what makes them bite when it is not.
/**
 * Every way one {@link DECLARATION_EXCEPTIONS} entry can be malformed, as a
 * list of human-readable defects — empty for a well-formed entry.
 */
function exceptionDefects(entry) {
  const defects = [];

  if (!/DEFERRED|CLEAN/.test(entry.reason)) {
    defects.push('must say whether it is DEFERRED or CLEAN');
  }
  if (entry.reason.length <= 120) {
    defects.push('needs a reason, not a label');
  }
  // A deferred exception is a real finding someone has to come back to. Without
  // a number the coming back is nobody's, and the entry outlives the intent —
  // the same rot the unused-exception check exists to stop, one level up.
  if (/DEFERRED/.test(entry.reason) && !/#\d+/.test(entry.reason)) {
    defects.push('is deferred and must cite an issue');
  }

  return defects;
}

/** A well-formed entry, as the rules above read one. */
const WELL_FORMED_EXCEPTION = {
  package: '@fixture/pkg',
  dependency: 'vitest',
  files: /^libs\/fixture\//,
  reason:
    'DEFERRED, not clean — a real finding of exactly this class, left for its own change, ' +
    'because the only two fixes available are owner calls rather than the one-line ' +
    'declaration this check recommends. Tracked as #1.',
};

test('the exception shape rules accept a well-formed entry', () => {
  assert.deepEqual(exceptionDefects(WELL_FORMED_EXCEPTION), []);
});

test('the exception shape rules reject every way an entry can rot', () => {
  const reason = WELL_FORMED_EXCEPTION.reason;

  assert.deepEqual(
    exceptionDefects({
      ...WELL_FORMED_EXCEPTION,
      reason: reason.replace('DEFERRED', 'deferred-ish'),
    }),
    ['must say whether it is DEFERRED or CLEAN'],
  );

  assert.deepEqual(
    exceptionDefects({ ...WELL_FORMED_EXCEPTION, reason: 'CLEAN' }),
    ['needs a reason, not a label'],
  );

  assert.deepEqual(
    exceptionDefects({
      ...WELL_FORMED_EXCEPTION,
      reason: reason.replace('#1', 'an issue'),
    }),
    ['is deferred and must cite an issue'],
  );
});

test('every exception says whether it is clean or deferred, and why', () => {
  for (const exception of DECLARATION_EXCEPTIONS) {
    assert.deepEqual(
      exceptionDefects(exception),
      [],
      `${exception.package} → ${exception.dependency}`,
    );
  }
});

// The narrowing is the whole reason an exception is safe to have at all: it must
// suppress the one import it names and stay out of the way of every other. The
// list is empty, so this drives a synthetic entry through the real
// `checkPackage` rather than asserting on a shipped one.
test('an exception suppresses only the files it names, not the dependency', () => {
  const root = fixturePackage(
    { name: '@fixture/pkg' },
    {
      'ng-package.json': ENTRY_POINT,
      'src/index.ts':
        "export * from './testing/helper';\nexport * from './lib/widget';",
      'src/testing/helper.ts': "import { expect } from 'vitest';",
      'src/lib/widget.ts': "import { vi } from 'vitest';",
    },
  );

  DECLARATION_EXCEPTIONS.push({
    ...WELL_FORMED_EXCEPTION,
    package: '@fixture/pkg',
    files: /(^|\/)src\/testing\//,
  });

  try {
    const result = checkPackage(root, 'fixture', root);
    assert.deepEqual(
      result.findings.map((finding) => finding.file),
      ['src/lib/widget.ts'],
    );
    assert.deepEqual(result.exercisedExceptions, [
      exceptionKey(DECLARATION_EXCEPTIONS.at(-1)),
    ]);
  } finally {
    DECLARATION_EXCEPTIONS.pop();
  }
});

// Two entries sharing a package and a dependency but scoped to different files
// are different promises. Keyed on the pair alone they mark each other used,
// and a dead one rots undetected — the failure this key exists to prevent.
test('the exception key separates entries that differ only by files', () => {
  const base = { package: '@malva-ui/core', dependency: 'vitest' };
  assert.notEqual(
    exceptionKey({ ...base, files: /^libs\/core\/form-utils\/testing\// }),
    exceptionKey({ ...base, files: /^libs\/core\/drawer\// }),
  );
  assert.equal(
    exceptionKey({ ...base, files: /^libs\/core\// }),
    exceptionKey({ ...base, files: /^libs\/core\// }),
  );
});

// ─── Exit condition ──────────────────────────────────────────────────────────

/** A clean scan, as the shape `hasFailure` reads it. */
const CLEAN_SCAN = {
  scanned: 12,
  entryPointsWithoutEntryFile: [],
  unresolved: [],
  unusedExceptions: [],
  findings: [],
};

test('hasFailure is false only for a scan with nothing wrong in it', () => {
  assert.equal(hasFailure(CLEAN_SCAN), false);
});

// `--json` and the human report used to compute this separately, and had
// drifted: a rotted DECLARATION_EXCEPTIONS list exited 1 on the human path and
// 0 on the JSON one, so anything consuming the JSON in CI passed green on it.
// One predicate, so every failing shape fails both paths.
test('hasFailure is true for every shape either report path fails on', () => {
  for (const [name, overrides] of [
    ['a walk that read nothing', { scanned: 0 }],
    [
      'an entry point whose manifest lost its entryFile',
      {
        entryPointsWithoutEntryFile: [
          {
            package: '@malva-ui/core',
            manifest: 'libs/core/drawer/ng-package.json',
          },
        ],
      },
    ],
    ['an unresolvable relative import', { unresolved: [{ file: 'a.ts' }] }],
    [
      'a rotted exception',
      { unusedExceptions: [{ package: 'p', dependency: 'd' }] },
    ],
    [
      'an undeclared dependency',
      { findings: [{ dependency: '@angular/router' }] },
    ],
  ]) {
    assert.equal(
      hasFailure({ ...CLEAN_SCAN, ...overrides }),
      true,
      `${name} must fail both the human report and --json`,
    );
  }
});

// ─── Workspace ───────────────────────────────────────────────────────────────

test('readReleaseProjects reads nx.json rather than a hardcoded list', () => {
  const projects = readReleaseProjects(WORKSPACE_ROOT);
  assert.ok(projects.includes('core'));
  assert.ok(projects.includes('taskboard'));
});

test('the workspace scan reads sources and leaves no exception unexercised', () => {
  const result = scanWorkspace(WORKSPACE_ROOT);

  // The floor: a walk that read nothing reports zero findings, which is
  // byte-identical to a clean tree.
  assert.ok(result.scanned > 0, 'the traversal must actually read sources');
  assert.deepEqual(result.unresolved, []);
  assert.deepEqual(result.entryPointsWithoutEntryFile, []);
  assert.deepEqual(result.unusedExceptions, []);
  assert.equal(hasFailure(result), false);
});

// Every `ng-package.json` the walk meets must have yielded an entry file, or an
// entry point left the walk unread. Equal today (108 = 108), so the assertion
// costs nothing; it is here for the day one of them stops being read.
test('every ng-package.json the walk finds yields an entry point', () => {
  for (const entry of scanWorkspace(WORKSPACE_ROOT).packages) {
    assert.equal(
      entry.manifests,
      entry.entryPoints,
      `${entry.package}: ${entry.manifests} manifest(s) but ${entry.entryPoints} entry point(s)`,
    );
  }
});

test('the workspace scan finds every published package', () => {
  const result = scanWorkspace(WORKSPACE_ROOT);
  assert.equal(
    result.packages.length,
    readReleaseProjects(WORKSPACE_ROOT).length,
  );
  assert.ok(
    result.packages.some((entry) => entry.package === '@malva-ui/core'),
  );
});

// #242: `@malva-ui/core` imports `@angular/router` in nine entry points, so the
// declaration has to be there. Asserted against the real manifest rather than a
// fixture, because the fixture cannot regress.
test('@malva-ui/core declares the @angular/router it imports', () => {
  const core = scanWorkspace(WORKSPACE_ROOT).packages.find(
    (entry) => entry.package === '@malva-ui/core',
  );
  assert.deepEqual(
    core.findings.map((f) => `${f.dependency} (${f.file})`),
    [],
  );
});

test('groupFindings groups by package and then by dependency', () => {
  const grouped = groupFindings([
    { package: 'a', dependency: 'x', file: 'one.ts' },
    { package: 'a', dependency: 'x', file: 'two.ts' },
    { package: 'a', dependency: 'y', file: 'three.ts' },
    { package: 'b', dependency: 'x', file: 'four.ts' },
  ]);

  assert.deepEqual([...grouped.keys()], ['a', 'b']);
  assert.deepEqual([...grouped.get('a').keys()], ['x', 'y']);
  assert.equal(grouped.get('a').get('x').length, 2);
});
