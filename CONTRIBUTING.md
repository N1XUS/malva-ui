# Contributing to Malva UI

## Prerequisites

| Tool | Version                | Notes                                       |
| ---- | ---------------------- | ------------------------------------------- |
| Node | see [`.nvmrc`](.nvmrc) | `package.json` requires `>=24.15.0`         |
| Yarn | 4.13.0                 | via Corepack — do not install Yarn globally |

```bash
corepack enable && yarn install --immutable
```

## Everyday commands

Always go through Nx rather than the underlying tool, so caching and
affected-analysis work.

```bash
yarn nx run-many -t lint test test-schematics build typecheck
```

```bash
yarn nx test core-button
```

```bash
yarn nx affected -t lint test
```

End-to-end tests are **not** part of CI — they need a Playwright browser
download and only three projects declare them (`core-button`, `core-checkbox`,
`editor`). Run them locally, or trigger the **E2E** workflow from the Actions
tab.

```bash
npx playwright install --only-shell && yarn nx run-many -t e2e
```

## Conventions

Read these before writing code. They are enforced by review, and in several
cases by tooling:

- [`.claude/projects/best-practices.md`](.claude/projects/best-practices.md) — TypeScript, Angular, accessibility, CSS, naming
- [`.claude/rules/angular-component.md`](.claude/rules/angular-component.md) — every `@Component`
- [`.claude/rules/angular-directive.md`](.claude/rules/angular-directive.md) — every `@Directive`
- [`.claude/rules/angular-pipe.md`](.claude/rules/angular-pipe.md) — every `@Pipe`
- [`.claude/rules/bem-scss.md`](.claude/rules/bem-scss.md) — every `.scss` file
- [`.claude/rules/accessibility.md`](.claude/rules/accessibility.md) — anything interactive

The short version: standalone components only, signals for state, `input()` /
`output()` / `model()` rather than decorators, `ChangeDetectionStrategy.OnPush`
and `ViewEncapsulation.None` on every library component, BEM class names, and
`--mlv-*` design tokens instead of literal values.

Every component must pass AXE with zero violations and meet WCAG 2.1 AA.

## Commits

Commit messages are checked by commitlint on the `commit-msg` hook.
[Conventional Commits](https://www.conventionalcommits.org/), with a scope drawn
from the enum in [`commitlint.config.mjs`](commitlint.config.mjs) — one per
workspace project (`button`, `data-table`, `tailwind`, …) plus the meta scopes
`deps`, `ci`, `release` and `docs`.

```
feat(select): add searchable dropdown
fix(tooltip): keep the arrow aligned on flip
```

The type decides the release bump: `feat` and `fix` and `perf` and `refactor`
and `build` and `revert` all move the version; `docs`, `chore`, `test`, `ci` and
`style` do not. Breaking changes take a `!` — `refactor!:` is the form this
workspace uses — and belong in [`docs/migrations/`](docs/migrations/).

`lint-staged` runs on the `pre-commit` hook and will format what you staged.

## Documentation

Changing a library's public API means updating its `CLAUDE.md`
(`.claude/projects/libs-<name>.md`, symlinked into the library). Then:

```bash
yarn nx run docs:check-doc-api
```

It fails when a documented member does not exist, and warns when a declared
member is undocumented.

## Pull requests

- Branch off `main`.
- Keep the change focused — one concern per PR.
- Make sure `yarn nx run-many -t lint test typecheck` is clean before opening it.
- Describe the user-visible effect, not just the diff.

## Releases

Releases are maintainer-only and manually triggered. See
[`docs/RELEASING.md`](docs/RELEASING.md).
