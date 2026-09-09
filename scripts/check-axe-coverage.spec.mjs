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

import {
  analyzeProject,
  buildFindings,
  normalizeRolloutPending,
  stripComments,
} from './check-axe-coverage.mjs';

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

/**
 * Builds a fact map entry with the defaults a healthy walk would produce.
 *
 * `sweeps` is derived from `hasAxe` rather than defaulted flat, so a caller that
 * flips `hasAxe: false` cannot leave a contradictory sweep list behind. Pass
 * `sweeps` explicitly to override the derivation.
 */
const fact = (overrides = {}) => {
  const base = {
    scope: 'library',
    root: 'libs/core/thing',
    rendersDom: true,
    hasAxe: true,
    rawAxeSpecs: [],
    fileCount: 3,
    srcNonEmpty: true,
    walkErrors: [],
    ...overrides,
  };
  return {
    sweeps: base.hasAxe
      ? [{ spec: `${base.root}/src/lib/thing.spec.ts`, root: 'host' }]
      : [],
    ...base,
  };
};

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

describe('analyzeProject — sweep evidence (#257)', () => {
  it('records one entry per helper call, with the root as written', () => {
    const result = analyze('libs/core/thing', {
      'libs/core/thing/src/lib/thing.ts': COMPONENT,
      'libs/core/thing/src/lib/thing.spec.ts':
        "import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';\n" +
        'await expectNoAxeViolations(fixture.nativeElement);\n' +
        'await expectNoAxeViolations(document.body, { rules: {} });\n',
    });
    assert.deepEqual(result.sweeps, [
      {
        spec: 'libs/core/thing/src/lib/thing.spec.ts',
        root: 'fixture.nativeElement',
      },
      { spec: 'libs/core/thing/src/lib/thing.spec.ts', root: 'document.body' },
    ]);
  });

  it('keeps a root containing its own parens and commas intact', () => {
    // The overlay-shaped root the ticket is about. Stopping at the first `)`
    // or `,` would report `document.querySelector('.cdk-overlay-container'` —
    // evidence that misleads the reviewer it exists to inform.
    const result = analyze('libs/core/thing', {
      'libs/core/thing/src/lib/thing.ts': COMPONENT,
      'libs/core/thing/src/lib/thing.spec.ts':
        "import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';\n" +
        "await expectNoAxeViolations(document.querySelector('.cdk-overlay-container, .x')!);\n",
    });
    assert.deepEqual(result.sweeps, [
      {
        spec: 'libs/core/thing/src/lib/thing.spec.ts',
        root: "document.querySelector('.cdk-overlay-container, .x')!",
      },
    ]);
  });

  it('records no sweep for a file that calls the helper without importing it', () => {
    // Same rule `hasAxe` has always used: the import and the call must be in
    // the same file. Evidence and coverage must not be able to disagree.
    const result = analyze('libs/core/thing', {
      'libs/core/thing/src/lib/thing.ts': COMPONENT,
      'libs/core/thing/src/lib/thing.spec.ts':
        'await expectNoAxeViolations(host);\n',
    });
    assert.equal(result.hasAxe, false);
    assert.deepEqual(result.sweeps, []);
  });
});

describe('buildFindings — partial rollout entries (#257)', () => {
  /** The finding shape the assertions below read, minus the prose. */
  const summarize = (findings) =>
    findings.map((f) => [f.kind, f.project, f.reason]);

  it('lets a partially-swept project keep its ROLLOUT_PENDING line', () => {
    // The acceptance criterion. `core-tooltip` renders its whole panel into a
    // CDK overlay; one closed-state sweep is not coverage of the panel, and
    // before #257 that single sweep FORCED the line to be deleted.
    const findings = buildFindings({
      facts: new Map([
        [
          'core-tooltip',
          fact({
            hasAxe: true,
            sweeps: [
              {
                spec: 'libs/core/tooltip/src/lib/tooltip/tooltip.spec.ts',
                root: 'fixture.nativeElement',
              },
            ],
          }),
        ],
      ]),
      exempt: {},
      rolloutPending: [{ project: 'core-tooltip', owes: ['open panel'] }],
    });
    assert.deepEqual(findings, []);
  });

  it('still reports a BARE entry that gained a sweep, and carries the evidence', () => {
    const findings = buildFindings({
      facts: new Map([
        [
          'core-a',
          fact({
            hasAxe: true,
            sweeps: [
              {
                spec: 'libs/core/a/src/a.spec.ts',
                root: 'fixture.nativeElement',
              },
            ],
          }),
        ],
      ]),
      exempt: {},
      rolloutPending: ['core-a'],
    });
    assert.deepEqual(summarize(findings), [
      ['stale-rollout', 'core-a', 'gained-sweep'],
    ]);
    // Direction 3: the reviewer sees "1 sweep, and against what" at the moment
    // they are deciding whether to retire the line or annotate it.
    assert.equal(findings[0].sweepCount, 1);
    assert.deepEqual(findings[0].sweepRoots, ['fixture.nativeElement']);
    assert.match(findings[0].fix, /owes/);
  });

  it('reports a partial entry whose project asserts with axe nowhere', () => {
    // The other direction, and what keeps `owes` falsifiable: an annotation
    // claiming partial coverage over a project with NO sweep is a lie, and
    // without this check `owes` would be an unfalsifiable permanent silencer.
    const findings = buildFindings({
      facts: new Map([['core-a', fact({ hasAxe: false })]]),
      exempt: {},
      rolloutPending: [{ project: 'core-a', owes: ['open panel'] }],
    });
    assert.deepEqual(summarize(findings), [
      ['stale-rollout', 'core-a', 'no-sweep'],
    ]);
  });

  it('reports a partial entry naming no project', () => {
    const findings = buildFindings({
      facts: new Map([['core-a', fact()]]),
      exempt: {},
      rolloutPending: [{ project: 'core-ghost', owes: ['open panel'] }],
    });
    assert.deepEqual(summarize(findings), [
      ['stale-rollout', 'core-ghost', 'unknown-project'],
    ]);
  });

  it('suppresses `uncovered` for a partial entry, as a bare one does', () => {
    const findings = buildFindings({
      facts: new Map([['core-a', fact({ hasAxe: true })]]),
      exempt: {},
      rolloutPending: [{ project: 'core-a', owes: ['open panel'] }],
    });
    assert.deepEqual(findings, []);
  });

  for (const [label, entry] of [
    ['an empty owes list', { project: 'core-a', owes: [] }],
    ['owes that is not an array', { project: 'core-a', owes: 'open panel' }],
    ['an owes entry that is not a string', { project: 'core-a', owes: [7] }],
    ['a blank owes entry', { project: 'core-a', owes: ['  '] }],
    ['no project key', { owes: ['open panel'] }],
    ['an empty string', ''],
    ['null', null],
  ]) {
    it(`reports ${label} as malformed rather than silently dropping it`, () => {
      // A malformed entry that normalized to nothing would remove the project
      // from the tracker AND from the `uncovered` question in one step — the
      // silent hole this guard exists to make impossible.
      const findings = buildFindings({
        facts: new Map([['core-a', fact({ hasAxe: false })]]),
        exempt: {},
        rolloutPending: [entry],
      });
      const stale = findings.filter((f) => f.kind === 'stale-rollout');
      assert.deepEqual(
        stale.map((f) => f.reason),
        ['malformed'],
      );
    });
  }

  it('does not let a malformed entry suppress `uncovered`', () => {
    const findings = buildFindings({
      facts: new Map([['core-a', fact({ hasAxe: false })]]),
      exempt: {},
      rolloutPending: [{ project: 'core-a', owes: [] }],
    });
    assert.deepEqual(findings.map((f) => f.kind).sort(), [
      'stale-rollout',
      'uncovered',
    ]);
  });

  it('reports a partial entry whose only coverage is a banned raw axe import', () => {
    // `hasAxe` is also true for a project that reaches axe by the banned route,
    // and an entry claiming "some states ARE swept" cannot be describing that.
    // The `no-sweep` check reads `sweeps`, which is helper calls only.
    const findings = buildFindings({
      facts: new Map([
        [
          'core-a',
          fact({
            hasAxe: true,
            sweeps: [],
            rawAxeSpecs: ['libs/core/a/src/a.spec.ts'],
          }),
        ],
      ]),
      exempt: {},
      rolloutPending: [{ project: 'core-a', owes: ['open panel'] }],
    });
    assert.deepEqual(
      findings.map((f) => [f.kind, f.reason ?? null]),
      [
        ['stale-rollout', 'no-sweep'],
        ['raw-axe-import', null],
      ],
    );
  });
});

describe('normalizeRolloutPending — directly (#257)', () => {
  it('reads a bare name as "nothing swept" and an object as "partially swept"', () => {
    assert.deepEqual(
      normalizeRolloutPending([
        'core-a',
        { project: 'core-b', owes: ['open'] },
      ]),
      [
        { project: 'core-a', owes: null, malformed: null },
        { project: 'core-b', owes: ['open'], malformed: null },
      ],
    );
  });

  it('copies `owes` rather than aliasing the caller’s array', () => {
    // ROLLOUT_PENDING is a module-level literal read on every run; handing its
    // arrays out by reference would let a consumer mutate the source of truth.
    const owes = ['open panel'];
    const [entry] = normalizeRolloutPending([{ project: 'core-a', owes }]);
    assert.notEqual(entry.owes, owes);
    assert.deepEqual(entry.owes, owes);
  });

  it('names the index of an entry it cannot get a project name out of', () => {
    const [, second] = normalizeRolloutPending(['core-a', { owes: ['x'] }]);
    assert.equal(second.project, '(entry 1)');
    assert.match(second.malformed, /non-empty `project`/);
  });

  it('keeps a malformed entry in the list instead of dropping it', () => {
    // Length is the assertion: a dropped entry would take the project out of
    // the tracker AND out of `uncovered` in one step.
    assert.equal(normalizeRolloutPending([null, 'core-a', 7]).length, 3);
  });
});

describe('stripComments — a commented-out call is not a call (#257)', () => {
  const SPEC_WITH_IMPORT =
    "import { expectNoAxeViolations } from '@malva-ui/internal-testing/axe';\n";

  it('does not credit a spec whose only assertion is commented out', () => {
    // The import stays, the call is disabled. Before this the project read as
    // covered AND the evidence channel printed `document.body` for an
    // assertion that never runs — which points a reviewer at deleting the
    // ROLLOUT_PENDING line, the exact conclusion #257 exists to prevent.
    const result = analyze('libs/core/thing', {
      'libs/core/thing/src/lib/thing.ts': COMPONENT,
      'libs/core/thing/src/lib/thing.spec.ts': `${SPEC_WITH_IMPORT}// await expectNoAxeViolations(document.body);\n`,
    });
    assert.equal(result.hasAxe, false);
    assert.deepEqual(result.sweeps, []);
  });

  it('does not credit a block-commented assertion either', () => {
    const result = analyze('libs/core/thing', {
      'libs/core/thing/src/lib/thing.ts': COMPONENT,
      'libs/core/thing/src/lib/thing.spec.ts': `${SPEC_WITH_IMPORT}/* await expectNoAxeViolations(document.body); */\n`,
    });
    assert.equal(result.hasAxe, false);
    assert.deepEqual(result.sweeps, []);
  });

  it('leaves a `//` inside a string literal alone', () => {
    // The reason the stripper is quote-aware rather than a regex: a URL in a
    // spec must not blank out the rest of its line.
    const result = analyze('libs/core/thing', {
      'libs/core/thing/src/lib/thing.ts': COMPONENT,
      'libs/core/thing/src/lib/thing.spec.ts': `${SPEC_WITH_IMPORT}const u = 'https://x.test'; await expectNoAxeViolations(host);\n`,
    });
    assert.equal(result.hasAxe, true);
    assert.deepEqual(
      result.sweeps.map((s) => s.root),
      ['host'],
    );
  });

  it('reads through a comment written inside a multi-line call', () => {
    // `// the dialog's overlay` is ordinary, and its apostrophe used to open
    // quote mode and run the reported root to the next `'` in the file.
    const result = analyze('libs/core/thing', {
      'libs/core/thing/src/lib/thing.ts': COMPONENT,
      'libs/core/thing/src/lib/thing.spec.ts': `${SPEC_WITH_IMPORT}await expectNoAxeViolations(\n  // the dialog's overlay\n  document.body,\n);\nconst after = 1;\n`,
    });
    assert.deepEqual(
      result.sweeps.map((s) => s.root),
      ['document.body'],
    );
  });

  it('keeps a block comment’s newlines so the file’s line structure survives', () => {
    assert.equal(stripComments('a\n/* x\ny */\nb'), 'a\n    \n    \nb');
  });

  it('does not let an unterminated quote swallow the rest of the file', () => {
    // `'` and `"` cannot span a raw newline in valid TypeScript, so a newline
    // means the opening quote was not one.
    assert.equal(
      stripComments("a = 'oops\n// gone\nb"),
      "a = 'oops\n       \nb",
    );
  });
});

describe('buildFindings — the floor and EXEMPT branches', () => {
  it('reports `floor` when the walk resolved no library projects at all', () => {
    // Pins the FIRST arm specifically: with zero libraries `renders === 0` too,
    // so deleting this condition still produces a finding — one that names the
    // wrong cause. The message is the assertion.
    const findings = buildFindings({
      facts: new Map(),
      exempt: {},
      rolloutPending: [],
    });
    assert.deepEqual(
      findings.map((f) => f.kind),
      ['floor'],
    );
    assert.match(
      findings[0].message,
      /no libs\/ library projects were resolved/,
    );
  });

  it('reports an EXEMPT project that has started asserting with axe', () => {
    // A second, DOM-rendering project so the `renders === 0` floor stays quiet
    // and the exemption is the only thing under test.
    const findings = buildFindings({
      facts: new Map([
        ['core-a', fact({ rendersDom: false, hasAxe: true })],
        ['core-b', fact()],
      ]),
      exempt: { 'core-a': { rendersDom: false, reason: 'Tokens only.' } },
      rolloutPending: [],
    });
    assert.deepEqual(
      findings.map((f) => [f.kind, f.message]),
      [['stale-exempt', 'is exempt but does assert with axe']],
    );
  });
});
