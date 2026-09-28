#!/usr/bin/env node
/**
 * Malva UI — disabled-surface and error-only-tint contract check
 *
 * Two rules from the 2026-08 visual harmonization, enforced on every component
 * stylesheet under `libs/`:
 *
 *   SF-R4 — disabled is a declared surface, not an opacity multiply. A
 *   disabled control paints `--mlv-background-disabled` and
 *   `--mlv-text-disabled`; it does not set `opacity` on itself. Opacity
 *   multiplies every colour against whatever happens to be behind it, so the
 *   same control dims differently on every surface, and a control nested in a
 *   dimmed one dims twice (a disabled segmented group used to draw its labels
 *   at 0.4 × 0.4 = 16 % alpha).
 *
 *   SF-R6 — only `error` tints a form control. `success`, `warning` and `info`
 *   carry their meaning in `mlv-message`; the control declares nothing for
 *   them (`form-control-wrapper.scss` states the rule).
 *
 * Each stylesheet is compiled (Sass) or read (plain CSS) and parsed with
 * PostCSS, so nesting, `&` and `@each` loops are checked in the selectors the
 * browser actually sees. A finding is reported for:
 *
 *   • `opacity-under-disabled` — an `opacity` declaration in a rule whose
 *     selector carries a disabled marker (`--disabled`, `:disabled`,
 *     `[disabled]`, `[aria-disabled]`, ignoring anything inside `:not(…)`),
 *     unless the selector is on `OPACITY_ALLOWED`. `opacity: 0` (a hide) and
 *     `opacity: 1` (a reset) are not dims and pass;
 *   • `opacity-custom-property` — a custom property whose name ends in
 *     `opacity` (`--mlv-accordion-icon-opacity`, `--check-opacity`) declared
 *     under a disabled selector with any value but `0` / `1`. It is the same
 *     dim routed through a base rule's `opacity: var(--…)`, where the
 *     `opacity` check above cannot see it. The allow-list does not apply: an
 *     allowed dim is written as `opacity` on the allowed selector itself;
 *   • `literal-opacity` — an allow-listed selector whose value is anything but
 *     exactly `var(--mlv-disabled-opacity)`;
 *   • `opacity-fallback` — `var(--mlv-disabled-opacity, …)` anywhere: the token
 *     always resolves, so a fallback is dead code that drifts (a `0.56` one sat
 *     beside the `0.4` token for months);
 *   • `state-tint` — a selector naming `--state-success`, `--state-warning` or
 *     `--state-info`, unless on `STATE_TINT_ALLOWED` (empty: nothing may);
 *   • `stale-allow` — an allow-list entry that matched nothing;
 *   • `compile-error` / `no-sources` — the walk could not see what it checks,
 *     so a clean answer would be vacuous.
 *
 * Blind spots — a green run does not rule these out; review them by hand
 * (none has a live instance in `libs/` today):
 *
 *   • disabled states the marker does not name: `[aria-disabled='true' i]`,
 *     `:not(:enabled)`, `[data-disabled]`, `.is-disabled`, `[inert]`, or any
 *     state class without `--disabled` in it;
 *   • dims that are not an `opacity` declaration: `filter: opacity(…)`,
 *     `color-mix(…, transparent)` or an alpha colour, a `@keyframes` animation
 *     applied under a disabled selector;
 *   • a custom property that carries the dim under a name not ending in
 *     `opacity` (`--x-alpha: 0.4`, read by a base rule's `opacity: var(…)`);
 *   • stylesheets outside a `libs/<project>/src/` tree, and inline
 *     `styles: [...]` in a component decorator — only `.scss` / `.css` files
 *     under `libs/` are walked.
 *
 * Usage:
 *   node scripts/check-disabled-surface.mjs [--json] [--quiet]
 *   yarn nx run styles:check-disabled-surface
 *
 * Exit code: 0 when clean, 1 when at least one finding is reported.
 *
 * Rule: .claude/rules/bem-scss.md, section "Disabled is a declared surface".
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import postcss from 'postcss';
import * as sass from 'sass';

// ─── Configuration ───────────────────────────────────────────────────────────

/** The one value an allow-listed disabled opacity may take. */
export const DISABLED_OPACITY = 'var(--mlv-disabled-opacity)';

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
 * Sheets that emit nothing on their own (partials, mixin libraries) — the same
 * set `libs/styles/src/lib/layers.spec.mjs` exempts.
 */
const EMITS_NOTHING =
  /(^|\/)_[^/]*$|\.mixins\.scss$|\/(mixins|density|breakpoints)\.scss$/;

/**
 * Not component stylesheets: the global entry point, the Tailwind adapter and
 * the token library, none of which styles a control.
 */
const NOT_A_COMPONENT_SHEET = /^libs\/(core\/styles|tailwind|styles)\//;

/**
 * Selectors that keep a disabled opacity, each with the reason it is the right
 * tool. Every entry names the file and the compiled selector exactly; an entry
 * that matches nothing fails the check (`stale-allow`), and an entry's value
 * must be exactly {@link DISABLED_OPACITY} (`literal-opacity`).
 *
 * The rule of thumb: opacity stays only where the dimmed thing is data with no
 * disabled token (a colour plane, an image) or where the component has no
 * surface or ink of its own to declare.
 */
export const OPACITY_ALLOWED = [
  {
    file: 'libs/core/icon-toggle/src/lib/icon-toggle/icon-toggle.scss',
    selector: '.mlv-icon-toggle:disabled',
    reason:
      'Chromeless, glyph-only control: no surface to declare, and its pressed state is a fill on the consumer’s projected glyph, which a colour token cannot reach.',
  },
  {
    file: 'libs/core/expand/src/lib/expand/expand.scss',
    selector: '.mlv-expand--disabled',
    reason:
      'Headless container: it has no surface or ink of its own, only consumer content, and its `disabled` JSDoc promises that content is dimmed.',
  },
  {
    file: 'libs/core/color-picker/src/lib/color-picker/color-picker.scss',
    selector: '.mlv-color-picker--disabled .mlv-color-picker__canvas-container',
    reason:
      'The saturation/lightness plane is colour data; there is no disabled token for an arbitrary colour.',
  },
  {
    file: 'libs/core/color-picker/src/lib/color-picker/color-picker.scss',
    selector: '.mlv-color-picker--disabled .mlv-color-picker__sliders',
    reason:
      'The preview swatch and the hue / opacity strips are colour data, like the plane.',
  },
  {
    file: 'libs/core/color-picker/src/lib/color-picker-popup/color-picker-popup.scss',
    selector:
      '.mlv-color-picker-popup--disabled .mlv-color-picker-popup__swatch',
    reason:
      'The swatch shows the value colour — colour data, like the picker plane.',
  },
  {
    file: 'libs/core/file-upload/src/lib/file-upload/file-upload.scss',
    selector: '.mlv-file-upload--disabled .mlv-file-upload__cover-image',
    reason:
      'The cover preview is an image; there is no disabled token for pixels.',
  },
  {
    file: 'libs/core/file-upload/src/lib/file-upload/file-upload.scss',
    selector: '.mlv-file-upload--disabled .mlv-file-upload-item__thumbnail-img',
    reason:
      'A file row’s thumbnail is an image preview, like the cover image. The row’s text and placeholder icon take the disabled ink instead.',
  },
  {
    file: 'libs/core/file-upload/src/lib/file-upload/file-upload.scss',
    selector: '.mlv-file-upload--disabled .mlv-file-upload__action',
    reason:
      'Projected `[mlvFileUploadAction]` controls are consumer content the stylesheet cannot restyle — the `mlv-expand` rationale; the consumer disables them.',
  },
];

/** Selectors allowed to name a non-error state. None: SF-R6 has no exceptions. */
export const STATE_TINT_ALLOWED = [];

// ─── Analysis ────────────────────────────────────────────────────────────────

/** A non-error validation state named in a selector (SF-R6). */
const STATE_TINT = /--state-(success|warning|info)(?![\w-])/;

/** A disabled marker in a selector, once `:not(…)` groups are removed. */
const DISABLED_MARKER =
  /--disabled(?![\w-])|:disabled(?![\w-])|\[disabled(?:[\]=~|^$*\s])|\[aria-disabled(?:\]|\s*=\s*['"]?true['"]?\s*\])/;

/** `var(--mlv-disabled-opacity, <fallback>)`, anywhere in a value. */
const OPACITY_FALLBACK = /var\(\s*--mlv-disabled-opacity\s*,/;

/** A custom property that carries an opacity (`--mlv-accordion-icon-opacity`). */
const OPACITY_CUSTOM_PROPERTY = /^--[\w-]*opacity$/i;

/**
 * Whether an opacity value leaves the element undimmed: `0` hides it, `1`
 * resets it. Anything else — a fraction, a `var()` — is a dim.
 *
 * @param {string} value
 * @returns {boolean}
 */
const isHideOrReset = (value) => /^[01](\.0+)?$/.test(value.trim());

/**
 * Removes every `:not(…)` group, nested parentheses included: a marker inside
 * one (`:hover:not(:disabled)`) describes the enabled state.
 *
 * @param {string} selector
 * @returns {string}
 */
export function stripNegations(selector) {
  let out = '';
  let index = 0;
  while (index < selector.length) {
    if (selector.startsWith(':not(', index)) {
      let depth = 0;
      let cursor = index + ':not'.length;
      for (; cursor < selector.length; cursor++) {
        if (selector[cursor] === '(') depth++;
        else if (selector[cursor] === ')' && --depth === 0) break;
      }
      index = cursor + 1;
      continue;
    }
    out += selector[index++];
  }
  return out;
}

/**
 * Whether `selector` targets a disabled state (its own, or an ancestor's).
 *
 * @param {string} selector
 * @returns {boolean}
 */
export function isDisabledSelector(selector) {
  return DISABLED_MARKER.test(stripNegations(selector));
}

/** Collapses whitespace so allow-list entries compare as written. */
const normalise = (selector) => selector.replace(/\s+/g, ' ').trim();

/** True when `node` sits inside an `@keyframes` block. */
function inKeyframes(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type === 'atrule' && /keyframes$/i.test(parent.name))
      return true;
  }
  return false;
}

/**
 * Checks one compiled stylesheet.
 *
 * @param {string} css Compiled CSS text.
 * @param {string} file Workspace-relative path, for findings and allow-list lookup.
 * @param {{ opacityAllowed?: typeof OPACITY_ALLOWED, stateTintAllowed?: typeof STATE_TINT_ALLOWED, used?: Set<object> }} [options]
 * @returns {{ file: string, line: number | null, kind: string, selector: string, detail: string }[]}
 */
export function analyseCss(css, file, options = {}) {
  const opacityAllowed = options.opacityAllowed ?? OPACITY_ALLOWED;
  const stateTintAllowed = options.stateTintAllowed ?? STATE_TINT_ALLOWED;
  const used = options.used ?? new Set();
  const findings = [];
  const root = postcss.parse(css);

  const report = (node, kind, selector, detail) =>
    findings.push({
      file,
      line: node.source?.start?.line ?? null,
      kind,
      selector,
      detail,
    });

  root.walkDecls((decl) => {
    if (OPACITY_FALLBACK.test(decl.value)) {
      const selector =
        decl.parent?.type === 'rule' ? normalise(decl.parent.selector) : '';
      report(
        decl,
        'opacity-fallback',
        selector,
        `${decl.prop}: ${decl.value} — the token always resolves; drop the fallback`,
      );
    }
  });

  root.walkRules((rule) => {
    if (inKeyframes(rule)) return;
    const selectors = rule.selectors.map(normalise);
    const opacities = rule.nodes.filter(
      (node) => node.type === 'decl' && node.prop === 'opacity',
    );
    const customOpacities = rule.nodes.filter(
      (node) =>
        node.type === 'decl' &&
        OPACITY_CUSTOM_PROPERTY.test(node.prop) &&
        !isHideOrReset(node.value),
    );

    for (const selector of selectors) {
      if (customOpacities.length && isDisabledSelector(selector)) {
        for (const decl of customOpacities) {
          report(
            decl,
            'opacity-custom-property',
            selector,
            `${decl.prop}: ${decl.value.trim()} — an opacity routed through a custom property is still a disabled dim; declare --mlv-background-disabled / --mlv-text-disabled instead (SF-R4)`,
          );
        }
      }

      if (STATE_TINT.test(selector)) {
        const entry = stateTintAllowed.find(
          (candidate) =>
            candidate.file === file && candidate.selector === selector,
        );
        if (entry) used.add(entry);
        else {
          report(
            rule,
            'state-tint',
            selector,
            'success / warning / info declare nothing on a control — only error tints (SF-R6)',
          );
        }
      }

      if (!opacities.length || !isDisabledSelector(selector)) continue;
      for (const decl of opacities) {
        const value = decl.value.trim();
        if (isHideOrReset(value)) continue;
        const entry = opacityAllowed.find(
          (candidate) =>
            candidate.file === file && candidate.selector === selector,
        );
        if (!entry) {
          report(
            decl,
            'opacity-under-disabled',
            selector,
            `opacity: ${value} — declare --mlv-background-disabled / --mlv-text-disabled instead (SF-R4)`,
          );
          continue;
        }
        used.add(entry);
        if (value !== DISABLED_OPACITY) {
          report(
            decl,
            'literal-opacity',
            selector,
            `opacity: ${value} — an allowed disabled opacity is exactly ${DISABLED_OPACITY}`,
          );
        }
      }
    }
  });

  return findings;
}

// ─── Workspace walk ──────────────────────────────────────────────────────────

/** Every component stylesheet under `libs/`, workspace-relative, `/`-separated. */
export function collectComponentSheets(workspaceRoot) {
  const found = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (IGNORED_DIRECTORIES.has(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(scss|css)$/.test(entry.name)) {
        const rel = relative(workspaceRoot, path).split(sep).join('/');
        if (!rel.includes('/src/')) continue;
        if (NOT_A_COMPONENT_SHEET.test(rel) || EMITS_NOTHING.test(rel))
          continue;
        found.push(rel);
      }
    }
  };
  walk(join(workspaceRoot, 'libs'));
  return found.sort();
}

/**
 * Runs the check over the workspace.
 *
 * @param {string} workspaceRoot
 * @param {{ opacityAllowed?: typeof OPACITY_ALLOWED, stateTintAllowed?: typeof STATE_TINT_ALLOWED }} [options]
 */
export function checkWorkspace(workspaceRoot, options = {}) {
  const opacityAllowed = options.opacityAllowed ?? OPACITY_ALLOWED;
  const stateTintAllowed = options.stateTintAllowed ?? STATE_TINT_ALLOWED;
  const used = new Set();
  const findings = [];
  const sheets = collectComponentSheets(workspaceRoot);

  if (!sheets.length) {
    findings.push({
      file: 'libs',
      line: null,
      kind: 'no-sources',
      selector: '',
      detail:
        'no component stylesheet found — the walk saw nothing, so a clean result would be vacuous',
    });
  }

  for (const file of sheets) {
    const path = join(workspaceRoot, file);
    let css;
    try {
      css = file.endsWith('.scss')
        ? sass.compile(path, {
            style: 'expanded',
            loadPaths: [join(workspaceRoot, 'node_modules')],
          }).css
        : readFileSync(path, 'utf8');
    } catch (error) {
      findings.push({
        file,
        line: null,
        kind: 'compile-error',
        selector: '',
        detail: String(error?.message ?? error).split('\n')[0],
      });
      continue;
    }
    findings.push(
      ...analyseCss(css, file, { opacityAllowed, stateTintAllowed, used }),
    );
  }

  for (const entry of [...opacityAllowed, ...stateTintAllowed]) {
    if (!used.has(entry)) {
      findings.push({
        file: entry.file,
        line: null,
        kind: 'stale-allow',
        selector: entry.selector,
        detail: 'allow-list entry matched nothing — delete it',
      });
    }
  }

  return { scanned: sheets.length, findings };
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

function main() {
  const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const asJson = process.argv.includes('--json');
  const quiet = process.argv.includes('--quiet');
  const { scanned, findings } = checkWorkspace(workspaceRoot);

  if (asJson) {
    console.log(JSON.stringify({ scanned, findings }, null, 2));
    process.exit(findings.length ? 1 : 0);
  }

  if (!findings.length) {
    if (!quiet) {
      console.log(
        `✅  ${scanned} component stylesheets scanned — disabled states declare their surface (SF-R4) and only error tints a control (SF-R6).`,
      );
    }
    process.exit(0);
  }

  console.error(
    `\n❌  ${findings.length} disabled-surface / state-tint finding(s).`,
  );
  console.error(
    '   See .claude/rules/bem-scss.md, "Disabled is a declared surface".\n',
  );
  for (const finding of findings) {
    const where = finding.line
      ? `${finding.file} (compiled line ${finding.line})`
      : finding.file;
    console.error(`  [${finding.kind}] ${where}`);
    if (finding.selector) console.error(`      ${finding.selector}`);
    console.error(`      ↳ ${finding.detail}`);
  }
  console.error('');
  process.exit(1);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main();
}
