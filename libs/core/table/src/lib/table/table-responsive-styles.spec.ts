import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as Sass from 'sass';
import type Postcss from 'postcss';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';
import { describe, expect, it } from 'vitest';

/**
 * Column contract for `table[mlvTable][responsive]`.
 *
 * A responsive table is `display: block` so it can scroll its own inline
 * overflow. Its row groups then sit in one anonymous table box (CSS 2.1
 * § 17.2.1), which is what keeps a header cell and the data cells under it the
 * same width. Giving each row group its own `display: table` builds one table
 * per section, each sizing its columns from its own content, so headers stop
 * lining up with the data (#355).
 *
 * jsdom performs no layout, so the geometry itself is asserted in the Chromium
 * suite (`libs/core/table/e2e/table.spec.ts`); this spec pins the stylesheet
 * rules that produce it, which is the part CI runs.
 */

// `sass` and `postcss` are Node-only; `createRequire` keeps them out of the
// module graph vitest builds for this project.
const nodeRequire = createRequire(import.meta.url);
const sass = nodeRequire('sass') as typeof Sass;
const postcss = nodeRequire('postcss') as typeof Postcss;

// The `@nx/vitest:test` executor runs with cwd = workspace root, so the path is
// resolved from this file rather than from `process.cwd()`.
const TABLE_SCSS = resolve(
  dirname(fileURLToPath(import.meta.url)),
  './table.scss',
);

const RESPONSIVE = '.mlv-table--responsive';
const POP_IN = '.mlv-table--responsive.mlv-table--pop-in';
const POP_IN_MEDIA = '(max-width: 48rem)';
const NO_WRAP_MODE = 'not (text-wrap-mode: nowrap)';

/** Data cells of the responsive table itself, never of a table nested in one. */
const OWN_CELLS = [
  `${RESPONSIVE} > tr > td`,
  `${RESPONSIVE} > :where(thead, tbody, tfoot) > tr > td`,
];
/** The fill cell of the responsive table's own rows. */
const OWN_ROW_FILL = [
  `${RESPONSIVE} > tr::after`,
  `${RESPONSIVE} > :where(thead, tbody, tfoot) > tr::after`,
];

const root = postcss.parse(
  stripCssLayersFromText(sass.compile(TABLE_SCSS, { style: 'expanded' }).css),
);

interface MatchedRule {
  readonly selector: string;
  /** Params of the enclosing `@media`, or `null`. */
  readonly media: string | null;
  /** Params of the enclosing `@supports`, or `null`. */
  readonly supports: string | null;
  readonly declarations: Readonly<Record<string, string>>;
}

/** Params of the nearest enclosing at-rule called `name`, or `null`. */
function enclosing(rule: Postcss.Rule, name: string): string | null {
  for (let parent = rule.parent; parent; parent = parent.parent) {
    if (parent.type === 'atrule' && (parent as Postcss.AtRule).name === name) {
      return (parent as Postcss.AtRule).params;
    }
  }
  return null;
}

/** Every emitted rule, one entry per selector in its selector list. */
function allRules(): MatchedRule[] {
  const out: MatchedRule[] = [];
  root.walkRules((rule) => {
    const declarations: Record<string, string> = {};
    rule.walkDecls((decl) => {
      declarations[decl.prop] = decl.value;
    });
    for (const selector of rule.selectors) {
      out.push({
        selector: selector.trim(),
        media: enclosing(rule, 'media'),
        supports: enclosing(rule, 'supports'),
        declarations,
      });
    }
  });
  return out;
}

/**
 * The declarations of every rule written for exactly `selector` in `media` and
 * `supports` (both `null` = outside any such at-rule).
 */
function declarationsFor(
  selector: string,
  media: string | null,
  supports: string | null = null,
): Record<string, string> {
  const matches = allRules().filter(
    (rule) =>
      rule.selector === selector &&
      rule.media === media &&
      rule.supports === supports,
  );
  const where = [
    media ? `@media ${media}` : null,
    supports ? `@supports ${supports}` : null,
  ]
    .filter(Boolean)
    .join(' ');
  expect(
    matches.length,
    `no rule for "${selector}" ${where ? `inside ${where}` : 'outside at-rules'}`,
  ).toBeGreaterThan(0);
  return Object.assign({}, ...matches.map((rule) => rule.declarations));
}

/** Selectors of every rule outside at-rules that declares `prop: value`. */
function selectorsDeclaring(prop: string, value: string): string[] {
  return allRules()
    .filter(
      (rule) =>
        rule.media === null &&
        rule.supports === null &&
        rule.declarations[prop] === value,
    )
    .map((rule) => rule.selector)
    .sort();
}

describe('mlv-table responsive column contract (#355)', () => {
  it('gives no row group of a responsive table its own table box', () => {
    const perSectionTables = allRules()
      .filter(
        (rule) =>
          rule.media === null &&
          rule.selector.startsWith(RESPONSIVE) &&
          /\b(thead|tbody|tfoot)$/.test(rule.selector) &&
          /^(inline-)?table$/.test(rule.declarations['display'] ?? ''),
      )
      .map(
        (rule) =>
          `${rule.selector} { display: ${rule.declarations['display']} }`,
      );

    expect(perSectionTables).toEqual([]);
  });

  it('keeps responsive data cells on one line through the wrap mode alone, so inherited line breaks survive', () => {
    for (const selector of OWN_CELLS) {
      const cell = declarationsFor(selector, null);
      expect(cell['text-wrap-mode'], selector).toBe('nowrap');
      // `white-space` would also reset `white-space-collapse`, collapsing the
      // authored newlines of an ancestor's `pre-line` / `pre-wrap`.
      expect(cell['white-space'], selector).toBeUndefined();

      // An engine without `text-wrap-mode` still keeps cells on one line.
      expect(
        declarationsFor(selector, null, NO_WRAP_MODE)['white-space'],
        `${selector} fallback`,
      ).toBe('nowrap');
    }
  });

  it('ends every row with a sub-pixel percentage cell, so the shared grid fills the scroll port', () => {
    for (const selector of OWN_ROW_FILL) {
      const fill = declarationsFor(selector, null);

      expect(fill['content'], selector).toBe('""');
      expect(fill['display'], selector).toBe('table-cell');
      // Legacy auto layout (all three engines) widens an auto-width table
      // until a percentage column's max-content fits its share, so the table
      // fills its containing block; a vanishing share leaves no visible gap.
      expect(fill['width'], selector).toMatch(/^0?\.\d+%$/);
      expect(Number.parseFloat(fill['width'])).toBeLessThan(0.01);

      // The max-content is the logical inline-start padding. It must survive
      // the root font size and zoom as at least one layout unit (1/64px in
      // Blink / WebKit, rounded down): 0.001rem is 0 below a 16px root or
      // 100% zoom, and the table stops filling. 0.01rem holds down to an 8px
      // root at 25% zoom (measured in all three engines). Under 1/16rem it
      // stays under one CSS pixel at the default root; at a high device-pixel
      // ratio it can still round to one device pixel, which leaves a notch at
      // the inline end of row decorations (libs-table.md § Responsive mode).
      expect(fill['padding-inline-start'], selector).toMatch(/^0?\.\d+rem$/);
      const padding = Number.parseFloat(fill['padding-inline-start']);
      expect(padding, selector).toBeGreaterThanOrEqual(0.01);
      expect(padding, selector).toBeLessThan(0.0625);

      for (const physical of [
        'padding-left',
        'padding-right',
        'left',
        'right',
      ]) {
        expect(fill[physical], `${selector} ${physical}`).toBeUndefined();
      }
    }
  });

  it('scopes the one-line and fill rules to its own rows, leaving a nested table alone', () => {
    // Child combinators: rows directly in the table (an Angular template
    // creates no implicit `tbody`) or in one of its row groups — never the
    // rows of a table nested inside a cell.
    expect(selectorsDeclaring('text-wrap-mode', 'nowrap')).toEqual(
      [...OWN_CELLS].sort(),
    );
    expect(selectorsDeclaring('display', 'table-cell')).toEqual(
      [...OWN_ROW_FILL].sort(),
    );
  });

  it('lets Pop In cards wrap their text and drops the fill cell at the breakpoint', () => {
    for (const selector of [
      `${POP_IN} tbody td`,
      `${POP_IN} tr.mlv-table__row--main td`,
      `${POP_IN} tr.mlv-table__row--secondary td`,
    ]) {
      // Back to the inherited value — as before the one-line rule — so an
      // ancestor's `pre-line` keeps its breaks inside a card too.
      expect(
        declarationsFor(selector, POP_IN_MEDIA)['white-space'],
        selector,
      ).toBe('inherit');
    }

    for (const selector of [
      `${POP_IN} tbody tr::after`,
      `${POP_IN} tr.mlv-table__row--main::after`,
      `${POP_IN} tr.mlv-table__row--secondary::after`,
    ]) {
      expect(declarationsFor(selector, POP_IN_MEDIA)['content'], selector).toBe(
        'none',
      );
    }
  });
});
