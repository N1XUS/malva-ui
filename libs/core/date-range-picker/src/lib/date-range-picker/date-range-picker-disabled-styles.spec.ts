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

/** Every selector naming a non-error validation state (SF-R6). */
function stateTints(root: Postcss.Root): string[] {
  const found: string[] = [];
  root.walkRules((rule) => {
    for (const selector of selectorsOf(rule)) {
      if (/--state-(success|warning|info)\b/.test(selector))
        found.push(selector);
    }
  });
  return found;
}

const root = compile('./date-range-picker.scss');

/**
 * SF-R4 / SF-R6 (#366). The picker renders inside `mlv-form-control-wrapper`,
 * which now declares the disabled field, so the host stops multiplying it; the
 * success / warning / info trigger tints go the way the wrapper's did.
 */
describe('date-range-picker.scss — disabled surface and validation state', () => {
  it('dims nothing with opacity', () => {
    expect(
      declarations(root, '.mlv-date-range-picker--disabled')['opacity'],
    ).toBeUndefined();
    expect(disabledOpacities(root)).toEqual([]);
  });

  it('tints the trigger for error only (SF-R6)', () => {
    expect(stateTints(root)).toEqual([]);
    expect(
      declarations(
        root,
        '.mlv-date-range-picker--state-error .mlv-date-range-picker__trigger',
      )['color'],
    ).toBe('var(--mlv-text-negative)');
  });
});
