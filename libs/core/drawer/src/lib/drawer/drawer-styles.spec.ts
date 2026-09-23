import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as Sass from 'sass';
import type * as TypeScript from 'typescript';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';

// `sass` and `typescript` are Node-only dependencies; loading them through
// `createRequire` keeps them out of the browser-ish module graph vitest builds
// for this project.
const nodeRequire = createRequire(import.meta.url);
const sass = nodeRequire('sass') as typeof Sass;
const ts = nodeRequire('typescript') as typeof TypeScript;

const HERE = dirname(fileURLToPath(import.meta.url));
const DRAWER_SCSS = resolve(HERE, './drawer.scss');
const DRAWER_PANEL_TS = resolve(HERE, './drawer-panel.ts');
const DRAWER_HEADER_SCSS = resolve(HERE, '../drawer-header.scss');
const DRAWER_HEADER_TS = resolve(HERE, '../drawer-header.ts');

/**
 * Compiles a stylesheet the way the jsdom specs see CSS: the
 * `@layer mlv.components` wrapper is flattened away, so the assertions below
 * can anchor selectors to the start of a line.
 */
function compile(file: string): string {
  return stripCssLayersFromText(sass.compile(file).css);
}

/**
 * Declarations of every rule in `css` whose selector list contains exactly
 * `selector`, joined. Sass splits a block around a nested rule (the
 * `mixins.base()` output sits in front of the block's own declarations) and
 * emits shared declarations under one comma-separated selector list, so one
 * selector can own several blocks and share others.
 */
function rule(css: string, selector: string): string {
  const bodies: string[] = [];
  // A rule is `<selector list> { <declarations> }` with no braces inside;
  // an at-rule wrapper's own `{` is simply skipped over by the scan.
  for (const [, head, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (selectorsOf(head).includes(selector)) bodies.push(body);
  }
  expect(bodies.length, `rule "${selector}" is emitted`).toBeGreaterThan(0);
  return bodies.join('\n');
}

/** Every selector of every rule in `css`, one entry per comma-separated item. */
function allSelectors(css: string): string[] {
  return [...css.matchAll(/([^{}]+)\{[^{}]*\}/g)].flatMap(([, head]) =>
    selectorsOf(head),
  );
}

/**
 * The comma-separated items of a rule head, trimmed. Only top-level commas
 * separate selectors: the ones inside `:is(h1, h2, …)` or `:has(…)` do not.
 */
function selectorsOf(head: string): string[] {
  const selectors: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of head.trim()) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === ',' && depth === 0) {
      selectors.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  selectors.push(current.trim());
  return selectors;
}

/**
 * The stylesheets `className`'s `@Component` decorator declares, resolved to
 * absolute paths — read from the syntax tree, so a comment that merely spells
 * `styleUrl: …` is not mistaken for the property.
 *
 * Component stylesheets never reach the document under this test environment
 * (measured: `ɵcmp.styles` is empty and no `<style>` carries a drawer rule,
 * whether a header renders on its own or a service drawer is open), so which
 * component owns which sheet is only observable in the source.
 */
function componentStylesheets(file: string, className: string): string[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const declaration = source.statements.find(
    (statement): statement is TypeScript.ClassDeclaration =>
      ts.isClassDeclaration(statement) && statement.name?.text === className,
  );
  if (!declaration) {
    throw new Error(`class ${className} is not declared in ${file}`);
  }
  const component = (ts.getDecorators(declaration) ?? [])
    .map((decorator) => decorator.expression)
    .find(
      (expression): expression is TypeScript.CallExpression =>
        ts.isCallExpression(expression) &&
        ts.isIdentifier(expression.expression) &&
        expression.expression.text === 'Component',
    );
  const metadata = component?.arguments[0];
  if (!metadata || !ts.isObjectLiteralExpression(metadata)) {
    throw new Error(`${className} has no @Component({ … }) metadata`);
  }

  const paths: string[] = [];
  for (const property of metadata.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const name = property.name.getText(source);
    const value = property.initializer;
    if (name === 'styleUrl' && ts.isStringLiteralLike(value)) {
      paths.push(resolve(dirname(file), value.text));
    }
    if (name === 'styleUrls' && ts.isArrayLiteralExpression(value)) {
      for (const element of value.elements) {
        if (ts.isStringLiteralLike(element)) {
          paths.push(resolve(dirname(file), element.text));
        }
      }
    }
  }
  return paths;
}

describe('drawer.scss', () => {
  const css = compile(DRAWER_SCSS);

  /** The merged-band scope: a resizable bottom sheet that renders a header. */
  const SHEET =
    '.mlv-drawer--bottom.mlv-drawer--resizable:has(> .mlv-drawer__header)';

  /**
   * The same scope as a service-opened drawer renders it: the opened
   * component's host (`.mlv-drawer__content`) sits between the panel and
   * the header, so `> .mlv-drawer__header` alone never matches there.
   */
  const SERVICE_SHEET =
    '.mlv-drawer--bottom.mlv-drawer--resizable:has(> .mlv-drawer__content > .mlv-drawer__header)';

  it('ships with the shell component every open path renders', () => {
    // `drawer.service.spec.ts` pins the other half: the service path's
    // `.mlv-drawer` element is the host of `div[mlvDrawerPanel]`.
    expect(componentStylesheets(DRAWER_PANEL_TS, 'MlvDrawerPanel')).toEqual([
      DRAWER_SCSS,
    ]);
  });

  it('paints the panel surface and tints the backdrop', () => {
    const panel = rule(css, '.mlv-drawer');
    expect(panel).toContain('background-color: var(--mlv-elevation-bg-2)');
    expect(panel).toContain('box-shadow: var(--mlv-shadow-overlay)');
    expect(rule(css, '.mlv-drawer-backdrop')).toContain(
      'background-color: var(--mlv-background-overlay)',
    );
  });

  it('leaves the header row itself to the header stylesheet', () => {
    // One source for the row: the header's own sheet. `drawer.scss` reaches
    // the header only from inside the panel-scoped merged band.
    for (const selector of allSelectors(css)) {
      expect(selector).not.toMatch(/^\.mlv-drawer__(?:header|title|close)\b/);
    }
  });

  it('clips the body instead of making it a hidden scroll container', () => {
    // `overflow: hidden` is still a scroll container: `focus()`,
    // `scrollIntoView()` and anchor navigation scroll it, and nothing shows
    // that it moved. A visually-hidden native input whose containing block
    // is the scrollbar host (outside the viewport) did exactly that — the
    // body scrolled ~2000px on a click, the content vanished and the real
    // viewport stayed put. `clip` clips the same way and cannot scroll.
    expect(rule(css, '.mlv-drawer__body')).toContain('overflow: clip');
  });

  it('merges the resize handle into the header band of a bottom sheet', () => {
    // The 48px drag strip overlays the top of the header instead of stacking
    // above it; the header lifts its content below the pill and lets empty
    // space fall through to the handle. Scoped to sheets that render a
    // header — without one the strip would cover the top of the body.
    const handle = rule(css, `${SHEET} .mlv-drawer__handle`);
    expect(handle).toContain('position: absolute');
    expect(handle).toContain('inset-block-start: 0');
    expect(handle).toContain('inset-inline: 0');
    expect(handle).toContain('block-size: 3rem');

    const header = rule(css, `${SHEET} .mlv-drawer__header`);
    expect(header).toContain('position: relative');
    expect(header).toContain('padding-block-start: var(--mlv-spacing-5)');
    expect(header).toContain('pointer-events: none');

    expect(rule(css, `${SHEET} .mlv-drawer__header > *`)).toContain(
      'pointer-events: auto',
    );
    expect(
      rule(css, `${SHEET} .mlv-drawer__header > .mlv-drawer__title`),
    ).toContain('pointer-events: none');
  });

  it('merges the band for a service-opened sheet, whose header sits in the content host', () => {
    for (const tail of [
      ' .mlv-drawer__handle',
      ' .mlv-drawer__header',
      ' .mlv-drawer__header > *',
      ' .mlv-drawer__header > .mlv-drawer__title',
    ]) {
      expect(rule(css, `${SERVICE_SHEET}${tail}`)).toBe(
        rule(css, `${SHEET}${tail}`),
      );
    }
  });

  it('leaves the handle in flow for a bottom sheet without a header', () => {
    // The unscoped bottom rule still orders the in-flow handle first; nothing
    // positions it absolutely outside the `:has(> .mlv-drawer__header)` scope.
    expect(rule(css, '.mlv-drawer--bottom .mlv-drawer__handle')).toContain(
      'order: -1',
    );
    expect(css).not.toMatch(
      /\n\.mlv-drawer--bottom\.mlv-drawer--resizable \.mlv-drawer__handle \{/,
    );
  });

  it('keeps the panel as the containing block of the merged handle', () => {
    expect(rule(css, '.mlv-drawer')).toContain('position: relative');
  });

  it('parks the side-drawer handle in a full-height gutter at the inward edge', () => {
    // The panel is a flex column: an in-flow `height: 100%` handle takes a
    // row of its own and pushes the header below the panel. The handle is
    // absolute in a 48px gutter the panel reserves through padding instead.
    // `MlvDrawerPosition` names a viewport edge, so these sides are physical:
    // a left drawer's inward edge is its right side in either direction.
    const left = rule(css, '.mlv-drawer--left .mlv-drawer__handle');
    expect(left).toContain('position: absolute');
    expect(left).toContain('inset-block: 0');
    expect(left).toContain('inline-size: 3rem');
    expect(left).toContain('right: 0');
    expect(left).not.toContain('height: 100%');
    expect(left).not.toMatch(/\border:/);

    const right = rule(css, '.mlv-drawer--right .mlv-drawer__handle');
    expect(right).toContain('position: absolute');
    expect(right).toContain('left: 0');

    expect(rule(css, '.mlv-drawer--left.mlv-drawer--resizable')).toContain(
      'padding-right: 3rem',
    );
    expect(rule(css, '.mlv-drawer--right.mlv-drawer--resizable')).toContain(
      'padding-left: 3rem',
    );
  });

  it('keeps every physical inline-axis declaration inside the side-rail gutter', () => {
    // `MlvDrawerPosition` names a viewport edge, so the rail's four
    // declarations are physical on purpose; nothing else in the drawer's
    // stylesheets may be — the header's included. An exact allowlist: a
    // fifth one anywhere — rail rules included — fails.
    const physical: string[] = [];
    const sheets = `${css}\n${compile(DRAWER_HEADER_SCSS)}`;
    for (const [, head, body] of sheets.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
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

describe('drawer-header.scss', () => {
  const css = compile(DRAWER_HEADER_SCSS);

  it('ships with the header component, so a header outside any drawer is styled', () => {
    // `drawer.scss` arrives only with an open drawer's panel; a header
    // rendered on its own (documented as a plain styled row) gets nothing
    // from it. Its row styles therefore travel with the header itself.
    expect(componentStylesheets(DRAWER_HEADER_TS, 'MlvDrawerHeader')).toEqual([
      DRAWER_HEADER_SCSS,
    ]);
  });

  it('needs no drawer around the header for any of its rules to match', () => {
    // Every selector starts at a header element class: nothing is scoped
    // under `.mlv-drawer` or a panel modifier, which a standalone header
    // never has above it.
    const selectors = allSelectors(css);
    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors) {
      expect(selector).toMatch(/^\.mlv-drawer__(?:header|title|close)\b/);
    }
  });

  it('lays the header out as one gapped control row', () => {
    const header = rule(css, '.mlv-drawer__header');
    expect(header).toContain('display: flex');
    expect(header).toContain('align-items: center');
    expect(header).toContain('gap: var(--mlv-spacing-2)');
    expect(header).toContain('padding: var(--mlv-padding-l)');
  });

  it('sets the title on the ui-l scale and truncates it', () => {
    const title = rule(css, '.mlv-drawer__title');
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
    expect(rule(css, '.mlv-drawer__title:empty')).toContain('display: none');
  });

  it('pins the close button to the inline end', () => {
    const close = rule(css, '.mlv-drawer__close');
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
    const glyph = rule(css, '.mlv-drawer__close > .mlv-button');
    expect(glyph).toContain('margin-inline-end: calc(');
    expect(glyph).toContain(
      'var(--mlv-icon-font-size) - var(--mlv-btn-height)',
    );
    expect(glyph).toContain('5 / 24');
  });
});
