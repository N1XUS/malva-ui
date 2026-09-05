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
 * jsdom implements no layout, so the geometry this file guards cannot be
 * asserted against a rendered component — `getBoundingClientRect()` reads 0 and
 * `getComputedStyle` resolves no percentage. The compiled stylesheet is where
 * the behaviour actually lives, so these read that.
 *
 * ### What changed at #130
 *
 * #121 shipped a stopgap here: `display: none` on `__calendar--end` and
 * `__divider`, plus `justify-content: center` on the surviving row, because two
 * 264px calendars need 593px of inline space and the sheet is the one place the
 * panel is capped at the viewport. #130 replaced the sheet body with
 * `mlv-calendar-sheet`, so there is no second month to hide, no divider to drop
 * and no row to centre — the whole stopgap is gone, and the specs that pinned
 * it went with it.
 *
 * What remains is the fill: the sheet is a three-region column whose middle
 * region scrolls, so it has to claim the sheet's leftover height. Every
 * percentage in this chain is inert — `.mlv-popup__inner`'s own
 * `min-height: 100%` never resolves, because its containing block's height is
 * content-derived (popup.scss § `--fullscreen`, measured at #116) — so the fill
 * is flex, exactly as `mlv-time-picker__panel--sheet` does it.
 */
describe('date-range-picker.scss — mobile full-screen sheet (#130)', () => {
  // The stylesheet ships inside `@layer mlv.components`; jsdom cannot parse
  // `@layer` and drops the whole sheet, so it is flattened away here exactly as
  // `setup-strip-css-layers.js` does for the rendered specs.
  const css = stripCssLayersFromText(
    sass.compile(resolve(HERE, './date-range-picker.scss')).css,
  );

  const SHEET = '.mlv-date-range-picker__panel--sheet';

  it('claims the leftover sheet height with a length flex basis', () => {
    // `flex: 1 1 0`, never `height: 100%` and never the `flex: 1` shorthand:
    // both are percentages against an ancestor chain with no definite height,
    // so both leave the panel content-sized and the sheet top-anchored with the
    // rest of the viewport blank — the exact #116 symptom.
    const body = ruleBody(css, SHEET);
    expect(body).toMatch(/flex:\s*1\s+1\s+0(?!%)/);
    expect(body).not.toMatch(/height:\s*100%/);
  });

  it('lets the month scroller shrink below its content', () => {
    // Without this the column's `auto` minimum size floors the panel at the
    // full height of every rendered month, so the sheet grows past the viewport
    // and the inner `overflow-y: auto` never has anything to scroll.
    expect(ruleBody(css, SHEET)).toContain('min-height: 0');
  });

  it('passes the same pair down to the sheet body', () => {
    // `__panel` is the column flex container, so the sheet is a flex item in it
    // and needs its own basis and floor for the fill to reach the scroller.
    const body = ruleBody(css, `${SHEET} .mlv-calendar-sheet`);
    expect(body).toMatch(/flex:\s*1\s+1\s+0(?!%)/);
    expect(body).toContain('min-height: 0');
  });

  it('hides nothing, in the sheet or out of it', () => {
    // #121's `display: none` is gone whole. This is the regression guard on
    // that removal: neither mode may reach for hiding a panel again — the sheet
    // renders a different body instead of the same one with parts blanked out.
    for (const selector of [
      '.mlv-date-range-picker__divider',
      '.mlv-date-range-picker__calendars',
      '.mlv-date-range-picker__calendar',
      '.mlv-date-range-picker__calendar--end',
      `${SHEET} .mlv-date-range-picker__divider`,
      `${SHEET} .mlv-date-range-picker__calendars`,
      `${SHEET} .mlv-date-range-picker__calendar--end`,
    ]) {
      for (const body of rulesFor(css, selector)) {
        expect(body, `rule for \`${selector}\``).not.toContain('display: none');
      }
    }
  });

  it('adds no physical inline-axis declaration', () => {
    // `.claude/rules/rtl.md`: `display: none` and `justify-content: center` are
    // both direction-agnostic, so the sheet mirrors for free. This fails the
    // moment someone reaches for a *physical* nudge — `margin-left`, `left`,
    // `text-align: right`. It deliberately does NOT flag `inset-inline-start`
    // or `float: inline-start`: those are the approved logical forms. It also
    // `float: left` / `clear: left` are caught by their own arms below.
    const sheetRules = css
      .split(/(?=\n\.)/)
      .filter((chunk) => chunk.includes(SHEET))
      .join('\n');
    expect(sheetRules).not.toMatch(
      /(margin|padding|border|inset)-(left|right)\s*:|(^|\s)(left|right)\s*:|text-align:\s*(left|right)|float:\s*(left|right)|clear:\s*(left|right)/m,
    );
  });
});
