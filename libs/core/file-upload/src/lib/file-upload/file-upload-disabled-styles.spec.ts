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

const root = compile('./file-upload.scss');

/**
 * SF-R4 (#366): the disabled drop zone declares its surface and ink. The
 * cover image is picture data and keeps the token (allow-listed).
 */
describe('file-upload.scss — disabled surface', () => {
  it('declares the disabled drop zone', () => {
    const zone = declarations(
      root,
      '.mlv-file-upload--disabled .mlv-file-upload__zone',
    );
    expect(zone['background-color']).toBe('var(--mlv-background-disabled)');
    expect(zone['cursor']).toBe('not-allowed');
  });

  it('draws the zone icon, title and subtitle in the disabled ink', () => {
    for (const element of ['zone-icon', 'zone-title', 'zone-subtitle']) {
      expect(
        declarations(
          root,
          `.mlv-file-upload--disabled .mlv-file-upload__${element}`,
        )['color'],
        element,
      ).toBe('var(--mlv-text-disabled)');
    }
  });

  it('dims only the cover image, with the token', () => {
    expect(disabledOpacities(root)).toEqual([
      '.mlv-file-upload--disabled .mlv-file-upload__cover-image → var(--mlv-disabled-opacity)',
    ]);
  });
});
