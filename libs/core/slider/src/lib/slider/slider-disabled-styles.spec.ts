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

const root = compile('./slider.scss');

/**
 * SF-R4 (#366): a disabled slider declares its fill and thumbs; the dead
 * `var(--mlv-disabled-opacity, 0.56)` fallback is gone with the multiply.
 */
describe('slider.scss — disabled surface', () => {
  it('draws the fill and the thumbs in the disabled ink', () => {
    expect(
      declarations(root, '.mlv-slider--disabled .mlv-slider__fill')[
        'background-color'
      ],
    ).toBe('var(--mlv-text-disabled)');
    const thumb = declarations(
      root,
      '.mlv-slider--disabled .mlv-slider__thumb',
    );
    expect(thumb['background-color']).toBe('var(--mlv-text-disabled)');
    expect(thumb['box-shadow']).toBe('none');
    expect(thumb['cursor']).toBe('not-allowed');
  });

  it('hides the tooltip and dims nothing else with opacity', () => {
    expect(disabledOpacities(root)).toEqual([
      '.mlv-slider--disabled .mlv-slider__tooltip → 0',
    ]);
  });

  it('carries no fallback on the disabled-opacity token', () => {
    const fallbacks: string[] = [];
    root.walkDecls((decl) => {
      if (/var\(\s*--mlv-disabled-opacity\s*,/.test(decl.value))
        fallbacks.push(decl.value);
    });
    expect(fallbacks).toEqual([]);
  });
});
