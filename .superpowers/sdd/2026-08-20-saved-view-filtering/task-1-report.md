# Task 1 report — core view-variant entry point

## Generator dry run

Ran exactly:

```sh
yarn nx g @nx/angular:library-secondary-entry-point view-variant --library=core --skipModule --dry-run --no-interactive
```

Nx reported only these changes:

- CREATE `libs/core/view-variant/README.md`
- CREATE `libs/core/view-variant/ng-package.json`
- CREATE `libs/core/view-variant/src/index.ts`
- UPDATE `tsconfig.base.json`
- UPDATE `libs/core/tsconfig.lib.json`

The dry run created no module or route file. The real generator was then run
with the same command without `--dry-run`; it reported the same five paths and
did not install dependencies.

## Added and wired files

- Added the `core-view-variant` Nx leaf project with `scope:ui`, `family:core`,
  and `type:ui` tags plus lint and Vitest targets.
- Added core-leaf TypeScript, Vitest, test setup, and package documentation
  configuration under `libs/core/view-variant`.
- Wired the generated public import path in `tsconfig.base.json`, the core
  package's production TypeScript configuration, and `libs/core/src/index.ts`.
- Added `view-variant` in alphabetical order to commitlint, the root library
  index, and the core package/reference documentation dependency and public
  entry lists.

## Verification

- `yarn nx show project core-view-variant --json` — passed; project root is
  `libs/core/view-variant` and the lint/test targets are present.
- `yarn nx lint core-view-variant` — passed.
- `git diff --check` — passed.
- `yarn nx run docs:check-doc-api` — passed with the repository's existing
  declared-but-undocumented warnings (240 warnings, 0 failures).

The project query emitted existing copied-Vite-pattern deprecation and missing
`tsconfig.app.json` warnings. They do not fail discovery or lint and match the
existing core leaf configuration.

## Self-review

- Generator-owned `README.md`, `ng-package.json`, and `src/index.ts` were
  produced by Nx rather than hand-created.
- The entry point exports from the grouped `@malva-ui/core` package, and no
  route, NgModule, component, or dependency was added.
- The test target is configured but intentionally not run until Task 2 adds a
  real suite.

## Fix Round 1 — remove generated placeholder export

The Nx secondary-entry generator created `export const greeting = 'Hello
World!';`. Because `libs/core/src/index.ts` re-exports the secondary entry
point, that placeholder was unintentionally public from both
`@malva-ui/core/view-variant` and `@malva-ui/core`.

Replaced it with `export {};`, an explicit empty TypeScript module. This keeps
the secondary entry point resolvable without exposing any placeholder API;
Task 2 will replace the empty module with its real public exports.

### Fix Round 1 verification

- Ran `yarn nx show project core-view-variant --json`.
- Ran `yarn nx lint core-view-variant`.
- Ran an `rg` guard across the view-variant and grouped core public barrels;
  it finds no `greeting` export after the change.
- Ran `git diff --check`.

## Concerns

None. The entry point intentionally has no public API until Task 2.
