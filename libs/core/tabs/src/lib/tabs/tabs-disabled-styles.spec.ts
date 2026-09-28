import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as Sass from 'sass';
import type Postcss from 'postcss';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';
import { afterEach, describe, expect, it } from 'vitest';

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

/**
 * Selectors of every rule in `root` that declares `property` and matches
 * `element`. jsdom matches the selectors; nothing is laid out or cascaded.
 */
function matchingRules(
  root: Postcss.Root,
  property: string,
  element: Element,
): string[] {
  const found: string[] = [];
  root.walkRules((rule) => {
    const declares = rule.nodes.some(
      (node) => node.type === 'decl' && node.prop === property,
    );
    if (!declares) return;
    for (const selector of rule.selectors) {
      // A pseudo-element styles no element, and `matches()` rejects it.
      if (selector.includes('::')) continue;
      if (element.matches(selector)) found.push(selector.replace(/\s+/g, ' '));
    }
  });
  return found;
}

const tabs = compile('./tabs.scss');

/**
 * `tab-item.scss` draws a disabled tab in `--mlv-text-disabled`, emitted after
 * its active rule (its own spec pins that). The boxed group's active-label rule
 * sits at (0,4,0) and would beat it, so it must not reach a disabled tab
 * (#366): the old 0.5 opacity used to mask the clash.
 */
describe('tabs.scss — disabled tab in a boxed group', () => {
  let group: HTMLElement | undefined;

  afterEach(() => group?.remove());

  /** Builds a boxed group holding one tab with the given state classes. */
  function boxedTab(...states: string[]): HTMLElement {
    group = document.createElement('div');
    group.className = 'mlv-tab-group mlv-tab-group--appearance-boxed';
    const header = document.createElement('div');
    header.className = 'mlv-tab-group__header';
    const item = document.createElement('button');
    item.className = ['mlv-tab-item', ...states].join(' ');
    header.append(item);
    group.append(header);
    document.body.append(group);
    return item;
  }

  it('paints the primary label on an enabled active tab', () => {
    expect(
      matchingRules(tabs, 'color', boxedTab('mlv-tab-item--active')),
    ).toHaveLength(1);
  });

  it('sets no colour on a disabled active tab, so the disabled ink wins', () => {
    expect(
      matchingRules(
        tabs,
        'color',
        boxedTab('mlv-tab-item--active', 'mlv-tab-item--disabled'),
      ),
    ).toEqual([]);
  });
});
