#!/usr/bin/env node
/**
 * Malva UI — `--mlv-padding-*` pair-token misuse check
 *
 * Every `--mlv-padding-{xs,s,m,l,xl,2xl}` token expands to TWO lengths
 * (`block inline`, e.g. `--mlv-padding-m` → `0.5rem 1rem`). That makes it valid
 * in exactly one place: as the entire value of the `padding` shorthand. Anywhere
 * else the browser either drops the declaration (single-length properties,
 * `calc()`, 3–5 value shorthands → invalid at computed-value time → `unset`) or
 * silently splits the pair across axes/sides (`padding-inline`, `gap`,
 * `margin: pair 0`, …). Nothing errors, so it ships. That happened in nineteen
 * files before anyone noticed.
 *
 * This check scans the workspace stylesheets (and inline styles in templates)
 * for every reference to a pair token — or to a custom property that is itself
 * assigned a pair token (`--mlv-btn-padding: var(--mlv-padding-m)`) — and
 * reports each one that is not:
 *
 *   • the sole value of a `padding:` declaration (a trailing `!important` and a
 *     `var()` fallback are fine), including a `padding:` key inside a Sass map;
 *   • the value of a custom-property alias `--mlv-<block>-padding: var(pair)`,
 *     which is then tracked like the token itself;
 *   • the `$padding` argument of the shared `mixins.base()` — 4th positional or
 *     `$padding:` keyword — which is written straight to `padding:`.
 *
 * The pair-token set is read from `libs/styles/src/lib/theme.scss`, so a newly
 * added `--mlv-padding-*` token is covered automatically, and one that becomes a
 * single length automatically stops being flagged.
 *
 * Usage:
 *   node scripts/check-padding-tokens.mjs [--json] [--quiet]
 *   yarn nx run styles:check-padding-tokens
 *
 * Flags:
 *   --json    Emit findings as JSON instead of a human-readable report.
 *   --quiet   Suppress the summary line when nothing is found.
 *
 * Exit code: 0 when clean, 1 when at least one misuse is found.
 *
 * Rule + wrong/right table: .claude/rules/bem-scss.md, section
 * "`--mlv-padding-*` is a two-value pair".
 */

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, relative, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ─── Configuration ───────────────────────────────────────────────────────────

/** Roots scanned for references and alias declarations. */
export const ROOTS = ['libs', 'apps'];

/** Directory names never descended into. */
const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  '.git',
  '.angular',
  '.nx',
  'coverage',
  'test-results',
]);

/**
 * Build artifacts checked into the tree. Their content is a copy of a source
 * file that is scanned anyway, so including them would double-report.
 */
const GENERATED_FILES = new Set([
  join('libs', 'core', 'styles', 'malva-ui.css'),
]);

/** Where the pair tokens are declared. */
export const THEME_SOURCE = join('libs', 'styles', 'src', 'lib', 'theme.scss');

/** Custom-property prefix of the tokens this check is about. */
export const PAIR_TOKEN_PREFIX = '--mlv-padding-';

/** Stylesheets: scanned in full. */
const STYLESHEET_EXTENSIONS = ['.scss', '.css'];
/** Templates: only `style="…"` attributes and `[style.prop]` bindings. */
const TEMPLATE_EXTENSIONS = ['.html'];

// ─── Pair-token discovery ────────────────────────────────────────────────────

/**
 * @typedef {object} PairToken
 * @property {string} name — e.g. `--mlv-padding-m`
 * @property {string} block — the block (first) half, e.g. `--mlv-spacing-2`
 * @property {string} inline — the inline (second) half, e.g. `--mlv-spacing-4`
 */

/**
 * Splits a CSS value on whitespace that sits outside parentheses, so
 * `var(--mlv-spacing-2) var(--mlv-spacing-4)` yields two parts and
 * `calc(1rem + 2px)` yields one.
 *
 * @param {string} value
 * @returns {string[]}
 */
function splitTopLevel(value) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const char of value.trim()) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (/\s/.test(char) && depth === 0) {
      if (current) parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  if (current) parts.push(current);
  return parts;
}

/**
 * Reads every `--mlv-padding-*` declaration in the theme source and keeps the
 * ones whose value is a two-part pair.
 *
 * @param {string} themeSource — contents of theme.scss
 * @returns {Map<string, PairToken>} keyed by token name
 */
export function loadPairTokens(themeSource) {
  const tokens = new Map();
  const escapedPrefix = PAIR_TOKEN_PREFIX.replace(/[-]/g, '\\-');
  const pattern = new RegExp(
    `(${escapedPrefix}[A-Za-z0-9-]+)\\s*:\\s*([^;]+);`,
    'g',
  );
  for (const match of themeSource.matchAll(pattern)) {
    const [, name, rawValue] = match;
    const parts = splitTopLevel(rawValue);
    if (parts.length !== 2) continue;
    const half = (part) =>
      /^var\(\s*(--[A-Za-z0-9_-]+)/.exec(part)?.[1] ?? part;
    tokens.set(name, { name, block: half(parts[0]), inline: half(parts[1]) });
  }
  return tokens;
}

// ─── Comment stripping ───────────────────────────────────────────────────────

/**
 * Replaces comment text with spaces (newlines preserved) so line numbers stay
 * stable and commented-out code is never analysed. `//` only counts as a line
 * comment outside strings and outside parentheses, so `url(https://…)` and
 * `content: '//'` survive.
 *
 * @param {string} source
 * @returns {string}
 */
export function stripComments(source) {
  let out = '';
  let i = 0;
  let quote = null;
  let depth = 0;
  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];

    if (quote) {
      out += char;
      if (char === '\\') {
        out += next ?? '';
        i += 2;
        continue;
      }
      if (char === quote) quote = null;
      i++;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      out += char;
      i++;
      continue;
    }

    if (char === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? source.length : end + 2;
      out += source.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop;
      continue;
    }

    if (char === '/' && next === '/' && depth === 0) {
      let end = source.indexOf('\n', i);
      if (end === -1) end = source.length;
      out += ' '.repeat(end - i);
      i = end;
      continue;
    }

    if (char === '(') depth++;
    if (char === ')') depth = Math.max(0, depth - 1);
    out += char;
    i++;
  }
  return out;
}

// ─── Reference analysis ──────────────────────────────────────────────────────

/**
 * @typedef {object} Finding
 * @property {string} file — workspace-relative path
 * @property {number} line — 1-based
 * @property {string} token — the pair token or alias that was misused
 * @property {string} context — the declaration text, trimmed
 * @property {string} reason — why this is a misuse
 * @property {string} hint — what to write instead
 */

/**
 * @typedef {object} Reference
 * @property {string} name — the custom property referenced
 * @property {number} start — index of `var(`
 * @property {number} end — index just past the matching `)`
 */

const DECLARATION_BOUNDARY = new Set([';', '{', '}']);
const BEFORE_BOUNDARY = new Set([';', '{', '}', '(', ',']);
const AFTER_BOUNDARY = new Set([';', '{', '}', ')', ',']);

/**
 * Finds every `var(<name>…)` reference to one of `names`, with the index range
 * of the whole `var(…)` call (fallback included).
 *
 * @param {string} text
 * @param {Set<string>} names
 * @returns {Reference[]}
 */
function findReferences(text, names) {
  const references = [];
  const pattern = /var\(\s*(--[A-Za-z0-9_-]+)/g;
  for (const match of text.matchAll(pattern)) {
    if (!names.has(match[1])) continue;
    const open = match.index + 3;
    let depth = 0;
    let end = text.length;
    for (let i = open; i < text.length; i++) {
      if (text[i] === '(') depth++;
      else if (text[i] === ')') {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    references.push({ name: match[1], start: match.index, end });
  }
  return references;
}

/**
 * Text between the previous boundary character and `index`, plus that
 * boundary character (or `null` at the start of the text).
 */
function before(text, index, boundaries) {
  let i = index - 1;
  while (i >= 0 && !boundaries.has(text[i])) i--;
  return { text: text.slice(i + 1, index), boundary: i >= 0 ? text[i] : null };
}

/** Text between `index` and the next boundary character. */
function after(text, index, boundaries) {
  let i = index;
  while (i < text.length && !boundaries.has(text[i])) i++;
  return text.slice(index, i);
}

/**
 * For a reference sitting inside a function call or list, walks back to the
 * enclosing `(` and reports the callee name and the reference's 0-based
 * positional index. Returns `null` when no enclosing call exists before the
 * previous declaration boundary.
 *
 * @param {string} text
 * @param {number} index — reference start
 */
function enclosingCall(text, index) {
  let depth = 0;
  let commas = 0;
  for (let i = index - 1; i >= 0; i--) {
    const char = text[i];
    if (DECLARATION_BOUNDARY.has(char)) return null;
    if (char === ')') depth++;
    else if (char === '(') {
      if (depth === 0) {
        const callee =
          /([A-Za-z0-9_.$-]*)\s*$/.exec(text.slice(0, i))?.[1] ?? '';
        return { callee, position: commas };
      }
      depth--;
    } else if (char === ',' && depth === 0) {
      commas++;
    }
  }
  return null;
}

/** The `prop` of the `prop: …` declaration a reference sits in, best effort. */
function enclosingProperty(text, index) {
  const { text: declaration } = before(text, index, DECLARATION_BOUNDARY);
  return /^\s*([A-Za-z$][A-Za-z0-9_-]*)\s*:/.exec(declaration)?.[1] ?? null;
}

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (text[i] === '\n') line++;
  return line;
}

function contextOf(text, index) {
  const start = before(text, index, DECLARATION_BOUNDARY);
  const rest = after(text, index, DECLARATION_BOUNDARY);
  return (start.text + rest).replace(/\s+/g, ' ').trim();
}

/**
 * Analyses one stylesheet-like text.
 *
 * @param {string} rawText — SCSS / CSS source, or a synthesised declaration list
 * @param {Set<string>} pairNames — pair tokens plus known aliases
 * @param {object} [options]
 * @param {boolean} [options.stripped] — `rawText` already has comments stripped
 * @returns {{ findings: Omit<Finding, 'file' | 'hint'>[], aliases: string[] }}
 */
export function analyseStylesheet(rawText, pairNames, options = {}) {
  const text = options.stripped ? rawText : stripComments(rawText);
  const findings = [];
  const aliases = [];

  for (const reference of findReferences(text, pairNames)) {
    const lead = before(text, reference.start, BEFORE_BOUNDARY);
    const tail = after(text, reference.end, AFTER_BOUNDARY);
    const leadText = lead.text.trim();
    const tailText = tail.trim();
    const tailClean = tailText === '' || tailText === '!important';
    const base = {
      line: lineOf(text, reference.start),
      token: reference.name,
      context: contextOf(text, reference.start),
    };

    // padding: var(pair)            — sole value, incl. Sass map `padding:` key
    if (/^padding\s*:$/.test(leadText) && tailClean) continue;

    // --mlv-x-padding: var(pair)     — component alias, tracked from now on
    const aliasMatch = /^(--[A-Za-z0-9_-]+)\s*:$/.exec(leadText);
    if (
      aliasMatch &&
      tailClean &&
      (lead.boundary === null || DECLARATION_BOUNDARY.has(lead.boundary))
    ) {
      aliases.push(aliasMatch[1]);
      continue;
    }

    // mixins.base(…, …, …, var(pair)) / base($padding: var(pair))
    if (tailClean && (leadText === '' || /^\$padding\s*:$/.test(leadText))) {
      const call = enclosingCall(text, reference.start);
      const isBase = call && /(^|[.\s])base$/.test(call.callee);
      if (isBase && (leadText !== '' || call.position === 3)) continue;
    }

    // Everything else is a misuse — work out why for the message.
    const property = enclosingProperty(text, reference.start);
    const call = leadText === '' ? enclosingCall(text, reference.start) : null;
    let reason;
    if (call && /(^|[.\s])base$/.test(call.callee)) {
      reason = `passed as argument ${call.position + 1} of \`${call.callee}()\` — only the 4th (\`$padding\`) argument may take a pair`;
    } else if (call && call.callee) {
      reason = `nested inside \`${call.callee}()\`${property ? ` in \`${property}:\`` : ''} — a two-length pair is not a length`;
    } else if (call) {
      reason = `item of a comma list${property ? ` in \`${property}:\`` : ''}`;
    } else if (property === 'padding') {
      reason =
        'part of a multi-value `padding` shorthand — the pair adds two more values';
    } else if (
      property &&
      /^(padding|margin|inset|scroll-padding|scroll-margin)-(inline|block)$/.test(
        property,
      )
    ) {
      reason = `\`${property}\` takes \`start end\` — the pair is split asymmetrically (start = block half, end = inline half)`;
    } else if (
      property &&
      /^(padding|margin|scroll-padding|scroll-margin)-/.test(property)
    ) {
      reason = `\`${property}\` takes a single length — a two-length pair is invalid and the declaration is dropped`;
    } else if (property && /^\$/.test(property)) {
      reason = `assigned to Sass variable \`${property}\` — assign the pair to a \`--mlv-<block>-padding\` custom property instead so it can be tracked`;
    } else if (property) {
      reason = `used in \`${property}:\` — the pair is only meaningful as the \`padding\` shorthand`;
    } else {
      reason = 'not the sole value of a `padding:` declaration';
    }
    findings.push({ ...base, reason });
  }

  return { findings, aliases };
}

/**
 * Analyses an Angular/HTML template: `style="…"` attributes are treated as
 * declaration lists, and `[style.prop]="'…'"` bindings are rewritten to
 * `prop: …` before analysis.
 *
 * @param {string} source
 * @param {Set<string>} pairNames
 * @returns {{ findings: Omit<Finding, 'file' | 'hint'>[], aliases: string[] }}
 */
export function analyseTemplate(source, pairNames) {
  const findings = [];
  const aliases = [];

  const inline = /\sstyle\s*=\s*"([^"]*)"/g;
  for (const match of source.matchAll(inline)) {
    const result = analyseStylesheet(match[1], pairNames, { stripped: true });
    const offset = lineOf(source, match.index);
    for (const finding of result.findings) {
      findings.push({ ...finding, line: offset + finding.line - 1 });
    }
    aliases.push(...result.aliases);
  }

  const bindings = /\[style\.([A-Za-z0-9_-]+)\]\s*=\s*"\s*'([^']*)'\s*"/g;
  for (const match of source.matchAll(bindings)) {
    const [, property, value] = match;
    const result = analyseStylesheet(`${property}: ${value};`, pairNames, {
      stripped: true,
    });
    const line = lineOf(source, match.index);
    for (const finding of result.findings) findings.push({ ...finding, line });
  }

  return { findings, aliases };
}

/**
 * Runs the whole check over an in-memory set of files. Alias declarations are
 * collected to a fixpoint first so that `--a: var(--mlv-padding-m)` followed by
 * `--b: var(--a)` makes `--b` a pair as well.
 *
 * @param {{ path: string, source: string }[]} files — `path` workspace-relative
 * @param {Map<string, PairToken>} pairTokens
 * @returns {{ findings: Finding[], aliases: Set<string>, scanned: number }}
 */
export function checkFiles(files, pairTokens) {
  const analyse = (file, names) =>
    TEMPLATE_EXTENSIONS.some((extension) => file.path.endsWith(extension))
      ? analyseTemplate(file.source, names)
      : analyseStylesheet(file.source, names);

  const names = new Set(pairTokens.keys());
  const aliases = new Set();
  let grew = true;
  while (grew) {
    grew = false;
    for (const file of files) {
      for (const alias of analyse(file, names).aliases) {
        if (names.has(alias)) continue;
        names.add(alias);
        aliases.add(alias);
        grew = true;
      }
    }
  }

  const findings = [];
  for (const file of files) {
    for (const finding of analyse(file, names).findings) {
      findings.push({
        file: file.path,
        ...finding,
        hint: hintFor(finding.token, pairTokens),
      });
    }
  }
  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  return { findings, aliases, scanned: files.length };
}

function hintFor(token, pairTokens) {
  const pair = pairTokens.get(token);
  if (pair) {
    return `block half → var(${pair.block}), inline half → var(${pair.inline}); or keep it as the whole \`padding:\` value`;
  }
  return `\`${token}\` carries a \`${PAIR_TOKEN_PREFIX}*\` pair — feed it only to \`padding:\`, or use the matching \`--mlv-spacing-*\` half`;
}

// ─── File walking ────────────────────────────────────────────────────────────

function walk(directory, extensions, workspaceRoot, accumulator = []) {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return accumulator;
  }
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) continue;
      walk(path, extensions, workspaceRoot, accumulator);
    } else if (extensions.some((extension) => entry.name.endsWith(extension))) {
      if (GENERATED_FILES.has(relative(workspaceRoot, path))) continue;
      accumulator.push(path);
    }
  }
  return accumulator;
}

/**
 * Reads every scannable file under the workspace roots.
 *
 * @param {string} workspaceRoot — absolute path
 */
export function collectWorkspaceFiles(workspaceRoot) {
  const extensions = [...STYLESHEET_EXTENSIONS, ...TEMPLATE_EXTENSIONS];
  return ROOTS.flatMap((root) =>
    walk(resolve(workspaceRoot, root), extensions, workspaceRoot),
  ).map((path) => ({
    path: relative(workspaceRoot, path),
    source: readFileSync(path, 'utf8'),
  }));
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

function main() {
  const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const asJson = process.argv.includes('--json');
  const quiet = process.argv.includes('--quiet');

  const pairTokens = loadPairTokens(
    readFileSync(resolve(workspaceRoot, THEME_SOURCE), 'utf8'),
  );
  if (!pairTokens.size) {
    console.error(
      `❌  No two-value \`${PAIR_TOKEN_PREFIX}*\` tokens found in ${THEME_SOURCE} — nothing to check.`,
    );
    process.exit(1);
  }

  const files = collectWorkspaceFiles(workspaceRoot);
  const { findings, aliases, scanned } = checkFiles(files, pairTokens);

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          scanned,
          pairTokens: [...pairTokens.keys()],
          aliases: [...aliases].sort(),
          findings,
        },
        null,
        2,
      ),
    );
    process.exit(findings.length ? 1 : 0);
  }

  if (!findings.length) {
    if (!quiet) {
      console.log(
        `✅  ${scanned} files scanned — every \`${PAIR_TOKEN_PREFIX}*\` pair (and ${aliases.size} alias${aliases.size === 1 ? '' : 'es'}) is used only as the whole \`padding:\` value.`,
      );
    }
    process.exit(0);
  }

  console.error(
    `\n❌  ${findings.length} misuse(s) of \`${PAIR_TOKEN_PREFIX}*\` pair tokens.`,
  );
  console.error(
    '   These tokens expand to TWO lengths (block inline). Outside the whole `padding:` value the',
  );
  console.error(
    '   browser drops the declaration or splits the pair across sides. See .claude/rules/bem-scss.md.\n',
  );
  for (const finding of findings) {
    console.error(`  ${finding.file}:${finding.line}  ${finding.token}`);
    console.error(`      ${finding.context}`);
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
