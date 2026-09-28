import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as Sass from 'sass';
import type Postcss from 'postcss';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';
import { describe, expect, it } from 'vitest';

// `sass` and `postcss` are Node-only; `createRequire` keeps them out of the
// browser-ish module graph vitest builds for this project.
const nodeRequire = createRequire(import.meta.url);
const sass = nodeRequire('sass') as typeof Sass;
const postcss = nodeRequire('postcss') as typeof Postcss;

// Resolved from this file: the `@nx/vitest:test` executor runs from the root.
const HERE = dirname(fileURLToPath(import.meta.url));

/** A component stylesheet as the browser receives it, layers flattened. */
function compile(file: string): Postcss.Root {
  const path = resolve(HERE, file);
  return postcss.parse(stripCssLayersFromText(sass.compile(path).css));
}

/** Whitespace-collapsed selectors of `rule`. */
const selectorsOf = (rule: Postcss.Rule): string[] =>
  rule.selectors.map((selector) => selector.replace(/\s+/g, ' ').trim());

/** Declarations `root` gives exactly `selector`, later ones winning. */
function declarations(
  root: Postcss.Root,
  selector: string,
): Record<string, string> {
  const found: Record<string, string> = {};
  let emitted = false;
  root.walkRules((rule) => {
    if (!selectorsOf(rule).includes(selector)) return;
    emitted = true;
    rule.each((node) => {
      if (node.type === 'decl') found[node.prop] = node.value;
    });
  });
  expect(emitted, `rule "${selector}" is emitted`).toBe(true);
  return found;
}

/** Every `opacity` a disabled-state rule declares, as `selector → value`. */
function disabledOpacities(root: Postcss.Root): string[] {
  const found: string[] = [];
  root.walkDecls('opacity', (decl) => {
    const rule = decl.parent as Postcss.Rule;
    const selector = (rule.selector ?? '').replace(/:not\([^)]*\)/g, '');
    if (/--disabled|:disabled|\[disabled|\[aria-disabled/.test(selector)) {
      found.push(`${rule.selector} → ${decl.value}`);
    }
  });
  return found;
}

const picker = compile('./color-picker.scss');
const popup = compile('../color-picker-popup/color-picker-popup.scss');

/**
 * SF-R4 (#366). The saturation plane, the hue / opacity strips and the swatch
 * are colour data: no declared token can stand for them, so they keep the
 * shared opacity token (allow-listed in `scripts/check-disabled-surface.mjs`).
 * Everything else — labels, format tabs, the inner inputs — declares its ink.
 */
describe('color-picker.scss — disabled surface', () => {
  it('dims only the colour data, with the token', () => {
    expect(disabledOpacities(picker)).toEqual([
      '.mlv-color-picker--disabled .mlv-color-picker__canvas-container → var(--mlv-disabled-opacity)',
      '.mlv-color-picker--disabled .mlv-color-picker__sliders → var(--mlv-disabled-opacity)',
    ]);
  });

  it('draws the channel labels and the format tabs in the disabled ink', () => {
    expect(
      declarations(
        picker,
        '.mlv-color-picker--disabled .mlv-color-picker__input-label',
      )['color'],
    ).toBe('var(--mlv-text-disabled)');
    expect(
      declarations(
        picker,
        '.mlv-color-picker--disabled .mlv-color-picker__format-tabs .mlv-tab-item',
      )['color'],
    ).toBe('var(--mlv-text-disabled)');
    expect(
      declarations(
        picker,
        '.mlv-color-picker--disabled .mlv-color-picker__format-tabs .mlv-tab-group__indicator',
      )['background-color'],
    ).toBe('var(--mlv-text-disabled)');
  });
});

describe('color-picker-popup.scss — disabled surface', () => {
  it('dims only the swatch, with the token; the wrapper declares the field', () => {
    expect(disabledOpacities(popup)).toEqual([
      '.mlv-color-picker-popup--disabled .mlv-color-picker-popup__swatch → var(--mlv-disabled-opacity)',
    ]);
  });
});
