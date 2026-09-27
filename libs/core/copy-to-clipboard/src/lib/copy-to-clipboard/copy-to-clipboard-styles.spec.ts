import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as Sass from 'sass';
import type Postcss from 'postcss';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';
import { describe, expect, it } from 'vitest';

// `sass` and `postcss` are Node-only dependencies; loading them through
// `createRequire` keeps them out of the browser-ish module graph vitest builds
// for this project.
const nodeRequire = createRequire(import.meta.url);
const sass = nodeRequire('sass') as typeof Sass;
const postcss = nodeRequire('postcss') as typeof Postcss;

// The `@nx/vitest:test` executor runs with cwd = workspace root, so the path is
// resolved from this file rather than from `process.cwd()`.
const COPY_SCSS = resolve(
  dirname(fileURLToPath(import.meta.url)),
  './copy-to-clipboard.scss',
);

const CONTENT = '.mlv-copy-to-clipboard__content';

/**
 * The rest state and the three states that reveal the end fade under the
 * indicator — each the selector the stylesheet writes for it (hover sits inside
 * a `(hover: hover) and (pointer: fine)` media block).
 */
const STATES = {
  rest: CONTENT,
  hover: `.mlv-copy-to-clipboard:hover ${CONTENT}`,
  focusVisible: `.mlv-copy-to-clipboard:focus-visible ${CONTENT}`,
  copied: `.mlv-copy-to-clipboard--copied ${CONTENT}`,
} as const;

/** Box width, in px, the mask geometry below is resolved against. */
const BOX = 300;

/** 1 rem / 1 em, in px. */
const FONT_SIZE = 16;

/**
 * Splits `value` on `separator` wherever it is not nested inside parentheses —
 * a layer list on `,`, a `<position>` on whitespace.
 */
function splitTopLevel(value: string, separator: ',' | ' '): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of value) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    const splits =
      depth === 0 && (separator === ' ' ? /\s/.test(char) : char === separator);
    if (splits) {
      if (current.trim()) parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** Substitutes every `var(--x[, fallback])` from `vars`, innermost first. */
function substitute(expression: string, vars: Record<string, string>): string {
  const pattern = /var\((--[\w-]+)(?:,\s*([^()]*))?\)/;
  let out = expression;
  for (let match = pattern.exec(out); match; match = pattern.exec(out)) {
    const value = vars[match[1]] ?? match[2];
    if (value === undefined) throw new Error(`unresolved ${match[1]}`);
    out = out.replace(match[0], value);
  }
  return out;
}

/**
 * Evaluates a substituted length / angle expression the way a browser resolves
 * it: `%` is a share of `percentBasis`, `rem` / `em` are 16px, `deg` and `px`
 * are plain numbers, and `calc(` is a parenthesis.
 */
function evaluate(expression: string, percentBasis: number): number {
  const source = expression.replace(/calc\(/g, '(');
  const tokens = source.match(/\d*\.?\d+(?:px|rem|em|%|deg)?|[-+*/()]/g) ?? [];
  if (tokens.join('') !== source.replace(/\s+/g, '')) {
    throw new Error(`cannot evaluate \`${expression}\``);
  }
  let position = 0;
  const primary = (): number => {
    const token = tokens[position++];
    if (token === '(') {
      const value = sum();
      if (tokens[position++] !== ')') throw new Error(`unbalanced: ${source}`);
      return value;
    }
    if (token === '-') return -primary();
    if (token === '+') return primary();
    const match = /^(\d*\.?\d+)(px|rem|em|%|deg)?$/.exec(token ?? '');
    if (!match) throw new Error(`unexpected \`${token}\` in ${source}`);
    const number = Number(match[1]);
    if (match[2] === '%') return (number * percentBasis) / 100;
    if (match[2] === 'rem' || match[2] === 'em') return number * FONT_SIZE;
    return number;
  };
  const product = (): number => {
    let value = primary();
    while (tokens[position] === '*' || tokens[position] === '/') {
      const operator = tokens[position++];
      const right = primary();
      value = operator === '*' ? value * right : value / right;
    }
    return value;
  };
  const sum = (): number => {
    let value = product();
    while (tokens[position] === '+' || tokens[position] === '-') {
      const operator = tokens[position++];
      const right = product();
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  };
  const result = sum();
  if (position !== tokens.length) throw new Error(`trailing input: ${source}`);
  return result;
}

/**
 * The last value each declaration takes across every rule for `selector`,
 * outside the reduced-motion block (which restates no mask).
 */
function declarations(css: string, selector: string): Map<string, string> {
  const found = new Map<string, string>();
  let matched = false;
  postcss.parse(css).walkRules((rule) => {
    if (!rule.selectors.some((s) => s.trim() === selector)) return;
    matched = true;
    rule.walkDecls((decl) => {
      found.set(decl.prop, decl.value);
    });
  });
  expect(matched, `no rule for \`${selector}\``).toBe(true);
  return found;
}

/** A gradient's direction in degrees, `[0, 360)`. `to right` is 90. */
function gradientAngle(gradient: string, vars: Record<string, string>): number {
  const inner = gradient.slice(gradient.indexOf('(') + 1, -1);
  const first = splitTopLevel(inner, ',')[0];
  const keywords: Record<string, number> = {
    'to top': 0,
    'to right': 90,
    'to bottom': 180,
    'to left': 270,
  };
  const angle =
    keywords[first] ??
    (/deg/.test(first) ? evaluate(substitute(first, vars), 0) : 180);
  return ((angle % 360) + 360) % 360;
}

interface MaskLayer {
  /** Gradient direction in degrees. */
  readonly angle: number;
  /** Resolved image width, px. */
  readonly width: number;
  /** Resolved x offset of the image's left edge from the box's, px. */
  readonly x: number;
}

/**
 * Resolves the two edge layers of the content mask for one state and one
 * direction sign, exactly as a browser would lay them out in a `BOX`-wide box
 * whose host has synced the mask widths to 51% / 50% of its own width.
 */
function edgeLayers(css: string, state: keyof typeof STATES, sign: 1 | -1) {
  const base = declarations(css, CONTENT);
  const own = declarations(css, STATES[state]);
  const vars: Record<string, string> = {
    '--mlv-copy-to-clipboard-mask-leading-width': `${BOX * 0.51}px`,
    '--mlv-copy-to-clipboard-mask-trailing-width': `${BOX * 0.5}px`,
    '--mlv-inline-direction': String(sign),
  };
  // The fade size, offset and extension are declared on the content itself.
  for (const [prop, value] of base) {
    if (prop.startsWith('--') && !(prop in vars)) vars[prop] = value;
  }
  const images = splitTopLevel(base.get('mask-image') ?? '', ',');
  const sizes = splitTopLevel(base.get('mask-size') ?? '', ',');
  const positions = splitTopLevel(
    own.get('mask-position') ?? base.get('mask-position') ?? '',
    ',',
  );
  const xKeywords: Record<string, string> = {
    left: '0%',
    center: '50%',
    right: '100%',
  };
  return [0, 1].map((index): MaskLayer => {
    const width = evaluate(
      substitute(splitTopLevel(sizes[index], ' ')[0], vars),
      BOX,
    );
    const xSource = splitTopLevel(positions[index], ' ')[0];
    const x = evaluate(
      substitute(xKeywords[xSource] ?? xSource, vars),
      BOX - width,
    );
    return { angle: gradientAngle(images[index], vars), width, x };
  });
}

/**
 * jsdom resolves neither `mask-*` nor a `var()` inside `calc()`, so the mask
 * geometry is asserted on the compiled stylesheet, evaluated for both values
 * of `--mlv-inline-direction`. The indicator already sits at the logical end
 * (`inset-inline-end`), so the fade it covers has to follow it.
 */
describe('copy-to-clipboard.scss — content mask geometry (#341)', () => {
  const css = stripCssLayersFromText(sass.compile(COPY_SCSS).css);

  // What the stylesheet resolved to before #341, in LTR: layer 0 (start) is
  // always parked off the left edge; layer 1 (end) is parked off the right edge
  // at rest and pulled 0.5rem inside it — under the indicator — otherwise.
  const LTR_BEFORE = {
    rest: [-26, 149],
    hover: [-26, 115],
    focusVisible: [-26, 115],
    copied: [-26, 115],
  } as const;

  it.each(Object.keys(STATES) as (keyof typeof STATES)[])(
    'keeps the LTR %s geometry byte-for-byte',
    (state) => {
      const [start, end] = edgeLayers(css, state, 1);
      expect(start.angle).toBe(90);
      expect(end.angle).toBe(270);
      expect(start.x).toBeCloseTo(LTR_BEFORE[state][0], 6);
      expect(end.x).toBeCloseTo(LTR_BEFORE[state][1], 6);
    },
  );

  it.each(Object.keys(STATES) as (keyof typeof STATES)[])(
    'mirrors the %s geometry in RTL, so the fade stays under the indicator',
    (state) => {
      const ltr = edgeLayers(css, state, 1);
      const rtl = edgeLayers(css, state, -1);
      ltr.forEach((layer, index) => {
        expect(rtl[index].width).toBeCloseTo(layer.width, 6);
        expect(rtl[index].angle).toBe((360 - layer.angle) % 360);
        expect(rtl[index].x).toBeCloseTo(BOX - layer.width - layer.x, 6);
      });
    },
  );
});
