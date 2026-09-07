import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  checkFileContent,
  parseDeprecationTags,
  readCurrentMajor,
  scanWorkspace,
} from './check-deprecations.mjs';

/** Reasons only — the file/line/hint fields are report furniture. */
const reasons = (source) =>
  checkFileContent('x.ts', source).map((finding) => finding.reason);

/** A complete tag, the shape VERSIONING.md §5 prescribes. */
const COMPLETE = `
/**
 * @deprecated since 0.1 — removed in 1.0. Use \`MlvOther\` instead.
 */
export type MlvThing = string;
`;

// ─── parseDeprecationTags ────────────────────────────────────────────────────

test('parseDeprecationTags reports the line the tag sits on', () => {
  const tags = parseDeprecationTags(COMPLETE);
  assert.equal(tags.length, 1);
  assert.equal(tags[0].line, 3);
});

test('parseDeprecationTags joins a tag that wraps across comment lines', () => {
  const tags = parseDeprecationTags(`
/**
 * @deprecated since 0.1 —
 * removed in 1.0. Use the other one.
 */
`);
  assert.equal(tags.length, 1);
  assert.match(tags[0].text, /since 0\.1 — removed in 1\.0\./);
});

test('parseDeprecationTags drops the closing line rather than leaving a stray slash', () => {
  const tags = parseDeprecationTags(`
/**
 * @deprecated since 0.1 — removed in 1.0. Use
 * \`MlvOther\`.
 */
`);
  assert.equal(tags[0].text, 'since 0.1 — removed in 1.0. Use `MlvOther`.');
});

test('parseDeprecationTags stops at the next @-tag', () => {
  const tags = parseDeprecationTags(`
/**
 * @deprecated Use the other one.
 * @since 0.1
 * @see removed in 1.0
 */
`);
  assert.equal(tags.length, 1);
  assert.equal(tags[0].text, 'Use the other one.');
});

// TypeScript starts a block tag at any `@` preceded by whitespace, not only at
// the start of a line: `ts.getJSDocTags` reads the two comments below as a
// `@deprecated` of "Use X." plus a separate `@since`. Stopping only at a
// line-start `@` let a neighbouring tag's versions satisfy this one.
test('parseDeprecationTags stops at a block tag that opens mid-line', () => {
  const [tag] = parseDeprecationTags(
    '/** @deprecated Use X. @since 0.1 removed in 1.0 */',
  );
  assert.equal(tag.text, 'Use X.');
});

test('parseDeprecationTags stops at a block tag mid-way through a continuation line', () => {
  const [tag] = parseDeprecationTags(`
/**
 * @deprecated Use X.
 * Text @since 0.1 and removed in 1.0
 */
`);
  assert.equal(tag.text, 'Use X. Text');
});

// The counterpart: an `@` that TypeScript reads as prose must stay in the tag,
// or the real tag in libs/core/data-table/src/lib/types.ts would be truncated.
test('parseDeprecationTags keeps a backticked package name, an address and an inline link', () => {
  const [tag] = parseDeprecationTags(
    '/** @deprecated since 0.1 — removed in 1.0. Use `@malva-ui/cdk`, ask a@b.com, see {@link X}. */',
  );
  assert.equal(
    tag.text,
    'since 0.1 — removed in 1.0. Use `@malva-ui/cdk`, ask a@b.com, see {@link X}.',
  );
});

test('parseDeprecationTags finds a mis-cased tag and records the spelling', () => {
  assert.deepEqual(
    parseDeprecationTags('/** @DEPRECATED Use X. */').map((t) => t.spelling),
    ['@DEPRECATED'],
  );
});

test('parseDeprecationTags handles a single-line block comment', () => {
  const tags = parseDeprecationTags(
    '/** @deprecated since 0.1 — removed in 1.0. Use X. */\nexport const a = 1;\n',
  );
  assert.equal(tags.length, 1);
  assert.equal(tags[0].text, 'since 0.1 — removed in 1.0. Use X.');
});

test('parseDeprecationTags handles the line-comment form', () => {
  const tags = parseDeprecationTags(
    '// @deprecated since 0.1 — removed in 1.0.\nconst a = 1;\n',
  );
  assert.equal(tags.length, 1);
  assert.equal(tags[0].text, 'since 0.1 — removed in 1.0.');
});

test('parseDeprecationTags stops at the first line that is code again', () => {
  const tags = parseDeprecationTags(
    '// @deprecated Use X.\nconst since = "0.1"; // removed in 1.0\n',
  );
  assert.equal(tags[0].text, 'Use X.');
});

test('parseDeprecationTags finds every tag in a file', () => {
  const tags = parseDeprecationTags(`
/** @deprecated since 0.1 — removed in 1.0. */
export const a = 1;
/** @deprecated since 0.2 — removed in 1.0. */
export const b = 2;
`);
  assert.deepEqual(
    tags.map((tag) => tag.line),
    [2, 4],
  );
});

// ─── checkFileContent ────────────────────────────────────────────────────────

test('a tag naming both versions passes', () => {
  assert.deepEqual(reasons(COMPLETE), []);
});

test('the version phrases may appear in either order', () => {
  assert.deepEqual(
    reasons('/** @deprecated Removed in 2.0, deprecated since 1.4. */'),
    [],
  );
});

test('a patch is allowed on either version', () => {
  assert.deepEqual(
    reasons('/** @deprecated since 0.1.15 — removed in 1.0.0. */'),
    [],
  );
});

test('a leading v is tolerated', () => {
  assert.deepEqual(
    reasons('/** @deprecated since v0.1 — removed in v1.0. */'),
    [],
  );
});

test('a bare tag is rejected for both versions at once', () => {
  assert.deepEqual(reasons('/** @deprecated Use `MlvOther` instead. */'), [
    'names neither the release it was deprecated in nor the one that removes it',
  ]);
});

test('a tag with no since is rejected', () => {
  assert.deepEqual(reasons('/** @deprecated Removed in 1.0. */'), [
    'does not say which release deprecated it',
  ]);
});

test('a tag with no removal is rejected', () => {
  assert.deepEqual(reasons('/** @deprecated Since 0.1. Use `MlvOther`. */'), [
    'does not say which release removes it',
  ]);
});

test('removal in a minor is rejected — §3 permits removal only in a major', () => {
  const [reason] = reasons('/** @deprecated since 0.1 — removed in 1.2. */');
  assert.match(reason, /not a major boundary/);
});

test('removal in a patch of a major is rejected', () => {
  const [reason] = reasons('/** @deprecated since 0.1 — removed in 1.0.3. */');
  assert.match(reason, /not a major boundary/);
});

test('a since belonging to a later @-tag does not satisfy the deprecation', () => {
  assert.deepEqual(
    reasons(`
/**
 * @deprecated Removed in 1.0.
 * @since 0.4
 */
`),
    ['does not say which release deprecated it'],
  );
});

test('an empty tag is reported rather than skipped', () => {
  const [finding] = checkFileContent('x.ts', '/** @deprecated */');
  assert.equal(finding.text, '(empty)');
  assert.match(finding.reason, /names neither/);
});

// A tag TypeScript does not recognise warns nobody, so it cannot be allowed to
// pass on the strength of naming two versions — nor to hide from the scan.
test('a mis-cased tag is rejected however complete it looks', () => {
  const [reason] = reasons('/** @DEPRECATED since 0.1 — removed in 1.0. */');
  assert.match(reason, /recognises only the lowercase/);
});

test('the canonical lowercase spelling is not flagged', () => {
  assert.deepEqual(
    reasons('/** @deprecated since 0.1 — removed in 1.0. */'),
    [],
  );
});

// ─── The removal has to still be ahead of the released line ──────────────────

test('a removal still ahead of the current major passes', () => {
  assert.deepEqual(
    checkFileContent(
      'x.ts',
      '/** @deprecated since 1.4 — removed in 2.0. */',
      1,
    ),
    [],
  );
});

test('a removal at the current major is a broken promise, not a valid tag', () => {
  const [finding] = checkFileContent(
    'x.ts',
    '/** @deprecated since 0.1 — removed in 1.0. */',
    1,
  );
  assert.match(finding.reason, /the symbol should be gone/);
});

test('a removal behind the current major is reported too', () => {
  const [finding] = checkFileContent(
    'x.ts',
    '/** @deprecated since 0.1 — removed in 1.0. */',
    2,
  );
  assert.match(finding.reason, /already on 2\.x/);
});

test('an unreadable current major downgrades the freshness rule to a no-op', () => {
  assert.deepEqual(
    checkFileContent(
      'x.ts',
      '/** @deprecated since 0.1 — removed in 1.0. */',
      null,
    ),
    [],
  );
});

test('readCurrentMajor reads the root manifest nx release versions', () => {
  assert.equal(typeof readCurrentMajor(), 'number');
});

test('every finding carries the file and a line number', () => {
  const [finding] = checkFileContent(
    'libs/x/src/y.ts',
    '\n\n/** @deprecated */',
  );
  assert.equal(finding.file, 'libs/x/src/y.ts');
  assert.equal(finding.line, 3);
});

// ─── The workspace itself ────────────────────────────────────────────────────

test('every @deprecated tag under libs/ names both versions', () => {
  const { findings } = scanWorkspace();
  assert.deepEqual(
    findings.map(
      (finding) => `${finding.file}:${finding.line} — ${finding.reason}`,
    ),
    [],
  );
});

// Guards the guard: a scan that read nothing also reports zero findings, and
// the two are indistinguishable downstream. This asserts on the file count and
// not the tag count on purpose — the day 1.0.0 honours both existing
// deprecations, a tree with zero tags is *correct*, and a vacuity check keyed
// on `tags > 0` would go red on it while a broken traversal still slipped by.
test('the scan actually reads the tree', () => {
  const { scanned } = scanWorkspace();
  assert.ok(scanned > 0, 'expected the traversal to find files under libs/');
});
