import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as Sass from 'sass';
import type Postcss from 'postcss';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';
import { describe, expect, it } from 'vitest';

/*
 * F-D18 caret styles, read from the compiled stylesheet: jsdom resolves no
 * `var()`, performs no layout and ignores `forced-colors` / `print` media, so
 * the shipped rules are asserted as text.
 */

// `sass` and `postcss` are Node-only; `createRequire` keeps them out of the
// browser-ish module graph vitest builds for this project.
const nodeRequire = createRequire(import.meta.url);
const sass = nodeRequire('sass') as typeof Sass;
const postcss = nodeRequire('postcss') as typeof Postcss;

// Resolved from this file: the `@nx/vitest:test` executor runs from the root.
const HERE = dirname(fileURLToPath(import.meta.url));

const root = postcss.parse(
  stripCssLayersFromText(
    sass.compile(resolve(HERE, '../../../src/lib/editor/editor.scss')).css,
  ),
);

/** Whitespace-collapsed selectors of `rule`. */
const selectorsOf = (rule: Postcss.Rule): string[] =>
  rule.selectors.map((selector) => selector.replace(/\s+/g, ' ').trim());

/** The `@media` params enclosing `node`, or `''` at the top level. */
function mediaOf(node: Postcss.Node): string {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type === 'atrule' && (parent as Postcss.AtRule).name === 'media')
      return (parent as Postcss.AtRule).params;
  }
  return '';
}

/** Declarations the rules for exactly `selector` under `media` give, later winning. */
function declarations(selector: string, media = ''): Record<string, string> {
  const found: Record<string, string> = {};
  let emitted = false;
  root.walkRules((rule) => {
    if (!selectorsOf(rule).includes(selector) || mediaOf(rule) !== media)
      return;
    emitted = true;
    rule.each((node) => {
      if (node.type === 'decl') found[node.prop] = node.value;
    });
  });
  expect(emitted, `rule "${selector}" under "${media}" is emitted`).toBe(true);
  return found;
}

describe('Remote caret styles (F-D18)', () => {
  it('draws the bar and the label from the two caret custom properties, logically', () => {
    const caret = declarations('.mlv-editor__caret');
    expect(caret['border-inline-start']).toMatch(
      /var\(--mlv-stroke-width-medium\) solid var\(--mlv-editor-caret-color\)/,
    );
    expect(caret['pointer-events']).toBe('none');

    const label = declarations('.mlv-editor__caret-label');
    expect([
      label['position'],
      label['inset-block-end'],
      label['inset-inline-start'],
      label['background-color'],
      label['color'],
      label['white-space'],
    ]).toEqual([
      'absolute',
      '100%',
      '0',
      'var(--mlv-editor-caret-color)',
      'var(--mlv-editor-caret-label-color)',
      'nowrap',
    ]);
  });

  it('flips the label below the first line, where a capped viewport would clip it', () => {
    const flipped = declarations(
      '.mlv-editor__content .ProseMirror > :first-child .mlv-editor__caret-label',
    );
    expect(flipped['inset-block']).toBe('100% auto');
  });

  it('tints a peer selection lightly enough to keep the text readable', () => {
    expect(
      declarations('.mlv-editor__caret-selection')['background-color'],
    ).toMatch(
      /color-mix\(in srgb, var\(--mlv-editor-caret-color\) 25%, transparent\)/,
    );
  });

  it('writes no physical inline property on any caret rule', () => {
    const physical: string[] = [];
    root.walkDecls((decl) => {
      const rule = decl.parent as Postcss.Rule;
      if (!rule.selector?.includes('__caret')) return;
      if (/(^|-)(left|right)(-|$)/.test(decl.prop))
        physical.push(`${rule.selector} { ${decl.prop} }`);
    });
    expect(physical).toEqual([]);
  });

  it('keeps caret and label visible in forced colours with the system pair', () => {
    const media = '(forced-colors: active)';
    const caret = declarations('.mlv-editor__caret', media);
    expect([
      caret['forced-color-adjust'],
      caret['border-inline-start-color'],
    ]).toEqual(['none', 'CanvasText']);
    const label = declarations('.mlv-editor__caret-label', media);
    expect([label['background-color'], label['color']]).toEqual([
      'CanvasText',
      'Canvas',
    ]);
    const selection = declarations('.mlv-editor__caret-selection', media);
    expect([
      selection['background-color'],
      selection['text-decoration-color'],
    ]).toEqual(['transparent', 'CanvasText']);
  });

  it('prints neither carets nor peer selections', () => {
    let printedCaret = '';
    let printedSelection = '';
    root.walkRules((rule) => {
      if (mediaOf(rule) !== 'print') return;
      const selectors = selectorsOf(rule);
      rule.walkDecls((decl) => {
        if (selectors.includes('.mlv-editor__caret') && decl.prop === 'display')
          printedCaret = decl.value;
        if (
          selectors.includes('.mlv-editor__caret-selection') &&
          decl.prop === 'background-color'
        )
          printedSelection = decl.value;
      });
    });
    expect([printedCaret, printedSelection]).toEqual(['none', 'transparent']);
  });
});
