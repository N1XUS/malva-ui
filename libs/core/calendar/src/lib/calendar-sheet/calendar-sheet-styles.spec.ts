import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as Sass from 'sass';
import type Postcss from 'postcss';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';
import { describe, expect, it } from 'vitest';

// `sass` and `postcss` are Node-only dependencies; loading them through
// `createRequire` keeps them out of the browser-ish module graph vitest builds
// for this project.
const nodeRequire = createRequire(import.meta.url);
const sass = nodeRequire('sass') as typeof Sass;
const postcss = nodeRequire('postcss') as typeof Postcss;

const SHEET_SCSS = resolve(
  dirname(fileURLToPath(import.meta.url)),
  './calendar-sheet.scss',
);

/**
 * The desktop calendar's stylesheet. The sheet's week-row caps are the same
 * design as `mlv-calendar`'s, so the cap assertion below reads the radii out of
 * this file rather than restating them.
 */
const CALENDAR_SCSS = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../calendar/calendar.scss',
);

/**
 * Every declaration `selector` carries at the top level of the stylesheet.
 *
 * Sass splits one authored block into several emitted rules whenever a nested
 * rule sits between declarations — `mixins.base()` contributes one such split —
 * so the count is not meaningful and the bodies are concatenated. Rules nested
 * inside an at-rule (the `prefers-reduced-motion` block also names the element)
 * are excluded: they are a different condition, not this rule.
 */
function ruleBody(css: string, selector: string): string {
  const bodies: string[] = [];
  postcss.parse(css).walkRules((rule) => {
    if (rule.parent?.type !== 'root') return;
    const matches = rule.selectors.some((s) => s.trim() === selector);
    if (matches) bodies.push(rule.nodes.map((n) => n.toString()).join(';\n'));
  });
  expect(bodies.length, `no rule for \`${selector}\``).toBeGreaterThan(0);
  return bodies.join(';\n');
}

/**
 * jsdom implements no layout and no scroll anchoring, so none of this can be
 * asserted against a rendered sheet — the compiled stylesheet is where these
 * mechanisms actually live. The behavioural half is in
 * `calendar-sheet-scroll.spec.ts`, which stubs the metrics instead.
 */
describe('calendar-sheet.scss', () => {
  // The stylesheet ships inside `@layer mlv.components`; jsdom cannot parse
  // `@layer` and drops the whole sheet, so it is flattened away here exactly as
  // `setup-strip-css-layers.js` does for the rendered specs.
  const css = stripCssLayersFromText(sass.compile(SHEET_SCSS).css);
  const desktopCss = stripCssLayersFromText(sass.compile(CALENDAR_SCSS).css);

  const BLOCK = '.mlv-calendar-sheet';
  const MONTHS = '.mlv-calendar-sheet__months';

  /** The four logical corners of a border radius, in a stable order. */
  const CORNERS = ['start-start', 'start-end', 'end-start', 'end-end'] as const;

  /** The value both surfaces round a band cap to. */
  const FULL = 'var(--mlv-radius-full)';

  /**
   * Every declaration an element carrying `classes` resolves to, applied in
   * source order, with the `border-radius` shorthand expanded into its four
   * logical corners.
   *
   * The two calendars reach the same shape by different routes — `mlv-calendar`
   * squares its whole in-range day and adds the outward corners back, while the
   * sheet paints the band on the cell and squares only the endpoint button — so
   * comparing declarations rule for rule would compare the route rather than
   * the result. This resolves the result instead: which corner is round and
   * which is flat on the element the browser actually paints.
   *
   * `classes` is the element's own class list and `ancestor` the class list of
   * the element it sits in — the sheet's `__cell`, whose row-cap modifier the
   * endpoint's own cap reads. Selectors participate only if they are one
   * compound class selector, or two separated by a descendant combinator; a
   * rule qualified by anything else (`:hover`, `:not()`) is not something a
   * bare class list can be said to match, and neither stylesheet puts a radius
   * behind one.
   */
  function resolveStyle(
    source: string,
    classes: readonly string[],
    ancestor: readonly string[] = [],
  ): Record<string, string> {
    const owned = new Set(classes);
    const above = new Set(ancestor);
    const style: Record<string, string> = {};

    /** Whether a compound class selector is fully carried by `held`. */
    const carried = (compound: string, held: Set<string>) =>
      /^(\.[\w-]+)+$/.test(compound) &&
      compound
        .split('.')
        .filter(Boolean)
        .every((name) => held.has(name));

    postcss.parse(source).walkRules((rule) => {
      if (rule.parent?.type !== 'root') return;
      const selector = rule.selectors
        .map((s) => s.trim())
        .find((s) => {
          const compounds = s.split(/\s+/);
          if (compounds.length === 1) return carried(compounds[0], owned);
          if (compounds.length !== 2) return false;
          return carried(compounds[0], above) && carried(compounds[1], owned);
        });
      if (!selector) return;

      rule.walkDecls((decl) => {
        const value = decl.value.trim();
        if (decl.prop !== 'border-radius') {
          style[decl.prop] = value;
          return;
        }
        // Neither stylesheet writes a per-corner shorthand; splitting one
        // correctly is a different job, so fail loudly rather than mis-resolve.
        expect(
          value.split(/\s+/),
          `multi-value \`border-radius\` on \`${selector}\``,
        ).toHaveLength(1);
        for (const corner of CORNERS) style[`border-${corner}-radius`] = value;
      });
    });

    return style;
  }

  /** The resolved radius of each logical corner, keyed by corner. */
  function resolveCorners(
    source: string,
    classes: readonly string[],
    ancestor: readonly string[] = [],
  ): Record<string, string> {
    const style = resolveStyle(source, classes, ancestor);
    return Object.fromEntries(
      CORNERS.map((corner) => [
        corner,
        style[`border-${corner}-radius`] ?? '(unset)',
      ]),
    );
  }

  /** A sheet day button carrying `modifiers`, as a class list. */
  const sheetDay = (...modifiers: string[]) => [
    'mlv-calendar-sheet__day',
    ...modifiers.map((m) => `mlv-calendar-sheet__day--${m}`),
  ];

  /**
   * The sheet cell a painted day sits in, carrying `modifiers`.
   *
   * `--in-range` is what paints the band, and a cell holding an endpoint always
   * carries at least the matching row cap — an endpoint opens or closes its
   * row's painted run by definition — so the caller names only the cap that is
   * in question.
   */
  const sheetCell = (...modifiers: string[]) => [
    'mlv-calendar-sheet__cell',
    'mlv-calendar-sheet__cell--in-range',
    ...modifiers.map((m) => `mlv-calendar-sheet__cell--${m}`),
  ];

  /**
   * A `mlv-calendar` day inside a committed range, carrying `modifiers`.
   * `--in-range` and `--range-complete` are what the desktop template stamps on
   * every band cell, endpoints included, so an endpoint is never asserted
   * without them.
   */
  const desktopDay = (...modifiers: string[]) => [
    'mlv-calendar__day',
    'mlv-calendar__day--in-range',
    'mlv-calendar__day--range-complete',
    ...modifiers.map((m) => `mlv-calendar__day--${m}`),
  ];

  it('turns off browser scroll anchoring on the month list', () => {
    // `_growLeading` measures the height the prepended months added and pushes
    // the offset down by exactly that, so the month the user is looking at
    // holds still. Browser scroll anchoring corrects for the same insertion, so
    // left on, the two corrections stack and the list jumps by a month.
    expect(ruleBody(css, MONTHS)).toContain('overflow-anchor: none');
  });

  it('makes the month list the only scroller', () => {
    const months = ruleBody(css, MONTHS);
    expect(months).toContain('overflow-y: auto');
    // The strip and the weekday header are fixed chrome; the list takes the
    // rest and may shrink below its content, which is what gives it something
    // to scroll instead of growing the sheet past the viewport.
    expect(months).toContain('flex: 1 1 auto');
    expect(months).toContain('min-height: 0');
    for (const region of [
      '.mlv-calendar-sheet__years',
      '.mlv-calendar-sheet__weekdays',
    ]) {
      expect(ruleBody(css, region), region).toContain('flex: 0 0 auto');
    }
  });

  it('positions month sections against the scroller', () => {
    // `_scrollToMonth` and `_syncYearFromScroll` both read a section's
    // `offsetTop` as a scroll offset directly, which only holds while the
    // scroller is the sections' offset parent.
    expect(ruleBody(css, MONTHS)).toContain('position: relative');
  });

  it('is a three-region column that fills whatever height it is given', () => {
    const block = ruleBody(css, BLOCK);
    expect(block).toContain('display: flex');
    expect(block).toContain('flex-direction: column');
    // The standalone default; a consumer that places it in a flex column hands
    // it `flex: 1 1 0` instead (see the pickers' stylesheets).
    expect(block).toContain('height: 100%');
    expect(block).toContain('min-height: 0');
  });

  it('caps the range band at a week-row edge exactly as mlv-calendar does', () => {
    // #149: the sheet briefly dropped these caps while the desktop calendar
    // kept them, so the same range read as a stack of pills on one surface and
    // a sheared block on the other. They are one design, and the assertion is
    // written as a comparison rather than as two literals so the next person
    // cannot change one side and leave the other behind: the radii are read out
    // of `calendar.scss` and required to match, logical corner for logical
    // corner.

    /** The `border-*-radius` declarations a selector sets, sorted. */
    function radii(source: string, selector: string): string[] {
      const found: string[] = [];
      postcss.parse(source).walkRules((rule) => {
        if (rule.parent?.type !== 'root') return;
        if (!rule.selectors.some((s) => s.trim().endsWith(selector))) return;
        rule.walkDecls(/^border-[\w-]*radius$/, (decl) =>
          found.push(`${decl.prop}: ${decl.value}`),
        );
      });
      return found.sort();
    }

    for (const cap of ['range-row-start', 'range-row-end']) {
      const sheet = radii(css, `${BLOCK}__cell--${cap}`);
      const desktop = radii(desktopCss, `.mlv-calendar__day--${cap}`);

      expect(sheet, `no \`--${cap}\` radii in the sheet`).not.toEqual([]);
      expect(desktop, `no \`--${cap}\` radii in mlv-calendar`).not.toEqual([]);
      expect(sheet).toEqual(desktop);
    }
  });

  it('flattens a range endpoint on the side facing into the range, as mlv-calendar does', () => {
    // #149, the owner's remaining complaint: "I meant first and last date
    // selected in range". On the desktop calendar the endpoint *is* the band's
    // cap — one unbroken pill. On the sheet it was a full circle floating
    // inside the band, so the eye caught a step where the circle met the fill
    // on the side the range continues towards.
    //
    // Asserted as an equality of the resolved shape rather than of the
    // declarations: the two surfaces paint the band on different elements
    // (`__day` on desktop, `__cell` here) and get there by different routes, so
    // only the painted corners are comparable — and comparing them is what
    // stops the two drifting apart again.
    for (const [endpoint, outward] of [
      ['range-start', 'start'],
      ['range-end', 'end'],
    ] as const) {
      const inward = outward === 'start' ? 'end' : 'start';
      // Mid-row: the band carries on past the flat side within this same week
      // row, so the cell caps only on the outward side.
      const sheet = resolveCorners(
        css,
        sheetDay(endpoint),
        sheetCell(`range-row-${outward}`),
      );
      const desktop = resolveCorners(
        desktopCss,
        desktopDay(endpoint, `range-row-${outward}`),
      );

      // Spelled out as well as compared, so a failure names the defect rather
      // than printing two corner maps and leaving the reader to diff them.
      expect(sheet, `\`--${endpoint}\` keeps its inward corners round`).toEqual(
        {
          [`${outward}-${outward}`]: FULL,
          [`${outward}-${inward}`]: '0',
          [`${inward}-${outward}`]: FULL,
          [`${inward}-${inward}`]: '0',
        },
      );
      expect(sheet, `\`--${endpoint}\` disagrees with mlv-calendar`).toEqual(
        desktop,
      );
    }
  });

  it('widens a range endpoint to its cell so the flat side meets the band', () => {
    // A resting day button is a 2.75rem circle centred in a cell that is wider
    // than that at every phone width. Squaring one side of it while it keeps
    // that cap would only move the seam: the flat edge would stop short of the
    // cell and leave a sliver of pale band beside it. `mlv-calendar` avoids
    // this by letting an in-range day fill its track (`width: 100%`,
    // `padding-inline: 0`); the sheet does the same by dropping the cap.
    expect(resolveStyle(css, sheetDay())['max-width']).toBe('2.75rem');
    expect(resolveStyle(css, sheetDay('selected'))['max-width']).toBe(
      '2.75rem',
    );

    for (const endpoint of ['range-start', 'range-end']) {
      const style = resolveStyle(css, sheetDay(endpoint));
      expect(style['max-width'], `\`--${endpoint}\` is still inset`).toBe(
        'none',
      );
      expect(style['width'], `\`--${endpoint}\` does not fill its cell`).toBe(
        '100%',
      );
    }
  });

  it('rounds an endpoint back where its own cell caps the row', () => {
    // The state a flat inward side must not be applied to. An endpoint that
    // also ends its row's painted run — a range starting on the last day of a
    // week row, or ending on the first — has no band on the flat side: it wraps
    // to the next row, and the cell rounds there. Left square, the cap would
    // paint its corner over the cell's rounded one and the row would read
    // sheared, which is exactly what the row caps exist to prevent.
    //
    // `mlv-calendar` gets there by stamping the row-cap modifiers on the day
    // itself; the sheet's cap reads the cell's modifier instead, because band
    // and cap are different elements here. Same resolved shape either way,
    // which is what is compared.
    const circle = Object.fromEntries(CORNERS.map((c) => [c, FULL]));

    for (const [endpoint, wrapping] of [
      ['range-start', 'range-row-end'],
      ['range-end', 'range-row-start'],
    ] as const) {
      const sheet = resolveCorners(
        css,
        sheetDay(endpoint),
        sheetCell('range-row-start', 'range-row-end'),
      );

      expect(
        sheet,
        `\`--${endpoint}\` stays square inside \`--${wrapping}\``,
      ).toEqual(circle);
      expect(
        resolveCorners(
          desktopCss,
          desktopDay(endpoint, 'range-row-start', 'range-row-end'),
        ),
        `mlv-calendar's \`--${endpoint}\` at a row edge`,
      ).toEqual(sheet);
    }
  });

  it('keeps a day with no range on either side a full circle', () => {
    // What a careless fix breaks. A lone selection has no band to join — the
    // `mlv-day-picker` sheet only ever renders these — and a one-day range is
    // its own start *and* end, so the two flattenings cancel and it is a circle
    // again. `mlv-calendar` resolves the same, which is why the one-day range
    // is compared rather than only asserted.
    const circle = Object.fromEntries(CORNERS.map((c) => [c, FULL]));

    expect(resolveCorners(css, sheetDay()), 'a resting day').toEqual(circle);
    expect(
      resolveCorners(css, sheetDay('selected')),
      'a lone selection',
    ).toEqual(circle);
    expect(
      resolveCorners(
        css,
        sheetDay('range-start', 'range-end'),
        sheetCell('range-row-start', 'range-row-end'),
      ),
      'a one-day range',
    ).toEqual(circle);
    expect(
      resolveCorners(
        desktopCss,
        desktopDay(
          'range-start',
          'range-end',
          'range-row-start',
          'range-row-end',
        ),
      ),
      "mlv-calendar's one-day range",
    ).toEqual(circle);
  });

  it('caps the band with logical corners so it mirrors in RTL', () => {
    // `border-top-left-radius` and friends would pin the cap to the physical
    // left edge, which is the wrong end of a right-to-left grid.
    const capRules = css.slice(css.indexOf(`${BLOCK}__cell--range-row-start`));
    expect(capRules).toContain('border-start-start-radius');
    expect(capRules).toContain('border-end-start-radius');
    expect(capRules).toContain('border-start-end-radius');
    expect(capRules).toContain('border-end-end-radius');
    expect(css).not.toMatch(/border-(top|bottom)-(left|right)-radius/);
  });

  it('ships a reduced-motion path', () => {
    const reduced = css.slice(
      css.indexOf('@media (prefers-reduced-motion: reduce)'),
    );
    expect(reduced, 'no reduced-motion block emitted').not.toBe('');
    expect(reduced).toContain(BLOCK);
  });

  it('adds no physical inline-axis declaration', () => {
    // `.claude/rules/rtl.md`: the sheet mirrors for free because every
    // inline-axis declaration is logical. This fails the moment someone reaches
    // for `margin-left`, `left`, `text-align: right` or a physical float.
    expect(css).not.toMatch(
      /(margin|padding|border|inset)-(left|right)\s*:|(^|\s)(left|right)\s*:|text-align:\s*(left|right)|float:\s*(left|right)|clear:\s*(left|right)/m,
    );
  });
});
