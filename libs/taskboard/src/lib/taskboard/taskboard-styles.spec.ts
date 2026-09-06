import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as Sass from 'sass';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';
import { describe, expect, it } from 'vitest';

// `sass` is a Node-only dependency; loading it through `createRequire` keeps it
// out of the browser-ish module graph vitest builds for this project.
const nodeRequire = createRequire(import.meta.url);
const sass = nodeRequire('sass') as typeof Sass;

const TASKBOARD_SCSS = resolve(
  dirname(fileURLToPath(import.meta.url)),
  './taskboard.scss',
);

describe('taskboard.scss', () => {
  // The stylesheet ships inside `@layer mlv.components`; flattening the wrapper
  // away is what lets these assertions read the rules as they cascade.
  const css = stripCssLayersFromText(sass.compile(TASKBOARD_SCSS).css);
  const print = css.slice(css.indexOf('@media print'));

  it('hides everything outside the printing board', () => {
    // Every element that is neither an ancestor of the printing board, nor the
    // board itself, nor inside it.
    expect(print).toContain(
      'body:has(.mlv-taskboard--printing) *:not(:has(.mlv-taskboard--printing)):not(.mlv-taskboard--printing):not(.mlv-taskboard--printing *)',
    );
    expect(print).toContain('display: none !important');
  });

  it('un-clips the ancestor chain of the printing board', () => {
    const selector =
      'body:has(.mlv-taskboard--printing) :has(.mlv-taskboard--printing)';
    expect(print).toContain(selector);
    const rule = print
      .slice(print.indexOf(selector))
      .slice(0, print.slice(print.indexOf(selector)).indexOf('}'));
    expect(rule).toContain('overflow: visible !important');
    expect(rule).toContain('height: auto !important');
    expect(rule).toContain('max-height: none !important');
  });

  it('hides the empty-cell box in a collapsed cell, like the cards it stands in for', () => {
    // The box is the empty cell's drop slot, so it belongs to the cards area
    // and disappears with it when the column or lane is collapsed — otherwise a
    // collapsed empty column draws a full-width dashed panel.
    const selector = '.mlv-taskboard__cell[data-collapsed=true]';
    const index = css.indexOf(`${selector} .mlv-taskboard__card`);
    expect(index).toBeGreaterThan(-1);
    const block = css.slice(index, css.indexOf('}', index));
    expect(block).toContain('display: none');
    expect(block).toContain(`${selector} .mlv-taskboard__empty`);
  });

  it('draws the tail insertion bar inside the last header, not past it', () => {
    // The strip is an `mlv-scrollbar` viewport since R44, so a bar half a
    // gutter beyond the last header is painted outside the scroll box: the one
    // slot the user cannot see, plus `gap / 2` of extra scrollable overflow on
    // a board that otherwise fits.
    const selector =
      '.mlv-taskboard__column-header[data-mlv-taskboard-drop-edge=end]::after';
    const index = css.indexOf(selector);
    expect(index).toBeGreaterThan(-1);
    const rule = css.slice(index, css.indexOf('}', index));
    const inset = /inset-inline-end:\s*([^;}]+)/.exec(rule)?.[1]?.trim();
    expect(inset).toBeDefined();
    expect(inset).not.toContain('-');
  });

  it('never gives an empty virtual cell the fixed viewport height', () => {
    // `block-size` is not a floor: `&__cards--empty`'s `min-block-size` cannot
    // shrink it, and both modifiers are one class, so source order alone would
    // decide. The height therefore states the exclusion in its own selector.
    const declaration =
      'block-size: var(--mlv-taskboard-cell-block-size, 20rem)';
    const index = css.indexOf(declaration);
    expect(index).toBeGreaterThan(-1);
    // Only one rule may declare it, and that rule must exclude the empty cell.
    expect(css.indexOf(declaration, index + 1)).toBe(-1);
    const selector = css.slice(css.lastIndexOf('}', index) + 1, index);
    expect(selector).toContain('.mlv-taskboard__cards--virtual');
    expect(selector).toContain(':not(.mlv-taskboard__cards--empty)');
  });

  it('stops both an empty and a virtual scroll box stretching, in one rule', () => {
    // The two modifiers say the same thing — "do not take the row's height" —
    // so they share a declaration rather than drifting apart.
    const index = css.indexOf('.mlv-taskboard__cell-scroller--virtual');
    expect(index).toBeGreaterThan(-1);
    const rule = css.slice(index, css.indexOf('}', index));
    expect(rule).toContain('.mlv-taskboard__cell-scroller--empty');
    expect(rule).toContain('flex: 0 0 auto');
  });

  it('keeps the page-level rules out of a print the user started themselves', () => {
    // The `:has()` sheet is scoped to the modifier the component writes only
    // while `print()` is in flight, so Ctrl+P prints the page as it is.
    const outsidePrint = css.slice(0, css.indexOf('@media print'));
    expect(outsidePrint).not.toContain('.mlv-taskboard--printing');
  });
});
