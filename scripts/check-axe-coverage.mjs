#!/usr/bin/env node
/**
 * Malva UI — axe coverage check.
 *
 * `.claude/rules/accessibility.md` says every component must pass all AXE
 * checks. Nothing enforced that: 23 of the 93 library projects asserted with
 * axe, and among those there were five different call shapes — including
 * `runOnly` a single rule and `not.toContain` a single rule id, which read as
 * "this component is axe clean" while checking one rule out of the 94 a
 * default sweep asks (#47).
 *
 * The tightening and the shared helper (`@malva-ui/internal-testing/axe`) fix
 * the shape. This script keeps it fixed, and asks four questions:
 *
 *   1. Does every library project that renders DOM assert with axe?
 *      "Renders DOM" is derived, not declared: a project renders DOM when any
 *      non-spec `.ts` it owns declares an `@Component` or `@Directive`. A
 *      project that declares neither cannot produce a role, a name, a state or
 *      a tab stop, so there is nothing for axe to judge.
 *   2. Is every entry in the two lists below still true? A stale exemption or a
 *      stale rollout entry is a hole nobody notices, so both are re-derived on
 *      every run and a mismatch fails.
 *   3. Does every spec go through the shared helper? A direct `axe-core` import
 *      is how the five call shapes came back. Playwright suites under a
 *      project's own top-level `e2e/` are exempt from THIS question only: they
 *      inject `axe.source` into a real browser page, where the helper's jsdom
 *      assumptions and its `vitest` `expect` do not apply. An `e2e/` file never
 *      counts as coverage for question 1 — otherwise naming a directory `e2e`
 *      would both smuggle a raw jsdom sweep past this check and mark the
 *      project covered.
 *   4. Did the walk actually see anything? Every answer above is derived from
 *      files read off disk, and "no files" and "nothing wrong" are the same
 *      answer to questions 1-3. A floor is asserted before anything is reported
 *      clean: a failed directory read, a project whose non-empty `src/` yielded
 *      no TypeScript, no library projects at all, or no DOM-rendering project
 *      at all is a finding, not an OK.
 *
 * Scope. Questions 1 and 2 — coverage, `EXEMPT`, `ROLLOUT_PENDING` — are about
 * `libs/**` library projects, which is what the issue's acceptance is about;
 * `apps/docs` renders DOM too, but its pages are examples of the libraries
 * rather than the shipped surface. Question 3 is a rule about how a spec is
 * written, and `.claude/rules/accessibility.md` states it without qualification,
 * so it is checked over `apps/**` applications as well.
 *
 * Usage:
 *   node scripts/check-axe-coverage.mjs [--json] [--quiet]
 *   yarn nx run @malva-ui/source:test
 *
 * Flags:
 *   --json    Emit the full report as JSON, both lists included.
 *   --quiet   Suppress the summary line when nothing is found.
 *
 * Exit code: 0 when clean, 1 when at least one finding is reported.
 *
 * Tested by `scripts/check-axe-coverage.spec.mjs`, which pins the three ways
 * this guard was made to pass with the defect present: a walk that saw no
 * files, a comment that merely mentions the helper, and a directory named
 * `e2e` below a project's root.
 */
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const WORKSPACE_ROOT = resolve(import.meta.dirname, '..');
const SPEC_PATTERN = /\.(spec|test)\.[cm]?[jt]sx?$/;
/**
 * The files the walk reads. Kept in step with the `{workspaceRoot}/libs/**\/*.ts`
 * family of `inputs` on the root `test` target in `project.json`: a file this
 * matches but that glob does not would change the guard's answer without
 * invalidating its cache.
 */
const SOURCE_PATTERN = /\.[cm]?tsx?$/;
const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  '.nx',
  '.git',
  'coverage',
  'tmp',
]);

/**
 * A declaration that puts an element, an attribute or a host binding in the DOM.
 *
 * Deliberately shape-bound: the decorator must open a line and be followed
 * immediately by `(`. That is the only form prettier emits, and prettier gates
 * every commit, so a decorator this misses (`@Component /* c *\/ ({`, an
 * indented one) cannot survive the hook. Matching loosely instead would let a
 * `@Component` inside a string or a doc comment mark a project as rendering DOM.
 */
export const RENDERS_DOM = /^@(Component|Directive)\(/m;
/**
 * The one sanctioned way a spec asserts accessibility — the specifier of a real
 * `import`, not a mention of it. Paired with {@link HELPER_CALL}: a project is
 * only covered when a spec both imports the helper AND calls it. A comment
 * saying "sweep this with @malva-ui/internal-testing/axe" is a note to a future
 * implementer, and counting it as coverage would make the guard tell them their
 * work is done and prescribe deleting the line that tracks it.
 */
export const HELPER_IMPORT =
  /\bfrom\s*['"]@malva-ui\/internal-testing\/axe['"]/;
/** A call to one of the helper's assertions. See {@link HELPER_IMPORT}. */
export const HELPER_CALL = /\b(expectNoAxeViolations|runAxe)\s*\(/;
/**
 * A real `axe-core` entry point: static import, `require`, or dynamic import.
 * Binding-shaped rather than a bare specifier match, so prose about `axe-core`
 * in a comment is not reported as one.
 */
export const RAW_AXE_IMPORT =
  /(?:\bfrom\s*|\brequire\s*\(\s*|\bimport\s*\(\s*)['"]axe-core['"]/;

/**
 * PERMANENT exemptions. A project belongs here only when nothing it emits can
 * change any axe rule's outcome: no element, no ARIA role/attribute/state, no
 * accessible name, no focusability, no tab order, no interactive semantics —
 * only classes, custom properties, geometry or plain data.
 *
 * "It is a directive" is not a reason. `[mlvClick]` is a directive and writes
 * `role` and `tabindex` onto an arbitrary host, so it is NOT exempt.
 *
 * `rendersDom` records the state the reason rests on, and is re-derived every
 * run. The drift check is **not** symmetric, and it is worth being precise
 * about which half it protects:
 *
 * - For a `rendersDom: false` entry it is load-bearing. The project starting to
 *   declare a component or directive fails here rather than staying quietly
 *   uncovered — that is the hole this catches.
 * - For a `rendersDom: true` entry it can only fire the other way, when the
 *   project stops declaring anything. The reason itself ("a class carries no
 *   role", "it writes nothing to the DOM") is prose about what the declaration
 *   emits, and no derived fact contradicts it, so such an entry can go stale
 *   silently. Those four reasons are re-read by hand when the project changes;
 *   a `hasAxe` sweep appearing is the only automatic signal.
 */
export const EXEMPT = {
  cdk: {
    rendersDom: false,
    reason:
      'Family barrel. `libs/cdk/src` is an `index.ts` re-export plus a test setup; every declaration it publishes is owned and swept by a leaf project.',
  },
  core: {
    rendersDom: false,
    reason:
      'Family barrel. `libs/core/src` is an `index.ts` re-export, an SSR smoke spec and the ng-add schematics; every component it publishes is owned and swept by a leaf project.',
  },
  'cdk-data-source': {
    rendersDom: false,
    reason:
      '`MlvDataSource` / `MlvArrayDataSource` are plain classes that sort, filter, search and page arrays. No decorator, no template, no host binding.',
  },
  'cdk-density': {
    rendersDom: true,
    reason:
      'The three `[mlvDensity="…"]` directives and `[mlvDensityRoot]` write exactly one thing: a CSS class (`mlv-<element>--<density>` via `Renderer2`, `mlv--<density>` via a host `[class]`). A class carries no role, name, state or focusability, so no axe rule can observe the difference between the directive applied and absent.',
  },
  'cdk-floating-container': {
    rendersDom: true,
    reason:
      "`[mlvFloatingContainer]` is an attribute component on the consumer's own footer/landmark element: `<ng-content />`, a BEM class and a `--mlv-floating-container-background` custom property. It contributes no element of its own and no ARIA; the gradient backdrop and safe-area padding are CSS geometry jsdom does not lay out.",
  },
  'cdk-infinite-scroll': {
    rendersDom: true,
    reason:
      '`[mlvInfiniteScroll]` declares no `host` block at all. It attaches a scroll listener and emits `loadMore`; it writes nothing to the DOM, so a sweep with it applied is byte-identical to one without.',
  },
  'cdk-shrink-wrap': {
    rendersDom: true,
    reason:
      '`<mlv-shrink-wrap>` renders one presentational `<span>` around projected content and `[mlvShrinkWrap]` sets an inline `max-inline-size`. Both are sizing; neither adds a role, a name or a tab stop. The effect itself is a CSS scroll-driven animation, which jsdom does not run.',
  },
  'cdk-testing-e2e': {
    rendersDom: false,
    reason:
      'Playwright fixtures, page objects and selector helpers. No Angular declaration, no TestBed, no `test` target — nothing here is ever rendered.',
  },
  'core-date': {
    rendersDom: false,
    reason:
      'The date-adapter contract (`MlvDateAdapter`, `MlvNativeDateAdapter`, the tokens and the provider). Component-less by design — see `docs/migrations/2026-09-core-date.md`.',
  },
  i18n: {
    rendersDom: false,
    reason:
      'Signal-based translation services, the ICU formatter and the language packs. Its one declaration is `MlvTranslatePipe`, and a pipe returns a string: it emits no element and no attribute of its own.',
  },
  styles: {
    rendersDom: false,
    reason:
      'Pure SCSS design tokens, themes and mixins. Its only `.ts` is an empty barrel; its suites are `.mjs` and assert on compiled CSS text.',
  },
  tailwind: {
    rendersDom: false,
    reason:
      'A Tailwind v4 `@theme` adapter (`theme.css`) plus schematics. It owns no TypeScript source at all.',
  },
};

/**
 * TEMPORARY. The projects that render DOM and had no axe assertion when #47
 * phase 1 landed. Phase 2 adds a sweep to each and deletes its line from here,
 * so this list only ever shrinks; the guard fails on an entry that has since
 * gained one, which is what keeps the deletion from being forgotten.
 *
 * It is a literal on purpose. A list computed at runtime from "which projects
 * currently lack coverage" can never fail, because it always describes exactly
 * the projects it is meant to be catching.
 *
 * Do not add to this list. A project appearing here that was not here before is
 * a regression — a covered project that lost its assertion, or a new project
 * shipped without one — and that is the case this guard exists to block.
 */
export const ROLLOUT_PENDING = [
  // libs/core
  'core-autocomplete',
  'core-color-picker',
  'core-date-range-picker',
  'core-day-picker',
  'core-dropdown',
  'core-file-upload',
  'core-form',
  'core-input',
  'core-notification',
  'core-number-input',
  'core-pin-input',
  'core-popup',
  'core-rating',
  'core-scrollbar',
  'core-scrubber',
  'core-slider',
  'core-speed-dial',
  'core-split-pane',
  'core-tabs',
  'core-textarea',
  'core-time-picker',
  'core-toast',
  'core-tokenizer',
  'core-tooltip',
  'core-tree',
];

/** Workspace-relative path with forward slashes, whatever the platform uses. */
const toPosix = (path) => path.split(sep).join('/');

/**
 * Recursively collect TypeScript files under `dir`, skipping nested projects.
 *
 * A failed read is pushed onto `errors` rather than swallowed. Swallowing it is
 * how the whole guard goes quiet: with no files walked, every project resolves
 * `rendersDom: false, hasAxe: false`, three of the four findings can no longer
 * fire, and the summary still prints OK.
 */
const collectSources = (dir, nestedRoots, found = [], errors = []) => {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    errors.push(`${toPosix(relative(WORKSPACE_ROOT, dir))}: ${error.message}`);
    return found;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      if (nestedRoots.has(relative(WORKSPACE_ROOT, full))) continue;
      collectSources(full, nestedRoots, found, errors);
    } else if (SOURCE_PATTERN.test(entry.name)) {
      found.push(toPosix(relative(WORKSPACE_ROOT, full)));
    }
  }
  return found;
};

/**
 * Every project with its resolved config, in ONE nx invocation — the same trick
 * `check-test-targets.mjs` uses, for the same reason (~25s of `nx show project`
 * against ~1s for the graph dump).
 */
const readProjects = () => {
  const dir = mkdtempSync(join(tmpdir(), 'mlv-axe-coverage-'));
  const file = join(dir, 'graph.json');
  try {
    execFileSync('npx', ['nx', 'graph', '--file', file], {
      cwd: WORKSPACE_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    const { graph } = JSON.parse(readFileSync(file, 'utf8'));
    return new Map(
      Object.entries(graph.nodes).map(([name, node]) => [name, node.data]),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

/**
 * Derives the facts about one project from the files it owns.
 *
 * Pure: the caller supplies the file list and a reader, so
 * `check-axe-coverage.spec.mjs` can pin the answers against synthetic trees
 * without an `nx graph` round trip.
 *
 * @param {{ root: string, files: readonly string[], readFile: (file: string) => string }} project
 * @returns {{ rendersDom: boolean, hasAxe: boolean, rawAxeSpecs: string[] }}
 */
export function analyzeProject({ root, files, readFile }) {
  // A project's own top-level `e2e/`, not any directory that happens to be
  // named that. An unanchored `e2e` segment is an escape hatch anyone can open
  // by naming a folder: `libs/core/button/src/lib/e2e/probe.spec.ts` is a jsdom
  // vitest spec that `core-button:test` really runs.
  const e2ePrefix = `${toPosix(root)}/e2e/`;

  let rendersDom = false;
  let usesHelper = false;
  const rawAxeSpecs = [];

  for (const file of files) {
    const text = readFile(file);
    if (!SPEC_PATTERN.test(file)) {
      if (RENDERS_DOM.test(text)) rendersDom = true;
      continue;
    }
    // A Playwright suite injects `axe.source` into a real browser page; the
    // jsdom helper (and its `vitest` `expect`) has no meaning there. That buys
    // it an exemption from the raw-import rule and NOTHING else — it is not a
    // jsdom sweep, so it cannot stand in for one.
    if (toPosix(file).startsWith(e2ePrefix)) continue;

    if (HELPER_IMPORT.test(text) && HELPER_CALL.test(text)) usesHelper = true;
    if (RAW_AXE_IMPORT.test(text)) rawAxeSpecs.push(file);
  }

  return {
    rendersDom,
    hasAxe: usesHelper || rawAxeSpecs.length > 0,
    rawAxeSpecs,
  };
}

/**
 * Turns the per-project facts into the reported findings.
 *
 * @param {{
 *   facts: Map<string, {
 *     scope: 'library' | 'application',
 *     root: string,
 *     rendersDom: boolean,
 *     hasAxe: boolean,
 *     rawAxeSpecs: string[],
 *     fileCount: number,
 *     srcNonEmpty: boolean,
 *     walkErrors: string[],
 *   }>,
 *   exempt?: Record<string, { rendersDom: boolean, reason: string }>,
 *   rolloutPending?: readonly string[],
 * }} input
 */
export function buildFindings({
  facts,
  exempt = EXEMPT,
  rolloutPending = ROLLOUT_PENDING,
}) {
  const findings = [];
  const libraries = [...facts].filter(([, fact]) => fact.scope === 'library');
  const renders = libraries.filter(([, fact]) => fact.rendersDom).length;

  // 0. The floor. Everything below is derived from files read off disk, and a
  //    walk that saw nothing answers every one of those questions with
  //    "nothing wrong". Assert the walk worked before trusting any of it.
  for (const [name, fact] of facts) {
    for (const error of fact.walkErrors) {
      findings.push({
        kind: 'walk-error',
        project: name,
        root: fact.root,
        message: `could not be walked (${error})`,
        fix: 'Fix the unreadable path. Until the walk completes, this project’s coverage answer is not evidence of anything.',
      });
    }
    if (fact.fileCount === 0 && fact.srcNonEmpty) {
      findings.push({
        kind: 'no-sources',
        project: name,
        root: fact.root,
        message:
          'has a non-empty src/ but the walk found no TypeScript in it, so every answer about it is vacuous',
        fix: 'Check SOURCE_PATTERN and IGNORED_DIRS against what the project actually holds. A project that genuinely owns no TypeScript (a CSS-only adapter) has no src/ at all and is not reported here.',
      });
    }
  }
  if (libraries.length === 0) {
    findings.push({
      kind: 'floor',
      project: '(workspace)',
      message:
        'no libs/ library projects were resolved at all — the graph or the root filter is broken, and a clean report here would mean nothing',
      fix: 'Check `nx graph` output and the libs/ + projectType filter in this file.',
    });
  } else if (renders === 0) {
    findings.push({
      kind: 'floor',
      project: '(workspace)',
      message: `resolved ${libraries.length} libs/ library project(s) but not one of them renders DOM, which cannot be true of this workspace`,
      fix: 'Check RENDERS_DOM and the walk. With no DOM-rendering project, the uncovered / stale-exempt / stale-rollout checks are all silent by construction.',
    });
  }

  // 1. Uncovered projects that neither list accounts for.
  for (const [name, fact] of libraries) {
    if (!fact.rendersDom || fact.hasAxe) continue;
    if (name in exempt || rolloutPending.includes(name)) continue;
    findings.push({
      kind: 'uncovered',
      project: name,
      root: fact.root,
      message:
        'declares an @Component/@Directive but no spec it owns asserts with axe',
      fix: "Add `await expectNoAxeViolations(host)` from '@malva-ui/internal-testing/axe' to one of its specs. If it genuinely emits nothing axe can judge, add it to EXEMPT in this file with the reason.",
    });
  }

  // 2. Stale ROLLOUT_PENDING entries.
  for (const name of rolloutPending) {
    const fact = facts.get(name);
    if (!fact || fact.scope !== 'library') {
      findings.push({
        kind: 'stale-rollout',
        project: name,
        message:
          'is listed in ROLLOUT_PENDING but is not a libs/ library project',
        fix: 'Remove the line, or correct the project name.',
      });
      continue;
    }
    if (fact.hasAxe) {
      findings.push({
        kind: 'stale-rollout',
        project: name,
        root: fact.root,
        message:
          'now asserts with axe, so its ROLLOUT_PENDING line no longer describes it',
        fix: 'Confirm the sweep is real — an import plus a call, in a spec `nx test` runs — then delete the line. That is how the rollout list shrinks (#47 phase 2).',
      });
    }
  }

  // 3. Stale EXEMPT entries.
  for (const [name, entry] of Object.entries(exempt)) {
    const fact = facts.get(name);
    if (!fact || fact.scope !== 'library') {
      findings.push({
        kind: 'stale-exempt',
        project: name,
        message: 'is listed in EXEMPT but is not a libs/ library project',
        fix: 'Remove the entry, or correct the project name.',
      });
      continue;
    }
    if (fact.rendersDom !== entry.rendersDom) {
      findings.push({
        kind: 'stale-exempt',
        project: name,
        root: fact.root,
        message: entry.rendersDom
          ? 'no longer declares an @Component/@Directive, so its exemption reason has drifted'
          : 'has started declaring an @Component/@Directive, and its exemption rests on it declaring none',
        fix: 'Re-read the reason against what the project now emits: either cover it with a sweep and delete the entry, or rewrite the reason and update `rendersDom`.',
      });
    }
    if (fact.hasAxe) {
      findings.push({
        kind: 'stale-exempt',
        project: name,
        root: fact.root,
        message: 'is exempt but does assert with axe',
        fix: 'Delete the EXEMPT entry — the sweep is the better answer and the exemption now hides it.',
      });
    }
  }

  // 4. Specs that bypass the shared helper. Applications included: this is a
  //    rule about how a spec is written, not about which surface is shipped.
  for (const [name, fact] of facts) {
    for (const spec of fact.rawAxeSpecs) {
      findings.push({
        kind: 'raw-axe-import',
        project: name,
        spec,
        message: "imports 'axe-core' directly instead of the shared helper",
        fix: "Use `expectNoAxeViolations` (or `runAxe` when the spec asserts that a violation IS raised) from '@malva-ui/internal-testing/axe'.",
      });
    }
  }

  return findings;
}

/** Walks the workspace and reports. Only runs when this file is the entry point. */
const main = () => {
  const args = new Set(process.argv.slice(2));
  const configs = readProjects();
  const roots = new Set(
    [...configs.values()].map((c) => c.root).filter((r) => r && r !== '.'),
  );

  /** Per-project facts, derived fresh on every run. */
  const facts = new Map();

  for (const [name, config] of configs) {
    const root = config.root ? toPosix(config.root) : '';
    const scope =
      root.startsWith('libs/') && config.projectType === 'library'
        ? 'library'
        : root.startsWith('apps/') && config.projectType === 'application'
          ? 'application'
          : null;
    if (!scope) continue;

    const absolute = join(WORKSPACE_ROOT, config.root);
    if (!existsSync(absolute)) continue;

    const nested = new Set([...roots].filter((r) => r !== config.root));
    const walkErrors = [];
    const walked = collectSources(absolute, nested, [], walkErrors);

    // An application is asked question 3 and nothing else, and question 3 only
    // ever reads specs. Narrowing the file list here is what keeps
    // `{workspaceRoot}/**/*.{spec,test}.*` an exactly-sufficient cache input
    // for the application half of this guard — no `apps/**/*.ts` glob needed,
    // and no application source read for an answer nothing consumes.
    const files =
      scope === 'application'
        ? walked.filter((f) => SPEC_PATTERN.test(f))
        : walked;

    const src = join(absolute, 'src');
    let srcNonEmpty = false;
    try {
      // Library-only: the floor asks whether the library walk saw anything,
      // because that walk going quiet is what silences questions 1-3. An
      // application legitimately owns sources this run never lists.
      srcNonEmpty =
        scope === 'library' && existsSync(src) && readdirSync(src).length > 0;
    } catch (error) {
      walkErrors.push(`${root}/src: ${error.message}`);
    }

    facts.set(name, {
      scope,
      root,
      fileCount: files.length,
      srcNonEmpty,
      walkErrors,
      ...analyzeProject({
        root,
        files,
        readFile: (file) => readFileSync(join(WORKSPACE_ROOT, file), 'utf8'),
      }),
    });
  }

  const findings = buildFindings({ facts });
  const libraries = [...facts.values()].filter((f) => f.scope === 'library');
  const apps = [...facts.values()].filter((f) => f.scope === 'application');
  const covered = libraries.filter((f) => f.hasAxe).length;
  const renders = libraries.filter((f) => f.rendersDom).length;

  if (args.has('--json')) {
    console.log(
      JSON.stringify(
        {
          findings,
          summary: {
            projects: libraries.length,
            apps: apps.length,
            files: [...facts.values()].reduce((n, f) => n + f.fileCount, 0),
            rendersDom: renders,
            covered,
            exempt: Object.keys(EXEMPT).length,
            rolloutPending: ROLLOUT_PENDING.length,
          },
          exempt: EXEMPT,
          rolloutPending: ROLLOUT_PENDING,
        },
        null,
        2,
      ),
    );
  } else if (findings.length > 0) {
    console.error('axe coverage findings:\n');
    for (const finding of findings) {
      const where = finding.spec ?? finding.root ?? '';
      console.error(`  ${finding.project}${where ? ` (${where})` : ''}`);
      console.error(`    ${finding.message}`);
      console.error(`    ${finding.fix}\n`);
    }
    console.error(
      `[check-axe-coverage] ${findings.length} finding(s). See #47 and .claude/rules/accessibility.md.`,
    );
  } else if (!args.has('--quiet')) {
    console.log(
      `[check-axe-coverage] ${covered}/${renders} DOM-rendering library projects assert with axe; ` +
        `${ROLLOUT_PENDING.length} pending rollout (#47), ${Object.keys(EXEMPT).length} exempt; ` +
        `${apps.length} application(s) swept for raw axe imports. OK`,
    );
  }

  process.exit(findings.length > 0 ? 1 : 0);
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
