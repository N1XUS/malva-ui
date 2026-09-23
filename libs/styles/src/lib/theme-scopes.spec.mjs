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
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import postcss from 'postcss';
import * as sass from 'sass';

import {
  computeChain,
  differingTokens,
  loadTokenRules,
} from './theme-scopes.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = join(HERE, '../../../..');

/** @private Compiles (or reads) a stylesheet the way every suite here does. */
const compile = (path) =>
  path.endsWith('.scss')
    ? sass.compile(path, {
        style: 'expanded',
        loadPaths: [join(WORKSPACE, 'node_modules')],
      }).css
    : readFileSync(path, 'utf8');

/** @private Workspace-relative, `/`-separated. */
const relativePath = (path) =>
  path
    .slice(WORKSPACE.length + 1)
    .split(sep)
    .join('/');

/** @private Every stylesheet under `directory`, skipping build output. */
const stylesheetsUnder = (directory, found = []) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist')
        stylesheetsUnder(path, found);
    } else if (/\.(css|scss)$/.test(entry.name)) found.push(path);
  }
  return found;
};

/**
 * Component stylesheets that open theme scopes of their own (#454): a value
 * one component varies by theme with no public token to carry it, declared in
 * the same bare `@layer mlv.tokens` scope rules `theme.scss` uses. Angular
 * injects each one beside the global sheet, in the same layer, so its scopes
 * take part in every arrangement below — including the check that high
 * contrast redeclares every name the dark theme declares. Selected by source
 * text: a scope a component sheet pulled in through a partial would be missed
 * here (`theme-attribute-selectors.spec.mjs` still refuses any other shape).
 */
const COMPONENT_SCOPE_SHEETS = stylesheetsUnder(join(WORKSPACE, 'libs')).filter(
  (path) =>
    !/^libs\/(styles|core\/styles)\//.test(relativePath(path)) &&
    readFileSync(path, 'utf8').includes('mlv.tokens'),
);

/**
 * The published global stylesheet, as a consumer receives it, followed by the
 * component scopes Angular injects after it.
 */
const rules = [
  ...loadTokenRules(compile(join(WORKSPACE, 'libs/core/styles/malva-ui.scss'))),
  ...COMPONENT_SCOPE_SHEETS.flatMap((path) => loadTokenRules(compile(path))),
];

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

// ─── component surfaces (#454) ───────────────────────────────────────────────
//
// The comparisons above prove every *token* computes its pure theme in every
// arrangement. A component can still break that on its own by matching the
// theme attribute — `[mlvTheme='dark'] .mlv-x { … }` — instead of reading a
// token: the rule reaches into a light island on a dark page, still applies
// under high contrast on the `<html>` that carries `mlvTheme="dark"`, and never
// matches a component that is its own island. `theme-attribute-selectors.spec.mjs`
// refuses that shape statically; this section measures the surfaces that used
// it by adding each component's own rules to the chain.
//
// Component rules are matched by a deliberately small selector model: classes,
// tag names, attribute selectors, `:not()`, the descendant and child
// combinators, and the sibling combinators on an element that lists the
// siblings before it — cascading by specificity then source order inside
// `mlv.components`, which outranks every token scope. Interaction and
// form-state pseudo-classes never match (a surface is measured at rest), nor
// does a pseudo-element rule. Anything else throws when an element reaches it,
// rather than be guessed. Rules inside `@media`, `@supports` or `@container`
// are skipped: no colour measured here depends on one.

/** Pseudo-classes describing interaction or form state: never true at rest. */
const AT_REST = new Set([
  'hover',
  'focus',
  'focus-visible',
  'focus-within',
  'active',
  'visited',
  'disabled',
  'checked',
  'indeterminate',
  'invalid',
  'placeholder-shown',
]);

/** @private Index just past the `)` that closes the `(` at `open`. */
const pastParen = (text, open) => {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth === 0) return i + 1;
  }
  throw new Error(`unbalanced parentheses in "${text}"`);
};

/** @private `text` split at its top-level commas. */
const splitList = (text) => {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') depth--;
    else if (text[i] === ',' && depth === 0) {
      out.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(text.slice(start).trim());
  return out;
};

/** @private The simple selectors of one compound selector. */
const parseCompound = (text) => {
  const parts = [];
  for (let i = 0; i < text.length; ) {
    const rest = text.slice(i);
    let length;
    let m;
    if ((m = /^\*/.exec(rest))) parts.push({ kind: 'any' });
    else if ((m = /^[a-z][\w-]*/i.exec(rest)))
      parts.push({ kind: 'tag', name: m[0].toLowerCase() });
    else if ((m = /^\.([\w-]+)/.exec(rest)))
      parts.push({ kind: 'class', name: m[1] });
    else if ((m = /^#([\w-]+)/.exec(rest))) parts.push({ kind: 'id' });
    else if (
      (m = /^\[\s*([\w-]+)\s*(?:([*^$~|]?=)\s*(['"]?)([^'"\]]*)\3\s*)?\]/.exec(
        rest,
      ))
    )
      parts.push({
        kind: 'attribute',
        name: m[1].toLowerCase(),
        operator: m[2],
        value: m[4],
      });
    else if ((m = /^\[[^\]]*\]/.exec(rest)))
      parts.push({ kind: 'unsupported', text: m[0] });
    else if ((m = /^::[\w-]+/.exec(rest))) {
      length =
        rest[m[0].length] === '(' ? pastParen(rest, m[0].length) : undefined;
      parts.push({ kind: 'pseudo-element' });
    } else if ((m = /^:([\w-]+)/.exec(rest))) {
      const name = m[1].toLowerCase();
      const args =
        rest[m[0].length] === '('
          ? rest.slice(m[0].length + 1, pastParen(rest, m[0].length) - 1)
          : null;
      if (args !== null) length = pastParen(rest, m[0].length);
      if (name === 'not' && args !== null)
        parts.push({ kind: 'not', list: splitList(args).map(parseComplex) });
      else if (args === null && (name === 'root' || name === 'host'))
        parts.push({ kind: name });
      else if (args === null && AT_REST.has(name))
        parts.push({ kind: 'at-rest' });
      else
        parts.push({
          kind: 'unsupported',
          text: rest.slice(0, length ?? m[0].length),
        });
    } else throw new Error(`unparseable selector "${text}"`);
    i += length ?? m[0].length;
  }
  return parts;
};

/**
 * @private A complex selector as its compounds, left to right, each with the
 * combinator that joins it to the compound before it.
 */
const parseComplex = (selector) => {
  const compounds = [];
  let current = '';
  let pending = null;
  let depth = 0;
  let inBracket = false;
  const push = () => {
    if (!current) return;
    compounds.push({
      combinator: compounds.length ? (pending ?? ' ') : null,
      parts: parseCompound(current),
    });
    current = '';
    pending = null;
  };
  for (const ch of selector) {
    if (inBracket) {
      current += ch;
      if (ch === ']') inBracket = false;
      continue;
    }
    if (depth === 0 && /[\s>+~]/.test(ch)) {
      push();
      if (!/\s/.test(ch)) pending = ch;
      continue;
    }
    if (ch === '[') inBracket = true;
    else if (ch === '(') depth++;
    else if (ch === ')') depth--;
    current += ch;
  }
  push();
  return compounds;
};

/** @private `[a, b, c]` specificity order. */
const compareSpecificity = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** @private Specificity of one complex selector. */
const specificityOf = (complex) => {
  const sum = [0, 0, 0];
  for (const { parts } of complex)
    for (const part of parts) {
      if (part.kind === 'id') sum[0]++;
      else if (part.kind === 'tag' || part.kind === 'pseudo-element') sum[2]++;
      else if (part.kind === 'not') {
        const most = part.list
          .map(specificityOf)
          .sort(compareSpecificity)
          .at(-1);
        for (let i = 0; i < 3; i++) sum[i] += most[i];
      } else if (part.kind !== 'any') sum[1]++;
    }
  return sum;
};

/** @private An element's value for an attribute a selector names. */
const attributeOf = (el, name) =>
  ({
    mlvtheme: el.mlvTheme,
    'data-theme': el.dataTheme,
    dir: el.dir,
    class: el.classes?.join(' '),
  })[name] ?? el.attributes?.[name];

/** @private The attribute-selector operators, `[a]` being presence alone. */
const ATTRIBUTE_OPERATORS = {
  '=': (value, wanted) => value === wanted,
  '~=': (value, wanted) => value.split(/\s+/).includes(wanted),
  '|=': (value, wanted) => value === wanted || value.startsWith(`${wanted}-`),
  '^=': (value, wanted) => wanted !== '' && value.startsWith(wanted),
  '$=': (value, wanted) => wanted !== '' && value.endsWith(wanted),
  '*=': (value, wanted) => wanted !== '' && value.includes(wanted),
};

/** @private Whether one simple selector matches `el`. */
const matchesPart = (part, el) => {
  switch (part.kind) {
    case 'any':
      return true;
    case 'tag':
      return el.tag === part.name;
    case 'class':
      return (el.classes ?? []).includes(part.name);
    case 'attribute': {
      const value = attributeOf(el, part.name);
      return (
        value !== undefined &&
        (part.operator === undefined ||
          ATTRIBUTE_OPERATORS[part.operator](value, part.value))
      );
    }
    case 'root':
      return el.root === true;
    case 'host':
      return el.host === true;
    case 'not':
      return !part.list.some((complex) => matchesComplex(complex, el));
    case 'id':
    case 'at-rest':
    case 'pseudo-element':
      return false;
    default:
      throw new Error(`the surface model cannot evaluate "${part.text}"`);
  }
};

/** @private Whether `complex`, up to its compound at `index`, matches `el`. */
const matchesFrom = (complex, index, el) => {
  if (!complex[index].parts.every((part) => matchesPart(part, el)))
    return false;
  if (index === 0) return true;
  const { combinator } = complex[index];
  if (combinator === '>')
    return !!el.parent && matchesFrom(complex, index - 1, el.parent);
  if (combinator === ' ') {
    for (let a = el.parent; a; a = a.parent)
      if (matchesFrom(complex, index - 1, a)) return true;
    return false;
  }
  // `+` / `~`: only an element that lists its preceding siblings (nearest
  // first) can answer; one that does not would silently read as "no match".
  if (!el.siblingsBefore)
    throw new Error(
      `the surface model needs the siblings before ${el.classes} for "${combinator}"`,
    );
  const candidates =
    combinator === '+' ? el.siblingsBefore.slice(0, 1) : el.siblingsBefore;
  return candidates.some((sibling) =>
    matchesFrom(complex, index - 1, { ...sibling, parent: el.parent }),
  );
};

/** @private Whether a complex selector matches `el`. */
const matchesComplex = (complex, el) =>
  matchesFrom(complex, complex.length - 1, el);

/**
 * A component stylesheet's non-token rules in cascade order, shaped like
 * `loadTokenRules` output so `computeChain` can apply them. Non-custom
 * properties keep their own name; `computeChain` only ever reads a name back
 * on the element that declares it (see `paintedOn`).
 */
const loadComponentRules = (css) => {
  const entries = [];
  let order = 0;
  postcss.parse(css).walkRules((rule) => {
    for (let p = rule.parent; p && p.type !== 'root'; p = p.parent) {
      if (p.type !== 'atrule') continue;
      if (['media', 'supports', 'container', 'keyframes'].includes(p.name))
        return;
      if (p.name === 'layer' && p.params.trim() === 'mlv.tokens') return;
    }
    const declarations = rule.nodes
      .filter((n) => n.type === 'decl')
      .map((d) => {
        if (d.important)
          throw new Error(`!important would reorder "${rule.selector}"`);
        return [d.prop, d.value.replace(/\s+/g, ' ').trim()];
      });
    if (declarations.length === 0) return;
    order++;
    for (const selector of rule.selectors) {
      const complex = parseComplex(selector.trim());
      entries.push({
        complex,
        specificity: specificityOf(complex),
        order,
        declarations,
      });
    }
  });
  return entries
    .sort(
      (a, b) =>
        compareSpecificity(a.specificity, b.specificity) || a.order - b.order,
    )
    .map(({ complex, declarations }) => ({
      matches: (el) => matchesComplex(complex, el),
      declarations,
    }));
};

/**
 * The five surfaces that used to lift themselves with a
 * `[mlvTheme='dark']` descendant rule, each as the DOM path from its host to
 * the element that paints, the names read there, and what each pure theme
 * paints — written out from the palette, so a value that moved in *every*
 * arrangement at once is caught too.
 */
const SURFACES = [
  {
    name: 'mlv-segmented neutral pill and track',
    sheet: 'libs/core/segmented/src/lib/segmented/segmented.scss',
    chain: [
      {
        tag: 'mlv-segmented',
        classes: [
          'mlv-segmented',
          'mlv-segmented--tone-neutral',
          'mlv-segmented--horizontal',
        ],
      },
    ],
    pure: {
      light: {
        '--mlv-segmented-pill-bg': '#ffffff',
        '--mlv-segmented-track-bg': '#f5f5f5',
      },
      dark: {
        '--mlv-segmented-pill-bg': '#404040',
        '--mlv-segmented-track-bg': '#262626',
      },
      highContrast: {
        '--mlv-segmented-pill-bg': '#ffffff',
        '--mlv-segmented-track-bg': '#e8e8e8',
      },
    },
  },
  {
    name: 'mlv-tab-group boxed selected pill',
    sheet: 'libs/core/tabs/src/lib/tabs/tabs.scss',
    chain: [
      {
        tag: 'mlv-tab-group',
        classes: [
          'mlv-tab-group',
          'mlv-tab-group--appearance-boxed',
          'mlv-tab-group--horizontal',
        ],
      },
      { tag: 'div', classes: ['mlv-tab-group__header'] },
      { tag: 'div', classes: ['mlv-tab-group__indicator'] },
    ],
    pure: {
      light: { background: '#ffffff' },
      dark: { background: '#404040' },
      highContrast: { background: '#ffffff' },
    },
  },
  {
    name: 'mlv-switch thumb',
    sheet: 'libs/core/switch/src/lib/switch/switch.scss',
    chain: [
      { tag: 'mlv-switch', classes: ['mlv-switch'] },
      { tag: 'label', classes: ['mlv-switch__label'] },
      {
        tag: 'span',
        classes: ['mlv-switch__track', 'mlv-switch__track--default'],
        siblingsBefore: [
          {
            tag: 'input',
            classes: ['mlv-switch__native'],
            attributes: { type: 'checkbox', role: 'switch' },
          },
        ],
      },
      { tag: 'span', classes: ['mlv-switch__thumb'] },
    ],
    pure: {
      light: { 'background-color': '#ffffff' },
      dark: { 'background-color': '#fafafa' },
      highContrast: { 'background-color': '#ffffff' },
    },
  },
  {
    name: 'mlv-action-bar contrast glass',
    sheet: 'libs/core/action-bar/src/lib/action-bar/action-bar.scss',
    chain: [
      {
        tag: 'div',
        classes: ['mlv-action-bar', 'mlv-action-bar--contrast'],
        attributes: { mlvactionbar: '' },
      },
    ],
    pure: Object.fromEntries(
      [
        ['light', '#262626 62%', '18%', '22%', '12%'],
        ['dark', '#404040 68%', '20%', '45%', '30%'],
        ['highContrast', '#262626 62%', '18%', '22%', '12%'],
      ].map(([theme, fill, rim, far, near]) => [
        theme,
        {
          '--mlv-action-bar-bg': `color-mix(in srgb, ${fill}, transparent)`,
          '--mlv-action-bar-fg': '#fafafa',
          '--mlv-action-bar-border': `color-mix(in srgb, #fafafa ${rim}, transparent)`,
          '--mlv-action-bar-shadow':
            `0 1rem 2.25rem color-mix(in srgb, black ${far}, transparent), ` +
            `0 0.125rem 0.5rem color-mix(in srgb, black ${near}, transparent)`,
        },
      ]),
    ),
  },
];

/** @private `chain` with each element pointing at its parent. */
const link = (chain) => {
  const linked = [];
  for (const el of chain) linked.push({ ...el, parent: linked.at(-1) });
  return linked;
};

/**
 * What the last element of `chain` paints for each of `names`, spacing inside
 * parentheses dropped so a reflowed `color-mix()` compares equal. A name the
 * element does not declare itself reads as `'not declared'`: a non-custom
 * property must not be taken from an ancestor through `computeChain`'s
 * inheritance.
 */
const paintedOn = (surfaceRules, chain, names) => {
  const linked = link(chain);
  const target = linked.at(-1);
  const computed = computeChain(surfaceRules, linked);
  const declared = new Set(
    surfaceRules
      .filter((rule) => rule.matches(target))
      .flatMap((rule) => rule.declarations.map(([name]) => name)),
  );
  return Object.fromEntries(
    names.map((name) => [
      name,
      name.startsWith('--') || declared.has(name)
        ? computed.get(name)?.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')
        : 'not declared',
    ]),
  );
};

/**
 * Every nesting a surface must render its pure theme in: an island of that
 * theme on each other page, the component carrying the theme attribute itself
 * on each other page, and — for high contrast — the two pages that put
 * `data-theme` on an `<html>` already marked `mlvTheme`.
 */
const arrangementsOf = (theme, chain) => {
  const [host, ...rest] = chain;
  const out = [];
  for (const [pageName, page] of Object.entries(PAGE)) {
    if (pageName === theme) continue;
    out.push([
      `${theme} island on a ${pageName} page`,
      [page, ISLAND[theme], ...chain],
    ]);
    out.push([
      `the component as a ${theme} island on a ${pageName} page`,
      [page, { ...host, ...ISLAND[theme] }, ...rest],
    ]);
  }
  if (theme === 'highContrast')
    for (const page of ['light + high contrast', 'dark + high contrast'])
      out.push([`a ${page} page`, [PAGE[page], ...chain]]);
  return out;
};

describe('component surfaces paint their pure theme in every arrangement (#454)', () => {
  test('finds the component theme scopes', () => {
    // The action-bar glass keeps its own scopes; a walk that found none would
    // leave the surface below reading unset names rather than failing here.
    assert.deepEqual(COMPONENT_SCOPE_SHEETS.map(relativePath), [
      'libs/core/action-bar/src/lib/action-bar/action-bar.scss',
    ]);
  });

  for (const surface of SURFACES) {
    const surfaceRules = [
      ...rules,
      ...loadComponentRules(compile(join(WORKSPACE, surface.sheet))),
    ];
    const names = Object.keys(surface.pure.light);

    test(`${surface.name}: each pure theme paints its palette value`, () => {
      for (const [theme, expected] of Object.entries(surface.pure))
        assert.deepEqual(
          paintedOn(surfaceRules, [PAGE[theme], ...surface.chain], names),
          expected,
          theme,
        );
    });

    for (const theme of Object.keys(surface.pure)) {
      test(`${surface.name}: every ${theme} arrangement paints pure ${theme}`, () => {
        const expected = surface.pure[theme];
        const stale = [];
        for (const [arrangement, chain] of arrangementsOf(
          theme,
          surface.chain,
        )) {
          const painted = paintedOn(surfaceRules, chain, names);
          for (const name of names)
            if (painted[name] !== expected[name])
              stale.push(`${arrangement}: ${name} = ${painted[name]}`);
        }
        assert.deepEqual(
          stale,
          [],
          'read the theme through a token declared in every scope, never a rule keyed on the theme attribute',
        );
      });
    }
  }

  test('the surface model reads a descendant theme rule the way a browser does', () => {
    // The arrangements above are only as good as this: an ancestor carrying
    // the attribute matches, the element itself does not, and a rule outranks
    // every token scope whatever its specificity.
    const synthetic = [
      ...loadTokenRules(`
        @layer mlv.tokens {
          :root, [mlvTheme='light'] { --mlv-t: #111111; }
          [mlvTheme='dark'] { --mlv-t: #eeeeee; }
        }
      `),
      ...loadComponentRules(`
        @layer mlv.components {
          .mlv-x { --mlv-x-bg: var(--mlv-t); }
          [mlvTheme='dark'] .mlv-x { --mlv-x-bg: red; }
          .mlv-x:hover, .mlv-x::after { --mlv-x-bg: blue; }
          .mlv-x:not(.mlv-x--flat) > .mlv-y { background: var(--mlv-x-bg); }
        }
      `),
    ];
    const x = { classes: ['mlv-x'] };
    const read = (chain) => paintedOn(synthetic, chain, ['--mlv-x-bg']);
    assert.deepEqual(read([PAGE.light, x]), { '--mlv-x-bg': '#111111' });
    assert.deepEqual(read([PAGE.dark, x]), { '--mlv-x-bg': 'red' });
    assert.deepEqual(read([PAGE.light, ISLAND.dark, x]), {
      '--mlv-x-bg': 'red',
    });
    assert.deepEqual(read([PAGE.light, { ...x, ...ISLAND.dark }]), {
      '--mlv-x-bg': '#eeeeee',
    });
    const y = { classes: ['mlv-y'] };
    assert.deepEqual(paintedOn(synthetic, [PAGE.light, x, y], ['background']), {
      background: '#111111',
    });
    assert.deepEqual(
      paintedOn(
        synthetic,
        [PAGE.light, { classes: ['mlv-x', 'mlv-x--flat'] }, y],
        ['background'],
      ),
      { background: 'not declared' },
    );
    assert.throws(
      () =>
        paintedOn(
          loadComponentRules('.mlv-x:first-child { --mlv-x-bg: red; }'),
          [x],
          ['--mlv-x-bg'],
        ),
      /cannot evaluate ":first-child"/,
    );
    // Siblings: `+` reads the nearest one, `~` any; an element that lists
    // none cannot answer.
    const siblings = loadComponentRules(
      '.mlv-in:checked + .mlv-y, .mlv-in[type=checkbox] ~ .mlv-y { --mlv-x-bg: green; }',
    );
    const afterInput = {
      ...y,
      siblingsBefore: [
        { classes: ['mlv-other'] },
        { tag: 'input', classes: ['mlv-in'], attributes: { type: 'checkbox' } },
      ],
    };
    assert.deepEqual(paintedOn(siblings, [afterInput], ['--mlv-x-bg']), {
      '--mlv-x-bg': 'green',
    });
    assert.throws(
      () => paintedOn(siblings, [y], ['--mlv-x-bg']),
      /needs the siblings/,
    );
  });
});
