/**
 * Malva UI — published-package consumer gate (#227)
 *
 * Every in-repo consumer of `@malva-ui/i18n/<locale>` resolves through the
 * `tsconfig.base.json` path mapping to **source**, where each locale entry
 * point carries `export default`. The published package does not: ng-packagr
 * flattens each entry point to a single named export (`enLanguage`,
 * `zhHansLanguage`, …) and emits no `export default` at all. So the call the
 * README documents —
 *
 *     provideMlvI18n(() => import('@malva-ui/i18n/en'))
 *
 * — compiled and ran everywhere in this workspace while failing to compile for
 * anyone who installed the package. Nothing caught it, because no target ever
 * type-checked a consumer-shaped import against `dist/`.
 *
 * This is that target. It is modelled on `libs/core/tests/schematics` — the
 * workspace's existing "assert against the generated artifact, not the source
 * tree" harness — and follows its convention of writing the fixture inline
 * rather than checking a second source tree into the library.
 *
 * ## What it does and does not cover
 *
 * The locale set is **derived from the built package**, never listed here:
 * `dist/libs/i18n/package.json`'s `exports` map names every entry point
 * ng-packagr auto-discovered from a per-directory `ng-package.json`, and each
 * entry point's own `.d.ts` names the export it emits. A fifteenth locale
 * therefore enters this gate the moment it builds, with nothing edited here —
 * which is what makes the claim "a locale with no `MlvLanguageExportName` entry
 * fails this gate" true. An earlier revision hardcoded the fourteen, so the
 * gate's scope was its own list and that claim was false: deleting a row made
 * the suite pass with one test fewer.
 *
 * Both directions are asserted. A locale in `dist/` with no name in the union
 * fails twice over — `tsc` rejects the generated `provideMlvI18n()` call for
 * it, and the derived-vs-declared comparison reports it — and a name in the
 * union that no longer matches a published locale fails that comparison too.
 *
 * Still hand-maintained, and deliberately: the fourteen entries of `packs` in
 * `locale-contract.spec.ts`, and `DOCS_LOCALE_CODES` in `apps/docs`. Both are
 * cross-checked in their own specs against the locale directories on disk —
 * the same set one build step earlier — because deriving them from `dist/`
 * would make a content-parity suite and an app spec depend on this library's
 * build output.
 *
 * ## Why the temp project resolves the way it does
 *
 * The fixture is written under `<workspaceRoot>/tmp/` with its own
 * `node_modules/@malva-ui/i18n` symlink pointing at `dist/libs/i18n`. That is
 * deliberate on both counts:
 *
 * - The symlink means `@malva-ui/i18n/en` is resolved as a *package* — through
 *   the `exports` map ng-packagr generated — and not through a `paths` entry.
 *   A `paths` mapping would type-check the same `.d.ts` files but would prove
 *   nothing about the export map a real consumer goes through, and the nearest
 *   `node_modules` wins, so it shadows the workspace's own source symlink at
 *   `<workspaceRoot>/node_modules/@malva-ui/i18n`.
 * - Living under the workspace root means `@angular/core` (and anything else
 *   the emitted `.d.ts` files reach for) resolves by walking up into the
 *   workspace `node_modules`, so only the one package under test has to be
 *   wired by hand.
 *
 * ## Cost
 *
 * `i18n:test` declares `dependsOn: ["build"]`, so `dist/libs/i18n` is fresh
 * whenever this runs. The build is ~2s cold and a cache hit otherwise, and CI
 * already runs `build` alongside `test` for every affected project, so the gate
 * adds only the `tsc` spawn (~0.6s) to a CI run.
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { resolveMlvLanguage } from '../src/lib/language-module';

/**
 * `@nx/vitest`-driven runs use the workspace root as cwd while the inferred
 * `vite:test` target uses the project root, so every path is derived from this
 * file rather than from `process.cwd()`.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(HERE, '..', '..', '..');
const DIST = join(WORKSPACE_ROOT, 'dist', 'libs', 'i18n');
const TSC = join(WORKSPACE_ROOT, 'node_modules', 'typescript', 'bin', 'tsc');

/**
 * Wall-clock ceiling on the `tsc` spawn, well under the per-test timeout below
 * so a hung compiler is reported as a timed-out child — with its signal — and
 * not as an anonymous vitest timeout. The real run is ~0.6s.
 */
const TSC_TIMEOUT_MS = 60_000;

/** The type-check test's own timeout, kept above `TSC_TIMEOUT_MS`. */
const TEST_TIMEOUT_MS = 120_000;

/** The lowest locale count that is not evidence of a broken derivation. */
const LOCALE_FLOOR = 14;

/** @throws Error naming the fix when the build has not run. */
function requireDist(): void {
  if (existsSync(DIST)) return;
  throw new Error(
    `dist/libs/i18n is missing — build it first (\`yarn nx run i18n:build\`). ` +
      `The \`test\` target declares \`dependsOn: ["build"]\` so this cannot happen ` +
      `through \`yarn nx run i18n:test\`; the inferred \`vite:test\` target has no such edge.`,
  );
}

/** The generated `exports` map, keyed by subpath (`.`, `./en`, …). */
function readPublishedExports(): Readonly<
  Record<string, { types?: string; default?: string }>
> {
  requireDist();
  const manifest = JSON.parse(
    readFileSync(join(DIST, 'package.json'), 'utf8'),
  ) as { exports?: Record<string, { types?: string; default?: string }> };

  if (!manifest.exports) {
    throw new Error(
      'dist/libs/i18n/package.json declares no `exports` map, so no entry ' +
        'point can be derived from it. Did ng-packagr change its output?',
    );
  }
  return manifest.exports;
}

/**
 * The names under which a `.d.ts` exports a language **pack**, alias-aware:
 * `declare const en: MlvLanguage; export { en as enLanguage }` yields
 * `enLanguage`.
 *
 * Matching on the local declaration rather than on the exported name is what
 * keeps the classification about what a symbol *is*. A name test alone would
 * call the root entry point a locale, because `resolveMlvLanguage` — a function
 * — also ends in `Language`. `export type { … }` never matches either: `\s*`
 * cannot cross the `type` keyword, and a type is not a pack.
 */
function publishedLanguageExports(declaration: string): readonly string[] {
  const names: string[] = [];
  for (const block of declaration.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const clause of block[1].split(',')) {
      const [local, alias] = clause.trim().split(/\s+as\s+/);
      if (!local || !/^[A-Za-z_$][\w$]*$/.test(local)) continue;

      const declaresAPack = new RegExp(
        String.raw`\bdeclare\s+const\s+${local.replace(/\$/g, '\\$')}\s*:\s*MlvLanguage\s*;`,
      );
      if (declaresAPack.test(declaration)) names.push((alias ?? local).trim());
    }
  }
  return names;
}

/**
 * Every published entry point, classified by whether its `.d.ts` exports a
 * `MlvLanguage`-typed constant.
 *
 * A locale is *defined* as an entry point that exports exactly one. That makes
 * the derivation self-describing rather than list-driven, and "exactly" matters
 * twice: it is the premise `resolveMlvLanguage`'s one-language-per-module rule
 * rests on, and an entry point exporting none would otherwise drop out of the
 * derived set unnoticed — which is why the non-locale entry points are asserted
 * below rather than discarded.
 */
function classifyEntryPoints(): {
  locales: readonly (readonly [subpath: string, exportName: string])[];
  others: readonly string[];
} {
  const exportsMap = readPublishedExports();
  const locales: (readonly [string, string])[] = [];
  const others: string[] = [];

  for (const [key, target] of Object.entries(exportsMap)) {
    if (key === './package.json') continue;

    const types = target.types;
    if (!types) {
      throw new Error(
        `The published entry point "${key}" declares no \`types\` condition, ` +
          'so nothing can be read about what it exports.',
      );
    }

    const names = publishedLanguageExports(
      readFileSync(join(DIST, types), 'utf8'),
    );

    if (names.length > 1) {
      throw new Error(
        `The published entry point "${key}" exports ${names.length} languages ` +
          `(${names.join(', ')}). A locale entry point must export exactly ` +
          'one: `resolveMlvLanguage` refuses a module carrying two rather ' +
          'than picking by declaration order.',
      );
    }

    if (names.length === 1) {
      locales.push([key.replace(/^\.\//, ''), names[0]]);
    } else {
      others.push(key);
    }
  }

  return {
    locales: [...locales].sort(([a], [b]) => a.localeCompare(b)),
    others: [...others].sort(),
  };
}

const { locales: LOCALES, others: NON_LOCALE_ENTRY_POINTS } =
  classifyEntryPoints();

/**
 * The members of `MlvLanguageExportName`, read back out of the built root
 * `.d.ts`.
 *
 * The union is not exported (`VERSIONING.md` §2 — a barrel export would version
 * this library against ng-packagr's naming), so it cannot be enumerated through
 * an import and the declaration is parsed instead. It still reaches the emitted
 * `.d.ts` as a referenced type; if a future rollup inlines or renames it, this
 * throws rather than quietly comparing against nothing.
 */
function declaredExportNames(): readonly string[] {
  requireDist();
  const rootTypes = readFileSync(
    join(DIST, 'types', 'malva-ui-i18n.d.ts'),
    'utf8',
  );
  const declaration = /type MlvLanguageExportName\s*=\s*([^;]+);/.exec(
    rootTypes,
  );

  if (!declaration) {
    throw new Error(
      'No `MlvLanguageExportName` declaration in ' +
        'dist/libs/i18n/types/malva-ui-i18n.d.ts. It is declared in ' +
        'src/lib/language-module.ts and reaches the bundle as a referenced ' +
        'type; a rollup that inlines or renames it needs this reader updated, ' +
        'so that the union keeps being compared against the published locales.',
    );
  }

  return [...declaration[1].matchAll(/'([^']+)'/g)]
    .map((match) => match[1])
    .sort();
}

/**
 * The consumer-shaped source under test. Nothing here may import from a
 * relative path or a workspace alias — every specifier is one a published
 * consumer would write.
 */
const CONSUMER_SOURCE = `
import type { EnvironmentProviders } from '@angular/core';
import {
  MlvI18nService,
  provideMlvI18n,
  resolveMlvLanguage,
  type MlvLanguage,
  type MlvLanguageModule,
} from '@malva-ui/i18n';

// The call \`libs/i18n/README.md\` documents, once per published locale.
export const providers: EnvironmentProviders[] = [
${LOCALES.map(([subpath]) => `  provideMlvI18n(() => import('@malva-ui/i18n/${subpath}')),`).join('\n')}
];

// A consumer may name their own loader with the exported type.
const loader: () => Promise<MlvLanguageModule> = () =>
  import('@malva-ui/i18n/en');
export const fromNamedLoader = provideMlvI18n(loader);

// A hand-written pack keeps working through the \`default\` shape.
declare const custom: MlvLanguage;
export const fromDefault = provideMlvI18n(async () => ({ default: custom }));

// Runtime switching takes the same module shape as the initializer.
export function switchTo(service: MlvI18nService): Promise<void> {
  return service.switchLanguage(() => import('@malva-ui/i18n/de'));
}

// The resolver is public, so a consumer can unwrap a pack themselves.
export async function unwrap(): Promise<MlvLanguage> {
  return resolveMlvLanguage(await import('@malva-ui/i18n/fr'));
}

// \`@malva-ui/i18n/testing\` is a real published entry point that carries no
// \`MlvLanguage\` under any name. Accepting it would mean the type accepts
// anything, so the rejection is the assertion.
// @ts-expect-error a module with no language export is not an MlvLanguageModule
export const rejected = provideMlvI18n(() => import('@malva-ui/i18n/testing'));
`;

/** A consumer's `tsconfig.json`: strict, bundler resolution, no workspace paths. */
const CONSUMER_TSCONFIG = JSON.stringify(
  {
    compilerOptions: {
      noEmit: true,
      strict: true,
      target: 'es2022',
      module: 'preserve',
      moduleResolution: 'bundler',
      types: [],
    },
    files: ['consumer.ts'],
  },
  null,
  2,
);

describe('the published @malva-ui/i18n package', () => {
  let projectDir: string;

  beforeAll(() => {
    requireDist();

    const tmpRoot = join(WORKSPACE_ROOT, 'tmp');
    mkdirSync(tmpRoot, { recursive: true });
    projectDir = mkdtempSync(join(tmpRoot, 'i18n-published-package-'));

    const scope = join(projectDir, 'node_modules', '@malva-ui');
    mkdirSync(scope, { recursive: true });
    symlinkSync(DIST, join(scope, 'i18n'), 'dir');

    writeFileSync(join(projectDir, 'consumer.ts'), CONSUMER_SOURCE);
    writeFileSync(join(projectDir, 'tsconfig.json'), CONSUMER_TSCONFIG);
  });

  afterAll(() => {
    if (projectDir) rmSync(projectDir, { recursive: true, force: true });
  });

  it('derives its locale set from the built package, not from a list here', () => {
    // Everything the package publishes that is not a locale. Asserted rather
    // than discarded: a locale whose `.d.ts` stopped emitting a
    // `<locale>Language` name would land here and vanish from the derived set,
    // and this is what notices.
    expect(NON_LOCALE_ENTRY_POINTS).toEqual(['.', './testing']);

    // The floor is the vacuity guard. Every other assertion in this file is
    // over `LOCALES`, so a derivation that silently produced nothing would let
    // the whole suite pass having checked no locale at all.
    expect(LOCALES.length).toBeGreaterThanOrEqual(LOCALE_FLOOR);
  });

  it('teaches MlvLanguageExportName exactly the locales it publishes', () => {
    // Both directions in one comparison: a published locale with no name in the
    // union, and a name in the union that no longer names a published locale.
    expect(declaredExportNames()).toEqual(
      LOCALES.map(([, exportName]) => exportName).sort(),
    );
  });

  it(
    'type-checks the documented provideMlvI18n() call for every locale',
    () => {
      const tsc = spawnSync(process.execPath, [TSC, '--project', projectDir], {
        cwd: projectDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: TSC_TIMEOUT_MS,
      });

      // Asserted as a whole outcome, never as the captured text alone: a child
      // killed by a signal, by an OOM or by the timeout exits with
      // `status: null` and an empty stdout+stderr, so the previous shape —
      // `expect(failed ? output : '').toBe('')` — read a compiler that never
      // ran as a clean type-check. In a gate whose reason to exist is "nothing
      // caught #227 because nothing type-checked against dist", passing when
      // nothing was checked is the one outcome it must not have.
      //
      // Asserted as a whole *object*, never as the error thrown by
      // `execFileSync`, which pretty-prints its entire spawn payload on failure.
      expect({
        status: tsc.status,
        signal: tsc.signal,
        spawnError: tsc.error?.message ?? null,
        output: `${tsc.stdout ?? ''}${tsc.stderr ?? ''}`.trim(),
      }).toEqual({
        status: 0,
        signal: null,
        spawnError: null,
        output: '',
      });
    },
    TEST_TIMEOUT_MS,
  );

  it.each(LOCALES)(
    'publishes %s as a named export with no default',
    (subpath, exportName) => {
      // The premise `MlvLanguageExportName` is written against. Asserting it
      // here means an ng-packagr upgrade that starts (or stops) emitting
      // `export default` is reported as a change in the published contract,
      // rather than silently making half of `MlvLanguageModule` dead weight.
      const types = readFileSync(
        join(DIST, 'types', `malva-ui-i18n-${subpath}.d.ts`),
        'utf8',
      );

      expect(types).toContain(`as ${exportName}`);
      expect(types).not.toMatch(/\bexport default\b/);
    },
  );

  it.each(LOCALES)(
    'resolves the built %s bundle at runtime, not only at the type level',
    async (subpath) => {
      // The type-check above proves the published *shape* is accepted. This
      // proves `resolveMlvLanguage` reads a real ESM namespace of that shape —
      // `Symbol.toStringTag === 'Module'`, no `default` — and not only the
      // object literals `language-module.spec.ts` hands it.
      const bundle = join(DIST, 'fesm2022', `malva-ui-i18n-${subpath}.mjs`);
      const namespace = (await import(
        /* @vite-ignore */ pathToFileURL(bundle).href
      )) as Parameters<typeof resolveMlvLanguage>[0];

      expect(Object.prototype.toString.call(namespace)).toBe('[object Module]');
      expect(resolveMlvLanguage(namespace).dialog.closeDialog).toBeTruthy();
    },
  );
});
