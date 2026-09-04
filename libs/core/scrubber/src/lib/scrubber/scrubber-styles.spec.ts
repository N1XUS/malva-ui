import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as Sass from 'sass';
import { describe, expect, it } from 'vitest';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';

// `sass` is a Node-only dependency; loading it through `createRequire` keeps it
// out of the browser-ish module graph vitest builds for this project.
const nodeRequire = createRequire(import.meta.url);
const sass = nodeRequire('sass') as typeof Sass;

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * The strip's geometry is entirely CSS — scroll-snap ports, list padding and
 * the centre stripe's offset are all multiples of the item size and the row
 * count. jsdom implements no layout, so `getComputedStyle` would read nothing
 * at all; these assert the compiled stylesheet instead.
 */
const css = stripCssLayersFromText(
  sass.compile(resolve(HERE, './scrubber.scss')).css,
);

/**
 * Returns the declaration block of the `nth` rule matching `selector`.
 *
 * `nth` defaults to the first. It matters because `mixins.base` emits a nested
 * `*` rule, which splits the selector's own block in two — a selector that
 * includes the mixin has its real declarations in the second block.
 */
function ruleBody(selector: string, nth = 0): string {
  const needle = `\n${selector} {`;
  let at = -1;
  for (let i = 0; i <= nth; i++) {
    at = css.indexOf(needle, at + 1);
    expect(at, `no rule #${i} for \`${selector}\``).toBeGreaterThan(-1);
  }
  const rest = css.slice(at + needle.length);
  return normalize(rest.slice(0, rest.indexOf('}')));
}

/**
 * Collapses Sass's line wrapping so the assertions pin the declaration and not
 * the emitted indentation.
 */
function normalize(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')');
}

const BLOCK = '.mlv-scrubber';
const V = `${BLOCK}--vertical`;
const H = `${BLOCK}--horizontal`;

describe('scrubber.scss — drum depth is one parameter', () => {
  it('derives the side rows from the visible-row count', () => {
    // Depth is a single knob rather than four literals: the track extent, the
    // centre stripe's offset, the snap port and the list padding are each a
    // multiple of one or the other, so setting `--mlv-scrubber-visible-rows`
    // alone moves all of them.
    expect(ruleBody(BLOCK, 1)).toContain(
      '--mlv-scrubber-side-rows: calc((var(--mlv-scrubber-visible-rows, 5) - 1) / 2)',
    );
  });

  it('takes the row count as a fallback, never as a declaration here', () => {
    // A `--mlv-scrubber-visible-rows: 5` on the block would shadow an
    // ancestor's override for every descendant — a consumer that sets 7 on a
    // wrapper (the time picker's mobile sheet does) would get a 7-row track
    // with the stripe and the snap port still at 5.
    expect(css).not.toMatch(/--mlv-scrubber-visible-rows:\s*\d/);
    expect(css).toContain('var(--mlv-scrubber-visible-rows, 5)');
  });
});

describe('scrubber.scss — vertical axis', () => {
  it('snaps on the block axis', () => {
    const body = ruleBody(`${V} ${BLOCK}__list`);
    expect(body).toContain('overflow-y: scroll');
    expect(body).toContain('scroll-snap-type: y mandatory');
  });

  it('shifts the snap port and the padding by the side rows', () => {
    // Without them, items snap to the viewport's start edge rather than to the
    // centre stripe, and the first/last item can never reach the stripe at all.
    const body = ruleBody(`${V} ${BLOCK}__list`);
    expect(body).toContain(
      'scroll-padding-block: calc(var(--mlv-scrubber-item-size, 2.25rem) * var(--mlv-scrubber-side-rows))',
    );
    expect(body).toContain(
      'padding-block: calc(var(--mlv-scrubber-item-size, 2.25rem) * var(--mlv-scrubber-side-rows))',
    );
  });

  it('sizes the track along the block axis', () => {
    expect(ruleBody(`${V} ${BLOCK}__track`)).toContain(
      'height: var(--mlv-scrubber-track-size, calc(var(--mlv-scrubber-item-size, 2.25rem) * var(--mlv-scrubber-visible-rows, 5)))',
    );
  });

  it('offsets the centre stripe down by the side rows', () => {
    // `top` is block-axis and never mirrors.
    const body = ruleBody(`${V} ${BLOCK}__track::before`);
    expect(body).toContain(
      'top: calc(var(--mlv-scrubber-item-size, 2.25rem) * var(--mlv-scrubber-side-rows))',
    );
    expect(body).toContain('height: var(--mlv-scrubber-item-size, 2.25rem)');
    expect(body).toContain('inset-inline: 0.25rem');
  });

  it('gives each item the item size along the block axis', () => {
    expect(ruleBody(`${V} ${BLOCK}__item`)).toContain(
      'height: var(--mlv-scrubber-item-size, 2.25rem)',
    );
  });
});

describe('scrubber.scss — horizontal axis', () => {
  it('snaps on the inline axis', () => {
    const body = ruleBody(`${H} ${BLOCK}__list`);
    expect(body).toContain('overflow-x: scroll');
    expect(body).toContain('scroll-snap-type: x mandatory');
    // The items have to lay out in a row before any of the rest means anything.
    expect(body).toContain('display: flex');
  });

  it('shifts the snap port and the padding on the inline axis', () => {
    // `scroll-padding-inline` / `padding-inline`, not `-left` / `-right`: they
    // are what make the stripe land on the same visual row in RTL without a
    // second rule.
    const body = ruleBody(`${H} ${BLOCK}__list`);
    expect(body).toContain(
      'scroll-padding-inline: calc(var(--mlv-scrubber-item-size, 2.25rem) * var(--mlv-scrubber-side-rows))',
    );
    expect(body).toContain(
      'padding-inline: calc(var(--mlv-scrubber-item-size, 2.25rem) * var(--mlv-scrubber-side-rows))',
    );
  });

  it('sizes the track along the inline axis', () => {
    expect(ruleBody(`${H} ${BLOCK}__track`)).toContain(
      'width: var(--mlv-scrubber-track-size, calc(var(--mlv-scrubber-item-size, 2.25rem) * var(--mlv-scrubber-visible-rows, 5)))',
    );
  });

  it('offsets the centre stripe from the inline-start edge', () => {
    const body = ruleBody(`${H} ${BLOCK}__track::before`);
    expect(body).toContain(
      'inset-inline-start: calc(var(--mlv-scrubber-item-size, 2.25rem) * var(--mlv-scrubber-side-rows))',
    );
    expect(body).toContain('width: var(--mlv-scrubber-item-size, 2.25rem)');
    expect(body).toContain('inset-block: 0.25rem');
  });

  it('gives each item the item size along the inline axis and no flex shrink', () => {
    const body = ruleBody(`${H} ${BLOCK}__item`);
    expect(body).toContain('width: var(--mlv-scrubber-item-size, 2.25rem)');
    // A flex item defaults to `flex-shrink: 1`, which would squeeze every item
    // until the whole strip fitted the track and nothing ever scrolled.
    expect(body).toContain('flex: 0 0 auto');
  });
});

describe('scrubber.scss — direction', () => {
  it('writes no physical inline-axis property', () => {
    // `.claude/rules/rtl.md`: the inline axis is logical. The only physical
    // things the strip touches are `scrollLeft` and `offsetWidth`, both in TS.
    for (const property of [
      'margin-left',
      'margin-right',
      'padding-left',
      'padding-right',
      'scroll-padding-left',
      'scroll-padding-right',
      'border-left',
      'border-right',
      'text-align: left',
      'text-align: right',
    ]) {
      expect(css, `physical \`${property}\``).not.toContain(`${property}`);
    }
    expect(css).not.toMatch(/^\s*(left|right):/m);
  });

  it('emits no direction-scoped duplicate rule', () => {
    // Every mirrored length here has a logical form, so nothing needs a
    // `[dir='rtl']` twin.
    expect(css).not.toContain("[dir='rtl']");
    expect(css).not.toContain('[dir="rtl"]');
  });

  it('keeps the fade mask symmetric on the inline axis', () => {
    // The gradient is its own mirror image (transparent → black → transparent
    // at symmetric stops), so `to right` renders identically in both
    // directions. It is the one physical keyword in the file.
    const body = ruleBody(`${H} ${BLOCK}__track`);
    expect(body).toContain(
      'mask-image: linear-gradient(to right, transparent 0%, black 25%, black 75%, transparent 100%)',
    );
  });
});
