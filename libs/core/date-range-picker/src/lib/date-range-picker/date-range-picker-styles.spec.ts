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
 * Measured in Chrome at 375x812 with the fix ablated: the calendars row reports
 * `scrollWidth` 577px inside a 343px panel, so 235px of the second month sits
 * past `.mlv-date-range-picker__panel`'s `overflow: hidden` edge — 29px of a
 * 264px calendar visible. No user gesture reaches it: `overflow: hidden` paints
 * no scrollbar and refuses touch panning, and the only thing that moves
 * `scrollLeft` is the browser scrolling a focused cell into view, which pushes
 * the first month out in exchange.
 *
 * 577 is what the row measures *at that width*, not what two months need. The
 * first calendar is squeezed to ~248px there by `mlv-calendar`'s
 * `width: min(100%, 19rem)`, while the second keeps its natural 264px and
 * overflows. Given room to render naturally the row needs **593px** — 32px of
 * row padding (`padding: 1rem` is four-sided, so 16px per side), two 264px
 * calendars, and the 1px rule with its 1rem margins. 593 is the figure the SCSS
 * comment and the docs quote, and it is the one that answers "how wide must the
 * panel be for two months to fit".
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

  it('hides nothing outside the sheet modifier', () => {
    // Narrower than it sounds: this proves only that no *unscoped* rule for
    // these three selectors carries `display: none`. It is not a byte-identity
    // check on the anchored dropdown — it would still pass if someone added,
    // say, `justify-content` to the unscoped `__calendars`. What it does buy
    // is the one regression that would actually break the desktop layout:
    // hiding a panel outside sheet mode.
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
