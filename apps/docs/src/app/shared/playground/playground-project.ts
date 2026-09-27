/**
 * Turns one docs example's resolved source into a self-contained Angular CLI
 * project that StackBlitz can boot from a `POST /run` payload.
 *
 * Deliberately free of Angular imports: it is a pure function over the record
 * `ExampleContainerComponent` already resolves for the code tabs, so it is unit
 * testable, and `apps/docs/tools/write-playground-project.ts` can run the very
 * same builder in Node to materialise a project on disk for CI.
 *
 * ## Why a files payload rather than a GitHub URL
 *
 * StackBlitz can boot a project either from a repository URL or from a POSTed
 * file set. The repository route needs a *public* repo, and this one is private
 * until #22 flips it; the file-set route works today and keeps working after the
 * flip, so it is the only option that is correct in both states. It is also the
 * only one that can carry the version table below, which is derived per build.
 */

/** One resolved source file of an example, as the example container holds it. */
export interface PlaygroundSourceFile {
  /** Tab name from the `docsExample` pipe: `TypeScript`, `HTML`, `SCSS`, `CSS`. */
  readonly type: string;
  /** Verbatim file content. */
  readonly content: string;
}

/** npm package name → the version the template installs. */
export type PlaygroundVersions = Readonly<Record<string, string>>;

/** Published Malva package → the peers a consumer must install alongside it. */
export type PlaygroundPeers = Readonly<Record<string, readonly string[]>>;

/** A StackBlitz project payload, ready to be POSTed to `/run`. */
export interface PlaygroundProject {
  /** Project title shown in the StackBlitz header. */
  readonly title: string;
  /** Project description shown under the title. */
  readonly description: string;
  /** WebContainer template — `node`, so `package.json` drives the install. */
  readonly template: 'node';
  /** Complete file set, keyed by project-relative path. */
  readonly files: Readonly<Record<string, string>>;
  /** The file StackBlitz opens in the editor first. */
  readonly openFile: string;
}

/** Everything {@link createPlaygroundProject} needs to emit a project. */
export interface PlaygroundProjectInput {
  /** The example's resolved source files. */
  readonly files: readonly PlaygroundSourceFile[];
  /** The generated version table (`src/generated/playground-versions.ts`). */
  readonly versions: PlaygroundVersions;
  /** The generated peer table (`src/generated/playground-versions.ts`). */
  readonly peers: PlaygroundPeers;
  /** Project title. */
  readonly title: string;
  /** Project description. */
  readonly description: string;
  /**
   * Packages `npm install` cannot fetch, overriding {@link UNPUBLISHED_PACKAGES}.
   *
   * Only `apps/docs/tools/write-playground-project.ts` passes it, and only to
   * pass `[]`: that job exists to materialise a project whose publication is
   * then checked over the network. Nothing in the browser sets it.
   */
  readonly unpublished?: readonly string[];
}

/**
 * Either a project, or `null` plus the reason this example cannot be opened.
 *
 * A button that opens a project which cannot compile is worse than no button, so
 * every reason to doubt returns `null` and the affordance is not rendered.
 */
export type PlaygroundProjectResult =
  | { readonly project: PlaygroundProject; readonly blockedBy: null }
  | { readonly project: null; readonly blockedBy: string };

/** Example tab name → the file name it keeps inside `src/example/`. */
const SOURCE_FILE_NAME: Readonly<Record<string, string>> = {
  TypeScript: 'index.ts',
  HTML: 'index.html',
  SCSS: 'index.scss',
  CSS: 'index.css',
};

/** The generated project's npm/Angular project name. */
const PROJECT_NAME = 'malva-ui-playground';

/**
 * Packages the version table names but npm has never seen. Empty while every
 * package in the release set is on npm.
 *
 * `nx.json` → `release.projects` is what the version table is derived from, and
 * being in it means "will be published at the next release", not "is on npm
 * now". A package that joins the release set between two releases therefore
 * resolves to a version that 404s on install until the next release ships it —
 * and a WebContainer that fails on install is exactly the broken button this
 * builder exists to withhold. Add such a package here on the commit that adds it
 * to the release set, and every example importing it loses its button until it
 * is published.
 *
 * The last two entries were `@malva-ui/scheduler` and `@malva-ui/taskboard`:
 * both joined the release set after `v0.1.15` and were first published at
 * `0.2.0` (#594).
 *
 * The networked workflow already skips its own install for a package npm does
 * not have, loudly and by name; this is the same knowledge on the browser side,
 * where there is no network to ask at build time.
 *
 * **An entry is pinned twice so it cannot outlive its reason:**
 * `playground-corpus.spec.ts` fails once the root manifest moves off
 * {@link UNPUBLISHED_VERIFIED_AT} while this list names anything (publication
 * status can only change at a release; see {@link unpublishedRecheckReason}),
 * and `.github/workflows/playground.yml` fails if `npm view` resolves any name
 * here. Either failure means: check `npm view` and delete every entry that
 * resolves. An empty list arms neither pin, so a release with nothing listed
 * stays green.
 */
export const UNPUBLISHED_PACKAGES: readonly string[] = [];

/**
 * The workspace root version at which {@link UNPUBLISHED_PACKAGES} was last
 * checked against npm by hand.
 *
 * Asserted equal to the root manifest's `version` by `playground-corpus.spec.ts`
 * only while the list names a package, so the first release after an entry
 * lands turns the suite red and forces the list to be re-checked rather than
 * assumed. Set it to the current root version when adding an entry: an entry
 * added under an older value fails the suite on that same commit. While the
 * list is empty it asserts nothing and keeps the version the list was last
 * checked at.
 */
export const UNPUBLISHED_VERIFIED_AT = '0.2.0';

/**
 * Why {@link UNPUBLISHED_PACKAGES} is owed a fresh check against npm, or `null`
 * when it is not.
 *
 * Owed only while the list names a package **and** the root manifest has moved
 * off the version it was last checked at. Publication status can only change
 * at a release, so a release is what makes an entry doubtful; an empty list
 * claims nothing a release could make wrong, so it owes nothing — otherwise the
 * pin would turn `docs:test` red at every release after the last entry left
 * (#594). The first entry added re-arms it.
 *
 * Pure, so the rule is unit-tested apart from whatever the list holds today;
 * `playground-corpus.spec.ts` applies it to the real list and root manifest.
 *
 * @param packages The list to judge.
 * @param verifiedAt The root version it was last checked at.
 * @param rootVersion The workspace root manifest's current `version`.
 */
export function unpublishedRecheckReason(
  packages: readonly string[],
  verifiedAt: string,
  rootVersion: string,
): string | null {
  if (packages.length === 0 || verifiedAt === rootVersion) return null;

  return (
    `UNPUBLISHED_PACKAGES (${packages.join(', ')}) was last checked against ` +
    `npm at ${verifiedAt}, but the root manifest is ${rootVersion}. Run ` +
    '`npm view <name> version` for each entry, delete every one that now ' +
    `resolves, and set UNPUBLISHED_VERIFIED_AT to ${rootVersion}.`
  );
}

/**
 * The stylesheet `libs/core/schematics/ng-add` adds to a consumer's build
 * target. Kept identical so the playground is the shape `ng add` produces.
 */
const GLOBAL_STYLESHEET = 'node_modules/@malva-ui/core/styles/malva-ui.css';

/**
 * Packages every generated project installs regardless of what the example
 * imports: the three `ng add` installs, the Angular runtime `main.ts` needs, and
 * `tslib` (the workspace compiles with `importHelpers`).
 *
 * No `@angular/animations`: it is deprecated in Angular 22, and nothing in the
 * workspace imports it — Malva UI animates in CSS through the `--mlv-duration-*`
 * tokens, and the docs app dropped its own provider in #296. A starter template
 * that installed it would pull a deprecated package and print a warning on every
 * consumer's first `npm install`.
 */
const BASE_DEPENDENCIES: readonly string[] = [
  '@angular/common',
  '@angular/compiler',
  '@angular/core',
  '@angular/platform-browser',
  '@malva-ui/cdk',
  '@malva-ui/core',
  '@malva-ui/i18n',
  'tslib',
];

/** The toolchain that compiles and serves the generated project. */
const DEV_DEPENDENCIES: readonly string[] = [
  '@angular/build',
  '@angular/cli',
  '@angular/compiler-cli',
  'typescript',
];

/**
 * Every module specifier an ES module source imports, re-exports or dynamically
 * imports, without duplicates.
 *
 * A regex rather than a parser: the docs bundle must stay small, and the only
 * way this can be wrong is by seeing a specifier that is not really there —
 * which can only make an example look *less* portable, never wrongly portable.
 *
 * @param source TypeScript source text.
 */
export function collectImportSpecifiers(source: string): string[] {
  const patterns = [
    // `import … from '…'` and `export … from '…'`.
    /\bfrom\s*['"]([^'"]+)['"]/g,
    // `import('…')`, static or awaited.
    /\bimport\s*\(\s*['"]([^'"]+)['"]/g,
    // Side-effect `import '…';` at the start of a line.
    /^\s*import\s+['"]([^'"]+)['"]/gm,
  ];

  const found = new Set<string>();
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) found.add(match[1]);
  }
  return [...found];
}

/**
 * The installable package a module specifier belongs to.
 *
 * @param specifier A bare module specifier, e.g. `@malva-ui/core/button`.
 */
export function packageRootOf(specifier: string): string {
  const segments = specifier.split('/');
  return specifier.startsWith('@')
    ? segments.slice(0, 2).join('/')
    : segments[0];
}

/**
 * Builds a StackBlitz project payload for one docs example.
 *
 * @param input The example's sources plus the generated version and peer tables.
 */
export function createPlaygroundProject(
  input: PlaygroundProjectInput,
): PlaygroundProjectResult {
  const sources = new Map<string, string>();
  for (const file of input.files) {
    const name = SOURCE_FILE_NAME[file.type];
    if (name && file.content.length > 0) sources.set(name, file.content);
  }

  const typescript = sources.get('index.ts');
  if (!typescript) {
    return {
      project: null,
      blockedBy: 'the example has no resolved TypeScript source',
    };
  }

  const selector = parseBootstrapSelector(typescript);
  if (!selector) {
    return {
      project: null,
      blockedBy:
        'no element selector could be read from the exported component, so ' +
        'nothing could mount it',
    };
  }

  const specifiers = collectImportSpecifiers(typescript);
  const local = [
    ...specifiers.filter(
      (specifier) => specifier.startsWith('.') || specifier.startsWith('/'),
    ),
    ...collectStylesheetLoads(sources),
  ];
  if (local.length > 0) {
    return {
      project: null,
      blockedBy:
        `the example imports docs-local code (${local.join(', ')}), which is ` +
        'not published and cannot be carried into a standalone project',
    };
  }

  const imported = [...new Set(specifiers.map(packageRootOf))];
  const unknown = imported.filter((name) => !(name in input.versions));
  if (unknown.length > 0) {
    return {
      project: null,
      blockedBy:
        `no published version is known for ${unknown.join(', ')}, so the ` +
        'generated project could not declare it',
    };
  }

  const unpublished = input.unpublished ?? UNPUBLISHED_PACKAGES;
  const unreleased = imported.filter((name) => unpublished.includes(name));
  if (unreleased.length > 0) {
    return {
      project: null,
      blockedBy:
        `${unreleased.join(', ')} has a version in the release set but has ` +
        'never been published to npm, so the install would 404',
    };
  }

  const closure = resolveDependencyClosure(
    [...BASE_DEPENDENCIES, ...imported],
    input.peers,
    input.versions,
  );
  if ('missing' in closure) {
    return {
      project: null,
      blockedBy: `no published version is known for ${closure.missing}`,
    };
  }

  const missingDevDependency = DEV_DEPENDENCIES.find(
    (name) => !input.versions[name],
  );
  if (missingDevDependency) {
    return {
      project: null,
      blockedBy: `no published version is known for ${missingDevDependency}`,
    };
  }

  const typings = imported
    .map(typingsPackageOf)
    .filter((name) => name in input.versions);

  const files: Record<string, string> = {
    'package.json': renderPackageJson(
      closure.versions,
      input.versions,
      typings,
    ),
    'angular.json': renderAngularJson(),
    'tsconfig.json': renderTsConfig(),
    '.stackblitzrc': `${JSON.stringify(
      { installDependencies: true, startCommand: 'npm start' },
      null,
      2,
    )}\n`,
    'README.md': renderReadme(input.title),
    'src/index.html': renderIndexHtml(selector, input.title),
    'src/main.ts': renderMain(imported, specifiers),
    'src/styles.css': renderStyles(),
  };

  for (const [name, content] of sources) files[`src/example/${name}`] = content;

  // A `templateUrl` / `styleUrl` the resolved sources do not cover still has to
  // exist, or the Angular compiler fails on a missing file. `card/examples/7`
  // is the live case: it declares `styleUrl: './index.scss'` against a 0-byte
  // stylesheet, which both the `docsExample` pipe and the example container
  // drop as empty, so the builder never sees it.
  for (const name of referencedAssets(typescript)) {
    files[`src/example/${name}`] ??= '';
  }

  return {
    project: {
      title: input.title,
      description: input.description,
      template: 'node',
      files,
      openFile: 'src/example/index.ts',
    },
    blockedBy: null,
  };
}

/**
 * The sibling `index.*` files an example's decorators reference by URL.
 *
 * `templateUrl`, `styleUrl` and each entry of a `styleUrls` array are all
 * written as a `'./index.<ext>'` literal in this codebase, and no other string
 * in an example takes that shape, so one literal match covers all three.
 *
 * @param source TypeScript source text of the example.
 */
function referencedAssets(source: string): string[] {
  return [
    ...new Set(
      [...source.matchAll(/['"]\.\/(index\.[a-z]+)['"]/g)].map(
        (match) => match[1],
      ),
    ),
  ].filter((name) => name !== 'index.ts');
}

/**
 * A copy of `source` in which every comment body, string body and
 * template-literal body has been replaced by spaces.
 *
 * Every character maps 1:1 (newlines survive as themselves), so an index into
 * the result is an index into the original — which is what lets the selector be
 * *located* against code only and then *read* from the untouched source.
 *
 * One pass with an explicit mode stack rather than an alternation of regexes,
 * because the two agree only when nothing nests and the shapes this exists to
 * survive are the nested ones: an apostrophe inside a `//` comment, a `//`
 * inside a string, a `@Component` inside a template literal.
 *
 * Known limit: a regex literal is treated as ordinary code, so one containing a
 * quote, a backtick or a comment opener would desynchronise the scan. No docs
 * example contains such a literal today, and `playground-corpus.spec.ts` reads
 * every example's selector back with the real TypeScript parser, so one that did
 * would fail the suite rather than ship a wrong tag.
 *
 * @param source TypeScript source text.
 */
export function maskNonCode(source: string): string {
  const out = source.split('');
  /** Replaces `[from, to)` with spaces, keeping newlines. */
  const blank = (from: number, to: number): void => {
    for (let i = from; i < to && i < out.length; i += 1) {
      if (out[i] !== '\n') out[i] = ' ';
    }
  };

  // Innermost-last. A `template` frame is pushed by a backtick and popped by
  // the matching one; a `code` frame is pushed by `${` and popped by the `}`
  // that closes it, which is how a nested template literal stays balanced.
  const frames: ('code' | 'template')[] = ['code'];
  // Depth of `{` … `}` pairs inside the innermost `code` frame, so only the
  // brace that really closes an interpolation pops it.
  const depths: number[] = [0];
  let i = 0;

  while (i < source.length) {
    const char = source[i];
    const pair = source.slice(i, i + 2);
    const inTemplate = frames[frames.length - 1] === 'template';

    if (inTemplate) {
      if (char === '\\') {
        blank(i, i + 2);
        i += 2;
      } else if (pair === '${') {
        blank(i, i + 2);
        frames.push('code');
        depths.push(0);
        i += 2;
      } else if (char === '`') {
        frames.pop();
        i += 1;
      } else {
        blank(i, i + 1);
        i += 1;
      }
      continue;
    }

    if (pair === '//') {
      const end = source.indexOf('\n', i);
      const stop = end === -1 ? source.length : end;
      blank(i, stop);
      i = stop;
    } else if (pair === '/*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? source.length : end + 2;
      blank(i, stop);
      i = stop;
    } else if (char === "'" || char === '"') {
      let end = i + 1;
      while (end < source.length && source[end] !== char) {
        end += source[end] === '\\' ? 2 : 1;
      }
      blank(i + 1, Math.min(end, source.length));
      i = end + 1;
    } else if (char === '`') {
      frames.push('template');
      i += 1;
    } else if (char === '{') {
      depths[depths.length - 1] += 1;
      i += 1;
    } else if (char === '}') {
      if (depths[depths.length - 1] === 0 && frames.length > 1) {
        blank(i, i + 1);
        frames.pop();
        depths.pop();
      } else {
        depths[depths.length - 1] -= 1;
      }
      i += 1;
    } else {
      i += 1;
    }
  }

  return out.join('');
}

/**
 * The element selector of the component the example default-exports.
 *
 * Ten examples declare more than one `@Component`, and the exported one is
 * always last, so this reads the selector of the decorator that immediately
 * precedes `export default class` rather than the first one in the file. Only a
 * plain element selector can be mounted by writing a tag into `index.html`, so
 * an attribute or compound selector is rejected.
 *
 * Both searches run over {@link maskNonCode}, not the raw text, because a
 * `@Component` inside a template literal (an example that *displays* Angular
 * source — `getting-started` and `tailwind` already display source) and a
 * commented-out `selector:` above the live one would each yield a tag that
 * matches no component: `ng build` succeeds, `bootstrapApplication` finds no
 * host, and the visitor gets a blank page with nothing to read.
 *
 * @param source TypeScript source text of the example.
 */
function parseBootstrapSelector(source: string): string | null {
  const masked = maskNonCode(source);

  const exportIndex = masked.search(/\bexport\s+default\s+class\b/);
  if (exportIndex === -1) return null;

  const decoratorIndex = masked.lastIndexOf('@Component', exportIndex);
  if (decoratorIndex === -1) return null;

  // Located in the masked copy so a commented-out key is invisible, then read
  // out of the original, where the value still has its characters.
  const key = /\bselector\s*:/.exec(masked.slice(decoratorIndex, exportIndex));
  if (!key) return null;

  const match = /^selector\s*:\s*['"]([^'"]+)['"]/.exec(
    source.slice(decoratorIndex + key.index),
  );
  const selector = match?.[1];

  return selector && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(selector)
    ? selector
    : null;
}

/**
 * Expands a set of packages over the published peer graph and pairs each with
 * its version.
 *
 * npm 7+ installs missing peers on its own, but a WebContainer install that
 * depends on that behaviour fails opaquely when it does not happen. Declaring
 * the closure explicitly makes the generated `package.json` say exactly what the
 * project needs — and makes it readable as documentation of a real install.
 *
 * @param roots Packages known to be needed directly.
 * @param peers The generated peer table.
 * @param versions The generated version table.
 */
function resolveDependencyClosure(
  roots: readonly string[],
  peers: PlaygroundPeers,
  versions: PlaygroundVersions,
): { versions: Record<string, string> } | { missing: string } {
  const seen = new Set<string>();
  const queue = [...roots];

  while (queue.length > 0) {
    const name = queue.pop() as string;
    if (seen.has(name)) continue;
    seen.add(name);
    for (const peer of peers[name] ?? []) queue.push(peer);
  }

  const resolved: Record<string, string> = {};
  for (const name of [...seen].sort()) {
    const version = versions[name];
    if (!version) return { missing: name };
    resolved[name] = version;
  }

  return { versions: resolved };
}

/**
 * The URLs an example stylesheet loads through an `@use`, `@forward` or
 * `@import` rule, other than a Sass built-in module such as `sass:map`.
 *
 * Each one counts as docs-local code: the generated project carries only the
 * example's own `index.*` files and the published stylesheet, so a partial
 * beside the example fails `ng build` with "Can't find stylesheet to import".
 * All eight `taskboard/*` examples `@use '../ticket'` (#594). A bare
 * `@use 'partial'` is included too, because Sass resolves it against the
 * file's own directory first.
 *
 * Matched, case-insensitively: a quoted URL with or without whitespace after
 * the keyword (`@use '../x'`, `@use"../x"`), an unquoted one after whitespace,
 * and `url(…)` with or without quotes (`@import url('../x.css')`,
 * `@import url(../x.css)`). **Not** detected: `meta.load-css('../x')`, or a
 * URL built by interpolation. Like {@link collectImportSpecifiers} it is a
 * regex, so a false positive (a rule in a comment) only withholds a button,
 * while a form it does not match gets one whose project fails to build.
 *
 * @param sources The example's resolved sources, keyed by file name.
 */
function collectStylesheetLoads(
  sources: ReadonlyMap<string, string>,
): string[] {
  const found = new Set<string>();
  for (const name of ['index.scss', 'index.css']) {
    const source = sources.get(name) ?? '';
    for (const match of source.matchAll(
      /@(?:use|forward|import)(?:\s*url\(\s*['"]?|\s*['"]|\s+)([^'")\s;,]+)/gi,
    )) {
      if (!match[1].startsWith('sass:')) found.add(match[1]);
    }
  }
  return [...found];
}

/**
 * The DefinitelyTyped package that carries a package's types:
 * `sortablejs` → `@types/sortablejs`, `@scope/name` → `@types/scope__name`.
 *
 * Declared only when the version table knows it (see
 * `EXTRA_PLAYGROUND_PACKAGES` in `apps/docs/tools/playground-manifest.ts`),
 * because the generated tsconfig is `strict`: an import of a package that ships
 * no types fails `ng build` with TS7016 — `scheduler/examples/6` importing
 * `sortablejs` did (#594).
 *
 * @param name An npm package name.
 */
function typingsPackageOf(name: string): string {
  return `@types/${name.startsWith('@') ? name.slice(1).replace('/', '__') : name}`;
}

/**
 * Renders `package.json` for the generated project.
 *
 * @param dependencies The resolved runtime dependency closure.
 * @param versions The generated version table, for the dev dependencies.
 * @param typings `@types/*` packages the example's imports need.
 */
function renderPackageJson(
  dependencies: Record<string, string>,
  versions: PlaygroundVersions,
  typings: readonly string[],
): string {
  const devDependencies: Record<string, string> = {};
  for (const name of [...DEV_DEPENDENCIES, ...typings].sort()) {
    devDependencies[name] = versions[name];
  }

  return `${JSON.stringify(
    {
      name: PROJECT_NAME,
      version: '0.0.0',
      private: true,
      scripts: { start: 'ng serve', build: 'ng build' },
      dependencies,
      devDependencies,
    },
    null,
    2,
  )}\n`;
}

/**
 * Renders `angular.json`.
 *
 * No `polyfills` entry: the library is zoneless-only, and a generated project
 * that pulled in `zone.js` would teach every evaluator who copies it the
 * opposite of how Malva UI is meant to be bootstrapped.
 */
function renderAngularJson(): string {
  return `${JSON.stringify(
    {
      $schema: './node_modules/@angular/cli/lib/config/schema.json',
      version: 1,
      projects: {
        [PROJECT_NAME]: {
          projectType: 'application',
          root: '',
          sourceRoot: 'src',
          architect: {
            build: {
              builder: '@angular/build:application',
              options: {
                browser: 'src/main.ts',
                index: 'src/index.html',
                tsConfig: 'tsconfig.json',
                styles: [GLOBAL_STYLESHEET, 'src/styles.css'],
              },
            },
            serve: {
              builder: '@angular/build:dev-server',
              options: { buildTarget: `${PROJECT_NAME}:build` },
            },
          },
        },
      },
    },
    null,
    2,
  )}\n`;
}

/**
 * Renders `tsconfig.json`.
 *
 * Mirrors `apps/docs/tsconfig.json` — including
 * `noPropertyAccessFromIndexSignature` — because that is the compiler every
 * example is already known to pass under. A laxer config would compile; a
 * stricter one could reject source the docs page shows as valid.
 */
function renderTsConfig(): string {
  return `${JSON.stringify(
    {
      compileOnSave: false,
      compilerOptions: {
        strict: true,
        noImplicitOverride: true,
        noPropertyAccessFromIndexSignature: true,
        noImplicitReturns: true,
        noFallthroughCasesInSwitch: true,
        skipLibCheck: true,
        isolatedModules: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: false,
        importHelpers: true,
        target: 'es2022',
        module: 'preserve',
        moduleResolution: 'bundler',
        lib: ['es2022', 'dom'],
      },
      include: ['src/**/*.ts'],
      angularCompilerOptions: {
        enableI18nLegacyMessageIdFormat: false,
        strictInjectionParameters: true,
        strictInputAccessModifiers: true,
        strictTemplates: true,
      },
    },
    null,
    2,
  )}\n`;
}

/**
 * Renders `src/index.html`, mounting the example through its own selector.
 *
 * @param selector The example component's element selector.
 * @param title Document title.
 */
function renderIndexHtml(selector: string, title: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <${selector}></${selector}>
  </body>
</html>
`;
}

/**
 * Renders `src/main.ts`.
 *
 * The example keeps its own file names, so it is imported as the default export
 * of `./example/index` and its class name never has to be parsed out.
 *
 * @param imported Package roots the example imports.
 * @param specifiers Full module specifiers the example imports.
 */
function renderMain(
  imported: readonly string[],
  specifiers: readonly string[],
): string {
  // Keyed by module specifier, and emitted in that key's order, so the file
  // reads `@angular/*` before `@malva-ui/*` the way the docs app's own sources
  // do. Sorting the statements themselves would order them by exported symbol.
  const imports = new Map<string, string>([
    [
      '@angular/core',
      "import { provideZonelessChangeDetection } from '@angular/core';",
    ],
    [
      '@angular/platform-browser',
      "import { bootstrapApplication } from '@angular/platform-browser';",
    ],
    [
      '@malva-ui/cdk/density',
      "import { provideMlvDensity } from '@malva-ui/cdk/density';",
    ],
    [
      '@malva-ui/cdk/theme',
      "import { provideDefaultTheme } from '@malva-ui/cdk/theme';",
    ],
    ['@malva-ui/i18n', "import { provideMlvI18n } from '@malva-ui/i18n';"],
  ]);
  const providers = [
    'provideZonelessChangeDetection()',
    // The pair `ng add` writes into a consumer's application config.
    "provideDefaultTheme('light', 'mlv-theme')",
    "provideMlvDensity('comfortable')",
    // The named export, not the default. `libs/i18n/en/src/index.ts` exports
    // both, but ng-packagr drops `export default` from the published bundle —
    // the `.d.ts` and the `.mjs` of every locale pack expose only
    // `<lang>Language`. So `provideMlvI18n(() => import('@malva-ui/i18n/en'))`,
    // which is what `libs/i18n/README.md` documents and what `apps/docs` runs
    // against the tsconfig path mapping, used to fail to compile AND to run for
    // a real consumer of the published package.
    //
    // Fixed in #227: `provideMlvI18n()` now accepts the named shape too. This
    // wrapper stays until a release carrying that fix is published, because a
    // StackBlitz project installs @malva-ui/i18n from npm — delete it (and this
    // comment) once the published package has the widened loader.
    "provideMlvI18n(() =>\n      import('@malva-ui/i18n/en').then((pack) => ({\n        default: pack.enLanguage,\n      })),\n    )",
  ];

  if (imported.includes('@angular/router')) {
    imports.set(
      '@angular/router',
      "import { provideRouter } from '@angular/router';",
    );
    providers.push('provideRouter([])');
  }
  if (specifiers.includes('@angular/common/http')) {
    imports.set(
      '@angular/common/http',
      "import { provideHttpClient } from '@angular/common/http';",
    );
    providers.push('provideHttpClient()');
  }

  const sorted = [...imports.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, statement]) => statement);

  return `${sorted.join('\n')}

import Example from './example/index';

bootstrapApplication(Example, {
  providers: [
${providers.map((provider) => `    ${provider},`).join('\n')}
  ],
}).catch((error) => console.error(error));
`;
}

/**
 * Renders `src/styles.css` — the page surface only.
 *
 * Every colour comes from a `--mlv-*` token declared by the published
 * stylesheet, so the page follows the theme `provideDefaultTheme` selects.
 */
function renderStyles(): string {
  return `body {
  margin: 0;
  padding: var(--mlv-padding-l);
  font-family: var(--mlv-typography-family-text);
  background: var(--mlv-background-base);
  color: var(--mlv-text-primary);
}
`;
}

/**
 * Renders the project README shown beside the editor.
 *
 * @param title The example's title.
 */
function renderReadme(title: string): string {
  return `# ${title}

A runnable copy of an example from the [Malva UI](https://www.npmjs.com/package/@malva-ui/core)
documentation. The example's own sources are under \`src/example/\`, byte for
byte as the docs page shows them.

Everything else is the standard install: the three packages \`ng add @malva-ui/core\`
adds, the published stylesheet at \`node_modules/@malva-ui/core/styles/malva-ui.css\`,
and \`provideDefaultTheme\` / \`provideMlvDensity\` in \`src/main.ts\`.

Malva UI is zoneless-only, so this project has no \`zone.js\` polyfill and
bootstraps with \`provideZonelessChangeDetection()\`.
`;
}

/**
 * Escapes text for interpolation into HTML character data.
 *
 * @param value Raw text.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
