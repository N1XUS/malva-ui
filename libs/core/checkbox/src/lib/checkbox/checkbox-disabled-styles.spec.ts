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

const root = compile('./checkbox.scss');

/**
 * SF-R4 (#366): a disabled checkbox declares its surface instead of dimming
 * itself to `--mlv-disabled-opacity`. The old multiply put the white check at
 * 1.69:1 on a translucent accent box in light; the declared pair is
 * `--mlv-text-disabled` on `--mlv-background-disabled`.
 */
describe('checkbox.scss — disabled surface', () => {
  it('declares the disabled box and resets the checked accent border', () => {
    const host = declarations(root, '.mlv-checkbox--disabled');
    expect(host['--check-background']).toBe('var(--mlv-background-disabled)');
    expect(host['--check-border-color']).toBe('var(--mlv-border-normal)');
    expect(host['opacity']).toBeUndefined();
    // Equal specificity with `--checked`, so the disabled rule must come later.
    expect(ruleIndex(root, '.mlv-checkbox--disabled')).toBeGreaterThan(
      ruleIndex(root, '.mlv-checkbox--checked'),
    );
  });

  it('keeps the error border on a disabled invalid box', () => {
    // Declared on the swatch, so it outranks the host's disabled border value.
    expect(
      declarations(root, '.mlv-checkbox__visual--error')[
        '--check-border-color'
      ],
    ).toBe('var(--mlv-border-error)');
  });

  it('draws the check glyph and the label in the disabled ink', () => {
    expect(
      declarations(root, '.mlv-checkbox--disabled .mlv-checkbox__check')[
        'color'
      ],
    ).toBe('var(--mlv-text-disabled)');
    expect(
      declarations(root, '.mlv-checkbox--disabled .mlv-checkbox__label')[
        '--mlv-text-primary'
      ],
    ).toBe('var(--mlv-text-disabled)');
  });

  it('dims nothing with opacity', () => {
    expect(disabledOpacities(root)).toEqual([]);
  });
});
