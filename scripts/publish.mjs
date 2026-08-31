#!/usr/bin/env node
/**
 * Malva UI Library — Publish Pipeline
 *
 * Replaces [PLACEHOLDER] tokens in built package.json files with real versions
 * resolved from the workspace root package.json, then optionally publishes to npm.
 *
 * Usage:
 *   node scripts/publish.mjs [--dry-run] [--tag <tag>] [--registry <url>] [--otp <code>]
 *
 * Flags:
 *   --dry-run        Replace placeholders and print output; skip `npm publish`.
 *   --tag <tag>      npm dist-tag (default: "latest").
 *   --registry <url> Custom npm registry URL (e.g. http://localhost:4873 for Verdaccio).
 *   --otp <code>     Two-factor one-time password. npmjs requires 2FA (or a granular
 *                    token with bypass-2fa) to publish. A single code has to cover all
 *                    sequential publishes, so a version already present on the
 *                    target registry is skipped — rerunning with a fresh code resumes
 *                    where an expired one left off instead of half-publishing.
 *
 * Placeholder → root package.json mapping:
 *   0.0.0-malva-ui-package-version       → .version
 *   0.0.0-angular-aria-package-version   → .dependencies["@angular/aria"]
 *   0.0.0-angular-cdk-package-version    → .dependencies["@angular/cdk"]
 *   0.0.0-angular-common-package-version → .dependencies["@angular/common"]
 *   0.0.0-angular-core-package-version   → .dependencies["@angular/core"]
 *   0.0.0-angular-forms-package-version  → .dependencies["@angular/forms"]
 *   0.0.0-lucide-angular-package-version → .dependencies["@lucide/angular"]
 *   0.0.0-rxjs-package-version           → .dependencies["rxjs"]
 *   0.0.0-tiptap-package-version          → .dependencies["@tiptap/core"]
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { collectBrokenExports } from './dist-exports.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(__dirname, '..');

// ─── Parse CLI flags ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const tagIndex = args.indexOf('--tag');
const tag = tagIndex !== -1 ? args[tagIndex + 1] : 'latest';
const registryIndex = args.indexOf('--registry');
const registry = registryIndex !== -1 ? args[registryIndex + 1] : null;
const otpIndex = args.indexOf('--otp');
const otp = otpIndex !== -1 ? args[otpIndex + 1] : null;

/**
 * True when `name@version` is already on the target registry.
 *
 * `npm view` exits non-zero for an unpublished package (404), which is the
 * common case on a first release — treat any failure as "not published" and
 * let `npm publish` be the authority.
 */
const isAlreadyPublished = (name, version) => {
  const viewArgs = ['npm', 'view', `${name}@${version}`, 'version'];
  if (registry) viewArgs.push(`--registry=${registry}`);
  try {
    return execSync(viewArgs.join(' '), { stdio: 'pipe', cwd: workspaceRoot })
      .toString()
      .trim()
      .includes(version);
  } catch {
    return false;
  }
};

// ─── Read root package.json ──────────────────────────────────────────────────

const rootPkgPath = resolve(workspaceRoot, 'package.json');
const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'));

// ─── Version guard ──────────────────────────────────────────────────────────

if (rootPkg.version === '0.0.0') {
  console.error(
    '❌  Root package.json version is 0.0.0 — run `yarn nx release` to bump the version before publishing.',
  );
  process.exit(1);
}

const dep = (name) =>
  rootPkg.dependencies?.[name] ?? rootPkg.devDependencies?.[name];

/**
 * Widens an exact third-party peer version into a caret range.
 *
 * The root manifest pins Angular exactly (`22.0.7`) so the workspace builds
 * deterministically, but copying that pin straight into a published
 * `peerDependencies` makes every consumer on any *other* patch of the same
 * major fail to install — npm reports the mismatch as ERESOLVE rather than a
 * warning.
 *
 * The published range keeps the minor the workspace builds against and opens
 * the patch upwards: `22.0.7` → `^22.0.0` (the whole Angular 22.0 line, which
 * is what every Angular library ships), `3.29.2` → `^3.29.0`. Dropping to
 * `^3.0.0` would be wrong — a peer resolved at 3.0.0 predates APIs the build
 * actually uses.
 *
 * Left alone:
 *   - ranges the root already expresses (`^1.25.0`, `~7.8.0`)
 *   - the `@malva-ui/*` siblings — `release.projectsRelationship` is "fixed",
 *     so they are always published together at one exact version.
 */
const widenPeerRange = (name, version) => {
  if (name.startsWith('@malva-ui/')) return version;
  const exact = /^(\d+)\.(\d+)\.\d+$/.exec(version);
  return exact ? `^${exact[1]}.${exact[2]}.0` : version;
};

const tiptapPackages = [
  '@tiptap/core',
  '@tiptap/extension-file-handler',
  '@tiptap/extension-highlight',
  '@tiptap/extension-image',
  '@tiptap/extension-list',
  '@tiptap/extension-table',
  '@tiptap/extension-text-align',
  '@tiptap/extension-text-style',
  '@tiptap/extensions',
  '@tiptap/markdown',
  '@tiptap/pm',
  '@tiptap/starter-kit',
];
const tiptapVersion = dep('@tiptap/core');
const mismatchedTiptapPackages = tiptapPackages.filter(
  (name) => dep(name) !== tiptapVersion,
);

if (mismatchedTiptapPackages.length) {
  console.error(
    '❌  All root @tiptap dependencies must resolve to the @tiptap/core version:',
    mismatchedTiptapPackages,
  );
  process.exit(1);
}

/**
 * Version replacement map.
 * Keys are the exact placeholder strings found in library package.json files.
 * Values are the resolved versions from the root package.json.
 */
const versionMap = {
  '0.0.0-malva-ui-package-version': rootPkg.version,
  '0.0.0-angular-aria-package-version': dep('@angular/aria'),
  '0.0.0-angular-cdk-package-version': dep('@angular/cdk'),
  '0.0.0-angular-common-package-version': dep('@angular/common'),
  '0.0.0-angular-core-package-version': dep('@angular/core'),
  '0.0.0-angular-forms-package-version': dep('@angular/forms'),
  '0.0.0-lucide-angular-package-version': dep('@lucide/angular'),
  '0.0.0-rxjs-package-version': dep('rxjs'),
  '0.0.0-tiptap-package-version': tiptapVersion,
};

// Validate all placeholders resolved
const missing = Object.entries(versionMap)
  .filter(([, v]) => v == null)
  .map(([k]) => k);
if (missing.length) {
  console.error('❌  Could not resolve versions for placeholders:', missing);
  process.exit(1);
}

console.log('\n📦  Malva UI publish pipeline');
console.log('   Version map:');
for (const [placeholder, version] of Object.entries(versionMap)) {
  console.log(`     ${placeholder.padEnd(42)} → ${version}`);
}
if (dryRun) console.log('\n⚠️   Dry-run mode — npm publish will be skipped.\n');

// ─── Libraries to publish ────────────────────────────────────────────────────

const libraries = [
  { name: '@malva-ui/cdk', distDir: 'dist/libs/cdk' },
  { name: '@malva-ui/i18n', distDir: 'dist/libs/i18n' },
  { name: '@malva-ui/core', distDir: 'dist/libs/core' },
  { name: '@malva-ui/tailwind', distDir: 'dist/libs/tailwind' },
  // Publishes after core: it peer-depends on it, and the Tiptap peers moved
  // here with it, so a consumer who never imports the editor no longer sees
  // them at all.
  { name: '@malva-ui/editor', distDir: 'dist/libs/editor' },
];

const dependencyFields = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
];

// ─── Process each library ────────────────────────────────────────────────────

for (const lib of libraries) {
  const distPath = resolve(workspaceRoot, lib.distDir);
  const pkgPath = resolve(distPath, 'package.json');

  if (!existsSync(pkgPath)) {
    console.error(`\n❌  package.json not found at ${pkgPath}`);
    console.error(
      `   Run 'yarn nx build ${lib.name.replace('@malva-ui/', '')}' first.`,
    );
    process.exit(1);
  }

  console.log(`\n🔧  Processing ${lib.name} (${lib.distDir})`);

  // Replace all placeholders
  let pkgContent = readFileSync(pkgPath, 'utf8');
  let replacementCount = 0;

  for (const [placeholder, version] of Object.entries(versionMap)) {
    const occurrences = pkgContent.split(placeholder).length - 1;
    if (occurrences > 0) {
      pkgContent = pkgContent.replaceAll(placeholder, version);
      replacementCount += occurrences;
    }
  }

  // Verify no leftover placeholders
  const leftover = pkgContent.match(/\[[A-Z_]+_PACKAGE_VERSION\]/g);
  const semverPlaceholders = pkgContent.match(
    /0\.0\.0-[a-z0-9-]+-package-version/g,
  );
  if (leftover || semverPlaceholders) {
    console.error(
      `\n❌  Unresolved placeholders in ${lib.name}/package.json:`,
      [...(leftover ?? []), ...(semverPlaceholders ?? [])],
    );
    process.exit(1);
  }

  const resolved = JSON.parse(pkgContent);
  const wildcardDependencies = dependencyFields.flatMap((field) =>
    Object.entries(resolved[field] ?? {})
      .filter(([, version]) => version === '*')
      .map(([name]) => `${field}.${name}`),
  );

  if (wildcardDependencies.length) {
    console.error(
      `\n❌  Wildcard dependency versions in ${lib.name}/package.json:`,
      wildcardDependencies,
    );
    process.exit(1);
  }

  if (resolved.version !== rootPkg.version) {
    console.error(
      `\n❌  ${lib.name}/package.json resolved to ${resolved.version}, expected root version ${rootPkg.version}.`,
    );
    console.error('   Rebuild the libraries before publishing.');
    process.exit(1);
  }

  console.log(
    `   ✅  Resolved ${replacementCount} placeholder(s) → version ${resolved.version}`,
  );

  // Exact root pins must not become exact peer ranges — see widenPeerRange.
  for (const [name, version] of Object.entries(resolved.peerDependencies ?? {})) {
    const widened = widenPeerRange(name, version);
    if (widened !== version) {
      resolved.peerDependencies[name] = widened;
      console.log(`   ↔️   peer ${name}: ${version} → ${widened}`);
    }
  }

  // Preflight: every exports target must exist in dist. A broken map means
  // every consumer of that subpath fails to resolve — never publish it.
  const brokenExports = collectBrokenExports(resolved, distPath);
  if (brokenExports.length) {
    console.error(
      `\n❌  Unresolvable exports targets in ${lib.name}/package.json:`,
    );
    for (const entry of brokenExports) console.error(`     ${entry}`);
    process.exit(1);
  }

  if (!dryRun) {
    // Write the resolved package.json back to dist
    writeFileSync(pkgPath, JSON.stringify(resolved, null, 2) + '\n', 'utf8');
    console.log(`   📝  Wrote resolved package.json`);

    // Publish
    // --ignore-scripts skips the ng-packagr prepublishOnly guard which would
    // otherwise block publishing when a prior development build exists in dist.
    // Our pipeline builds with @nx/angular:package --configuration=production,
    // a full ng-packagr build: flattened fesm2022 bundles compiled to partial
    // Ivy, which is the Angular Package Format shape npm distribution needs.
    if (isAlreadyPublished(lib.name, resolved.version)) {
      console.log(
        `   ⏭   ${lib.name}@${resolved.version} is already on the registry — skipping`,
      );
      continue;
    }

    const publishArgs = [
      'npm',
      'publish',
      distPath,
      `--tag=${tag}`,
      '--ignore-scripts',
      // npm signs provenance from the CI run's OIDC identity, but only accepts
      // it for packages whose source repository is public — a provenance
      // publish from a private repo is rejected outright. Default it on in CI
      // and let the release workflow turn it off while the repo is private.
      ...(process.env.CI && process.env.NPM_PROVENANCE !== 'false'
        ? ['--provenance']
        : []),
    ];
    if (registry) publishArgs.push(`--registry=${registry}`);
    if (otp) publishArgs.push(`--otp=${otp}`);

    const cmd = publishArgs.join(' ');
    // Never echo the one-time password — the command is logged, not the secret.
    console.log(
      `   🚀  Publishing: ${cmd.replace(/--otp=\S+/, '--otp=******')}`,
    );
    execSync(cmd, { stdio: 'inherit', cwd: workspaceRoot });
    console.log(`   ✔   Published ${lib.name}@${resolved.version}`);
  } else {
    console.log(`   📋  Resolved package.json preview:`);
    console.log(resolved);
  }
}

console.log('\n✅  Done.\n');
