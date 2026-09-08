#!/usr/bin/env node
/**
 * Malva UI — undeclared runtime dependency check
 *
 * A published package's compiled bundle carries every bare module specifier its
 * sources import, unconditionally. npm installs only what the package *declares*
 * — its own `dependencies`, plus (npm 7+) its `peerDependencies`. A specifier
 * that is imported but not declared is therefore an unresolvable module in the
 * consumer's build with no install-time signal of any kind: nothing warns,
 * nothing errors, and it surfaces as `Cannot find module` the first time the
 * consumer imports the entry point.
 *
 * Nothing else in this workspace can see that. Every in-repo consumer resolves
 * from the workspace root `package.json`, so a lib importing a package only the
 * root declares builds, tests and lints green forever. #242 is the worked
 * example: `@malva-ui/core` imported `@angular/router` in thirteen files across
 * nine entry points from the day `mlv-breadcrumb` first used `RouterLink`, and
 * declared no peer on it. It surfaced only as a user report that the generated
 * StackBlitz project would not install.
 *
 * So: for every published package, collect the bare specifiers its published
 * sources import, subtract what the package declares, and fail on the rest.
 *
 * ─── What "published source" means here ─────────────────────────────────────
 *
 * Exactly what `ng-packagr` compiles, which is not "every `.ts` under the
 * package". An entry point is a directory holding an `ng-package.json` with a
 * `lib.entryFile`; ng-packagr compiles that entry file and everything it
 * transitively reaches by relative import. So this walks the same graph:
 * `src/index.ts` → its relative imports → theirs, collecting bare specifiers on
 * the way.
 *
 * Following the graph rather than the directory is what makes the answer the
 * same one npm will get, and it settles a whole class of near-misses with no
 * rule of its own:
 *
 *   • spec files and `src/test-setup.ts` — nothing exports them, so nothing
 *     reaches them, so their `vitest` / `sass` / `@analogjs/vitest-angular` /
 *     `@malva-ui/internal-testing` imports are correctly invisible;
 *   • `libs/scheduler/src/lib/testing/*` — inside the primary entry point's
 *     `src/` tree, reachable from no index, never bundled;
 *   • `libs/cdk/testing-e2e`, `vite.config.mts`, `e2e/` suites — no
 *     `ng-package.json` above them at all;
 *   • `libs/core/schematics` — `.cjs` run by the consumer's own Angular CLI at
 *     `ng add` time (which supplies `@angular-devkit/schematics` and
 *     `@schematics/angular`), never part of a compiled bundle.
 *
 * The risk a graph walk carries that a directory walk does not is silent
 * under-scanning: anything this fails to follow drops a subtree and reports
 * clean, because a smaller source count reads exactly like a smaller tree.
 * Three things are therefore hard failures rather than skips:
 *
 *   • an unresolvable **relative import** — one subtree unread;
 *   • an `ng-package.json` with no readable `lib.entryFile` — one whole **entry
 *     point** unread. Nothing else reaches a secondary entry point: the root
 *     barrel re-exports through bare self-name subpaths
 *     (`export * from '@malva-ui/core/alert'`), which resolve to
 *     `manifest.name` and are deliberately not followed, so its own manifest is
 *     the only way in. Renaming `entryFile` in
 *     `libs/core/drawer/ng-package.json` used to drop fourteen sources and
 *     still print ✅ over a shipped
 *     `import { sortBy, cloneDeep } from 'lodash-es'` declared nowhere;
 *   • a walk that read **no files at all** — everything unread.
 *
 * The manifest count and the entry-file count come from one visit and are equal
 * today (108 = 108: cdk 9, core 79, i18n 16, editor 2, scheduler 1,
 * taskboard 1, tailwind 0), so the assertion costs nothing until it is earning
 * its keep. See {@link findEntryPoints}, {@link scanWorkspace} and the checks
 * in `main`.
 *
 * Specifiers come from `ts.preProcessFile`, the TypeScript compiler's own
 * import pre-processor, rather than a regex: it is scanner-driven, so it reads
 * every import form (side-effect, default, namespace, named, `import type`,
 * `export … from`, dynamic `import()`, `require()`) and — the part a regex
 * cannot do — does not mistake the word `export` inside a comment or a test
 * name for an import.
 *
 * Usage:
 *   node scripts/check-package-dependencies.mjs [--json] [--quiet]
 *   yarn nx run @malva-ui/source:check-package-dependencies
 *
 * Flags:
 *   --json    Emit findings as JSON instead of a human-readable report.
 *   --quiet   Suppress the summary line when nothing is found.
 *
 * Exit code: 0 when every imported specifier is declared, 1 when one is not.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import ts from 'typescript';

// ─── Configuration ───────────────────────────────────────────────────────────

/** Workspace root, resolved from this file rather than from `process.cwd()`. */
export const WORKSPACE_ROOT = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '..',
);

/** Directory holding every published package, keyed by `release.projects` name. */
export const PACKAGES_ROOT = 'libs';

/** Directory names never descended into while looking for entry points. */
const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  '.git',
  '.angular',
  '.nx',
  'coverage',
  'test-results',
  'tmp',
]);

/**
 * Extensions tried, in order, when resolving a relative import to a file.
 *
 * Mirrors what `tsc` tries for a `moduleResolution` of `bundler`/`node`: the
 * bare path with each extension appended, then the same as a directory's
 * `index`.
 */
const RESOLVED_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.d.ts'];

/**
 * Bare specifiers a published source may import without the package declaring
 * them.
 *
 * Deliberately short, and narrowed on three axes — `package`, `dependency` and
 * the `files` it applies to — so an exception can never quietly cover a second
 * import of the same package somewhere it would be a real defect. Every entry
 * states which of two things it is: *clean* (declaring it would be wrong), or
 * *deferred* (a real finding, not fixed here, with the fix named). "It resolves
 * in the repo" is never a reason for either.
 *
 * An entry that stops matching anything is a promise about code that no longer
 * exists; {@link scanWorkspace} reports unused ones and `main` fails on them,
 * so the list cannot rot.
 *
 * **Empty, and worth keeping empty.** It held exactly one entry, for
 * `@malva-ui/core/form-utils/testing`'s `import { expect } from 'vitest'` — a
 * real undeclared dependency of this class, deferred out of #242 and shipped in
 * `@malva-ui/core@0.1.15`. #243 removed the import instead of declaring it, so
 * the entry point now depends only on `fast-equals`, which core already
 * declares. Adding an entry back is therefore a claim that *no* fix is
 * available, not that none is convenient.
 */
export const DECLARATION_EXCEPTIONS = [];

/** Node's own modules, importable with or without the `node:` prefix. */
const NODE_BUILTINS = new Set(builtinModules);

/**
 * Stable identity of one {@link DECLARATION_EXCEPTIONS} entry, on all three axes
 * it is narrowed by.
 *
 * The rot check keys on this rather than on package + dependency, so two entries
 * that share a package and a dependency but scope to different `files` cannot
 * mark each other used — which would let a dead one sit in the list forever.
 * With one entry today the two spellings agree; the key is what keeps them
 * agreeing after the second.
 *
 * @param entry An exception from {@link DECLARATION_EXCEPTIONS}.
 */
export function exceptionKey(entry) {
  return `${entry.package}|${entry.dependency}|${entry.files?.source ?? '*'}`;
}

// ─── Specifier analysis ──────────────────────────────────────────────────────

/**
 * Returns the npm package a bare module specifier belongs to, or `null` when
 * the specifier names no installable package.
 *
 * A subpath resolves back to its package — `@angular/common/http` →
 * `@angular/common`, `@malva-ui/cdk/density` → `@malva-ui/cdk`, `rxjs/operators`
 * → `rxjs` — because a package is what npm installs, so a subpath and its root
 * are one declaration.
 *
 * `null` for a relative or absolute path (resolved from disk, never installed)
 * and for a Node builtin in either spelling.
 *
 * @param specifier A module specifier exactly as written in the source.
 */
export function packageNameOf(specifier) {
  if (!specifier) return null;
  if (specifier.startsWith('.') || specifier.startsWith('/')) return null;
  if (specifier.startsWith('node:')) return null;

  const segments = specifier.split('/');

  // A scope is not a package: `@angular` alone (and `@angular/`) installs
  // nothing, so it must not be reported as an undeclared dependency.
  if (specifier.startsWith('@') && !segments[1]) return null;

  const name = specifier.startsWith('@')
    ? segments.slice(0, 2).join('/')
    : segments[0];

  if (!name || NODE_BUILTINS.has(name)) return null;
  return name;
}

/** Whether a specifier is a relative path this resolver should follow. */
export function isRelative(specifier) {
  return specifier.startsWith('./') || specifier.startsWith('../');
}

/**
 * Every module specifier a TypeScript source imports, re-exports, dynamically
 * imports or requires, with the character offset each was written at.
 *
 * @param source TypeScript source text.
 */
export function collectSpecifiers(source) {
  return ts
    .preProcessFile(source, true, true)
    .importedFiles.map(({ fileName, pos }) => ({ specifier: fileName, pos }));
}

/** 1-based line number of a character offset. */
export function lineOf(source, pos) {
  return source.slice(0, pos).split('\n').length;
}

/**
 * Resolves a relative import to a file on disk, or `null` when nothing matches.
 *
 * @param fromFile Absolute path of the importing file.
 * @param specifier The relative specifier, e.g. `./lib/thing` or `../x.js`.
 */
export function resolveRelative(fromFile, specifier) {
  const base = resolve(dirname(fromFile), specifier);

  // TypeScript lets an ESM-style `./x.js` name the `./x.ts` that emits it.
  const rewritten = base.replace(/\.([cm]?)js$/, '.$1ts');
  const candidates = [
    ...(rewritten === base ? [] : [rewritten]),
    ...RESOLVED_EXTENSIONS.map((ext) => `${base}${ext}`),
    ...RESOLVED_EXTENSIONS.map((ext) => join(base, `index${ext}`)),
    base,
  ];

  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      /* next candidate */
    }
  }

  return null;
}

// ─── Traversal ───────────────────────────────────────────────────────────────

/**
 * Published project names, read from `nx.json` → `release.projects` rather than
 * hardcoded: a package added to the release but not here would be published
 * unchecked, which is exactly the state this guard exists to end.
 *
 * @param workspaceRoot Absolute path to the workspace root.
 */
export function readReleaseProjects(workspaceRoot = WORKSPACE_ROOT) {
  const nxJson = JSON.parse(
    readFileSync(join(workspaceRoot, 'nx.json'), 'utf8'),
  );
  const projects = nxJson.release?.projects;
  if (!Array.isArray(projects) || projects.length === 0) {
    throw new Error(
      'nx.json declares no `release.projects`; there is nothing to check.',
    );
  }
  return projects;
}

/**
 * Every entry point `ng-packagr` compiles for one package, and every
 * `ng-package.json` seen on the way.
 *
 * Both come from the **same** visit deliberately. Each secondary entry point is
 * reachable only through its own `ng-package.json`: the root barrel re-exports
 * through bare self-name subpaths (`export * from '@malva-ui/core/alert'`),
 * which resolve to `manifest.name` and are never followed. So a manifest whose
 * `lib.entryFile` this cannot read is a whole entry point that silently leaves
 * the walk — every source under it unread, every bare import it makes
 * unexamined, and the report still green. `manifestsWithoutEntryFile` is what
 * `main` fails on; deriving it from a second traversal would let the two
 * disagree about which directories exist.
 *
 * @param packageDir Absolute path to the package root (e.g. `<root>/libs/core`).
 */
export function findEntryPoints(packageDir) {
  const entryFiles = [];
  const manifestsWithoutEntryFile = [];
  let manifests = 0;

  const visit = (dir) => {
    const manifest = join(dir, 'ng-package.json');
    if (existsSync(manifest)) {
      manifests += 1;
      const entryFile = JSON.parse(readFileSync(manifest, 'utf8')).lib
        ?.entryFile;
      if (entryFile) entryFiles.push(resolve(dir, entryFile));
      else manifestsWithoutEntryFile.push(manifest);
    }

    let entries;
    try {
      entries = ts.sys.getDirectories(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (!IGNORED_DIRECTORIES.has(name)) visit(join(dir, name));
    }
  };

  visit(packageDir);
  return {
    entryFiles: entryFiles.sort(),
    manifests,
    manifestsWithoutEntryFile: manifestsWithoutEntryFile.sort(),
  };
}

// ─── Check ───────────────────────────────────────────────────────────────────

/**
 * Checks one published package.
 *
 * @param packageDir Absolute path to the package root.
 * @param project The `release.projects` name it was reached by.
 * @param workspaceRoot Absolute path to the workspace root, for report paths.
 */
export function checkPackage(packageDir, project, workspaceRoot) {
  const manifest = JSON.parse(
    readFileSync(join(packageDir, 'package.json'), 'utf8'),
  );
  const pkg = manifest.name ?? project;

  // A package's own name covers every secondary entry point of itself
  // (`@malva-ui/core/button` from inside `libs/core`) — one package to npm, and
  // never a dependency of itself.
  const declared = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...(manifest.name ? [manifest.name] : []),
  ]);

  const exceptions = DECLARATION_EXCEPTIONS.filter(
    (entry) => entry.package === pkg,
  );

  const { entryFiles, manifests, manifestsWithoutEntryFile } =
    findEntryPoints(packageDir);
  const visited = new Set();
  const queue = [...entryFiles];
  const findings = [];
  const unresolved = [];
  const exercisedExceptions = new Set();
  const seen = new Set();

  while (queue.length > 0) {
    const file = queue.pop();
    if (visited.has(file)) continue;
    visited.add(file);

    if (!existsSync(file)) {
      unresolved.push({
        file: relative(workspaceRoot, file),
        specifier: '(entry file)',
        line: 0,
      });
      continue;
    }

    const source = readFileSync(file, 'utf8');
    for (const { specifier, pos } of collectSpecifiers(source)) {
      if (isRelative(specifier)) {
        const target = resolveRelative(file, specifier);
        if (target === null) {
          unresolved.push({
            file: relative(workspaceRoot, file),
            specifier,
            line: lineOf(source, pos),
          });
          continue;
        }
        queue.push(target);
        continue;
      }

      const name = packageNameOf(specifier);
      if (name === null || declared.has(name)) continue;

      const relativeFile = relative(workspaceRoot, file).split(sep).join('/');
      const exception = exceptions.find(
        (entry) =>
          entry.dependency === name &&
          (entry.files === undefined || entry.files.test(relativeFile)),
      );
      if (exception) {
        exercisedExceptions.add(exceptionKey(exception));
        continue;
      }

      const key = `${name} ${file}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({
        package: pkg,
        project,
        dependency: name,
        specifier,
        file: relative(workspaceRoot, file),
        line: lineOf(source, pos),
      });
    }
  }

  return {
    package: pkg,
    project,
    entryPoints: entryFiles.length,
    manifests,
    manifestsWithoutEntryFile: manifestsWithoutEntryFile.map((file) =>
      relative(workspaceRoot, file),
    ),
    scanned: visited.size,
    exercisedExceptions: [...exercisedExceptions],
    unresolved,
    findings,
  };
}

/**
 * Checks every published package.
 *
 * @param workspaceRoot Absolute path to the workspace root.
 */
export function scanWorkspace(workspaceRoot = WORKSPACE_ROOT) {
  const packages = [];

  for (const project of readReleaseProjects(workspaceRoot)) {
    const packageDir = join(workspaceRoot, PACKAGES_ROOT, project);
    if (!existsSync(join(packageDir, 'package.json'))) {
      throw new Error(
        `nx.json lists "${project}" in release.projects, but ` +
          `${relative(workspaceRoot, packageDir)}/package.json does not exist.`,
      );
    }
    packages.push(checkPackage(packageDir, project, workspaceRoot));
  }

  const exercised = new Set(
    packages.flatMap((entry) => entry.exercisedExceptions),
  );

  return {
    packages,
    scanned: packages.reduce((sum, entry) => sum + entry.scanned, 0),
    findings: packages.flatMap((entry) => entry.findings),
    unresolved: packages.flatMap((entry) =>
      entry.unresolved.map((hit) => ({ ...hit, package: entry.package })),
    ),
    // An `ng-package.json` whose `lib.entryFile` could not be read is a whole
    // entry point that left the walk without a trace — see
    // {@link findEntryPoints}.
    entryPointsWithoutEntryFile: packages.flatMap((entry) =>
      entry.manifestsWithoutEntryFile.map((manifest) => ({
        package: entry.package,
        manifest,
      })),
    ),
    // A package with no `ng-package.json` anywhere compiles no TypeScript at
    // all — `@malva-ui/tailwind` is a `theme.css` plus schematics. Reported so
    // that a package that *lost* its entry points cannot pass as one that never
    // had any.
    withoutEntryPoints: packages
      .filter((entry) => entry.entryPoints === 0)
      .map((entry) => entry.package),
    unusedExceptions: DECLARATION_EXCEPTIONS.filter(
      (entry) => !exercised.has(exceptionKey(entry)),
    ),
  };
}

/**
 * Whether a scan is a failure — the single source both the human report and
 * `--json` exit on.
 *
 * Split out because the two paths had drifted: `--json` exited 0 on a rotted
 * `DECLARATION_EXCEPTIONS` list that the human report exited 1 on, so anything
 * consuming the JSON in CI would have passed green on it. One predicate makes
 * that divergence unrepresentable rather than merely fixed.
 *
 * @param result A scan from {@link scanWorkspace}.
 */
export function hasFailure(result) {
  return (
    result.scanned === 0 ||
    result.entryPointsWithoutEntryFile.length > 0 ||
    result.unresolved.length > 0 ||
    result.unusedExceptions.length > 0 ||
    result.findings.length > 0
  );
}

// ─── Report ──────────────────────────────────────────────────────────────────

/**
 * Groups findings by package, then by dependency, for the report.
 *
 * @param findings Findings from {@link scanWorkspace}.
 */
export function groupFindings(findings) {
  const byPackage = new Map();

  for (const finding of findings) {
    if (!byPackage.has(finding.package)) {
      byPackage.set(finding.package, new Map());
    }
    const byDependency = byPackage.get(finding.package);
    if (!byDependency.has(finding.dependency)) {
      byDependency.set(finding.dependency, []);
    }
    byDependency.get(finding.dependency).push(finding);
  }

  return byPackage;
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const quiet = args.includes('--quiet');

  const result = scanWorkspace();
  const { packages, scanned, findings, unresolved, withoutEntryPoints } =
    result;

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(hasFailure(result) ? 1 : 0);
  }

  // A walk that read nothing reports zero findings, which is byte-identical to
  // a clean tree. Every guarantee below rests on the traversal having run, so
  // it is asserted before anything is reported OK.
  if (!scanned) {
    console.error(
      `\n❌  Reached 0 published sources under \`${PACKAGES_ROOT}/\` — the traversal found nothing to check.`,
    );
    console.error(
      '   This is a broken check, not a clean tree. Verify PACKAGES_ROOT and that every\n' +
        '   entry point still declares `lib.entryFile` in its ng-package.json.\n',
    );
    process.exit(1);
  }

  // The same failure one entry point at a time. Nothing else reaches a
  // secondary entry point — the root barrel re-exports through bare self-name
  // subpaths that resolve to the package itself — so a manifest that stops
  // yielding a `lib.entryFile` drops its whole subtree and still reports ✅,
  // just with a smaller source count nobody is watching.
  if (result.entryPointsWithoutEntryFile.length) {
    console.error(
      `\n❌  ${result.entryPointsWithoutEntryFile.length} ng-package.json manifest(s) declare no \`lib.entryFile\`.`,
    );
    console.error(
      '   Each one is an entry point this check did not enter, so every source under it\n' +
        '   went unread. Restore `lib.entryFile`, or delete the manifest if the entry point\n' +
        '   is gone.\n',
    );
    for (const hit of result.entryPointsWithoutEntryFile) {
      console.error(`  ${hit.manifest}  (${hit.package})`);
    }
    console.error('');
    process.exit(1);
  }

  // The same failure one subtree at a time: a relative import nothing followed
  // is a subtree nothing read, and its bare imports would go unreported.
  if (unresolved.length) {
    console.error(
      `\n❌  ${unresolved.length} relative import(s) could not be resolved to a file.`,
    );
    console.error(
      '   Each one is a subtree this check did not read, so its imports were never\n' +
        '   examined. Fix the import, or teach RESOLVED_EXTENSIONS about it.\n',
    );
    for (const hit of unresolved) {
      console.error(`  ${hit.file}:${hit.line}  ('${hit.specifier}')`);
    }
    console.error('');
    process.exit(1);
  }

  if (result.unusedExceptions.length) {
    console.error(
      `\n❌  ${result.unusedExceptions.length} DECLARATION_EXCEPTIONS entr(y/ies) matched nothing.`,
    );
    console.error(
      '   An exception nobody exercises is a promise about code that no longer exists.\n' +
        '   Delete it from scripts/check-package-dependencies.mjs.\n',
    );
    for (const entry of result.unusedExceptions) {
      console.error(`  ${entry.package} → ${entry.dependency}`);
    }
    console.error('');
    process.exit(1);
  }

  if (!findings.length) {
    if (!quiet) {
      const skipped = withoutEntryPoints.length
        ? ` (${withoutEntryPoints.join(', ')} compile${withoutEntryPoints.length === 1 ? 's' : ''} no TypeScript)`
        : '';
      console.log(
        `✅  ${scanned} published sources across ${packages.length} packages${skipped} — every bare import is declared as a dependency or peer dependency.`,
      );
    }
    process.exit(0);
  }

  const grouped = groupFindings(findings);
  const total = [...grouped.values()].reduce((sum, m) => sum + m.size, 0);

  console.error(
    `\n❌  ${total} undeclared dependenc${total === 1 ? 'y' : 'ies'} across ${grouped.size} published package(s).`,
  );
  console.error(
    "   npm installs a package's `dependencies` and `peerDependencies` and nothing else,",
  );
  console.error(
    "   so an imported-but-undeclared package is `Cannot find module` in the consumer's",
  );
  console.error(
    '   build, with no install-time warning at all. A peer range is public API — see',
  );
  console.error('   VERSIONING.md §2.\n');

  for (const [pkg, byDependency] of grouped) {
    console.error(`  ${pkg}`);
    for (const [dependency, hits] of byDependency) {
      console.error(`      ✗ ${dependency} — imported, declared nowhere`);
      for (const hit of hits.slice(0, 3)) {
        console.error(
          `          ${hit.file}:${hit.line}  ('${hit.specifier}')`,
        );
      }
      if (hits.length > 3) {
        console.error(`          … and ${hits.length - 3} more file(s)`);
      }
    }
    console.error('');
  }

  console.error(
    "   Fix: declare it in the package's own package.json — `peerDependencies` for a",
  );
  console.error(
    '   framework package the consumer owns exactly one copy of, `dependencies` for a',
  );
  console.error(
    '   runtime library the package brings its own copy of. A `0.0.0-*-package-version`',
  );
  console.error(
    '   placeholder also needs its mapping in scripts/publish.mjs and in',
  );
  console.error('   apps/docs/tools/playground-manifest.ts.\n');
  process.exit(1);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main();
}
