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

// ─── solid tone fills (#302) ─────────────────────────────────────────────────

/**
 * Every solid fill a component paints a label on, with the foreground it pairs
 * with. Buttons, swipe actions, tooltips, badges, chips and calendar selections
 * all paint these, and `-hover` / `-active` carry the same label while the
 * pointer is on or down, so each state owes the same 4.5:1 (WCAG 1.4.3).
 *
 * The white-label fills move *away* from white on hover and press, in both
 * themes. The dark theme's status and accent-2 fills are instead light fills
 * carrying a near-black label, so they keep the dark theme's "hover lightens"
 * rule — lightening only raises that label's contrast.
 */
const SOLID_PAIRS = [
  ['--mlv-text-on-success', '--mlv-background-success-1'],
  ['--mlv-text-on-warning', '--mlv-background-warning-1'],
  ['--mlv-text-on-info', '--mlv-background-info-1'],
  ['--mlv-text-on-danger', '--mlv-background-danger-1'],
  ['--mlv-text-primary-on-accent-1', '--mlv-background-accent-1'],
  ['--mlv-text-primary-on-accent-2', '--mlv-background-accent-2'],
];

for (const theme of ['light', 'dark', 'highContrast']) {
  test(`${theme}: every solid-fill label clears AA at rest, hover and active`, () => {
    const failing = [];
    for (const [fg, bg] of SOLID_PAIRS) {
      for (const state of ['', '-hover', '-active']) {
        const r = ratioOf(fg, bg + state, theme, ctx);
        if (r < AA_TEXT) failing.push(`${fg} on ${bg}${state} = ${r}`);
      }
    }
    assert.deepEqual(failing, [], failing.join('; '));
  });
}

/**
 * The same rest fills are painted with no label at all: status-indicator dots on
 * the page, loader and progress fills on their `--mlv-border-subtle` track. A
 * non-text mark owes 3:1 against what it sits on (WCAG 1.4.11).
 *
 * Light and dark only: the high-contrast track (#999999) is a pre-existing gap
 * owned by the theme-scope batch (#303).
 */
for (const theme of ['light', 'dark']) {
  test(`${theme}: every solid fill clears 3:1 as a dot on the page or a fill on its track`, () => {
    const failing = [];
    for (const [, fill] of SOLID_PAIRS) {
      for (const bg of ['--mlv-background-base', '--mlv-background-subtle', '--mlv-background-raised', '--mlv-border-subtle']) {
        const r = ratioOf(fill, bg, theme, ctx);
        if (r < AA_NON_TEXT) failing.push(`${fill} on ${bg} = ${r}`);
      }
    }
    assert.deepEqual(failing, [], failing.join('; '));
  });
}

/**
 * The accent-1 hover fill is also a non-text state mark: the checked radio dot
 * and switch track on hover, and the stepper indicator ring. With a white
 * label, dark accent-1 has almost no room — the hover must stay dark enough
 * for 4.5:1 under white (above) and light enough for 3:1 on the dark surfaces
 * (here). Deepening toward black fails the second (2.55:1 on subtle).
 */
for (const theme of ['light', 'dark']) {
  test(`${theme}: the accent-1 hover fill clears 3:1 on the page surfaces`, () => {
    const failing = [];
    for (const bg of ['--mlv-background-base', '--mlv-background-subtle', '--mlv-background-raised']) {
      const r = ratioOf('--mlv-background-accent-1-hover', bg, theme, ctx);
      if (r < AA_NON_TEXT) failing.push(`--mlv-background-accent-1-hover on ${bg} = ${r}`);
    }
    assert.deepEqual(failing, [], failing.join('; '));
  });
}

test('the solid fills resolve to the values their contrast depends on', () => {
  // Light: one step darker than before (700 where it was 600, 700 where the
  // coral accent-2 was 500), so white clears AA. Danger (600) and accent-1
  // (primary-500) already did at rest.
  assert.equal(hex('--mlv-background-success-1', 'light'), '#15803d');
  assert.equal(hex('--mlv-background-warning-1', 'light'), '#b45309');
  assert.equal(hex('--mlv-background-info-1', 'light'), '#0369a1');
  assert.equal(hex('--mlv-background-accent-2', 'light'), '#d03e16');
  assert.equal(hex('--mlv-text-on-success', 'light'), '#ffffff');
  // Dark: the 500 steps under a near-black label. A white-label fill would
  // have to sit in the luminance window 0.158–0.183 to clear both 4.5:1 for
  // its label and 3:1 against the #262626 progress track; info has no step in
  // it (700 is 2.55:1 on the track, 600 is 4.10:1 under white).
  assert.equal(hex('--mlv-background-success-1', 'dark'), '#22c55e');
  assert.equal(hex('--mlv-background-info-1', 'dark'), '#0ea5e9');
  assert.equal(hex('--mlv-background-accent-2', 'dark'), '#fd774d');
  assert.equal(hex('--mlv-text-on-info', 'dark'), '#0a0a0a');
  assert.equal(hex('--mlv-text-primary-on-accent-2', 'dark'), '#0a0a0a');
  // accent-1 keeps white in both themes — `--mlv-text-primary-on-accent-1` is
  // also the "light in every theme" foreground of the neutral tooltip — so its
  // hover and press darken instead of lightening (toward primary-700 in dark).
  assert.equal(hex('--mlv-text-primary-on-accent-1', 'dark'), '#ffffff');
});
