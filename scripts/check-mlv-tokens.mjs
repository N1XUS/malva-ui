#!/usr/bin/env node
/**
 * Malva UI — unknown `--mlv-*` token check
 *
 * `var()` falls back silently. A misspelled or invented custom property never
 * errors: it renders the fallback, drops out of theming, and ships. Four
 * downstream packages independently invented `--mlv-color-surface`,
 * `--mlv-radius-2`, `--mlv-border-1` and friends before anyone noticed.
 *
 * This check reads every `var(--mlv-…)` reference in the workspace stylesheets
 * and templates and reports any name that is declared nowhere *and* sits in a
 * namespace `libs/styles` owns — which is what makes it an invented token
 * rather than a component's own knob.
 *
 * A `var(--mlv-my-block-knob, default)` whose name is declared nowhere is a
 * deliberate, documented pattern: the fallback is the default and setting the
 * property is how a consumer retunes the component. Declaring such a knob on
 * the element that reads it would *break* the override, because the element's
 * own declaration beats any inherited one. So the check does not demand a
 * declaration — it demands that the name not squat on a design-system
 * namespace (`--mlv-background-*`, `--mlv-radius-*`, `--mlv-duration-*`, …),
 * because those namespaces are exactly where a typo reads as plausible.
 *
 * Usage:
 *   node scripts/check-mlv-tokens.mjs [--strict] [--json] [--quiet]
 *   yarn nx run styles:check-tokens
 *
 * Flags:
 *   --strict  Also fail on findings listed in the baseline.
 *   --json    Emit findings as JSON instead of a human-readable report.
 *   --quiet   Suppress the summary line when everything resolves.
 *
 * Exit code: 0 when every reference resolves (baselined findings excluded
 * unless --strict), 1 otherwise.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const strict = process.argv.includes('--strict');
const asJson = process.argv.includes('--json');
const quiet = process.argv.includes('--quiet');

/** Roots scanned for both declarations and references. */
const ROOTS = ['libs', 'apps'];

/** Directory names never descended into. */
const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  '.git',
  '.angular',
  '.nx',
  'coverage',
  'test-results',
]);

/**
 * Build artifacts checked into the tree. Their content is a copy of a source
 * file that is scanned anyway, so including them would double-report.
 */
const GENERATED_FILES = new Set([
  join('libs', 'core', 'styles', 'malva-ui.css'),
]);

/** Files scanned for `var(--mlv-…)` references. */
const REFERENCE_EXTENSIONS = ['.scss', '.css', '.html'];

/** Files scanned for declarations. */
const DECLARATION_EXTENSIONS = ['.scss', '.css', '.html', '.ts'];

/**
 * Animation knobs are a deliberate exception: `animations.scss` reads them with
 * a `var(name, default)` fallback and nothing ever declares them, because the
 * fallback *is* the default and setting the property is how a consumer retunes
 * the animation. They are part of the published surface and are listed in
 * `libs/styles/tokens.md`, so the allowlist is derived from that one file
 * rather than hand-maintained here.
 */
const HOOK_SOURCE = join('libs', 'styles', 'src', 'lib', 'animations.scss');

/** Directory whose declarations define the design-system namespaces. */
const STYLES_LIB = join('libs', 'styles', 'src', 'lib');

/**
 * Namespaces the design system deliberately does **not** have. Every observed
 * use was an invention borrowed from another library's vocabulary, so they are
 * reserved the same way a real namespace is.
 */
const FORBIDDEN_NAMESPACES = new Set(['color', 'status']);

/** Findings tracked as pre-existing. Removed as each one is fixed. */
const BASELINE_FILE = join('libs', 'styles', 'token-check-baseline.json');

// ─── File walking ────────────────────────────────────────────────────────────

/**
 * Recursively lists files under `directory` whose extension is in `extensions`.
 *
 * @param {string} directory — absolute path
 * @param {string[]} extensions
 * @param {string[]} [accumulator]
 * @returns {string[]} absolute paths
 */
function walk(directory, extensions, accumulator = []) {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return accumulator;
  }

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) continue;
      walk(path, extensions, accumulator);
    } else if (extensions.some((extension) => entry.name.endsWith(extension))) {
      if (GENERATED_FILES.has(relative(workspaceRoot, path))) continue;
      accumulator.push(path);
    }
  }

  return accumulator;
}

const allFiles = ROOTS.flatMap((root) =>
  walk(resolve(workspaceRoot, root), DECLARATION_EXTENSIONS),
);

// ─── Name normalisation ──────────────────────────────────────────────────────

/**
 * A Sass or template-literal interpolation makes a name only partly knowable at
 * scan time. `--mlv-muted-#{$tone}-bg-2` is normalised to the glob
 * `--mlv-muted-*-bg-2`, which is then matched against the other side of the
 * ledger instead of compared for equality.
 *
 * @param {string} raw
 * @returns {{ name: string, dynamic: boolean }}
 */
function normalise(raw) {
  const name = raw
    .trim()
    .replace(/#\{[^}]*\}/g, '*')
    .replace(/\$\{[^}]*\}/g, '*');
  return { name, dynamic: name.includes('*') };
}

/**
 * Compiles a glob name into an anchored regular expression.
 *
 * @param {string} glob
 */
function globToRegExp(glob) {
  const source = glob
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[A-Za-z0-9_-]*');
  return new RegExp(`^${source}$`);
}

// ─── Declarations ────────────────────────────────────────────────────────────

/** Custom properties declared with a literal name. @type {Set<string>} */
const declaredNames = new Set();
/** Custom properties declared through interpolation. @type {RegExp[]} */
const declaredPatterns = [];

/** Records one declaration, literal or interpolated. */
function recordDeclaration(raw) {
  const { name, dynamic } = normalise(raw);
  if (dynamic) declaredPatterns.push(globToRegExp(name));
  else declaredNames.add(name);
}

/**
 * Declaration syntaxes, in every place this workspace writes a custom property.
 * Each pattern must capture the property name in group 1.
 */
const DECLARATION_PATTERNS = [
  // Stylesheet declaration — `--mlv-x: value`
  /(--mlv-[A-Za-z0-9_#${}.\-]*?)\s*:(?!:)/g,
  // Renderer / DOM — `setProperty('--mlv-x', …)`
  /setProperty\(\s*['"`](--mlv-[A-Za-z0-9_${}.\-]*)/g,
  // Template or host binding — `[style.--mlv-x]`
  /\[style\.(--mlv-[A-Za-z0-9_${}.\-]*)/g,
];

for (const file of allFiles) {
  const source = readFileSync(file, 'utf8');
  for (const pattern of DECLARATION_PATTERNS) {
    for (const match of source.matchAll(pattern)) {
      // `var(--mlv-a, …)` never precedes a colon, so the stylesheet pattern
      // cannot mistake a reference for a declaration.
      recordDeclaration(match[1]);
    }
  }
}

// Animation override hooks — see HOOK_SOURCE above.
const hookSource = readFileSync(resolve(workspaceRoot, HOOK_SOURCE), 'utf8');
for (const match of hookSource.matchAll(/var\(\s*(--mlv-[A-Za-z0-9_-]+)/g)) {
  declaredNames.add(match[1]);
}

// ─── Reserved namespaces ─────────────────────────────────────────────────────

/**
 * Every first name segment `libs/styles` declares — `background`, `radius`,
 * `duration`, `palette`, … — plus the palette family names, so that
 * `--mlv-danger-500` is caught as a mangled `--mlv-palette-danger-500`.
 *
 * Derived from the source rather than hand-listed: a new token family becomes
 * a reserved namespace the moment it is declared.
 *
 * @type {Set<string>}
 */
const reservedNamespaces = new Set(FORBIDDEN_NAMESPACES);

for (const file of walk(resolve(workspaceRoot, STYLES_LIB), ['.scss'])) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(
    /(--mlv-([A-Za-z0-9]+)-[A-Za-z0-9_-]*)\s*:(?!:)/g,
  )) {
    reservedNamespaces.add(match[2]);
    const family = /^--mlv-palette-([a-z]+)-/.exec(match[1]);
    if (family) reservedNamespaces.add(family[1]);
  }
}

// ─── References ──────────────────────────────────────────────────────────────

/**
 * @typedef {object} Finding
 * @property {string} name
 * @property {string[]} locations — `path:line`, workspace-relative
 */

/** @type {Map<string, string[]>} */
const unresolved = new Map();
let referenceCount = 0;

const referenceFiles = allFiles.filter((file) =>
  REFERENCE_EXTENSIONS.some((extension) => file.endsWith(extension)),
);

for (const file of referenceFiles) {
  const relativePath = relative(workspaceRoot, file);
  const lines = readFileSync(file, 'utf8').split('\n');

  lines.forEach((line, index) => {
    for (const match of line.matchAll(
      /var\(\s*(--mlv-[A-Za-z0-9_#${}.\-]*)/g,
    )) {
      referenceCount++;
      const { name, dynamic } = normalise(match[1]);

      const resolved = dynamic
        ? (() => {
            const pattern = globToRegExp(name);
            return (
              [...declaredNames].some((declared) => pattern.test(declared)) ||
              declaredPatterns.some((declaredPattern) =>
                declaredPattern.test(name.replaceAll('*', 'x')),
              )
            );
          })()
        : declaredNames.has(name) ||
          declaredPatterns.some((pattern) => pattern.test(name));

      if (resolved) continue;

      // Undeclared, but outside every namespace libs/styles owns — a
      // component-scoped knob whose `var()` fallback is its default.
      const namespace = /^--mlv-([A-Za-z0-9]+)-/.exec(name)?.[1];
      if (!namespace || !reservedNamespaces.has(namespace)) continue;

      const locations = unresolved.get(name) ?? [];
      locations.push(`${relativePath}:${index + 1}`);
      unresolved.set(name, locations);
    }
  });
}

// ─── Report ──────────────────────────────────────────────────────────────────

/**
 * Baseline of findings that already existed when the check was introduced, in
 * files their owning team has not yet touched. New findings still fail.
 *
 * @type {Record<string, string>} name → the token that should replace it
 */
const baseline = existsSync(resolve(workspaceRoot, BASELINE_FILE))
  ? (JSON.parse(readFileSync(resolve(workspaceRoot, BASELINE_FILE), 'utf8'))
      .known ?? {})
  : {};

/** @type {Finding[]} */
const allFindings = [...unresolved.entries()]
  .map(([name, locations]) => ({ name, locations }))
  .sort((a, b) => a.name.localeCompare(b.name));

const findings = strict
  ? allFindings
  : allFindings.filter((finding) => !(finding.name in baseline));
const baselined = allFindings.length - findings.length;

if (asJson) {
  console.log(
    JSON.stringify(
      {
        scanned: referenceFiles.length,
        references: referenceCount,
        findings,
        baselined,
      },
      null,
      2,
    ),
  );
  process.exit(findings.length ? 1 : 0);
}

if (!findings.length) {
  if (!quiet) {
    console.log(
      `✅  ${referenceCount} \`--mlv-*\` references across ${referenceFiles.length} files — every new name resolves.`,
    );
    if (baselined) {
      console.log(
        `   ${baselined} known invented name(s) remain in ${BASELINE_FILE}; run with --strict to list them.`,
      );
    }
  }
  process.exit(0);
}

const total = findings.reduce((sum, f) => sum + f.locations.length, 0);
console.error(
  `\n❌  ${findings.length} unknown \`--mlv-*\` name(s) in ${total} place(s).`,
);
console.error(
  '   These resolve to nothing at runtime — the var() fallback ships instead.',
);
console.error(
  '   Correct names: libs/styles/tokens.md (see "Commonly mistaken names").\n',
);

for (const finding of findings) {
  const suggestion = baseline[finding.name];
  console.error(`  ${finding.name}${suggestion ? `  →  ${suggestion}` : ''}`);
  for (const location of finding.locations.slice(0, 5)) {
    console.error(`      ${location}`);
  }
  if (finding.locations.length > 5) {
    console.error(`      … and ${finding.locations.length - 5} more`);
  }
}

console.error(
  '\n   A component may keep its own `--mlv-<block>-*` knob undeclared and rely on',
);
console.error(
  '   the var() fallback — that is fine. Only names inside a namespace libs/styles',
);
console.error('   owns are reported here.\n');

process.exit(1);
