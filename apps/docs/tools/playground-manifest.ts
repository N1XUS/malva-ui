/**
 * Resolves the npm versions and peer graph the zero-install playground template
 * installs, from the workspace root `package.json`.
 *
 * This is the same source of truth `scripts/publish.mjs` resolves its
 * `0.0.0-*-package-version` placeholders from, and `nx release` is configured
 * (`nx.json` → `release.version.manifestRootsToUpdate`, plus
 * `scripts/release-version-actions.cjs`) to treat the root manifest as the
 * canonical version of every published project. So a template built from here
 * cannot drift: when `0.2.0` ships, `nx release` writes `0.2.0` into the root
 * manifest and the next docs build emits `"@malva-ui/core": "0.2.0"` with no
 * edit anywhere.
 *
 * Kept free of file-system writes so it can be unit tested; the CLI wrapper is
 * `./generate-playground-versions.ts`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/** A parsed npm manifest, narrowed to the fields this module reads. */
export interface PackageManifest {
  readonly name?: string;
  readonly version?: string;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
}

/** The generated tables the browser-side project builder consumes. */
export interface PlaygroundManifest {
  /** npm package name → the exact version (or range) the template installs. */
  readonly versions: Record<string, string>;
  /** Published Malva package → the peers a consumer must install alongside it. */
  readonly peers: Record<string, string[]>;
}

/**
 * Placeholder → root `package.json` dependency key.
 *
 * Mirrors the table in `scripts/publish.mjs`. `0.0.0-malva-ui-package-version`
 * is absent because it resolves to the root `version`, not to a dependency.
 */
const PLACEHOLDER_DEPENDENCY: Readonly<Record<string, string>> = {
  '0.0.0-angular-aria-package-version': '@angular/aria',
  '0.0.0-angular-cdk-package-version': '@angular/cdk',
  '0.0.0-angular-common-package-version': '@angular/common',
  '0.0.0-angular-core-package-version': '@angular/core',
  '0.0.0-angular-forms-package-version': '@angular/forms',
  '0.0.0-lucide-angular-package-version': '@lucide/angular',
  '0.0.0-rxjs-package-version': 'rxjs',
  '0.0.0-tiptap-package-version': '@tiptap/core',
};

/** The placeholder standing for the Malva release version itself. */
const MALVA_VERSION_PLACEHOLDER = '0.0.0-malva-ui-package-version';

/**
 * The shape every publish placeholder takes.
 *
 * Used to catch a *new* placeholder that {@link PLACEHOLDER_DEPENDENCY} does not
 * map: without this, an unmapped one falls through to "the declared range is the
 * answer" and is written into the generated `package.json` verbatim, where npm
 * fails the install with `No matching version found`. The nine entries match
 * `scripts/publish.mjs` exactly today, so this is a tripwire for the next one
 * added there and not here.
 */
const PUBLISH_PLACEHOLDER = /^0\.0\.0-.*-package-version$/;

/**
 * Returns `resolved`, or throws when it is still an unsubstituted placeholder.
 *
 * @param name npm package name being resolved.
 * @param declared The range the depending manifest declared.
 * @param resolved The version resolution arrived at.
 * @throws When `resolved` is a `0.0.0-*-package-version` literal.
 */
function assertSubstituted(
  name: string,
  declared: string | undefined,
  resolved: string,
): string {
  if (!PUBLISH_PLACEHOLDER.test(resolved)) return resolved;

  throw new Error(
    `"${name}" resolves to the placeholder "${declared ?? resolved}", which ` +
      'nothing maps to a workspace root package.json dependency. Add it to ' +
      'PLACEHOLDER_DEPENDENCY in apps/docs/tools/playground-manifest.ts (and ' +
      'to the version map in scripts/publish.mjs, if it is not there either) — ' +
      'npm would otherwise fail the playground install with "No matching ' +
      'version found".',
  );
}

/**
 * Packages the generated project needs that no published manifest declares as a
 * peer: the Angular toolchain that compiles it, the runtime pieces `main.ts`
 * imports directly, and `@angular/router` / `sortablejs`, which docs examples
 * import but no Malva package lists.
 */
export const EXTRA_PLAYGROUND_PACKAGES: readonly string[] = [
  '@angular/build',
  '@angular/cli',
  '@angular/compiler',
  '@angular/compiler-cli',
  '@angular/platform-browser',
  '@angular/router',
  'sortablejs',
  'tslib',
  'typescript',
];

/**
 * Walks up from `startDir` to the directory holding `nx.json`.
 *
 * Duplicated from `./api-extractor` rather than imported: that module loads
 * `ts-morph` at module scope, and this generator runs on every `docs:build`,
 * `docs:test` and `docs:typecheck` — it has no business paying for a TypeScript
 * program to read two JSON files.
 *
 * @param startDir Directory to start from.
 * @throws When no `nx.json` is found on the way up.
 */
export function findRepoRoot(startDir: string): string {
  let dir = path.resolve(startDir);
  for (;;) {
    if (fs.existsSync(path.join(dir, 'nx.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        `Could not locate workspace root (nx.json) from ${startDir}`,
      );
    }
    dir = parent;
  }
}

/**
 * Reads and parses a JSON manifest.
 *
 * @param file Absolute path to a `package.json`.
 */
export function readManifest(file: string): PackageManifest {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as PackageManifest;
}

/**
 * Resolves one dependency specifier against the workspace root manifest.
 *
 * A `0.0.0-*-package-version` placeholder is substituted the way
 * `scripts/publish.mjs` substitutes it. Any other declared range still defers to
 * the root manifest when it declares the package, so the playground installs the
 * versions this workspace is actually developed against rather than the widest
 * range a peer happens to permit.
 *
 * @param name npm package name.
 * @param declared The range declared by the depending manifest, if any.
 * @param root The workspace root manifest.
 * @throws When neither the root manifest nor a declared range can answer, or
 *   when the answer is still an unsubstituted `0.0.0-*-package-version`.
 */
export function resolveVersion(
  name: string,
  declared: string | undefined,
  root: PackageManifest,
): string {
  if (declared === MALVA_VERSION_PLACEHOLDER) {
    if (!root.version) {
      throw new Error('The workspace root package.json declares no version.');
    }
    return root.version;
  }

  const placeholderTarget =
    declared === undefined ? undefined : PLACEHOLDER_DEPENDENCY[declared];
  const key = placeholderTarget ?? name;
  const fromRoot = root.dependencies?.[key] ?? root.devDependencies?.[key];

  if (fromRoot) return assertSubstituted(name, declared, fromRoot);
  if (placeholderTarget) {
    throw new Error(
      `The workspace root package.json declares no "${key}", which ` +
        `"${name}" needs to resolve the ${declared} placeholder.`,
    );
  }
  if (declared) return assertSubstituted(name, declared, declared);

  throw new Error(
    `Cannot resolve a version for "${name}": it is declared neither in the ` +
      'workspace root package.json nor by the manifest that requires it.',
  );
}

/**
 * Builds the version and peer tables for every published Malva package.
 *
 * @param repoRoot Absolute path to the workspace root.
 * @param projects Published project names, as listed in `nx.json` → `release.projects`.
 */
export function buildPlaygroundManifest(
  repoRoot: string,
  projects: readonly string[],
): PlaygroundManifest {
  const root = readManifest(path.join(repoRoot, 'package.json'));
  const versions: Record<string, string> = {};
  const peers: Record<string, string[]> = {};

  for (const project of projects) {
    const manifestPath = path.join(repoRoot, 'libs', project, 'package.json');
    const manifest = readManifest(manifestPath);
    const name = manifest.name;
    if (!name) {
      throw new Error(`${manifestPath} declares no package name.`);
    }

    versions[name] = resolveVersion(name, manifest.version, root);

    const declaredPeers = manifest.peerDependencies ?? {};
    peers[name] = Object.keys(declaredPeers).sort();
    for (const [peer, declared] of Object.entries(declaredPeers)) {
      versions[peer] = resolveVersion(peer, declared, root);
    }
  }

  for (const name of EXTRA_PLAYGROUND_PACKAGES) {
    versions[name] = resolveVersion(name, undefined, root);
  }

  return { versions: sortKeys(versions), peers: sortKeys(peers) };
}

/**
 * Renders the generated TypeScript module the docs app imports.
 *
 * @param manifest Tables produced by {@link buildPlaygroundManifest}.
 */
export function renderPlaygroundVersionsModule(
  manifest: PlaygroundManifest,
): string {
  return `/* eslint-disable */
// GENERATED FILE — do not edit.
//
// Written by \`nx run docs:generate-playground-versions\`
// (apps/docs/tools/generate-playground-versions.ts) from the workspace root
// package.json — the same source scripts/publish.mjs resolves its version
// placeholders from — so the StackBlitz template can never name a version the
// release pipeline is not about to publish.

/** npm package name -> the version the zero-install playground installs. */
export const PLAYGROUND_VERSIONS: Readonly<Record<string, string>> = ${stringify(
    manifest.versions,
  )};

/** Published Malva package -> the peers a consumer must install alongside it. */
export const PLAYGROUND_PEERS: Readonly<Record<string, readonly string[]>> = ${stringify(
    manifest.peers,
  )};
`;
}

/** Returns a new object with the same entries, ordered by key. */
function sortKeys<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).sort(([a], [b]) => a.localeCompare(b)),
  );
}

/**
 * Serialises a value as TypeScript source.
 *
 * JSON's own output is valid TypeScript, and the generated file is git-ignored
 * so no formatter ever runs over it — hence no quote-style rewriting here,
 * which could only corrupt a key or value that happens to contain a quote.
 */
function stringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
