import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as Sass from 'sass';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';

// `sass` is a Node-only dependency; loading it through `createRequire` keeps it
// out of the browser-ish module graph vitest builds for this project.
const nodeRequire = createRequire(import.meta.url);
const sass = nodeRequire('sass') as typeof Sass;

const POPUP_SCSS = resolve(
  dirname(fileURLToPath(import.meta.url)),
  './popup.scss',
);

/** Returns the declaration block of the first rule matching `selector`. */
function ruleBody(css: string, selector: string): string {
  const at = css.indexOf(`\n${selector} {`);
  expect(at, `no rule for \`${selector}\``).toBeGreaterThan(-1);
  const rest = css.slice(at + selector.length + 4);
  return rest.slice(0, rest.indexOf('}'));
}

/**
 * jsdom implements no layout, so nothing here can be asserted through
 * `getComputedStyle` — a percentage that resolves to `0` and one that resolves
 * to the viewport are indistinguishable to it. The compiled stylesheet is
 * where the mechanism actually lives.
 */
describe('popup.scss — full-screen sheet fill', () => {
  // The stylesheet ships inside `@layer mlv.components`; the assertions anchor
  // selectors to the start of a line, so the wrapper is flattened away exactly
  // as it is for the jsdom specs.
  const css = stripCssLayersFromText(sass.compile(POPUP_SCSS).css);

  const CONTENT =
    '.mlv-popup--fullscreen .mlv-popup__scrollbar > .mlv-scrollbar__viewport > .mlv-scrollbar__content';
  const INNER = '.mlv-popup--fullscreen .mlv-popup__inner';

  it('keeps `min-height: 100%` on the content wrapper rather than a fixed height', () => {
    // `mlv-scrollbar` owns this declaration; it is asserted here because the
    // flex fill below leans on it. `height: 100%` in its place would stop
    // content taller than the sheet from growing the wrapper, and the sheet
    // would clip instead of scroll.
    const scrollbar = stripCssLayersFromText(
      sass.compile(
        resolve(
          dirname(fileURLToPath(import.meta.url)),
          '../../../../scrollbar/src/lib/scrollbar/scrollbar.scss',
        ),
      ).css,
    );
    const body = ruleBody(scrollbar, '.mlv-scrollbar__content');
    expect(body).toContain('min-height: 100%');
    // `(?<![-\w])` so `min-height` does not match itself.
    expect(body).not.toMatch(/(?<![-\w])height:\s*100%/);
  });

  it('distributes the sheet height with flex, not with a percentage', () => {
    // `.mlv-popup__inner`'s own `min-height: 100%` never resolved here: its
    // containing block is the content wrapper, whose height is content-derived,
    // and a percentage min-height against an indefinite containing block
    // computes to `0`. Measured in a browser at 375x812 — `__inner` was 32px
    // inside a 751px viewport, which is why fixed-size sheet content sat in the
    // top corner with the rest of the sheet blank.
    expect(ruleBody(css, CONTENT)).toContain('display: flex');
    expect(ruleBody(css, CONTENT)).toContain('flex-direction: column');
    expect(ruleBody(css, INNER)).toContain('flex: 1 1 auto');
  });

  it('insets the sheet body by default', () => {
    // The inset is shared chrome, not an accident: `mlv-day-picker__popup--sheet`,
    // `mlv-time-picker__panel--sheet` and `mlv-date-range-picker__panel--sheet`
    // each write a `padding: 0` of their own *because* this rule pads for them.
    // Dropping it would leave `mlv-select` / `mlv-combobox` (whose only inset is
    // the 4px `--mlv-popover-inset` on the list) and the docs preferences popup
    // with a body flush against a header that is still padded — so it stays,
    // and a full-bleed block reaches for the opt-out below instead.
    expect(ruleBody(css, INNER)).toContain('padding: var(--mlv-spacing-4)');
  });

  it('lets a full-bleed projected block opt out of that inset', () => {
    // `mlv-calendar-sheet` owns its own inline spacing (a padded weekday strip,
    // a padded month label, `padding-inline` on every week row), so the shared
    // inset doubled up and left the grid floating inside a header that spans
    // the whole sheet width. The two date pickers pass `mlv-popup--flush`.
    const body = ruleBody(
      css,
      '.mlv-popup--fullscreen.mlv-popup--flush .mlv-popup__inner',
    );
    expect(body).toContain('padding: 0');
  });

  it('pushes the header actions to the trailing edge', () => {
    // The title takes the leading edge and the close button claims the free
    // space with its own `margin-inline-start: auto`. Without this the actions
    // wrapper would sit flush against the title and the close button would fly
    // off on its own; with it, the pair travels together as one trailing group.
    // Logical, so it mirrors under RTL for free (`.claude/rules/rtl.md`).
    const body = ruleBody(css, '.mlv-popup__header-actions');
    expect(body).toContain('margin-inline-start: auto');
  });

  it('drops the close button’s own auto margin once actions precede it', () => {
    // Two `auto` margins on the inline axis split the free space between them,
    // which would leave a gap between Done and the dismiss button rather than
    // the `gap`-sized one the header row asks for.
    const body = ruleBody(
      css,
      '.mlv-popup__header-actions + .mlv-popup__close',
    );
    expect(body).toContain('margin-inline-start: 0');
  });

  it('scopes the fill to the full-screen sheet', () => {
    // A trigger-anchored popup shrink-wraps to its content and must keep doing
    // so; every consumer that never goes full-screen (and `mlv-filter`, which
    // does not at any width) has to be byte-identical.
    const anchored = ruleBody(css, '.mlv-popup__inner');
    expect(anchored).not.toContain('flex: 1 1 auto');
    expect(css).not.toContain(
      '\n.mlv-popup__scrollbar > .mlv-scrollbar__viewport > .mlv-scrollbar__content {',
    );
  });
});

/**
 * Returns the declaration block of the first rule whose comma-separated
 * selector list contains `selector`. The arrow rules compile to grouped
 * selectors (`…--arrow-start.…--arrow-top::before, …--arrow-start.…--arrow-bottom::before`),
 * which `ruleBody`'s line anchor cannot address.
 */
function groupedRuleBody(css: string, selector: string): string {
  // `popup.scss` contains no at-rules, so after the layer wrapper is stripped
  // every `{ … }` is a flat rule and splitting on braces is unambiguous.
  for (const chunk of css.split('}')) {
    const brace = chunk.indexOf('{');
    if (brace === -1) continue;
    const selectors = chunk
      .slice(0, brace)
      .split(',')
      .map((part) => part.trim());
    if (selectors.includes(selector)) return chunk.slice(brace + 1);
  }
  expect.fail(`no rule whose selector list contains \`${selector}\``);
}

/**
 * The arrow glyph is physical, and deliberately so (#163).
 *
 * `MlvPopup.arrowEdge` / `arrowAlign` are resolved to **physical** values in
 * `updateArrowFromPosition`, which converts the logical `ConnectedPosition`
 * pair CDK applied against the pane's own direction. `.claude/rules/rtl.md`
 * names the collision-resolved overlay arrow as an allowed physical exception
 * for exactly this reason: CDK picks the actual physical side after flipping,
 * and the arrow follows that side rather than the requested one.
 *
 * A logical declaration here would mirror a *second* time, on top of the
 * conversion — and the glyph is a square rotated a physical `45deg`, so which
 * two of its borders are dropped is a physical decision that no logical
 * property can express.
 */
describe('popup.scss — arrow glyph is physical', () => {
  const css = stripCssLayersFromText(sass.compile(POPUP_SCSS).css);

  it('drops the two borders facing away from the tip physically', () => {
    // `rotate(45deg)` sends the top-left corner straight up, so an upward tip
    // keeps the top and left borders. Under a logical `border-inline-end`, an
    // RTL pane would drop the *left* border instead and the glyph would point
    // sideways — the panel would grow a wedge on its corner, not a tip.
    expect(ruleBody(css, '.mlv-popup--arrow-top::before')).toContain(
      'border-right: none',
    );
    expect(ruleBody(css, '.mlv-popup--arrow-bottom::before')).toContain(
      'border-left: none',
    );
    expect(ruleBody(css, '.mlv-popup--arrow-left::before')).toContain(
      'border-right: none',
    );
    expect(ruleBody(css, '.mlv-popup--arrow-right::before')).toContain(
      'border-left: none',
    );
  });

  it('uses no logical border anywhere in the stylesheet', () => {
    // The four declarations above are the only `border-inline-*` the file ever
    // had; asserting their absence outright keeps a new one from creeping back.
    expect(css).not.toContain('border-inline');
  });

  it('offsets the side arrows from the physical edge they name', () => {
    expect(ruleBody(css, '.mlv-popup--arrow-left::before')).toContain(
      'left: -0.4375rem',
    );
    expect(ruleBody(css, '.mlv-popup--arrow-right::before')).toContain(
      'right: -0.4375rem',
    );
  });

  it('offsets `--arrow-start` / `--arrow-end` from the physical left / right', () => {
    // `arrowAlign` is physical too: a `bottom-start` popup in RTL resolves to
    // `'end'`, so the arrow lands 1rem from the right — over the trigger, which
    // an RTL `overlayX: 'start'` pins to the panel's right edge.
    expect(
      groupedRuleBody(
        css,
        '.mlv-popup--arrow-start.mlv-popup--arrow-top::before',
      ),
    ).toContain('left: 1rem');
    expect(
      groupedRuleBody(
        css,
        '.mlv-popup--arrow-end.mlv-popup--arrow-top::before',
      ),
    ).toContain('right: 1rem');
  });

  it('centres the top/bottom arrow with a physical margin', () => {
    // `left: 50%` + a negative start margin is a centring pair. `margin-inline-start`
    // resolves to `margin-right` in an RTL pane, and for an absolutely positioned
    // box with `left` set and `right: auto` the end margin moves nothing — the
    // glyph would sit 6px off centre rather than under the trigger's middle.
    const body = groupedRuleBody(
      css,
      '.mlv-popup--arrow-center.mlv-popup--arrow-top::before',
    );
    expect(body).toContain('left: 50%');
    expect(body).toContain('margin-left: -0.375rem');
    expect(body).not.toContain('margin-inline-start');
  });
});
