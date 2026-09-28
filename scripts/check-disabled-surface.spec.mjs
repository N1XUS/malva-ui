import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DISABLED_OPACITY,
  analyseCss,
  checkWorkspace,
  isDisabledSelector,
  stripNegations,
} from './check-disabled-surface.mjs';

const WORKSPACE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = 'libs/core/x/src/lib/x/x.scss';

/** Findings for `css` with an optional allow-list, kinds only. */
const kinds = (css, options = {}) =>
  analyseCss(css, FILE, {
    opacityAllowed: [],
    stateTintAllowed: [],
    ...options,
  }).map((finding) => `${finding.kind} ${finding.selector}`);

// ─── Selector classification ─────────────────────────────────────────────────

test('stripNegations removes :not() groups, nested parentheses included', () => {
  assert.equal(stripNegations('.a:hover:not(:disabled)'), '.a:hover');
  assert.equal(stripNegations('.a:not(.a--x:not(.a--y)) .b'), '.a .b');
});

test('isDisabledSelector recognises every disabled marker', () => {
  for (const selector of [
    '.mlv-x--disabled',
    '.mlv-x--disabled .mlv-x__y',
    '.mlv-x:disabled',
    '.mlv-x[disabled]',
    ".mlv-x[aria-disabled='true']",
    '.mlv-x[aria-disabled=true]',
    '.mlv-x[aria-disabled]',
  ]) {
    assert.equal(isDisabledSelector(selector), true, selector);
  }
});

test('isDisabledSelector ignores enabled-state selectors', () => {
  for (const selector of [
    '.mlv-x:hover:not(:disabled)',
    '.mlv-x:not(.mlv-x--disabled)',
    ".mlv-x[aria-disabled='false']",
    '.mlv-x--disabled-looking',
    '.mlv-x__disabled',
  ]) {
    assert.equal(isDisabledSelector(selector), false, selector);
  }
});

// ─── SF-R4: opacity under a disabled selector ────────────────────────────────

test('flags an opacity multiply on a disabled state (token or literal)', () => {
  assert.deepEqual(
    kinds(`
      .mlv-x--disabled { opacity: var(--mlv-disabled-opacity); }
      .mlv-y:disabled { opacity: 0.5; }
      .mlv-z[aria-disabled=true] .mlv-z__label { opacity: .4; }
    `),
    [
      'opacity-under-disabled .mlv-x--disabled',
      'opacity-under-disabled .mlv-y:disabled',
      'opacity-under-disabled .mlv-z[aria-disabled=true] .mlv-z__label',
    ],
  );
});

test('checks every selector of a list on its own', () => {
  assert.deepEqual(kinds('.mlv-x:hover, .mlv-x--disabled { opacity: 0.4; }'), [
    'opacity-under-disabled .mlv-x--disabled',
  ]);
});

test('passes a hide (0), a reset (1), enabled-state opacity and keyframes', () => {
  assert.deepEqual(
    kinds(`
      .mlv-x--disabled .mlv-x__tooltip { opacity: 0; visibility: hidden; }
      .mlv-x--disabled .mlv-x__glyph { opacity: 1; }
      .mlv-x:hover:not(:disabled) { opacity: 0.8; }
      .mlv-x__icon { opacity: var(--mlv-x-icon-opacity, 0.5); }
      @keyframes mlv-x-disabled { from { opacity: 0.4; } }
    `),
    [],
  );
});

test('an allow-listed selector passes only with the exact token', () => {
  const entry = {
    file: FILE,
    selector: '.mlv-x--disabled .mlv-x__plane',
    reason: 'colour data',
  };
  assert.deepEqual(
    kinds(`.mlv-x--disabled .mlv-x__plane { opacity: ${DISABLED_OPACITY}; }`, {
      opacityAllowed: [entry],
    }),
    [],
  );
  assert.deepEqual(
    kinds('.mlv-x--disabled .mlv-x__plane { opacity: 0.45; }', {
      opacityAllowed: [entry],
    }),
    ['literal-opacity .mlv-x--disabled .mlv-x__plane'],
  );
});

test('an allow-list entry for another file does not apply', () => {
  const entry = {
    file: 'libs/core/other/other.scss',
    selector: '.mlv-x--disabled',
    reason: '',
  };
  assert.deepEqual(
    kinds('.mlv-x--disabled { opacity: var(--mlv-disabled-opacity); }', {
      opacityAllowed: [entry],
    }),
    ['opacity-under-disabled .mlv-x--disabled'],
  );
});

test('flags a fallback on the disabled-opacity token anywhere', () => {
  assert.deepEqual(
    kinds('.mlv-x__y { --mlv-x-dim: var(--mlv-disabled-opacity, 0.56); }'),
    ['opacity-fallback .mlv-x__y'],
  );
});

// ─── SF-R6: non-error state tints ────────────────────────────────────────────

test('flags a success, warning or info state tint and keeps error', () => {
  assert.deepEqual(
    kinds(`
      .mlv-x--state-error .mlv-x__y { color: var(--mlv-border-error); }
      .mlv-x--state-warning .mlv-x__y { color: var(--mlv-border-warning); }
      .mlv-x--state-success .mlv-x__y { color: var(--mlv-border-success); }
      .mlv-x--state-info .mlv-x__y { color: var(--mlv-border-info); }
      .mlv-x--state-informative { color: red; }
    `),
    [
      'state-tint .mlv-x--state-warning .mlv-x__y',
      'state-tint .mlv-x--state-success .mlv-x__y',
      'state-tint .mlv-x--state-info .mlv-x__y',
    ],
  );
});

test('flags a state tint even when the rule declares no colour', () => {
  assert.deepEqual(
    kinds('.mlv-x--state-success { border-inline-start: 1px solid; }'),
    ['state-tint .mlv-x--state-success'],
  );
});

// ─── The workspace ───────────────────────────────────────────────────────────

test('every component stylesheet under libs/ honours both rules', () => {
  const { scanned, findings } = checkWorkspace(WORKSPACE);
  // Floor: the walk must see the library, or a clean answer is vacuous.
  assert.ok(scanned > 100, `scanned ${scanned} stylesheets`);
  assert.deepEqual(
    findings.map(
      (finding) => `${finding.kind} ${finding.file} ${finding.selector}`,
    ),
    [],
  );
});

test('a stale allow-list entry fails the workspace check', () => {
  const stale = {
    file: FILE,
    selector: '.mlv-nothing--disabled',
    reason: 'gone',
  };
  const { findings } = checkWorkspace(WORKSPACE, {
    opacityAllowed: [stale],
    stateTintAllowed: [],
  });
  assert.ok(
    findings.some(
      (finding) =>
        finding.kind === 'stale-allow' && finding.selector === stale.selector,
    ),
  );
});
