import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as Sass from 'sass';
import { stripCssLayersFromText } from '@malva-ui/internal-testing';
import { describe, expect, it } from 'vitest';

// `sass` is a Node-only dependency; `createRequire` keeps it out of the browser-ish module graph.
const nodeRequire = createRequire(import.meta.url);
const sass = nodeRequire('sass') as typeof Sass;

const here = dirname(fileURLToPath(import.meta.url));
const SHEETS = {
  scheduler: resolve(here, './scheduler.scss'),
  month: resolve(here, '../month/scheduler-month.scss'),
  timeGrid: resolve(here, '../time-grid/scheduler-time-grid.scss'),
  event: resolve(here, '../event/scheduler-event.scss'),
};

const compile = (file: string) =>
  stripCssLayersFromText(sass.compile(file).css);

describe('scheduler stylesheets', () => {
  const css = Object.fromEntries(
    Object.entries(SHEETS).map(([k, f]) => [k, compile(f)]),
  ) as Record<keyof typeof SHEETS, string>;
  const all = Object.values(css).join('\n');

  it('ships every rule inside @layer mlv.components', () => {
    for (const file of Object.values(SHEETS)) {
      const raw = sass.compile(file).css;
      expect(raw.trimStart().startsWith('@layer mlv.components')).toBe(true);
    }
  });

  it('uses logical inline properties only (physical values are JS-fed and commented)', () => {
    const physical =
      all.match(
        /^\s*(margin|padding|border)-(left|right)\s*:|^\s*(left|right)\s*:|text-align\s*:\s*(left|right)/gm,
      ) ?? [];
    expect(physical).toEqual([]);
  });

  it('mirrors the toolbar chevrons through --mlv-inline-direction', () => {
    expect(css.scheduler).toMatch(
      /\.mlv-scheduler__nav-icon\s*\{[^}]*scaleX\(var\(--mlv-inline-direction\)\)/,
    );
    expect(css.event).toMatch(
      /\.mlv-scheduler-event__continuation\s*\{[^}]*scaleX\(var\(--mlv-inline-direction\)\)/,
    );
  });

  it('consumes the JS-fed geometry through custom properties', () => {
    expect(css.month).toMatch(
      /\.mlv-scheduler-month__event\s*\{[^}]*grid-row:\s*var\(--mlv-scheduler-lane, 1\)/,
    );
    expect(css.timeGrid).toMatch(
      /\.mlv-scheduler-time-grid__event\s*\{[^}]*inset-block-start:\s*var\(--mlv-scheduler-event-top, 0%\)/,
    );
    expect(css.timeGrid).toMatch(
      /\.mlv-scheduler-time-grid__now\s*\{[^}]*inset-block-start:\s*var\(--mlv-scheduler-offset, 0%\)/,
    );
  });

  it('provides a reduced-motion path for every animated block', () => {
    for (const block of [
      'mlv-scheduler',
      'mlv-scheduler-month',
      'mlv-scheduler-time-grid',
      'mlv-scheduler-event',
    ]) {
      expect(all).toMatch(
        new RegExp(`prefers-reduced-motion: reduce\\)[^{]*\\{[^}]*\\.${block}`),
      );
    }
  });

  it('never feeds a --mlv-padding-* pair to anything but the padding shorthand', () => {
    const misuse =
      all.match(/^\s*(?!padding\s*:)[a-z-]+\s*:[^;]*var\(--mlv-padding-/gm) ??
      [];
    expect(misuse).toEqual([]);
  });

  it('paints density through the slot and lane variables', () => {
    for (const density of [
      'tight',
      'compact',
      'comfortable',
      'spacious',
      'airy',
    ]) {
      expect(css.scheduler).toMatch(
        new RegExp(
          `\\.mlv-scheduler--${density}\\s*\\{[^}]*--mlv-scheduler-slot-height`,
        ),
      );
    }
  });

  // The chip carries the default Form A ring; only inside the time grid's
  // `MlvScrollbar` viewport — which clips an outset ring away entirely — is it
  // narrowed to Form B. Month lane cells are `overflow: visible` and keep A.
  it('draws the event chip focus ring inset only inside the time-grid scroller', () => {
    expect(css.event).toMatch(
      /\.mlv-scheduler-event:focus-visible\s*\{[^}]*outline-offset:\s*var\(--mlv-focus-ring-offset\)/,
    );
    expect(css.event).not.toMatch(
      /\.mlv-scheduler-event:focus-visible\s*\{[^}]*outline-offset:\s*calc\(var\(--mlv-focus-ring-offset\) \* -1\)/,
    );
    expect(css.timeGrid).toMatch(
      /\.mlv-scheduler-time-grid__scroller\s+\.mlv-scheduler-event:focus-visible\s*\{[^}]*outline-offset:\s*calc\(var\(--mlv-focus-ring-offset\) \* -1\)/,
    );
  });
});
