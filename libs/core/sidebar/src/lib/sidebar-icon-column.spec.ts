import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as sass from 'sass';

/**
 * Icon-track contract for `mlv-sidebar`.
 *
 * Every row lays its glyph out in the `--mlv-sidebar-icon-column-width` grid
 * track. That width is derived from the collapsed width so an icon does not
 * shift horizontally while the trailing edge animates — but a consumer may
 * collapse to a width that cannot host an icon at all (`collapsedWidth="0rem"`
 * hides the sidebar rather than railing it). Without a floor the track resolves
 * to zero in *both* states and every glyph overflows its own column into
 * whatever sits to its inline-start.
 */

const LIB_DIR = dirname(fileURLToPath(import.meta.url));

const css = sass.compile(join(LIB_DIR, 'sidebar/sidebar.scss'), {
  style: 'expanded',
}).css;

/** Width of the glyph a row renders, in rem — `sidebar-item.scss` sets `1.25rem`. */
const GLYPH_REM = 1.25;

/** Declared defaults on `.mlv-sidebar`, used when a `var()` has no fallback. */
const DEFAULTS: Record<string, number> = {
  '--mlv-sidebar-gutter': 0.5,
  '--mlv-sidebar-border-width': 0.0625,
};

/** Splits `inner` on top-level commas, ignoring commas nested in parentheses. */
function splitArguments(inner: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < inner.length; i++) {
    const char = inner[i];
    if (char === '(') depth++;
    else if (char === ')') depth--;
    else if (char === ',' && depth === 0) {
      parts.push(inner.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(inner.slice(start));
  return parts;
}

/** Returns the argument list of the `name(...)` call starting at `from`. */
function callArguments(source: string, name: string, from = 0): string | null {
  const at = source.indexOf(`${name}(`, from);
  if (at === -1) return null;
  const open = at + name.length;
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '(') depth++;
    else if (source[i] === ')' && --depth === 0) {
      return source.slice(open + 1, i);
    }
  }
  return null;
}

/**
 * Evaluates a `max()` / `calc()` length expression to rem, substituting
 * `--mlv-sidebar-collapsed-width` with `collapsedWidthRem`. Only the operators
 * this declaration actually uses are supported.
 */
function evaluate(expression: string, collapsedWidthRem: number): number {
  const trimmed = expression.trim();

  const maxArguments = callArguments(trimmed, 'max');
  if (maxArguments !== null && trimmed.startsWith('max(')) {
    return Math.max(
      ...splitArguments(maxArguments).map((part) =>
        evaluate(part, collapsedWidthRem),
      ),
    );
  }

  const calcArguments = callArguments(trimmed, 'calc');
  if (calcArguments !== null && trimmed.startsWith('calc(')) {
    return evaluate(calcArguments, collapsedWidthRem);
  }

  // Substitute every `var(--name[, fallback])` before doing arithmetic.
  let resolved = trimmed;
  for (;;) {
    const args = callArguments(resolved, 'var');
    if (args === null) break;
    const [name, ...fallback] = splitArguments(args);
    const key = name.trim();
    const value =
      key === '--mlv-sidebar-collapsed-width'
        ? collapsedWidthRem
        : fallback.length > 0
          ? evaluate(fallback.join(','), collapsedWidthRem)
          : DEFAULTS[key];
    expect(value, `no value for ${key}`).toBeTypeOf('number');
    const at = resolved.indexOf('var(');
    const end = at + 'var('.length + args.length + 1;
    resolved = `${resolved.slice(0, at)}${value}rem${resolved.slice(end)}`;
  }

  // `calc()` requires whitespace around `-`, which is also what keeps a
  // negative literal from being mistaken for a subtraction.
  const terms = resolved.split(/\s+-\s+/);
  const toRem = (term: string): number => {
    const match = /^\s*(-?[\d.]+)rem\s*$/.exec(term);
    if (!match) throw new Error(`unparsed term ${JSON.stringify(term)}`);
    return Number(match[1]);
  };
  return terms
    .slice(1)
    .reduce((total, term) => total - toRem(term), toRem(terms[0]));
}

/** The `--mlv-sidebar-icon-column-width` value emitted for `.mlv-sidebar`. */
function iconColumnDeclaration(selector: string): string {
  const at = css.indexOf(`${selector} {`);
  expect(at, `${selector} not emitted`).toBeGreaterThan(-1);
  const body = css.slice(at, css.indexOf('\n}', at));
  const match = /--mlv-sidebar-icon-column-width:([^;]+);/.exec(body);
  if (!match) throw new Error(`${selector} declares no icon column width`);
  return match[1];
}

describe('sidebar icon column contract', () => {
  const expanded = iconColumnDeclaration('.mlv-sidebar');

  it('keeps the default rail track derived from the collapsed width', () => {
    // 3.5rem rail − two 0.5rem gutters − two hairline borders.
    expect(evaluate(expanded, 3.5)).toBeCloseTo(2.375, 5);
  });

  it('follows a narrower rail rather than padding it out', () => {
    // A 3rem rail still hosts the glyph, so the track tracks it and the icon
    // does not jump as the sidebar collapses.
    expect(evaluate(expanded, 3)).toBeCloseTo(1.875, 5);
  });

  it('never collapses the expanded track below the glyph it must hold', () => {
    // `collapsedWidth="0rem"` means "hide, do not rail". The expanded rows must
    // still lay out, so the track floors instead of computing to zero.
    expect(evaluate(expanded, 0)).toBeGreaterThanOrEqual(GLYPH_REM);
  });

  it('floors a rail too narrow for the glyph', () => {
    expect(evaluate(expanded, 1)).toBeGreaterThanOrEqual(GLYPH_REM);
  });
});
