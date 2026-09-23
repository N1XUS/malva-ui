/**
 * Component tone contrast (#302).
 *
 * `theme-contrast.spec.mjs` proves the semantic token pairs clear AA. This spec
 * proves the components actually *paint* those pairs: it compiles each
 * component stylesheet, reads the colours its tone modifiers resolve to, and
 * scores them against `theme.scss` in light, dark and high contrast.
 *
 * A tone map that bypasses the semantic tokens — a raw `--mlv-palette-*` step,
 * or a component-level `color-mix()` derived from the light value — is exactly
 * how badge/chip `success`/`info`, `button--variant-info` and the loader and
 * progress fills fell below AA while every token pair in `theme.scss` looked
 * fine, and how the high-contrast theme's own fills never reached them. So the
 * maps are also asserted to read semantic tokens only.
 *
 * The stylesheets are walked as a PostCSS AST; PostCSS parses `@layer`, so the
 * layer wrapper needs no stripping here (that is only a jsdom concern).
 * Colour is never density-dependent in these components — density modifiers
 * change size and padding only — and no pair relies on the large-text
 * exemption, so one score per tone and theme covers every density.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import postcss from 'postcss';
import * as sass from 'sass';

import {
  contrastRatio,
  loadRegions,
  loadScssVariables,
  resolveColor,
} from './theme-contrast.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = join(HERE, '../../../..');
const SOURCE = readFileSync(join(HERE, 'theme.scss'), 'utf8');
const ctx = {
  regions: loadRegions(SOURCE),
  scssVars: loadScssVariables(SOURCE),
};

/** WCAG 2.1 AA floor for text (1.4.3). */
const AA_TEXT = 4.5;
/** WCAG 2.1 AA floor for non-text marks — icons, dots, fills, focus rings (1.4.11). */
const AA_NON_TEXT = 3;

/**
 * Themes every text pair is scored in. High contrast is included because the
 * whole point of routing tones through the semantic tokens is that the
 * high-contrast theme's own fills then reach the component.
 */
const TEXT_THEMES = ['light', 'dark', 'highContrast'];

// ─── stylesheet access ───────────────────────────────────────────────────────

/** Compiles (or reads) a component stylesheet into a PostCSS root. */
const load = (rel) => {
  const file = join(WORKSPACE, rel);
  const css = rel.endsWith('.css')
    ? readFileSync(file, 'utf8')
    : sass.compile(file, {
        style: 'expanded',
        loadPaths: [join(WORKSPACE, 'node_modules')],
      }).css;
  return postcss.parse(css, { from: file });
};

/**
 * Direct declarations of every rule whose selector list contains `selector`
 * verbatim, later rules winning. Rules inside `@media` are skipped: none of the
 * colours asserted here are media-dependent, and the reduced-motion blocks
 * would otherwise shadow nothing but add noise.
 */
const decls = (root, selector) => {
  const out = new Map();
  root.walkRules((rule) => {
    if (rule.parent?.type === 'atrule' && rule.parent.name === 'media') return;
    if (!rule.selectors.map((s) => s.trim()).includes(selector)) return;
    rule.each((node) => {
      if (node.type === 'decl') out.set(node.prop, node.value);
    });
  });
  return out;
};

/** Custom properties of several rules, merged in cascade order. */
const scopeOf = (root, ...selectors) => {
  const out = new Map();
  for (const selector of selectors)
    for (const [prop, value] of decls(root, selector))
      if (prop.startsWith('--')) out.set(prop, value);
  return out;
};

/** @private Index of the first top-level comma in `input`, or -1. */
const topLevelComma = (input) => {
  let depth = 0;
  for (let i = 0; i < input.length; i++) {
    if (input[i] === '(') depth++;
    else if (input[i] === ')') depth--;
    else if (input[i] === ',' && depth === 0) return i;
  }
  return -1;
};

/**
 * Replaces every `var(--x)` the component scope declares with its value, until
 * only theme tokens are left for `resolveColor`.
 */
const substitute = (value, scope, depth = 0) => {
  if (depth > 16)
    throw new Error(`component custom-property cycle in "${value}"`);
  let out = '';
  for (let i = 0; i < value.length; ) {
    if (!value.startsWith('var(', i)) {
      out += value[i++];
      continue;
    }
    let level = 0;
    let j = i + 3;
    for (; j < value.length; j++) {
      if (value[j] === '(') level++;
      else if (value[j] === ')' && --level === 0) break;
    }
    const inner = value.slice(i + 4, j);
    const comma = topLevelComma(inner);
    const name = (comma < 0 ? inner : inner.slice(0, comma)).trim();
    out += scope.has(name)
      ? substitute(scope.get(name), scope, depth + 1)
      : value.slice(i, j + 1);
    i = j + 1;
  }
  return out;
};

/** Resolves a component declaration value to `[r, g, b]` in `theme`. */
const colour = (value, scope, theme) => {
  if (value === undefined) throw new Error('missing colour declaration');
  return resolveColor(substitute(value, scope), theme, ctx);
};

/** Composites `fg` at `alpha` over `bg`. */
const over = (fg, bg, alpha) =>
  fg.map((c, i) => c * alpha + bg[i] * (1 - alpha));

/** `(fg over bg)` contrast, `alpha` defaulting to an opaque foreground. */
const score = (fg, bg, alpha = 1) =>
  contrastRatio(alpha === 1 ? fg : over(fg, bg, alpha), bg);

/**
 * Asserts every `[label, ratio]` clears `floor`, reporting all failures at
 * once rather than the first.
 */
const expectAll = (scored, floor) => {
  const failing = scored.filter(([, r]) => r < floor);
  assert.deepEqual(
    failing.map(([label, r]) => `${label} = ${r}`),
    [],
    `below ${floor}:1`,
  );
};

/**
 * Asserts no value in any `[label, scope]` reads a raw palette step, reporting
 * every offending tone at once rather than stopping at the first.
 */
const expectSemanticOnly = (scopes) => {
  const raw = [];
  for (const [label, scope] of scopes)
    for (const [p, v] of scope)
      if (v.includes('--mlv-palette-')) raw.push(`${label} ${p}: ${v}`);
  assert.deepEqual(
    raw,
    [],
    'a tone map must read the semantic --mlv-background-* / --mlv-text-* tokens, never --mlv-palette-*',
  );
};

const TONES = [
  'default',
  'primary',
  'secondary',
  'accent',
  'success',
  'info',
  'warning',
  'danger',
];
const PAGE_SURFACES = [
  '--mlv-background-base',
  '--mlv-background-subtle',
  '--mlv-background-raised',
];
const token = (name, theme) => resolveColor(`var(${name})`, theme, ctx);

// ─── badge + chip ────────────────────────────────────────────────────────────

for (const [block, file] of [
  ['mlv-badge', 'libs/core/badge/src/lib/badge/badge.scss'],
  ['mlv-chip', 'libs/core/chip/src/lib/chip/chip.scss'],
]) {
  const root = load(file);
  const painted = decls(root, `.${block}`);

  test(`${block}: every solid tone reads semantic tokens only`, () => {
    expectSemanticOnly(
      TONES.map((tone) => [
        `.${block}--tone-${tone}`,
        scopeOf(root, `.${block}--tone-${tone}`),
      ]),
    );
  });

  for (const theme of TEXT_THEMES) {
    test(`${theme}: ${block} solid tone labels clear AA`, () => {
      expectAll(
        TONES.map((tone) => {
          const scope = scopeOf(root, `.${block}`, `.${block}--tone-${tone}`);
          const bg = colour(painted.get('background-color'), scope, theme);
          return [tone, score(colour(painted.get('color'), scope, theme), bg)];
        }),
        AA_TEXT,
      );
    });
  }

  if (block === 'mlv-chip') {
    const close = decls(root, '.mlv-chip__close');
    for (const theme of TEXT_THEMES) {
      test(`${theme}: the chip close glyph clears the 3:1 non-text floor on every solid tone`, () => {
        assert.equal(close.get('color'), 'inherit');
        const alpha = Number(close.get('opacity') ?? 1);
        expectAll(
          TONES.map((tone) => {
            const scope = scopeOf(root, `.${block}`, `.${block}--tone-${tone}`);
            const bg = colour(painted.get('background-color'), scope, theme);
            return [
              tone,
              score(colour(painted.get('color'), scope, theme), bg, alpha),
            ];
          }),
          AA_NON_TEXT,
        );
      });
    }
  }
}

// ─── button ──────────────────────────────────────────────────────────────────

{
  const root = load('libs/core/button/src/lib/button/button.scss');
  /**
   * Filled variants are the ones whose modifier paints an opaque
   * `--mlv-btn-bg`; `outlined` / `transparent` set it to `transparent` and carry
   * their label on the page surface instead.
   */
  const filled = [];
  root.walkRules((rule) => {
    for (const s of rule.selectors) {
      const m = s.trim().match(/^\.mlv-button--variant-([\w-]+)$/);
      const bg = rule.nodes?.find(
        (n) => n.type === 'decl' && n.prop === '--mlv-btn-bg',
      );
      if (
        m &&
        bg &&
        bg.value.trim() !== 'transparent' &&
        !filled.includes(m[1])
      )
        filled.push(m[1]);
    }
  });

  test('button: the filled variants are the ones this spec expects', () => {
    assert.deepEqual([...filled].sort(), [
      'accent',
      'elevated',
      'error',
      'info',
      'primary',
      'secondary',
      'warning',
    ]);
  });

  test('button: filled variant fills read semantic tokens, with no component-derived color-mix()', () => {
    const scopes = filled.map((v) => [
      `.mlv-button--variant-${v}`,
      scopeOf(root, `.mlv-button--variant-${v}`),
    ]);
    expectSemanticOnly(scopes);
    const mixed = [];
    for (const [label, scope] of scopes)
      for (const [p, val] of scope)
        if (p.startsWith('--mlv-btn-bg') && val.includes('color-mix('))
          mixed.push(`${label} ${p}: ${val}`);
    assert.deepEqual(
      mixed,
      [],
      'a hover/active fill derived in the component is frozen to the light value and bypasses the high-contrast theme',
    );
  });

  for (const theme of TEXT_THEMES) {
    test(`${theme}: every filled button label clears AA at rest, hover and active`, () => {
      const scored = [];
      for (const v of filled) {
        const scope = scopeOf(root, `.mlv-button--variant-${v}`);
        const fg = colour('var(--mlv-btn-text-color)', scope, theme);
        for (const state of ['', '-hover', '-active'])
          scored.push([
            `${v}${state || ' rest'}`,
            score(fg, colour(`var(--mlv-btn-bg${state})`, scope, theme)),
          ]);
      }
      expectAll(scored, AA_TEXT);
    });

    test(`${theme}: every filled button focus ring clears 3:1 on the page surfaces`, () => {
      const scored = [];
      for (const v of filled) {
        const scope = scopeOf(root, `.mlv-button--variant-${v}`);
        const ring = colour(
          decls(root, `.mlv-button--variant-${v}:focus-visible`).get(
            'outline-color',
          ),
          scope,
          theme,
        );
        for (const s of PAGE_SURFACES)
          scored.push([`${v} vs ${s}`, score(ring, token(s, theme))]);
      }
      expectAll(scored, AA_NON_TEXT);
    });
  }

  test('button: the accent ring is the shared focus colour (Form A)', () => {
    assert.equal(
      decls(root, '.mlv-button--variant-accent:focus-visible').get(
        'outline-color',
      ),
      'var(--mlv-border-focus)',
    );
  });
}

// ─── loader + progress ───────────────────────────────────────────────────────

/*
 * Scored in light and dark only. The high-contrast track (`--mlv-border-subtle`
 * #999999) is a pre-existing gap owned by the theme-scope batch (#303): even the
 * high-contrast theme's own fills (#006600, #804000, #cc0000) sit under 3:1 on it.
 */
for (const [block, colourVar] of [
  ['mlv-loader', '--mlv-l-color'],
  ['mlv-progress', '--mlv-p-color'],
]) {
  const root = load(
    `libs/core/${block.slice(4)}/src/lib/${block.slice(4)}/${block.slice(4)}.scss`,
  );
  const tones = ['default', 'success', 'info', 'warning', 'danger'];
  const track = decls(root, `.${block}--bar .${block}__track`).get(
    'background',
  );

  test(`${block}: every tone fill reads semantic tokens only`, () => {
    expectSemanticOnly(
      tones.map((tone) => [
        `.${block}--${tone}`,
        scopeOf(root, `.${block}--${tone}`),
      ]),
    );
  });

  for (const theme of ['light', 'dark']) {
    test(`${theme}: every ${block} tone fill clears 3:1 against its track`, () => {
      expectAll(
        tones.map((tone) => {
          const scope = scopeOf(root, `.${block}`, `.${block}--${tone}`);
          return [
            tone,
            score(
              colour(`var(${colourVar})`, scope, theme),
              colour(track, scope, theme),
            ),
          ];
        }),
        AA_NON_TEXT,
      );
    });
  }
}

// ─── status indicator ────────────────────────────────────────────────────────

{
  const root = load(
    'libs/core/status-indicator/src/lib/status-indicator/status-indicator.scss',
  );
  test('mlv-status-indicator: every tone reads semantic tokens only', () => {
    expectSemanticOnly(
      TONES.map((tone) => [
        `.mlv-status-indicator--tone-${tone}`,
        scopeOf(root, `.mlv-status-indicator--tone-${tone}`),
      ]),
    );
  });
  for (const theme of TEXT_THEMES) {
    test(`${theme}: every status dot clears 3:1 on the page surfaces`, () => {
      const scored = [];
      for (const tone of TONES) {
        const scope = scopeOf(
          root,
          '.mlv-status-indicator',
          `.mlv-status-indicator--tone-${tone}`,
        );
        const dot = colour(
          decls(root, '.mlv-status-indicator').get('background-color'),
          scope,
          theme,
        );
        for (const s of PAGE_SURFACES)
          scored.push([`${tone} vs ${s}`, score(dot, token(s, theme))]);
      }
      expectAll(scored, AA_NON_TEXT);
    });
  }
}

// ─── timeline ────────────────────────────────────────────────────────────────

{
  const root = load('libs/core/timeline/src/lib/timeline/timeline-item.scss');
  const tones = ['default', 'success', 'warning', 'danger', 'info'];
  const node = decls(root, '.mlv-timeline-item__node-circle');
  for (const theme of TEXT_THEMES) {
    test(`${theme}: every timeline node icon clears 3:1 on its node`, () => {
      expectAll(
        tones.map((tone) => {
          const scope = scopeOf(
            root,
            '.mlv-timeline-item',
            `.mlv-timeline-item--${tone}`,
          );
          return [
            tone,
            score(
              colour(node.get('color'), scope, theme),
              colour(node.get('background-color'), scope, theme),
            ),
          ];
        }),
        AA_NON_TEXT,
      );
    });
  }
}

// ─── tree ────────────────────────────────────────────────────────────────────

/*
 * `mlv-tree`'s selected-row rule painted `--mlv-text-action` on
 * `--mlv-background-accent-2`, and this change darkens light accent-2 (2.40 →
 * 1.33:1 at rest, 1.02:1 on hover). It must read the selected-state pair
 * (SF-R1) instead. The rule matches no element today — the template stamps
 * `--selected` on `.mlv-tree__item`, never on `.mlv-tree__item__content` — so
 * this pins the colours the rule will paint once #304 points it at the row the
 * template marks. That change renames the selector, which makes `colour()`
 * throw here: update the two selectors below with it.
 */
{
  const root = load('libs/core/tree/src/lib/tree/tree.scss');
  const selected =
    '.mlv-tree__item__content--selected:not(.mlv-tree__item__content--disabled)';
  const rest = decls(root, selected);
  const hover = decls(root, `${selected}:hover`);
  for (const theme of TEXT_THEMES) {
    test(`${theme}: the tree's selected row label clears AA at rest and on hover`, () => {
      const scope = new Map();
      const fg = colour(rest.get('color'), scope, theme);
      expectAll(
        [
          [
            'rest',
            score(fg, colour(rest.get('background-color'), scope, theme)),
          ],
          [
            'hover',
            score(fg, colour(hover.get('background-color'), scope, theme)),
          ],
        ],
        AA_TEXT,
      );
    });
  }
}

// ─── avatar ──────────────────────────────────────────────────────────────────

/*
 * The un-tinted avatar. A `[color]` tint is bound inline by `MlvAvatar` with a
 * fixed dark foreground; that path and the pipe's whole palette are covered by
 * `libs/core/avatar/src/lib/avatar/avatar.spec.ts`.
 */
{
  const root = load('libs/core/avatar/src/lib/avatar/avatar.scss');
  const visual = decls(root, '.mlv-avatar__visual');
  const initials = decls(root, '.mlv-avatar__initials');
  for (const theme of TEXT_THEMES) {
    test(`${theme}: default avatar initials and projected content clear AA`, () => {
      const scope = new Map();
      const bg = colour(visual.get('background-color'), scope, theme);
      const inherited = colour(visual.get('color'), scope, theme);
      const own = initials.get('color');
      const fg =
        own === undefined || own === 'inherit'
          ? inherited
          : colour(own, scope, theme);
      expectAll(
        [
          ['initials', score(fg, bg, Number(initials.get('opacity') ?? 1))],
          ['projected content', score(inherited, bg)],
        ],
        AA_TEXT,
      );
    });
  }
}

// ─── tokenizer "+N more" + tabs "More" ───────────────────────────────────────

{
  const surfaces = [...PAGE_SURFACES, '--mlv-elevation-bg-3'];
  const tokenizer = decls(
    load('libs/core/tokenizer/src/lib/tokenizer/tokenizer.css'),
    '.mlv-tokenizer__overflow',
  );
  const tabs = decls(
    load('libs/core/tabs/src/lib/tabs/tabs.scss'),
    '.mlv-tab-group__more-trigger',
  );

  test('tokenizer overflow caption and tabs "More" trigger read a semantic text token', () => {
    // The tokenizer keeps its `--mlv-tokenizer-overflow-color` hook; only the
    // fallback behind it is the theme token.
    assert.equal(
      tokenizer.get('color'),
      'var(--mlv-tokenizer-overflow-color, var(--mlv-text-secondary))',
    );
    assert.equal(tabs.get('color'), 'var(--mlv-text-secondary)');
  });

  for (const theme of TEXT_THEMES) {
    test(`${theme}: tokenizer overflow caption clears AA on the field and page surfaces`, () => {
      const fg = colour(tokenizer.get('color'), new Map(), theme);
      expectAll(
        surfaces.map((s) => [s, score(fg, token(s, theme))]),
        AA_TEXT,
      );
    });
    test(`${theme}: tabs "More" trigger clears AA on the page and boxed-track surfaces`, () => {
      const fg = colour(tabs.get('color'), new Map(), theme);
      expectAll(
        [
          ...PAGE_SURFACES,
          '--mlv-background-neutral-1',
          '--mlv-background-neutral-1-hover',
        ].map((s) => [s, score(fg, token(s, theme))]),
        AA_TEXT,
      );
    });
  }
}

// ─── no raw-colour fallbacks ─────────────────────────────────────────────────

test('no library stylesheet falls back to a raw hex colour inside var()', () => {
  const offenders = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (
        /\.(s?css)$/.test(entry.name) &&
        relative(WORKSPACE, path).split(sep).includes('src')
      ) {
        const text = readFileSync(path, 'utf8');
        const re = /var\(\s*--[\w-]+\s*,\s*#[0-9a-fA-F]{3,8}\s*\)/g;
        let m;
        while ((m = re.exec(text)))
          offenders.push(
            `${relative(WORKSPACE, path)}:${text.slice(0, m.index).split('\n').length}: ${m[0]}`,
          );
      }
    }
  };
  walk(join(WORKSPACE, 'libs'));
  // A literal fallback is frozen to one theme: `#666` read 5.7:1 in light and
  // 2.9:1 in dark for the tokenizer caption. Fall back to a token, or not at all.
  assert.deepEqual(offenders, []);
});
