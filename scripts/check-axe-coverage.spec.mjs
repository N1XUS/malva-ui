/**
 * Tests for `scripts/check-axe-coverage.mjs`.
 *
 * The guard is a guard: the failure mode that matters is not "it reports the
 * wrong thing", it is "it reports nothing and exits 0". Every case here is a
 * way that happened during review — a walk that saw no files, a spec that only
 * *mentions* the helper in a comment, and a directory named `e2e` anywhere in a
 * project. All three left the guard green while the thing it exists to catch
 * was present.
 *
 * Runs as part of `nx run @malva-ui/source:test` (see the root `project.json`).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { analyzeProject, buildFindings } from './check-axe-coverage.mjs';

/** A spec that imports the helper and calls it — real coverage. */
const COVERED_SPEC = `
import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';

it('is clean', async () => {
  await expectNoAxeViolations(host);
});
`;

/** A component source, in the shape prettier emits. */
const COMPONENT = `
@Component({ selector: 'mlv-thing' })
export class MlvThing {}
`;

/** Builds a fact map entry with the defaults a healthy walk would produce. */
const fact = (overrides = {}) => ({
  scope: 'library',
  root: 'libs/core/thing',
  rendersDom: true,
  hasAxe: true,
  rawAxeSpecs: [],
  fileCount: 3,
  srcNonEmpty: true,
  walkErrors: [],
  ...overrides,
});

/** Runs `analyzeProject` over an in-memory `{ path: text }` tree. */
const analyze = (root, tree) =>
  analyzeProject({
    root,
    files: Object.keys(tree),
    readFile: (file) => tree[file],
  });

describe('analyzeProject — what counts as coverage', () => {
  it('counts a spec that imports the helper and calls it', () => {
    const result = analyze('libs/core/thing', {
      'libs/core/thing/src/lib/thing.ts': COMPONENT,
      'libs/core/thing/src/lib/thing.spec.ts': COVERED_SPEC,
    });
    assert.equal(result.rendersDom, true);
    assert.equal(result.hasAxe, true);
    assert.deepEqual(result.rawAxeSpecs, []);
  });

  it('does NOT count a comment that merely mentions the helper', () => {
    // The exact line that defeated the first implementation. Counting it made
    // the guard report the project "now asserts with axe" and prescribe
    // deleting the ROLLOUT_PENDING line that was tracking it — turning the
    // mechanism that remembers the rollout into the one that forgets it.
    const result = analyze('libs/core/thing', {
      'libs/core/thing/src/lib/thing.ts': COMPONENT,
      'libs/core/thing/src/lib/thing.spec.ts':
        "it('does things', () => {});\n" +
        '// TODO(#47 phase 2): sweep this with @malva-ui/internal-testing/axe\n',
    });
    assert.equal(result.hasAxe, false);
  });

  it('does NOT count an import with no call', () => {
    const result = analyze('libs/core/thing', {
      'libs/core/thing/src/lib/thing.ts': COMPONENT,
      'libs/core/thing/src/lib/thing.spec.ts':
        "import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';\n" +
        "it('does things', () => {});\n",
    });
    assert.equal(result.hasAxe, false);
  });

  it('does NOT count a non-spec source that calls the helper', () => {
    const result = analyze('libs/core/thing', {
      'libs/core/thing/src/lib/thing.ts': `${COMPONENT}\n${COVERED_SPEC}`,
    });
    assert.equal(result.hasAxe, false);
  });
});

describe('analyzeProject — the e2e exemption', () => {
  const RAW = "import axe from 'axe-core';\nawait axe.run(document.body);\n";

  it("exempts the project's own top-level e2e/ from the raw-import rule", () => {
    const result = analyze('libs/editor', {
      'libs/editor/src/lib/editor.ts': COMPONENT,
      'libs/editor/e2e/editor.spec.ts': RAW,
    });
    assert.deepEqual(result.rawAxeSpecs, []);
  });

  it('grants that e2e file no coverage — a browser suite is not a jsdom sweep', () => {
    const result = analyze('libs/editor', {
      'libs/editor/src/lib/editor.ts': COMPONENT,
      'libs/editor/e2e/editor.spec.ts': RAW,
    });
    assert.equal(result.hasAxe, false);
  });

  it('does NOT exempt a nested directory that happens to be named e2e', () => {
    // `libs/core/button/src/lib/e2e/probe.spec.ts` is a jsdom vitest spec that
    // `core-button:test` really runs. Matching any `e2e` path segment let it
    // both smuggle a raw sweep past the rule and mark the project covered —
    // reachable by naming a directory.
    const result = analyze('libs/core/button', {
      'libs/core/button/src/lib/button.ts': COMPONENT,
      'libs/core/button/src/lib/e2e/probe.spec.ts': RAW,
    });
    assert.deepEqual(result.rawAxeSpecs, [
      'libs/core/button/src/lib/e2e/probe.spec.ts',
    ]);
    // It is treated as the ordinary raw-importing spec it is: reported, and
    // therefore also counted as asserting with axe. The run fails on the
    // report, so the count is never what a reader is left with.
    assert.equal(result.hasAxe, true);
  });

  it('reports a raw axe import in an ordinary spec', () => {
    const result = analyze('libs/core/button', {
      'libs/core/button/src/lib/button.spec.ts': RAW,
    });
    assert.deepEqual(result.rawAxeSpecs, [
      'libs/core/button/src/lib/button.spec.ts',
    ]);
  });

  it('does not report prose about axe-core in a comment', () => {
    const result = analyze('libs/core/button', {
      'libs/core/button/src/lib/button.spec.ts':
        "// Do not import 'axe-core' here; use the shared helper.\n",
    });
    assert.deepEqual(result.rawAxeSpecs, []);
  });
});

describe('buildFindings — the floor', () => {
  const kinds = (findings) => findings.map((f) => f.kind);

  it('fails when no library project was resolved at all', () => {
    const findings = buildFindings({
      facts: new Map(),
      exempt: {},
      rolloutPending: [],
    });
    assert.ok(kinds(findings).includes('floor'), 'expected a floor finding');
  });

  it('fails when the walk found files but nothing renders DOM', () => {
    // The blind-walk shape: `readdirSync` throws, `collectSources` returns [],
    // every project resolves `rendersDom: false, hasAxe: false`, and the
    // uncovered / stale-exempt / stale-rollout checks are all silent by
    // construction while the summary still prints OK.
    const findings = buildFindings({
      facts: new Map([
        [
          'core-a',
          fact({
            rendersDom: false,
            hasAxe: false,
            fileCount: 0,
            srcNonEmpty: false,
          }),
        ],
        [
          'core-b',
          fact({
            rendersDom: false,
            hasAxe: false,
            fileCount: 0,
            srcNonEmpty: false,
          }),
        ],
      ]),
      exempt: {},
      rolloutPending: [],
    });
    assert.ok(kinds(findings).includes('floor'), 'expected a floor finding');
  });

  it('fails on a project whose non-empty src/ yielded no TypeScript', () => {
    const findings = buildFindings({
      facts: new Map([
        ['core-a', fact()],
        ['core-b', fact({ fileCount: 0, srcNonEmpty: true })],
      ]),
      exempt: {},
      rolloutPending: [],
    });
    assert.ok(kinds(findings).includes('no-sources'));
  });

  it('does not fail a project that owns no src/ at all', () => {
    const findings = buildFindings({
      facts: new Map([
        ['core-a', fact()],
        [
          'tailwind',
          fact({
            fileCount: 0,
            srcNonEmpty: false,
            rendersDom: false,
            hasAxe: false,
          }),
        ],
      ]),
      exempt: {},
      rolloutPending: [],
    });
    assert.deepEqual(kinds(findings), []);
  });

  it('reports a failed directory read instead of swallowing it', () => {
    const findings = buildFindings({
      facts: new Map([
        ['core-a', fact({ walkErrors: ['libs/core/a/src: EACCES'] })],
      ]),
      exempt: {},
      rolloutPending: [],
    });
    assert.ok(kinds(findings).includes('walk-error'));
  });
});

describe('buildFindings — the two lists', () => {
  it('reports a DOM-rendering project on neither list', () => {
    const findings = buildFindings({
      facts: new Map([['core-a', fact({ hasAxe: false })]]),
      exempt: {},
      rolloutPending: [],
    });
    assert.deepEqual(
      findings.map((f) => [f.kind, f.project]),
      [['uncovered', 'core-a']],
    );
  });

  it('stays quiet about a project on ROLLOUT_PENDING', () => {
    const findings = buildFindings({
      facts: new Map([['core-a', fact({ hasAxe: false })]]),
      exempt: {},
      rolloutPending: ['core-a'],
    });
    assert.deepEqual(findings, []);
  });

  it('reports a ROLLOUT_PENDING entry that has since gained a sweep', () => {
    const findings = buildFindings({
      facts: new Map([['core-a', fact({ hasAxe: true })]]),
      exempt: {},
      rolloutPending: ['core-a'],
    });
    assert.deepEqual(
      findings.map((f) => f.kind),
      ['stale-rollout'],
    );
  });

  it('reports an EXEMPT entry whose rendersDom no longer matches', () => {
    const findings = buildFindings({
      facts: new Map([['core-a', fact({ hasAxe: false, rendersDom: true })]]),
      exempt: { 'core-a': { rendersDom: false, reason: 'plain classes' } },
      rolloutPending: [],
    });
    assert.deepEqual(
      findings.map((f) => f.kind),
      ['stale-exempt'],
    );
  });

  it('leaves coverage questions to libraries but sweeps applications for raw imports', () => {
    const findings = buildFindings({
      facts: new Map([
        ['core-a', fact()],
        [
          'docs',
          fact({
            scope: 'application',
            root: 'apps/docs',
            hasAxe: true,
            rawAxeSpecs: ['apps/docs/src/app/x.spec.ts'],
          }),
        ],
        [
          'other-app',
          fact({
            scope: 'application',
            root: 'apps/other',
            rendersDom: true,
            hasAxe: false,
          }),
        ],
      ]),
      exempt: {},
      rolloutPending: [],
    });
    // `other-app` renders DOM with no sweep and is deliberately NOT reported;
    // only the raw import in `docs` is.
    assert.deepEqual(
      findings.map((f) => [f.kind, f.project]),
      [['raw-axe-import', 'docs']],
    );
  });
});
