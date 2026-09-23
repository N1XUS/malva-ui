#!/usr/bin/env node
/**
 * Malva UI — dist manifest contract check
 *
 * Every release package is built, and then asked what a consumer who installs
 * it would actually get:
 *
 *   • every target its `exports` map declares exists
 *     ({@link collectBrokenExports});
 *   • every **asset** it owes a consumer — each file a `build` prerequisite
 *     generates inside the package, and each `@malva-ui/<pkg>/<path>` asset the
 *     docs tell a consumer to use — is shipped, packed, resolvable as a bare
 *     specifier through `exports`, and, for a stylesheet, not dropped as
 *     side-effect free ({@link collectAssetProblems}).
 *
 * #310 is the worked example of why the source tree cannot answer this. #275
 * added `styles/page-view-transitions.scss` to `core:build-styles` and told
 * consumers to add `node_modules/@malva-ui/core/styles/page-view-transitions.css`
 * to `angular.json`, but `libs/core/ng-package.json` only copies the assets its
 * glob names — so the compiled file stayed in the git-ignored source folder,
 * and the next release would have shipped a documented path that fails
 * `ng build` for every consumer who follows it. And
 * `@import '@malva-ui/core/styles/malva-ui.css'`, the form Vite and Tailwind v4
 * setups write, never resolved at all: core generated an `exports` map with no
 * `./styles/*` subpath. Every in-repo consumer resolves `@malva-ui/*` through
 * `tsconfig.base.json` paths or a `node_modules/…` file path, so nothing here
 * could see either.
 *
 * ─── What counts as an asset ────────────────────────────────────────────────
 *
 * Two derivations, neither a hand-maintained list:
 *
 *   • **Generated** — every `outputs` entry of a same-project target the
 *     `build` target `dependsOn` (`core:build-styles`), when it lands inside
 *     the package root, is owed at the same relative path in dist. TypeScript
 *     and JavaScript outputs are compiler input, not assets, and are skipped;
 *     a directory or glob output cannot be mapped to a file and is reported,
 *     never silently skipped.
 *   • **Documented** — every `@malva-ui/<pkg>/<path>.{css,scss,md}`
 *     reference ({@link ASSET_REFERENCE}), bare or behind `node_modules/`, in
 *     library and app sources and docs ({@link DOCUMENTATION_ROOTS}, recursive,
 *     specs excluded; plus the `*.md` files directly in
 *     {@link FLAT_DOCUMENTATION_ROOTS} except {@link UNSCANNED_ROOT_DOCUMENTS}).
 *     A reference to a `@malva-ui/*` package that is not in `release.projects`
 *     is reported too: nobody can install it.
 *
 * Both forms of a documented path are held to the bare-specifier standard: a
 * `node_modules/…` file path bypasses `exports`, but the same file written as
 * `@import '@malva-ui/core/styles/…'` must also work.
 *
 * ─── Build freshness ────────────────────────────────────────────────────────
 *
 * The answer is only as fresh as `dist/`, so the `check-dist-assets` target
 * `dependsOn` the `build` of every release project, and this script fails —
 * rather than racing a concurrent build in CI — when that list stops matching
 * `nx.json` → `release.projects` ({@link checkBuildEdges}).
 *
 * Usage:
 *   yarn nx run @malva-ui/source:check-dist-assets
 *   node scripts/check-dist-assets.mjs [--json]   (only against a fresh dist/)
 *
 * Exit code: 0 when every package honours the contract, 1 otherwise.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { readReleaseProjects } from './check-package-dependencies.mjs';
import { collectAssetProblems, collectBrokenExports } from './dist-exports.mjs';

// ─── Configuration ───────────────────────────────────────────────────────────

/** Workspace root, resolved from this file rather than from `process.cwd()`. */
export const WORKSPACE_ROOT = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '..',
);

/** Directory holding every published package, keyed by `release.projects` name. */
export const PACKAGES_ROOT = 'libs';

/** The root-project target that runs this script; its `dependsOn` is checked. */
export const CHECK_TARGET = 'check-dist-assets';

/**
 * Trees scanned recursively for documented asset paths, at
 * {@link SCANNED_EXTENSIONS}. `docs/` (migration history) is not among them,
 * deliberately: a migration names a path in order to say it is gone.
 */
export const DOCUMENTATION_ROOTS = ['libs', 'apps'];

/**
 * Directories whose `*.md` files are scanned **one level deep only** — the
 * workspace root and the project docs. Flat on purpose: it is exactly the
 * `{workspaceRoot}/*.md` and `{workspaceRoot}/.claude/projects/*.md` globs the
 * target's `inputs` declare, so the cache key and the scan cannot drift, and it
 * keeps `.claude/projects/memory/` out — agent memory notes are history, the
 * same reason the changelog is skipped.
 */
export const FLAT_DOCUMENTATION_ROOTS = ['.', '.claude/projects'];

/**
 * Root-level Markdown files that are *not* scanned: a changelog records paths
 * that were later removed on purpose.
 */
export const UNSCANNED_ROOT_DOCUMENTS = new Set(['CHANGELOG.md']);

/**
 * Spec and test files are not read. A spec may name a path in order to assert
 * it is absent, and every positive reference a spec makes is duplicated in the
 * source it tests (the ng-add schematic and its spec name the same stylesheet).
 */
const TEST_FILE = /\.(spec|test)\.[^./]+$/;

/** Extensions of the files a documented asset path is read from. */
const SCANNED_EXTENSIONS = new Set([
  '.ts',
  '.mts',
  '.cts',
  '.js',
  '.mjs',
  '.cjs',
  '.scss',
  '.css',
  '.md',
  '.html',
  '.json',
]);

/**
 * Directory names never descended into. `generated` is the git-ignored
 * `apps/docs/src/generated` API extract, a stale copy of library JSDoc.
 */
const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  'tmp',
  'out-tsc',
  'coverage',
  'test-results',
  'generated',
  '.angular',
  '.git',
  '.nx',
]);

/** Build outputs that feed the compiler rather than ship as files. */
const COMPILER_INPUT = /\.(ts|mts|cts|tsx|js|mjs|cjs)$/;

/**
 * An asset path written in docs or source: `@malva-ui/<pkg>/<path>.<ext>`,
 * optionally behind `node_modules/`. Only stylesheet and Markdown assets — a
 * JavaScript entry point is covered by the `exports` check, and a `.json` path
 * (`@malva-ui/core/package.json`, `schematics/collection.json`) names a
 * manifest a tool reads by file path, not something a consumer imports, so
 * holding it to the bare-specifier standard would demand a public `exports`
 * path for it. `.json` *files* are still read as sources. A `*` ends the
 * match, so a glob written in prose (`styles/*.css`) is never read as a path.
 */
export const ASSET_REFERENCE =
  /(?:node_modules\/)?@malva-ui\/([a-z0-9-]+)\/((?:[\w.-]+\/)*[\w.-]+\.(?:css|scss|md))(?![\w-])/g;

// ─── Derivation ──────────────────────────────────────────────────────────────

/**
 * Where a release project lives and what it publishes as.
 *
 * @param {string} workspaceRoot Absolute path to the workspace root.
 * @param {string} name A `release.projects` entry, e.g. `core`.
 */
export function readProject(workspaceRoot, name) {
  const root = `${PACKAGES_ROOT}/${name}`;
  const read = (file) =>
    JSON.parse(readFileSync(join(workspaceRoot, root, file), 'utf8'));
  return {
    name,
    root,
    packageName: read('package.json').name,
    // Mirrors every `build` target's `{workspaceRoot}/dist/{projectRoot}`
    // output and the `distDir`s `scripts/publish.mjs` publishes from.
    distDir: `dist/${root}`,
    projectJson: read('project.json'),
  };
}

/**
 * Files a `build` prerequisite writes inside the package root, keyed by their
 * path relative to it (`styles/malva-ui.css`), each owed at the same path in
 * dist.
 *
 * @param {ReturnType<typeof readProject>} project
 * @returns {{ assets: Map<string, string>, problems: string[] }} `assets` maps
 * each subpath to the `project.json` entry that generates it.
 */
export function collectGeneratedAssets(project) {
  const targets = project.projectJson.targets ?? {};
  const prerequisites = (targets.build?.dependsOn ?? []).flatMap((entry) => {
    if (typeof entry === 'string') return entry.startsWith('^') ? [] : [entry];
    const sameProject =
      entry &&
      typeof entry.target === 'string' &&
      !entry.dependencies &&
      (entry.projects === undefined || entry.projects === 'self');
    return sameProject ? [entry.target] : [];
  });

  const assets = new Map();
  const problems = [];
  for (const target of prerequisites) {
    for (const output of targets[target]?.outputs ?? []) {
      const path = output
        .replaceAll('{projectRoot}', project.root)
        .replace(/^\{workspaceRoot\}\//, '');
      if (!path.startsWith(`${project.root}/`)) continue;
      const subpath = path.slice(project.root.length + 1);
      if (COMPILER_INPUT.test(subpath)) continue;
      if (/[*?{}[\]]/.test(subpath) || !extname(subpath)) {
        problems.push(
          `${project.root}/project.json → ${target}.outputs: \`${output}\` is not a single file, so the dist path it is owed at cannot be derived — list its files`,
        );
        continue;
      }
      assets.set(subpath, `${project.root}/project.json → ${target}.outputs`);
    }
  }
  return { assets, problems };
}

/**
 * Every file under `dir` a documented path may be read from, skipping
 * {@link IGNORED_DIRECTORIES}, spec and test files ({@link TEST_FILE}), and
 * every symlink — the per-library `CLAUDE.md` links point into
 * `.claude/projects/`, which is scanned in its own right.
 *
 * @param {string} dir Absolute directory path.
 * @param {string[]} files Accumulator.
 */
function collectScannableFiles(dir, files) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name))
        collectScannableFiles(full, files);
    } else if (
      entry.isFile() &&
      SCANNED_EXTENSIONS.has(extname(entry.name)) &&
      !TEST_FILE.test(entry.name)
    ) {
      files.push(full);
    }
  }
}

/**
 * Every documented `@malva-ui/<pkg>/<path>` asset path, grouped by package.
 *
 * @param {string} workspaceRoot Absolute path to the workspace root.
 * @returns {{ references: Map<string, Map<string, string[]>>, scanned: number }}
 * `references` maps a package name to its subpaths, each with the
 * `file:line` locations it is written at; `scanned` counts the files read.
 */
export function collectDocumentedAssets(workspaceRoot) {
  const files = [];
  for (const root of DOCUMENTATION_ROOTS) {
    collectScannableFiles(join(workspaceRoot, root), files);
  }
  for (const root of FLAT_DOCUMENTATION_ROOTS) {
    const dir = join(workspaceRoot, root);
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (
        entry.isFile() &&
        entry.name.endsWith('.md') &&
        !(root === '.' && UNSCANNED_ROOT_DOCUMENTS.has(entry.name))
      ) {
        files.push(join(dir, entry.name));
      }
    }
  }

  const references = new Map();
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const location = relative(workspaceRoot, file).split(sep).join('/');
    for (const match of text.matchAll(ASSET_REFERENCE)) {
      const packageName = `@malva-ui/${match[1]}`;
      const subpath = posix.normalize(match[2]);
      const line = text.slice(0, match.index).split('\n').length;
      if (!references.has(packageName)) references.set(packageName, new Map());
      const bySubpath = references.get(packageName);
      if (!bySubpath.has(subpath)) bySubpath.set(subpath, []);
      bySubpath.get(subpath).push(`${location}:${line}`);
    }
  }
  return { references, scanned: files.length };
}

// ─── Checks ──────────────────────────────────────────────────────────────────

/**
 * Asset problems for one built package: its generated and documented assets,
 * each through {@link collectAssetProblems}.
 *
 * @param {string} workspaceRoot Absolute path to the workspace root.
 * @param {ReturnType<typeof readProject>} project
 * @param {Map<string, string[]>} [documented] This package's documented
 * subpaths → locations, from {@link collectDocumentedAssets}.
 * @param {Record<string, unknown>} [pkg] The dist manifest; read from disk when
 * omitted. `scripts/publish.mjs` passes its placeholder-resolved copy.
 * @returns {{ assets: string[], problems: { message: string, locations: string[] }[] }}
 */
export function checkPackageAssets(
  workspaceRoot,
  project,
  documented = new Map(),
  pkg,
) {
  const distPath = join(workspaceRoot, project.distDir);
  const generated = collectGeneratedAssets(project);
  const owed = new Map();
  for (const [subpath, origin] of generated.assets) owed.set(subpath, [origin]);
  for (const [subpath, locations] of documented) {
    owed.set(subpath, [...(owed.get(subpath) ?? []), ...locations]);
  }
  const assets = [...owed.keys()].sort();

  const problems = generated.problems.map((message) => ({
    message,
    locations: [],
  }));
  const manifest =
    pkg ?? JSON.parse(readFileSync(join(distPath, 'package.json'), 'utf8'));
  for (const { subpath, message } of collectAssetProblems(
    project.packageName,
    manifest,
    distPath,
    assets,
  )) {
    problems.push({ message, locations: owed.get(subpath) ?? [] });
  }
  return { assets, problems };
}

/**
 * The `check-dist-assets` target must build exactly the release projects: a
 * project it does not build is checked against whatever `dist/` a concurrent or
 * earlier build left behind, and one it builds needlessly is a stale entry.
 *
 * @param {string} workspaceRoot Absolute path to the workspace root.
 * @param {readonly string[]} releaseProjects
 * @returns {string[]} Problems; empty when the edges match.
 */
export function checkBuildEdges(workspaceRoot, releaseProjects) {
  const rootProject = JSON.parse(
    readFileSync(join(workspaceRoot, 'project.json'), 'utf8'),
  );
  const target = rootProject.targets?.[CHECK_TARGET];
  if (!target) {
    return [`project.json declares no \`${CHECK_TARGET}\` target`];
  }
  const built = new Set(
    (target.dependsOn ?? [])
      .filter(
        (entry) =>
          entry && entry.target === 'build' && Array.isArray(entry.projects),
      )
      .flatMap((entry) => entry.projects),
  );
  const problems = [];
  for (const name of releaseProjects) {
    if (!built.has(name)) {
      problems.push(
        `project.json → ${CHECK_TARGET}.dependsOn does not build release project \`${name}\``,
      );
    }
  }
  for (const name of built) {
    if (!releaseProjects.includes(name)) {
      problems.push(
        `project.json → ${CHECK_TARGET}.dependsOn builds \`${name}\`, which is not in nx.json release.projects`,
      );
    }
  }
  return problems;
}

/**
 * Runs every check over every release package.
 *
 * @param {string} [workspaceRoot] Absolute path to the workspace root.
 */
export function checkWorkspace(workspaceRoot = WORKSPACE_ROOT) {
  const releaseProjects = readReleaseProjects(workspaceRoot);
  const projects = releaseProjects.map((name) =>
    readProject(workspaceRoot, name),
  );
  const { references, scanned } = collectDocumentedAssets(workspaceRoot);

  const workspaceProblems = checkBuildEdges(workspaceRoot, releaseProjects).map(
    (message) => ({ message, locations: [] }),
  );
  const published = new Set(projects.map((project) => project.packageName));
  for (const [packageName, subpaths] of references) {
    if (published.has(packageName)) continue;
    for (const [subpath, locations] of subpaths) {
      workspaceProblems.push({
        message: `${packageName}/${subpath}: names a package that is not published (not in nx.json release.projects)`,
        locations,
      });
    }
  }

  const packages = projects.map((project) => {
    const distPath = join(workspaceRoot, project.distDir);
    const manifestPath = join(distPath, 'package.json');
    const base = {
      project: project.name,
      packageName: project.packageName,
      distDir: project.distDir,
    };
    if (!existsSync(manifestPath)) {
      return {
        ...base,
        assets: [],
        problems: [
          {
            message: `${project.distDir}/package.json is missing — run \`yarn nx run ${project.name}:build\`, or this check through \`yarn nx run @malva-ui/source:${CHECK_TARGET}\``,
            locations: [],
          },
        ],
      };
    }
    const pkg = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const broken = collectBrokenExports(pkg, distPath).map((entry) => ({
      message: `exports target does not exist: ${entry}`,
      locations: [],
    }));
    const { assets, problems } = checkPackageAssets(
      workspaceRoot,
      project,
      references.get(project.packageName),
      pkg,
    );
    return { ...base, assets, problems: [...broken, ...problems] };
  });

  return { scanned, references, workspaceProblems, packages };
}

/**
 * Whether a {@link checkWorkspace} result should fail the build.
 *
 * @param {ReturnType<typeof checkWorkspace>} result
 */
export function hasFailure(result) {
  return (
    result.scanned === 0 ||
    result.references.size === 0 ||
    result.workspaceProblems.length > 0 ||
    result.packages.some((entry) => entry.problems.length > 0)
  );
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

function main() {
  const result = checkWorkspace();

  if (process.argv.includes('--json')) {
    console.log(
      JSON.stringify(
        {
          ...result,
          references: Object.fromEntries(
            [...result.references].map(([name, subpaths]) => [
              name,
              Object.fromEntries(subpaths),
            ]),
          ),
        },
        null,
        2,
      ),
    );
    process.exit(hasFailure(result) ? 1 : 0);
  }

  // A scan that read nothing, or found nothing, reports zero problems — which
  // is byte-identical to a clean tree. Asserted before anything is called OK.
  if (result.scanned === 0 || result.references.size === 0) {
    console.error(
      `\n❌  Read ${result.scanned} file(s) under ${[...DOCUMENTATION_ROOTS, ...FLAT_DOCUMENTATION_ROOTS].join(', ')} and found ${result.references.size} documented @malva-ui asset path(s).`,
    );
    console.error(
      '   This is a broken scan, not a clean tree: the docs name `@malva-ui/core/styles/malva-ui.css`\n' +
        '   in several places. Check DOCUMENTATION_ROOTS, FLAT_DOCUMENTATION_ROOTS and ASSET_REFERENCE.\n',
    );
    process.exit(1);
  }

  const failing = result.packages.filter((entry) => entry.problems.length);
  if (!failing.length && !result.workspaceProblems.length) {
    const assets = result.packages.reduce(
      (sum, entry) => sum + entry.assets.length,
      0,
    );
    console.log(
      `✅  ${result.packages.length} built packages — every exports target exists, and all ${assets} generated or documented asset(s) ship, resolve through \`exports\` and survive tree-shaking.`,
    );
    process.exit(0);
  }

  const print = ({ message, locations }) => {
    console.error(`      ✗ ${message}`);
    for (const location of locations.slice(0, 3)) {
      console.error(`          ${location}`);
    }
    if (locations.length > 3) {
      console.error(`          … and ${locations.length - 3} more`);
    }
  };

  console.error(
    '\n❌  A built package does not give a consumer what its manifest and the docs promise.\n',
  );
  if (result.workspaceProblems.length) {
    console.error('  workspace');
    result.workspaceProblems.forEach(print);
    console.error('');
  }
  for (const entry of failing) {
    console.error(`  ${entry.packageName} (${entry.distDir})`);
    entry.problems.forEach(print);
    console.error('');
  }
  console.error(
    '   Fix: ship the file (an ng-package.json `assets` glob for anything a build step\n' +
      '   generates), export it (a `./<dir>/*` subpath in the package.json `exports` —\n' +
      '   ng-packagr merges it with the entry points it generates), and list stylesheets\n' +
      '   in `sideEffects`. Or correct the documented path. See VERSIONING.md §11.\n',
  );
  process.exit(1);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main();
}
