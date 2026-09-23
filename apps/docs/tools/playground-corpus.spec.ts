/**
 * The always-on, offline half of the playground's CI cover.
 *
 * It runs the real project builder over every docs example's real source and
 * asserts the payload each one produces. What that proves and — just as
 * importantly — what it does not:
 *
 * | Proven here                                              | Not proven here                        |
 * | -------------------------------------------------------- | -------------------------------------- |
 * | Every example either builds a project or is a known, named exception | that the project compiles      |
 * | Every package an example imports is declared with a version | that the version exists on npm      |
 * | The version table is derived from the root manifest, not copied | that npm can resolve the tree    |
 *
 * The two right-hand columns need a network and a real `npm install`; that is
 * `.github/workflows/playground.yml`, which is scheduled rather than per-PR.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';
import {
  createPlaygroundProject,
  packageRootOf,
  collectImportSpecifiers,
  UNPUBLISHED_PACKAGES,
  UNPUBLISHED_VERIFIED_AT,
} from '../src/app/shared/playground/playground-project';
import {
  PLAYGROUND_PEERS,
  PLAYGROUND_VERSIONS,
} from '../src/generated/playground-versions';
import { pagesDirOf, readCorpus } from './playground-corpus';
import type { CorpusExample } from './playground-corpus';
import { buildPlaygroundManifest, resolveVersion } from './playground-manifest';

/**
 * Resolved from this spec's own location, not `process.cwd()`: the `test` target
 * runs with the workspace root as its cwd while the inferred `vite:test` runs
 * from the project root, so a cwd-relative path is right in only one of them.
 */
const toolsDir = dirnameOfThisFile();
const repoRoot = path.resolve(toolsDir, '..', '..', '..');

/**
 * The docs examples that cannot be lifted into a standalone project.
 *
 * All five import code that is not published, in two shapes:
 *
 * - Reaching *outside* their own directory — `checkbox/1` projects the shared
 *   `DocsInspectorComponent`; `autocomplete/4` and `combobox/10` both reuse
 *   `select/examples/8`'s fake remote data source. Nothing short of publishing
 *   docs-app internals would make these portable.
 * - Reaching a *sibling* file in their own directory — `select/8` imports
 *   `./remote-users.data-source`, `tile/5` imports `./tile-tree-node`. These
 *   could be carried if their text were available, but the `docsExample` pipe
 *   resolves only `index.ts` / `index.html` / `index.scss`, and widening its
 *   template-literal dynamic import would make esbuild inline every file under
 *   `pages/` as text — well past the docs bundle's 3mb initial budget. Carrying
 *   them needs a generated per-example sibling manifest, which is out of scope
 *   for #25.
 *
 * The list is asserted to be exact, so a sixth non-portable example does not
 * silently lose its button — it fails this spec until someone decides.
 */
const NON_PORTABLE: readonly string[] = [
  'autocomplete/examples/4',
  'checkbox/examples/1',
  'combobox/examples/10',
  'select/examples/8',
  'tile/examples/5',
];

/**
 * The docs examples blocked because they import a package that is in the
 * release set but has never reached npm — see `UNPUBLISHED_PACKAGES`.
 *
 * Enumerated rather than derived from that constant so the *blast radius* is
 * visible: sixteen examples, two whole pages, lose their button. When the two
 * packages ship, this list and the constant are deleted together.
 */
const UNPUBLISHED_EXAMPLES: readonly string[] = [
  'scheduler/examples/1',
  'scheduler/examples/2',
  'scheduler/examples/3',
  'scheduler/examples/4',
  'scheduler/examples/5',
  'scheduler/examples/6',
  'scheduler/examples/7',
  'scheduler/examples/8',
  'taskboard/examples/1',
  'taskboard/examples/2',
  'taskboard/examples/3',
  'taskboard/examples/4',
  'taskboard/examples/5',
  'taskboard/examples/6',
  'taskboard/examples/7',
  'taskboard/examples/8',
];

/** Absolute path of the directory holding this spec file. */
function dirnameOfThisFile(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}

/**
 * The `selector` of the `@Component` on the class an example default-exports,
 * read with the real TypeScript parser.
 *
 * An *independent* oracle, and that is the whole point: re-deriving the tag with
 * the same regex the builder uses would assert only that the builder agrees with
 * itself. The previous check — "the tag appears somewhere in the source as
 * `selector: '…'`" — was satisfied by a *helper* component's selector, so
 * swapping the builder's `lastIndexOf` for `indexOf` left it green while every
 * multi-component example mounted the wrong thing.
 *
 * Node-only, so `typescript` never reaches the docs bundle; the builder itself
 * stays a regex over masked source.
 *
 * @param source TypeScript source text of the example.
 */
function declaredBootstrapSelector(source: string): string | null {
  const file = ts.createSourceFile(
    'example.ts',
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ false,
  );

  for (const statement of file.statements) {
    if (!ts.isClassDeclaration(statement)) continue;

    const modifiers = statement.modifiers ?? [];
    const exportedByDefault =
      modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) &&
      modifiers.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
    if (!exportedByDefault) continue;

    for (const decorator of ts.getDecorators(statement) ?? []) {
      const call = decorator.expression;
      if (
        !ts.isCallExpression(call) ||
        !ts.isIdentifier(call.expression) ||
        call.expression.text !== 'Component'
      ) {
        continue;
      }

      const [argument] = call.arguments;
      if (!argument || !ts.isObjectLiteralExpression(argument)) continue;

      for (const property of argument.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const name = property.name;
        if (
          !(ts.isIdentifier(name) || ts.isStringLiteral(name)) ||
          name.text !== 'selector'
        ) {
          continue;
        }
        if (ts.isStringLiteralLike(property.initializer)) {
          return property.initializer.text;
        }
      }
    }
  }

  return null;
}

/** Builds the project payload for one corpus example. */
const build = (example: CorpusExample) =>
  createPlaygroundProject({
    files: example.files,
    versions: PLAYGROUND_VERSIONS,
    peers: PLAYGROUND_PEERS,
    title: `Malva UI — ${example.id}`,
    description: 'A Malva UI documentation example.',
  });

const corpus = readCorpus(pagesDirOf(toolsDir));

/** Every example paired with the payload the builder produces for it. */
const built = corpus.map((example) => ({
  example,
  result: build(example),
}));

/** Only the examples that produced a project, with its files. */
const portable = built.flatMap(({ example, result }) =>
  result.project ? [{ example, project: result.project }] : [],
);

describe('the docs example corpus', () => {
  it('is actually there', () => {
    // Every assertion below is vacuously green over an empty walk, so the walk
    // is asserted first. The floor is deliberately far under the real count so
    // it does not have to move whenever an example is added.
    expect(corpus.length).toBeGreaterThan(400);
    expect(portable.length).toBe(
      corpus.length - NON_PORTABLE.length - UNPUBLISHED_EXAMPLES.length,
    );
  });

  it('builds a playground project for every example but the known exceptions', () => {
    const blocked = built.filter(({ result }) => result.project === null);

    expect(blocked.map(({ example }) => example.id).sort()).toEqual(
      [...NON_PORTABLE, ...UNPUBLISHED_EXAMPLES].sort(),
    );

    // Not just "some reason": each one is blocked by the thing its list exists
    // for, rather than by a selector or version regression that happens to land
    // on the same example.
    for (const { example, result } of blocked) {
      const reason = NON_PORTABLE.includes(example.id)
        ? 'docs-local code'
        : 'never been published';
      expect(`${example.id}: ${result.blockedBy}`).toContain(reason);
    }
  });

  it('declares a version for every package an example imports', () => {
    for (const { example, project } of portable) {
      const declared = new Set(
        Object.keys(
          (
            JSON.parse(project.files['package.json']) as {
              dependencies: Record<string, string>;
            }
          ).dependencies,
        ),
      );

      for (const specifier of collectImportSpecifiers(example.source)) {
        const name = packageRootOf(specifier);
        expect(`${example.id} needs ${name}: ${declared.has(name)}`).toBe(
          `${example.id} needs ${name}: true`,
        );
      }
    }
  });

  // #242. `@malva-ui/core` imports `@angular/router` in nine entry points and
  // declared no peer on it, so the closure never carried it and the generated
  // project installed a `@malva-ui/core` whose `mlv-breadcrumb` could not
  // resolve `RouterLink`. The test above cannot see this: it walks only what
  // the *example* imports, and a router-free example is exactly the case that
  // was broken. Pinned to a real example so it tracks the corpus rather than a
  // fixture, and the premise — that the example imports no router itself — is
  // asserted, so the regression cannot pass by the example gaining an import.
  it('carries a peer the example never imports but the entry point does', () => {
    const entry = portable.find(
      ({ example }) => example.id === 'breadcrumb/examples/1',
    );

    expect(`breadcrumb/examples/1 is portable: ${entry !== undefined}`).toBe(
      'breadcrumb/examples/1 is portable: true',
    );

    const imported = collectImportSpecifiers(entry!.example.source).map(
      packageRootOf,
    );
    expect(imported).toContain('@malva-ui/core');
    expect(imported).not.toContain('@angular/router');

    const { dependencies } = JSON.parse(
      entry!.project.files['package.json'],
    ) as { dependencies: Record<string, string> };

    expect(Object.keys(dependencies)).toContain('@angular/router');
    expect(dependencies['@angular/router']).toBe(
      PLAYGROUND_VERSIONS['@angular/router'],
    );
  });

  it('mounts the selector the exported component really declares', () => {
    for (const { example, project } of portable) {
      const tag = /<([a-z][a-z0-9-]*)><\/\1>/.exec(
        project.files['src/index.html'],
      )?.[1];

      // Both sides carry the id so a failure names the example rather than
      // printing two bare tag names.
      expect(`${example.id}: ${tag}`).toBe(
        `${example.id}: ${declaredBootstrapSelector(example.source)}`,
      );
    }
  });

  it('creates every template and stylesheet an example declares by URL', () => {
    for (const { example, project } of portable) {
      for (const match of example.source.matchAll(
        /['"]\.\/(index\.[a-z]+)['"]/g,
      )) {
        const path = `src/example/${match[1]}`;
        expect(`${example.id} -> ${path}: ${path in project.files}`).toBe(
          `${example.id} -> ${path}: true`,
        );
      }
    }
  });

  it('carries every example source file into the project verbatim', () => {
    for (const { example, project } of portable) {
      for (const file of example.files) {
        const name = { TypeScript: 'ts', HTML: 'html', SCSS: 'scss' }[
          file.type
        ] as string;
        const path = `src/example/index.${name}`;

        // Compared as a boolean, not with `toBe(file.content)`: a mismatch on a
        // 200-line example would otherwise pretty-print both copies for each of
        // the ~600 files this walks.
        expect(
          `${example.id} -> ${path}: ${project.files[path] === file.content}`,
        ).toBe(`${example.id} -> ${path}: true`);
      }
    }
  });
});

/** Published project names, as `nx.json` lists them. */
const releaseProjects = (
  JSON.parse(fs.readFileSync(path.join(repoRoot, 'nx.json'), 'utf8')) as {
    release: { projects: string[] };
  }
).release.projects;

/** The workspace root manifest's own version. */
const rootVersion = (
  JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
    version: string;
  }
).version;

describe('the packages npm has not seen yet', () => {
  it('names real published projects, not typos that would exclude nothing', () => {
    const published = releaseProjects.map(
      (project) =>
        (
          JSON.parse(
            fs.readFileSync(
              path.join(repoRoot, 'libs', project, 'package.json'),
              'utf8',
            ),
          ) as { name: string }
        ).name,
    );

    for (const name of UNPUBLISHED_PACKAGES) {
      expect(`${name}: ${published.includes(name)}`).toBe(`${name}: true`);
    }
  });

  it('was last checked against npm at the version still in the root manifest', () => {
    // The offline half of the pin. Publication status can only change at a
    // release, and `scripts/publish.mjs` already ships `@malva-ui/scheduler`, so
    // the first release after this lands makes the list wrong — and this line
    // red. The fix is to re-check `npm view` and delete whatever now resolves,
    // never to bump the constant without looking.
    //
    // The online half is in `.github/workflows/playground.yml`, which fails if
    // `npm view` resolves any name in `UNPUBLISHED_PACKAGES`.
    expect(
      `UNPUBLISHED_PACKAGES verified at ${UNPUBLISHED_VERIFIED_AT}, root manifest is ${rootVersion}`,
    ).toBe(
      `UNPUBLISHED_PACKAGES verified at ${rootVersion}, root manifest is ${rootVersion}`,
    );
  });
});

describe('the generated version table', () => {
  it('is a fresh derivation of the workspace root manifest, not a copy', () => {
    // If this fails, `docs:generate-playground-versions` did not run before the
    // suite — the generated module is a stale artefact and the playground would
    // ship whatever version it was last built with.
    const fresh = buildPlaygroundManifest(repoRoot, releaseProjects);

    expect(fresh.versions).toEqual(PLAYGROUND_VERSIONS);
    expect(fresh.peers).toEqual(PLAYGROUND_PEERS);
  });

  it('pins every Malva package at the root manifest version', () => {
    for (const project of releaseProjects) {
      const name = (
        JSON.parse(
          fs.readFileSync(
            path.join(repoRoot, 'libs', project, 'package.json'),
            'utf8',
          ),
        ) as { name: string }
      ).name;

      expect(`${name}: ${PLAYGROUND_VERSIONS[name]}`).toBe(
        `${name}: ${rootVersion}`,
      );
    }
  });

  it('knows a version for every peer of every published package', () => {
    for (const [name, peers] of Object.entries(PLAYGROUND_PEERS)) {
      for (const peer of peers) {
        expect(`${name} peer ${peer}: ${peer in PLAYGROUND_VERSIONS}`).toBe(
          `${name} peer ${peer}: true`,
        );
      }
    }
  });

  it('carries the editor Tiptap peers the published manifest declares', () => {
    // The one package whose peers are neither Angular nor Malva, so the one
    // whose closure a hand-written companion list would have got wrong.
    const declared = Object.keys(
      (
        JSON.parse(
          fs.readFileSync(
            path.join(repoRoot, 'libs', 'editor', 'package.json'),
            'utf8',
          ),
        ) as { peerDependencies: Record<string, string> }
      ).peerDependencies,
    ).filter((name) => name.startsWith('@tiptap/'));

    expect(declared.length).toBeGreaterThan(0);
    for (const name of declared) {
      expect(PLAYGROUND_PEERS['@malva-ui/editor']).toContain(name);
    }
  });

  it('installs the editor ProseMirror floor peers at their declared ranges', () => {
    // #291: hand-written ranges with no placeholder and no root pin, so the
    // playground installs exactly the floor the published manifest carries.
    const declared = (
      JSON.parse(
        fs.readFileSync(
          path.join(repoRoot, 'libs', 'editor', 'package.json'),
          'utf8',
        ),
      ) as { peerDependencies: Record<string, string> }
    ).peerDependencies;

    for (const name of ['prosemirror-model', 'prosemirror-view']) {
      expect(PLAYGROUND_PEERS['@malva-ui/editor']).toContain(name);
      expect(`${name}: ${PLAYGROUND_VERSIONS[name]}`).toBe(
        `${name}: ${declared[name]}`,
      );
    }
  });
});

describe('resolveVersion', () => {
  it('refuses to emit an unsubstituted publish placeholder', () => {
    // Latent, not live: the nine mapped placeholders match `scripts/publish.mjs`
    // exactly today. A tenth added there and not to `PLACEHOLDER_DEPENDENCY`
    // would otherwise reach the generated `package.json` verbatim and fail
    // `npm install` with "No matching version found" — in a WebContainer, where
    // the visitor sees an install log and no explanation.
    expect(() =>
      resolveVersion('@example/new-peer', '0.0.0-brand-new-package-version', {
        version: '9.9.9',
        dependencies: {},
      }),
    ).toThrowError(/0\.0\.0-brand-new-package-version/);
  });

  it('still resolves a mapped placeholder through the root manifest', () => {
    expect(
      resolveVersion('@angular/core', '0.0.0-angular-core-package-version', {
        version: '9.9.9',
        dependencies: { '@angular/core': '22.1.0' },
      }),
    ).toBe('22.1.0');
  });
});
