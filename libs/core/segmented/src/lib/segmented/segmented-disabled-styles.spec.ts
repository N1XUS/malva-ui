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

const group = compile('./segmented.scss');
const item = compile('../segmented-item/segmented-item.scss');

/**
 * SF-R4 (#366): a disabled group used to dim its track to 0.4 and every item
 * (`isDisabled` includes the group) to 0.4 again — labels at 16 % alpha. The
 * group now declares the track, pill and active ink; the item declares its ink.
 */
describe('segmented.scss — disabled group', () => {
  it('declares the disabled track and a neutral, flat pill', () => {
    const host = declarations(group, '.mlv-segmented--disabled');
    expect(host['--mlv-segmented-track-bg']).toBe(
      'var(--mlv-background-disabled)',
    );
    expect(host['--mlv-segmented-pill-bg']).toBe('var(--mlv-elevation-bg-4)');
    expect(host['--mlv-segmented-active-color']).toBe(
      'var(--mlv-text-disabled)',
    );
    expect(
      declarations(
        group,
        '.mlv-segmented--disabled > .mlv-segmented__track > .mlv-segmented__indicator',
      )['box-shadow'],
    ).toBe('none');
  });

  it('outranks every tone', () => {
    for (const tone of [
      'neutral',
      'accent',
      'info',
      'success',
      'warning',
      'danger',
    ]) {
      expect(
        ruleIndex(group, '.mlv-segmented--disabled'),
        tone,
      ).toBeGreaterThan(ruleIndex(group, `.mlv-segmented--tone-${tone}`));
    }
  });

  it('dims nothing with opacity', () => {
    expect(disabledOpacities(group)).toEqual([]);
  });
});

describe('segmented-item.scss — disabled item', () => {
  it('declares the disabled ink after the active state', () => {
    expect(declarations(item, '.mlv-segmented-item--disabled')['color']).toBe(
      'var(--mlv-text-disabled)',
    );
    expect(ruleIndex(item, '.mlv-segmented-item--disabled')).toBeGreaterThan(
      ruleIndex(item, '.mlv-segmented-item--active'),
    );
  });

  it('dims nothing with opacity', () => {
    expect(disabledOpacities(item)).toEqual([]);
  });
});
