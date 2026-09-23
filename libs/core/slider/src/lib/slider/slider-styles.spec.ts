import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as Sass from 'sass';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';

// `sass` is a Node-only dependency; loading it through `createRequire` keeps it
// out of the browser-ish module graph vitest builds for this project.
const nodeRequire = createRequire(import.meta.url);
const sass = nodeRequire('sass') as typeof Sass;

const SLIDER_SCSS = resolve(
  dirname(fileURLToPath(import.meta.url)),
  './slider.scss',
);

/**
 * The horizontal slider mirrors in RTL (#308). The thumb, tooltip and tick
 * positions are bound as `inset-inline-start` (see `slider.spec.ts`), which
 * anchors each box's **inline-start** edge at the percentage — its right edge
 * in RTL. Centring it on that point therefore needs a translation whose sign
 * follows the direction, and the snap-back transition has to name the logical
 * property it animates. Measured in Chrome 153 on a 400px track at value 20:
 * thumb centre 80 in LTR and 320 in RTL, the same side as the fill.
 */
describe('slider.scss — inline-axis geometry', () => {
  const css = stripCssLayersFromText(sass.compile(SLIDER_SCSS).css);

  /**
   * Declarations of every rule whose selector list contains exactly
   * `selector`, joined — Sass emits a block once per nesting split.
   */
  function rule(selector: string): string {
    const bodies: string[] = [];
    for (const [, head, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selectors = head
        .trim()
        .split(/,\s*/)
        .map((candidate) => candidate.trim());
      if (selectors.includes(selector)) bodies.push(body);
    }
    expect(bodies.length, `rule "${selector}" is emitted`).toBeGreaterThan(0);
    return bodies.join('\n');
  }

  /** The `transform` declaration of `selector`, whitespace-collapsed. */
  function transform(selector: string): string {
    const match = /transform:\s*([^;]+);/.exec(rule(selector));
    expect(match, `${selector} declares a transform`).not.toBeNull();
    return (match?.[1] ?? '').replace(/\s+/g, ' ');
  }

  const MIRRORED_HALF = 'translate(calc(-50% * var(--mlv-inline-direction))';

  it.each([
    '.mlv-slider__thumb',
    '.mlv-slider__thumb:hover',
    '.mlv-slider__thumb:active',
    '.mlv-slider__tooltip',
    '.mlv-slider__thumb--dragging + .mlv-slider__tooltip',
  ])('centres %s with a direction-signed translation', (selector) => {
    expect(transform(selector).startsWith(MIRRORED_HALF)).toBe(true);
  });

  it('centres a tick with a direction-signed translation', () => {
    expect(transform('.mlv-slider__tick')).toBe(
      'translateX(calc(-50% * var(--mlv-inline-direction)))',
    );
  });

  it('places the horizontal fill on the logical edge, never on left', () => {
    // The fill is the half every other horizontal position aligns to: the
    // thumb, tooltip and ticks are bound as `inset-inline-start`, so a
    // physical `left` here puts the fill on the opposite side of its thumbs
    // in RTL — the #308 desync, inverted.
    const fill = rule('.mlv-slider__fill');
    expect(fill).toMatch(/inset-inline-start:\s*var\(--mlv-slider-fill-start/);
    expect(fill).not.toMatch(/(^|\s)left:/);
  });

  it.each(['.mlv-slider__fill', '.mlv-slider__thumb', '.mlv-slider__tooltip'])(
    'animates the snap-back of %s on inset-inline-start, never on left',
    (selector) => {
      const declaration = /transition:\s*([^;]+);/.exec(rule(selector));
      expect(declaration?.[1]).toMatch(/(^|,)\s*inset-inline-start\s/);
      expect(declaration?.[1]).not.toMatch(/(^|,)\s*left\s/);
    },
  );

  it('starts the vertical fill on the logical edge its horizontal rule sets', () => {
    // The base rule writes `inset-inline-start: var(--mlv-slider-fill-start)`.
    // A physical `left: 0` override only cancelled it in LTR: in RTL the
    // logical property resolved to `right` and shifted a vertical range fill
    // off its 4px track by the low value's percentage.
    const fill = rule('.mlv-slider--vertical .mlv-slider__fill');
    expect(fill).toContain('inset-inline-start: 0');
    expect(fill).not.toMatch(/(^|\s)left:/);
  });

  it('spans the horizontal ticks row with a logical inset', () => {
    // Symmetric (`inset-inline-start: 0` + `width: 100%` is the same box in
    // both directions), so it is written logically rather than as a physical
    // exception.
    const ticks = rule('.mlv-slider__ticks');
    expect(ticks).toContain('inset-inline-start: 0');
    expect(ticks).not.toMatch(/(^|\s)left:/);
  });

  it('resets the logical inset before the vertical ticks centre physically', () => {
    // In RTL the base `inset-inline-start: 0` is `right: 0`; beside
    // `left: 50%` and `width: 0` that over-constrains the box and the `left`
    // is ignored. The reset has to come first in the same rule: a logical and
    // a physical declaration of one property resolve by source order.
    const ticks = rule('.mlv-slider--vertical .mlv-slider__ticks');
    const reset = ticks.indexOf('inset-inline-start: auto');
    expect(reset).toBeGreaterThan(-1);
    expect(reset).toBeLessThan(ticks.indexOf('left: 50%'));
  });

  it('keeps the vertical orientation physical and unchanged', () => {
    expect(transform('.mlv-slider--vertical .mlv-slider__thumb')).toBe(
      'translate(-50%, 50%)',
    );
    expect(transform('.mlv-slider--vertical .mlv-slider__tick')).toBe(
      'translateY(50%)',
    );
    expect(rule('.mlv-slider--vertical .mlv-slider__thumb')).toContain(
      'left: 50%',
    );
  });
});
