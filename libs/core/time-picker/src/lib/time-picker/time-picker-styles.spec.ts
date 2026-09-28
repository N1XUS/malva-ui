import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as Sass from 'sass';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';

// `sass` is a Node-only dependency; loading it through `createRequire` keeps it
// out of the browser-ish module graph vitest builds for this project.
const nodeRequire = createRequire(import.meta.url);
const sass = nodeRequire('sass') as typeof Sass;

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Returns the declaration block of the `nth` rule matching `selector`.
 *
 * `nth` defaults to the first. It matters because `mixins.base` emits its own
 * rule for the same selector ahead of the component's, so a selector that
 * includes the mixin has its real declarations in the second block.
 */
/**
 * Collapses the whitespace Sass and Prettier put inside a long `calc()` —
 * newlines after `(` and before `)` — so an assertion can pin the value as
 * written instead of the wrapping the formatter happened to choose.
 */
function collapse(body: string): string {
  return body.replace(/\s+/g, ' ').replace(/\(\s/g, '(').replace(/\s\)/g, ')');
}

function ruleBody(css: string, selector: string, nth = 0): string {
  const needle = `\n${selector} {`;
  let at = -1;
  for (let i = 0; i <= nth; i++) {
    at = css.indexOf(needle, at + 1);
    expect(at, `no rule #${i} for \`${selector}\``).toBeGreaterThan(-1);
  }
  const rest = css.slice(at + needle.length);
  return rest.slice(0, rest.indexOf('}'));
}

/**
 * The mobile sheet's drum sizing is expressed entirely in container-query
 * units, which jsdom cannot resolve — it implements no layout, so a
 * `getComputedStyle` assertion would read the unresolved text or nothing at
 * all. These read the compiled stylesheet instead, which is where the two
 * traps that cost the most time actually live: a `flex-basis` that silently
 * zeroes every `cqh`, and a custom property that looks inherited but is not.
 */
describe('time-picker.scss — mobile full-screen sheet', () => {
  // The stylesheet ships inside `@layer mlv.components`; the assertions anchor
  // selectors to the start of a line, so the wrapper is flattened away exactly
  // as it is for the jsdom specs.
  const css = stripCssLayersFromText(
    sass.compile(resolve(HERE, './time-picker.scss')).css,
  );

  const SHEET = '.mlv-time-picker__panel--sheet';
  const COLUMNS = `${SHEET} .mlv-time-picker__columns`;

  it('lets the panel claim the sheet height instead of hugging the drum', () => {
    const body = ruleBody(css, SHEET);
    // `flex: 1 1 0` with a *length* basis of zero, pinned as the full
    // three-value form: `flex: 1` is a substring of it, and the shorthand
    // expands to a `0%` basis that leaves the row's height content-dependent
    // against this indefinite ancestor chain — `container-type: size` below
    // then has no definite height and every `cqh` resolves to 0, so the drum
    // falls to its 2.75rem floor. Measured by ablation in Chrome at 375x812:
    // `flex: 1 1 0` on either this element or the row below gives a 719px row;
    // `flex: 1` on both gives 0. `flex: none` collapses the row outright.
    expect(body).toContain('flex: 1 1 0');
    expect(body).not.toContain('min-height');
    // `--mlv-popover-inset` is the shared *dropdown* inset; the sheet's padding
    // comes from `.mlv-popup--fullscreen`'s own `__inner` rule.
    expect(body).toContain('padding: 0');
  });

  it('makes the drum row the size container', () => {
    // The one declaration in the block that changes the rendered result. With
    // `container-type: normal` every `cqh` resolves against the viewport
    // instead: measured 162px rows and an 812px track inside a 719px row, so
    // the drum overruns the sheet.
    const body = ruleBody(css, COLUMNS);
    expect(body).toContain('container-type: size');
    expect(body).toContain('flex: 1 1 0');
  });

  it('clips the drum when the row floor wins', () => {
    // Size containment is not paint containment. Measured by forcing the row
    // short in Chrome: at a 107px row the floored 220px track spilled 113px,
    // 57px of it above the row, and the scroll viewport clipped it — rows cut
    // at both ends and the centre stripe off-centre. Clipping here degrades to
    // fewer visible neighbours around a centred, legible selected row instead.
    expect(ruleBody(css, COLUMNS)).toContain('overflow: hidden');
  });

  it('centres the drum on the inline axis', () => {
    // Invisible in a dropdown, where the panel shrink-wraps to the columns, and
    // plain once `__inner`'s default `align-items: stretch` makes the sheet
    // panel full-width.
    expect(ruleBody(css, COLUMNS)).toContain('justify-content: center');
  });

  it('grows the rows rather than showing more of them', () => {
    const body = ruleBody(css, COLUMNS);
    // Seven rows against the desktop five — the top of the 5-7 range the drum
    // is designed for. Five would put a two-digit numeral in a 144px row at
    // 375x812; seven lands near 103px. The rows divide the container exactly
    // (7 x 100cqh/7 = 100cqh), and the divisor is the row-count variable, not
    // a second `7`: the sheet is one parameter, like the column (#142).
    expect(body).toContain('--mlv-tp-visible-rows: 7');
    expect(collapse(body)).toContain(
      '--mlv-tp-item-height: max(2.75rem, calc(100cqh / var(--mlv-tp-visible-rows)))',
    );
    expect(body).toContain(
      '--mlv-tp-font-size: max(var(--mlv-font-size-l), 6cqh)',
    );
  });

  it('re-declares the track height on the element that overrides the item height', () => {
    // The trap: a custom property's `var()`s are substituted on the element
    // that *declares* it. `__panel`'s
    // `--mlv-tp-track-height: calc(var(--mlv-tp-item-height) * var(--mlv-tp-visible-rows, 5))`
    // has already resolved against the density item height by the time it
    // reaches this row, so inheriting it would leave a 180px track around
    // 103px rows -- 1.75 rows deep -- while the rows themselves grew to fill
    // the sheet.
    expect(collapse(ruleBody(css, COLUMNS))).toContain(
      '--mlv-tp-track-height: calc(var(--mlv-tp-item-height) * var(--mlv-tp-visible-rows))',
    );
  });

  it('derives the desktop track height from the row count too', () => {
    // #142: `__panel` handed down `calc(var(--mlv-tp-item-height) * 5)`, so a
    // consumer setting `--mlv-tp-visible-rows: 7` on the panel — the
    // documented API — got the column's 7-row stripe offset inside a 5-row
    // track: the stripe on row 4 of 5, three rows above it and one below. The
    // divider and the AM/PM column read the same value, so it has to hold on
    // the panel, not only on the sheet's re-declaration above.
    expect(collapse(ruleBody(css, '.mlv-time-picker__panel'))).toContain(
      '--mlv-tp-track-height: calc(var(--mlv-tp-item-height) * var(--mlv-tp-visible-rows, 5))',
    );
  });

  it('keeps no bare row-count literal behind on the panel or the sheet', () => {
    // The column has the same guard; this one covers the two elements that
    // set the count. A surviving `* 5` in a track height or a `/ 7` under
    // `100cqh` is a length that silently ignores the override.
    expect(css).not.toMatch(
      /--mlv-tp-track-height:\s*calc\(\s*var\(--mlv-tp-item-height\)\s*\*\s*\d/,
    );
    expect(css).not.toMatch(/100cqh\s*\/\s*\d/);
  });
});

/*
 * The drum's own geometry — the derived side-row count, the snap port, the
 * centre stripe offset and the font-size chain — moved to
 * `@malva-ui/core/scrubber` with the component (#129) and is asserted by
 * `libs/core/scrubber/src/lib/scrubber/scrubber-styles.spec.ts`. What stays
 * this component's business is the alias layer below, which is what makes those
 * lengths answer to `--mlv-tp-*`.
 */

// ---------------------------------------------------------------------------
// `--mlv-tp-*` → `--mlv-scrubber-*` alias layer (#129)
// ---------------------------------------------------------------------------

/**
 * The drum itself is now `@malva-ui/core/scrubber`, which declares its own
 * `--mlv-scrubber-*` prefix. `--mlv-tp-*` is a published surface, so none of
 * those names may disappear **and no consumer override may break**: the
 * `<mlv-scrubber>` element declares every published name's twin, so a
 * `--mlv-tp-*` override anywhere above the strip is inherited into the alias
 * and reaches the drum.
 *
 * The include site is the whole contract. A custom property's `var()`s are
 * substituted on the element that *declares* it, so aliases on the panel
 * resolve against the panel's values and freeze there — everything a consumer
 * writes below is dropped, and a consumer cannot include a Sass mixin to opt
 * back in. Measured in Chrome with the aliases on `.mlv-time-picker__panel`
 * and the overrides on `.mlv-time-picker__columns`: `--mlv-tp-font-size: 2rem`
 * + `--mlv-tp-track-height: 300px` moved the `:` divider (14px → 32px, 180 →
 * 300) and left the drum beside it at 14px / 180, and
 * `--mlv-tp-visible-rows: 7` was a no-op in the anchored dropdown.
 */
describe('time-picker.scss — scrubber token aliases', () => {
  const css = stripCssLayersFromText(
    sass.compile(resolve(HERE, './time-picker.scss')).css,
  );

  const PANEL = '.mlv-time-picker__panel';
  const STRIP = `${PANEL} mlv-scrubber`;
  const SHEET_COLUMNS =
    '.mlv-time-picker__panel--sheet .mlv-time-picker__columns';

  /** Each alias, in the exact form the strip must declare it. */
  const ALIASES = [
    ['--mlv-scrubber-visible-rows', 'var(--mlv-tp-visible-rows, 5)'],
    ['--mlv-scrubber-side-rows', 'var(--mlv-tp-side-rows)'],
    ['--mlv-scrubber-item-size', 'var(--mlv-tp-item-height, 2.25rem)'],
    ['--mlv-scrubber-track-size', 'var(--mlv-tp-track-height)'],
    ['--mlv-scrubber-cross-size', 'var(--mlv-tp-column-width, 3.5rem)'],
    [
      '--mlv-scrubber-font-size',
      'var(--mlv-tp-font-size, var(--mlv-font-size-m))',
    ],
  ] as const;

  it.each(ALIASES)(
    'maps %s onto the published name, on the strip itself',
    (alias, source) => {
      expect(ruleBody(css, STRIP).replace(/\s+/g, ' ')).toContain(
        `${alias}: ${source}`,
      );
    },
  );

  it('declares the aliases nowhere but the strip', () => {
    // An alias on any ancestor is not a redundant copy — it is a *shadow* that
    // wins for its own subtree at the point it resolved, which is what made
    // `--mlv-tp-visible-rows` a no-op in the anchored dropdown while the sheet
    // (which happened to re-include the mixin on the element carrying the
    // overrides) looked fine.
    const stripBody = ruleBody(css, STRIP);
    for (const selector of [
      PANEL,
      SHEET_COLUMNS,
      '.mlv-time-picker__columns',
    ]) {
      // `mixins.base` splits a selector's block in two, so check every block
      // the selector opens rather than only the first.
      let at = -1;
      for (;;) {
        at = css.indexOf(`\n${selector} {`, at + 1);
        if (at === -1) break;
        const rest = css.slice(at);
        const body = rest.slice(0, rest.indexOf('}'));
        expect(
          body,
          `\`${selector}\` must not shadow the alias layer`,
        ).not.toContain('--mlv-scrubber-');
      }
    }
    expect(stripBody).toContain('--mlv-scrubber-');
  });

  it('keeps every published --mlv-tp-* custom property declared and live', () => {
    // Renaming a published custom property is consumer-visible; aliasing avoids
    // it entirely. This is the guard on that promise, and it enumerates all
    // **nine** — `--mlv-tp-side-rows` included, which an earlier draft of #129
    // dropped while this list still read eight and therefore stayed green.
    //
    // Declared is not enough: a name that nothing reads is vestigial, and the
    // drum would not move if a consumer set it. So each one must also appear
    // inside a `var()` somewhere — for the six geometry names that is the alias
    // layer, for the AM/PM pair the button rules.
    const PUBLISHED = [
      '--mlv-tp-item-height',
      '--mlv-tp-column-width',
      '--mlv-tp-ampm-width',
      '--mlv-tp-track-height',
      '--mlv-tp-font-size',
      '--mlv-tp-visible-rows',
      '--mlv-tp-side-rows',
      '--mlv-tp-ampm-height',
      '--mlv-tp-ampm-font-size',
    ];
    for (const name of PUBLISHED) {
      expect(css, `\`${name}\` is no longer declared`).toContain(`${name}:`);
      expect(css, `\`${name}\` is declared but never read`).toContain(
        `var(${name}`,
      );
    }
  });
});

/**
 * #370 localizes the AM / PM buttons through `MlvDateAdapter.getDayPeriodNames()`,
 * so their text is no longer always "AM" / "PM": `es` reads "a. m." / "p. m.",
 * `nl` / `ro` / `pt-PT` and an `en-CA` locale "a.m." / "p.m.". A fixed column
 * `width` clipped those under the buttons' `nowrap` + `overflow: hidden` text
 * (Chrome 153, compact: "a. m." 32.3px in a 28px content box). The token
 * stays the column's size and `min-inline-size: max-content` is its floor, so
 * a longer label grows the column. A label that fits keeps the old geometry,
 * including the shrink the full-screen sheet with seconds needs.
 * `min-inline-size: <token>` was rejected because it stopped that shrink and
 * moved width from the drums into AM / PM (375px sheet: drums 77.4 → 73.8px).
 * jsdom performs no layout, so the compiled rule is what can be pinned here.
 */
describe('time-picker.scss — AM/PM column width (#370)', () => {
  const css = stripCssLayersFromText(
    sass.compile(resolve(HERE, './time-picker.scss')).css,
  );
  const ampm = collapse(ruleBody(css, '.mlv-time-picker__ampm'));

  it('sizes the column from the density token on the logical axis', () => {
    expect(ampm).toMatch(/(^|[;\s])inline-size: var\(--mlv-tp-ampm-width\);/);
    expect(ampm).not.toMatch(/(^|[;\s])width:/);
  });

  it('floors the column at its content so a longer day-period label is not clipped', () => {
    expect(ampm).toContain('min-inline-size: max-content;');
  });
});
