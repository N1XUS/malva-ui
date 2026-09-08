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
const ACTION_BAR_SCSS = resolve(HERE, './action-bar.scss');
const LOGO_SCSS = resolve(HERE, './components/action-bar-logo.scss');

/**
 * Returns the declaration block of the `nth` rule whose selector list contains
 * `selector`. `nth` matters for `.mlv-action-bar` itself: `mixins.base()` is
 * `@at-root`ed, so it emits a `.mlv-action-bar` rule of its own ahead of the
 * component's.
 */
function ruleFor(css: string, selector: string, nth = 0): string {
  const open = css.indexOf('{', indexOfRule(css, selector, nth));
  return css.slice(open + 1, css.indexOf('}', open));
}

/** Character offset of the `nth` occurrence of `selector`, asserted present. */
function indexOfRule(css: string, selector: string, nth = 0): number {
  let at = -1;
  for (let i = 0; i <= nth; i++) {
    at = css.indexOf(selector, at + 1);
    expect(
      at,
      `selector not found (occurrence ${i}): ${selector}`,
    ).toBeGreaterThan(-1);
  }
  return at;
}

describe('action-bar.scss density', () => {
  // The stylesheet ships inside `@layer mlv.components`; flattening the layer
  // keeps the assertions below anchored the same way the jsdom specs are.
  const css = stripCssLayersFromText(sass.compile(ACTION_BAR_SCSS).css);

  it('keeps the comfortable defaults on the base block', () => {
    const rule = ruleFor(css, '\n.mlv-action-bar {', 1);
    expect(rule).toContain('gap: var(--mlv-spacing-1)');
    expect(rule).toContain('padding: var(--mlv-spacing-3)');
  });

  it.each([
    ['--tight', 'var(--mlv-spacing-1)'],
    ['--compact', 'var(--mlv-spacing-2)'],
    ['--spacious', 'var(--mlv-spacing-4)'],
    ['--airy', 'var(--mlv-spacing-5)'],
  ])('scales the default-shape padding at %s', (modifier, padding) => {
    const rule = ruleFor(css, `.mlv-action-bar[class*="${modifier}"]`);
    expect(rule).toContain(`padding: ${padding}`);
  });

  it.each([
    ['--tight', 'var(--mlv-spacing-0-5)'],
    ['--spacious', 'var(--mlv-spacing-2)'],
    ['--airy', 'var(--mlv-spacing-3)'],
  ])('scales the control gap at %s, for every shape', (modifier, gap) => {
    const rule = ruleFor(css, `.mlv-action-bar[class*="${modifier}"]`);
    expect(rule).toContain(`gap: ${gap}`);
  });

  it('leaves the pill to inherit the shape-agnostic gap', () => {
    const rule = ruleFor(css, '\n.mlv-action-bar--shape-pill {');
    expect(rule).not.toContain('gap:');
  });

  it('emits the ancestor branch so a density region reaches the bar', () => {
    expect(css).toContain('[class*="--compact"] .mlv-action-bar:not(');
  });

  it.each(['--tight', '--compact', '--spacious', '--airy'])(
    'emits the pill padding after the default-shape padding at %s',
    (modifier) => {
      // The two padding scales are disjoint by **order**, not by specificity:
      // both land at (0,2,0) on the self branch, and `padding-block` /
      // `padding-inline` cascade against the `padding` shorthand as one
      // declaration per side, so the later rule replaces all four sides.
      //
      // This is what the deleted `:not(.mlv-action-bar--shape-pill)` claimed to
      // be doing and never was — the pill was never the (0,1,0) rule the old
      // comment described, and ablating the `:not()` in Chromium moved no pixel
      // at any of the five steps. Order is the real mechanism, so order is what
      // gets pinned: swap the two blocks in the file and this goes red.
      expect(
        indexOfRule(css, `.mlv-action-bar--shape-pill[class*="${modifier}"]`),
      ).toBeGreaterThan(
        indexOfRule(css, `.mlv-action-bar[class*="${modifier}"]`),
      );
    },
  );

  it('expresses the pill padding on the logical axes', () => {
    const rule = ruleFor(css, '\n.mlv-action-bar--shape-pill {');
    expect(rule).toContain('padding-block: var(--mlv-spacing-1-5)');
    expect(rule).toContain(
      'padding-inline: var(--mlv-spacing-3) var(--mlv-spacing-2)',
    );
    // The old physical four-value shorthand put the wider side on `left`,
    // which does not mirror in RTL.
    //
    // Asserted on the text and nowhere else, deliberately. `padding-inline` is
    // native logical CSS: there is no JS mechanism to ablate, jsdom's `cssstyle`
    // implements neither `padding-inline` nor `padding-inline-start` (both read
    // back `''`), and a `dir="rtl"` spec in this environment would therefore
    // assert nothing at all. It was verified instead in Chromium, where the
    // comfortable pill measures 6/8/6/12 in LTR and 6/12/6/8 in RTL — the wide
    // side following the leading edge, which is the whole point of the change.
    expect(rule).not.toContain('padding: 0.375rem');
  });

  it.each([
    ['--tight', 'var(--mlv-spacing-0-5)'],
    ['--compact', 'var(--mlv-spacing-1)'],
    ['--spacious', 'var(--mlv-spacing-2)'],
    ['--airy', 'var(--mlv-spacing-3)'],
  ])('scales the pill padding at %s', (modifier, paddingBlock) => {
    const rule = ruleFor(
      css,
      `.mlv-action-bar--shape-pill[class*="${modifier}"]`,
    );
    expect(rule).toContain(`padding-block: ${paddingBlock}`);
    expect(rule).toContain('padding-inline:');
  });

  it('keeps symmetric insets on the logical axis', () => {
    // `left: 0; right: 0` is direction-agnostic but still physical; the one
    // physical pair left in the file is the pill's `left: 50%` centering, which
    // carries its `// physical:` reason in the source.
    for (const modifier of ['--pos-top', '--pos-bottom']) {
      const rule = ruleFor(css, `.mlv-action-bar${modifier} {`);
      expect(rule).toContain('inset-inline: 0');
      expect(rule).not.toMatch(/\bleft:/);
      expect(rule).not.toMatch(/\bright:/);
    }
  });
});

describe('action-bar.scss animation opt-out', () => {
  const css = stripCssLayersFromText(sass.compile(ACTION_BAR_SCSS).css);

  // Why the opt-out is CSS and not a value on the binding: `animate.enter` in
  // the `host` object is a **static attribute**, and Angular's
  // `parseHostBindings` stores those as `literal(value)` — there is no
  // interpolation and no expression, so the class list Angular applies on
  // insertion cannot be made conditional from TypeScript. (`[animate.enter]`
  // is a different feature: it compiles to `ɵɵanimateEnterListener`, which
  // *calls* the value as an animation callback rather than reading classes off
  // it.) So the class still arrives and the keyframes are cancelled instead.
  it.each(['enter', 'leave'])('cancels the %s keyframes', (phase) => {
    const rule = ruleFor(
      css,
      `.mlv-action-bar--no-animation.mlv-action-bar--${phase}`,
    );
    expect(rule).toContain('animation: none');
  });

  // Not belt-and-braces. Angular asks the element how long the enter animation
  // lasts on the frame after it adds the class, and with no running animation
  // it reads the *computed styles*: `animation-duration` first, then
  // `transition-duration`. `.mlv-action-bar` declares a 0.1s colour transition,
  // so cancelling the keyframes alone still answers "0.1s" — the enter class
  // then stays on the host for good (measured in Chromium: still present two
  // frames after a routed navigation, with its `animationstart` /
  // `transitionstart` listeners retained), and a leaving bar is held in the DOM
  // for `duration + 50ms` waiting for a `transitionend` that never comes.
  it.each(['enter', 'leave'])(
    'cancels the %s transition fallback as well',
    (phase) => {
      const rule = ruleFor(
        css,
        `.mlv-action-bar--no-animation.mlv-action-bar--${phase}`,
      );
      expect(rule).toContain('transition: none');
    },
  );

  it.each(['enter', 'leave'])(
    'emits the opt-out after the %s animation it cancels',
    (phase) => {
      // Disjoint by order, not specificity: `--no-animation.--enter` and
      // `--pos-bottom.--enter` are both (0,2,0), and the bottom-anchored bar
      // carries all three classes at once. Move the opt-out above them in the
      // file and a `position="bottom"` bar animates again.
      expect(
        indexOfRule(
          css,
          `.mlv-action-bar--no-animation.mlv-action-bar--${phase}`,
        ),
      ).toBeGreaterThan(
        indexOfRule(
          css,
          `.mlv-action-bar--pos-bottom.mlv-action-bar--${phase}`,
        ),
      );
    },
  );
});

describe('action-bar.scss → logo custom properties', () => {
  const css = stripCssLayersFromText(sass.compile(ACTION_BAR_SCSS).css);

  it('declares the comfortable logo ramp on the base block', () => {
    const rule = ruleFor(css, '\n.mlv-action-bar {', 1);
    expect(rule).toContain('--mlv-action-bar-logo-gap: var(--mlv-spacing-2)');
    expect(rule).toContain(
      '--mlv-action-bar-logo-font-size: var(--mlv-font-size-l)',
    );
  });

  it.each([
    ['--tight', 'var(--mlv-spacing-1)', 'var(--mlv-font-size-s)'],
    ['--compact', 'var(--mlv-spacing-1-5)', 'var(--mlv-font-size-m)'],
    ['--spacious', 'var(--mlv-spacing-2-5)', 'var(--mlv-font-size-xl)'],
    ['--airy', 'var(--mlv-spacing-3)', 'var(--mlv-font-size-2xl)'],
  ])('moves the logo ramp with the bar at %s', (modifier, gap, fontSize) => {
    // On the **bar**, not on the logo: the logo carries no density modifier
    // of its own, so a density include there is reached by the mixin's
    // ancestor branch from any density-modified ancestor. See
    // `action-bar-logo-density.spec.ts` for the rendered-DOM regression.
    const rule = ruleFor(css, `.mlv-action-bar[class*="${modifier}"]`);
    expect(rule).toContain(`--mlv-action-bar-logo-gap: ${gap}`);
    expect(rule).toContain(`--mlv-action-bar-logo-font-size: ${fontSize}`);
  });
});

describe('action-bar-logo.scss', () => {
  const css = stripCssLayersFromText(sass.compile(LOGO_SCSS).css);

  it('reads the bar-published ramp, with the comfortable defaults as fallback', () => {
    const rule = ruleFor(css, '\n.mlv-action-bar__logo {');
    expect(rule).toContain(
      'gap: var(--mlv-action-bar-logo-gap, var(--mlv-spacing-2))',
    );
    expect(rule).toContain(
      'font-size: var(--mlv-action-bar-logo-font-size, var(--mlv-font-size-l))',
    );
  });

  it('holds a density-invariant 24x24 target floor', () => {
    // WCAG 2.2 SC 2.5.8, the same unconditional pair `mlv-icon-toggle` and
    // `mlv-switch` hold. `[mlvActionBarLogo]` on an `<a>` is a pointer target
    // with no padding of its own, and `tight` takes its type to 0.75rem:
    // measured in Chromium, a single-glyph logo in a tight bar is 10.7x24
    // without this and 24x24 with it.
    const rule = ruleFor(css, '\n.mlv-action-bar__logo {');
    expect(rule).toContain('min-inline-size: 1.5rem');
    expect(rule).toContain('min-block-size: 1.5rem');
  });

  it('emits exactly one rule, so nothing here is density-scoped', () => {
    // The floor above is only "density-invariant" if no density block can
    // restate it, and the ramp above is only the bar's if no selector here
    // competes with it. One rule is the strongest form of both.
    expect([...css.matchAll(/^[^@{}\n][^{}]*\{/gm)]).toHaveLength(1);
  });
});
