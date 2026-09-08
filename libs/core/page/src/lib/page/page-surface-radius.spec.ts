import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as sass from 'sass';

/**
 * The anchored page canvas rounds its own top corners, and the full-bleed top
 * chrome — `mlv-page-header`, `mlv-page-summary` — carries that curve itself
 * rather than inheriting it from the host's `overflow: clip`.
 *
 * Two reasons it cannot inherit it. Only `--scroll-page` and `--scroll-content`
 * clip at all, so a `scroll="document"` page has no clip to take a curve from.
 * And clipping on `.mlv-page__inner` — the box the chrome actually sits in — is
 * not the alternative: `overflow` there would make `__inner` the nearest scroll
 * container for the sticky header, and `__inner` scrolls with the content, so
 * the header would stop sticking, while any inline-rendered overlay would be
 * cut off at the canvas edge.
 *
 * Until the chrome surface was flattened this was also *forced*: the bars
 * painted a glass surface with `backdrop-filter`, whose filtered backdrop goes
 * into a backdrop root that an ancestor's rounded overflow clip does not apply
 * to (verified in Chromium — forcing `backdrop-filter: none` on the header
 * rounded the corners, restoring the blur squared them off). The blur is gone;
 * the two reasons above are not.
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

  // The chrome carries the curve in its own stylesheet, reached by a
  // *descendant* selector so a `<form>` or `<section>` wrapper keeps it. Only a
  // first child sits on the canvas corner; chrome further down the page is
  // still full-bleed inline, and still square.
  it.each([
    ['page-header', '../page-header/page-header.scss'],
    ['page-summary', '../page-summary/page-summary.scss'],
  ])('%s rounds the canvas corner and nothing else', (block, stylesheet) => {
    const chromeCss = sass
      .compile(join(PAGE_DIR, stylesheet), { style: 'expanded' })
      .css.replace(/\s+/g, '');

    const square = `.mlv-page.mlv-${block}{`;
    const corner = `.mlv-page.mlv-${block}:first-child{`;

    expect(
      chromeCss.indexOf(square),
      `selector \`${square}\` not found`,
    ).toBeGreaterThan(-1);
    expect(declarationsOf(chromeCss, square)).toContain('border-radius:0;');

    // `:first-child` out-specifies the rule above, so the corner wins where
    // both match — and it reads the page's padding-box curve, not its own.
    expect(declarationsOf(chromeCss, corner)).toContain(
      strip(
        'border-radius: var(--mlv-page-surface-radius, 0rem) var(--mlv-page-surface-radius, 0rem) 0 0;',
      ),
    );
  });

  // The full-bleed geometry is inherited, never selected: `mlv-page-dock`
  // already worked this way, and the other two now do too.
  it.each([
    ['page-header', '../page-header/page-header.scss'],
    ['page-summary', '../page-summary/page-summary.scss'],
    ['page-dock', '../page-dock/page-dock.scss'],
  ])('%s bleeds from the inherited page inset', (block, stylesheet) => {
    const chromeCss = sass
      .compile(join(PAGE_DIR, stylesheet), { style: 'expanded' })
      .css.replace(/\s+/g, '');

    expect(chromeCss).toContain(
      strip('margin-inline: calc(-1 * var(--mlv-page-inset-inline, 0rem));'),
    );
  });

  // `maxWidth` caps the reading column, and chrome pads by the same gutter, so
  // a wide application gets full-bleed chrome and a narrow measure at once.
  it('caps the reading column rather than the canvas', () => {
    expect(css).not.toContain(strip('max-width: var(--mlv-page-max-width'));
    expect(
      declarationsOf(
        css,
        '.mlv-page__inner>:not(.mlv-page-header,.mlv-page-summary,.mlv-page-dock){',
      ),
    ).toContain(strip('max-inline-size: var(--mlv-page-max-width, none);'));
  });
});
