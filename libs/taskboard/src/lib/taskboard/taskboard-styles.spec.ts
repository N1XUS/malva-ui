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

  it('keeps the page-level rules out of a print the user started themselves', () => {
    // The `:has()` sheet is scoped to the modifier the component writes only
    // while `print()` is in flight, so Ctrl+P prints the page as it is.
    const outsidePrint = css.slice(0, css.indexOf('@media print'));
    expect(outsidePrint).not.toContain('.mlv-taskboard--printing');
  });
});
