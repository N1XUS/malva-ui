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

const editor = compile('./editor.scss');
const toolbar = compile('../toolbar/editor-toolbar.scss');
const table = compile('../toolbar/editor-table.scss');

/**
 * SF-R4 (#366). A disabled editor is a form control: it declares the field
 * surface on every box it paints and the disabled ink on the document text.
 * Authored colours (text colour, highlight, images) are content and keep their
 * values, as an emoji keeps its colour in a disabled `mlv-input`. The toolbar's
 * controls are disabled buttons with their own surface, so it stops dimming.
 */
describe('editor.scss — disabled surface', () => {
  it('paints every editor box with the disabled surface', () => {
    for (const element of [
      '.mlv-form-control-wrapper__control-container',
      '.mlv-editor__surface',
      '.mlv-editor__toolbar',
    ]) {
      expect(
        declarations(editor, `.mlv-editor--disabled ${element}`)[
          'background-color'
        ],
        element,
      ).toBe('var(--mlv-background-disabled)');
    }
  });

  it('draws the document text in the disabled ink', () => {
    const content = declarations(
      editor,
      '.mlv-editor--disabled .mlv-editor__content',
    );
    for (const token of [
      '--mlv-text-primary',
      '--mlv-text-secondary',
      '--mlv-text-heading',
      '--mlv-text-action',
      '--mlv-text-action-hover',
    ]) {
      expect(content[token], token).toBe('var(--mlv-text-disabled)');
    }
  });

  it('dims nothing with opacity', () => {
    expect(disabledOpacities(editor)).toEqual([]);
  });
});

describe('editor-toolbar.scss / editor-table.scss — disabled', () => {
  it('stops dimming the toolbar over its disabled controls', () => {
    expect(disabledOpacities(toolbar)).toEqual([]);
  });

  it('declares the disabled table-size cell', () => {
    const cell = declarations(table, '.mlv-editor-table__grid-cell:disabled');
    expect(cell['background-color']).toBe('var(--mlv-background-disabled)');
    expect(disabledOpacities(table)).toEqual([]);
  });
});
