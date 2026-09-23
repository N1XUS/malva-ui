/**
 * Malva UI — the runtime AI translation API is deprecated (#292, decision D26)
 *
 * Deprecated rather than repaired. Nothing in the library calls
 * `MlvAiTranslationService`, its configuration's `enabled`, `cache` and
 * `targetLocale` are never read, and the one shipped provider,
 * `claudeProvider()`, sends a secret API key from whatever runtime calls it.
 * Registered in an application configuration that reaches the browser, that
 * key ships to every visitor and is readable by any of them. The key risk is
 * `claudeProvider()`'s alone: a consumer-written `MlvTranslationProvider` that
 * calls the consumer's own server holds no key. The whole subsystem is removed
 * in the next major (VERSIONING.md §3, §5).
 *
 * What this pins, read through the public barrel exactly as a consumer's
 * TypeScript resolves it — so a symbol re-exported under the barrel but
 * declared somewhere unexpected is still found:
 *
 * - **Every** export declared under `lib/ai/`, derived rather than listed, plus
 *   the four contract types in `types.ts` that exist only for that path, carries
 *   a `@deprecated` tag naming both versions. A new export added under `lib/ai/`
 *   without one fails here, not only in review.
 * - `MlvTranslationContext` is **not** deprecated: every `MLV_*_I18N_CONTEXT`
 *   record is typed with it, and those records are not part of the runtime
 *   subsystem.
 * - No comment in the AI surface passes an API key as an argument
 *   (`{ apiKey: … }`, the shorthand `{ apiKey }`, or `apiKey = …`). The two
 *   removed key examples were the whole exposure (0 in-repo callers), and an
 *   example can live in a JSDoc body, an `@example` tag, a member's JSDoc or a
 *   plain comment — so every comment range in every `lib/ai/` file and in the
 *   four contract interfaces is scanned, not only the top-level `@example`
 *   tags. A self-test pins that the scan sees the shapes a top-level tag read
 *   misses, including the shorthand, and ignores prose naming the member.
 *
 * `scripts/check-deprecations.mjs` (a dependency of the root `test` target)
 * separately enforces the tag grammar across `libs/`; it cannot tell whether a
 * symbol that *should* be deprecated is, which is the half asserted here.
 */
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';

/** `libs/i18n/src`, resolved from this file rather than from `process.cwd()`. */
const SOURCE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The published root entry point of `@malva-ui/i18n`. */
const BARREL = join(SOURCE_ROOT, 'index.ts');

/**
 * Directory holding the runtime AI translation subsystem, in the
 * forward-slash form TypeScript reports `SourceFile.fileName` in.
 */
const AI_DIRECTORY = `${join(SOURCE_ROOT, 'lib', 'ai').split(sep).join('/')}/`;

/**
 * Contract types declared in `types.ts` that exist only for the runtime AI
 * path: nothing but `MlvAiTranslationService`, `claudeProvider()` and the
 * config token reads them.
 */
const AI_CONTRACT_TYPES = [
  'MlvAiTranslationConfig',
  'MlvTranslationProvider',
  'MlvTranslationRequest',
  'MlvTranslationResult',
];

/**
 * `since <major.minor.patch>` — VERSIONING.md §5 requires the patch while the
 * line is `0.x`, where a bare minor identifies no release.
 */
const SINCE = /\bsince\s+\d+\.\d+\.\d+\b/;

/** `removed in <major>.0` — removal lands on a major boundary only. */
const REMOVED = /\bremoved\s+in\s+\d+\.0(?:\.0)?\b/;

/**
 * An API key passed as an object property — `claudeProvider({ apiKey: … })`,
 * the shorthand `claudeProvider({ apiKey })` / `{ apiKey, model }`, or an
 * assignment (`const apiKey = …`). Prose that names the member
 * (`` `apiKey` ``, `` `config.apiKey` ``, "sends `apiKey` with") is followed
 * by a backtick or a space, and the `apiKey: string` member itself is code,
 * not comment.
 */
const API_KEY_ARGUMENT = /\bapiKey\b\s*[:,}=]/;

interface ExportedDeclaration {
  readonly name: string;
  readonly declaration: ts.Declaration;
}

interface SourceComment {
  /** 1-based line the comment starts on. */
  readonly line: number;
  readonly text: string;
}

/** Resolves every export of the barrel to the declaration it names. */
function barrelExports(): ExportedDeclaration[] {
  const program = ts.createProgram([BARREL], {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    skipLibCheck: true,
    types: [],
  });
  const checker = program.getTypeChecker();
  const barrel = program.getSourceFile(BARREL);
  const moduleSymbol = barrel && checker.getSymbolAtLocation(barrel);
  if (!moduleSymbol) throw new Error(`Could not resolve ${BARREL}`);

  return checker.getExportsOfModule(moduleSymbol).flatMap((exported) => {
    const symbol =
      exported.flags & ts.SymbolFlags.Alias
        ? checker.getAliasedSymbol(exported)
        : exported;
    const declaration = symbol.declarations?.[0];
    return declaration ? [{ name: exported.getName(), declaration }] : [];
  });
}

/** The comment text of the declaration's `@deprecated` tag, or `null`. */
function deprecationText(declaration: ts.Declaration): string | null {
  const tag = ts.getJSDocDeprecatedTag(declaration);
  return tag ? (ts.getTextOfJSDocComment(tag.comment) ?? '') : null;
}

/**
 * Every comment whose range lies inside `[start, end]` of `file` — JSDoc and
 * plain, leading and trailing, on a declaration and on every member and
 * statement below it.
 *
 * Walks every node **and token** (`getChildren` includes punctuation), reading
 * both the leading and the trailing comment ranges at each boundary, so a
 * comment on the same line as `{` or in the trivia before a closing `}` is
 * found too. JSDoc nodes are not descended into: the comment holding them is
 * already collected as trivia of the node they document.
 */
function commentsIn(
  file: ts.SourceFile,
  start = file.getFullStart(),
  end = file.getEnd(),
): SourceComment[] {
  const text = file.getFullText();
  const found = new Map<number, string>();
  const collect = (ranges: ts.CommentRange[] | undefined): void => {
    for (const range of ranges ?? []) {
      if (range.pos >= start && range.end <= end) {
        found.set(range.pos, text.slice(range.pos, range.end));
      }
    }
  };
  const visit = (node: ts.Node): void => {
    if (ts.isJSDoc(node)) return;
    collect(ts.getLeadingCommentRanges(text, node.getFullStart()));
    collect(ts.getTrailingCommentRanges(text, node.getEnd()));
    for (const child of node.getChildren(file)) visit(child);
  };
  visit(file);

  return [...found].map(([pos, comment]) => ({
    line: file.getLineAndCharacterOfPosition(pos).line + 1,
    text: comment,
  }));
}

const EXPORTS = barrelExports();

const AI_EXPORTS = EXPORTS.filter(
  ({ name, declaration }) =>
    declaration.getSourceFile().fileName.startsWith(AI_DIRECTORY) ||
    AI_CONTRACT_TYPES.includes(name),
);

const AI_SURFACE = AI_EXPORTS.map(({ name }) => name).sort();

/**
 * Every comment the key-example rule covers, labelled `path:line`: whole files
 * under `lib/ai/`, and the full span — leading JSDoc and members included — of
 * each contract interface in `types.ts`.
 */
const AI_COMMENTS = (() => {
  const wholeFiles = new Set<ts.SourceFile>();
  const spans: [ts.SourceFile, number, number][] = [];
  for (const { declaration } of AI_EXPORTS) {
    const file = declaration.getSourceFile();
    if (file.fileName.startsWith(AI_DIRECTORY)) {
      wholeFiles.add(file);
    } else {
      spans.push([file, declaration.getFullStart(), declaration.getEnd()]);
    }
  }
  const label = (file: ts.SourceFile, comment: SourceComment) => ({
    location: `${relative(SOURCE_ROOT, file.fileName)}:${comment.line}`,
    text: comment.text,
  });

  return [
    ...[...wholeFiles].flatMap((file) =>
      commentsIn(file).map((comment) => label(file, comment)),
    ),
    ...spans.flatMap(([file, start, end]) =>
      commentsIn(file, start, end).map((comment) => label(file, comment)),
    ),
  ];
})();

describe('@malva-ui/i18n — runtime AI translation deprecation (#292)', () => {
  it('derives the whole AI surface from the barrel, not an empty set', () => {
    // A floor, so a resolution failure cannot make every assertion below
    // vacuously true: the six `lib/ai/` exports plus the four contract types.
    expect(AI_SURFACE).toEqual([
      'MLV_AI_TRANSLATION_CONFIG',
      'MLV_AI_TRANSLATION_ENABLED',
      'MlvAiTranslationConfig',
      'MlvAiTranslationService',
      'MlvClaudeProviderConfig',
      'MlvTranslationProvider',
      'MlvTranslationRequest',
      'MlvTranslationResult',
      'claudeProvider',
      'provideMlvAiTranslation',
    ]);
  });

  it.each(AI_SURFACE)(
    '%s carries a @deprecated tag naming both versions',
    (name) => {
      const entry = EXPORTS.find((candidate) => candidate.name === name);
      const text = entry ? deprecationText(entry.declaration) : null;

      expect(text, `${name} has no @deprecated tag`).not.toBeNull();
      expect(text).toMatch(SINCE);
      expect(text).toMatch(REMOVED);
    },
  );

  it('leaves MlvTranslationContext undeprecated — the MLV_*_I18N_CONTEXT records use it', () => {
    const entry = EXPORTS.find(({ name }) => name === 'MlvTranslationContext');

    expect(entry, 'MlvTranslationContext is not exported').toBeDefined();
    expect(entry && deprecationText(entry.declaration)).toBeNull();
  });

  describe('no comment in the AI surface passes an API key', () => {
    it('the comment scan finds a body example, a member @example and a shorthand key, and skips code and prose', () => {
      // The two shapes a read of top-level `@example` tags misses: a fenced
      // block in the declaration's JSDoc body (comment on line 1) and an
      // `@example` on a member (line 10) — plus the shorthand property in a
      // plain comment (line 15). Line 11 is the member itself — code, not a
      // comment — and line 12 names `apiKey` in prose, which must not match.
      const fixture = ts.createSourceFile(
        'fixture.ts',
        [
          '/**',
          ' * Creates a provider.',
          ' *',
          ' * ```ts',
          ' * claudeProvider({ apiKey: env.KEY })',
          ' * ```',
          ' */',
          'export function claudeProvider(): void {}',
          'export interface Config {',
          "  /** @example claudeProvider({ apiKey: '…' }) */",
          '  apiKey: string;',
          '  /** Sent with `apiKey`, like `config.apiKey` — prose, not a hit. */',
          '  model: string;',
          '}',
          '// const provider = claudeProvider({ apiKey });',
          'export const provider = null;',
        ].join('\n'),
        ts.ScriptTarget.ES2022,
        true,
      );

      const hits = commentsIn(fixture)
        .filter(({ text }) => API_KEY_ARGUMENT.test(text))
        .map(({ line }) => line);

      expect(hits).toEqual([1, 10, 15]);
    });

    it('scans every AI comment, not an empty set', () => {
      // A floor for the scan itself: each of the ten deprecation tags sits in
      // a comment the scan covers, so a walker that found nothing fails here
      // instead of passing the assertion below vacuously.
      const tags = AI_COMMENTS.filter(({ text }) =>
        text.includes('@deprecated'),
      );

      expect(tags.length).toBeGreaterThanOrEqual(AI_SURFACE.length);
    });

    it('finds no API key argument in any comment of the AI files or contract types', () => {
      const offending = AI_COMMENTS.filter(({ text }) =>
        API_KEY_ARGUMENT.test(text),
      ).map(({ location }) => location);

      expect(offending).toEqual([]);
    });
  });
});
