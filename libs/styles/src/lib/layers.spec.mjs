import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import postcss from 'postcss';
import * as sass from 'sass';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = join(HERE, '../../../..');

// The docs entry point resolves `@angular/cdk` the way the bundler does.
const options = {
  style: 'expanded',
  loadPaths: [join(WORKSPACE, 'node_modules')],
};

/** The published global stylesheet, in the order a consumer receives it. */
const css = sass.compile(
  join(HERE, '../../../core/styles/malva-ui.scss'),
  options,
).css;

/** The docs application composes the same partials in its own entry point. */
const docsCss = sass.compile(
  join(WORKSPACE, 'apps/docs/src/styles.scss'),
  options,
).css;

const ORDER_STATEMENT = '@layer mlv.tokens, mlv.base, mlv.components;';

/**
 * The enter/leave classes `animations.scss` emits. They are the only rules in
 * that partial the cascade can order — `@keyframes` are resolved by name.
 */
const ANIMATION_RULES = [
  '.mlv-dialog--enter',
  '.mlv-dialog--leave',
  '.mlv-popup--enter',
  '.mlv-popup--leave',
  '.mlv-drawer--enter',
  '.mlv-drawer--leave',
  '.mlv-presence--enter',
  '.mlv-presence--leave',
];

/** Layer depth at `index`, counting `@layer name {` blocks only. */
function layerDepthAt(source, index) {
  let depth = 0;
  let layerDepth = 0;
  const stack = [];

  for (let i = 0; i < index; i++) {
    if (source.startsWith('@layer', i) && source.indexOf('{', i) > -1) {
      const head = source.slice(i, source.indexOf('{', i) + 1);
      if (head.endsWith('{') && !head.includes('}')) {
        stack.push(depth + 1);
      }
    }
    if (source[i] === '{') {
      depth++;
    } else if (source[i] === '}') {
      if (stack[stack.length - 1] === depth) {
        stack.pop();
        layerDepth--;
      }
      depth--;
    }
    if (stack.length > layerDepth) {
      layerDepth = stack.length;
    }
  }

  return stack.length;
}

for (const [name, source] of [
  ['styles/malva-ui.css', css],
  ['apps/docs styles.scss', docsCss],
]) {
  describe(`cascade layers — ${name}`, () => {
    it('declares the layer order before opening any layer', () => {
      const order = source.indexOf(ORDER_STATEMENT);
      const firstBlock = source.search(/@layer\s+[\w.]+\s*\{/);

      assert.notEqual(order, -1, 'missing the layer order statement');
      assert.notEqual(firstBlock, -1, 'no layered rules were emitted');
      // A layer's position is fixed the first time it is named. An `@layer x {}`
      // block emitted ahead of the order statement would silently make `x` the
      // lowest-priority layer instead of the highest.
      assert.ok(
        order < firstBlock,
        `order statement at ${order} must precede the first layer block at ${firstBlock}`,
      );
    });

    it('leaves no library rule outside a cascade layer', () => {
      // Unlayered rules beat every layered one regardless of specificity, so a
      // rule shipped outside the layers takes the override slot that belongs to
      // the consumer.
      for (const selector of ANIMATION_RULES) {
        const at = source.indexOf(`${selector} {`);
        assert.notEqual(at, -1, `${selector} is not emitted`);
        assert.ok(
          layerDepthAt(source, at) > 0,
          `${selector} is emitted outside any @layer`,
        );
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Component stylesheets
// ---------------------------------------------------------------------------
//
// The two suites above compile the *global* stylesheet, which is the only thing
// they can see: a component stylesheet is referenced by `styleUrl` and is never
// composed into that entry point. Nothing checked component styles at all, and
// six of them shipped outside the layers — `list.css` among them, whose
// `--mlv-list-padding-block` default therefore beat every layered override a
// consumer wrote (`dropdown-panel.scss`, `menu.scss`, `breadcrumb.scss` and the
// editor's zoom panel were all silently losing to it).

/** Files that legitimately emit no rules of their own. */
const EMITS_NOTHING =
  /(^_|\.mixins\.scss$|\/(mixins|density|breakpoints)\.scss$)/;

/**
 * Stylesheets outside the component layer contract.
 *
 * - `libs/core/styles/**` is the global entry point, covered by the suites above.
 * - `libs/tailwind/theme.css` is a Tailwind v4 `@theme` adapter; Tailwind owns
 *   its own layer registration and `@theme` declares variables, not rules.
 */
const NOT_A_COMPONENT_SHEET = /libs\/(core\/styles|tailwind|styles)\//;

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

/** Selector rules in `source` that no `@layer` block encloses. */
function unlayeredSelectors(source) {
  const root = postcss.parse(source);
  const loose = [];

  root.walkRules((rule) => {
    // `@keyframes` steps are resolved by animation name, not by the cascade, so
    // a layer neither helps nor hurts them.
    for (let node = rule.parent; node; node = node.parent) {
      if (node.type === 'atrule' && node.name === 'layer') return;
      if (node.type === 'atrule' && node.name === 'keyframes') return;
    }
    loose.push(rule.selector);
  });

  return loose;
}

describe('cascade layers — component stylesheets', () => {
  const sheets = stylesheets(join(WORKSPACE, 'libs')).filter(
    (path) =>
      !NOT_A_COMPONENT_SHEET.test(path.split(sep).join('/')) &&
      !EMITS_NOTHING.test(path.split(sep).join('/')),
  );

  it('finds the component stylesheets to check', () => {
    // A broken walk would make every assertion below vacuously pass.
    assert.ok(
      sheets.length > 100,
      `expected the library's component stylesheets, found ${sheets.length}`,
    );
  });

  for (const path of sheets) {
    const relative = path
      .slice(WORKSPACE.length + 1)
      .split(sep)
      .join('/');

    it(`${relative} emits every rule inside a cascade layer`, () => {
      const source = path.endsWith('.scss')
        ? sass.compile(path, options).css
        : readFileSync(path, 'utf8');
      const loose = unlayeredSelectors(source);

      assert.deepEqual(
        loose,
        [],
        `${relative} emits ${loose.length} rule(s) outside any @layer: ${loose
          .slice(0, 3)
          .join(', ')}`,
      );
    });
  }
});

describe('direction sign token scoping', () => {
  for (const [name, source] of [
    ['styles/malva-ui.css', css],
    ['apps/docs styles.scss', docsCss],
  ]) {
    it(`${name}: --mlv-inline-direction lives on :root and the [dir] scopes, never on a theme island`, () => {
      /**
       * selector → value, for every rule declaring the sign token. Sass drops
       * the quotes from attribute selectors (`[dir=rtl]`), so keys are
       * compared unquoted.
       */
      const owners = new Map();
      postcss.parse(source).walkDecls('--mlv-inline-direction', (decl) => {
        owners.set(
          decl.parent.selector.replace(/["']/g, ''),
          decl.value.trim(),
        );
      });
      const selectors = [...owners.keys()];

      assert.ok(
        selectors.some((selector) =>
          selector
            .split(',')
            .map((part) => part.trim())
            .includes(':root'),
        ),
        `expected a :root declaration, got: ${selectors.join(' | ')}`,
      );
      assert.equal(
        owners.get('[dir=rtl]'),
        '-1',
        `selectors: ${selectors.join(' | ')}`,
      );
      assert.equal(
        owners.get('[dir=ltr]'),
        '1',
        `selectors: ${selectors.join(' | ')}`,
      );

      // A `[mlvTheme]` island re-declaring the sign would reset
      // `<html dir="rtl">` back to LTR for its whole subtree — every
      // `inline-distance()` transform inside it would stop mirroring.
      const islands = selectors.filter((selector) =>
        /mlvtheme/i.test(selector),
      );
      assert.deepEqual(
        islands,
        [],
        `theme islands must inherit the sign, not redeclare it: ${islands.join(' | ')}`,
      );
    });
  }
});
