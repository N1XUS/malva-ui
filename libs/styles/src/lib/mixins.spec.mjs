import assert from 'node:assert/strict';
import { dirname } from 'node:path';
import { test } from 'node:test';
import * as sass from 'sass';
import { fileURLToPath } from 'node:url';

const MIXINS = fileURLToPath(new URL('./mixins.scss', import.meta.url));
const MIXINS_DIRECTORY = dirname(MIXINS);

function compile(source) {
  return sass.compileString(`@use 'mixins' as mixins;\n${source}`, {
    loadPaths: [MIXINS_DIRECTORY],
  }).css;
}

test('margin-inline maps start and end values to logical properties', () => {
  const css = compile(`
    .example {
      @include mixins.margin-inline(1rem, 2rem);
    }
  `);

  assert.match(css, /margin-inline-start: 1rem/);
  assert.match(css, /margin-inline-end: 2rem/);
  assert.doesNotMatch(css, /margin-(left|right)/);
});

test('padding-inline supports one shared value and separate start/end values', () => {
  const css = compile(`
    .example {
      @include mixins.padding-inline(1rem);
    }
    .another-example {
      @include mixins.padding-inline(2rem, 3rem);
    }
  `);

  assert.match(css, /.example\s*\{[\s\S]*padding-inline-start: 1rem/);
  assert.match(css, /.example\s*\{[\s\S]*padding-inline-end: 1rem/);
  assert.match(css, /.another-example\s*\{[\s\S]*padding-inline-start: 2rem/);
  assert.match(css, /.another-example\s*\{[\s\S]*padding-inline-end: 3rem/);
});

test('rtl and ltr context mixins scope styles to the direction attribute', () => {
  const css = compile(`
    .example {
      @include mixins.rtl {
        margin-inline-start: 1rem;
      }
      @include mixins.ltr {
        margin-inline-end: 2rem;
      }
    }
  `);

  assert.match(css, /\[dir=rtl\]\s+\.example/);
  assert.match(css, /\[dir=ltr\]\s+\.example/);
});

test('fluid interpolates between px endpoints and clamps outside the band', () => {
  const css = compile(`
    .example {
      font-size: mixins.fluid(28px, 36px);
    }
  `);

  // 28px at 320, 36px at 1200: slope 8/880 = 0.90909vw, intercept 25.0909px.
  assert.match(
    css,
    /font-size: clamp\(1\.75rem, 1\.5682rem \+ 0\.9091vw, 2\.25rem\)/,
  );
});

test('fluid keeps a rem component so the size answers browser zoom', () => {
  // WCAG 1.4.4 (Resize Text): a font-size in viewport units alone ignores the
  // reader's root font size. The rem half is the whole value at the bottom of
  // the band and the bulk of it at the top.
  const css = compile(`
    .example {
      font-size: mixins.fluid(15px, 16px);
    }
  `);

  assert.match(css, /clamp\(0\.9375rem, 0\.9148rem \+ 0\.1136vw, 1rem\)/);
  assert.doesNotMatch(css, /clamp\([^)]*,\s*[\d.]+vw\s*,/);
});

test('fluid honours an explicit band', () => {
  const css = compile(`
    .example {
      font-size: mixins.fluid(16px, 24px, 400px, 800px);
    }
  `);

  // slope 8/400 = 2vw, intercept 16 - 0.02*400 = 8px = 0.5rem.
  assert.match(css, /font-size: clamp\(1rem, 0\.5rem \+ 2vw, 1\.5rem\)/);
});

test('fluid rejects endpoints it cannot compute a ramp from', () => {
  assert.throws(
    () => compile(`.example { font-size: mixins.fluid(1rem, 2rem); }`),
    /px endpoints/,
  );
  assert.throws(
    () => compile(`.example { font-size: mixins.fluid(16px, 24px, 800px, 400px); }`),
    /\$from < \$to/,
  );
});
