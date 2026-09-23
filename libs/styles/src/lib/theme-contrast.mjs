/**
 * Resolves `theme.scss` colour tokens to concrete sRGB values and scores WCAG
 * contrast between them.
 *
 * jsdom resolves neither `var()` nor `color-mix()`, so axe's `color-contrast`
 * rule is disabled in this repo's component specs and cannot catch a token
 * regression. This module reads `theme.scss` itself instead, which makes the
 * guard independent of any browser.
 *
 * Supports exactly the value forms `theme.scss` uses for colour tokens:
 * `#rgb` / `#rrggbb`, `#{$scss-variable}` interpolation, `var(--token)` with an
 * optional fallback, and `color-mix(in srgb, <colour> <p>%, <colour>)`.
 */

/** @private Reads a declaration value up to the `;` that closes it, ignoring nested parens. */
const readValue = (source, from) => {
  let depth = 0;
  for (let i = from; i < source.length; i++) {
    const ch = source[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ';' && depth === 0) return { value: source.slice(from, i).trim(), end: i };
  }
  return { value: source.slice(from).trim(), end: source.length };
};

/** Parses every `$mlv-palette-*: #hex;` SCSS variable into a name → hex map. */
export const loadScssVariables = (source) => {
  const out = new Map();
  const re = /\$([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g;
  let m;
  while ((m = re.exec(source))) out.set(m[1], m[2]);
  return out;
};

/**
 * Splits `theme.scss` into its three token regions.
 *
 * The dark region is the `@mixin dark-tokens` body and the high-contrast region
 * the `[data-theme='high-contrast']` rule; everything before the mixin is the
 * light `:root` region.
 */
export const loadRegions = (source) => {
  const darkAt = source.indexOf('@mixin dark-tokens');
  const hcAt = source.indexOf("[data-theme='high-contrast']");
  if (darkAt < 0 || hcAt < 0) throw new Error('theme.scss: could not locate the dark / high-contrast regions');
  const declarations = (slice) => {
    const out = new Map();
    const re = /(--[\w-]+)\s*:/g;
    let m;
    while ((m = re.exec(slice))) {
      const { value, end } = readValue(slice, m.index + m[0].length);
      out.set(m[1], value);
      re.lastIndex = end;
    }
    return out;
  };
  return {
    light: declarations(source.slice(0, darkAt)),
    dark: declarations(source.slice(darkAt, hcAt)),
    highContrast: declarations(source.slice(hcAt)),
  };
};

/** @private Splits on top-level commas only. */
const splitTop = (input) => {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(input.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(input.slice(start).trim());
  return parts;
};

const NAMED = { white: [255, 255, 255], black: [0, 0, 0], transparent: [0, 0, 0] };

/** Parses `#rgb` / `#rrggbb` into `[r, g, b]` (0–255). */
export const parseHex = (input) => {
  let h = input.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};

/**
 * The regions each theme reads a token from, first match winning.
 *
 * `highContrastDark` is `data-theme="high-contrast"` on an element that already
 * carries `mlvTheme="dark"` — the usual shape, since `MlvThemeService` always
 * marks `<html>`. All three rules then match one element; they share a
 * specificity, so source order decides and high contrast (last) wins wherever
 * it declares a token, dark wherever only dark does. Because every rule lands on
 * the same element, the stack is also exact for aliases. A *nested* scope is a
 * different question — `theme-scopes.mjs` answers that one.
 */
const THEME_STACKS = {
  light: ['light'],
  dark: ['dark', 'light'],
  highContrast: ['highContrast', 'light'],
  highContrastDark: ['highContrast', 'dark', 'light'],
};

/**
 * Resolves a token value to `[r, g, b]`.
 *
 * @param value    The raw declaration value, e.g. `color-mix(in srgb, var(--x) 85%, white)`.
 * @param theme    `'light' | 'dark' | 'highContrast' | 'highContrastDark'` — every theme falls
 *                 back to light, mirroring how `[mlvTheme='dark']` inherits every token it does
 *                 not override; see `THEME_STACKS`.
 * @param ctx      `{ regions, scssVars }` from `loadRegions` / `loadScssVariables`.
 */
export const resolveColor = (value, theme, ctx, seen = new Set()) => {
  const v = value.trim();

  // `#{$mlv-palette-primary-300}` interpolation.
  const interp = v.match(/^#\{\s*\$([\w-]+)\s*\}$/);
  if (interp) {
    const hit = ctx.scssVars.get(interp[1]);
    if (!hit) throw new Error(`unknown SCSS variable $${interp[1]}`);
    return parseHex(hit);
  }

  if (v.startsWith('#')) {
    const hex = parseHex(v);
    if (hex) return hex;
  }
  if (NAMED[v]) return NAMED[v];

  if (v.startsWith('var(')) {
    const args = splitTop(v.slice(4, -1));
    const name = args[0].trim();
    if (seen.has(name)) throw new Error(`circular token reference at ${name}`);
    const stack = THEME_STACKS[theme];
    if (!stack) throw new Error(`unknown theme "${theme}"`);
    let lookup;
    for (const region of stack) {
      lookup = ctx.regions[region].get(name);
      if (lookup !== undefined) break;
    }
    if (lookup === undefined) {
      if (args[1]) return resolveColor(args[1], theme, ctx, seen);
      throw new Error(`token ${name} is not declared for theme "${theme}"`);
    }
    return resolveColor(lookup, theme, ctx, new Set([...seen, name]));
  }

  if (v.startsWith('color-mix(')) {
    const args = splitTop(v.slice(10, -1));
    if (args.length !== 3 || !/^in\s+srgb$/.test(args[0]))
      throw new Error(`unsupported color-mix form: ${v}`);
    const pct = args[1].match(/([\d.]+)%\s*$/);
    if (!pct) throw new Error(`color-mix without a percentage: ${v}`);
    const p = Number(pct[1]) / 100;
    const a = resolveColor(args[1].slice(0, pct.index).trim(), theme, ctx, seen);
    const b = resolveColor(args[2], theme, ctx, seen);
    // `color-mix(in srgb, …)` interpolates the gamma-encoded components directly.
    return [0, 1, 2].map((i) => a[i] * p + b[i] * (1 - p));
  }

  throw new Error(`cannot resolve colour value: ${v}`);
};

/** Formats `[r, g, b]` as `#rrggbb`. */
export const toHex = (c) =>
  '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

/** WCAG 2.1 relative luminance. */
export const luminance = (c) => {
  const [r, g, b] = c.map((v) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG 2.1 contrast ratio, rounded to 2dp (the precision the audit tables quote). */
export const contrastRatio = (fg, bg) => {
  const a = luminance(fg);
  const b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
};

/** Convenience: resolve two token names in a theme and score them. */
export const ratioOf = (fgToken, bgToken, theme, ctx) =>
  contrastRatio(
    resolveColor(`var(${fgToken})`, theme, ctx),
    resolveColor(`var(${bgToken})`, theme, ctx),
  );
