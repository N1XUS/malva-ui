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
