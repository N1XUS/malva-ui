import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  analyseStylesheet,
  analyseTemplate,
  checkFiles,
  loadPairTokens,
  stripComments,
} from './check-padding-tokens.mjs';

const THEME = `
:root {
  --mlv-padding-xs: var(--mlv-spacing-1) var(--mlv-spacing-2);
  --mlv-padding-s: var(--mlv-spacing-1-5) var(--mlv-spacing-3);
  --mlv-padding-m: var(--mlv-spacing-2) var(--mlv-spacing-4);
  --mlv-padding-l: var(--mlv-spacing-3) var(--mlv-spacing-6);
  --mlv-padding-single: 1rem;
  --mlv-padding-calc: calc(1rem + 2px);
}
`;

const pairTokens = loadPairTokens(THEME);
const pairNames = new Set(pairTokens.keys());

/** Findings only, for the common assertion shape. */
const check = (source) => analyseStylesheet(source, pairNames).findings;

// ─── loadPairTokens ──────────────────────────────────────────────────────────

test('loadPairTokens keeps two-value tokens and records both halves', () => {
  assert.deepEqual(
    [...pairTokens.keys()],
    [
      '--mlv-padding-xs',
      '--mlv-padding-s',
      '--mlv-padding-m',
      '--mlv-padding-l',
    ],
  );
  assert.deepEqual(pairTokens.get('--mlv-padding-m'), {
    name: '--mlv-padding-m',
    block: '--mlv-spacing-2',
    inline: '--mlv-spacing-4',
  });
});

test('loadPairTokens ignores single-value and calc() padding tokens', () => {
  assert.equal(pairTokens.has('--mlv-padding-single'), false);
  assert.equal(pairTokens.has('--mlv-padding-calc'), false);
});

// ─── stripComments ───────────────────────────────────────────────────────────

test('stripComments blanks line and block comments but keeps newlines and urls', () => {
  const source = [
    'a { // padding-left: var(--mlv-padding-m)',
    '  background: url(https://x.test/a.png);',
    '  /* padding-left: var(--mlv-padding-m)',
    '     still comment */ color: red;',
    '  content: "//not a comment";',
    '}',
  ].join('\n');
  const stripped = stripComments(source);
  assert.equal(stripped.split('\n').length, source.split('\n').length);
  assert.equal(stripped.includes('padding-left'), false);
  assert.ok(stripped.includes('url(https://x.test/a.png)'));
  assert.ok(stripped.includes('content: "//not a comment"'));
  assert.ok(stripped.includes('color: red;'));
});

// ─── allowed usages ──────────────────────────────────────────────────────────

test('sole padding shorthand value is allowed', () => {
  assert.deepEqual(check('.a { padding: var(--mlv-padding-m); }'), []);
  assert.deepEqual(
    check('.a { padding: var(--mlv-padding-m) !important; }'),
    [],
  );
  assert.deepEqual(
    check('.a { padding:var(--mlv-padding-m, 0.5rem 1rem); }'),
    [],
  );
});

test('padding key inside a Sass map is allowed', () => {
  const source = `
$sizes: (
  s: (
    padding: 0.625rem,
    radius: var(--mlv-radius-s),
  ),
  m: (
    padding: var(--mlv-padding-s),
    radius: var(--mlv-radius-m),
  ),
);
.a { padding: map.get($values, padding); }
`;
  assert.deepEqual(check(source), []);
});

test('mixins.base() accepts the pair as its 4th ($padding) argument, single- or multi-line', () => {
  const singleLine =
    '.a { @include mixins.base(var(--mlv-typography-family-text), var(--mlv-typography-body-m-size), 0, var(--mlv-padding-xs)); }';
  const multiLine = `
.a {
  @include mixins.base(
    var(--mlv-typography-family-text),
    var(--mlv-typography-body-m-size),
    0,
    var(--mlv-padding-xs)
  );
}`;
  const keyword = '.a { @include base($padding: var(--mlv-padding-xs)); }';
  assert.deepEqual(check(singleLine), []);
  assert.deepEqual(check(multiLine), []);
  assert.deepEqual(check(keyword), []);
});

test('commented-out misuse is ignored', () => {
  const source = `
.a {
  // padding-left: var(--mlv-padding-m);
  /* gap: var(--mlv-padding-s); */
  padding: var(--mlv-padding-m);
}`;
  assert.deepEqual(check(source), []);
});

// ─── flagged usages ──────────────────────────────────────────────────────────

test('single-length padding longhands are flagged as dropped declarations', () => {
  const findings = check(
    '.a {\n  color: red;\n  padding-left: var(--mlv-padding-m);\n}',
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].line, 3);
  assert.equal(findings[0].token, '--mlv-padding-m');
  assert.equal(findings[0].context, 'padding-left: var(--mlv-padding-m)');
  assert.match(findings[0].reason, /padding-left.*single length.*dropped/);
});

test('padding-inline / padding-block are flagged as asymmetric splits', () => {
  const findings = check(
    '.a { padding-inline: var(--mlv-padding-l); padding-block: var(--mlv-padding-l); }',
  );
  assert.equal(findings.length, 2);
  assert.match(findings[0].reason, /padding-inline.*asymmetric/);
  assert.match(findings[1].reason, /padding-block.*asymmetric/);
});

test('multi-value padding shorthands are flagged for every pair inside them', () => {
  const four = check('.a { padding: 0 var(--mlv-padding-l) 0.875rem 4rem; }');
  assert.equal(four.length, 1);
  assert.match(four[0].reason, /multi-value `padding` shorthand/);

  const two = check(
    '.a { padding: var(--mlv-padding-xs) var(--mlv-padding-m); }',
  );
  assert.deepEqual(
    two.map((f) => f.token),
    ['--mlv-padding-xs', '--mlv-padding-m'],
  );
});

test('gap, margin and offsets are flagged as non-padding properties', () => {
  const findings = check(`
.a {
  gap: var(--mlv-padding-s);
  margin: var(--mlv-padding-xs) 0;
  margin-block-start: var(--mlv-padding-s);
  top: var(--mlv-padding-m);
}`);
  assert.deepEqual(
    findings.map((f) => f.line),
    [3, 4, 5, 6],
  );
  assert.match(findings[0].reason, /used in `gap:`/);
  assert.match(findings[1].reason, /used in `margin:`/);
  assert.match(findings[2].reason, /margin-block-start.*single length/);
  assert.match(findings[3].reason, /used in `top:`/);
});

test('a pair nested in a var() fallback or calc() is flagged', () => {
  const fallback = check(
    '.a { top: var(--mlv-page-aside-offset, var(--mlv-padding-m)); }',
  );
  assert.equal(fallback.length, 1);
  assert.match(fallback[0].reason, /nested inside `var\(\)` in `top:`/);

  const calc = check(
    '.a { padding: var(--mlv-padding-m) calc(var(--mlv-padding-m) * 1.5); }',
  );
  assert.equal(calc.length, 2);
  assert.match(calc[0].reason, /multi-value `padding` shorthand/);
  assert.match(calc[1].reason, /nested inside `calc\(\)`/);
});

test('mixins.base() rejects the pair in any position but the 4th', () => {
  const findings = check(
    '.a { @include mixins.base(var(--mlv-padding-m), 1rem, 0, 0); }',
  );
  assert.equal(findings.length, 1);
  assert.match(findings[0].reason, /argument 1 of `mixins\.base\(\)`.*4th/);
});

test('assigning the pair to a Sass variable is flagged with a redirection hint', () => {
  const findings = check('$pad: var(--mlv-padding-m);\n.a { padding: $pad; }');
  assert.equal(findings.length, 1);
  assert.match(findings[0].reason, /Sass variable `\$pad`.*custom property/);
});

// ─── aliases ─────────────────────────────────────────────────────────────────

test('a custom property assigned the pair becomes an alias and is tracked like the token', () => {
  const files = [
    {
      path: 'libs/a/button.scss',
      source: `
.mlv-button {
  --mlv-btn-padding: var(--mlv-padding-m);
  padding: var(--mlv-btn-padding);
  --mlv-btn-inner: var(--mlv-btn-padding);
}
.mlv-button__icon { padding-inline: var(--mlv-btn-inner); }
`,
    },
  ];
  const { findings, aliases } = checkFiles(files, pairTokens);
  assert.deepEqual([...aliases].sort(), [
    '--mlv-btn-inner',
    '--mlv-btn-padding',
  ]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].file, 'libs/a/button.scss');
  assert.equal(findings[0].line, 7);
  assert.equal(findings[0].token, '--mlv-btn-inner');
  assert.match(findings[0].reason, /padding-inline.*asymmetric/);
  assert.match(findings[0].hint, /carries a `--mlv-padding-\*` pair/);
});

test('an alias declared in one file is enforced in another', () => {
  const files = [
    {
      path: 'libs/a/vars.scss',
      source: '.x { --mlv-chat-padding: var(--mlv-padding-m); }',
    },
    { path: 'libs/b/use.scss', source: '.y { gap: var(--mlv-chat-padding); }' },
  ];
  const { findings } = checkFiles(files, pairTokens);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].file, 'libs/b/use.scss');
  assert.match(findings[0].reason, /used in `gap:`/);
});

test('hint names both spacing halves for a real pair token', () => {
  const { findings } = checkFiles(
    [{ path: 'a.scss', source: '.a { gap: var(--mlv-padding-s); }' }],
    pairTokens,
  );
  assert.match(
    findings[0].hint,
    /block half → var\(--mlv-spacing-1-5\), inline half → var\(--mlv-spacing-3\)/,
  );
});

// ─── templates ───────────────────────────────────────────────────────────────

test('inline style attributes are analysed as declaration lists', () => {
  const html = [
    '<div style="padding: var(--mlv-padding-m)">ok</div>',
    '<div class="x"',
    '     style="color: red; padding-left: var(--mlv-padding-m)">bad</div>',
  ].join('\n');
  const { findings } = analyseTemplate(html, pairNames);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].line, 3);
  assert.match(findings[0].reason, /padding-left/);
});

test('[style.prop] bindings are analysed against the bound property', () => {
  const html = [
    `<div [style.padding]="'var(--mlv-padding-m)'"></div>`,
    `<div [style.padding-inline]="'var(--mlv-padding-m)'"></div>`,
  ].join('\n');
  const { findings } = analyseTemplate(html, pairNames);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].line, 2);
  assert.match(findings[0].reason, /padding-inline/);
});

test('checkFiles routes .html through the template analyser', () => {
  const files = [
    {
      path: 'apps/x/a.html',
      source: '<p style="gap: var(--mlv-padding-s)"></p>',
    },
    { path: 'apps/x/a.scss', source: '.p { padding: var(--mlv-padding-s); }' },
  ];
  const { findings, scanned } = checkFiles(files, pairTokens);
  assert.equal(scanned, 2);
  assert.deepEqual(
    findings.map((f) => f.file),
    ['apps/x/a.html'],
  );
});

test('findings are sorted by file then line', () => {
  const files = [
    { path: 'z.scss', source: '.a { gap: var(--mlv-padding-s); }' },
    {
      path: 'a.scss',
      source:
        '.a {\n gap: var(--mlv-padding-s);\n}\n.b { top: var(--mlv-padding-s); }',
    },
  ];
  const { findings } = checkFiles(files, pairTokens);
  assert.deepEqual(
    findings.map((f) => `${f.file}:${f.line}`),
    ['a.scss:2', 'a.scss:4', 'z.scss:1'],
  );
});
