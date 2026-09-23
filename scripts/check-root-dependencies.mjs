#!/usr/bin/env node
/**
 * Malva UI — unused root dependency check
 *
 * The workspace root `package.json` is never published, so nothing downstream
 * ever complains about what it declares. Entries outlive the code that needed
 * them: #296 removed thirteen with no consumer anywhere — `zone.js` in a
 * zoneless-only workspace, an `express` / `supertest` server stack with no
 * server, `@angular/ssr` with no `server.ts`, `@nx/docker` registered as an Nx
 * plugin with no Dockerfile, `postcss-url` dragging in two HIGH audit rows, and
 * `@angular/animations`, deprecated in Angular 22 and provided by the docs app
 * for no trigger at all — plus one package listed in both dependency fields and
 * one `@types/*` under `dependencies`. Each cost install weight, audit noise and
 * a dependency story that misled the next reader.
 *
 * So: every root dependency must have a consumer this check can see, or an
 * entry in {@link IMPLICIT_CONSUMERS} saying who uses it and how.
 *
 * ─── What counts as a consumer ──────────────────────────────────────────────
 *
 * Read from every file git tracks or would track (`git ls-files --cached
 * --others --exclude-standard`), so an ignored `dist/` or `node_modules/`
 * never vouches for anything:
 *
 *   • a module specifier in a `.ts` / `.tsx` / `.mts` / `.cts` / `.js` /
 *     `.mjs` / `.cjs` file — `import`, `export … from`, `import()`,
 *     `require()`, read by `ts.preProcessFile`, the compiler's own scanner, so
 *     `value="express"` in a template string is not an import of `express`;
 *   • an `@use` / `@import` / `@forward` in a `.scss` / `.css` file;
 *   • an Nx executor (`"executor": "<package>:<name>"` in any `project.json`)
 *     and an Nx plugin (`plugins[].plugin` in `nx.json`);
 *   • a CLI binary, named in a command: the root `scripts`, every
 *     `project.json` `command` / `commands`, `.husky/*` hooks, the `run:` steps
 *     of `.github/workflows/*`, and the string literals of
 *     `lint-staged.config.*`. Binary names come from each declared package's
 *     own installed `bin` field, so `commitlint` maps to `@commitlint/cli`;
 *   • a `node_modules/<package>/…` path in any of those commands or sources,
 *     or anywhere in a `project.json` (an option may name a preset or config);
 *   • a `postcss.config.json` plugin key, a tsconfig `types` entry
 *     (`"node"` → `@types/node`), and a tsconfig `"importHelpers": true`
 *     (compiled output imports `tslib`);
 *   • `@types/<x>` whenever `<x>` itself has a consumer;
 *   • a `dependencies` / `peerDependencies` entry of a workspace package (the
 *     root `workspaces` globs): the root is what resolves it in-repo;
 *   • a **required** peer of any package that has a consumer, followed to a
 *     fixpoint through the installed manifests. Optional peers deliberately do
 *     not count — `zone.js` is an optional peer of `@angular/core`,
 *     `@angular/animations` of `@angular/platform-browser` and `@angular/ssr`
 *     of `@angular/build`, which is exactly how all three survived unnoticed.
 *
 * Anything else — a package loaded by name at run time from a config string, an
 * editor-only tool, a builder an executor delegates to — goes in
 * {@link IMPLICIT_CONSUMERS} with its reason. An entry is either *clean* (used,
 * just invisibly) or *deferred* (no consumer found, kept only until someone
 * decides; its reason names that decision). A clean entry also seeds the
 * required-peer walk, so `ng-packagr` vouches for `@angular/compiler-cli`; a
 * deferred one vouches for nothing.
 *
 * An entry is itself checked: one naming a package the root does not declare,
 * one whose package the scan already finds a consumer for, or one another
 * clean entry already pulls in as a required peer, fails — a reason nobody
 * needs is a promise about code that no longer exists.
 *
 * Also reported: a package in both `dependencies` and `devDependencies`, and an
 * `@types/*` package under `dependencies` (types are build tooling).
 *
 * Usage:
 *   node scripts/check-root-dependencies.mjs [--json] [--quiet]
 *   yarn nx run @malva-ui/source:check-root-dependencies
 *
 * Exit code: 0 when every root dependency is accounted for, 1 otherwise.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import ts from 'typescript';

import { packageNameOf } from './check-package-dependencies.mjs';

// ─── Configuration ───────────────────────────────────────────────────────────

/** Workspace root, resolved from this file rather than from `process.cwd()`. */
export const WORKSPACE_ROOT = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '..',
);

/** Reason shared by the deferred entries: found unused, not yet ruled on. */
const NOT_IN_D8 =
  'No consumer found (#296). Not in owner ruling D8, so it stays until #433 ' +
  'decides it.';

/**
 * Root dependencies used in a way no scan rule can see, each with who uses it.
 *
 * `kind: 'clean'` — used, invisibly; the reason names the consumer.
 * `kind: 'deferred'` — no consumer found; the reason names what is pending.
 * "It might be needed" is never a reason for either.
 */
export const IMPLICIT_CONSUMERS = [
  {
    package: '@angular-devkit/build-angular',
    kind: 'clean',
    reason:
      "`@nx/angular:dev-server` (docs `serve`) asserts it is installed and imports it; the executor's own package does not declare it.",
  },
  {
    package: '@angular/build',
    kind: 'clean',
    reason:
      '`@nx/angular:application` (docs `build`) imports its `buildApplication`; `apps/docs/tools/playground-manifest.ts` also reads its version from this manifest.',
  },
  {
    package: '@angular/language-service',
    kind: 'clean',
    reason:
      'Editor tooling: the Angular Language Service resolves it from the workspace. No build step loads it.',
  },
  {
    package: '@commitlint/config-conventional',
    kind: 'clean',
    reason:
      '`commitlint.config.mjs` names it in `extends`; commitlint resolves it by that string at run time.',
  },
  {
    package: '@eslint/js',
    kind: 'clean',
    reason:
      "`@nx/eslint-plugin`'s `flat/typescript` and `flat/javascript` configs, which `eslint.config.mjs` spreads, `require('@eslint/js')` unconditionally, yet the plugin declares it neither as a dependency nor as a peer. This entry is what makes it resolvable; otherwise it resolves only because eslint's own copy happens to be hoisted.",
  },
  {
    package: '@swc-node/register',
    kind: 'clean',
    reason:
      "Nx's TypeScript loader (`nx/src/plugins/js/utils/register`) looks it up by name to load `.ts` workspace files such as the docs build's esbuild plugin `apps/docs/plugins/mdx-transform.ts`.",
  },
  {
    package: '@vitest/coverage-v8',
    kind: 'clean',
    reason:
      "Every `vite.config.mts` sets `coverage.provider: 'v8'`; Vitest loads the provider by name when run with `--coverage`.",
  },
  {
    package: 'canvas',
    kind: 'clean',
    reason:
      "jsdom's optional peer, required by name when installed; it backs `HTMLCanvasElement.getContext` in the jsdom test environment.",
  },
  {
    package: 'eslint-config-prettier',
    kind: 'clean',
    reason:
      'An optional peer of `@nx/eslint-plugin`: its `flat/typescript` and `flat/javascript` configs (spread by `eslint.config.mjs`) load it whenever it and `prettier` are installed, turning off the formatting rules Prettier owns. Removing it would not fail anything — those rules would silently come back.',
  },
  {
    package: 'ng-packagr',
    kind: 'clean',
    reason:
      "`@nx/angular:package` (every release library's `build`) requires it; the executor's own package does not declare it.",
  },
  {
    package: 'ts-node',
    kind: 'clean',
    reason:
      "Nx's TypeScript loader falls back to it by name when `@swc-node/register` is unavailable.",
  },
  {
    package: 'verdaccio',
    kind: 'clean',
    reason:
      "The root `local-registry` target's `@nx/js:verdaccio` executor forks `verdaccio/bin/verdaccio`.",
  },
  { package: '@nx/esbuild', kind: 'deferred', reason: NOT_IN_D8 },
  { package: '@nx/workspace', kind: 'deferred', reason: NOT_IN_D8 },
  { package: '@swc/helpers', kind: 'deferred', reason: NOT_IN_D8 },
  { package: '@typescript-eslint/utils', kind: 'deferred', reason: NOT_IN_D8 },
  { package: '@vitest/ui', kind: 'deferred', reason: NOT_IN_D8 },
];

/** Extensions whose module specifiers are read with the TypeScript scanner. */
const CODE_FILE = /\.(?:ts|tsx|mts|cts|js|mjs|cjs)$/;

/** Extensions whose `@use` / `@import` / `@forward` targets are read. */
const STYLE_FILE = /\.(?:scss|css)$/;

// ─── Extraction ──────────────────────────────────────────────────────────────

/**
 * Package names a code file imports, re-exports, dynamically imports or
 * requires, plus any `node_modules/<package>/` path it spells out.
 *
 * @param source File contents.
 */
export function codePackages(source) {
  const names = new Set();
  for (const { fileName } of ts.preProcessFile(source, true, true)
    .importedFiles) {
    const name = packageNameOf(fileName);
    if (name) names.add(name);
  }
  for (const name of nodeModulesPackages(source)) names.add(name);
  return names;
}

/**
 * Package names a stylesheet loads through `@use`, `@import` or `@forward`.
 * `sass:*` modules and relative paths name no package.
 *
 * @param source Stylesheet contents.
 */
export function stylePackages(source) {
  const names = new Set();
  for (const match of source.matchAll(
    /@(?:use|import|forward)\s+['"]~?([^'"]+)['"]/g,
  )) {
    const name = packageNameOf(match[1]);
    if (name && !name.includes(':')) names.add(name);
  }
  return names;
}

/**
 * Package names spelled as a `node_modules/<package>/…` path.
 *
 * @param text Any text.
 */
export function nodeModulesPackages(text) {
  const names = new Set();
  for (const match of text.matchAll(
    /node_modules\/((?:@[\w.-]+\/)?[\w.-]+)/g,
  )) {
    names.add(match[1]);
  }
  return names;
}

/**
 * The words of a shell command — what a binary name is matched against.
 *
 * @param text One or more commands.
 */
export function commandTokens(text) {
  return text.split(/[\s'"`;&|()<>=,:[\]{}$]+/).filter(Boolean);
}

/**
 * The commands of a GitHub Actions workflow: every `run:` value, including a
 * `run: |` block's indented body. Comments and step names are not commands.
 *
 * @param source Workflow YAML.
 */
export function workflowCommands(source) {
  const lines = source.split('\n');
  const commands = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(\s*)(?:-\s+)?run:\s*(.*)$/);
    if (!match) continue;
    const rest = match[2].trim();
    if (!/^[|>][-+]?$/.test(rest)) {
      commands.push(rest);
      continue;
    }
    const indent = match[1].length;
    for (i += 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() && line.search(/\S/) <= indent) {
        i -= 1;
        break;
      }
      commands.push(line);
    }
  }
  return commands.join('\n');
}

/**
 * The string literals of a JavaScript source — the commands a
 * `lint-staged.config.*` maps globs to.
 *
 * @param source JavaScript source.
 */
export function stringLiterals(source) {
  const literals = [];
  for (const match of source.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
    literals.push(match[2]);
  }
  return literals.join('\n');
}

/**
 * The `command` / `commands` strings of every target in a `project.json`.
 *
 * @param manifest A parsed `project.json`.
 */
export function projectCommands(manifest) {
  const commands = [];
  for (const target of Object.values(manifest.targets ?? {})) {
    const options = target?.options ?? {};
    if (typeof options.command === 'string') commands.push(options.command);
    for (const entry of options.commands ?? []) {
      commands.push(typeof entry === 'string' ? entry : (entry?.command ?? ''));
    }
  }
  return commands.join('\n');
}

/**
 * The package an Nx executor or plugin string belongs to:
 * `@nx/angular:package` → `@nx/angular`, `@nx/vite/plugin` → `@nx/vite`.
 *
 * @param value An executor (`<package>:<name>`) or plugin module specifier.
 */
export function nxPackageOf(value) {
  return packageNameOf(value.split(':')[0]);
}

/**
 * The package an `@types/*` package describes: `@types/node` → `node`,
 * `@types/babel__core` → `@babel/core`. `null` for anything else.
 *
 * @param name A package name.
 */
export function typedPackageOf(name) {
  if (!name.startsWith('@types/')) return null;
  const bare = name.slice('@types/'.length);
  return bare.includes('__') ? `@${bare.replace('__', '/')}` : bare;
}

// ─── Scan ────────────────────────────────────────────────────────────────────

/** Files git tracks or would track, relative to `root`. */
function listFiles(root) {
  return execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
    .split('\0')
    .filter(Boolean);
}

/** The installed manifest of `name` under `root/node_modules`, or `null`. */
function installedManifest(root, name) {
  const file = join(root, 'node_modules', name, 'package.json');
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** Workspace package directories matched by the root `workspaces` globs. */
function workspaceDirectories(root, patterns) {
  const directories = [];
  for (const pattern of patterns) {
    if (!pattern.endsWith('/*')) {
      directories.push(pattern);
      continue;
    }
    const parent = join(root, pattern.slice(0, -2));
    if (!existsSync(parent)) continue;
    for (const entry of readdirSync(parent)) {
      if (statSync(join(parent, entry)).isDirectory()) {
        directories.push(`${pattern.slice(0, -2)}/${entry}`);
      }
    }
  }
  return directories;
}

/**
 * Scans the workspace and reports every root dependency with no consumer.
 *
 * @param root Workspace root.
 * @param options.files File list relative to `root`; defaults to git's.
 * @param options.implicit Allow-list; defaults to {@link IMPLICIT_CONSUMERS}.
 */
export function scanRoot(
  root = WORKSPACE_ROOT,
  { files = listFiles(root), implicit = IMPLICIT_CONSUMERS } = {},
) {
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const dependencies = Object.keys(manifest.dependencies ?? {});
  const devDependencies = Object.keys(manifest.devDependencies ?? {});
  const declared = new Set([...dependencies, ...devDependencies]);

  /** @type {Map<string, string[]>} package → where its consumers are. */
  const evidence = new Map();
  const add = (name, where) => {
    if (!name || !declared.has(name)) return;
    if (!evidence.has(name)) evidence.set(name, []);
    evidence.get(name).push(where);
  };

  const binOwners = new Map();
  for (const name of declared) {
    const installed = installedManifest(root, name);
    if (!installed?.bin) continue;
    const bins =
      typeof installed.bin === 'string'
        ? { [name.split('/').pop()]: installed.bin }
        : installed.bin;
    for (const bin of Object.keys(bins)) binOwners.set(bin, name);
  }
  const addCommands = (text, where) => {
    for (const token of commandTokens(text)) {
      if (binOwners.has(token))
        add(binOwners.get(token), `${where} (\`${token}\`)`);
    }
    for (const name of nodeModulesPackages(text)) add(name, where);
  };

  addCommands(
    Object.values(manifest.scripts ?? {}).join('\n'),
    'package.json scripts',
  );

  let scannedCode = 0;
  const read = (file) => readFileSync(join(root, file), 'utf8');

  for (const file of files) {
    if (!existsSync(join(root, file))) continue;
    const base = file.split('/').pop();

    if (CODE_FILE.test(file)) {
      scannedCode += 1;
      const source = read(file);
      for (const name of codePackages(source)) add(name, file);
      if (/^lint-staged\.config\./.test(base)) {
        addCommands(stringLiterals(source), file);
      }
    } else if (STYLE_FILE.test(file)) {
      for (const name of stylePackages(read(file))) add(name, file);
    } else if (base === 'project.json') {
      const project = JSON.parse(read(file));
      for (const target of Object.values(project.targets ?? {})) {
        if (target?.executor) add(nxPackageOf(target.executor), file);
      }
      addCommands(projectCommands(project), file);
      // Any option may point into node_modules (a preset, a config file), not
      // only a command, so the raw text is read for paths too.
      for (const name of nodeModulesPackages(read(file))) add(name, file);
    } else if (file === 'nx.json') {
      for (const plugin of JSON.parse(read(file)).plugins ?? []) {
        const specifier = typeof plugin === 'string' ? plugin : plugin?.plugin;
        if (specifier) add(nxPackageOf(specifier), file);
      }
    } else if (file.startsWith('.husky/')) {
      addCommands(read(file).replace(/^\s*#.*$/gm, ''), file);
    } else if (/^\.github\/workflows\/[^/]+\.ya?ml$/.test(file)) {
      addCommands(workflowCommands(read(file)), file);
    } else if (base === 'postcss.config.json') {
      for (const plugin of Object.keys(JSON.parse(read(file)).plugins ?? {})) {
        add(plugin, file);
      }
    } else if (/^tsconfig[^/]*\.json$/.test(base)) {
      const tsconfig = read(file);
      const types = tsconfig.match(/"types"\s*:\s*\[([^\]]*)\]/);
      for (const entry of types?.[1].matchAll(/"([^"]+)"/g) ?? []) {
        add(`@types/${entry[1]}`, `${file} (types)`);
      }
      // Compiled output imports its helpers from tslib instead of inlining them.
      if (/"importHelpers"\s*:\s*true/.test(tsconfig)) {
        add('tslib', `${file} (importHelpers)`);
      }
    }
  }

  for (const directory of workspaceDirectories(
    root,
    manifest.workspaces ?? [],
  )) {
    const file = join(root, directory, 'package.json');
    if (!existsSync(file)) continue;
    const workspace = JSON.parse(readFileSync(file, 'utf8'));
    for (const field of ['dependencies', 'peerDependencies']) {
      for (const name of Object.keys(workspace[field] ?? {})) {
        add(name, `${directory}/package.json ${field}`);
      }
    }
  }

  for (const name of declared) {
    const typed = typedPackageOf(name);
    if (typed && evidence.has(typed)) add(name, `types for ${typed}`);
  }

  /** @type {Map<string, string[]>} package → its declared required peers. */
  const requiredPeers = new Map();
  const requiredPeersOf = (name) => {
    if (!requiredPeers.has(name)) {
      const installed = installedManifest(root, name);
      requiredPeers.set(
        name,
        Object.keys(installed?.peerDependencies ?? {}).filter(
          (peer) =>
            declared.has(peer) &&
            !installed.peerDependenciesMeta?.[peer]?.optional,
        ),
      );
    }
    return requiredPeers.get(name);
  };

  /**
   * Everything `seeds` reaches through required peers, each mapped to the
   * package that pulled it in (`null` for a seed). Pure: records no evidence.
   */
  const peerClosure = (seeds) => {
    const reached = new Map([...seeds].map((name) => [name, null]));
    const queue = [...seeds];
    while (queue.length) {
      const name = queue.shift();
      for (const peer of requiredPeersOf(name)) {
        if (reached.has(peer)) continue;
        reached.set(peer, name);
        queue.push(peer);
      }
    }
    return reached;
  };

  const recordPeers = (closure) => {
    for (const [name, pulledBy] of closure) {
      if (pulledBy === null || evidence.has(name)) continue;
      evidence.set(name, [`required peer of ${pulledBy}`]);
    }
  };

  // Detected consumers first, with no allow-list help: an entry for a package
  // found here is redundant.
  const detected = peerClosure(new Set(evidence.keys()));
  recordPeers(detected);

  // So is an entry some *other* clean entry already pulls in as a required
  // peer. Entries are checked in list order and a redundant one stops counting
  // at once, so of two entries that require each other only the first is
  // reported — deleting both would leave neither covered.
  const clean = new Set(
    implicit
      .filter((entry) => entry.kind === 'clean' && declared.has(entry.package))
      .map((entry) => entry.package),
  );
  const staleEntries = [];
  const seen = new Set();
  for (const entry of implicit) {
    if (seen.has(entry.package)) {
      staleEntries.push({ ...entry, problem: 'listed twice' });
    } else if (!declared.has(entry.package)) {
      staleEntries.push({ ...entry, problem: 'not a root dependency' });
    } else if (detected.has(entry.package)) {
      staleEntries.push({
        ...entry,
        problem: `has a consumer: ${evidence.get(entry.package)[0]}`,
      });
    } else {
      const others = new Set([...detected.keys(), ...clean]);
      others.delete(entry.package);
      const pulledBy = peerClosure(others).get(entry.package);
      if (pulledBy) {
        staleEntries.push({
          ...entry,
          problem: `has a consumer: required peer of ${pulledBy}`,
        });
        clean.delete(entry.package);
      }
    }
    seen.add(entry.package);
  }

  const consumed = peerClosure(new Set([...detected.keys(), ...clean]));
  recordPeers(consumed);
  const deferred = new Set(
    implicit
      .filter((entry) => entry.kind === 'deferred')
      .map((entry) => entry.package),
  );

  const unused = [...declared]
    .filter((name) => !consumed.has(name) && !deferred.has(name))
    .sort();
  const duplicates = dependencies
    .filter((name) => devDependencies.includes(name))
    .sort();
  const typesInDependencies = dependencies
    .filter((name) => name.startsWith('@types/'))
    .sort();

  return {
    declared: declared.size,
    scannedCode,
    unused,
    duplicates,
    typesInDependencies,
    staleEntries,
    deferred: [...deferred].filter((name) => declared.has(name)).sort(),
    evidence: Object.fromEntries([...evidence].sort()),
  };
}

/**
 * Whether a scan fails the check. A scan that read no code at all fails too:
 * zero consumers found everywhere reads exactly like a tree full of unused
 * dependencies, and is a broken check either way.
 *
 * @param result A scan from {@link scanRoot}.
 */
export function hasFailure(result) {
  return (
    result.scannedCode === 0 ||
    result.unused.length > 0 ||
    result.duplicates.length > 0 ||
    result.typesInDependencies.length > 0 ||
    result.staleEntries.length > 0
  );
}

// ─── Report ──────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const result = scanRoot();

  if (args.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
    // Not process.exit(): stdout to a pipe is asynchronous, and exiting at once
    // cuts the report (about 200 KB) off at the pipe buffer.
    process.exitCode = hasFailure(result) ? 1 : 0;
    return;
  }

  if (!result.scannedCode) {
    console.error(
      '\n❌  Read 0 source files — the file listing found nothing to scan. This is a broken\n' +
        '   check, not a clean tree: every dependency would read as unused.\n',
    );
    process.exit(1);
  }

  const failures = [];
  if (result.unused.length) {
    failures.push(
      `${result.unused.length} root dependenc${result.unused.length === 1 ? 'y has' : 'ies have'} no consumer:\n` +
        result.unused.map((name) => `      ✗ ${name}`).join('\n') +
        '\n   Remove it from package.json (then `yarn install` so yarn.lock follows), or, if\n' +
        '   something loads it in a way this check cannot see, add it to IMPLICIT_CONSUMERS\n' +
        '   in scripts/check-root-dependencies.mjs with the consumer named.',
    );
  }
  if (result.duplicates.length) {
    failures.push(
      `listed in both dependencies and devDependencies:\n` +
        result.duplicates.map((name) => `      ✗ ${name}`).join('\n') +
        '\n   Keep one entry: `dependencies` for runtime code, `devDependencies` for tooling.',
    );
  }
  if (result.typesInDependencies.length) {
    failures.push(
      `type packages under dependencies:\n` +
        result.typesInDependencies.map((name) => `      ✗ ${name}`).join('\n') +
        '\n   `@types/*` is build tooling; move it to devDependencies.',
    );
  }
  if (result.staleEntries.length) {
    failures.push(
      `IMPLICIT_CONSUMERS entr${result.staleEntries.length === 1 ? 'y is' : 'ies are'} stale:\n` +
        result.staleEntries
          .map((entry) => `      ✗ ${entry.package} — ${entry.problem}`)
          .join('\n') +
        '\n   Delete the entry; a reason nobody needs is a promise about code that is gone.',
    );
  }

  if (!failures.length) {
    if (!args.includes('--quiet')) {
      const deferred = result.deferred.length
        ? ` (${result.deferred.length} deferred: ${result.deferred.join(', ')})`
        : '';
      console.log(
        `✅  ${result.declared} root dependencies, ${result.scannedCode} source files scanned — every one has a consumer or a reason${deferred}.`,
      );
    }
    process.exit(0);
  }

  for (const failure of failures) console.error(`\n❌  ${failure}`);
  console.error('');
  process.exit(1);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main();
}
