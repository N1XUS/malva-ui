#!/usr/bin/env node
/**
 * Malva UI — `@deprecated` tag completeness check
 *
 * VERSIONING.md §5 promises a consumer two things about every deprecation: the
 * release the deprecation shipped in, and the major that deletes it. Neither is
 * knowable from a bare `@deprecated Use X instead.` — the consumer learns that
 * something is going away but not when, so "later" is always a defensible
 * answer and the alias never actually gets removed. Both of the tags that
 * existed when this check was written said only what to use instead.
 *
 * So every `@deprecated` tag under `libs/` must name both versions:
 *
 *   @deprecated since 0.1.12 — removed in 1.0. Use `MlvDataSourceFilterOperator`
 *   from `@malva-ui/cdk/data-source` instead.
 *
 *   • `since <version>`      — where the deprecation shipped. `major.minor`,
 *                              patch optional.
 *   • `removed in <version>` — the major that deletes it. Must be a major
 *                              boundary (`1.0`, `2.0`, `2.0.0`), because
 *                              VERSIONING.md §3 permits removal only in a major.
 *
 * Order and separator are free; both phrases must be present, case-insensitive.
 *
 * The named removal must also still be ahead of the version in the root
 * `package.json`. Grammar alone cannot keep the promise §5 makes: a tag reading
 * `removed in 1.0` is still well-formed the day 1.0.0 ships with the symbol
 * present, and would stay green forever. Once the current major reaches the
 * named one, the tag is a broken promise and the check says so.
 *
 * Scope: `.ts`, `.scss` and `.css` under `libs/`, excluding spec files — a CSS
 * custom property and a BEM class name are public API here (VERSIONING.md §2),
 * so deprecating one carries the same obligation as deprecating a symbol.
 *
 * A tag's text runs from `@deprecated` to the end of the comment or to the next
 * JSDoc block tag, whichever comes first — so a `since` belonging to a later
 * `@since` does not satisfy this one. "Next block tag" follows TypeScript's own
 * tokenisation, which starts a tag at an `@` preceded by whitespace *anywhere*
 * on a line, not only at the start of one: `@deprecated Use X. @since 0.1` is
 * two tags to TypeScript, and its rendered deprecation text is `Use X.` alone.
 * An `@` preceded by anything else is prose — `` `@malva-ui/cdk` ``, `a@b.com`
 * and `{@link X}` all stay inside the tag, exactly as TypeScript reads them.
 *
 * `@deprecated` is matched case-insensitively so that nothing hides, but only
 * the lowercase spelling is accepted: TypeScript recognises `@deprecated` and
 * nothing else, so `@DEPRECATED since 0.1 — removed in 1.0` is a tag that
 * warns no consumer at any call site. Detecting it and rejecting it is the only
 * combination that neither hides it nor passes it.
 *
 * The scan is textual: an `@deprecated` inside a string literal would be
 * flagged. There are none, and rewording is the fix.
 *
 * Usage:
 *   node scripts/check-deprecations.mjs [--json] [--quiet]
 *   yarn nx run @malva-ui/source:check-deprecations
 *
 * Flags:
 *   --json    Emit findings as JSON instead of a human-readable report.
 *   --quiet   Suppress the summary line when nothing is found.
 *
 * Exit code: 0 when every tag is complete, 1 when at least one is not.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ─── Configuration ───────────────────────────────────────────────────────────

/** Workspace root, resolved from this file rather than from `process.cwd()`. */
export const WORKSPACE_ROOT = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '..',
);

/** Roots scanned. `apps/` and `scripts/` are not published. */
export const ROOTS = ['libs'];

/** File extensions carrying a public surface that can be deprecated. */
export const SCANNED_EXTENSIONS = ['.ts', '.scss', '.css'];

/** Directory names never descended into. */
const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  '.git',
  '.angular',
  '.nx',
  'coverage',
  'test-results',
  'tmp',
]);

/** Spec files describe behaviour; they ship nothing. */
const SPEC_PATTERN = /\.(spec|test)\.[cm]?[jt]sx?$/;

/**
 * Build artifacts. Not checked in — `libs/core/styles/malva-ui.css` is compiled
 * from the adjacent `.scss` by `core:build-styles` and is gitignored
 * (`.gitignore:10`) — but it is present on any tree that has been built, and
 * its content is a copy of a source file this scan already reads. Excluded to
 * avoid reporting the same tag twice, not because it is source.
 */
const GENERATED_FILES = new Set([
  join('libs', 'core', 'styles', 'malva-ui.css'),
]);

/** `since <version>` — where the deprecation shipped. Patch optional. */
export const SINCE_PATTERN = /\bsince\s+v?(\d+)\.(\d+)(?:\.(\d+))?\b/i;

/** `removed in <version>` — the release that deletes it. Patch optional. */
export const REMOVED_PATTERN = /\bremoved\s+in\s+v?(\d+)\.(\d+)(?:\.(\d+))?\b/i;

/**
 * The major the workspace is on, from the root `package.json` — the manifest
 * `nx release` versions, so it is the released line's number.
 *
 * `null` when it cannot be read, which downgrades the freshness rule to a
 * no-op rather than failing the build for an unrelated reason; the grammar
 * rules still apply.
 *
 * @param {string} [workspaceRoot]
 * @returns {number | null}
 */
export const readCurrentMajor = (workspaceRoot = WORKSPACE_ROOT) => {
  try {
    const { version } = JSON.parse(
      readFileSync(join(workspaceRoot, 'package.json'), 'utf8'),
    );
    const major = /^(\d+)\./.exec(String(version));
    return major ? Number(major[1]) : null;
  } catch {
    return null;
  }
};

// ─── Tag extraction ──────────────────────────────────────────────────────────

/**
 * Strips a line's comment furniture, leaving the prose: the leading `/**`,
 * `//` or `*`, and everything from a block-comment terminator onwards.
 *
 * `  // @deprecated foo` → `@deprecated foo`
 */
const commentBody = (line) =>
  line
    // Terminator first: on a lone closing line the `*` is part of it, and
    // stripping the furniture first would leave a stray `/` behind.
    .replace(/\*\/.*$/, '')
    .replace(/^\s*(?:\/\*\*?|\/\/|\*)?/, '')
    .trim();

/** True when the line closes a block comment. */
const closesComment = (line) => line.includes('*/');

/**
 * True when the line still reads as part of the comment the tag started in.
 * A line that is code again ends the tag regardless of what it says.
 */
const continuesComment = (line) => /^\s*(?:\*|\/\/)/.test(line);

/**
 * Matches `@deprecated` in any casing, so a mis-cased tag is found rather than
 * skipped. Only the lowercase spelling is *accepted* — see `checkFileContent`.
 */
const DEPRECATED_PATTERN = /@deprecated\b/i;

/**
 * The start of the next JSDoc block tag, as TypeScript tokenises one: an `@`
 * preceded by whitespace or by the start of the text, followed by an
 * identifier. Verified against `ts.getJSDocTags` — `@deprecated Use X. @since
 * 0.1` is two tags there, while `` `@malva-ui/cdk` ``, `a@b.com` and
 * `{@link X}` are prose inside the first, because their `@` is preceded by a
 * backtick, a letter and a brace respectively.
 */
const NEXT_BLOCK_TAG = /(?:^|\s)@[A-Za-z][\w-]*/;

/**
 * Truncates a tag's text at the next block tag, so a `since` or `removed in`
 * that belongs to a neighbouring `@since` / `@see` cannot satisfy this tag.
 *
 * @param {string} text
 * @returns {string}
 */
const untilNextBlockTag = (text) => {
  const boundary = NEXT_BLOCK_TAG.exec(text);
  return boundary ? text.slice(0, boundary.index) : text;
};

/**
 * Every `@deprecated` tag in `content`, with the text that belongs to it.
 *
 * The text runs to the end of the comment or to the next JSDoc block tag,
 * whichever comes first — including a block tag that starts mid-line, which is
 * where TypeScript ends the tag too.
 *
 * @param {string} content
 * @returns {{ line: number, text: string, spelling: string }[]} 1-based lines.
 */
export const parseDeprecationTags = (content) => {
  const lines = content.split(/\r?\n/);
  const tags = [];

  for (let index = 0; index < lines.length; index += 1) {
    const match = DEPRECATED_PATTERN.exec(lines[index]);
    if (!match) continue;

    const parts = [lines[index].slice(match.index + match[0].length)];
    if (!closesComment(lines[index])) {
      for (let next = index + 1; next < lines.length; next += 1) {
        const line = lines[next];
        if (!continuesComment(line)) break;
        const body = commentBody(line);
        parts.push(body);
        // A block tag opening this line ends the tag; the joined text is
        // truncated at it below, and reading on would only add dead text.
        if (NEXT_BLOCK_TAG.test(` ${body}`)) break;
        if (closesComment(line)) break;
      }
    }

    tags.push({
      line: index + 1,
      spelling: match[0],
      text: untilNextBlockTag(
        parts
          .join(' ')
          .replace(/\*\/.*$/, '')
          .replace(/\s+/g, ' '),
      ).trim(),
    });
  }

  return tags;
};

// ─── Rules ───────────────────────────────────────────────────────────────────

/**
 * Findings for one file's content.
 *
 * @param {string} file — workspace-relative path, used only in the report.
 * @param {string} content
 * @param {number | null} [currentMajor] — the released line's major. When
 *   given, a removal already at or behind it is reported as a broken promise
 *   rather than accepted as well-formed.
 * @returns {{ file: string, line: number, text: string, reason: string, hint: string }[]}
 */
export const checkFileContent = (file, content, currentMajor = null) => {
  const findings = [];

  for (const tag of parseDeprecationTags(content)) {
    const since = SINCE_PATTERN.exec(tag.text);
    const removed = REMOVED_PATTERN.exec(tag.text);

    /** @type {string | null} */
    let reason = null;

    if (tag.spelling !== '@deprecated') {
      reason = `is spelled \`${tag.spelling}\`; TypeScript recognises only the lowercase \`@deprecated\`, so this tag strikes nothing through at any call site and warns no consumer`;
    } else if (!since && !removed) {
      reason =
        'names neither the release it was deprecated in nor the one that removes it';
    } else if (!since) {
      reason = 'does not say which release deprecated it';
    } else if (!removed) {
      reason = 'does not say which release removes it';
    } else if (removed[2] !== '0' || (removed[3] && removed[3] !== '0')) {
      reason = `removal is scheduled for ${removed[0].replace(/\s+/g, ' ')}, which is not a major boundary — VERSIONING.md §3 permits removal only in a major`;
    } else if (currentMajor !== null && Number(removed[1]) <= currentMajor) {
      reason = `removal was promised for ${removed[1]}.0 and the workspace is already on ${currentMajor}.x — the symbol should be gone. Delete it, or, if the removal is genuinely deferred, re-date the tag to the major that will take it and say so in \`docs/migrations/\``;
    }

    if (reason) {
      findings.push({
        file,
        line: tag.line,
        text: tag.text || '(empty)',
        reason,
        hint: 'Write `@deprecated since <major.minor> — removed in <major>.0. Use `<replacement>` instead.` — see VERSIONING.md §5.',
      });
    }
  }

  return findings;
};

// ─── Traversal ───────────────────────────────────────────────────────────────

/**
 * Every scannable file under `dir`, relative to `workspaceRoot`.
 *
 * The root is a parameter rather than the module constant because
 * `GENERATED_FILES` is keyed on workspace-relative paths: resolving against the
 * constant while scanning some other root yields `../…` paths, which match
 * nothing and silently reinstate the files this excludes.
 */
const collectFiles = (dir, workspaceRoot, found = []) => {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name) || entry.name.startsWith('.')) {
        continue;
      }
      collectFiles(full, workspaceRoot, found);
      continue;
    }
    if (!SCANNED_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) continue;
    if (SPEC_PATTERN.test(entry.name)) continue;
    const rel = relative(workspaceRoot, full);
    if (GENERATED_FILES.has(rel)) continue;
    found.push(rel);
  }
  return found;
};

/**
 * Scans the configured roots.
 *
 * `scanned` is reported so callers can tell "every tag is complete" from
 * "the traversal found nothing to read". The two are indistinguishable in
 * `findings`, and only one of them means the check ran.
 *
 * @param {string} [workspaceRoot]
 * @returns {{ scanned: number, tags: number, currentMajor: number | null, findings: object[] }}
 */
export const scanWorkspace = (workspaceRoot = WORKSPACE_ROOT) => {
  const files = ROOTS.flatMap((root) =>
    collectFiles(join(workspaceRoot, root), workspaceRoot),
  );
  const currentMajor = readCurrentMajor(workspaceRoot);
  const findings = [];
  let tags = 0;

  for (const file of files) {
    const content = readFileSync(join(workspaceRoot, file), 'utf8');
    if (!DEPRECATED_PATTERN.test(content)) continue;
    tags += parseDeprecationTags(content).length;
    findings.push(...checkFileContent(file, content, currentMajor));
  }

  return { scanned: files.length, tags, currentMajor, findings };
};

// ─── Report ──────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const quiet = args.includes('--quiet');

  const { scanned, tags, currentMajor, findings } = scanWorkspace();

  if (json) {
    console.log(
      JSON.stringify({ scanned, tags, currentMajor, findings }, null, 2),
    );
    process.exit(findings.length || !scanned ? 1 : 0);
  }

  // A scan that read nothing reports zero findings, which is the same output as
  // a clean tree. That is the one failure this check cannot survive quietly:
  // every guarantee below rests on the traversal having actually run.
  if (!scanned) {
    console.error(
      `\n❌  Scanned 0 files under ${ROOTS.map((root) => `\`${root}/\``).join(', ')} — the traversal found nothing to check.`,
    );
    console.error(
      '   This is a broken check, not a clean tree. Verify ROOTS and SCANNED_EXTENSIONS.\n',
    );
    process.exit(1);
  }

  if (!findings.length) {
    if (!quiet) {
      console.log(
        `✅  ${scanned} files scanned — ${tags} \`@deprecated\` tag${tags === 1 ? '' : 's'}, every one naming the release it shipped in and a major ahead of ${currentMajor === null ? 'the current line' : `${currentMajor}.x`} that removes it.`,
      );
    }
    process.exit(0);
  }

  console.error(`\n❌  ${findings.length} incomplete \`@deprecated\` tag(s).`);
  console.error(
    '   A deprecation a consumer cannot date is a deprecation nobody acts on.',
  );
  console.error('   See VERSIONING.md §5 for the guarantee this backs.\n');
  for (const finding of findings) {
    console.error(`  ${finding.file}:${finding.line}`);
    console.error(`      @deprecated ${finding.text}`);
    console.error(`      ↳ ${finding.reason}`);
    console.error(`      ↳ ${finding.hint}`);
  }
  console.error('');
  process.exit(1);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main();
}
