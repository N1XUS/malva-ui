import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const directory = dirname(fileURLToPath(import.meta.url));
const themeCss = readFileSync(resolve(directory, '../theme.css'), 'utf8');
const canonicalTheme = readFileSync(
  resolve(directory, '../../styles/src/lib/theme.scss'),
  'utf8',
);

function escaped(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('maps public Malva tokens through an inline Tailwind theme', () => {
  assert.match(themeCss, /@theme\s+inline\s*{/);
  assert.match(
    themeCss,
    /--color-mlv-primary-500:\s*var\(--mlv-palette-primary-500\)/,
  );
  assert.match(themeCss, /--spacing-mlv-4:\s*var\(--mlv-spacing-4\)/);
  assert.match(themeCss, /--radius-mlv-card:\s*var\(--mlv-radius-card\)/);
  assert.match(themeCss, /--shadow-mlv-raised:\s*var\(--mlv-shadow-raised\)/);
  assert.match(
    themeCss,
    /--text-mlv-body-m:\s*var\(--mlv-typography-body-m-size\)/,
  );
  assert.match(
    themeCss,
    /--leading-mlv-body-m:\s*var\(--mlv-typography-body-m-line-height\)/,
  );
  assert.match(themeCss, /--font-mlv-code:\s*var\(--mlv-font-family-code\)/);
  assert.match(themeCss, /--color-mlv-surface:\s*var\(--mlv-background-base\)/);
  assert.match(themeCss, /--color-mlv-content:\s*var\(--mlv-text-primary\)/);
  assert.match(themeCss, /--color-mlv-normal:\s*var\(--mlv-border-normal\)/);
});

test('exposes every public namespace under the mlv prefix', () => {
  for (const namespace of [
    'color',
    'spacing',
    'radius',
    'shadow',
    'font',
    'font-weight',
    'text',
    'leading',
  ]) {
    assert.match(
      themeCss,
      new RegExp(`--${namespace}-mlv-[\\w-]+\\s*:`),
      `missing ${namespace} namespace`,
    );
  }
});

test('references only declared canonical tokens and never spacing padding pairs', () => {
  const references = [...themeCss.matchAll(/var\(\s*(--mlv-[\w-]+)/g)].map(
    (match) => match[1],
  );

  for (const reference of new Set(references)) {
    assert.match(
      canonicalTheme,
      new RegExp(`(?:^|\\s)${escaped(reference)}\\s*:`),
      `${reference} is not declared by the canonical Malva theme`,
    );
  }

  assert.doesNotMatch(themeCss, /--spacing-mlv-[\w-]+:[^;]*--mlv-padding-/);
});

test('keeps adapter declarations value-driven instead of copying literals', () => {
  const themeBlock = themeCss.slice(
    themeCss.indexOf('@theme'),
    themeCss.lastIndexOf('}') + 1,
  );

  assert.doesNotMatch(themeBlock, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(themeBlock, /\b(?:rgb|hsl)a?\(/i);
  assert.doesNotMatch(themeBlock, /--[a-z-]+-mlv-[\w-]+:\s*[^v\s]/);
});

test('maps all canonical palette families and stops', () => {
  for (const family of [
    'primary',
    'secondary',
    'accent',
    'neutral',
    'success',
    'warning',
    'danger',
    'info',
  ]) {
    for (const stop of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]) {
      assert.match(
        themeCss,
        new RegExp(`--color-mlv-${family}-${stop}\\s*:`),
        `missing ${family}-${stop}`,
      );
    }
  }
});
