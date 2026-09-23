/**
 * Components read the theme through custom properties, never by matching the
 * theme attribute (#454).
 *
 * `[mlvTheme='dark'] .mlv-x { … }` reads as "in the dark theme", and is wrong
 * in exactly the arrangements a theme scope exists for:
 *
 * - high contrast over dark — `MlvThemeService` always writes `mlvTheme` on
 *   `<html>`, so high contrast in practice is
 *   `<html mlvTheme="dark" data-theme="high-contrast">`. The descendant rule
 *   still matches and paints its dark value under high contrast's black text
 *   (the segmented / boxed-tabs selected pill measured 2.03:1);
 * - a light island inside a dark page — the page's `mlvTheme="dark"` is an
 *   ancestor of the island, so the dark rule reaches into the light surface;
 * - a component that is its own island (`<mlv-segmented mlvTheme="dark">`) —
 *   a descendant combinator needs the attribute on an *ancestor*, so the host
 *   that carries it never matches, and it renders the light treatment on dark
 *   tokens.
 *
 * A custom property declared in a theme scope has none of these failures:
 * every scope re-declares it, and the cascade model in `theme-scopes.mjs`
 * checks that each arrangement computes exactly its pure theme. So the one
 * shape a theme attribute may take anywhere under `libs/` is a **bare scope
 * rule** — the whole selector is `:root`, `:host`, `[mlvTheme=…]` or
 * `[data-theme=…]` — inside `@layer mlv.tokens`, outside any conditional group
 * rule, declaring custom properties only. That is the shape `theme.scss` and
 * `muted.scss` use, and the shape a component stylesheet uses for a
 * theme-varying value no public token carries (`action-bar.scss`). It is also
 * exactly what `loadTokenRules` can model.
 *
 * A presence test — `:not([mlvTheme])`, as `mlv-page-shell` uses to withdraw
 * its chrome remap from a slot the consumer scoped to its own theme — asks
 * whether an element opens a scope, not which theme is active, so it cannot
 * resolve differently under high contrast or nesting, and is allowed.
 *
 * **What it can and cannot see.** It reads the compiled output of every
 * stylesheet under `libs/`, so a theme selector emitted through a Sass
 * variable, a mixin or `@at-root` is caught. It does not read inline
 * `styles:` in component decorators; none in the library carries a theme
 * selector today.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import postcss from 'postcss';
import * as sass from 'sass';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = join(HERE, '../../../..');

/** An attribute selector that tests the *value* of a theme attribute. */
const THEME_VALUE = /\[\s*(?:mlvtheme|data-theme)\s*[~|^$*]?=/i;

/** A selector that is nothing but one theme scope. */
const SCOPE_SELECTOR =
  /^(?::root|:host|\[\s*(?:mlvtheme|data-theme)\s*=\s*(['"]?)[\w-]+\1\s*\])$/i;

/** Files that emit no rules of their own (the `layers.spec.mjs` exclusion). */
const EMITS_NOTHING =
  /(^_|\/_[^/]*$|\.mixins\.scss$|\/(mixins|density|breakpoints)\.scss$)/;

/** @private True when `rule` sits inside `@layer mlv.tokens`. */
const inTokenLayer = (rule) => {
  for (let p = rule.parent; p && p.type !== 'root'; p = p.parent)
    if (
      p.type === 'atrule' &&
      p.name === 'layer' &&
      p.params.trim() === 'mlv.tokens'
    )
      return true;
  return false;
};

/** @private True when a conditional group rule or `@keyframes` encloses `rule`. */
const enclosedBy = (rule, names) => {
  for (let p = rule.parent; p && p.type !== 'root'; p = p.parent)
    if (p.type === 'atrule' && names.includes(p.name)) return true;
  return false;
};

/**
 * Every selector in `css` that tests a theme attribute's value outside a bare
 * token-layer scope rule.
 *
 * @param css Compiled CSS text.
 * @returns `{ offenders, scopes }` — the offending selectors, and how many
 *          allowed scope rules were seen (a floor for the sweep below).
 */
export const themeAttributeOffenders = (css) => {
  const offenders = [];
  let scopes = 0;
  postcss.parse(css).walkRules((rule) => {
    if (enclosedBy(rule, ['keyframes'])) return;
    const selectors = rule.selectors.map((s) => s.trim());
    if (!selectors.some((s) => THEME_VALUE.test(s))) return;
    const bareScope =
      selectors.every((s) => SCOPE_SELECTOR.test(s)) &&
      inTokenLayer(rule) &&
      !enclosedBy(rule, ['media', 'supports', 'container']) &&
      rule.nodes.every(
        (n) =>
          n.type === 'comment' ||
          (n.type === 'decl' && n.prop.startsWith('--')),
      );
    if (bareScope) {
      scopes++;
      return;
    }
    for (const s of selectors) if (THEME_VALUE.test(s)) offenders.push(s);
  });
  return { offenders, scopes };
};

/** Every stylesheet under `libs/`, excluding build output and dependencies. */
const stylesheets = (directory, found = []) => {
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
};

describe('the classifier', () => {
  const offending = (css) => themeAttributeOffenders(css).offenders;

  test('flags a theme attribute matched from an ancestor or around a component', () => {
    assert.deepEqual(
      offending(
        "@layer mlv.components { [mlvTheme='dark'] .mlv-x { --mlv-x-bg: red; } }",
      ),
      ["[mlvTheme='dark'] .mlv-x"],
    );
    assert.deepEqual(
      offending(
        '@layer mlv.components { .mlv-x:is([data-theme=high-contrast] *) { color: red; } }',
      ),
      ['.mlv-x:is([data-theme=high-contrast] *)'],
    );
    assert.deepEqual(
      offending(
        "@layer mlv.components { :host-context([mlvTheme^='da']) .mlv-x { color: red; } }",
      ),
      [":host-context([mlvTheme^='da']) .mlv-x"],
    );
    // A descendant rule stays a descendant rule inside the token layer.
    assert.deepEqual(
      offending("@layer mlv.tokens { [mlvTheme='dark'] .mlv-x { --a: 1; } }"),
      ["[mlvTheme='dark'] .mlv-x"],
    );
    // A compound on the element itself is the same defect with no ancestor.
    assert.deepEqual(
      offending(
        "@layer mlv.components { .mlv-x[mlvTheme='dark'] { --a: 1; } }",
      ),
      [".mlv-x[mlvTheme='dark']"],
    );
  });

  test('flags a bare scope rule the cascade model could not read', () => {
    // Outside the token layer.
    assert.deepEqual(offending("[mlvTheme='dark'] { --a: 1; }"), [
      "[mlvTheme='dark']",
    ]);
    assert.deepEqual(
      offending("@layer mlv.components { [mlvTheme='dark'] { --a: 1; } }"),
      ["[mlvTheme='dark']"],
    );
    // A property that is not a custom property.
    assert.deepEqual(
      offending("@layer mlv.tokens { [mlvTheme='dark'] { color: red; } }"),
      ["[mlvTheme='dark']"],
    );
    // Inside a condition the model cannot evaluate.
    assert.deepEqual(
      offending(
        '@layer mlv.tokens { @media (min-width: 1px) { [mlvTheme=dark] { --a: 1; } } }',
      ),
      ['[mlvTheme=dark]'],
    );
  });

  test('allows a bare token-layer scope rule and a presence test', () => {
    assert.deepEqual(
      themeAttributeOffenders(`
        @layer mlv.tokens {
          :root, :host, [mlvTheme='light'] { --a: 1; }
          [mlvTheme="dark"] { /* dark */ --a: 2; }
          [data-theme=high-contrast] { --a: 3; }
        }
        @layer mlv.components { .mlv-x:not([mlvTheme]) .mlv-y { --b: 1; } }
      `),
      { offenders: [], scopes: 3 },
    );
  });
});

describe('no stylesheet under libs/ matches a theme attribute outside a token scope', () => {
  const sheets = stylesheets(join(WORKSPACE, 'libs')).filter(
    (path) => !EMITS_NOTHING.test(path.split(sep).join('/')),
  );

  let scopes = 0;
  const offenders = [];
  for (const path of sheets) {
    const relative = path
      .slice(WORKSPACE.length + 1)
      .split(sep)
      .join('/');
    const css = path.endsWith('.scss')
      ? sass.compile(path, {
          style: 'expanded',
          loadPaths: [join(WORKSPACE, 'node_modules')],
        }).css
      : readFileSync(path, 'utf8');
    const found = themeAttributeOffenders(css);
    scopes += found.scopes;
    offenders.push(...found.offenders.map((s) => `${relative}: ${s}`));
  }

  test('finds the stylesheets and the theme scopes to check', () => {
    // A broken walk, or a classifier that stopped recognising scope rules,
    // would make the assertion below vacuously pass.
    assert.ok(
      sheets.length > 100,
      `expected the library's stylesheets, found ${sheets.length}`,
    );
    assert.ok(
      scopes >= 6,
      `expected theme.scss / muted.scss scopes, saw ${scopes}`,
    );
  });

  test('reads the theme through custom properties only', () => {
    assert.deepEqual(
      offenders,
      [],
      'express the value as a custom property declared in every theme scope ' +
        'inside @layer mlv.tokens — an existing token, or a bare ' +
        "`:root, :host, [mlvTheme='light']` / `[mlvTheme='dark']` / " +
        "`[data-theme='high-contrast']` block — never as a rule keyed on the " +
        'theme attribute',
    );
  });
});
