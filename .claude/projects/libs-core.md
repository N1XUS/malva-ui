---

# Library: core

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including packaging, secondary entry points, public imports, dependency wiring, documentation, or build behavior.

## Overview

`@malva-ui/core` is the grouped public package for all Malva UI components (including form controls, previously in `@malva-ui/forms`). It exposes secondary entry points such as:

- `@malva-ui/core/accordion`
- `@malva-ui/core/action-bar`
- `@malva-ui/core/avatar`
- `@malva-ui/core/badge`
- `@malva-ui/core/button`
- `@malva-ui/core/calendar`
- `@malva-ui/core/card`
- `@malva-ui/core/chat`
- `@malva-ui/core/checkbox`
- `@malva-ui/core/chip`
- `@malva-ui/core/color-picker`
- `@malva-ui/core/combobox`
- `@malva-ui/core/copy-to-clipboard`
- `@malva-ui/core/data-table`
- `@malva-ui/core/day-picker`
- `@malva-ui/core/dialog`
- `@malva-ui/core/drawer`
- `@malva-ui/core/dropdown`
- `@malva-ui/core/filter`
- `@malva-ui/core/expand`
- `@malva-ui/core/form-utils`
- `@malva-ui/core/input`
- `@malva-ui/core/layout`
- `@malva-ui/core/link`
- `@malva-ui/core/list`
- `@malva-ui/core/loader`
- `@malva-ui/core/notification`
- `@malva-ui/core/pagination`
- `@malva-ui/core/popup`
- `@malva-ui/core/radio`
- `@malva-ui/core/search-field`
- `@malva-ui/core/select`
- `@malva-ui/core/sidebar`
- `@malva-ui/core/slider`
- `@malva-ui/core/status-indicator`
- `@malva-ui/core/switch`
- `@malva-ui/core/swipe-actions`
- `@malva-ui/core/tabs`
- `@malva-ui/core/tile`
- `@malva-ui/core/title`
- `@malva-ui/core/toast`
- `@malva-ui/core/tokenizer`
- `@malva-ui/core/toolbar`
- `@malva-ui/core/view-variant`

The leaf libraries under `libs/<leaf-name>` remain the granular Nx implementation, testing, and affected-analysis units during the migration. The `core` package is the grouped consumer-facing distribution surface.

## Public API

Exported from `libs/core/src/index.ts`:

- All exports from `@malva-ui/core/accordion`
- All exports from `@malva-ui/core/action-bar`
- All exports from `@malva-ui/core/avatar`
- All exports from `@malva-ui/core/badge`
- All exports from `@malva-ui/core/button`
- All exports from `@malva-ui/core/calendar`
- All exports from `@malva-ui/core/card`
- All exports from `@malva-ui/core/chat`
- All exports from `@malva-ui/core/checkbox`
- All exports from `@malva-ui/core/chip`
- All exports from `@malva-ui/core/combobox`
- All exports from `@malva-ui/core/copy-to-clipboard`
- All exports from `@malva-ui/core/data-table`
- All exports from `@malva-ui/core/day-picker`
- All exports from `@malva-ui/core/dialog`
- All exports from `@malva-ui/core/drawer`
- All exports from `@malva-ui/core/dropdown`
- All exports from `@malva-ui/core/filter`
- All exports from `@malva-ui/core/expand`
- All exports from `@malva-ui/core/form-utils`
- All exports from `@malva-ui/core/input`
- All exports from `@malva-ui/core/layout`
- All exports from `@malva-ui/core/link`
- All exports from `@malva-ui/core/list`
- All exports from `@malva-ui/core/loader`
- All exports from `@malva-ui/core/notification`
- All exports from `@malva-ui/core/pagination`
- All exports from `@malva-ui/core/popup`
- All exports from `@malva-ui/core/radio`
- All exports from `@malva-ui/core/search-field`
- All exports from `@malva-ui/core/select`
- All exports from `@malva-ui/core/sidebar`
- All exports from `@malva-ui/core/slider`
- All exports from `@malva-ui/core/status-indicator`
- All exports from `@malva-ui/core/switch`
- All exports from `@malva-ui/core/swipe-actions`
- All exports from `@malva-ui/core/tabs`
- All exports from `@malva-ui/core/tile`
- All exports from `@malva-ui/core/title`
- All exports from `@malva-ui/core/toast`
- All exports from `@malva-ui/core/tokenizer`
- All exports from `@malva-ui/core/toolbar`
- All exports from `@malva-ui/core/view-variant`

Each secondary entry point in `libs/core/<entry>/src/index.ts` re-exports exactly one corresponding leaf package.

## Architecture Notes

- `libs/core` is a publishable Angular package root generated with Nx secondary entry points.
- Each secondary entry point acts as a stable consumer import path while delegating implementation to the corresponding leaf package.
- Consumer-facing docs/examples should prefer `@malva-ui/core/*` imports.
- Internal library-to-library imports can remain on the leaf package paths while the migration is in progress.
- `libs/core/tsconfig.lib.json` intentionally excludes secondary-entry e2e files and Playwright configs from production typecheck/build so testing helpers such as `@malva-ui/cdk/testing-e2e` do not leak into the published package compilation.
- The public package declares `schematics/collection.json`, which exposes the
  hidden `ng-add`/`install` schematic used by `ng add @malva-ui/core`.
- The `core:build` target depends on `core:build-styles`, which compiles
  `libs/core/styles/malva-ui.scss` before ng-packagr copies the generated
  `styles/malva-ui.css` global asset into the published package.
- The editor is **not** part of this package. It ships separately as
  `@malva-ui/editor`, which peer-depends on `@malva-ui/core`, and every
  `@tiptap/*` peer moved with it. Core therefore declares no Tiptap peers at
  all and no `peerDependenciesMeta` block: a consumer who never installs the
  editor never sees them.

## Installation Schematic

`ng add @malva-ui/core` performs a guided, idempotent consumer setup:

1. Resolve the requested application. A sole application is selected
   automatically; ambiguous workspaces must pass `--project`.
2. Add version-matched `@malva-ui/core`, `@malva-ui/cdk`, and
   `@malva-ui/i18n` dependencies without replacing an existing version.
3. Add `node_modules/@malva-ui/core/styles/malva-ui.css` to the application's
   build styles unless `includeStyles` is false.
4. Add `provideDefaultTheme(theme, themeStorageKey)` and
   `provideMlvDensity(density)` to standalone or NgModule root providers unless
   `configureProviders` is false.

Interactive schema choices cover `theme` (`light`/`dark`), all five density
levels, global styles, and provider bootstrapping. `skipInstall` is available
for controlled environments. Tests live under `libs/core/tests/schematics` and
run through `yarn nx run core:test-schematics`.

## `@angular/aria` migration — selector & value strategy (cross-cutting)

The composite-widget migration replaces hand-rolled ARIA/selection plumbing with `@angular/aria` headless directives (`ngListbox`/`ngOption`, `ngMenu`/`ngMenuItem`, `ngTabs`, `ngTree`, `ngToolbar`, `ngCombobox`). The following conventions apply repo-wide so the public `mlv-*` API stays unchanged:

- **aria directives live _inside_ Malva UI components** — applied as `hostDirectives` (e.g. `Listbox`/`Option` on `mlv-list[selectable]` / `mlv-list-item[value]`) or inside component templates. Consumers never bind `ng*` selectors directly; the public selectors, inputs, outputs and CVA contracts are preserved by re-exposing/aliasing the aria inputs.
- **`value` is required on `ngOption`/`ngMenuItem`/`ngTab`/`ngTreeItem`/`ngToolbarWidget`.** Components whose items carry a natural value (list, select, combobox, tree options) forward it. Components whose items have no natural value (menu items, toolbar buttons) synthesize a stable value using the existing id-generation util (`mlvNextId` / `@malva-ui/cdk/utils`).
- **aria selection models are always arrays (`value: V[]`)** — even for single-select, where the array holds at most one entry. Controls built on `FormControlBase<T>` bridge their single/multi CVA value with `toAriaValues` / `fromAriaValues` from `@malva-ui/core/form-utils` (see the form-utils CLAUDE.md).
- **aria pattern defaults differ from the CDK equivalents** and must be pinned to preserve behavior. For listbox: `selectionMode` defaults to `follow` (aria) vs. explicit-only selection (CdkListbox) — pin `selectionMode="explicit"`; `softDisabled` defaults to `true` (focusable-but-inert) vs. skip-disabled (CdkListbox) — pin `[softDisabled]="false"`. These knobs are re-exposed as inputs on the Malva UI wrapper so consumers (and the shared `mlv-dropdown-panel`) can pin them. NB: a host directive's exposed inputs **cannot** be set from the wrapper directive's own `host` bindings — they must be bound where the wrapper element is used (e.g. `mlv-dropdown-panel`'s template).
- **aria pointer selection resolves the target via `closest('[role="option"]')`** (and equivalent per-pattern roles). Because `mlv-list-item` binds `[attr.role]="itemRole()"` (default `listitem`), selectable option rows must set `itemRole="option"` (and the container `listRole="listbox"`) for click selection to work. The shared `mlv-dropdown-panel` sets both automatically.
- **Not every pattern fits — some components keep their manual implementation.** `mlv-menu` / `mlv-context-menu` (Task 2.6) do **not** adopt the aria `ngMenu*` primitives: their items are consumer-content-projected while the panel is a detached CDK-overlay `TemplatePortal`, so no single element can be the aria `Menu`'s DI parent, keyboard/focus host, and DOM-order observer at once — adopting it would break the content-projection public API or drop CDK-overlay positioning. They keep the custom `FocusKeyManager` + CDK-overlay implementation, adding only the aria-parity **type-ahead** behavior via `FocusKeyManager.withTypeAhead()`. See `libs-menu.md` / `libs-context-menu.md` for the full analysis. This is the plan's sanctioned fallback ("if a pattern doesn't fit, keep the manual implementation").

## Dependencies

### Angular / third-party peers

All ten `peerDependencies` of `libs/core/package.json`, and nothing else — the
list is meant to be diffed against the manifest, so it carries the `@malva-ui/*`
peers too rather than only the third-party ones. All required; core declares no
`peerDependenciesMeta` block, the twelve optional `@tiptap/*` peers having left
with the editor (2026-08).

- `@angular/aria`
- `@angular/cdk`
- `@angular/common`
- `@angular/core`
- `@angular/forms`
- `@angular/router` — `RouterLink` / `Router` / `ActivatedRoute` in nine entry
  points: `bottom-nav`, `breadcrumb`, `dialog` (routable dialogs), `drawer`
  (routable drawers), `list` (`mlv-list-item-link`), `page` (`mlv-page-header`),
  `segmented`, `sidebar` (`mlv-sidebar-item`) and `tabs`. Required, not
  optional: npm does not install optional peers, so an optional declaration
  would leave the import unresolvable and warn nobody (#242).
- `@lucide/angular`
- `@malva-ui/cdk`
- `@malva-ui/i18n`
- `rxjs`

Enforced from the other side by `scripts/check-package-dependencies.mjs`, which
fails on a bare specifier a published entry point imports and the manifest
declares in neither `dependencies` nor `peerDependencies`.

### Bundled runtime dependencies

Declared in `libs/core/package.json` `dependencies` and whitelisted in
`ng-package.json` `allowedNonPeerDependencies` (they ship with the package
rather than being required of consumers):

- `fast-equals` — deep value equality (`mlv-filter`'s listbox selection
  comparison). Chosen over `fast-deep-equal` because it is ESM; a CommonJS
  dependency makes every consuming Angular build emit an
  "is not ESM / optimization bailouts" warning.
- `lodash-es` — `cloneDeep` / `sortBy` in `MlvDrawerSectionsService`. Bundled
  rather than a peer: it is an implementation choice of one service, not a
  framework the consumer owns one copy of.
- `sortablejs` — drag reordering.

### Internal package dependencies

- `@malva-ui/core/accordion`
- `@malva-ui/core/action-bar`
- `@malva-ui/core/avatar`
- `@malva-ui/core/badge`
- `@malva-ui/core/button`
- `@malva-ui/core/calendar`
- `@malva-ui/core/card`
- `@malva-ui/core/chat`
- `@malva-ui/core/checkbox`
- `@malva-ui/core/chip`
- `@malva-ui/core/color-picker`
- `@malva-ui/core/combobox`
- `@malva-ui/core/copy-to-clipboard`
- `@malva-ui/core/data-table`
- `@malva-ui/core/day-picker`
- `@malva-ui/core/dialog`
- `@malva-ui/core/drawer`
- `@malva-ui/core/dropdown`
- `@malva-ui/core/filter`
- `@malva-ui/core/expand`
- `@malva-ui/core/form-utils`
- `@malva-ui/core/input`
- `@malva-ui/core/layout`
- `@malva-ui/core/link`
- `@malva-ui/core/list`
- `@malva-ui/core/loader`
- `@malva-ui/core/notification`
- `@malva-ui/core/pagination`
- `@malva-ui/core/popup`
- `@malva-ui/core/radio`
- `@malva-ui/core/search-field`
- `@malva-ui/core/select`
- `@malva-ui/core/sidebar`
- `@malva-ui/core/slider`
- `@malva-ui/core/status-indicator`
- `@malva-ui/core/switch`
- `@malva-ui/core/swipe-actions`
- `@malva-ui/core/tabs`
- `@malva-ui/core/tile`
- `@malva-ui/core/title`
- `@malva-ui/core/toast`
- `@malva-ui/core/tokenizer`
- `@malva-ui/core/toolbar`
- `@malva-ui/core/view-variant`
