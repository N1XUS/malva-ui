#!/usr/bin/env node
/**
 * Malva UI — orphaned unit-suite check
 *
 * `nx.json` registers `@nx/vitest` with `"testTargetName": "vite:test"`, so the
 * plugin-inferred unit-test target is NOT called `test` anywhere in this
 * workspace. Both CI jobs (.github/workflows/ci.yml) select strictly by target
 * name — `nx affected -t lint test …` / `nx run-many -t lint test …` — and nx
 * has no aliasing between the two names. A project therefore only runs in CI
 * because it hand-declares an explicit `test` target in its own project.json.
 *
 * That makes the wiring invisible when it is missing: `nx run <project>:vite:test`
 * works locally, the specs pass, and nothing anywhere reports that CI never ran
 * them. `apps/docs` (36 files / 339 tests) and `libs/core/table` sat in exactly
 * that state — docs since the workspace's first commit — until a stale spec on
 * main went unreported and the gap was traced back (#63, #70).
 *
 * The question this check asks is therefore about SPEC FILES, not about
 * projects: for every `*.spec.*` / `*.test.*` in the workspace, is there a
 * `test` target that actually runs it? Each spec is attributed to the innermost
 * nx project containing it, and that project's `test` target is classified:
 *
 *   - Executor-driven (`@nx/vitest:test`, …) — the executor resolves its own
 *     include globs from the project's vite config, so its specs are covered.
 *   - `nx:run-commands` invoking a glob-driven runner (`vitest`, `jest`) — same.
 *   - `nx:run-commands` enumerating files (`node --test a.spec.mjs b.spec.mjs`)
 *     or NO `test` target at all — every owned spec must appear verbatim in
 *     some `test` target's command text, anywhere in the workspace.
 *
 * The last rule is what covers the deliberate cross-project arrangements
 * without a hand-maintained allow-list, and keeps verifying them:
 *   - `scripts/testing/strip-css-layers.spec.js` (project
 *     `@malva-ui/internal-testing`, which owns no `test` target) is run by the
 *     root `@malva-ui/source:test`, per .claude/projects/best-practices.md.
 *   - `scripts/check-padding-tokens.spec.mjs` and
 *     `scripts/check-disabled-surface.spec.mjs` (attributed to the root
 *     project, whose own command runs neither) are run by `styles:test`.
 * Drop any of them from the command that runs it and this check fails, instead
 * of the suite silently going unrun.
 *
 * It also covers the non-vitest suites (styles, tailwind, i18n, the workspace
 * root), since it asks about the target name CI selects rather than about
 * vitest.
 *
 * Usage:
 *   node scripts/check-test-targets.mjs [--json] [--quiet]
 *   yarn nx run @malva-ui/source:test
 *
 * Flags:
 *   --json    Emit findings as JSON instead of a human-readable report.
 *   --quiet   Suppress the summary line when nothing is found.
 *
 * Exit code: 0 when clean, 1 when at least one uncovered suite is found.
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
import { join, relative, resolve } from 'node:path';

const WORKSPACE_ROOT = resolve(import.meta.dirname, '..');
const SPEC_PATTERN = /\.(spec|test)\.[cm]?[jt]sx?$/;
const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  '.nx',
  '.git',
  'coverage',
  'tmp',
]);

/**
 * Runners that discover their own spec files from config globs. A `test` target
 * driving one of these covers every spec its project owns, so there is nothing
 * to enumerate.
 */
const GLOB_DRIVEN_RUNNER = /\b(vitest|jest)\b/;

/** Recursively collect spec/test files under `dir`, skipping nested projects. */
const collectSpecs = (dir, nestedRoots, found = []) => {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      // A spec inside a nested project belongs to that project, not this one.
      if (nestedRoots.has(relative(WORKSPACE_ROOT, full))) continue;
      collectSpecs(full, nestedRoots, found);
    } else if (SPEC_PATTERN.test(entry.name)) {
      found.push(relative(WORKSPACE_ROOT, full));
    }
  }
  return found;
};

/**
 * Every project with its fully resolved targets, in ONE nx invocation.
 * `nx show project <name>` per project is the same data but spawns a process
 * each time — ~25s across this workspace, against ~1s for the graph dump.
 */
const readProjects = () => {
  const dir = mkdtempSync(join(tmpdir(), 'mlv-test-targets-'));
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
 * The shell command(s) a target runs, as one string. `nx:run-commands` accepts
 * a single `command` string or a `commands` array whose entries are either
 * strings or `{ command }` objects; read every shape.
 */
const commandTextOf = (target) => {
  const options = target?.options ?? {};
  return [options.command, ...(options.commands ?? [])]
    .filter(Boolean)
    .map((entry) => (typeof entry === 'string' ? entry : entry.command))
    .filter(Boolean)
    .join('\n');
};

const args = new Set(process.argv.slice(2));
const configs = readProjects();

// Project roots, so a parent project does not claim a child's specs.
const roots = new Set(
  [...configs.values()].map((c) => c.root).filter((r) => r && r !== '.'),
);

// Every `test` target's command text, so a spec run by ANOTHER project's target
// is verified against the command that actually names it.
const allTestCommands = [...configs.values()]
  .map((config) => commandTextOf(config.targets?.test))
  .filter(Boolean)
  .join('\n');

const findings = [];
const delegated = [];

for (const [name, config] of configs) {
  const root =
    config.root === '.' ? WORKSPACE_ROOT : join(WORKSPACE_ROOT, config.root);
  if (!existsSync(root)) continue;
  const nested = new Set([...roots].filter((r) => r !== config.root));
  const specs = collectSpecs(root, nested);
  if (specs.length === 0) continue;

  const target = config.targets?.test;
  const command = commandTextOf(target);
  // An executor resolves its own includes; so does a run-commands target that
  // shells out to vitest/jest. Either way the project's specs are covered.
  if (target && (!command || GLOB_DRIVEN_RUNNER.test(command))) continue;

  const uncovered = specs.filter((spec) => !allTestCommands.includes(spec));
  if (uncovered.length === 0) {
    if (!target) delegated.push({ project: name, specs: specs.length });
    continue;
  }

  findings.push({
    project: name,
    root: config.root,
    specs: uncovered,
    hasTarget: Boolean(target),
    reason: target
      ? "declares a `test` target that enumerates its spec files, but these are named by no `test` target's command"
      : 'owns spec files that no `test` target runs, so CI never runs them',
  });
}

if (args.has('--json')) {
  console.log(JSON.stringify({ findings, delegated }, null, 2));
} else if (findings.length > 0) {
  console.error('Unrun unit suites — these never run in CI:\n');
  for (const f of findings) {
    console.error(`  ${f.project} (${f.root})`);
    console.error(`    ${f.reason}`);
    for (const spec of f.specs.slice(0, 5)) console.error(`      ${spec}`);
    if (f.specs.length > 5) {
      console.error(`      … and ${f.specs.length - 5} more`);
    }
    console.error('');
  }
  if (findings.some((f) => !f.hasTarget)) {
    console.error(
      'Add a `test` target to the project.json, matching its peers:\n\n' +
        '  "test": {\n' +
        '    "executor": "@nx/vitest:test",\n' +
        '    "options": { "config": "<project-root>/vite.config.mts" }\n' +
        '  }\n\n' +
        'Or, for a suite deliberately run by another project, add its files to\n' +
        "that project's `test` command.\n",
    );
  }
} else if (!args.has('--quiet')) {
  const note = delegated.length
    ? ` (${delegated.length} run through another project's target)`
    : '';
  console.log(`Every spec file is run by a \`test\` target${note}.`);
}

process.exit(findings.length > 0 ? 1 : 0);
