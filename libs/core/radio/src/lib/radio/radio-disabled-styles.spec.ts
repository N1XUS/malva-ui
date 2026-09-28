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

const radio = compile('./radio.scss');
const group = compile('../radio-group/radio-group.scss');

/**
 * SF-R4 / SF-R6 (#366). A disabled radio — its own `disabled` or its
 * group's — declares its circle and ink; the group no longer dims its content
 * a second time, and paints only the error accent.
 */
describe('radio.scss — disabled surface', () => {
  it('declares the circle for an own-disabled radio and one in a disabled group', () => {
    for (const selector of [
      '.mlv-radio--disabled',
      '.mlv-radio-group--disabled .mlv-radio',
    ]) {
      const host = declarations(radio, selector);
      expect(host['--mlv-radio-bg'], selector).toBe('var(--mlv-text-disabled)');
      expect(host['--mlv-radio-border'], selector).toBe(
        'var(--mlv-border-normal)',
      );
      expect(host['opacity'], selector).toBeUndefined();
    }
    for (const selector of [
      '.mlv-radio--disabled .mlv-radio__visual',
      '.mlv-radio-group--disabled .mlv-radio__visual',
    ]) {
      expect(declarations(radio, selector)['background-color'], selector).toBe(
        'var(--mlv-background-disabled)',
      );
    }
  });

  it('draws the label in the disabled ink', () => {
    for (const selector of [
      '.mlv-radio--disabled .mlv-radio__label',
      '.mlv-radio-group--disabled .mlv-radio__label',
    ]) {
      expect(
        declarations(radio, selector)['--mlv-text-primary'],
        selector,
      ).toBe('var(--mlv-text-disabled)');
    }
  });

  it('dims nothing with opacity', () => {
    expect(disabledOpacities(radio)).toEqual([]);
  });
});

describe('radio-group.scss — disabled and validation state', () => {
  it('keeps the disabled group inert without dimming its radios again', () => {
    const content = declarations(
      group,
      '.mlv-radio-group--disabled .mlv-radio-group__content',
    );
    expect(content['pointer-events']).toBe('none');
    expect(content['opacity']).toBeUndefined();
    expect(disabledOpacities(group)).toEqual([]);
  });

  it('paints only the error state (SF-R6)', () => {
    expect(stateTints(group)).toEqual([]);
    expect(
      declarations(
        group,
        '.mlv-radio-group--state-error .mlv-radio-group__content',
      )['border-inline-start'],
    ).toContain('var(--mlv-border-error)');
  });
});
