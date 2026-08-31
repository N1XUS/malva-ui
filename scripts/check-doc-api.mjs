#!/usr/bin/env node
/**
 * Docs-vs-declared-API consistency check.
 *
 * Every library ships a hand-written reference (`.claude/projects/libs-<name>.md`,
 * symlinked as `libs/<family>/<name>/CLAUDE.md`) that `scripts/generate-ai-docs.mjs`
 * publishes to consumers verbatim. A member documented there that no longer exists
 * in the source therefore reaches users as a lie.
 *
 * This script compares those markdown tables against the *declared* API extracted
 * from the sources by `docs:extract-api` (`apps/docs/src/generated/api/<page>.json`,
 * see `apps/docs/tools/api-extractor.ts`):
 *
 *   - FAIL    a documented input/output/model/method that the JSON does not declare.
 *   - WARN    a declared input/output/method that the markdown never mentions,
 *             plus documented sections naming a symbol the barrel does not export.
 *
 * Usage:
 *   node scripts/check-doc-api.mjs            # fail on failures only
 *   node scripts/check-doc-api.mjs --strict   # warnings fail too
 *   node scripts/check-doc-api.mjs --json     # machine-readable report on stdout
 *
 * Run it through Nx (regenerates the JSON first): `yarn nx run docs:check-doc-api`.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API_DIR = join(workspaceRoot, 'apps/docs/src/generated/api');
const ROUTES_FILE = join(workspaceRoot, 'apps/docs/src/app/app.routes.ts');
const PROJECT_DOCS_DIR = join(workspaceRoot, '.claude/projects');

const strict = process.argv.includes('--strict');
const asJson = process.argv.includes('--json');

// ────────────────────────────────────────────────────────────────────────────
// Page → library → documentation-file mapping
// ────────────────────────────────────────────────────────────────────────────

/**
 * Reads the `API_OVERRIDES` map out of `app.routes.ts` without loading Angular.
 * Mirrors `apiFor()` there: an override wins, otherwise a page maps to
 * `{ family: 'core', entry: <page> }`.
 */
function readApiOverrides() {
  const source = readFileSync(ROUTES_FILE, 'utf8');
  const block = source.match(/const API_OVERRIDES[^=]*=\s*\{([\s\S]*?)\n\};/);
  if (!block) {
    throw new Error(`Could not locate API_OVERRIDES in ${ROUTES_FILE}`);
  }
  const overrides = new Map();
  const entry =
    /'?([A-Za-z][\w-]*)'?\s*:\s*(?:null|\{\s*family:\s*'([^']+)',\s*entry:\s*'([^']*)'\s*\})/g;
  for (const match of block[1].matchAll(entry)) {
    const [, page, family, dir] = match;
    overrides.set(page, family ? { family, entry: dir } : null);
  }
  return overrides;
}

/** The docs pages that have an extracted API entry, from the generated JSON. */
function listApiPages() {
  if (!existsSync(API_DIR)) {
    throw new Error(
      `Missing ${API_DIR}. Run \`yarn nx run docs:extract-api\` first.`,
    );
  }
  return readdirSync(API_DIR)
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.slice(0, -'.json'.length))
    .sort();
}

/** Resolves a page to its API target the same way `apiFor()` in `app.routes.ts` does. */
function apiTargetFor(page, overrides) {
  if (overrides.has(page)) return overrides.get(page);
  return { family: 'core', entry: page };
}

/**
 * Resolves an API target to its markdown reference, mirroring
 * `findSourceDocument()` in `scripts/generate-ai-docs.mjs`: a family-qualified
 * doc wins, then the canonical `.claude/projects/libs-<entry>.md`, then the
 * library-local `CLAUDE.md`. A local file that is a single `@relative/path`
 * include is followed to its target.
 */
function resolveDocFile(target) {
  const name = target.entry || target.family;
  const candidates = [
    join(PROJECT_DOCS_DIR, `libs-${target.family}-${name}.md`),
    join(PROJECT_DOCS_DIR, `libs-${name}.md`),
    join(workspaceRoot, 'libs', target.family, target.entry, 'CLAUDE.md'),
  ];
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    const contents = readFileSync(candidate, 'utf8').trim();
    const include = contents.match(/^@(\S+\.md)$/);
    if (include) {
      const included = resolve(dirname(candidate), include[1]);
      if (existsSync(included)) return included;
    }
    return candidate;
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// Markdown parsing
// ────────────────────────────────────────────────────────────────────────────

/** Section headings whose tables list members, mapped to the JSON bucket they describe. */
const SECTION_KINDS = [
  [/^inputs?\s*[/&]\s*outputs?\b/, 'io'],
  [/^(?:own|inherited)?\s*inputs?\b/, 'inputs'],
  [/^outputs?\b/, 'outputs'],
  [/^models?\s*(?:\(.*\))?$/, 'models'],
  [/^(?:key|public|cva|creation)?\s*methods?\b/, 'methods'],
];

/** Table header cells that identify a member table on their own (no section heading needed). */
const HEADER_KINDS = new Map([
  ['input', 'inputs'],
  ['inputs', 'inputs'],
  ['output', 'outputs'],
  ['outputs', 'outputs'],
  ['input / output', 'io'],
  ['model', 'models'],
  ['method', 'methods'],
  ['methods', 'methods'],
]);

/** Headings that document non-public members — the extractor never declares those. */
const IGNORED_SECTIONS = /^(?:protected|private|internal)\b/;

/** Strips markdown decoration and annotations from a table's first cell. */
function memberName(cell) {
  let text = cell.trim();
  text = text.replace(/_\([^)]*\)_/g, ''); // _(via hostDirective)_
  text = text.replace(/\*\([^)]*\)\*/g, '');
  text = text.replace(/\*{1,2}/g, ''); // bold/italic markers — `_` is part of identifiers
  text = text.replace(/^_(?=\S)(.*?)(?<=\S)_$/, '$1'); // whole-cell italics
  text = text.trim();
  const backticked = text.match(/`([^`]+)`/);
  if (backticked) text = backticked[1];
  text = text.trim();
  text = text.replace(/^\[|\]$/g, ''); // [mlvSlot] selector-style cells
  const identifier = text.match(/^[A-Za-z_$][\w$]*/);
  return identifier ? identifier[0] : null;
}

/** Extracts the leading identifier a heading names, e.g. ``### `MlvDialogRef<T>` `` → `MlvDialogRef`. */
function headingIdentifier(title) {
  const backticked = title.match(/^\*{0,2}`([^`]+)`/);
  const candidate = (backticked ? backticked[1] : title).trim();
  const identifier = candidate.match(/^[A-Za-z_$][\w$]*/);
  return {
    identifier: identifier ? identifier[0] : null,
    quoted: !!backticked,
  };
}

/** Whether an identifier reads like an exported class/token rather than prose. */
function looksLikeSymbol(identifier) {
  return (
    /^Mlv[A-Z]/.test(identifier) ||
    /^[A-Z][A-Z0-9_]+$/.test(identifier) ||
    /(?:Directive|Component|Service|Pipe|Ref|Base|Accessor)$/.test(identifier)
  );
}

/**
 * Parses one library reference into the member rows it documents.
 *
 * Returns `{ sections, blocks, unknownSymbols }` where `sections` are member
 * tables attributed to a known symbol, `blocks` maps a symbol to every
 * backticked identifier mentioned under its heading (used to suppress
 * declared-but-undocumented warnings for prose-documented members), and
 * `unknownSymbols` are headings naming a class the barrel does not export.
 */
function parseDoc(text, knownSymbols) {
  const lines = text.split('\n');
  const sections = [];
  const blocks = new Map();
  const unknownSymbols = [];

  let symbol = null;
  let symbolLevel = 0;
  let sectionKind = null;
  let inFence = false;
  let table = null;

  const flushTable = () => {
    if (table && table.kind && table.symbol) sections.push(table);
    table = null;
  };
  const mention = (line) => {
    if (!symbol) return;
    const bucket = blocks.get(symbol);
    for (const span of line.matchAll(/`([^`]+)`/g)) {
      for (const token of span[1].matchAll(/[A-Za-z_$][\w$]*/g)) {
        bucket.add(token[0]);
      }
    }
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (/^\s*(?:```|~~~)/.test(line)) {
      flushTable();
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const heading = line.match(/^(#{1,6})\s+(.*?)\s*$/);
    if (heading) {
      flushTable();
      const level = heading[1].length;
      const title = heading[2];
      const { identifier, quoted } = headingIdentifier(title);

      if (identifier && knownSymbols.has(identifier)) {
        symbol = identifier;
        symbolLevel = level;
        sectionKind = null;
        if (!blocks.has(symbol)) blocks.set(symbol, new Set());
        continue;
      }
      if (identifier && quoted && looksLikeSymbol(identifier)) {
        // A heading that already declares the symbol internal is not drift.
        if (!/internal|not exported|deprecated|from `@/i.test(title)) {
          unknownSymbols.push({ name: identifier, line: index + 1 });
        }
        symbol = null;
        symbolLevel = level;
        sectionKind = null;
        continue;
      }
      if (symbol && level <= symbolLevel) {
        symbol = null;
        sectionKind = null;
        continue;
      }
      const normalized = title
        .toLowerCase()
        .replace(/[`*]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      // `ignored` is sticky: an explicitly non-public section must not fall back
      // to header-driven detection either.
      sectionKind = IGNORED_SECTIONS.test(normalized) ? 'ignored' : null;
      if (sectionKind === null) {
        for (const [pattern, kind] of SECTION_KINDS) {
          if (pattern.test(normalized)) {
            sectionKind = kind;
            break;
          }
        }
      }
      continue;
    }

    if (line.trimStart().startsWith('|')) {
      mention(line); // a member named in any table of the symbol's block counts
      const cells = line
        .trim()
        .slice(1)
        .replace(/\|\s*$/, '')
        .split('|');
      if (!table) {
        const header = cells[0].trim().toLowerCase().replace(/[`*]/g, '');
        table = {
          symbol,
          kind:
            sectionKind === 'ignored'
              ? null
              : (sectionKind ?? HEADER_KINDS.get(header) ?? null),
          rows: [],
          headerLine: index + 1,
        };
        continue;
      }
      if (/^[\s:|-]+$/.test(line)) continue; // separator row
      const name = memberName(cells[0] ?? '');
      if (name) table.rows.push({ name, line: index + 1 });
      continue;
    }

    flushTable();

    // Some references list members as a bullet list instead of a table. Only a
    // bullet whose whole leading code span is an identifier (optionally with a
    // parameter list) counts, so prose bullets never look like members.
    const bullet = line.match(/^\s*[-*]\s+`([A-Za-z_$][\w$]*)(?:\([^`]*\))?`/);
    if (bullet && symbol && sectionKind && sectionKind !== 'ignored') {
      sections.push({
        symbol,
        kind: sectionKind,
        rows: [{ name: bullet[1], line: index + 1 }],
      });
    }
    mention(line);
  }
  flushTable();

  return { sections, blocks, unknownSymbols };
}

// ────────────────────────────────────────────────────────────────────────────
// Comparison
// ────────────────────────────────────────────────────────────────────────────

/**
 * Inputs/outputs a class re-exposes through `hostDirectives` (the shared
 * `mlvDensity` density directive, the `@angular/aria` patterns, …). They are
 * real public bindings, but the extractor only walks the class itself and its
 * base chain, so they never appear in the generated JSON. Scanned straight from
 * the library sources and keyed by the class the decorator belongs to.
 */
const hostDirectiveCache = new Map();

function hostDirectiveBindings(target) {
  const key = `${target.family}/${target.entry}`;
  const cached = hostDirectiveCache.get(key);
  if (cached) return cached;

  const bindings = new Map();
  const stack = [
    join(workspaceRoot, 'libs', target.family, target.entry, 'src'),
  ];
  while (stack.length) {
    const current = stack.pop();
    if (!existsSync(current)) continue;
    for (const item of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, item.name);
      if (item.isDirectory()) {
        if (item.name !== 'node_modules') stack.push(full);
        continue;
      }
      if (!item.name.endsWith('.ts') || item.name.endsWith('.spec.ts'))
        continue;
      collectHostDirectiveBindings(readFileSync(full, 'utf8'), bindings);
    }
  }
  hostDirectiveCache.set(key, bindings);
  return bindings;
}

/** Reads every `hostDirectives: [...]` block and attributes it to the class that follows. */
function collectHostDirectiveBindings(source, bindings) {
  const marker = /hostDirectives:\s*\[/g;
  for (const match of source.matchAll(marker)) {
    const start = match.index + match[0].length;
    let depth = 1;
    let end = start;
    while (end < source.length && depth > 0) {
      if (source[end] === '[') depth += 1;
      else if (source[end] === ']') depth -= 1;
      end += 1;
    }
    const block = source.slice(start, end - 1);
    const owner = source
      .slice(end)
      .match(/export\s+(?:abstract\s+)?class\s+(\w+)/);
    if (!owner) continue;
    const names = bindings.get(owner[1]) ?? new Set();
    bindings.set(owner[1], names);
    for (const list of block.matchAll(/(?:inputs|outputs):\s*\[([^\]]*)\]/g)) {
      for (const raw of list[1].matchAll(/'([^']+)'/g)) {
        // `'multi: multiple'` exposes the alias `multiple`; keep both sides.
        for (const part of raw[1].split(':')) names.add(part.trim());
      }
    }
  }
}

/** Symbol kinds whose members the extractor actually populates. */
const MEMBER_KINDS = new Set([
  'component',
  'directive',
  'pipe',
  'service',
  'class',
]);

const BUCKETS = {
  inputs: ['inputs'],
  outputs: ['outputs'],
  models: ['inputs', 'outputs'],
  io: ['inputs', 'outputs'],
  methods: ['methods'],
};

/** Human label for the JSON bucket a documented row was expected in. */
const BUCKET_LABEL = {
  inputs: 'input',
  outputs: 'output',
  models: 'model',
  io: 'input/output',
  methods: 'method',
};

function compare(entry, doc, target, docFile) {
  const failures = [];
  const warnings = [];
  const symbols = new Map(entry.symbols.map((symbol) => [symbol.name, symbol]));
  const documented = new Map(); // symbol → Set of documented member names

  for (const unknown of doc.unknownSymbols) {
    warnings.push({
      code: 'unknown-symbol',
      file: docFile,
      line: unknown.line,
      symbol: unknown.name,
      message: `documented section names \`${unknown.name}\`, which the public barrel does not export`,
    });
  }

  for (const section of doc.sections) {
    const symbol = symbols.get(section.symbol);
    // Interfaces, type aliases, and tokens carry no extracted members, so their
    // documented tables have nothing to compare against.
    if (!symbol || !MEMBER_KINDS.has(symbol.kind)) continue;
    const names = documented.get(symbol.name) ?? new Set();
    documented.set(symbol.name, names);

    for (const row of section.rows) {
      names.add(row.name);
      const expected = BUCKETS[section.kind];
      const found = expected.some((bucket) =>
        symbol[bucket].some((member) => member.name === row.name),
      );
      if (found) continue;

      if (
        section.kind !== 'methods' &&
        hostDirectiveBindings(target).get(symbol.name)?.has(row.name)
      ) {
        continue; // re-exposed through hostDirectives — a real binding the extractor cannot see
      }

      const elsewhere = ['inputs', 'outputs', 'methods', 'properties'].find(
        (bucket) =>
          !expected.includes(bucket) &&
          symbol[bucket].some((member) => member.name === row.name),
      );
      failures.push({
        code: 'not-declared',
        file: docFile,
        line: row.line,
        symbol: symbol.name,
        member: row.name,
        message: elsewhere
          ? `documented as ${BUCKET_LABEL[section.kind]} but declared as ${elsewhere === 'properties' ? 'a property' : `an ${BUCKET_LABEL[elsewhere] ?? elsewhere}`}`
          : `documented but not declared (no such ${BUCKET_LABEL[section.kind]} on ${symbol.name})`,
      });
    }
  }

  for (const [name, names] of documented) {
    const symbol = symbols.get(name);
    const mentioned = doc.blocks.get(name) ?? new Set();
    for (const bucket of ['inputs', 'outputs', 'methods']) {
      for (const member of symbol[bucket]) {
        if (names.has(member.name) || mentioned.has(member.name)) continue;
        warnings.push({
          code: 'undocumented',
          file: docFile,
          symbol: name,
          member: member.name,
          bucket,
          message: `declared ${BUCKET_LABEL[bucket]} \`${member.name}\` is not documented`,
        });
      }
    }
  }

  return { failures, warnings };
}

// ────────────────────────────────────────────────────────────────────────────
// Runner
// ────────────────────────────────────────────────────────────────────────────

function relative(file) {
  return file.startsWith(workspaceRoot)
    ? file.slice(workspaceRoot.length + 1)
    : file;
}

function main() {
  const overrides = readApiOverrides();
  const pages = listApiPages();

  const failures = [];
  const warnings = [];
  const skipped = [];
  const checkedDocs = new Set();

  // Pages that opted out of an API tab never produce JSON, so they can only be
  // discovered through the overrides map.
  for (const [page, target] of overrides) {
    if (!target) skipped.push({ page, reason: 'page declares no API target' });
  }

  for (const page of pages) {
    const target = apiTargetFor(page, overrides);
    if (!target) continue;
    const docFile = resolveDocFile(target);
    if (!docFile) {
      skipped.push({
        page,
        reason: `no reference document for libs/${target.family}/${target.entry}`,
      });
      continue;
    }
    if (checkedDocs.has(docFile)) continue; // aliased pages share one document
    checkedDocs.add(docFile);

    const entry = JSON.parse(
      readFileSync(join(API_DIR, `${page}.json`), 'utf8'),
    );
    const knownSymbols = new Set(entry.symbols.map((symbol) => symbol.name));
    const doc = parseDoc(readFileSync(docFile, 'utf8'), knownSymbols);
    const result = compare(entry, doc, target, relative(docFile));
    failures.push(...result.failures);
    warnings.push(...result.warnings);
  }

  const unchecked = readdirSync(PROJECT_DOCS_DIR)
    .filter((file) => file.startsWith('libs-') && file.endsWith('.md'))
    .map((file) => join(PROJECT_DOCS_DIR, file))
    .filter((file) => statSync(file).isFile() && !checkedDocs.has(file))
    .map((file) => ({
      doc: relative(file),
      reason: 'no docs page maps to this library',
    }));

  if (asJson) {
    console.log(
      JSON.stringify(
        { failures, warnings, skipped, unchecked, strict },
        null,
        2,
      ),
    );
  } else {
    report({ failures, warnings, skipped, unchecked });
  }

  const failed = failures.length > 0 || (strict && warnings.length > 0);
  process.exitCode = failed ? 1 : 0;
}

function report({ failures, warnings, skipped, unchecked }) {
  const location = (item) =>
    `${item.file}${item.line ? `:${item.line}` : ''} — ${item.symbol}${item.member ? `.${item.member}` : ''}`;

  if (failures.length) {
    console.log('\nFailures — documented but not declared\n');
    for (const failure of failures) {
      console.log(`  ${location(failure)}: ${failure.message}`);
    }
  }

  if (warnings.length) {
    console.log('\nWarnings — declared but not documented\n');
    const byDoc = new Map();
    for (const warning of warnings) {
      const bucket = byDoc.get(warning.file) ?? [];
      bucket.push(warning);
      byDoc.set(warning.file, bucket);
    }
    for (const [file, items] of [...byDoc].sort()) {
      console.log(`  ${file} (${items.length})`);
      for (const item of items)
        console.log(`    ${item.symbol}: ${item.message}`);
    }
  }

  if (skipped.length) {
    console.log('\nSkipped docs pages\n');
    for (const item of skipped) console.log(`  ${item.page}: ${item.reason}`);
  }
  if (unchecked.length) {
    console.log('\nUnchecked reference documents\n');
    for (const item of unchecked) console.log(`  ${item.doc}: ${item.reason}`);
  }

  console.log(
    `\n[check-doc-api] ${failures.length} failure(s), ${warnings.length} warning(s).` +
      (failures.length || (strict && warnings.length) ? '' : ' OK'),
  );
}

main();
