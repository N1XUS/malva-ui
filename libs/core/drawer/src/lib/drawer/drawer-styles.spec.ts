import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as Sass from 'sass';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';

// `sass` is a Node-only dependency; loading it through `createRequire` keeps it
// out of the browser-ish module graph vitest builds for this project.
const nodeRequire = createRequire(import.meta.url);
const sass = nodeRequire('sass') as typeof Sass;

const DRAWER_SCSS = resolve(
  dirname(fileURLToPath(import.meta.url)),
  './drawer.scss',
);

describe('drawer.scss', () => {
  // The stylesheet ships inside `@layer mlv.components`; the assertions below
  // anchor selectors to the start of a line, so the wrapper is flattened away
  // exactly as it is for the jsdom specs.
  const css = stripCssLayersFromText(sass.compile(DRAWER_SCSS).css);

  /**
   * Declarations of every rule whose selector list contains exactly
   * `selector`, joined. Sass splits a block around a nested rule (the
   * `mixins.base()` output sits in front of the block's own declarations) and
   * emits shared declarations under one comma-separated selector list, so one
   * selector can own several blocks and share others.
   */
  function rule(selector: string): string {
    const bodies: string[] = [];
    // A rule is `<selector list> { <declarations> }` with no braces inside;
    // an at-rule wrapper's own `{` is simply skipped over by the scan.
    for (const [, head, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selectors = head
        .trim()
        .split(/,\s*/)
        .map((candidate) => candidate.trim());
      if (selectors.includes(selector)) bodies.push(body);
    }
    expect(bodies.length, `rule "${selector}" is emitted`).toBeGreaterThan(0);
    return bodies.join('\n');
  }

  /** The merged-band scope: a resizable bottom sheet that renders a header. */
  const SHEET =
    '.mlv-drawer--bottom.mlv-drawer--resizable:has(> .mlv-drawer__header)';

  it('lays the header out as one gapped control row', () => {
    const header = rule('.mlv-drawer__header');
    expect(header).toContain('display: flex');
    expect(header).toContain('align-items: center');
    expect(header).toContain('gap: var(--mlv-spacing-2)');
    expect(header).toContain('padding: var(--mlv-padding-l)');
  });

  it('sets the title on the ui-l scale and truncates it', () => {
    const title = rule('.mlv-drawer__title');
    expect(title).toContain('font-size: var(--mlv-typography-ui-l-size)');
    expect(title).toContain('font-weight: var(--mlv-typography-ui-l-weight)');
    expect(title).toContain(
      'line-height: var(--mlv-typography-ui-l-line-height)',
    );
    expect(title).toContain('min-inline-size: 0');
    expect(title).toContain('text-overflow: ellipsis');
    expect(title).toContain('white-space: nowrap');
  });

  it('collapses an empty title slot so it adds no gap', () => {
    expect(rule('.mlv-drawer__title:empty')).toContain('display: none');
  });

  it('pins the close button to the inline end', () => {
    const close = rule('.mlv-drawer__close');
    expect(close).toContain('flex: none');
    expect(close).toContain('margin-inline-start: auto');
  });

  it('hangs the close glyph out so its strokes sit on the body content edge', () => {
    // The header and the body share one inline padding, so the close
    // *button box* ends exactly where a full-width field ends — but the
    // button is a transparent circle and all the eye sees is the X, which
    // stops well inside the box: (height − glyph) / 2 to the SVG box, plus the
    // 5/24 of the glyph Lucide's `x` path leaves blank inside it. Without the
    // hang the X reads ~12px in from the field edges at the 36px row
    // (#117 review). The hang is derived from the button's own tokens, on the
    // element that declares them, so a density or ratio change follows.
    const glyph = rule('.mlv-drawer__close > .mlv-button');
    expect(glyph).toContain('margin-inline-end: calc(');
    expect(glyph).toContain(
      'var(--mlv-icon-font-size) - var(--mlv-btn-height)',
    );
    expect(glyph).toContain('5 / 24');
  });

  it('clips the body instead of making it a hidden scroll container', () => {
    // `overflow: hidden` is still a scroll container: `focus()`,
    // `scrollIntoView()` and anchor navigation scroll it, and nothing shows
    // that it moved. A visually-hidden native input whose containing block
    // is the scrollbar host (outside the viewport) did exactly that — the
    // body scrolled ~2000px on a click, the content vanished and the real
    // viewport stayed put. `clip` clips the same way and cannot scroll.
    expect(rule('.mlv-drawer__body')).toContain('overflow: clip');
  });

  it('merges the resize handle into the header band of a bottom sheet', () => {
    // The 48px drag strip overlays the top of the header instead of stacking
    // above it; the header lifts its content below the pill and lets empty
    // space fall through to the handle. Scoped to sheets that render a
    // header — without one the strip would cover the top of the body.
    const handle = rule(`${SHEET} .mlv-drawer__handle`);
    expect(handle).toContain('position: absolute');
    expect(handle).toContain('inset-block-start: 0');
    expect(handle).toContain('inset-inline: 0');
    expect(handle).toContain('block-size: 3rem');

    const header = rule(`${SHEET} .mlv-drawer__header`);
    expect(header).toContain('position: relative');
    expect(header).toContain('padding-block-start: var(--mlv-spacing-5)');
    expect(header).toContain('pointer-events: none');

    expect(rule(`${SHEET} .mlv-drawer__header > *`)).toContain(
      'pointer-events: auto',
    );
    expect(rule(`${SHEET} .mlv-drawer__header > .mlv-drawer__title`)).toContain(
      'pointer-events: none',
    );
  });

  it('leaves the handle in flow for a bottom sheet without a header', () => {
    // The unscoped bottom rule still orders the in-flow handle first; nothing
    // positions it absolutely outside the `:has(> .mlv-drawer__header)` scope.
    expect(rule('.mlv-drawer--bottom .mlv-drawer__handle')).toContain(
      'order: -1',
    );
    expect(css).not.toMatch(
      /\n\.mlv-drawer--bottom\.mlv-drawer--resizable \.mlv-drawer__handle \{/,
    );
  });

  it('keeps the panel as the containing block of the merged handle', () => {
    expect(rule('.mlv-drawer')).toContain('position: relative');
  });

  it('parks the side-drawer handle in a full-height gutter at the inward edge', () => {
    // The panel is a flex column: an in-flow `height: 100%` handle takes a
    // row of its own and pushes the header below the panel. The handle is
    // absolute in a 48px gutter the panel reserves through padding instead.
    // `MlvDrawerPosition` names a viewport edge, so these sides are physical:
    // a left drawer's inward edge is its right side in either direction.
    const left = rule('.mlv-drawer--left .mlv-drawer__handle');
    expect(left).toContain('position: absolute');
    expect(left).toContain('inset-block: 0');
    expect(left).toContain('inline-size: 3rem');
    expect(left).toContain('right: 0');
    expect(left).not.toContain('height: 100%');
    expect(left).not.toMatch(/\border:/);

    const right = rule('.mlv-drawer--right .mlv-drawer__handle');
    expect(right).toContain('position: absolute');
    expect(right).toContain('left: 0');

    expect(rule('.mlv-drawer--left.mlv-drawer--resizable')).toContain(
      'padding-right: 3rem',
    );
    expect(rule('.mlv-drawer--right.mlv-drawer--resizable')).toContain(
      'padding-left: 3rem',
    );
  });

  it('keeps every physical inline-axis declaration inside the side-rail gutter', () => {
    // `MlvDrawerPosition` names a viewport edge, so the rail's four
    // declarations are physical on purpose; nothing else in the sheet may be.
    // An exact allowlist: a fifth one anywhere — rail rules included — fails.
    const physical: string[] = [];
    for (const [, head, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      for (const declaration of body.split(';')) {
        const trimmed = declaration.trim();
        if (/^(?:(?:margin|padding|border)-)?(?:left|right)\b/.test(trimmed)) {
          physical.push(`${head.trim().replace(/\s+/g, ' ')} { ${trimmed} }`);
        }
      }
    }
    expect(physical.sort()).toEqual([
      '.mlv-drawer--left .mlv-drawer__handle { right: 0 }',
      '.mlv-drawer--left.mlv-drawer--resizable { padding-right: 3rem }',
      '.mlv-drawer--right .mlv-drawer__handle { left: 0 }',
      '.mlv-drawer--right.mlv-drawer--resizable { padding-left: 3rem }',
    ]);
  });
});
