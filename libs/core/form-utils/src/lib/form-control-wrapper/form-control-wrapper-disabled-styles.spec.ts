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

const root = compile('./form-control-wrapper.scss');

/**
 * SF-R4 (#366): the field box every text-style control renders declares the
 * disabled surface and ink — the same pair as a disabled `mlvButton` — instead
 * of `--mlv-background-sunken` with undimmed text.
 */
describe('form-control-wrapper.scss — disabled surface', () => {
  it('declares the disabled surface and side ink on the wrapper', () => {
    const host = declarations(root, '.mlv-form-control-wrapper--disabled');
    expect(host['--container-background-color']).toBe(
      'var(--mlv-background-disabled)',
    );
    expect(host['--container-side-content-color']).toBe(
      'var(--mlv-text-disabled)',
    );
    expect(host['--container-action-color']).toBe('var(--mlv-text-disabled)');
  });

  it('draws the value inside the box in the disabled ink', () => {
    const box = declarations(
      root,
      '.mlv-form-control-wrapper--disabled .mlv-form-control-wrapper__control-container',
    );
    expect(box['--mlv-text-primary']).toBe('var(--mlv-text-disabled)');
    expect(box['--mlv-text-secondary']).toBe('var(--mlv-text-disabled)');
  });

  it('dims nothing with opacity', () => {
    expect(disabledOpacities(root)).toEqual([]);
  });
});
