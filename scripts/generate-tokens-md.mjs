#!/usr/bin/env node
/**
 * Malva UI — token reference generator
 *
 * Compiles the `libs/styles` SCSS entry points with Dart Sass and writes
 * `libs/styles/tokens.md`: the complete, generated-from-source list of every
 * public `--mlv-*` custom property the design system declares, with its light,
 * dark and high-contrast values.
 *
 * The reference is generated rather than hand-written because hand-written
 * token lists drift, and a drifted token list is worse than none: consumers
 * invent plausible names (`--mlv-color-surface`, `--mlv-radius-2`), ship the
 * `var()` fallback, and never see an error.
 *
 * Usage:
 *   node scripts/generate-tokens-md.mjs [--check]
 *   yarn nx run styles:generate-tokens
 *
 * Flags:
 *   --check   Do not write; exit non-zero when tokens.md is out of date.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';
import * as prettier from 'prettier';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stylesLib = resolve(workspaceRoot, 'libs/styles/src/lib');
const outputPath = resolve(workspaceRoot, 'libs/styles/tokens.md');

const checkOnly = process.argv.includes('--check');

// ─── Theme selectors ─────────────────────────────────────────────────────────

/**
 * Maps a compiled CSS selector onto the theme column it feeds. Order matters:
 * the first entry whose `test` matches wins.
 */
const THEMES = [
  { id: 'dark', label: 'Dark', test: (s) => /\[mlvTheme=["']?dark/.test(s) },
  {
    id: 'highContrast',
    label: 'High contrast',
    test: (s) => /\[data-theme=["']?high-contrast/.test(s),
  },
  // Regression guard: every stylesheet now keys dark off `[mlvTheme='dark']`, but
  // a stray `[data-theme='dark']` would otherwise match no theme and drop its
  // tokens from the document silently. Match it, and warn about it below.
  { id: 'dark', label: 'Dark', test: (s) => /\[data-theme=["']?dark/.test(s) },
  {
    id: 'light',
    label: 'Light',
    test: (s) => /(^|,)\s*(:root|:host|\[mlvTheme=["']?light)/.test(s),
  },
];

// ─── Categories ──────────────────────────────────────────────────────────────

/**
 * Presentation order and grouping of the generated tables. Every declared token
 * must land in exactly one bucket — the generator fails loudly when one does
 * not, so a new token family can never be silently dropped from the reference.
 */
const CATEGORIES = [
  {
    id: 'palette',
    title: 'Color palettes',
    blurb:
      'Raw ramps. Prefer a semantic token below; reach for a palette stop only when no semantic token expresses the intent.',
    prefixes: ['--mlv-palette-'],
  },
  {
    id: 'background',
    title: 'Backgrounds',
    blurb:
      'Surface and fill colors. `-pale` variants are tinted backgrounds for inline status surfaces; the unsuffixed `-1` variants are solid fills that pair with the `--mlv-text-on-*` colors.',
    prefixes: ['--mlv-background-'],
  },
  {
    id: 'elevation',
    title: 'Elevation backgrounds',
    blurb:
      'Stepped surface colors. Identical in light mode; in dark mode each step is lighter than the last.',
    prefixes: ['--mlv-elevation-'],
  },
  {
    id: 'text',
    title: 'Text colors',
    blurb:
      'Never use `--mlv-text-tertiary`, `--mlv-text-disabled` or `--mlv-text-placeholder` for meaningful content — they do not meet WCAG AA against body backgrounds.',
    prefixes: ['--mlv-text-'],
  },
  { id: 'border', title: 'Border colors', prefixes: ['--mlv-border-'] },
  {
    id: 'shadow',
    title: 'Shadows',
    blurb:
      'Prefer the semantic aliases (`raised`, `floating`, `overlay`, `modal`) over the numbered levels.',
    prefixes: ['--mlv-shadow-'],
  },
  {
    id: 'radius',
    title: 'Border radius',
    prefixes: ['--mlv-radius-'],
  },
  {
    id: 'popover',
    title: 'Popover list surfaces',
    blurb:
      'Shared vocabulary for every popover that presents a list of rows (select, combobox, autocomplete, menu, pagination, breadcrumb overflow). Consume these directly — do not re-derive the underlying spacing/radius token.',
    prefixes: ['--mlv-popover-'],
  },
  {
    id: 'typography',
    title: 'Typography',
    blurb:
      'Semantic scales are split into `-size`, `-weight`, `-line-height` and (headings only) `-letter-spacing`. There is no bare `--mlv-typography-body-m` / `--mlv-typography-ui-s` token.',
    prefixes: [
      '--mlv-font-',
      '--mlv-typography-',
      '--mlv-line-height-',
      '--mlv-letter-spacing-',
    ],
  },
  { id: 'spacing', title: 'Spacing', prefixes: ['--mlv-spacing-'] },
  {
    id: 'sizing',
    title: 'Sizing',
    blurb:
      '`--mlv-padding-*` are `vertical horizontal` shorthand pairs, not single values. `--mlv-icon-in-container-ratio` is the odd member out: a unitless multiplier for a container height (e.g. `calc(var(--mlv-btn-height) * var(--mlv-icon-in-container-ratio))`), not a length of its own.',
    prefixes: ['--mlv-height-', '--mlv-padding-', '--mlv-icon-'],
  },
  {
    id: 'motion',
    title: 'Motion',
    blurb:
      '`--mlv-transition-*` hold property *lists*, not full `transition` shorthands: `transition: var(--mlv-transition-colors) var(--mlv-duration-fast) var(--mlv-ease-default)`.',
    prefixes: [
      '--mlv-duration-',
      '--mlv-ease-',
      '--mlv-transition-',
      '--mlv-spring-',
      '--mlv-stagger-',
    ],
  },
  { id: 'zindex', title: 'Z-index', prefixes: ['--mlv-z-'] },
  {
    id: 'state',
    title: 'State opacity',
    exact: [
      '--mlv-disabled-opacity',
      '--mlv-hover-overlay',
      '--mlv-active-overlay',
      '--mlv-focus-overlay',
    ],
  },
  {
    id: 'stroke',
    title: 'Stroke & focus',
    prefixes: ['--mlv-stroke-', '--mlv-focus-'],
  },
  {
    id: 'direction',
    title: 'Direction',
    blurb:
      'The sign of the inline axis: `1` in LTR, `-1` in RTL, re-declared under every `[dir]` so a mirrored subtree re-signs it for its own descendants. `transform`, `transform-origin` and `box-shadow` have no logical form, so their inline component is multiplied by this — consume it through `mixins.inline-distance()` rather than inlining the `calc()`.',
    exact: ['--mlv-inline-direction'],
  },
  {
    id: 'muted',
    title: 'Muted tints',
    blurb:
      'Three emphasis levels (`1` subtle → `3` strong) across eight families, each a `bg` / `text` / `border` triplet.',
    prefixes: ['--mlv-muted-'],
  },
];

/**
 * Names consumers repeatedly invent, mapped to the token that actually exists.
 * Every left-hand entry is a name observed in shipped consumer code or in this
 * repository — do not add speculative ones.
 */
const MISTAKEN_NAMES = [
  ['--mlv-error-text-1', '--mlv-text-error (or --mlv-text-negative)'],
  [
    '--mlv-muted-text-1',
    '--mlv-text-secondary (or --mlv-muted-default-text-1)',
  ],
  ['--mlv-border-1', '--mlv-border-normal'],
  ['--mlv-radius-2', '--mlv-radius-s … --mlv-radius-3xl (letter scale)'],
  ['--mlv-color-text-secondary', '--mlv-text-secondary'],
  ['--mlv-color-border', '--mlv-border-normal'],
  ['--mlv-color-surface', '--mlv-background-raised'],
  ['--mlv-color-secondary', '--mlv-background-neutral-1'],
  ['--mlv-color-on-surface', '--mlv-text-primary'],
  ['--mlv-background-surface-1', '--mlv-background-raised'],
  ['--mlv-background-neutral-0', '--mlv-background-base'],
  ['--mlv-background-hover', '--mlv-background-neutral-1-hover'],
  ['--mlv-background-elevation-1', '--mlv-elevation-bg-1'],
  ['--mlv-color-foreground-secondary', '--mlv-text-secondary'],
  ['--mlv-border-neutral', '--mlv-border-normal'],
  ['--mlv-danger-500', '--mlv-palette-danger-500'],
  [
    '--mlv-status-info / -positive / -negative / -warning',
    '--mlv-background-{info,success,danger,warning}-1 (fill) or --mlv-text-{info,positive,negative,warning}(text)',
  ],
  [
    '--mlv-shadow-small / -medium / -large / -popup',
    '--mlv-shadow-1 … -5, or --mlv-shadow-raised / -floating / -overlay / -modal',
  ],
  ['--mlv-radius-xxl', '--mlv-radius-3xl (or --mlv-radius-full)'],
  ['--mlv-duration-s / -m / -l', '--mlv-duration-fast / -normal / -slow'],
  ['--mlv-easing', '--mlv-ease-default'],
  ['--mlv-font-size-sm', '--mlv-font-size-s'],
  ['--mlv-spacing-sm', '--mlv-spacing-2'],
  [
    '--mlv-typography-body-m / -body-s / -body-l',
    '--mlv-typography-body-{m,s,l}-size (also -weight, -line-height)',
  ],
  [
    '--mlv-typography-ui-s / -ui-xs / -ui-2xs',
    '--mlv-typography-ui-{l,m,s}-size — there is no ui-xs tier',
  ],
  ['--mlv-typography-label-s', '--mlv-typography-label-size'],
  [
    '--mlv-line-height',
    '--mlv-line-height-normal (or a scale-specific -line-height token)',
  ],
];

// ─── Compile ─────────────────────────────────────────────────────────────────

/**
 * Compiles a `libs/styles` entry point and returns its CSS.
 * @param {string} entry — module name relative to `libs/styles/src/lib`
 */
function compile(entry) {
  return sass.compileString(`@use '${entry}';`, {
    loadPaths: [stylesLib],
    style: 'expanded',
  }).css;
}

// ─── Parse ───────────────────────────────────────────────────────────────────

/**
 * Collapses the line breaks Prettier introduces inside long `color-mix()` and
 * `cubic-bezier()` values back into a single readable line.
 *
 * @param {string} value
 */
function normaliseValue(value) {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim();
}

/**
 * @typedef {object} Declaration
 * @property {string} name       — custom property name, e.g. `--mlv-radius-m`
 * @property {string} value      — declared value, whitespace-collapsed
 * @property {string} selector   — the rule's selector list
 * @property {string[]} atRules  — enclosing at-rule preludes, outermost first
 * @property {string|null} note  — trailing `/* … *​/` comment, if any
 */

/**
 * Walks compiled CSS and collects every custom-property declaration together
 * with its selector and at-rule context.
 *
 * A hand-rolled scanner rather than a CSS parser dependency: the input is
 * machine-generated by Sass, so it is well-formed, and the workspace takes no
 * new dependency for a docs script.
 *
 * @param {string} css
 * @returns {Declaration[]}
 */
function parseDeclarations(css) {
  /** @type {Declaration[]} */
  const declarations = [];
  /** @type {string[]} */
  const stack = [];
  let buffer = '';
  let i = 0;

  while (i < css.length) {
    const char = css[i];

    if (char === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      const comment = css.slice(i + 2, end === -1 ? css.length : end).trim();
      // A comment that trails a declaration on the same line documents it.
      const last = declarations[declarations.length - 1];
      if (
        last &&
        buffer.trim() === '' &&
        !buffer.includes('\n') &&
        !last.note
      ) {
        last.note = comment;
      }
      buffer = '';
      i = end === -1 ? css.length : end + 2;
      continue;
    }

    if (char === '{') {
      stack.push(buffer.trim().replace(/\s+/g, ' '));
      buffer = '';
      i++;
      continue;
    }

    if (char === '}') {
      stack.pop();
      buffer = '';
      i++;
      continue;
    }

    if (char === ';') {
      const statement = buffer.trim();
      const match = /^(--mlv-[A-Za-z0-9_-]+)\s*:\s*([\s\S]+)$/.exec(statement);
      if (match) {
        declarations.push({
          name: match[1],
          value: normaliseValue(match[2]),
          selector: stack[stack.length - 1] ?? '',
          atRules: stack.slice(0, -1).filter((s) => s.startsWith('@')),
          note: null,
        });
      }
      buffer = '';
      i++;
      continue;
    }

    buffer += char;
    i++;
  }

  return declarations;
}

// ─── Collect ─────────────────────────────────────────────────────────────────

const css = [compile('index'), compile('animations')].join('\n');
const declarations = parseDeclarations(css);

/**
 * @typedef {object} Token
 * @property {string} name
 * @property {Record<string, string>} values     — theme id → value
 * @property {Record<string, string>} responsive — media prelude → value
 * @property {Set<string>} selectors
 * @property {string|null} note
 */

/** @type {Map<string, Token>} */
const tokens = new Map();

for (const declaration of declarations) {
  const theme = THEMES.find((t) => t.test(declaration.selector));
  if (!theme) continue; // component-scoped custom property, not a design token

  let token = tokens.get(declaration.name);
  if (!token) {
    token = {
      name: declaration.name,
      values: {},
      responsive: {},
      selectors: new Set(),
      note: null,
    };
    tokens.set(declaration.name, token);
  }

  token.selectors.add(declaration.selector);
  if (declaration.note && !token.note) token.note = declaration.note;

  const media = declaration.atRules.find((rule) => rule.startsWith('@media'));
  if (media) {
    token.responsive[media] = declaration.value;
  } else {
    token.values[theme.id] = declaration.value;
  }
}

// ─── Override hooks ──────────────────────────────────────────────────────────

/**
 * `var(--mlv-x, fallback)` references in `animations.scss` whose name is never
 * declared are deliberate override hooks: the fallback *is* the default and the
 * consumer sets the property to retune the animation. They are part of the
 * public surface, so they are listed — and the token checker allowlists them.
 *
 * @returns {{ name: string, fallback: string }[]}
 */
function collectOverrideHooks() {
  const source = readFileSync(resolve(stylesLib, 'animations.scss'), 'utf8');
  /** @type {Map<string, string>} */
  const hooks = new Map();

  for (const match of source.matchAll(/var\(\s*(--mlv-[A-Za-z0-9_-]+)/g)) {
    const name = match[1];
    if (tokens.has(name) || hooks.has(name)) continue;

    // Walk to the matching `)` so nested `var()` fallbacks survive intact.
    let depth = 1;
    let index = match.index + 'var('.length;
    while (index < source.length && depth > 0) {
      if (source[index] === '(') depth++;
      else if (source[index] === ')') depth--;
      if (depth > 0) index++;
    }
    const inner = source.slice(match.index + 'var('.length, index);
    const comma = inner.indexOf(',');
    hooks.set(name, comma === -1 ? '' : normaliseValue(inner.slice(comma + 1)));
  }

  return [...hooks.entries()]
    .map(([name, fallback]) => ({ name, fallback }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const overrideHooks = collectOverrideHooks();

// ─── Breakpoints ─────────────────────────────────────────────────────────────

/**
 * Breakpoints are Sass variables, not custom properties — they cannot be
 * overridden at runtime, only via `@use … with (…)`. Documented separately so
 * nobody reaches for a non-existent `--mlv-breakpoint-md`.
 */
function collectBreakpoints() {
  const source = readFileSync(resolve(stylesLib, 'breakpoints.scss'), 'utf8');
  return [
    ...source.matchAll(/^\$(mlv-breakpoint-[a-z]+):\s*([^;!]+)\s*!default;/gm),
  ].map(([, name, value]) => ({ name: `$${name}`, value: value.trim() }));
}

const breakpoints = collectBreakpoints();

// ─── Categorise ──────────────────────────────────────────────────────────────

const sortedTokens = [...tokens.values()].sort((a, b) =>
  a.name.localeCompare(b.name, 'en', { numeric: true }),
);

/** @type {Map<string, Token[]>} */
const grouped = new Map(CATEGORIES.map((category) => [category.id, []]));
/** @type {Token[]} */
const uncategorised = [];

for (const token of sortedTokens) {
  const category = CATEGORIES.find(
    (c) =>
      c.exact?.includes(token.name) ||
      c.prefixes?.some((prefix) => token.name.startsWith(prefix)),
  );
  if (category) grouped.get(category.id).push(token);
  else uncategorised.push(token);
}

if (uncategorised.length) {
  console.error(
    '❌  Tokens matched no category — add one to CATEGORIES in scripts/generate-tokens-md.mjs:',
  );
  for (const token of uncategorised) console.error(`     ${token.name}`);
  process.exit(1);
}

// ─── Render ──────────────────────────────────────────────────────────────────

/** Escapes a value for use inside a Markdown table cell. */
const cell = (value) => (value ? `\`${value.replace(/\|/g, '\\|')}\`` : '—');

/** Renders one category table. */
function renderCategory(category) {
  const list = grouped.get(category.id);
  if (!list.length) return '';

  const hasDark = list.some((t) => t.values.dark);
  const hasHighContrast = list.some((t) => t.values.highContrast);
  const hasNote = list.some((t) => t.note);

  const columns = ['Token', 'Light'];
  if (hasDark) columns.push('Dark');
  if (hasHighContrast) columns.push('High contrast');
  if (hasNote) columns.push('Notes');

  const rows = list.map((token) => {
    const row = [`\`${token.name}\``, cell(token.values.light)];
    if (hasDark) row.push(cell(token.values.dark));
    if (hasHighContrast) row.push(cell(token.values.highContrast));
    if (hasNote) row.push(token.note ?? '');
    return `| ${row.join(' | ')} |`;
  });

  return [
    `### ${category.title}`,
    '',
    ...(category.blurb ? [category.blurb, ''] : []),
    `| ${columns.join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows,
    '',
  ].join('\n');
}

const responsiveTokens = sortedTokens.filter(
  (token) => Object.keys(token.responsive).length,
);
const mediaPreludes = [
  ...new Set(responsiveTokens.flatMap((t) => Object.keys(t.responsive))),
].sort((a, b) => {
  const width = (prelude) => Number(/(\d+)/.exec(prelude)?.[1] ?? 0);
  return width(a) - width(b);
});

const usesDataThemeDark = sortedTokens.filter((token) =>
  [...token.selectors].some((s) => /\[data-theme=["']?dark/.test(s)),
);

const lines = [];

lines.push(
  '<!-- GENERATED FILE — do not edit by hand.',
  '     Regenerate with: yarn nx run styles:generate-tokens -->',
  '',
  '# Malva UI design tokens',
  '',
  `Every public \`--mlv-*\` custom property the design system declares — ${sortedTokens.length} tokens, generated from \`libs/styles/src/lib/*.scss\`.`,
  '',
  '**If a token is not in this file, it does not exist.** `var()` silently falls back',
  'when a custom property is undefined, so a misspelled token never errors — it just',
  'renders the fallback and quietly drops out of theming. Check the name here first.',
  '',
  '## Commonly mistaken names',
  '',
  'Names that look right, resolve to nothing, and ship the fallback.',
  '',
  '| Invented name | Use instead |',
  '| --- | --- |',
  ...MISTAKEN_NAMES.map(([wrong, right]) => `| \`${wrong}\` | \`${right}\` |`),
  '',
  '## Theme activation',
  '',
  '| Selector | Mode |',
  '| --- | --- |',
  "| `:root`, `:host`, `[mlvTheme='light']` | Light (default) |",
  "| `[mlvTheme='dark']` | Dark |",
  "| `[data-theme='high-contrast']` | High contrast |",
  '',
  '`MlvThemeService` (from `@malva-ui/cdk/theme`) sets the `mlvTheme` attribute on',
  '`documentElement`. Tokens with no dark or high-contrast value inherit the light',
  'value in every mode.',
  '',
);

if (usesDataThemeDark.length) {
  lines.push(
    `> **Known inconsistency.** ${usesDataThemeDark.length} muted-tint tokens declare their dark values`,
    "> under `[data-theme='dark']` rather than `[mlvTheme='dark']`, so they do **not** follow",
    '> `MlvThemeService`. The Dark column below reports the declared value; whether it',
    '> applies depends on which attribute the host sets.',
    '',
  );
}

lines.push('## Tokens', '');

for (const category of CATEGORIES) {
  const rendered = renderCategory(category);
  if (rendered) lines.push(rendered);
}

if (responsiveTokens.length) {
  lines.push(
    '### Responsive overrides',
    '',
    'These tokens change value at viewport breakpoints. Body and UI sizes are fixed;',
    'only the heading-scale font sizes scale up.',
    '',
    `| Token | Base | ${mediaPreludes.map((m) => m.replace('@media ', '')).join(' | ')} |`,
    `| --- | --- | ${mediaPreludes.map(() => '---').join(' | ')} |`,
    ...responsiveTokens.map(
      (token) =>
        `| \`${token.name}\` | ${cell(token.values.light)} | ${mediaPreludes
          .map((media) => cell(token.responsive[media]))
          .join(' | ')} |`,
    ),
    '',
  );
}

if (overrideHooks.length) {
  lines.push(
    '## Animation override hooks',
    '',
    'These are **not** declared anywhere — the `var()` fallback is the default value.',
    'Set them on a component (or on `:root`) to retune the shared keyframe animations',
    'in `animations.scss`. Referencing one without setting it is intentional and safe.',
    '',
    '| Hook | Default |',
    '| --- | --- |',
    ...overrideHooks.map(
      (hook) =>
        `| \`${hook.name}\` | ${hook.fallback ? cell(hook.fallback) : '_none — the animation requires it to be set_'} |`,
    ),
    '',
  );
}

lines.push(
  '## Not custom properties',
  '',
  '### Breakpoints (Sass variables)',
  '',
  'Breakpoints are compile-time Sass variables — there is no `--mlv-breakpoint-*`',
  'custom property. Override them where you `@use` the module:',
  '',
  '```scss',
  "@use '../../../../styles/src/lib/breakpoints' as bp with (",
  '  $mlv-breakpoint-md: 900px',
  ');',
  '```',
  '',
  '| Variable | Default |',
  '| --- | --- |',
  ...breakpoints.map((bp) => `| \`${bp.name}\` | \`${bp.value}\` |`),
  '',
  '### Density (Sass mixins)',
  '',
  'Density declares no tokens. It is a set of mixins in `density.scss`',
  '(`density-tight`, `density-compact`, `density-comfortable`, `density-spacious`,',
  '`density-airy`, `density-not-comfortable`) that match a `--<level>` BEM modifier',
  'on the element or an ancestor. Components remap their own scoped variables',
  'inside those mixins.',
  '',
  '### Component-scoped variables',
  '',
  'A component may declare its own `--mlv-<block>-*` variables (`--mlv-btn-bg`,',
  '`--mlv-tab-indicator-width`) to let state, variants and density mutate a value',
  'without touching the global contract. Those are implementation details of the',
  'component that declares them, not design tokens, and are deliberately absent',
  'from this file.',
  '',
  '## Verifying token names',
  '',
  '```sh',
  'yarn nx run styles:check-tokens',
  '```',
  '',
  'Scans every `.scss` / `.css` under `libs/` and `apps/` for `var(--mlv-…)` and',
  'fails on any name that is neither declared here nor declared locally as a',
  'component-scoped variable.',
  '',
);

// Formatted with the workspace Prettier config so the committed file survives
// lint-staged untouched — otherwise every commit would leave `--check` failing.
const markdown = await prettier.format(
  lines.join('\n').replace(/\n{3,}/g, '\n\n'),
  {
    ...(await prettier.resolveConfig(outputPath)),
    parser: 'markdown',
  },
);

if (checkOnly) {
  const current = readFileSync(outputPath, 'utf8');
  if (current !== markdown) {
    console.error(
      '❌  libs/styles/tokens.md is out of date — run `yarn nx run styles:generate-tokens`.',
    );
    process.exit(1);
  }
  console.log('✅  libs/styles/tokens.md is up to date.');
} else {
  writeFileSync(outputPath, markdown, 'utf8');
  console.log(
    `✅  Wrote libs/styles/tokens.md — ${sortedTokens.length} tokens, ${overrideHooks.length} override hooks.`,
  );
}
