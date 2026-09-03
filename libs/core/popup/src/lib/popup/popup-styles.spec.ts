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
