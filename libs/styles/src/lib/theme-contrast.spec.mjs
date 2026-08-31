import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  contrastRatio,
  loadRegions,
  loadScssVariables,
  parseHex,
  ratioOf,
  resolveColor,
  toHex,
} from './theme-contrast.mjs';

const SOURCE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'theme.scss'),
  'utf8',
);

const ctx = { regions: loadRegions(SOURCE), scssVars: loadScssVariables(SOURCE) };

/** WCAG 2.1 AA floor for normal-size text. */
const AA_TEXT = 4.5;
/** WCAG 2.1 AA floor for non-text UI parts (focus rings, state dots, borders). */
const AA_NON_TEXT = 3;
/**
 * Headroom we require above the floor for a shared token, so an ordinary future
 * tweak cannot land back under AA. A pairing at 4.51 is treated as a failure.
 */
const MARGIN = 0.4;

const hex = (token, theme) => toHex(resolveColor(`var(${token})`, theme, ctx));

// ─── resolver ────────────────────────────────────────────────────────────────

test('defines a dedicated code font family and routes code typography through it', () => {
  assert.match(SOURCE, /--mlv-font-family-code:\s*[\s\S]*Fira Code/);
  assert.match(SOURCE, /--mlv-font-family-code:[\s\S]*'JetBrains Mono'/);
  assert.match(
    SOURCE,
    /--mlv-typography-family-code:\s*var\(--mlv-font-family-code\)/,
  );
  assert.match(
    SOURCE,
    /--mlv-typography-code-family:\s*var\(--mlv-font-family-code\)/,
  );
});

test('resolver reads hex, SCSS interpolation, var() and color-mix', () => {
  assert.deepEqual(parseHex('#90aaeb'), [144, 170, 235]);
  assert.deepEqual(parseHex('#fff'), [255, 255, 255]);
  assert.equal(hex('--mlv-palette-primary-300', 'light'), '#90aaeb');
  assert.equal(hex('--mlv-palette-primary-500', 'light'), '#5770cb');
  // 85% of #90aaeb mixed with white, in gamma-encoded sRGB.
  assert.equal(
    toHex(
      resolveColor(
        'color-mix(in srgb, var(--mlv-palette-primary-300) 85%, white)',
        'dark',
        ctx,
      ),
    ),
    '#a1b7ee',
  );
});

test('contrastRatio matches the WCAG reference values', () => {
  assert.equal(contrastRatio([255, 255, 255], [0, 0, 0]), 21);
  assert.equal(contrastRatio([255, 255, 255], [255, 255, 255]), 1);
});

test('dark tokens fall back to the light declaration when not overridden', () => {
  // Declared once in the light region, inherited by [mlvTheme='dark'].
  assert.equal(hex('--mlv-palette-neutral-800', 'dark'), '#262626');
});

// ─── resolved values the ratios below depend on ──────────────────────────────

test('dark action + neutral interaction tokens resolve to their intended values', () => {
  assert.equal(hex('--mlv-text-action', 'dark'), '#a1b7ee');
  assert.equal(hex('--mlv-text-action-hover', 'dark'), '#b7c8f2');
  assert.equal(hex('--mlv-background-neutral-1', 'dark'), '#262626');
  // The neutral interactive ramp steps onto the dark elevation ladder.
  assert.equal(hex('--mlv-background-neutral-1-hover', 'dark'), '#333333');
  assert.equal(hex('--mlv-background-neutral-1-active', 'dark'), '#404040');
  assert.equal(hex('--mlv-background-neutral-1-hover', 'dark'), hex('--mlv-elevation-bg-3', 'dark'));
  assert.equal(hex('--mlv-background-neutral-1-active', 'dark'), hex('--mlv-elevation-bg-4', 'dark'));
});

test('light action + neutral interaction tokens resolve to their intended values', () => {
  // primary-600, restored 2026-08-25 per owner override — see theme.scss.
  assert.equal(hex('--mlv-text-action', 'light'), '#4359b1');
  assert.equal(hex('--mlv-background-neutral-1', 'light'), '#f5f5f5');
  assert.equal(hex('--mlv-background-neutral-1-hover', 'light'), '#efefef');
  assert.equal(hex('--mlv-background-neutral-1-active', 'light'), '#e5e5e5');
  // SL-R1 had deepened the sunken floor one palette stop to #e5e5e5 (a real
  // fourth rung instead of duplicating neutral-1); owner override 2026-08-25
  // restored it to neutral-100 (#f5f5f5) — settings-access's static "recessed
  // tray" sections (sunken consumer) read too dark at #e5e5e5, and the
  // data-table row hover, which used to borrow this same token, has since
  // been moved onto --mlv-background-neutral-1-hover instead (see
  // data-table.scss) so nothing else depends on sunken being the deepest step.
  assert.equal(hex('--mlv-background-sunken', 'light'), '#f5f5f5');
  // SF-R5's "pressed floor === sunken floor" invariant no longer holds after
  // the override above (active stays #e5e5e5, sunken is now #f5f5f5, one rung
  // lighter) — that's the accepted owner tradeoff, not a regression.
  // SF-R1: selection is its own token, resolved through indirection onto
  // the accent-1-pale family.
  assert.equal(hex('--mlv-background-selected', 'light'), '#ebeef9');
});

// ─── the regression this guard exists for ────────────────────────────────────

/**
 * Every surface `--mlv-text-action` legitimately lands on, in dark.
 *
 * `--mlv-elevation-bg-5` is deliberately absent: its only consumer paints it as
 * a switch track (`libs/core/switch`), never behind text.
 */
const DARK_ACTION_SURFACES = [
  '--mlv-background-base',
  '--mlv-background-subtle',
  '--mlv-background-raised',
  '--mlv-elevation-bg-1',
  '--mlv-elevation-bg-2',
  '--mlv-elevation-bg-3',
  '--mlv-elevation-bg-4',
  '--mlv-background-neutral-1',
  '--mlv-background-neutral-1-hover',
  '--mlv-background-neutral-1-active',
  '--mlv-background-accent-1-pale',
  '--mlv-background-accent-1-pale-hover',
];

for (const theme of ['light', 'dark']) {
  for (const action of ['--mlv-text-action', '--mlv-text-action-hover']) {
    test(`${theme}: ${action} clears AA on every surface it is used on`, () => {
      const surfaces = theme === 'dark'
        ? DARK_ACTION_SURFACES
        : ['--mlv-background-base', '--mlv-background-subtle', '--mlv-background-raised',
           '--mlv-background-neutral-1', '--mlv-background-neutral-1-hover',
           '--mlv-background-neutral-1-active', '--mlv-background-accent-1-pale'];
      const scored = surfaces.map((s) => [s, ratioOf(action, s, theme, ctx)]);
      const failing = scored.filter(([, r]) => r < AA_TEXT + MARGIN);
      assert.deepEqual(
        failing,
        [],
        `below ${AA_TEXT} + ${MARGIN} margin: ${failing.map(([s, r]) => `${s}=${r}`).join(', ')}`,
      );
    });
  }
}

test('dark: the pairings QA measured are fixed, with their exact ratios', () => {
  // mlv-button[variant="secondary"] and mlv-segmented's active label — the
  // controls QA hit axe violations on. Rest was 4.45:1 (under AA); hover and
  // active were 1.96:1 and 1.21:1 because the neutral ramp jumped to mid-grey.
  assert.equal(ratioOf('--mlv-text-action', '--mlv-elevation-bg-2', 'dark', ctx), 7.56);
  assert.equal(ratioOf('--mlv-text-action', '--mlv-background-neutral-1', 'dark', ctx), 7.56);
  assert.equal(ratioOf('--mlv-text-action', '--mlv-background-neutral-1-hover', 'dark', ctx), 6.31);
  assert.equal(ratioOf('--mlv-text-action', '--mlv-background-neutral-1-active', 'dark', ctx), 5.18);
  // mlv-tab-item--active ("Preview" / "HTML" / "TypeScript") on the raised card.
  assert.equal(ratioOf('--mlv-text-action', '--mlv-background-raised', 'dark', ctx), 8.33);
  // mlv-segmented[tone="accent"] active pill.
  assert.equal(ratioOf('--mlv-text-action', '--mlv-background-accent-1-pale', 'dark', ctx), 7.68);
});

test('dark: no foreground is stranded on the neutral interaction ramp', () => {
  // The old ramp put white body text at 4.13:1 on the active step. Any token a
  // component may paint on a pressed neutral surface has to survive it.
  for (const fg of ['--mlv-text-primary', '--mlv-text-secondary', '--mlv-text-action']) {
    for (const bg of ['--mlv-background-neutral-1', '--mlv-background-neutral-1-hover', '--mlv-background-neutral-1-active']) {
      const r = ratioOf(fg, bg, 'dark', ctx);
      assert.ok(r >= AA_TEXT + MARGIN, `${fg} on ${bg} = ${r}, below ${AA_TEXT + MARGIN}`);
    }
  }
});

test('dark: --mlv-border-focus keeps the brand hue and still clears the 3:1 non-text floor', () => {
  assert.equal(hex('--mlv-border-focus', 'dark'), '#6c88dd');
  for (const bg of ['--mlv-background-base', '--mlv-background-raised', '--mlv-background-neutral-1',
                    '--mlv-background-neutral-1-hover', '--mlv-background-neutral-1-active']) {
    const r = ratioOf('--mlv-border-focus', bg, 'dark', ctx);
    assert.ok(r >= AA_NON_TEXT, `--mlv-border-focus on ${bg} = ${r}, below ${AA_NON_TEXT}`);
  }
});

// ─── wider semantic-token sweep ──────────────────────────────────────────────

/** Surfaces a message/status colour is actually rendered on: page and card, both themes. */
const MESSAGE_SURFACES = [
  '--mlv-background-base',
  '--mlv-background-subtle',
  '--mlv-background-raised',
  '--mlv-background-neutral-1',
  '--mlv-background-sunken',
];

for (const theme of ['light', 'dark']) {
  test(`${theme}: semantic message text clears AA on the surfaces it renders on`, () => {
    const failing = [];
    for (const fg of ['--mlv-text-positive', '--mlv-text-negative', '--mlv-text-warning',
                      '--mlv-text-info', '--mlv-text-secondary']) {
      for (const bg of MESSAGE_SURFACES) {
        const r = ratioOf(fg, bg, theme, ctx);
        if (r < AA_TEXT) failing.push(`${fg} on ${bg} = ${r}`);
      }
    }
    assert.deepEqual(failing, [], failing.join('; '));
  });
}
