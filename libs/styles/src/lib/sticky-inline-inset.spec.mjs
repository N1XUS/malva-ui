import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import postcss from 'postcss';

/**
 * Safari 26 does not position a `position: sticky` element correctly in RTL
 * when the inline inset is written logically; the physical property does work,
 * and Chromium fixed the equivalent about a year earlier.
 *
 * That collides head-on with `.claude/rules/rtl.md`, which mandates the logical
 * form on the inline axis. The exception is documented there — a sticky
 * element's inline inset stays physical, with the usual `// physical: <reason>`
 * comment naming this bug — and this is the regression guard, so the collision
 * is found here rather than in the field.
 *
 * **What it can and cannot see.** It matches a `position: sticky` declaration
 * against a logical inline inset **in the same rule**. Two rules targeting the
 * same element through different selectors are beyond a static sweep; today the
 * library has no such pair, and this exists to stop the obvious form from
 * landing, not to prove the property globally.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = join(HERE, '../../../..');

/** Logical inline insets. `inset` and `inset-block*` are unaffected. */
const INLINE_INSET = /^inset-inline(-start|-end)?$/;

/** Every stylesheet under `libs/`, excluding build output and dependencies. */
function stylesheets(directory, found = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      stylesheets(path, found);
      continue;
    }
    if (/\.(css|scss)$/.test(entry.name)) found.push(path);
  }
  return found;
}

/**
 * Rules in `source` that declare `position: sticky` *and* a logical inline
 * inset. Returns the offending selectors.
 */
function stickyWithLogicalInlineInset(source) {
  const offenders = [];

  postcss.parse(source).walkRules((rule) => {
    let sticky = false;
    let inlineInset = null;

    rule.walkDecls((declaration) => {
      const property = declaration.prop.toLowerCase();
      if (property === 'position' && /\bsticky\b/.test(declaration.value)) {
        sticky = true;
      }
      if (INLINE_INSET.test(property)) inlineInset = property;
    });

    if (sticky && inlineInset) {
      offenders.push(`${rule.selector} { ${inlineInset} }`);
    }
  });

  return offenders;
}

describe('sticky elements keep their inline inset physical', () => {
  // Sass syntax that PostCSS's CSS parser rejects outright — the sweep reads
  // sources, not compiled output, because that is where an author writes.
  const sheets = stylesheets(join(WORKSPACE, 'libs'));

  it('finds the stylesheets to check', () => {
    // A broken walk would make the assertion below vacuously pass.
    assert.ok(
      sheets.length > 100,
      `expected the library's stylesheets, found ${sheets.length}`,
    );
  });

  it('never pairs position: sticky with a logical inline inset', () => {
    const offenders = [];

    for (const path of sheets) {
      const relative = path
        .slice(WORKSPACE.length + 1)
        .split(sep)
        .join('/');
      let found;
      try {
        found = stickyWithLogicalInlineInset(readFileSync(path, 'utf8'));
      } catch {
        // A partial PostCSS cannot parse as CSS. Sass-only syntax is rare in
        // rule bodies and never carries a sticky inset; skipping is safer than
        // failing on syntax this guard has no opinion about.
        continue;
      }
      offenders.push(...found.map((entry) => `${relative}: ${entry}`));
    }

    assert.deepEqual(
      offenders,
      [],
      'Safari 26 mispositions a sticky element with a logical inline inset in ' +
        'RTL. Use the physical property with a `// physical:` comment naming ' +
        'this bug — see `.claude/rules/rtl.md`.',
    );
  });
});
