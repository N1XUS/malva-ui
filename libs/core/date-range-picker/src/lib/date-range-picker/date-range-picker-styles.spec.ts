import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as Sass from 'sass';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';

// `sass` is a Node-only dependency; loading it through `createRequire` keeps it
// out of the browser-ish module graph vitest builds for this project.
const nodeRequire = createRequire(import.meta.url);
const sass = nodeRequire('sass') as typeof Sass;

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Every declaration block whose selector list contains `selector` exactly.
 *
 * A plain `indexOf('\n<selector> {')` scan cannot see a selector that shares a
 * rule with another one — `display: none` here is written once for the end
 * calendar and the divider together — so the selector list is split and
 * compared instead.
 */
function rulesFor(css: string, selector: string): string[] {
  const bodies: string[] = [];
  // The prelude is "everything since the last brace", so no `}` is consumed
  // between rules — a pattern that anchors on the previous rule's closing brace
  // silently matches only every other rule. The stylesheet is flat once the
  // `@layer` wrapper is stripped, so an at-rule prelude is a non-match, not a
  // nesting problem.
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = rule.exec(css)) !== null) {
    if (match[1].includes('@')) continue;
    const selectors = match[1].split(',').map((s) => s.trim());
    if (selectors.includes(selector)) bodies.push(match[2]);
  }
  return bodies;
}

/** The single declaration block for `selector`, asserted to exist exactly once. */
function ruleBody(css: string, selector: string): string {
  const bodies = rulesFor(css, selector);
  expect(bodies.length, `rule count for \`${selector}\``).toBe(1);
  return bodies[0];
}

/**
 * jsdom implements no layout, so the clipping this file guards cannot be
 * asserted against a rendered component — `getBoundingClientRect()` reads 0.
 * The compiled stylesheet is where the fix actually lives, so these read that.
 *
 * Measured in Chrome at 375x812 before the fix: the calendars row needs 577px
 * of inline space (16px row padding + 264px calendar + 33px rule and margins +
 * 264px calendar) inside a 341px panel, so 236px of the second month sat past
 * `.mlv-date-range-picker__panel`'s `overflow: hidden` edge — 29px of a 264px
 * panel visible. No user gesture reaches it: `overflow: hidden` paints no
 * scrollbar and refuses touch panning, and the only thing that moves
 * `scrollLeft` is the browser scrolling a focused cell into view, which pushes
 * the first month out in exchange.
 */
describe('date-range-picker.scss — mobile full-screen sheet (#121)', () => {
  // The stylesheet ships inside `@layer mlv.components`; jsdom cannot parse
  // `@layer` and drops the whole sheet, so it is flattened away here exactly as
  // `setup-strip-css-layers.js` does for the rendered specs.
  const css = stripCssLayersFromText(
    sass.compile(resolve(HERE, './date-range-picker.scss')).css,
  );

  const SHEET = '.mlv-date-range-picker__panel--sheet';

  it('drops the second month in the sheet', () => {
    // The whole fix. In an anchored dropdown the CDK pane is sized to the
    // row's 593px of content and both months fit at every viewport width; only
    // the sheet caps the panel at the viewport, and below roughly 612px the
    // second month goes past the clip edge.
    const body = ruleBody(
      css,
      `${SHEET} .mlv-date-range-picker__calendar--end`,
    );
    expect(body).toContain('display: none');
  });

  it('drops the rule between the two months with it', () => {
    // A 1px vertical rule with 1rem of margin on each side, left behind next to
    // a single month, reads as a stray divider at the panel's inline-end edge.
    const body = ruleBody(css, `${SHEET} .mlv-date-range-picker__divider`);
    expect(body).toContain('display: none');
  });

  it('centres the surviving month in the sheet', () => {
    // Invisible in a dropdown, where the panel shrink-wraps to the row, and
    // plain once `.mlv-popup__inner`'s `align-items: stretch` makes the sheet
    // panel full-width: the row's default `justify-content: flex-start` would
    // leave the 264px calendar against the inline-start edge with the leftover
    // 47px dead at the other end.
    const body = ruleBody(css, `${SHEET} .mlv-date-range-picker__calendars`);
    expect(body).toContain('justify-content: center');
  });

  it('leaves the anchored dropdown byte-identical', () => {
    // Every declaration is scoped under `--sheet`. The desktop two-panel layout
    // is not a responsive tweak away from the sheet — it is untouched, which is
    // what keeps this fix removable when #130 replaces the sheet body.
    for (const selector of [
      '.mlv-date-range-picker__divider',
      '.mlv-date-range-picker__calendars',
      '.mlv-date-range-picker__calendar',
    ]) {
      for (const body of rulesFor(css, selector)) {
        expect(body, `unscoped rule for \`${selector}\``).not.toContain(
          'display: none',
        );
      }
    }
  });

  it('adds no physical inline-axis declaration', () => {
    // `.claude/rules/rtl.md`: `display: none` and `justify-content: center` are
    // both direction-agnostic, so the sheet mirrors for free. This fails the
    // moment someone reaches for `margin-left` or `inset-inline-start`-by-hand
    // to nudge the surviving month.
    const sheetRules = css
      .split(/(?=\n\.)/)
      .filter((chunk) => chunk.includes(SHEET))
      .join('\n');
    expect(sheetRules).not.toMatch(
      /(margin|padding|border|inset)-(left|right)\s*:|(^|\s)(left|right)\s*:|text-align:\s*(left|right)/m,
    );
  });
});
