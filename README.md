# Malva UI Library

A production-grade Angular UI component library with full accessibility support, light/dark theming, and AI-readable documentation.

Published packages:

| Package               | Description                                                                        |
| --------------------- | ---------------------------------------------------------------------------------- |
| `@malva-ui/core`      | All UI components (button, input, dialog, data-table, …) — 75 entry points         |
| `@malva-ui/cdk`       | Headless primitives: accessibility, density, data-source, overlay, infinite-scroll |
| `@malva-ui/i18n`      | Signal-based per-component i18n with ICU MessageFormat and 14 language packs       |
| `@malva-ui/editor`    | SSR-safe Tiptap rich-text editor shell                                             |
| `@malva-ui/scheduler` | Month / week / day calendar scheduler with draggable, resizable events             |
| `@malva-ui/tailwind`  | Tailwind CSS v4 theme adapter for the Malva UI design tokens                       |

---

## Install in an Angular application

```bash
ng add @malva-ui/core
```

The guided installer adds the matching Malva UI companion packages and global
styles, then bootstraps the selected application with theme and density
providers. In a workspace with multiple applications, pass
`--project <application-name>`.

For CI or other non-interactive setup:

```bash
ng add @malva-ui/core \
  --project my-app \
  --theme light \
  --density comfortable \
  --no-interactive
```

Import components from their grouped public entry points:

```ts
import { MlvButton } from '@malva-ui/core/button';
```

## Development setup

```bash
# Install dependencies
yarn install

# Serve the docs app
yarn nx serve docs

# Build all libraries
yarn build:libs
```

---

## Publishing

### Overview

Library `package.json` files use **version placeholders** instead of hardcoded
version strings. Nx Release builds the libraries with those placeholders intact
and updates only the workspace root `package.json`. The custom publish step then
resolves the placeholders in `dist/libs/*/package.json` from that newly updated
root manifest before publishing.

### Placeholder Reference

| Placeholder                            | Resolved from (`package.json`)    |
| -------------------------------------- | --------------------------------- |
| `0.0.0-malva-ui-package-version`       | `.version`                        |
| `0.0.0-angular-aria-package-version`   | `dependencies["@angular/aria"]`   |
| `0.0.0-angular-cdk-package-version`    | `dependencies["@angular/cdk"]`    |
| `0.0.0-angular-common-package-version` | `dependencies["@angular/common"]` |
| `0.0.0-angular-core-package-version`   | `dependencies["@angular/core"]`   |
| `0.0.0-angular-forms-package-version`  | `dependencies["@angular/forms"]`  |
| `0.0.0-lucide-angular-package-version` | `dependencies["@lucide/angular"]` |
| `0.0.0-rxjs-package-version`           | `dependencies["rxjs"]`            |
| `0.0.0-tiptap-package-version`         | `dependencies["@tiptap/core"]`    |

The placeholders are valid prerelease versions so package-manager validation
and Nx dependency inference continue to work before the packages are built.

### Versioning and the Changelog

Both are derived from Conventional Commits — nothing is bumped or written by
hand. `commitlint` enforces the format on every commit, and `nx.json`'s
`release.conventionalCommits.types` maps each type to a semver bump and a
changelog section:

| Type                           | Bump  | Changelog section |
| ------------------------------ | ----- | ----------------- |
| `feat`                         | minor | 🚀 Features       |
| `fix`                          | patch | 🩹 Fixes          |
| `perf`                         | patch | 🔥 Performance    |
| `refactor`                     | patch | 💅 Refactors      |
| `docs`                         | none  | 📖 Documentation  |
| `build`                        | patch | 📦 Build          |
| `revert`                       | patch | ⏪ Reverts        |
| `chore`, `test`, `ci`, `style` | none  | hidden            |

A `!` after the type (or a `BREAKING CHANGE:` footer) overrides the bump —
major, which pre-1.0 lands as a minor — and adds the commit to a
**⚠️ Breaking Changes** section carrying the full footer text.

The type map is explicit rather than left to Nx's defaults for a reason: the
defaults hide `refactor` and `docs`, and a hidden type takes its breaking-change
footers down with it. This workspace ships breaking API changes as `refactor!`,
so under the defaults a major release generated a changelog that never said what
broke. Add a type here before using it in a commit.

### Publish Workflow

Releases are **triggered manually from GitHub Actions** — Actions → **Release** →
Run workflow (`gh workflow run release.yml -f dryRun=false`). A push to `main`
never publishes. The workflow verifies, versions, changelogs, tags, pushes, cuts
the GitHub Release and publishes to npm. See
[docs/RELEASING.md](docs/RELEASING.md) for the required GitHub configuration
(npm credentials, workflow permissions, `main` bypass for `github-actions[bot]`,
the optional approval environment) and for the pre-1.0 version-bump rules. The
workflow's `auth` input selects between a stored npm token and OIDC **Trusted
Publishing**; Trusted Publishing is the target once the repository is public.

The commands below are the same pipeline run locally. `nx.json` sets
`release.git.push: true`, so a non-dry local `yarn release` pushes to `origin`.

**Step 1 — Preview the release:**

```bash
yarn release:dry-run
```

This runs Nx Release without changing Git, builds all six packages, and shows
the root manifest and changelog updates that would be made. Because GitHub
release creation is configured, the preview requires GitHub authentication and
connectivity even though it does not create the release.

**Step 2 — Run the release:**

```bash
yarn release
```

Nx calculates the version from conventional commits, builds `cdk`, `i18n`,
`core`, `editor`, `scheduler` and `tailwind`, updates the root version, commits
and tags the release, generates the AI documentation, resolves the built package manifests,
and publishes them in dependency order. Resolving a manifest also widens the
exact Angular/Tiptap pins the root uses for reproducible builds into the caret
peer ranges consumers need — a published `"@angular/core": "22.0.7"` would make
every consumer on any other patch of Angular 22 fail to install. A small custom Nx version action reads the current version
from the root manifest when no matching Git tag exists, so source package
placeholders never become the version authority.

For a standalone package-manifest check:

```bash
yarn publish:dry-run
```

This always rebuilds first, then prints the resolved manifests without writing
to `dist` or publishing. Do not use `nx release-publish` directly; it bypasses
the placeholder resolver.

### Local Registry Testing (Verdaccio)

The workspace ships its own Verdaccio instance on `http://localhost:4873` backed by the `local-registry` Nx target (config at `.verdaccio/config.yml`, storage under `tmp/local-registry/storage`).

#### Local publish

Run these steps from the workspace root:

```bash
# 1. Start Verdaccio in the background (skip if already running on :4873)
yarn nx run @malva-ui/source:local-registry &

# 2. Build the publishable packages.
yarn build:libs

# 3. Publish the built dist/libs/* at the current root package version.
#    publish:local = scripts/publish.mjs --registry http://localhost:4873
yarn publish:local

# 4. Verify
for pkg in @malva-ui/cdk @malva-ui/core @malva-ui/i18n; do
  npm view "$pkg" version --registry http://localhost:4873
done
```

For repeated tests against the same registry, first set an unpublished version
in the root `package.json`, then rebuild and publish again. Do not run
`nx release` for a local-registry-only test: the combined release command also
commits, tags, pushes, and creates the configured GitHub release.

```bash
yarn nx run-many -t build --projects=cdk,core,i18n --configuration=production
yarn publish:local
```

Consume the local packages from another project:

```bash
npm install @malva-ui/core --registry http://localhost:4873
```

To reset the local registry (wipe all published tarballs):

```bash
rm -rf tmp/local-registry/storage
```

### Publish Script Options

```
node scripts/publish.mjs [--dry-run] [--tag <tag>] [--registry <url>]

  --dry-run        Print resolved versions and skip npm publish.
  --tag <tag>      npm dist-tag (default: "latest").
  --registry <url> Custom registry URL.
```

---

## Development

### Running Tasks

```bash
yarn nx serve docs                      # Docs app with live reload
yarn nx build core                      # Build @malva-ui/core
yarn nx test checkbox                   # Unit tests for a library
yarn nx lint core                       # Lint @malva-ui/core
yarn nx run-many --target=test --all    # Test all libraries
yarn nx affected --target=build        # Build only what changed
yarn nx graph                           # Interactive dependency graph
```

### Creating a New Component Library

Use the `create-library` skill (via Claude Code) which scaffolds the Nx project, Angular implementation, docs examples, CLAUDE.md, and accessibility review in one flow.

---

## Package Structure

```
libs/
  cdk/               → @malva-ui/cdk  (CDK utilities)
    accessibility/
    density/
    infinite-scroll/
    utils/
  core/              → @malva-ui/core  (UI components)
    button/
    input/
    dialog/
    ...
  styles/            → @malva-ui/styles  (SCSS design-token source, bundled into core)
apps/
  docs/              → Documentation & showcase app
scripts/
  publish.mjs        → Publish pipeline (placeholder replacement + npm publish)
```

---

## Learn More

- [Nx Documentation](https://nx.dev)
- [Angular CDK](https://material.angular.io/cdk)
- [Lucide Icons](https://lucide.dev)
