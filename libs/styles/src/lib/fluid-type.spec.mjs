/**
 * The heading scale's fluid contract, read off the compiled `theme.scss`.
 *
 * This lives in `styles` rather than beside `mlv-page-header`, which is the
 * component whose collapse depends on the last assertion here: a cross-project
 * stylesheet read would sit in a project `nx affected` never selects when
 * `theme.scss` changes, so it would go stale silently.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';

const THEME = fileURLToPath(new URL('./theme.scss', import.meta.url));
const CSS = sass.compile(THEME, { style: 'expanded' }).css;

/** The six heading roles, narrow end → wide end, in px. */
const HEADING_RAMP = [
  ['--mlv-typography-heading-h1-size', '--mlv-font-size-5xl', 28, 36],
  ['--mlv-typography-heading-h2-size', '--mlv-font-size-4xl', 24, 30],
  ['--mlv-typography-heading-h3-size', '--mlv-font-size-3xl', 20, 24],
  ['--mlv-typography-heading-h4-size', null, 18, 20],
  ['--mlv-typography-heading-h5-size', null, 16, 18],
  ['--mlv-typography-heading-h6-size', null, 15, 16],
];

/** Last declaration of `token` in the compiled light-theme block. */
function declaration(token) {
  const match = CSS.match(new RegExp(`${token}:\\s*([^;]+);`));
  assert.ok(match, `${token} is declared nowhere`);
  return match[1].trim();
}

/** Resolves a heading role to the `clamp()` it ultimately holds. */
function ramp(token, via) {
  return declaration(via ?? token);
}

/** Evaluates `clamp(<rem>, <rem> + <vw>, <rem>)` in px at a viewport width. */
function evaluate(expression, viewportPx, rootPx = 16) {
  const parts = expression.match(
    /^clamp\(\s*([\d.]+)rem\s*,\s*([\d.]+)rem\s*\+\s*([\d.]+)vw\s*,\s*([\d.]+)rem\s*\)$/,
  );
  assert.ok(parts, `not a rem+vw clamp: ${expression}`);
  const [, min, base, tilt, max] = parts.map(Number);
  const value = Math.min(
    Math.max(base * rootPx + (tilt / 100) * viewportPx, min * rootPx),
    max * rootPx,
  );

  // The ramp's coefficients are rounded to four decimals, so at exactly the
  // band's anchors the interpolated term lands within a few ten-thousandths of
  // a pixel of the endpoint — on whichever side the rounding fell, which is why
  // clamp() does not always bite there. Round to a quantity a screen can show.
  return Number(value.toFixed(2));
}

test('every heading role is one clamp, and none of them steps at a breakpoint', () => {
  // The four display sizes used to jump at `md` and `lg`; those were the only
  // media queries in the file, so the ramp replacing them leaves none.
  assert.equal(CSS.match(/@media/g), null);

  for (const [token, via] of HEADING_RAMP) {
    assert.match(ramp(token, via), /^clamp\(/, `${token} is not fluid`);
  }
});

test('the ramp keeps the endpoints the stepped scale had', () => {
  // A phone still gets the old mobile value and a wide desktop the old `lg`
  // one. Outside the band clamp() bounds the interpolation, so the endpoint is
  // exact there no matter how the coefficients rounded; at the anchors
  // themselves it is exact to the hundredth of a pixel, which is why the
  // evaluator rounds.
  for (const [token, via, min, max] of HEADING_RAMP) {
    const expression = ramp(token, via);
    assert.equal(evaluate(expression, 320), min, `${token} at 320px`);
    assert.equal(evaluate(expression, 1200), max, `${token} at 1200px`);
    assert.equal(evaluate(expression, 240), min, `${token} below the band`);
    assert.equal(evaluate(expression, 2560), max, `${token} above the band`);
  }
});

test('the middle term carries a rem component, not bare vw', () => {
  // WCAG 1.4.4 (Resize Text): a font-size expressed only in viewport units
  // ignores the reader's browser zoom and root font size. Assert the rem half
  // is doing most of the work rather than merely being present — at the narrow
  // end it is the whole value, and at the wide end still the bulk of it.
  for (const [token, via] of HEADING_RAMP) {
    const expression = ramp(token, via);
    const [, base, tilt] = expression
      .match(/^clamp\([\d.]+rem,\s*([\d.]+)rem\s*\+\s*([\d.]+)vw/)
      .map(Number);
    const viewportShare = ((tilt / 100) * 1200) / (base * 16 + (tilt / 100) * 1200);
    assert.ok(
      viewportShare < 0.35,
      `${token}: vw term is ${(viewportShare * 100).toFixed(1)}% of the value at 1200px`,
    );
  }
});

test('the roles stay ordered and never collide across the band', () => {
  for (const width of [320, 390, 768, 1200, 1440]) {
    const sizes = HEADING_RAMP.map(([token, via]) =>
      evaluate(ramp(token, via), width),
    );
    for (let index = 1; index < sizes.length; index += 1) {
      assert.ok(
        sizes[index] < sizes[index - 1],
        `at ${width}px h${index + 1} (${sizes[index]}) is not smaller than h${index} (${sizes[index - 1]})`,
      );
    }
  }
});

test('the two roles mlv-page-header crossfades between stay separated', () => {
  // The header renders its title twice and scrubs the shared grid cell between
  // the two measured heights, so the collapse distance *is* this gap. Roles
  // that converge at the narrow end would reproduce, from the other side, the
  // zero-collapse defect a consumer causes by pinning both nodes with
  // `mlvTitle`. `size="m"` crossfades h2 → h4, `size="s"` h4 → h6.
  const at = (token, via, width) => evaluate(ramp(token, via), width);

  for (const width of [320, 390, 768, 1200, 1440]) {
    const h2 = at('--mlv-typography-heading-h2-size', '--mlv-font-size-4xl', width);
    const h4 = at('--mlv-typography-heading-h4-size', null, width);
    const h6 = at('--mlv-typography-heading-h6-size', null, width);

    assert.ok(h2 - h4 >= 6, `size="m" gap at ${width}px is only ${(h2 - h4).toFixed(2)}px`);
    assert.ok(h4 - h6 >= 3, `size="s" gap at ${width}px is only ${(h4 - h6).toFixed(2)}px`);
  }
});

test('body and UI sizes are untouched by the ramp', () => {
  // `--mlv-height-*` is fixed rem, so a fluid font inside a control clips
  // instead of scaling. h4–h6 declare their own ramp precisely so that these
  // three shared steps can stay put.
  for (const [token, value] of [
    ['--mlv-font-size-l', '1rem'],
    ['--mlv-font-size-xl', '1.125rem'],
    ['--mlv-font-size-2xl', '1.25rem'],
    ['--mlv-typography-body-l-size', 'var(--mlv-font-size-l)'],
    ['--mlv-typography-ui-l-size', 'var(--mlv-font-size-l)'],
  ]) {
    assert.equal(declaration(token), value, `${token} moved`);
  }
});
