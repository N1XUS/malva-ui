# Malva UI Tailwind Theme Design

## Status

Base design approved for implementation on 2026-08-29. Documentation scope
extension added for review on 2026-08-29.

## Goal

Ship a publishable, Tailwind CSS v4-only `@malva-ui/tailwind` companion package that exposes Malva UI design tokens as Tailwind theme variables and provides an idempotent Angular schematic for installing the integration into an application.

The package is an adapter for application-level utility styling. It does not replace the existing Malva component styles, BEM class contract, SCSS mixins, density system, or published core stylesheet.

## Context and constraints

- The repository uses Yarn 4 and Nx 23.1.
- `libs/styles/src/lib/theme.scss` is the canonical source of Malva design tokens.
- `@malva-ui/core/styles/malva-ui.css` is the published global token/reset/animation stylesheet consumed by applications.
- Malva component styles remain SCSS, BEM-named, token-driven, and compiled by Angular/ng-packagr.
- The new package targets Tailwind CSS v4 only and uses the CSS-first `@theme inline` format.
- Tailwind is optional for existing Malva consumers; no core component may require Tailwind to render correctly.
- The new package must be publishable through the existing `scripts/publish.mjs` pipeline.
- The new package must expose an Angular `ng-add` schematic.
- Schematic-managed text snippets must be surrounded by stable `malva-ui:tailwind:start` and `malva-ui:tailwind:end` comment markers so future schematic versions can update only the owned region.
- Existing user content outside managed regions must be preserved byte-for-byte where practical.
- Existing uncommitted workspace changes are user-owned and must not be reverted or included in commits for this feature.

## Chosen approach

Create a standalone pure-CSS package at `libs/tailwind` with its own package metadata, assets, build target, documentation, and schematics. The package will be named `@malva-ui/tailwind`.

The package will not include Tailwind itself in its runtime output and will not ship a precompiled utility stylesheet. Consumers import the package's theme file from their own Tailwind entrypoint, allowing Tailwind to generate only the utilities used by the consuming application.

The package will declare `tailwindcss` as a peer dependency with a v4 range. Its schematic will add the build-time packages required by Angular's PostCSS integration (`tailwindcss`, `@tailwindcss/postcss`, and `postcss`) to the consuming application when they are missing.

## Alternatives rejected

### Add a Tailwind secondary entrypoint to `@malva-ui/core`

This would reduce the package count, but it would force consumers who only want core Angular components to carry the Tailwind adapter surface and would couple the CSS-only theme release to the core package's ng-packagr output. A standalone package keeps the integration optional and gives the theme a clear ownership boundary.

### Ship only a JavaScript Tailwind preset

This would make the package less idiomatic for Tailwind v4, where shared CSS theme files can be imported directly. It would also require consumers to bridge the existing runtime CSS variables into a JavaScript configuration format. The v4 CSS entrypoint is the primary API; no v3 preset is in scope.

## Token adapter contract

`theme.css` will use `@theme inline` mappings from Tailwind namespaces to existing Malva custom properties. It will never duplicate literal palette, spacing, radius, shadow, or typography values.

The adapter exposes only stable public token categories. Component-private variables such as `--mlv-btn-*`, `--mlv-dt-*`, and `--mlv-editor-*` are not exported.

### Naming

All adapter names use an `mlv-` namespace to avoid collisions with another Tailwind theme installed by the consuming application.

Examples:

```html
<section class="bg-mlv-surface text-mlv-content border-mlv-normal p-mlv-2 rounded-mlv-m">
  Malva-styled application content
</section>
```

### Mapping categories

| Tailwind namespace | Malva source | Example generated utility |
| --- | --- | --- |
| `--color-mlv-*` | Palette colors and semantic background/text/border tokens | `bg-mlv-primary-500`, `text-mlv-content`, `border-mlv-normal` |
| `--spacing-mlv-*` | Single-value `--mlv-spacing-*` tokens | `p-mlv-2`, `gap-mlv-4`, `w-mlv-16` |
| `--radius-mlv-*` | `--mlv-radius-*` tokens | `rounded-mlv-m` |
| `--shadow-mlv-*` | `--mlv-shadow-*` tokens | `shadow-mlv-2` |
| `--font-mlv-*` | Malva font-family tokens | `font-mlv-sans` |
| `--font-weight-mlv-*` | Malva font-weight tokens | `font-mlv-medium` |
| `--text-mlv-*` | Malva font-size tokens | `text-mlv-body-m` |
| `--leading-mlv-*` | Malva line-height tokens | `leading-mlv-body-m` |

Border color mappings will include `subtle`, `normal`, `strong`, `focus`, `error`, `success`, `warning`, and `info`. Border radii and shadows are mapped independently. Stroke-width tokens remain available through normal Tailwind border utilities or explicit custom-property values; no misleading color namespace is created for widths.

### Colors

Raw palette families will expose the existing `50` through `950` stops for primary, secondary, accent, neutral, success, warning, danger, and info.

Stable semantic mappings will include:

- surfaces: `surface`, `surface-subtle`, `surface-raised`, `surface-overlay`, `surface-sunken`, `surface-selected`, and `surface-selected-hover`;
- content: `content`, `content-secondary`, `content-tertiary`, `content-disabled`, `content-inverse`, `content-action`, `content-action-hover`, and `content-error`;
- interactive states: primary/accent, neutral, danger, success, warning, and info rest/hover/active values where a stable public token exists;
- borders: the public border token set described above.

The semantic mappings reference the runtime `--mlv-*` variables. Consequently, the same Tailwind utility responds to Malva light, dark, and high-contrast theme selectors without requiring duplicated `dark:` utility classes.

### Spacing and padding

Only the single-value `--mlv-spacing-*` scale is mapped to Tailwind spacing. The existing `--mlv-padding-*` variables are vertical/horizontal pairs and must not be exposed as single spacing values. This preserves the repository's padding-token invariant and prevents invalid utilities such as a pair token being used as a gap, margin, or one-axis padding value.

### Typography

Font sizes, line heights, weights, and families are mapped separately. Semantic typography mappings use names that cannot collide between Tailwind's color and text-size namespaces, for example `--color-mlv-content` and `--text-mlv-body-m`.

Responsive heading sizes remain driven by the existing Malva custom properties and media queries. The adapter does not copy the resolved light-theme values into Tailwind theme variables.

## Package layout

The new package will use this source layout:

```text
libs/tailwind/
├── package.json
├── project.json
├── README.md
├── theme.css
├── schematics/
│   ├── collection.json
│   └── ng-add/
│       ├── index.cjs
│       └── schema.json
└── tests/
    ├── theme.spec.mjs
    └── schematics/ng-add.spec.js
```

The package's `package.json` will include:

- name `@malva-ui/tailwind`;
- the existing Malva version placeholder;
- `publishConfig.access: public`;
- `peerDependencies.tailwindcss` with a Tailwind v4 range;
- `peerDependencies.@malva-ui/core` with the existing Malva version placeholder, because the adapter resolves through the core runtime token stylesheet;
- `schematics: ./schematics/collection.json`;
- an explicit `files` allowlist containing `theme.css`, `README.md`, and `schematics`;
- explicit CSS and package-json exports that point to files present in the built package;
- `sideEffects: true` because the package is CSS consumed for its side effects.

The package will not have a TypeScript runtime entrypoint and will not depend on Angular at runtime.

## Build and publish integration

`libs/tailwind/project.json` will define a cached `build` target that stages the package metadata, CSS, README, and schematics into `dist/libs/tailwind`. The build must not rely on Angular component compilation.

The build target will include the source files and the Malva theme source/token documentation as inputs so Nx invalidates the package when token definitions change.

The existing publish pipeline will be updated to:

1. build the new package as part of the library build workflow;
2. process `dist/libs/tailwind/package.json` through the existing version-placeholder replacement;
3. validate all package export targets before publish;
4. publish `@malva-ui/tailwind` after `@malva-ui/core`, because the schematic and documentation may reference the core stylesheet.

The release workflow must continue to publish the existing packages with their current metadata and ordering semantics. A full release build must include the new package before the publish pipeline runs; a missing `dist/libs/tailwind/package.json` remains a publish preflight failure rather than silently omitting the package.

## Schematic contract

The package's only schematic is `ng-add`, with `install` as an alias and hidden metadata matching the existing core package installer convention.

### Options

| Option | Type | Default | Behavior |
| --- | --- | --- | --- |
| `project` | string | inferred | Selects the Angular application to update; required when multiple applications exist |
| `skipInstall` | boolean | `false` | Skips package-manager installation behavior in tests or controlled environments |
| `includeCoreStyles` | boolean | `true` | Ensures the published Malva core stylesheet is included in the application build |
| `stylesheet` | string | inferred | Optional project-relative path for the managed Tailwind entry stylesheet |

The schematic must reject an explicit non-application project, reject a workspace with no applications, and require an explicit project when more than one application exists.

### Dependency changes

The schematic adds these dependencies only when absent, preserving an existing version when present:

- `@malva-ui/tailwind` as a regular dependency;
- `@malva-ui/core` as a regular dependency when `includeCoreStyles` is enabled and the package is absent;
- `tailwindcss` as a development dependency;
- `@tailwindcss/postcss` as a development dependency;
- `postcss` as a development dependency.

The schematic must be idempotent for all dependency entries.

### Managed stylesheet

The default stylesheet path is `<project sourceRoot>/styles/malva-ui-tailwind.css`, normalized from the selected application's source root. If the caller supplies `stylesheet`, the path must remain inside the project root and use a `.css` extension.

The generated file contains exactly one managed block:

```css
/* malva-ui:tailwind:start */
@import "tailwindcss";
@import "@malva-ui/tailwind/theme.css";
/* malva-ui:tailwind:end */
```

The schematic adds the stylesheet to the application's build styles. It must recognize both string style entries and object entries with an `input` property. The entry is added once, before the application's existing global stylesheet entries so Tailwind base styles are established before application overrides.

On a repeated run:

- if the managed stylesheet exists with both markers, only the content between the markers is replaced with the current canonical block;
- if the file has user content before or after the markers, that content remains unchanged;
- if the style entry already exists, it is not duplicated;
- if the imports exist without markers, the schematic must not duplicate them and must log that manual review is needed rather than overwriting the file.

### Core stylesheet

When `includeCoreStyles` is enabled, the schematic adds `node_modules/@malva-ui/core/styles/malva-ui.css` to the build styles if it is not already present. This keeps the runtime `--mlv-*` variables available to the Tailwind adapter. The schematic must recognize both string and `{ input }` style entries.

### PostCSS configuration

The schematic configures `@tailwindcss/postcss` using the standard Angular PostCSS discovery mechanism.

- If no recognized PostCSS configuration exists, create a `postcss.config.json` file with the plugin entry; Angular's current application builder discovers this JSON format automatically.
- If an existing JavaScript/CJS PostCSS configuration exists, add the plugin inside a managed marker block without changing unrelated plugins.
- If an existing JSON PostCSS configuration exists, parse and merge the plugin structurally because JSON cannot contain comments; preserve all unrelated keys and values.
- If multiple PostCSS configurations exist or an existing configuration cannot be safely understood, throw a clear schematic error rather than creating a competing configuration.
- Repeated runs must leave one plugin entry and must preserve unrelated configuration.

The schematic must use stable marker constants in one implementation module so future updates can replace managed regions consistently.

## Documentation

`libs/tailwind/README.md` will document:

1. required Tailwind v4 and Angular setup;
2. the `ng add @malva-ui/tailwind` command;
3. manual CSS imports for users who do not use the schematic;
4. the requirement to load the Malva core stylesheet for the runtime tokens;
5. representative color, spacing, typography, radius, and shadow utilities;
6. automatic light/dark/high-contrast behavior through Malva tokens;
7. the fact that the package does not replace Malva component CSS;
8. how to rerun the schematic safely and what the comment markers mean.

The workspace `AGENTS.md` library index and the corresponding `.claude/projects/libs-tailwind.md` project documentation will be added/updated as required by the repository instructions.

### Documentation site page

The docs app will receive a dedicated installation and reference page at
`/tailwind`, implemented under `apps/docs/src/app/pages/tailwind/` with the
existing page conventions (`index.ts`, `index.html`, and `index.scss`). It is a
standalone guide rather than a component page, so it will not be added to
`pageRoutes` or receive an API tab.

The page will be added to the existing `Overview` navigation group as a
separate item:

```ts
{ label: 'Tailwind', link: '/tailwind', icon: 'palette' }
```

The page content will include:

1. a quick-start installation path using `ng add @malva-ui/tailwind`;
2. the equivalent manual setup, including the Tailwind v4 CSS entrypoint,
   `@malva-ui/tailwind/theme.css`, the PostCSS plugin, and the Malva core
   stylesheet required for runtime `--mlv-*` values;
3. schematic options and the meaning of the managed comment boundaries;
4. a reference table for the exported Tailwind theme-variable namespaces:
   `--color-mlv-*`, `--spacing-mlv-*`, `--radius-mlv-*`, `--shadow-mlv-*`,
   `--font-mlv-*`, `--font-weight-mlv-*`, `--text-mlv-*`, and
   `--leading-mlv-*`;
5. a class-pattern table showing how those variables become `bg-mlv-*`,
   `text-mlv-*`, `border-mlv-*`, `p-mlv-*`, `gap-mlv-*`, `rounded-mlv-*`,
   `shadow-mlv-*`, `font-mlv-*`, and `leading-mlv-*` utilities, including
   responsive and state variants;
6. live examples using the actual generated utilities for a themed surface,
   semantic color, spacing, border, radius, shadow, and typography; and
7. a concise troubleshooting section covering missing core styles, stale
   generated utilities, and the fact that Tailwind utilities do not replace
   Malva component CSS.

The examples must be compiled by Tailwind v4 in the docs build rather than
simulated with page-local CSS. The docs app will add a dedicated
`apps/docs/src/tailwind.css` entry that imports Tailwind's theme and utilities
layers plus the workspace Tailwind adapter, and scopes Tailwind source scanning
to the docs app. It will intentionally omit Tailwind Preflight so the existing
documentation shell reset and typography remain unchanged. The docs build will
include this entry before `apps/docs/src/styles.scss` and will use the same
Tailwind v4/PostCSS packages exercised by the published integration.

The page's reference tables and examples will be kept aligned with
`libs/tailwind/theme.css`; theme contract tests will assert the documented
namespace and representative class contracts so a token rename cannot silently
leave the guide inaccurate.

## Testing strategy

### Theme contract tests

`libs/tailwind/tests/theme.spec.mjs` will read `theme.css` and assert:

- the file uses `@theme inline`;
- all exported mappings reference existing `--mlv-*` tokens;
- no exported mapping contains duplicated literal design values;
- no `--mlv-padding-*` pair is mapped into the spacing namespace;
- names are namespaced with `mlv-`;
- semantic color, spacing, radius, shadow, and typography mappings are present;
- the imports/documented contract remain stable.

The test may use the generated `libs/styles/tokens.md` or a token extraction helper, but it must fail when a mapped source token is removed or misspelled.

### Schematic tests

`libs/tailwind/tests/schematics/ng-add.spec.js` will use `SchematicTestRunner` and in-memory Angular workspace trees, following `libs/core/tests/schematics/ng-add.spec.js`.

Tests will cover:

- dependency installation and preservation of existing versions;
- generated stylesheet content and exact markers;
- styles-array insertion for string entries;
- styles-array insertion for object entries;
- core stylesheet installation and duplicate detection;
- PostCSS config creation;
- PostCSS JavaScript config merging;
- PostCSS JSON config merging;
- preservation of unrelated PostCSS plugins/configuration;
- repeated runs with no duplicate dependencies, style entries, plugin entries, or markers;
- replacement of a managed block while preserving surrounding user content;
- safe handling of unmarked manual imports;
- explicit project selection;
- multiple-application error behavior;
- no-application and non-application error behavior;
- stylesheet path validation.

### Publishability tests

The package build verification will inspect the staged output and assert:

- `package.json`, `theme.css`, `README.md`, and schematics files exist in `dist/libs/tailwind`;
- every declared export target exists;
- the package contains no unresolved Malva version placeholder after publish preprocessing;
- `npm pack --dry-run` reports only intended package files;
- the existing publish pipeline includes the package in dry-run mode.

### Documentation tests

The docs test/build coverage will assert:

- `/tailwind` resolves through the docs shell;
- `Tailwind` appears as its own Overview sidebar item and remains active only
  for the Tailwind page;
- the installation commands, managed marker names, theme-variable namespaces,
  and representative utility class names appear in the page source;
- the docs production build emits the live utility classes used by the examples;
- no Tailwind Preflight rules are introduced into the docs bundle by the
  docs-only integration.

## Acceptance criteria

- `yarn nx build tailwind` creates a complete publishable package in `dist/libs/tailwind`.
- The package can be installed by `ng add @malva-ui/tailwind` into a minimal Angular application.
- The schematic is safe to rerun and updates only its marker-owned regions.
- The generated utilities resolve through Malva runtime tokens in light, dark, and high-contrast modes.
- Existing Malva component styles and consumers do not require Tailwind.
- Token validation and schematic tests pass through Nx targets.
- The full publish dry run recognizes and validates `@malva-ui/tailwind`.
- The docs app exposes a separate Overview → Tailwind installation/reference
  page with working v4 utility examples and documented variable/class names.
- Existing user changes remain untouched.
