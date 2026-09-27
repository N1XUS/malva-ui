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
const FADE_SCSS = resolve(
  dirname(fileURLToPath(import.meta.url)),
  './fade.scss',
);

const HORIZONTAL = '.mlv-fade:not([data-orientation=vertical])';

/** The four horizontal states, each the class list `MlvFade` stamps. */
const STATES = {
  rest: HORIZONTAL,
  start: `${HORIZONTAL}.mlv-fade--start`,
  end: `${HORIZONTAL}.mlv-fade--end`,
  both: `${HORIZONTAL}.mlv-fade--start.mlv-fade--end`,
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

/** The last value each declaration takes across every top-level rule for `selector`. */
function declarations(css: string, selector: string): Map<string, string> {
  const found = new Map<string, string>();
  let matched = false;
  postcss.parse(css).walkRules((rule) => {
    if (rule.parent?.type !== 'root') return;
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
 * Resolves the two edge layers of the horizontal fade for one state and one
 * direction sign, exactly as a browser would lay them out in a `BOX`-wide box.
 */
function edgeLayers(css: string, state: keyof typeof STATES, sign: 1 | -1) {
  const base = declarations(css, HORIZONTAL);
  const own = declarations(css, STATES[state]);
  const vars: Record<string, string> = {
    '--mlv-fade-size': '24px',
    '--mlv-fade-offset': '0px',
    '--mlv-line-height': '20px',
    '--mlv-inline-direction': String(sign),
  };
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
 * of `--mlv-inline-direction`. The token is re-declared on every `[dir]`, so a
 * geometry that depends on it follows a scoped `[dir="rtl"]` at any depth.
 */
describe('fade.scss — horizontal mask geometry (#341)', () => {
  const css = stripCssLayersFromText(sass.compile(FADE_SCSS).css);

  // What the stylesheet resolved to before #341, in LTR: layer 0 fades the
  // start (left) edge, layer 1 the end (right) edge; hidden layers are parked
  // `size + offset - 1px` outside their edge. LTR must not move by a pixel.
  const LTR_BEFORE = {
    rest: [-23, 149],
    start: [0, 149],
    end: [-23, 126],
    both: [0, 126],
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
    'mirrors the %s geometry in RTL, so the fade lands on the clipped edge',
    (state) => {
      const ltr = edgeLayers(css, state, 1);
      const rtl = edgeLayers(css, state, -1);
      ltr.forEach((layer, index) => {
        // Mirror image: same width, the gradient reversed, the box's left
        // edge standing in for its right one.
        expect(rtl[index].width).toBeCloseTo(layer.width, 6);
        expect(rtl[index].angle).toBe((360 - layer.angle) % 360);
        expect(rtl[index].x).toBeCloseTo(BOX - layer.width - layer.x, 6);
      });
    },
  );

  it('names no physical edge in a horizontal mask-position', () => {
    for (const selector of Object.values(STATES)) {
      const position = declarations(css, selector).get('mask-position') ?? '';
      expect(position, selector).not.toMatch(/\b(left|right)\b/);
    }
  });
});
