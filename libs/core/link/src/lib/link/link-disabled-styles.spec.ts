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

/** Source position of the last rule naming `selector` (-1 when absent). */
function ruleIndex(root: Postcss.Root, selector: string): number {
  let index = -1;
  let position = 0;
  root.walkRules((rule) => {
    if (selectorsOf(rule).includes(selector)) index = position;
    position++;
  });
  return index;
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

const root = compile('./link.scss');

/** SF-R4 (#366): a disabled link is drawn in the disabled ink. */
describe('link.scss — disabled', () => {
  it('declares the disabled ink, outranking hover and focus', () => {
    const disabled = '.mlv-link.mlv-link--disabled';
    expect(declarations(root, disabled)['color']).toBe(
      'var(--mlv-text-disabled)',
    );
    // (0,2,0), like `:hover` / `:focus-visible` / `--subtle:hover`, so order decides.
    for (const state of [
      '.mlv-link:hover',
      '.mlv-link:focus-visible',
      '.mlv-link--subtle:hover',
    ]) {
      expect(ruleIndex(root, disabled), state).toBeGreaterThan(
        ruleIndex(root, state),
      );
    }
  });

  it('dims nothing with opacity', () => {
    expect(disabledOpacities(root)).toEqual([]);
  });
});
