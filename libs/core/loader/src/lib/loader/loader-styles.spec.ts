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
const LOADER_SCSS = resolve(
  dirname(fileURLToPath(import.meta.url)),
  './loader.scss',
);

const CSS = stripCssLayersFromText(sass.compile(LOADER_SCSS).css);
const ROOT = postcss.parse(CSS);

const BAR = '.mlv-loader--bar';
const CIRCLE = '.mlv-loader--circle';
const INDETERMINATE = '.mlv-loader--indeterminate';

/** Every animated part of the loader, each the selector the stylesheet writes. */
const ANIMATED = {
  glow: `${BAR}.mlv-loader--glow:not(${INDETERMINATE}) .mlv-loader__bar::after`,
  primary: `${BAR}${INDETERMINATE} .mlv-loader__track::before`,
  secondary: `${BAR}${INDETERMINATE} .mlv-loader__track::after`,
  circle: `${CIRCLE}${INDETERMINATE} .mlv-loader__circle`,
  circleFill: `${CIRCLE}${INDETERMINATE} .mlv-loader__circle-fill`,
} as const;

/** Values the circle geometry is resolved with — the component's defaults. */
const CIRCLE_VARS = {
  '--mlv-l-diameter': '48px',
  '--mlv-l-stroke-width': '4px',
};

/**
 * The inline-axis translations every keyframe took before the RTL fix, read
 * at `--mlv-inline-direction: 1`. LTR motion must not move.
 */
const LTR_TRANSLATE_KEYFRAMES: Record<string, number[]> = {
  'mlv-loader-bar-shimmer': [-200, 200],
  'mlv-loader-bar-primary-translate': [-100, -100, -16.329, 100.611],
  'mlv-loader-bar-secondary-translate': [-100, -62.348, -15.614, 120],
};

/** Whether `node` sits inside an `@media` whose query matches `query`. */
function insideMedia(node: Postcss.Node, query: RegExp): boolean {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (
      parent.type === 'atrule' &&
      (parent as Postcss.AtRule).name === 'media' &&
      query.test((parent as Postcss.AtRule).params)
    ) {
      return true;
    }
  }
  return false;
}

/** Whether `node` sits inside an `@keyframes` block. */
function insideKeyframes(node: Postcss.Node): boolean {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (
      parent.type === 'atrule' &&
      /keyframes$/.test((parent as Postcss.AtRule).name)
    ) {
      return true;
    }
  }
  return false;
}

const REDUCED = /prefers-reduced-motion:\s*reduce/;

interface FoundRule {
  rule: Postcss.Rule;
  index: number;
  decls: Map<string, string>;
}

/** Every style rule in document order, with its declarations. */
function allRules(): FoundRule[] {
  const found: FoundRule[] = [];
  ROOT.walkRules((rule) => {
    if (insideKeyframes(rule)) return;
    const decls = new Map<string, string>();
    rule.walkDecls((decl) => {
      decls.set(decl.prop, decl.value);
    });
    found.push({ rule, index: found.length, decls });
  });
  return found;
}

/**
 * The declarations the reduced-motion branch writes for exactly `selector`,
 * merged in document order. Returns `null` when no such rule exists.
 */
function reducedDeclarations(selector: string): Map<string, string> | null {
  let merged: Map<string, string> | null = null;
  for (const { rule, decls } of allRules()) {
    if (!insideMedia(rule, REDUCED)) continue;
    if (!rule.selectors.some((s) => s.trim() === selector)) continue;
    merged ??= new Map();
    for (const [prop, value] of decls) merged.set(prop, value);
  }
  return merged;
}

/** Splits `value` on whitespace that is not nested inside parentheses. */
function splitTopLevel(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of value) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (depth === 0 && /\s/.test(char)) {
      if (current) parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current) parts.push(current);
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
 * Evaluates a substituted length / angle expression: `%` is a share of
 * `percentBasis`, `deg` and `px` are plain numbers, and `calc(` is a
 * parenthesis.
 */
function evaluate(expression: string, percentBasis = 100): number {
  const source = expression.replace(/calc\(/g, '(');
  const tokens = source.match(/\d*\.?\d+(?:px|%|deg)?|[-+*/()]/g) ?? [];
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
    const match = /^(\d*\.?\d+)(px|%|deg)?$/.exec(token ?? '');
    if (!match) throw new Error(`unexpected \`${token}\` in ${source}`);
    const number = Number(match[1]);
    return match[2] === '%' ? (number * percentBasis) / 100 : number;
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

/** The circumference the circle fill is dashed against, at the default size. */
const CIRCUMFERENCE = Math.PI * (48 - 4);

describe('MlvLoader styles — reduced motion (#367)', () => {
  it('neutralises every animation it declares, pseudo-elements included', () => {
    // `mixins.reduced-motion()` selects `.mlv-loader *` and
    // `[class^='mlv-loader__']`, which match elements and never a
    // descendant's `::before` / `::after` — so each animated part needs a
    // rule of its own, on the same selector, after the one that animates it.
    const rules = allRules();
    const animated = rules.filter(
      ({ rule, decls }) =>
        !insideMedia(rule, /prefers-reduced-motion/) &&
        [...decls].some(
          ([prop, value]) =>
            /^animation(-name)?$/.test(prop) && !/^none\b/.test(value),
        ),
    );
    const selectors = animated.flatMap(({ rule }) =>
      rule.selectors.map((s) => s.trim()),
    );
    expect(selectors.sort()).toEqual(Object.values(ANIMATED).sort());

    for (const { rule, index } of animated) {
      for (const selector of rule.selectors.map((s) => s.trim())) {
        const override = rules.find(
          (candidate) =>
            candidate.index > index &&
            insideMedia(candidate.rule, REDUCED) &&
            candidate.rule.selectors.some((s) => s.trim() === selector),
        );
        const neutralised =
          override?.decls.get('animation') === 'none' ||
          override?.decls.get('display') === 'none';
        expect(
          neutralised,
          `no reduced-motion override for \`${selector}\``,
        ).toBe(true);
      }
    }
  });

  it('holds the indeterminate bar at a static segment detached from both edges', () => {
    const primary = reducedDeclarations(ANIMATED.primary);
    expect(primary?.get('animation')).toBe('none');
    // A segment anchored at inline-start would read as a determinate value;
    // one floating in the middle reads as "busy", in either direction.
    const start = evaluate(primary?.get('inset-inline-start') ?? 'x');
    const width = evaluate(primary?.get('width') ?? 'x');
    expect(start).toBeGreaterThan(0);
    expect(width).toBeGreaterThan(0);
    expect(start + width).toBeLessThan(100);
    // Centred, so it is the same picture in LTR and RTL.
    expect(start).toBeCloseTo(100 - start - width, 5);

    expect(reducedDeclarations(ANIMATED.secondary)?.get('display')).toBe(
      'none',
    );
  });

  it('hides the determinate glow sheen', () => {
    expect(reducedDeclarations(ANIMATED.glow)?.get('display')).toBe('none');
  });

  it('holds the indeterminate circle at a static arc centred on the top', () => {
    expect(reducedDeclarations(ANIMATED.circle)?.get('animation')).toBe('none');

    const fill = reducedDeclarations(ANIMATED.circleFill);
    expect(fill?.get('animation')).toBe('none');
    // Not the empty ring the mixin collapses the dash animation to.
    const offset = evaluate(
      substitute(fill?.get('stroke-dashoffset') ?? 'x', CIRCLE_VARS),
    );
    const visible = (CIRCUMFERENCE - offset) / CIRCUMFERENCE;
    expect(visible).toBeGreaterThan(0.1);
    expect(visible).toBeLessThan(0.9);
    // The arc's midpoint sits at 12 o'clock (-90deg), so it is not a
    // determinate fill starting there, and it needs no mirroring.
    const rotation =
      /^rotate\((.+)\)$/.exec(fill?.get('transform') ?? '')?.[1] ?? 'x';
    expect(evaluate(rotation) + visible * 180).toBeCloseTo(-90, 5);
  });
});

describe('MlvLoader styles — RTL (#367)', () => {
  it('writes no physical inline position', () => {
    const physical: string[] = [];
    ROOT.walkDecls((decl) => {
      const prop = decl.prop.toLowerCase();
      if (prop === 'left' || prop === 'right')
        physical.push(`${prop}: ${decl.value}`);
      if (prop === 'transform-origin' && /\b(left|right)\b/.test(decl.value)) {
        physical.push(`${prop}: ${decl.value}`);
      }
      if (
        /translateX\(/.test(decl.value) &&
        !decl.value.includes('--mlv-inline-direction')
      ) {
        physical.push(`${prop}: ${decl.value}`);
      }
      if (
        prop === 'translate' &&
        decl.value !== 'none' &&
        !decl.value.includes('var(--mlv-inline-direction)')
      ) {
        physical.push(`${prop}: ${decl.value}`);
      }
    });
    expect(physical).toEqual([]);
  });

  it('anchors the sweeping segments at inline-start', () => {
    const shared = allRules().find(
      ({ rule }) =>
        !insideMedia(rule, /prefers-reduced-motion/) &&
        rule.selectors.map((s) => s.trim()).includes(ANIMATED.primary) &&
        rule.selectors.map((s) => s.trim()).includes(ANIMATED.secondary),
    );
    expect(shared?.decls.get('inset-inline-start')).toBe('0');

    const [inline, block] = splitTopLevel(
      shared?.decls.get('transform-origin') ?? 'x',
    );
    expect(block).toBe('center');
    expect(
      evaluate(substitute(inline, { '--mlv-inline-direction': '1' })),
    ).toBe(0);
    expect(
      evaluate(substitute(inline, { '--mlv-inline-direction': '-1' })),
    ).toBe(100);
  });

  it('mirrors every translate keyframe in RTL and leaves LTR where it was', () => {
    for (const [name, ltr] of Object.entries(LTR_TRANSLATE_KEYFRAMES)) {
      const values: string[] = [];
      ROOT.walkAtRules(/keyframes$/, (atRule) => {
        if (atRule.params !== name) return;
        atRule.walkDecls('translate', (decl) => {
          values.push(decl.value);
        });
      });
      const at = (sign: string) =>
        values.map((value) =>
          evaluate(substitute(value, { '--mlv-inline-direction': sign })),
        );
      expect(at('1'), name).toEqual(ltr);
      expect(at('-1'), name).toEqual(ltr.map((value) => -value));
    }
  });
});
