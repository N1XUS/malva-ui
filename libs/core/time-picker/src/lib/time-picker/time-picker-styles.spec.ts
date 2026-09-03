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
 * Returns the declaration block of the `nth` rule matching `selector`.
 *
 * `nth` defaults to the first. It matters because `mixins.base` emits its own
 * rule for the same selector ahead of the component's, so a selector that
 * includes the mixin has its real declarations in the second block.
 */
function ruleBody(css: string, selector: string, nth = 0): string {
  const needle = `\n${selector} {`;
  let at = -1;
  for (let i = 0; i <= nth; i++) {
    at = css.indexOf(needle, at + 1);
    expect(at, `no rule #${i} for \`${selector}\``).toBeGreaterThan(-1);
  }
  const rest = css.slice(at + needle.length);
  return rest.slice(0, rest.indexOf('}'));
}

/**
 * The mobile sheet's drum sizing is expressed entirely in container-query
 * units, which jsdom cannot resolve — it implements no layout, so a
 * `getComputedStyle` assertion would read the unresolved text or nothing at
 * all. These read the compiled stylesheet instead, which is where the two
 * traps that cost the most time actually live: a `flex-basis` that silently
 * zeroes every `cqh`, and a custom property that looks inherited but is not.
 */
describe('time-picker.scss — mobile full-screen sheet', () => {
  // The stylesheet ships inside `@layer mlv.components`; the assertions anchor
  // selectors to the start of a line, so the wrapper is flattened away exactly
  // as it is for the jsdom specs.
  const css = stripCssLayersFromText(
    sass.compile(resolve(HERE, './time-picker.scss')).css,
  );

  const SHEET = '.mlv-time-picker__panel--sheet';
  const COLUMNS = `${SHEET} .mlv-time-picker__columns`;

  it('lets the panel claim the sheet height instead of hugging the drum', () => {
    const body = ruleBody(css, SHEET);
    // `flex-grow` and nothing more. Measured by ablation in Chrome at 375x812:
    // `flex: none` collapses the row to 0, while `flex: 1 1 auto` and
    // `min-height: auto` both leave the drum byte-identical (719px row,
    // 143.8px item, 50.33px font) — `container-type: size` below already makes
    // the contents contribute no height, so there is nothing for a zero basis
    // or a `min-height` override to correct.
    expect(body).toContain('flex: 1');
    expect(body).not.toContain('min-height');
    // `--mlv-popover-inset` is the shared *dropdown* inset; the sheet's padding
    // comes from `.mlv-popup--fullscreen`'s own `__inner` rule.
    expect(body).toContain('padding: 0');
  });

  it('makes the drum row the size container', () => {
    // The one declaration in the block that changes the rendered result. With
    // `container-type: normal` every `cqh` resolves against the viewport
    // instead: measured 162px rows and an 812px track inside a 719px row, so
    // the drum overruns the sheet.
    const body = ruleBody(css, COLUMNS);
    expect(body).toContain('container-type: size');
    expect(body).toContain('flex: 1');
  });

  it('clips the drum when the row floor wins', () => {
    // Size containment is not paint containment. Measured by forcing the row
    // short in Chrome: at a 107px row the floored 220px track spilled 113px,
    // 57px of it above the row, and the scroll viewport clipped it — rows cut
    // at both ends and the centre stripe off-centre. Clipping here degrades to
    // fewer visible neighbours around a centred, legible selected row instead.
    expect(ruleBody(css, COLUMNS)).toContain('overflow: hidden');
  });

  it('centres the drum on the inline axis', () => {
    // Invisible in a dropdown, where the panel shrink-wraps to the columns, and
    // plain once `__inner`'s default `align-items: stretch` makes the sheet
    // panel full-width.
    expect(ruleBody(css, COLUMNS)).toContain('justify-content: center');
  });

  it('grows the rows rather than showing more of them', () => {
    const body = ruleBody(css, COLUMNS);
    // Seven rows against the desktop five — the top of the 5-7 range the drum
    // is designed for. Five would put a two-digit numeral in a 144px row at
    // 375x812; seven lands near 103px. The rows divide the container exactly
    // (7 x 100cqh/7 = 100cqh).
    expect(body).toContain('--mlv-tp-visible-rows: 7');
    expect(body).toContain(
      '--mlv-tp-item-height: max(2.75rem, calc(100cqh / 7))',
    );
    expect(body).toContain(
      '--mlv-tp-font-size: max(var(--mlv-font-size-l), 6cqh)',
    );
  });

  it('re-declares the track height on the element that overrides the item height', () => {
    // The trap: a custom property's `var()`s are substituted on the element
    // that *declares* it. `__panel`'s
    // `--mlv-tp-track-height: calc(var(--mlv-tp-item-height) * 5)` has already
    // resolved against the density value by the time it reaches this row, so
    // inheriting it would leave a 180px track around 103px rows -- 1.75 rows
    // deep -- while the rows themselves grew to fill the sheet.
    // Sass wraps the long `calc()` across lines, so compare on collapsed
    // whitespace rather than pinning the emitted indentation.
    const flat = ruleBody(css, COLUMNS).replace(/\s+/g, ' ');
    expect(flat).toContain(
      '--mlv-tp-track-height: calc( var(--mlv-tp-item-height) * var(--mlv-tp-visible-rows) )',
    );
  });
});

describe('time-picker-column.scss — drum depth is one parameter', () => {
  const css = stripCssLayersFromText(
    sass.compile(resolve(HERE, '../time-picker-column/time-picker-column.scss'))
      .css,
  );

  const COLUMN = '.mlv-time-picker-column';

  it('derives the side rows from the visible-row count', () => {
    // Before #116 the drum's depth was the literal `5` in the track height and
    // the literal `2` in three other places. Changing the depth meant finding
    // all four and keeping them consistent by hand; miss one and the centre
    // stripe stops lining up with the row that snaps to it.
    expect(ruleBody(css, COLUMN, 1)).toContain(
      '--mlv-tp-side-rows: calc((var(--mlv-tp-visible-rows, 5) - 1) / 2)',
    );
  });

  it('takes the row count as a fallback, never as a declaration here', () => {
    // A `--mlv-tp-visible-rows: 5` on this element would shadow an ancestor's
    // override for every descendant. The sheet sets 7 on
    // `.mlv-time-picker__columns`, so the track — re-declared there — would
    // have gone to 7 while the stripe and the snap port, read from this
    // element, stayed at 5. Measured before the fallback form: an 88px stripe
    // offset (2 rows) against a 7-row track.
    expect(css).not.toMatch(/--mlv-tp-visible-rows:\s*\d/);
    expect(css).toContain('var(--mlv-tp-visible-rows, 5)');
  });

  it.each([
    ['track height', `${COLUMN}__track`, '--mlv-tp-visible-rows'],
    ['centre stripe offset', `${COLUMN}__track::before`, '--mlv-tp-side-rows'],
    ['snap port and list padding', `${COLUMN}__list`, '--mlv-tp-side-rows'],
  ])('scales the %s from the row count', (_label, selector, token) => {
    // The default stays 5, so the desktop dropdown is byte-identical; the sheet
    // sets `--mlv-tp-visible-rows: 7` and all four lengths follow.
    // `__list` carries `mixins.base`, so its real block is the second one.
    const nth = selector.endsWith('__list') ? 1 : 0;
    expect(ruleBody(css, selector, nth)).toContain(token);
  });

  it('keeps no bare row-count literal behind', () => {
    // A surviving `* 5` or `* 2` would be a length that silently ignored the
    // override — the exact failure this parameterisation exists to prevent.
    const drum = css.slice(css.indexOf(`\n${COLUMN}__track {`));
    expect(drum).not.toMatch(/--mlv-tp-item-height,\s*2\.25rem\)\s*\*\s*[0-9]/);
  });
});

describe('time-picker-column.scss — font size follows the drum token', () => {
  const css = stripCssLayersFromText(
    sass.compile(resolve(HERE, '../time-picker-column/time-picker-column.scss'))
      .css,
  );

  // Both parts re-stated `--mlv-font-size-m` through `mixins.base`, which
  // shadowed `--mlv-tp-font-size` for every descendant — so the density ramp's
  // font size reached nothing and the numerals stayed at `m` at every density.
  // Loud in the sheet, where the rows grow and the digits do not.
  it.each([
    ['.mlv-time-picker-column__list'],
    ['.mlv-time-picker-column__item'],
  ])(
    '%s reads --mlv-tp-font-size with the m token as its fallback',
    (selector) => {
      const body = ruleBody(css, selector);
      expect(body).toContain(
        'font-size: var(--mlv-tp-font-size, var(--mlv-font-size-m))',
      );
    },
  );
});
