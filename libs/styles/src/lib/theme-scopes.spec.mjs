/**
 * Theme scopes (#303).
 *
 * A theme is a scope, not a document setting: `[mlvTheme]` islands nest inside
 * pages of the other theme (a dark rail on a light page, a light showcase on a
 * dark one), and high contrast is a separate `data-theme` attribute that
 * usually lands on the same `<html>` that `MlvThemeService` has already marked
 * `mlvTheme="dark"`. Each of those has to render its theme exactly as the
 * document root would, whatever it is nested in.
 *
 * Two mechanisms broke that, and a per-theme token lookup can see neither:
 *
 * - a token one scope declares and another does not keeps the ancestor's
 *   value — the dark elevation ladder under high contrast, every muted tint in
 *   a light island inside a dark page;
 * - an alias's `var()` is substituted where the alias is *declared*, so an
 *   alias declared only on `:root` keeps the root theme's answer in every
 *   island — `--mlv-background-selected`, `--mlv-focus-ring`.
 *
 * So this spec compiles the published stylesheet and computes the custom
 * properties element by element (`theme-scopes.mjs`), then compares each
 * nested arrangement against the same theme at the root. Pure-theme contrast
 * is scored by `theme-contrast.spec.mjs` and `tone-contrast.spec.mjs`; an
 * island that computes the same values inherits that coverage.
 *
 * Arrangements are checked pairwise (page × island: 12 pairs, a page and an
 * island of the same theme being trivially equal). That is sufficient for
 * any depth: an island's values depend only on its own declarations and its
 * parent's computed values, so once every island computes its pure theme
 * whatever it sits in, the next island down sees a pure-theme parent.
 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import * as sass from 'sass';

import {
  computeChain,
  differingTokens,
  loadTokenRules,
} from './theme-scopes.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = join(HERE, '../../../..');

/** The published global stylesheet, as a consumer receives it. */
const rules = loadTokenRules(
  sass.compile(join(WORKSPACE, 'libs/core/styles/malva-ui.scss'), {
    style: 'expanded',
    loadPaths: [join(WORKSPACE, 'node_modules')],
  }).css,
);

/** The document root in each state an application can put it in. */
const PAGE = {
  light: { root: true, mlvTheme: 'light' },
  dark: { root: true, mlvTheme: 'dark' },
  highContrast: { root: true, dataTheme: 'high-contrast' },
  // `MlvThemeService` always writes `mlvTheme` on `<html>`; high contrast is
  // the consumer's `data-theme` on top of it.
  'light + high contrast': {
    root: true,
    mlvTheme: 'light',
    dataTheme: 'high-contrast',
  },
  'dark + high contrast': {
    root: true,
    mlvTheme: 'dark',
    dataTheme: 'high-contrast',
  },
};

/** A nested element opting into each theme. */
const ISLAND = {
  light: { mlvTheme: 'light' },
  dark: { mlvTheme: 'dark' },
  highContrast: { dataTheme: 'high-contrast' },
};

/** Each theme applied at the document root: what an island must reproduce. */
const PURE = Object.fromEntries(
  Object.keys(ISLAND).map((theme) => [
    theme,
    computeChain(rules, [PAGE[theme]]),
  ]),
);

// ─── the simulation ──────────────────────────────────────────────────────────

describe('theme-scopes simulation', () => {
  test('substitutes an alias where it is declared, not where it is read', () => {
    const synthetic = loadTokenRules(`
      @layer mlv.tokens {
        :root { --mlv-a: #111111; --mlv-b: var(--mlv-a); --mlv-c: var(--mlv-z, #222222); }
        [mlvTheme='dark'] { --mlv-a: #eeeeee; }
      }
    `);
    const island = computeChain(synthetic, [PAGE.light, ISLAND.dark]);
    assert.equal(island.get('--mlv-a'), '#eeeeee');
    // The browser's answer: inherited already-substituted, so still the root's.
    assert.equal(island.get('--mlv-b'), '#111111');
    assert.equal(island.get('--mlv-c'), '#222222');
    assert.equal(
      computeChain(synthetic, [PAGE.dark]).get('--mlv-b'),
      '#eeeeee',
    );
  });

  test('refuses a theme scope it cannot model', () => {
    assert.throws(
      () =>
        loadTokenRules('@layer mlv.tokens { .dark :root { --mlv-a: red; } }'),
      /unsupported selector/,
    );
    assert.throws(
      () => loadTokenRules(':root { --mlv-a: red; }'),
      /outside @layer mlv.tokens/,
    );
    assert.throws(
      () =>
        loadTokenRules(
          '@layer mlv.tokens { @media (min-width: 1px) { :root { --mlv-a: red; } } }',
        ),
      /conditional theme scope/,
    );
    assert.throws(
      () =>
        loadTokenRules(
          '@layer mlv.tokens { :root { --mlv-a: red !important; } }',
        ),
      /!important on a theme token: --mlv-a/,
    );
    assert.throws(
      () =>
        loadTokenRules(`
          @property --mlv-a { syntax: '<color>'; inherits: false; initial-value: red; }
          @layer mlv.tokens { :root { --mlv-a: blue; } }
        `),
      /registered with @property: --mlv-a/,
    );
  });

  // Cycles are found the way Chrome 153 finds them, not the way CSS Custom
  // Properties Level 1 words it (every `var()` an edge, fallbacks included).
  // Every expected value below is what Chrome 153 computes for the same
  // declarations on the same element.
  const rootOf = (declarations) =>
    computeChain(
      loadTokenRules(`@layer mlv.tokens { :root { ${declarations} } }`),
      [PAGE.light],
    );

  test('invalidates every member of a reference cycle; a reader outside it takes its fallback', () => {
    const computed = rootOf(`
      --mlv-a: var(--mlv-b) var(--mlv-c);
      --mlv-b: var(--mlv-a, red);
      --mlv-c: var(--mlv-b, blue);
      --mlv-self: var(--mlv-self, green);
      --mlv-reader: var(--mlv-a, #123456);
    `);
    // a ⇄ b is a cycle, and `red` does not rescue b: a cycle member is invalid
    // whatever its own fallback says. `self` names itself outside a fallback.
    for (const name of ['--mlv-a', '--mlv-b', '--mlv-self'])
      assert.equal(computed.get(name), undefined, name);
    // c is reached from a only after b has already failed, so it reads b as
    // invalid, takes `blue`, and is not on the cycle. (Level 1 would put it on
    // one, c → b → a → c, through b's fallback.)
    assert.equal(computed.get('--mlv-c'), 'blue');
    assert.equal(computed.get('--mlv-reader'), '#123456');
  });

  test('follows a var() inside a fallback only when the fallback is taken', () => {
    const untaken = rootOf(`
      --mlv-x: 1;
      --mlv-a: var(--mlv-x, var(--mlv-b));
      --mlv-b: var(--mlv-a);
      --mlv-self: var(--mlv-x, var(--mlv-self));
    `);
    for (const name of ['--mlv-a', '--mlv-b', '--mlv-self'])
      assert.equal(untaken.get(name), '1', name);

    const taken = rootOf(`
      --mlv-a: var(--mlv-missing, var(--mlv-b));
      --mlv-b: var(--mlv-a);
      --mlv-self: var(--mlv-missing, var(--mlv-self));
    `);
    for (const name of ['--mlv-a', '--mlv-b', '--mlv-self'])
      assert.equal(taken.get(name), undefined, name);
  });

  test('keeps substituting past a failed var(), so a later one can still close a cycle', () => {
    // a's first var() fails, and a goes on to reach b: both are on the cycle.
    // Stopping at the first failure would leave b computing `red`.
    const pastFailure = rootOf(`
      --mlv-a: var(--mlv-missing) var(--mlv-b);
      --mlv-b: var(--mlv-a, red);
    `);
    assert.equal(pastFailure.get('--mlv-a'), undefined);
    assert.equal(pastFailure.get('--mlv-b'), undefined);
  });

  test('resolves in declaration order, which decides what a cycle catches', () => {
    // Declared a, b, c: resolution starts at a and closes a ⇄ b before it
    // reaches c, so c reads b as invalid and takes `blue`. No reader or
    // self-reference here, so nothing else can start the walk at a.
    const aFirst = rootOf(`
      --mlv-a: var(--mlv-b) var(--mlv-c);
      --mlv-b: var(--mlv-a, red);
      --mlv-c: var(--mlv-b, blue);
    `);
    assert.equal(aFirst.get('--mlv-a'), undefined);
    assert.equal(aFirst.get('--mlv-b'), undefined);
    assert.equal(aFirst.get('--mlv-c'), 'blue');

    // The same declarations with c first: resolution starts at c, so c is
    // still being substituted when a's second var() reaches it, and the cycle
    // takes c too — through continued substitution, not through a fallback.
    const cFirst = rootOf(`
      --mlv-c: var(--mlv-b, blue);
      --mlv-a: var(--mlv-b) var(--mlv-c);
      --mlv-b: var(--mlv-a, red);
    `);
    for (const name of ['--mlv-a', '--mlv-b', '--mlv-c'])
      assert.equal(cFirst.get(name), undefined, name);
  });

  test('a var() naming an unset property with no fallback is guaranteed-invalid', () => {
    const synthetic = loadTokenRules(`
      @layer mlv.tokens {
        :root { --mlv-x: #111111; }
        [mlvTheme='dark'] { --mlv-x: var(--mlv-missing); --mlv-y: var(--mlv-x, #222222); }
      }
    `);
    const island = computeChain(synthetic, [PAGE.light, ISLAND.dark]);
    // Not inherited from the parent, and a reader takes its own fallback.
    assert.equal(island.get('--mlv-x'), undefined);
    assert.equal(island.get('--mlv-y'), '#222222');
  });

  test('reads the whole token layer of the published stylesheet', () => {
    // A floor, so a compile that silently dropped the theme would fail here
    // rather than make every comparison below vacuously equal.
    assert.ok(
      PURE.light.size > 400,
      `light computed ${PURE.light.size} tokens`,
    );
    assert.equal(PURE.dark.get('--mlv-background-base'), '#171717');
    assert.equal(PURE.highContrast.get('--mlv-background-base'), '#ffffff');
  });

  test('no token computes to the guaranteed-invalid value in a pure theme', () => {
    // An invalid token compares equal to itself, so the comparisons below
    // could not see one that is invalid in the pure theme as well.
    for (const [theme, computed] of Object.entries(PURE))
      assert.deepEqual(
        [...computed].filter(([, value]) => value === undefined),
        [],
        theme,
      );
  });
});

// ─── high contrast wins over the theme on the same element ───────────────────

describe('high contrast on the element that already carries mlvTheme', () => {
  test('declares every token the dark theme declares', () => {
    // The comparisons below read values, so a dark-only token whose value
    // happens to equal the high-contrast one would pass them. Declaring the
    // same names keeps a later change to either value from going stale.
    const namesFor = (element) =>
      new Set(
        rules
          .filter((rule) => rule.matches(element))
          .flatMap((rule) => rule.declarations.map(([name]) => name)),
      );
    const highContrast = namesFor(ISLAND.highContrast);
    assert.deepEqual(
      [...namesFor(ISLAND.dark)].filter((name) => !highContrast.has(name)),
      [],
    );
  });

  for (const page of ['light + high contrast', 'dark + high contrast']) {
    test(`${page} computes exactly the high-contrast theme`, () => {
      assert.deepEqual(
        differingTokens(computeChain(rules, [PAGE[page]]), PURE.highContrast),
        [],
        'high contrast must redeclare every token the other theme declares',
      );
    });
  }
});

// ─── islands ─────────────────────────────────────────────────────────────────

describe('a theme island renders its theme whatever page it is nested in', () => {
  for (const [pageName, page] of Object.entries(PAGE)) {
    for (const [theme, island] of Object.entries(ISLAND)) {
      if (pageName === theme) continue;
      test(`${theme} island inside a ${pageName} page`, () => {
        assert.deepEqual(
          differingTokens(computeChain(rules, [page, island]), PURE[theme]),
          [],
          `stale inside a ${theme} island — redeclare these in that scope`,
        );
      });
    }
  }

  test('three levels deep: light inside high contrast inside dark', () => {
    assert.deepEqual(
      differingTokens(
        computeChain(rules, [PAGE.dark, ISLAND.highContrast, ISLAND.light]),
        PURE.light,
      ),
      [],
    );
  });
});

// ─── shadow roots ────────────────────────────────────────────────────────────

test('a shadow root that adopts the stylesheet gets every light token on :host', () => {
  // `--mlv-inline-direction` is declared on `:root` alone on purpose: a host
  // re-declaring it would reset an inherited `dir="rtl"` sign to LTR for its
  // whole subtree (see theme.scss § 11).
  assert.deepEqual(
    differingTokens(computeChain(rules, [{ host: true }]), PURE.light),
    ['--mlv-inline-direction'],
  );
});
