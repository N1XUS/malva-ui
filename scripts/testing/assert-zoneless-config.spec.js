import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

/**
 * Workspace guard for the zoneless test environment.
 *
 * `scripts/testing/setup-assert-zoneless.js` checks the *resolved* runtime, but
 * it can only speak for a project whose suite actually runs: it is loaded from
 * `test.setupFiles`, so a config that never lists it, or a project with no
 * `test` target for CI to select, is invisible to it. This is the other half —
 * a static sweep of every project in the tree, run from the root
 * `@malva-ui/source:test` target, which CI selects by name.
 *
 * Together they cover both directions of the drift this exists to stop: a setup
 * that declares the wrong mode (caught here, and at runtime wherever the setup
 * file is loaded) and a runtime that stops matching the declaration (caught
 * only at runtime — a transitively loaded zone.js leaves every declaration
 * reading correctly).
 *
 * A third check covers zone-based test APIs inside the specs themselves. Note
 * what it is and is not for: most of them already fail loudly at runtime
 * without zone.js — `provideZoneChangeDetection()` throws NG0908 and
 * `fakeAsync` throws "zone-testing.js is needed" — so this is not standing
 * between the suite and a silent pass for those. It earns its place twice over
 * anyway:
 *
 *   - `NgZone.onStable` / `onMicrotaskEmpty` genuinely can pass silently.
 *     Zoneless resolves `NoopNgZone`, whose `onStable` and `onMicrotaskEmpty`
 *     are `EventEmitter`s that never emit, so a spec that subscribes and
 *     asserts in the callback never runs its assertion and goes green having
 *     tested nothing.
 *   - A project whose `vite.config.mts` never lists the runtime pin is invisible
 *     to it by construction, and so is a project with no `test` target for CI to
 *     select — the failure mode #70 was: three projects declared `vite:test`
 *     only, and both CI jobs select strictly by target name, so their spec files
 *     ran in no pipeline and no runtime error in them was ever seen.
 *     `scripts/check-test-targets.mjs` guards the target now; a static sweep is
 *     still the only thing that reaches a config which forgot the pin.
 *
 * It also turns an opaque framework error into a failure that names the
 * convention and the replacement pattern.
 *
 * The root target runs with `cwd` = workspace root, but paths are resolved from
 * this file rather than `process.cwd()` so the guard behaves the same however
 * it is invoked.
 */

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(SCRIPT_DIR, '..', '..');

/**
 * Directories that never contain workspace sources. Everything else is walked,
 * including roots that do not exist yet: the answer this guard gives depends on
 * the shape of the whole tree, so a project added outside `libs/` and `apps/`
 * must be swept too rather than silently exempted.
 */
const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  'tmp',
  'out-tsc',
  'coverage',
]);

/** The `setupFiles` entry that installs the runtime zoneless assertion. */
const PIN_SETUP_FILE = 'scripts/testing/setup-assert-zoneless.js';

/** The single spelling of the mode every project must declare. */
const DECLARATION = 'setupTestBed({ zoneless: true })';

/**
 * Matches the pin as a quoted `setupFiles` entry with any relative depth. Only
 * ever applied to `stripComments()` output, so a commented-out entry — the
 * shape a debugging session leaves behind — does not satisfy the check.
 */
const PIN_ENTRY =
  /(['"])((?:\.\.\/)*)scripts\/testing\/setup-assert-zoneless\.js\1/;

/**
 * Test files the spec ban applies to. Vitest's `include` also accepts the
 * JavaScript extensions, but every Angular spec here is TypeScript and the
 * `.js` / `.mjs` test files are Node-only guards — this one among them, whose
 * own source necessarily spells out every banned token.
 */
const SPEC_FILE = /\.(spec|test)\.(ts|mts|cts|tsx)$/;

/**
 * Zone-dependent test APIs, none of which may appear in a spec.
 *
 * `onStable` / `onMicrotaskEmpty` are the load-bearing entries — the two that
 * can pass silently rather than throw (see the header). The rest are listed
 * because they cannot work zoneless either way, so naming them here reports the
 * convention and its replacement instead of a framework error about a file
 * nobody meant to need.
 *
 * Deliberately absent: bare `NgZone`. Library *source* keeps its considered
 * `runOutsideAngular` call sites (issue #37/#13), and one spec type-imports
 * `NgZone` for a hand-rolled stub — none of which put a spec on zones.
 */
const BANNED_IN_SPECS = [
  {
    pattern: /\bprovideZoneChangeDetection\b/,
    token: 'provideZoneChangeDetection',
  },
  { pattern: /\bfakeAsync\b/, token: 'fakeAsync' },
  { pattern: /\bwaitForAsync\b/, token: 'waitForAsync' },
  { pattern: /\bonMicrotaskEmpty\b/, token: 'onMicrotaskEmpty' },
  { pattern: /\bonStable\b/, token: 'onStable' },
  { pattern: /(['"])zone\.js(\/[^'"]*)?\1/, token: "an import of 'zone.js'" },
];

/**
 * Every file in the workspace, minus the directories that never hold sources.
 * Walked once and filtered per check: the answer this guard gives depends on
 * the shape of the whole tree, so a project added outside `libs/` and `apps/`
 * must be swept too rather than silently exempted.
 */
async function findFiles() {
  const found = [];

  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && !IGNORED_DIRS.has(entry.name)) {
          await walk(path);
        }
      } else {
        found.push(path);
      }
    }
  }

  await walk(WORKSPACE_ROOT);

  return found.sort();
}

const read = (path) => readFileSync(path, 'utf8');
const rel = (path) => relative(WORKSPACE_ROOT, path);

/**
 * Drops line and block comments. String literals are an alternative of the same
 * pattern and are handed back untouched, so a `//` inside a path or a URL never
 * reads as the start of a comment. A regex literal could, but these configs
 * carry none — and a mis-read there could only hide the pin, never invent one.
 */
const stripComments = (source) =>
  source.replace(
    /(['"`])(?:\\.|(?!\1)[^\\])*\1|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,
    (match) => (match.startsWith('/') ? '' : match),
  );

/** The pin entry a vitest config really declares, ignoring commented-out ones. */
const pinEntry = (path) => stripComments(read(path)).match(PIN_ENTRY);

const files = await findFiles();
const testSetups = files.filter((path) => basename(path) === 'test-setup.ts');
const viteConfigs = files.filter(
  (path) => basename(path) === 'vite.config.mts',
);
const specs = files.filter((path) => SPEC_FILE.test(path));

describe('zoneless test environment', () => {
  it('finds a test setup and a vitest config in every project', () => {
    assert.ok(testSetups.length > 0, 'no src/test-setup.ts files found at all');
    assert.deepEqual(
      viteConfigs.map((path) => dirname(rel(path))).sort(),
      testSetups.map((path) => dirname(dirname(rel(path)))).sort(),
      'every project with a vite.config.mts must own a src/test-setup.ts, and vice versa',
    );
  });

  it('declares zoneless in every test setup', () => {
    const offenders = testSetups
      .filter((path) => !read(path).includes(DECLARATION))
      .map(rel);

    assert.deepEqual(
      offenders,
      [],
      `these test setups do not call \`${DECLARATION}\`. The library is ` +
        'zoneless-only: components are authored for ' +
        '`provideZonelessChangeDetection()` and no suite loads zone.js. Angular ' +
        "22's TestBed resolves zoneless regardless of this flag, so a wrong " +
        'value here goes unnoticed at runtime — which is exactly why it is ' +
        'checked statically.',
    );
  });

  it('loads the runtime zoneless assertion from every vitest config', () => {
    const offenders = viteConfigs.filter((path) => !pinEntry(path)).map(rel);

    assert.deepEqual(
      offenders,
      [],
      `these vitest configs do not list \`${PIN_SETUP_FILE}\` in ` +
        '`test.setupFiles`, so their suites never assert the mode they run in.',
    );
  });

  it('points every vitest config at the real setup file', () => {
    const offenders = viteConfigs
      .filter((path) => {
        const [, , upwards = ''] = pinEntry(path) ?? [];
        return !existsSync(
          resolve(
            dirname(path),
            upwards,
            'scripts/testing/setup-assert-zoneless.js',
          ),
        );
      })
      .map(rel);

    assert.deepEqual(
      offenders,
      [],
      'these vitest configs reference the zoneless setup file at a relative ' +
        'depth that does not resolve — vitest would fail to load it.',
    );
  });

  it('keeps zone-based test APIs out of every spec', () => {
    assert.ok(specs.length > 0, 'no TypeScript spec files found at all');

    const offenders = [];
    for (const path of specs) {
      const source = read(path);
      for (const { pattern, token } of BANNED_IN_SPECS) {
        if (pattern.test(source)) {
          offenders.push(`${rel(path)}: ${token}`);
        }
      }
    }

    assert.deepEqual(
      offenders,
      [],
      'these specs use zone-based test APIs. The library is zoneless-only. ' +
        '`provideZoneChangeDetection`/`fakeAsync`/`waitForAsync` throw without ' +
        'zone.js, but `onStable`/`onMicrotaskEmpty` do not: zoneless resolves ' +
        '`NoopNgZone`, whose emitters never fire, so a callback asserting on ' +
        'them never runs and the spec goes green having tested nothing. Use ' +
        '`await fixture.whenStable()` after a signal write instead.',
    );
  });
});
