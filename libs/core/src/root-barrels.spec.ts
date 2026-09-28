import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The family ROOT barrels are what this spec is about, so it imports them on
// purpose — library sources import the narrow entry point instead
// (best-practices.md § Project boundaries). `./index` is the `@malva-ui/core`
// root: `tsconfig.base.json` maps the specifier to this file and
// `libs/core/ng-package.json` builds the package from it. The alias itself
// is not used because a project importing its own alias trips
// `@nx/enforce-module-boundaries`.
import * as cdkRoot from '@malva-ui/cdk';
import type {
  MlvTheme as CdkRootMlvTheme,
  MlvThemeMode as CdkRootMlvThemeMode,
} from '@malva-ui/cdk';
import * as themeEntry from '@malva-ui/cdk/theme';
import type { MlvTheme, MlvThemeMode } from '@malva-ui/cdk/theme';
import * as coreRoot from './index';
import type {
  MlvTheme as CoreRootMlvTheme,
  MlvThemeMode as CoreRootMlvThemeMode,
} from './index';

/**
 * Compile-time equality. `core:typecheck` compiles `tsconfig.lib.json` only;
 * `tsconfig.spec.json` is not wired yet (2 pre-existing errors in
 * `ssr-smoke.spec.ts`, see #196; pattern in `libs/scheduler/project.json`),
 * so the tuple below guards an editor or a manual
 * `tsc -p libs/core/tsconfig.spec.json`; the runtime identity checks
 * further down are what `core:test` enforces. The two type-only exports ride
 * the same `export *` line as the runtime ones, and an ambiguous star-export
 * fails `core:build` with TS2308, so the runtime checks cannot pass while a
 * type is missing.
 */
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

const _themeTypesReachRootBarrels: [
  Equal<CoreRootMlvTheme, MlvTheme>,
  Equal<CoreRootMlvThemeMode, MlvThemeMode>,
  Equal<CdkRootMlvTheme, MlvTheme>,
  Equal<CdkRootMlvThemeMode, MlvThemeMode>,
] = [true, true, true, true];

/**
 * The theme contract `docs/migrations/2026-09-layout-removal.md` promises is
 * still importable from the `@malva-ui/core` root barrel (#372). Only the
 * runtime values are listed; `MlvTheme` / `MlvThemeMode` are checked above.
 */
const DOCUMENTED_THEME_VALUES = [
  'MlvThemeService',
  'provideDefaultTheme',
  'isMlvThemeMode',
  'MLV_THEME',
  'MLV_THEME_KEY',
  'defaultTheme',
  'defaultThemeKey',
] as const;

/**
 * Names the theme entry point exports that `barrel` does not re-export as the
 * very same object. Identity, not presence: `MlvThemeService` is its own DI
 * token, so a second copy of the class would be a second root service.
 * Returns strings, so a failure prints names rather than the classes.
 */
const themeExportsMissingFrom = (barrel: object): string[] =>
  Object.entries(themeEntry)
    .filter(([name, value]) => Reflect.get(barrel, name) !== value)
    .map(([name]) => name);

describe('root barrels — theme contract (#372)', () => {
  it('lists every documented runtime symbol in @malva-ui/cdk/theme', () => {
    expect(
      DOCUMENTED_THEME_VALUES.filter((name) => !(name in themeEntry)),
    ).toEqual([]);
  });

  it('re-exports every theme symbol from @malva-ui/core by identity', () => {
    expect(themeExportsMissingFrom(coreRoot)).toEqual([]);
  });

  it('re-exports every theme symbol from @malva-ui/cdk by identity', () => {
    expect(themeExportsMissingFrom(cdkRoot)).toEqual([]);
  });
});

/** `libs/`, resolved from this file: `core:test` runs from the workspace root. */
const LIBS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Every published secondary entry point of a family: a direct child directory
 * of `libs/<family>` carrying its own `ng-package.json`, which is what makes
 * ng-packagr build it. `libs/cdk/testing-e2e` has none and is not published;
 * nested entry points (`@malva-ui/core/form-utils/testing`) are deliberately
 * out of reach of a root barrel.
 */
const publishedEntryPoints = (family: 'cdk' | 'core'): string[] =>
  readdirSync(join(LIBS_ROOT, family), { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        existsSync(join(LIBS_ROOT, family, entry.name, 'ng-package.json')),
    )
    .map((entry) => `@malva-ui/${family}/${entry.name}`)
    .sort();

/** The specifiers a family root barrel star-exports. */
const rootStarExports = (family: 'cdk' | 'core'): Set<string> =>
  new Set(
    [
      ...readFileSync(join(LIBS_ROOT, family, 'src/index.ts'), 'utf8').matchAll(
        /^export \* from '([^']+)';$/gm,
      ),
    ].map(([, specifier]) => specifier),
  );

describe('root barrels — entry-point coverage', () => {
  // `@malva-ui/cdk/theme` was carved out of `@malva-ui/core/layout` and never
  // added to the cdk root; this sweep is the check that would have caught it.
  it.each(['cdk', 'core'] as const)(
    '@malva-ui/%s star-exports every published secondary entry point',
    (family) => {
      const exported = rootStarExports(family);
      const entryPoints = publishedEntryPoints(family);

      expect(entryPoints.length).toBeGreaterThan(0);
      expect(entryPoints.filter((entry) => !exported.has(entry))).toEqual([]);
    },
  );
});
