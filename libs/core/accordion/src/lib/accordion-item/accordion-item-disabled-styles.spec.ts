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

const root = compile('./accordion-item.scss');

/**
 * SF-R4 (#366): the disabled header already declared `--mlv-text-disabled`
 * and was then dimmed to 0.4 again by the item (≈1.6:1). The item no longer
 * dims; the header's ink reaches the title, which reads `--mlv-text-primary`
 * through the global `[class*='mlv']` rule, and its chevron.
 */
describe('accordion-item.scss — disabled header', () => {
  it('declares the disabled ink on the header and its title', () => {
    const trigger = declarations(
      root,
      '.mlv-accordion-item__trigger[aria-disabled=true]',
    );
    expect(trigger['color']).toBe('var(--mlv-text-disabled)');
    expect(trigger['--mlv-text-primary']).toBe('var(--mlv-text-disabled)');
  });

  it('draws the chevron in the disabled ink at full opacity', () => {
    expect(
      declarations(root, '.mlv-accordion-item__trigger[aria-disabled=true]')[
        '--mlv-accordion-icon-opacity'
      ],
    ).toBe('1');
    expect(
      declarations(
        root,
        '.mlv-accordion-item__trigger[aria-disabled=true] .mlv-accordion-item__icon',
      )['color'],
    ).toBe('var(--mlv-text-disabled)');
  });

  it('dims nothing with opacity', () => {
    expect(disabledOpacities(root)).toEqual([]);
  });
});
