# `@malva-ui/core/layout` is deleted

**Breaking.** The secondary entry point `@malva-ui/core/layout` no longer
exists. It resolved to nothing but a re-export, so the fix is an import-path
edit and never a code change:

```diff
-import { MlvThemeService, provideDefaultTheme } from '@malva-ui/core/layout';
+import { MlvThemeService, provideDefaultTheme } from '@malva-ui/cdk/theme';
```

Every identity — `MlvThemeService`, `provideDefaultTheme`, `MLV_THEME`,
`MLV_THEME_KEY`, `MlvTheme`, `MlvThemeMode`, `defaultTheme`, `defaultThemeKey` —
keeps its name, its type and its object identity. Nothing is renamed, retyped or
reconfigured, and the persisted `mlv-theme` storage key and its encoding are
unchanged, so a consumer that moves the import keeps every user's saved choice.

Imports of the **root** barrel need no change at all: `@malva-ui/core` still
re-exports the theme contract, now through `@malva-ui/cdk/theme` directly.

## What was there

`mlv-layout` — the component the entry point was named for — was deleted by the
`mlv-page` rebuild
([2026-09-page-rebuild.md](2026-09-page-rebuild.md)); `mlv-page-shell` replaces
it. What survived was a one-line shim (`export * from '@malva-ui/cdk/theme';`)
plus its `@deprecated` tag, so that applications importing the theme service
from the old path kept compiling while they moved.

The theme service is in the CDK family for the same reason `@malva-ui/core/date`
is: it is a headless contract with no component. Nothing in it ever referenced
the layout, it already wrote on the document element precisely so that a route
rendering no layout still themes correctly, and it is bootstrap API written by a
schematic — `ng add @malva-ui/core` has emitted `@malva-ui/cdk/theme` since the
carve-out (`libs/core/schematics/ng-add/index.cjs`), so a freshly installed
application was never taught the old path.

## Why now, when the tag said 1.0

The shim's tag read `@deprecated since 0.2.0 — removed in 1.0`, and the
workspace is on `0.1.15`. This removal is therefore **breaking**, and a breaking
commit is the one thing `nx release` bumps to a major from a `0.x` line: the
release that carries it is `1.0.0`, which is the boundary the tag named. The
deprecation window is shorter in wall-clock time than a full minor cycle, which
is the honest cost of removing it here rather than later; it is bounded by the
fact that the shim never had a body, so no behaviour goes with it.

## Also gone

- The `/layout` documentation route. It had been rewritten as a signpost
  pointing at `mlv-page-shell` and `@malva-ui/cdk/theme`, and a signpost to an
  entry point that no longer resolves is worse than no page: `/page` documents
  the replacement and `/theming` documents the theme service.
- The `core-layout` Nx project, its `libs/core/layout/**` sources, its
  `tsconfig.base.json` path mapping, its `layout` commit scope, and the
  `@malva-ui/core/layout` line in the root barrel. Because `ng-packagr` builds a
  secondary entry point from its own `ng-package.json`, deleting the directory
  is what removes the entry point from the published package — there is no
  `exports` map to edit.

## Checklist

| If your code…                            | Do                                                                            |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| imports from `@malva-ui/core/layout`     | Retarget to `@malva-ui/cdk/theme`                                             |
| imports from `@malva-ui/core`            | Nothing                                                                       |
| was installed by `ng add @malva-ui/core` | Nothing — the schematic already writes the new path                           |
| still renders `<mlv-layout>`             | See [2026-09-page-rebuild.md](2026-09-page-rebuild.md) — use `mlv-page-shell` |
