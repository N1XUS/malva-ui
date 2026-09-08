# `@angular/router` is a required peer of `@malva-ui/core`

Date: 2026-09-08. Issue: [#242](https://github.com/N1XUS/malva-ui/issues/242).

`@malva-ui/core` imports `@angular/router` in thirteen files across nine entry
points and declared no peer dependency on it. npm therefore never installed it,
and a consumer whose app had no router got `Cannot find module '@angular/router'`
at build time — with no install-time signal of any kind.

Nothing renamed, moved, or changed shape. The **only** change a consumer can
observe is a peer range that was missing and now is not, which is breaking per
[VERSIONING.md](../../VERSIONING.md) §2 (`peerDependencies` ranges are public
API).

Two adjacent declarations of the same defect ship with it: `lodash-es` becomes a
bundled `dependencies` entry of `@malva-ui/core`, and `rxjs` becomes a peer of
`@malva-ui/taskboard`. Both were imported and undeclared; neither needs a
consumer action beyond reinstalling.

## What consumers change

**Almost certainly nothing.** Every `ng new` application already has
`@angular/router` — the CLI installs it for the default routed app, and it is a
peer of nothing else you would have to have opted into.

If yours genuinely does not, npm 7+ will either auto-install it or fail the
install with `ERESOLVE` (and yarn / pnpm will print a missing-peer warning).
The fix is one line:

```bash
npm install @angular/router
```

Install a version satisfying the same range as your `@angular/core`; the peer is
declared against the Angular version this release is published for.

## Which entry points need it

| Entry point                 | What it imports                         |
| --------------------------- | --------------------------------------- |
| `@malva-ui/core/bottom-nav` | `RouterLink`, `RouterLinkActive`        |
| `@malva-ui/core/breadcrumb` | `RouterLink`                            |
| `@malva-ui/core/dialog`     | routable dialogs (`Router`, route defs) |
| `@malva-ui/core/drawer`     | routable drawers (`Router`, route defs) |
| `@malva-ui/core/list`       | `mlv-list-item-link`                    |
| `@malva-ui/core/page`       | `mlv-page-header`                       |
| `@malva-ui/core/segmented`  | `a[mlvSegmentedItem]` router navigation |
| `@malva-ui/core/sidebar`    | `mlv-sidebar-item`                      |
| `@malva-ui/core/tabs`       | router-driven tabs                      |

None of them is avoidable by not using the component's router feature, but the
mechanism differs across the nine and the difference matters:

- **Seven carry the import at module scope** in the shipped bundle —
  `malva-ui-core-{bottom-nav,breadcrumb,list,page,segmented,sidebar,tabs}.mjs`
  each open with an `import … from '@angular/router'`, evaluated the moment the
  entry point is loaded.
- **`dialog` and `drawer` do not.** Their value import lives in
  `routable-dialog` / `routable-drawer`, reached through a
  `loadComponent: () => import('./routable-dialog')`, so it is emitted into a
  lazy chunk and the entry-point bundle's own module scope is router-free; the
  route generator beside it imports only `import type`, erased at runtime.

  They still need the peer, for a reason that does not depend on the route ever
  loading: the emitted declarations re-export it. `types/malva-ui-core-dialog.d.ts:10`
  and `types/malva-ui-core-drawer.d.ts:9` both carry
  `import { DefaultExport, Route } from '@angular/router';`, so a consumer
  without the package fails to **typecheck** the entry point — before any
  runtime question arises.

## Why required, not optional

`peerDependenciesMeta.optional` looks like the polite choice for a peer only
some entry points need. It is the wrong one here: **npm does not install
optional peers, and does not warn about a missing one.** An optional declaration
would leave a consumer of `mlv-breadcrumb` in exactly the state #242 reports —
an unresolvable module — while adding the appearance of having handled it.

The precedent runs the other way too: when the editor left core (2026-08), the
twelve `@tiptap/*` peers were optional _because the editor was optional_, and
splitting the package was preferred over keeping the `peerDependenciesMeta`
workaround. Core declares no `peerDependenciesMeta` block, and this change does
not add one.

## How it was found, and what now finds it

Reported as "the generated StackBlitz project is missing `@angular/router`".
That is the same defect seen through the playground: `apps/docs` builds a
project's dependency closure from the example's own imports plus the **declared**
peer closure of the Malva packages it pulls, so a peer that is not declared is a
dependency the generated `package.json` cannot know about. The playground was
the messenger, not the bug — the mechanism worked, it had simply never been told
about the router.

Nothing in the workspace could see it: every in-repo consumer resolves
`@angular/router` from the workspace root `package.json`, so source builds,
specs and lint were green either way, and had been since `mlv-breadcrumb` first
used `RouterLink`.

`scripts/check-package-dependencies.mjs` closes the class rather than the
instance. For every package in `nx.json` → `release.projects`, it walks the
graph `ng-packagr` actually compiles — each entry point's `lib.entryFile` and
everything it reaches by relative import — collects the bare specifiers those
sources import, and fails on any the package declares in neither its
`dependencies` nor its `peerDependencies`. It runs as
`nx run @malva-ui/source:check-package-dependencies`, a `dependsOn` of the root
`test` target CI already selects.

## Workspace-internal changes

Relevant only to contributors:

- `libs/core/package.json` gains the `@angular/router` peer and the `lodash-es`
  dependency; `libs/taskboard/package.json` gains the `rxjs` peer.
- The two shipped npm READMEs move with the manifests, since each states its
  package's peers and both had gone stale: `libs/core/README.md` was missing
  `@angular/router` (the consumer-facing half of exactly this defect — the peer
  list a reader checks before installing) and `libs/taskboard/README.md` was
  missing the `rxjs` this change adds.
- `scripts/publish.mjs` gains the
  `0.0.0-angular-router-package-version` → `@angular/router` mapping, and
  `apps/docs/tools/playground-manifest.ts` gains the matching
  `PLACEHOLDER_DEPENDENCY` entry. A placeholder in only one of the two is what
  that module's `assertSubstituted` tripwire exists for.
- `scripts/publish.mjs` also gains `@malva-ui/taskboard` in its `libraries`
  list, which had never included it while `nx.json`'s `release.projects` did.
  Nothing else rewrites a built manifest, so `dist/libs/taskboard/package.json`
  was shipping its `0.0.0-*-package-version` placeholders verbatim — six of them
  before this change and, with the new `rxjs` peer, seven. Pre-existing and not
  yet reachable (taskboard is unpublished), but this change would otherwise have
  added a placeholder to a manifest nothing substitutes.
- `EXTRA_PLAYGROUND_PACKAGES` keeps `@angular/router`, with a comment that now
  says why: the peer closure is what supplies it to a project that pulls a core
  entry point, while the list covers the four docs examples that import the
  router directly (`tabs/examples/5`, `segmented/examples/2`,
  `dialog/examples/6`, `drawer/examples/3` — the complete set).
- `scripts/check-package-dependencies.mjs` and its `.spec.mjs` are new.
