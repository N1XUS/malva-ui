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

const SHEET_SCSS = resolve(
  dirname(fileURLToPath(import.meta.url)),
  './calendar-sheet.scss',
);

/**
 * Every declaration `selector` carries at the top level of the stylesheet.
 *
 * Sass splits one authored block into several emitted rules whenever a nested
 * rule sits between declarations — `mixins.base()` contributes one such split —
 * so the count is not meaningful and the bodies are concatenated. Rules nested
 * inside an at-rule (the `prefers-reduced-motion` block also names the element)
 * are excluded: they are a different condition, not this rule.
 */
function ruleBody(css: string, selector: string): string {
  const bodies: string[] = [];
  postcss.parse(css).walkRules((rule) => {
    if (rule.parent?.type !== 'root') return;
    const matches = rule.selectors.some((s) => s.trim() === selector);
    if (matches) bodies.push(rule.nodes.map((n) => n.toString()).join(';\n'));
  });
  expect(bodies.length, `no rule for \`${selector}\``).toBeGreaterThan(0);
  return bodies.join(';\n');
}

/**
 * jsdom implements no layout and no scroll anchoring, so none of this can be
 * asserted against a rendered sheet — the compiled stylesheet is where these
 * mechanisms actually live. The behavioural half is in
 * `calendar-sheet-scroll.spec.ts`, which stubs the metrics instead.
 */
describe('calendar-sheet.scss', () => {
  // The stylesheet ships inside `@layer mlv.components`; jsdom cannot parse
  // `@layer` and drops the whole sheet, so it is flattened away here exactly as
  // `setup-strip-css-layers.js` does for the rendered specs.
  const css = stripCssLayersFromText(sass.compile(SHEET_SCSS).css);

  const BLOCK = '.mlv-calendar-sheet';
  const MONTHS = '.mlv-calendar-sheet__months';

  it('turns off browser scroll anchoring on the month list', () => {
    // `_growLeading` measures the height the prepended months added and pushes
    // the offset down by exactly that, so the month the user is looking at
    // holds still. Browser scroll anchoring corrects for the same insertion, so
    // left on, the two corrections stack and the list jumps by a month.
    expect(ruleBody(css, MONTHS)).toContain('overflow-anchor: none');
  });

  it('makes the month list the only scroller', () => {
    const months = ruleBody(css, MONTHS);
    expect(months).toContain('overflow-y: auto');
    // The strip and the weekday header are fixed chrome; the list takes the
    // rest and may shrink below its content, which is what gives it something
    // to scroll instead of growing the sheet past the viewport.
    expect(months).toContain('flex: 1 1 auto');
    expect(months).toContain('min-height: 0');
    for (const region of [
      '.mlv-calendar-sheet__years',
      '.mlv-calendar-sheet__weekdays',
    ]) {
      expect(ruleBody(css, region), region).toContain('flex: 0 0 auto');
    }
  });

  it('positions month sections against the scroller', () => {
    // `_scrollToMonth` and `_syncYearFromScroll` both read a section's
    // `offsetTop` as a scroll offset directly, which only holds while the
    // scroller is the sections' offset parent.
    expect(ruleBody(css, MONTHS)).toContain('position: relative');
  });

  it('is a three-region column that fills whatever height it is given', () => {
    const block = ruleBody(css, BLOCK);
    expect(block).toContain('display: flex');
    expect(block).toContain('flex-direction: column');
    // The standalone default; a consumer that places it in a flex column hands
    // it `flex: 1 1 0` instead (see the pickers' stylesheets).
    expect(block).toContain('height: 100%');
    expect(block).toContain('min-height: 0');
  });

  it('ships a reduced-motion path', () => {
    const reduced = css.slice(
      css.indexOf('@media (prefers-reduced-motion: reduce)'),
    );
    expect(reduced, 'no reduced-motion block emitted').not.toBe('');
    expect(reduced).toContain(BLOCK);
  });

  it('adds no physical inline-axis declaration', () => {
    // `.claude/rules/rtl.md`: the sheet mirrors for free because every
    // inline-axis declaration is logical. This fails the moment someone reaches
    // for `margin-left`, `left`, `text-align: right` or a physical float.
    expect(css).not.toMatch(
      /(margin|padding|border|inset)-(left|right)\s*:|(^|\s)(left|right)\s*:|text-align:\s*(left|right)|float:\s*(left|right)|clear:\s*(left|right)/m,
    );
  });
});
