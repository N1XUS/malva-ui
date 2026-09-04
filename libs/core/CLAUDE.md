---

# Library: core

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including packaging, secondary entry points, public imports, dependency wiring, documentation, or build behavior.

## Overview

`@malva-ui/core` is the grouped public package for all Malva UI components (including form controls, previously in `@malva-ui/forms`). It exposes secondary entry points such as:

- `@malva-ui/core/accordion`
- `@malva-ui/core/action-bar`
- `@malva-ui/core/autocomplete`
- `@malva-ui/core/avatar`
- `@malva-ui/core/badge`
- `@malva-ui/core/button`
- `@malva-ui/core/calendar`
- `@malva-ui/core/card`
- `@malva-ui/core/checkbox`
- `@malva-ui/core/chip`
- `@malva-ui/core/color-picker`
- `@malva-ui/core/combobox`
- `@malva-ui/core/compare`
- `@malva-ui/core/copy-to-clipboard`
- `@malva-ui/core/data-table`
- `@malva-ui/core/day-picker`
- `@malva-ui/core/dialog`
- `@malva-ui/core/drawer`
- `@malva-ui/core/dropdown`
- `@malva-ui/core/filter`
- `@malva-ui/core/expand`
- `@malva-ui/core/form`
- `@malva-ui/core/form-utils`
- `@malva-ui/core/icon-toggle`
- `@malva-ui/core/input`
- `@malva-ui/core/layout`
- `@malva-ui/core/link`
- `@malva-ui/core/list`
- `@malva-ui/core/loader`
- `@malva-ui/core/notification`
- `@malva-ui/core/page`
- `@malva-ui/core/pagination`
- `@malva-ui/core/popup`
- `@malva-ui/core/radio`
- `@malva-ui/core/search-field`
- `@malva-ui/core/segmented`
- `@malva-ui/core/select`
- `@malva-ui/core/sidebar`
- `@malva-ui/core/slider`
- `@malva-ui/core/speed-dial`
- `@malva-ui/core/status-indicator`
- `@malva-ui/core/switch`
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
- All exports from `@malva-ui/core/autocomplete`
- All exports from `@malva-ui/core/avatar`
- All exports from `@malva-ui/core/badge`
- All exports from `@malva-ui/core/button`
- All exports from `@malva-ui/core/calendar`
- All exports from `@malva-ui/core/card`
- All exports from `@malva-ui/core/checkbox`
- All exports from `@malva-ui/core/chip`
- All exports from `@malva-ui/core/combobox`
- All exports from `@malva-ui/core/compare`
- All exports from `@malva-ui/core/copy-to-clipboard`
- All exports from `@malva-ui/core/data-table`
- All exports from `@malva-ui/core/day-picker`
- All exports from `@malva-ui/core/dialog`
- All exports from `@malva-ui/core/drawer`
- All exports from `@malva-ui/core/dropdown`
- All exports from `@malva-ui/core/filter`
- All exports from `@malva-ui/core/expand`
- All exports from `@malva-ui/core/form`
- All exports from `@malva-ui/core/form-utils`
- All exports from `@malva-ui/core/icon-toggle`
- All exports from `@malva-ui/core/input`
- All exports from `@malva-ui/core/layout`
- All exports from `@malva-ui/core/link`
- All exports from `@malva-ui/core/list`
- All exports from `@malva-ui/core/loader`
- All exports from `@malva-ui/core/notification`
- All exports from `@malva-ui/core/page`
- All exports from `@malva-ui/core/pagination`
- All exports from `@malva-ui/core/popup`
- All exports from `@malva-ui/core/radio`
- All exports from `@malva-ui/core/search-field`
- All exports from `@malva-ui/core/segmented`
- All exports from `@malva-ui/core/select`
- All exports from `@malva-ui/core/sidebar`
- All exports from `@malva-ui/core/slider`
- All exports from `@malva-ui/core/speed-dial`
- All exports from `@malva-ui/core/status-indicator`
- All exports from `@malva-ui/core/switch`
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
- Production builds use Angular partial compilation so secondary entry points
  remain linkable and the package is safe to distribute to applications.
- The source package manifest uses release placeholders for its own version and
  root-managed peer versions. Nx Release versions only the workspace root;
  `scripts/publish.mjs` resolves the built manifest from that root before npm
  publication.
- The editor is **not** part of this package. It ships separately as
  `@malva-ui/editor`, which peer-depends on `@malva-ui/core`, and every
  `@tiptap/*` peer moved with it. Core therefore declares no Tiptap peers at
  all and no `peerDependenciesMeta` block: a consumer who never installs the
  editor never sees them.

## Server rendering (SSR)

`libs/core/src/ssr-smoke.spec.ts` is the SSR gate for the whole package. It runs
under `yarn nx run core:test`.

- **Primary assertions are the two error channels, not the markup.** Angular
  does not use one channel, so neither does `renderHost()`:
  - **`ErrorHandler`** — an exception thrown inside an `effect` is routed there
    and rendering continues, so a component that reaches a browser global still
    emits perfect markup. An installed `ErrorHandler` collects everything and
    the suite fails on a non-empty list.
  - **`console.error`** — an unknown _property binding_ never reaches the
    `ErrorHandler` at all: `reportUnknownPropertyError` writes NG0303 straight
    to `console.error` unless `shouldThrowErrorOnUnknownProperty` is set, and
    that flag is `TestBed`'s `errorOnUnknownProperties`, not something
    `renderApplication` turns on. `renderHost()` swaps `console.error` for the
    duration of each render, and the spec fails on any captured line. This
    channel was added for issue #124, where `MlvCheckbox`'s `[indeterminate]`
    logged one NG0303 per rendered instance while the checkbox was already
    written into a host template and the suite was green.
- Secondary assertions: every host rendered _content_ between its own tags (the
  root tag itself comes from the `document` string, so it proves nothing), the
  indeterminate checkbox emitted `aria-checked="mixed"` (the visible half of
  #124 — an attribute binding, so unlike the property binding beside it, it
  does survive the server render), no `cdk-overlay-*` in the payload, and no
  `NaN` anywhere in it (a viewport measured during construction serialises as
  `NaNpx` without ever throwing).
- **Property bindings that the server DOM cannot satisfy** are a class of their
  own: the check is `'<prop>' in element`, so anything domino's DOM lacks fails
  there and passes in every browser test. `mapPropName` rescues `class`, `for`,
  `formaction`, `innerHtml`, `readonly` and `tabindex`; a property domino's DOM
  does not implement (`indeterminate` is the known case) has nothing to rescue
  it. The test is `'<prop>' in element` against domino's classes, not a
  browser's. Write those from an `afterRenderEffect` instead of binding them,
  or bind the attribute form where the property mirrors a content attribute
  (`[attr.selected]`, `[attr.muted]`).
- **Eight hosts**, one `SSR_HOSTS` entry each: form controls, pickers,
  navigation, shell, surfaces, data, display, and a drawer-sections host that
  provides `MlvDrawerSectionsService` itself. The split is for readability only
  — every host renders through the same error-collecting path.
- Bootstrap providers: `provideMlvI18nTesting()` (every `MLV_*_I18N` token is a
  bare `InjectionToken` with no factory), `provideRouter([])` (`mlv-bottom-nav`
  injects `Router` non-optionally) and `provideLucideIcons(...)` for the
  dynamic-icon names the hosts use. `mlv-dropdown-panel` needs a host-level
  `MlvSelectionService`; `mlv-toast-item` / `mlv-notification-item` need a
  host-level `MLV_TOAST_CLOSE`.

### Coverage guard — what to do when you add a component

- The expected set is **generated, never hand-listed**: `readPublicComponents()`
  walks `libs/core/*/src/index.ts`, follows `export * from` chains, and collects
  every class with a `@Component` decorator plus its selector. A new component
  therefore joins the expected set the moment its barrel exports it.
- That parse is itself guarded. A decorator shape the pattern fails to match
  drops the component out of the required set **silently** — the exact failure
  this suite exists to prevent — so `parses every @Component declaration the
barrels reach` re-finds every `@Component(` with an independent,
  shape-insensitive scan and fails on any the pattern missed.
- The covered set is **read back from the hosts themselves**
  (`readDeclaredHosts()` parses this spec file's source), never from a second
  array of selectors — that array is the hand-maintained list that rots. A
  component counts as covered only when **both** hold, scoped to the **same**
  host: its selector is written into that host's template, and its class is
  listed in that host's `imports`.
- Template text is the primary signal, and beats the rendered markup:
  `mlv-tab` is a `display: none` def node that `mlv-tab-group` never projects,
  so it constructs on the server (and can fail there) while never reaching the
  payload.
- The `imports` half closes the mirror-image hole: a tag whose class is missing
  from that host's `imports` is an unknown element — Angular logs `NG0304`,
  constructs nothing and reaches no `ErrorHandler`, so the tag alone would buy
  coverage on paper and none in fact. Scoping matters: a class imported by host
  A must not cover a tag written in host B.
- **To keep the suite green after adding a component:** write its selector into
  one of the host templates with its required inputs actually bound **and** add
  its class to that host's `imports`, or add it to `SSR_COVERAGE_EXCLUSIONS`
  with a one-line reason. An empty tag proves nothing.
- Exclusions are checked, not trusted: the suite fails on an entry naming a
  component that no longer exists, on an empty reason, and on an entry for a
  component a host does render.
- Current exclusions (both overlay-only — they never server-render at all):
  `MlvDialog`, `MlvDialogHeader` (need `DIALOG_CONFIG` from
  `MlvDialogService.open()`). `MlvDrawerSection` / `MlvDrawerSections` are
  **not** excluded any more: they render in their own host that provides
  `MlvDrawerSectionsService` itself, since the directive and the navigator
  inject the service, not `mlv-drawer`.
- Directives are out of scope **as a list**: most public directives are
  template-slot markers that only `inject(TemplateRef)`. Behavioural ones ride
  along on the elements they decorate inside the hosts.
- Every path the guard reads is resolved from
  `dirname(fileURLToPath(import.meta.url))`. `@nx/vitest:test` runs with
  cwd = workspace root while the inferred `vite:test` runs from the project
  root, so `process.cwd()` is not usable here.

### Writing SSR-safe components

- Never bind a **DOM property domino does not implement** in a template
  (`input.indeterminate` is the known case). The unknown-property check is
  `'<prop>' in element` against domino's classes, not a browser's, so a
  property that exists in every browser can still fail there; `muted` and
  `selected`, by contrast, are content attributes and take `[attr.muted]` /
  `[attr.selected]`. Where domino lacks the property every server render logs
  NG0303 per instance, and the binding buys nothing there anyway — a DOM
  property cannot serialise into markup. Write the property from an
  `afterRenderEffect` reading the input
  signal: browser-only by construction, and it still tracks later changes,
  which a one-shot `afterNextRender` would not. `MlvCheckbox` is the reference
  case.

  **`afterRenderEffect` is the right answer when the property belongs to one
  element per component instance**, as `input.indeterminate` does. Each sequence
  joins an app-wide set that `AfterRenderImpl.execute()` walks once per phase on
  every `ApplicationRef.tick()`, dirty or not — unlike the template binding it
  replaces, which cost nothing while its `OnPush` view was clean. One per
  checkbox is negligible; one per `<option>` inside a `<select>` is not. For a
  repeated child element, prefer a cheaper route: set the parent property once
  (`select.value`), or use the attribute form where one exists. Pick per case
  rather than applying this rule mechanically.

- Prefer **`afterNextRender` / `afterRenderEffect`** for anything that measures,
  paints, or observes. Neither runs on the server, so the hook doubles as the
  guard and removes the failure class instead of guarding each call site. A
  `setTimeout(0)` does **not** — it fires on the server too, after the render
  has finished, where the throw is uncatchable.
- Use `isPlatformBrowser` when the value itself is a browser measurement that
  must not be published on the server (`window.innerHeight`), and leave the
  derived signal `null` there so no attribute or style is emitted at all.
- `MlvResizeObserverService` already returns `null` without the global, so
  subscribing to it during construction is safe.

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
- **aria selection models are always arrays (`value: V[]`)** — even for single-select, where the array holds at most one entry. Signal-form controls bridge their public scalar/multi value shape with `toAriaValues` / `fromAriaValues` from `@malva-ui/core/form-utils`.
- **aria pattern defaults differ from the CDK equivalents** and must be pinned to preserve behavior. For listbox: `selectionMode` defaults to `follow` (aria) vs. explicit-only selection (CdkListbox) — pin `selectionMode="explicit"`; `softDisabled` defaults to `true` (focusable-but-inert) vs. skip-disabled (CdkListbox) — pin `[softDisabled]="false"`. These knobs are re-exposed as inputs on the Malva UI wrapper so consumers (and the shared `mlv-dropdown-panel`) can pin them. NB: a host directive's exposed inputs **cannot** be set from the wrapper directive's own `host` bindings — they must be bound where the wrapper element is used (e.g. `mlv-dropdown-panel`'s template).
- **aria pointer selection resolves the target via `closest('[role="option"]')`** (and equivalent per-pattern roles). Because `mlv-list-item` binds `[attr.role]="itemRole()"` (default `listitem`), selectable option rows must set `itemRole="option"` (and the container `listRole="listbox"`) for click selection to work. The shared `mlv-dropdown-panel` sets both automatically.
- **Not every pattern fits — some components keep their manual implementation.** `mlv-menu` does **not** adopt the aria `ngMenu*` primitives: its items are consumer-content-projected while the panel is a detached CDK-overlay `TemplatePortal`, so no single element can be the aria `Menu`'s DI parent, keyboard/focus host, and DOM-order observer at once. It keeps the custom `FocusKeyManager` + CDK-overlay implementation and adds aria-parity type-ahead via `FocusKeyManager.withTypeAhead()`. See `libs-menu.md` for the full analysis.

## Dependencies

### Angular / third-party peers

- `@angular/aria`
- `@angular/cdk`
- `@angular/common`
- `@angular/core`
- `@angular/forms`
- `@angular/router`
- `@lucide/angular`
- `@tiptap/core` (optional)
- `@tiptap/extension-file-handler` (optional)
- `@tiptap/extension-highlight` (optional)
- `@tiptap/extension-image` (optional)
- `@tiptap/extension-list` (optional)
- `@tiptap/extension-table` (optional)
- `@tiptap/extension-text-align` (optional)
- `@tiptap/extension-text-style` (optional)
- `@tiptap/extensions` (optional)
- `@tiptap/markdown` (optional)
- `@tiptap/pm` (optional)
- `@tiptap/starter-kit` (optional)
- `lodash-es`
- `rxjs`

### Internal package dependencies

- `@malva-ui/core/accordion`
- `@malva-ui/core/action-bar`
- `@malva-ui/core/autocomplete`
- `@malva-ui/core/avatar`
- `@malva-ui/core/badge`
- `@malva-ui/core/button`
- `@malva-ui/core/calendar`
- `@malva-ui/core/card`
- `@malva-ui/core/checkbox`
- `@malva-ui/core/chip`
- `@malva-ui/core/color-picker`
- `@malva-ui/core/combobox`
- `@malva-ui/core/compare`
- `@malva-ui/core/copy-to-clipboard`
- `@malva-ui/core/data-table`
- `@malva-ui/core/day-picker`
- `@malva-ui/core/dialog`
- `@malva-ui/core/drawer`
- `@malva-ui/core/dropdown`
- `@malva-ui/core/filter`
- `@malva-ui/core/expand`
- `@malva-ui/core/form`
- `@malva-ui/core/form-utils`
- `@malva-ui/core/icon-toggle`
- `@malva-ui/core/input`
- `@malva-ui/core/layout`
- `@malva-ui/core/link`
- `@malva-ui/core/list`
- `@malva-ui/core/loader`
- `@malva-ui/core/notification`
- `@malva-ui/core/page`
- `@malva-ui/core/pagination`
- `@malva-ui/core/popup`
- `@malva-ui/core/radio`
- `@malva-ui/core/search-field`
- `@malva-ui/core/segmented`
- `@malva-ui/core/select`
- `@malva-ui/core/sidebar`
- `@malva-ui/core/slider`
- `@malva-ui/core/speed-dial`
- `@malva-ui/core/status-indicator`
- `@malva-ui/core/switch`
- `@malva-ui/core/tabs`
- `@malva-ui/core/tile`
- `@malva-ui/core/title`
- `@malva-ui/core/toast`
- `@malva-ui/core/tokenizer`
- `@malva-ui/core/toolbar`
- `@malva-ui/core/view-variant`
