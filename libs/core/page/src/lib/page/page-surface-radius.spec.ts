import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as sass from 'sass';

/**
 * The anchored page canvas rounds its own top corners, and `overflow: clip` on
 * the host is expected to clip everything inside it to that curve. It does not
 * reach one thing: `mlv-page-header` (and `mlv-page-summary`) paint a glass
 * surface with `backdrop-filter`, whose filtered backdrop goes into a backdrop
 * root that an ancestor's *rounded* overflow clip does not apply to. Verified
 * in Chromium: with `backdrop-filter: none` forced on the header the corners
 * round correctly; with the blur restored the header squares them off.
 *
 * The full-bleed top chrome therefore has to carry the page's own inner corner
 * radius itself. It cannot be fixed by clipping on `.mlv-page__inner`:
 * `overflow` there would make `__inner` the nearest scroll container for the
 * sticky header, and `__inner` scrolls with the content, so the header would
 * stop sticking — and any inline-rendered overlay would be cut off at the
 * canvas edge.
 *
 * Component styles are not injected into the DOM under the vitest/jsdom setup,
 * so the compiled stylesheet is the observable surface here.
 */

const PAGE_DIR = dirname(fileURLToPath(import.meta.url));

/** Whitespace-stripped, matching how the compiled CSS is normalised below. */
function strip(value: string): string {
  return value.replace(/\s+/g, '');
}

/**
 * Declarations of the rule whose selector list contains `selector`. Sass emits
 * grouped selectors as one list, so an exact `<selector>{` lookup would miss a
 * rule that legitimately covers several selectors.
 */
function declarationsOf(css: string, selector: string): string {
  const index = css.indexOf(selector);
  if (index === -1) return '';

  const open = css.indexOf('{', index);
  return open === -1 ? '' : css.slice(open + 1, css.indexOf('}', open));
}

describe('page surface radius', () => {
  const css = sass
    .compile(join(PAGE_DIR, 'page.scss'), { style: 'expanded' })
    .css.replace(/\s+/g, '');

  it('publishes a zero surface radius by default', () => {
    // `mixins.base()` emits a nested `.mlv-page *` rule, so the block is split
    // and a plain `.mlv-page{` lookup lands on the mixin's half. Anchor on a
    // declaration that is unique to the block carrying the block-level tokens.
    const open = css.lastIndexOf('{', css.indexOf('isolation:isolate;'));

    expect(css.slice(open + 1, css.indexOf('}', open))).toContain(
      '--mlv-page-surface-radius:0rem;',
    );
  });

  it('derives the anchored surface radius from the border-box radius minus the border', () => {
    const declarations = declarationsOf(css, '.mlv-page--surface-anchored{');

    expect(declarations).toContain(
      strip('border-radius: var(--mlv-radius-xl) var(--mlv-radius-xl) 0 0;'),
    );
    // The host rounds its *border* box; the full-bleed chrome occupies the
    // padding box, whose curve is one border width tighter.
    expect(declarations).toContain(
      strip(
        '--mlv-page-surface-radius: calc(var(--mlv-radius-xl) - 0.0625rem);',
      ),
    );
  });

  it('resets the surface radius on a flat surface', () => {
    expect(declarationsOf(css, '.mlv-page--surface-flat{')).toContain(
      '--mlv-page-surface-radius:0rem;',
    );
  });

  // Only a *first* child sits on the canvas corner. A header further down the
  // page is still full-bleed inline, but rounding its top there would be wrong.
  it.each(['.mlv-page-header', '.mlv-page-summary'])(
    'rounds the top corners of a full-bleed first-child %s',
    (chrome) => {
      const selector = `.mlv-page__inner>${chrome}:first-child`;

      expect(
        css.indexOf(selector),
        `selector \`${selector}\` not found`,
      ).toBeGreaterThan(-1);
      expect(declarationsOf(css, selector)).toContain(
        strip(
          'border-radius: var(--mlv-page-surface-radius, 0rem) var(--mlv-page-surface-radius, 0rem) 0 0;',
        ),
      );
    },
  );

  // A header that is not the first child is still full-bleed inline, so its
  // standalone top radius has to stay flattened — only the canvas corner earns
  // a curve, and the `:first-child` rule out-specifies this one.
  it('keeps flattening a full-bleed header that is not on the canvas corner', () => {
    expect(declarationsOf(css, '.mlv-page__inner>.mlv-page-header{')).toContain(
      'border-radius:0;',
    );
  });
});
