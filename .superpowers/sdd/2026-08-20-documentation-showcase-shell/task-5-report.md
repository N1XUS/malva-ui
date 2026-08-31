# Task 5 — Shell documentation and regression verification

## Documentation

- Updated the tracked backing target for `apps/docs/CLAUDE.md`:
  `.claude/projects/app-docs.md`.
- Recorded the exact `apps/docs/src/app/showcases/` directories, five public
  showcase routes, `?category=` values (`all`, `workspaces`, `communication`,
  `data`, `content`, `settings`), invalid-value fallback, shared app-bar
  ownership, no-native-fullscreen/routed-example rule, and the `1600×1000`
  route-derived preview contract.
- Did not change `AGENTS.md`: the project index's names and descriptions remain
  accurate.
- Did not change the approved design spec: its implementation names remain
  aligned with the current public route/component contracts.

## Scoped verification repair

The first fresh docs lint run failed on ten current-branch Task 2
`@angular-eslint/component-selector` prefix violations. Renamed only those
internal selectors from `app-*` to `docs-*`, plus the two template references
to the loading component. This preserves routes and component classes; no
tests query the renamed selectors, so test behavior required no updates.

## Fresh shell verification

All final commands used `--skipNxCache`:

| Command | Result |
| --- | --- |
| `NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:vite:test --skipNxCache` | Passed: 23 files, 107 tests. Existing jsdom CDK `@layer` parse diagnostics and dynamic-example-import warnings did not fail the task. |
| `yarn nx test core-page --skipNxCache` | Passed: 8 files, 50 tests. |
| `yarn nx run styles:check-padding-tokens --skipNxCache` | Passed: 695 files scanned. |
| `yarn nx lint docs --skipNxCache` | Initial result: 10 selector-prefix errors; final rerun passed with all files clean. |
| `yarn nx lint core-page --skipNxCache` | Passed with all files clean. |
| `yarn nx typecheck docs --skipNxCache` | Passed: `tsc --noEmit -p tsconfig.app.json`. |
| `yarn nx build docs --skipNxCache` | Initial sandbox-only run could not resolve `fonts.googleapis.com`; approved networked rerun passed. Existing NG8113 unused-import warnings and the existing 1.67 MB initial-budget warning remain non-fatal. |
| `git diff --check` | Passed with no whitespace errors. |

## In-app Browser inspection

Read `docs:serve --help` first; it documents `--port` (default 4200). Verified
port 4305 was free, then served this worktree with:

```sh
yarn nx run docs:serve --port 4305 --host 127.0.0.1
```

Used only the in-app Browser at `http://127.0.0.1:4305`; no Chrome,
Playwright CLI, or fullscreen action was used. The server was stopped after
inspection.

| Route | Evidence |
| --- | --- |
| `/` | One app bar/header and one `main`; Docs pill active; no fullscreen control. Keyboard focus on Skip to content had `rgb(0, 95, 204) auto 1px` outline and was visually captured. |
| `/button` | After the lazy docs content settled: one shared app bar/header, one `main`, docs shell/sidebar and ToC present, Docs pill active, no fullscreen control. |
| `/showcases` | One shared app bar, one `main`, five catalog cards, Showcases pill active, no docs shell/sidebar/ToC, and no fullscreen control. |
| `/showcases/project-workspace` | One shared app bar/header and one `main`, Showcases pill active, no docs shell/sidebar/ToC, and no fullscreen control. |

## Self-review and concerns

- The app guide names the implemented selector `docs-showcase-shell`, registry,
  directories, routes, URL filter behavior, and capture contract precisely.
- Selector updates are confined to the lint failures reported by the mandated
  command and their direct template consumers.
- Browser inspection is a shell regression check, not a final reference-image
  comparison. The catalog currently contains an additional structural
  `<header>` inside its `main` (two `header` elements total), and the current
  Project Workspace walking-skeleton route is visually blank apart from its
  semantic heading. Record both for later visual/composed-showcase QA; no
  visual changes were invented in this documentation task.
