---
# Application: docs

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this application, including routes, shared components, examples, docs shell behavior, styling, build configuration, or architecture. Per-page documentation lives in `.claude/projects/page-{name}.md` files.

---

## 1. Overview

The `docs` application is the documentation and showcase site for the **Malva UI** Angular component library. Every library component has a dedicated page that:

- Displays a human-readable description of the component.
- Renders numbered live-preview examples inside a tabbed container.
- Shows syntax-highlighted source code (TypeScript, HTML, SCSS) for each example using Shiki.
- Renders optional Markdown/MDX documentation blocks above each example.

The app is built using the library's own components, making it a dogfood showcase.

Docs examples should prefer the grouped public package surface:

- `@malva-ui/cdk/*` for infrastructure exports such as accessibility, density, and shared utilities
- `@malva-ui/core/*` for all UI components including form controls
- `@malva-ui/core/*` for all other component families

Every form-control page ends with a **Signal forms** example that binds the
control through `[formField]` from `@angular/forms/signals`. These examples
show the live field value/touched state and complement the existing reactive
and template-driven examples; all three binding modes remain supported.

---

## 2. Technology Stack

| Concern             | Technology / Version                                        |
| ------------------- | ----------------------------------------------------------- |
| Framework           | Angular 22.0.7                                              |
| Language            | TypeScript 6.0.3                                            |
| Build executor      | `@nx/angular:application` (esbuild-based, with MDX plugin)  |
| Dev server          | `@nx/angular:dev-server`                                    |
| Testing             | Vitest 4.1.10 via `@analogjs/vitest-angular` 2.6.3          |
| Monorepo tooling    | Nx 23.1.0                                                   |
| Syntax highlighting | Shiki ^4.0.2                                                |
| Markdown parsing    | marked ^17.0.5 (build-time only via esbuild plugin)         |
| Frontmatter         | gray-matter ^4.0.3 (build-time only)                        |
| Icons               | `@lucide/angular` ^1.25.0                                   |
| Country flags       | `flag-icons` ^7.5.0, scoped to the fourteen shipped locales |
| Utilities           | lodash-es ^4.17.23, uuid ^13.0.0                            |
| Animations          | Angular async animations (`provideAnimationsAsync`)         |
| State               | Angular signals                                             |
| Change detection    | `ChangeDetectionStrategy.OnPush` throughout                 |

---

## 3. Project Structure

```
apps/docs/
  src/
    main.ts                      # Application bootstrap
    styles.scss                  # Global styles (imports theme + animations)
    app/
      app.config.ts              # ApplicationConfig (router, animations providers)
      app.routes.ts              # All top-level routes (lazy-loaded)
      app.ts                     # Minimal root component containing the top-level router-outlet
      pages/                     # One sub-directory per route/component page
        Each page directory has:
          index.ts               # The page component (single file — no barrel)
          examples/
            1/index.ts           # Example component (default export)
            1/index.html         # Example template (optional)
            1/index.scss         # Example styles (optional)
            1/index.mdx          # Optional Markdown documentation for the example
            2/, 3/, ...
        getting-started/         # Custom installation guide (no API tab/examples)
      shared/
        index.ts
        docs-shell/
          docs-shell.ts          # Sidebar shell for all non-home routes
          docs-shell.html        # MlvLayout, navigation, nested router-outlet, and ToC
          docs-shell.scss        # Shell-specific layout styles
          docs-shell.spec.ts     # Sidebar and navigation-focus behavior
        docs-app-bar/
          docs-app-bar.ts        # Shared header for home, docs, and showcases
          docs-app-bar.html      # Brand, primary navigation, and global controls
          docs-app-bar.scss      # Responsive app-bar and skip-link styling
          docs-app-bar.spec.ts   # Route-active and semantic-header contract
          docs-app-bar-preferences.ts # Theme, density, direction, and locale controls
          docs-app-bar-preferences.html # Responsive display-preferences popup
          docs-app-bar-preferences.scss # Popup-specific BEM styles and flags
          docs-app-bar-preferences.spec.ts # Locale rollback and popup contract
          docs-locale.service.ts # Route-shared selected locale state
          docs-locales.ts        # Typed locale metadata, lazy loaders, and select transform
          docs-locales.spec.ts   # Native language-name and flag-code contract
        api-viewer/
          api.types.ts           # ApiEntry/ApiSymbol/ApiMember/ApiMethod contract (Phase D→E)
          index.ts               # Barrel export
        doc-page/
          doc-page.component.ts  # DocPageComponent
          index.ts
        example-container/
          example-container.component.ts  # ExampleContainerComponent
          example-controls.ts             # ExampleControlsComponent — the per-example switcher bar
          example-scope.ts                # DocsExampleScopeDirective — scopes density / dir / theme
          copy-source.ts                  # CopySourceComponent — the hover-revealed copy button
          index.ts
        playground/
          open-in-playground.ts    # OpenInPlaygroundComponent (docs-open-in-playground)
          playground-project.ts    # createPlaygroundProject() — pure payload builder
          playground-submit.ts     # StackBlitz POST /run form hand-off
          index.ts                 # Barrel export
        toc/
          toc.component.ts       # DocsTableOfContentsComponent
          toc.component.html     # ToC template
          toc.component.scss     # Sticky sidebar styles
          toc.service.ts         # DocsTocService
          toc.types.ts           # TocEntry, MdxEntry, MdxFrontmatter interfaces
          index.ts               # Barrel export
        component-pipe.ts        # ComponentPipe
        example-pipe.ts          # ExamplePipe
        documentation.pipe.ts    # DocsDocumentationPipe
        highlight.pipe.ts        # HighlightPipe
      showcases/                 # Full-size product-composition route tree
        showcase.types.ts        # ShowcaseCategory and public catalog contract
        showcase.registry.ts     # Catalog, child routes, and component lookup
        showcase-shell/          # Shared app bar + child router outlet shell
        showcase-loading/        # Stable lazy-route loading content
        showcase-index/          # URL-filtered showcase catalog
        pages/                   # One lazy route component per showcase slug
  plugins/
    mdx-transform.ts             # esbuild plugin for build-time MDX processing
  tools/
    api-extractor.ts             # ts-morph API extraction core (pure, unit-tested)
    extract-api.ts               # docs:extract-api CLI entry (writes src/generated/api/**)
    extract-api.spec.ts          # Vitest spec for the extractor
    generated-output.ts          # In-place writer for src/generated/api (never removes the dir)
    generated-output.spec.ts     # Vitest spec for the writer
    playground-manifest.ts       # Resolves playground versions/peers from the ROOT package.json
    generate-playground-versions.ts  # docs:generate-playground-versions CLI
    playground-corpus.ts         # Reads docs examples off disk (shared: sweep + writer)
    playground-corpus.spec.ts    # Sweeps all 474 examples through the payload builder
    write-playground-project.ts  # docs:write-playground-project CLI (materialises one to disk)
                                 #   --allow-unpublished for the networked CI legs
  src/generated/                 # GIT-IGNORED — produced by docs:extract-api / :generate-playground-versions
    api/
      <name>.json                # One ApiEntry per documented library
      index.ts                   # Generated lazy-loader module map (apiEntryLoaders)
  public/                        # Static assets
    showcases/README.md          # Route-derived preview capture contract
  project.json                   # Nx project configuration
  vite.config.mts                # Vitest configuration
```

**Key rules:**

- Each page directory contains `index.ts` directly — no barrel re-export.
- The home page (`home/home.ts`) predates this pattern.
- Page metadata belongs in the typed route manifest; implementation-specific
  guidance stays close to the page code instead of being duplicated in a
  second per-page documentation index.

---

## 4. Routes

`apps/docs/src/app/app.routes.ts` is the single source of truth for component
pages. Its typed `docsPages` manifest derives lazy routes, browser titles,
public API extraction targets, and the sidebar. Each page retains its own typed
Lucide icon key rather than inheriting its group's icon. `docsNavigationGroups`
derives the grouped, alphabetically sorted navigation from the same manifest.
Never maintain a second hand-written route or sidebar list.

The root landing page and Getting Started guide are registered separately.
Unknown URLs render the dedicated not-found page inside the documentation
shell. Reference pages may opt out of an API tab by setting their manifest API
target to `null`.

### Showcase routes

`/showcases` is a separate lazy route tree, outside the `DocsShellComponent`
children. `apps/docs/src/app/showcases/showcase.registry.ts` is its single
source of truth: it defines the catalog cards, lazy child routes, canonical
component inventories, and route-preview asset paths. The registered routes
are:

- `/showcases` — the catalog
- `/showcases/project-workspace`
- `/showcases/support-inbox`
- `/showcases/publishing-workspace`
- `/showcases/data-operations`
- `/showcases/settings-access`
- `/showcases/website-builder`
- `/showcases/data-at-scale`

The catalog filter is URL-backed as `?category=`. Valid values are `all`,
`workspaces`, `communication`, `data`, `content`, and `settings`; a missing or
invalid value resolves to `all`. Category links merge query parameters and use
history replacement, so filtering remains linkable without growing browser
history for each filter choice.

---

## 5. Page Conventions

Component reference pages follow an identical structure. Each page component:

- Imports `DocPageComponent` from `../../shared/doc-page`.
- Declares a `meta: DocPageMeta` object with `title` and `description`.
- Declares an `exampleArray` (or `examples`) array: `new Array(N).fill(0).map((_, i) => i + 1)`.
- Renders `<docs-page [meta]="meta" [examples]="exampleArray" header="<kebab-name>" />`.
- Uses `ChangeDetectionStrategy.OnPush`.

The `header` input determines which `pages/<header>/examples/<n>/` subdirectory the pipes load from.

Each example component uses `export default class` (required for `ComponentPipe` dynamic import).

The Table page (`/table`) demonstrates the native `@malva-ui/core/table`
primitive across basic, bordered/hoverable, responsive, Pop In, and density
variants. Keep it separate from the feature-rich Data Table page so the native
markup and the data-grid API remain easy to compare.

The Date Adapter page (`/date`, icon `calendar`, label override `Date Adapter`,
Utilities group) is a prose-only reference for `@malva-ui/core/date` — no
examples, so `examples` is `[]` and the shell renders the API tab beside the
narrative. It exists because the API tab is built from a page's library barrel:
when the adapter moved out of `@malva-ui/core/calendar` in 2026-09 its six
symbols left `calendar.json` and, with no page mapping to `libs/core/date`, left
the site entirely. `apiFor()` defaults an unlisted page to
`{ family: 'core', entry: <page> }`, so the route alone regenerates `date.json`.
Note that `provideMlvDateAdapter` does not appear on the API tab: the extractor
classifies classes, interfaces, types, enums and `InjectionToken` variables, not
plain functions (no `provide*` helper appears in any generated entry), so the
page documents its signature in prose.

The Scheduler page (`/scheduler`, icon `calendar-days`, API family `scheduler`,
Data display group) documents the standalone `@malva-ui/scheduler` package in
eight examples: views + model binding, all-day / multi-day events,
drag / resize / vetoes, a custom chip template + colours, working hours / slots /
hidden days, a custom header + external drop from a SortableJS list, range
selection + density, and context menus (`*mlvSchedulerSlotMenuDef` creating an
event for the cell / slot / pending selection, `*mlvSchedulerEventMenuDef` with
rename / duplicate / a `MlvDialogService.confirm()`-guarded delete). Every example gives `mlv-scheduler` an explicit
`block-size`, because the month view measures its lanes against the height it is
given. The custom-chip example narrows its typed `data` payload in a component
method: the `mlvSchedulerEventDef` directive has no inputs, so a template's
context always resolves to `MlvSchedulerEventContext<Date, unknown>` — the
`$implicit` it carries is an `MlvSchedulerEvent`, and **both** type parameters
fall back to their defaults, so `D` silently reads as `Date` on a custom
adapter. Its seeds, like every other scheduler example's, are anchored to the
start of the current week rather than to `today + n`, so nothing falls outside
the pinned week view late in the week.

Examples that mutate `MlvDensityService` provide the service in their own component
decorator. This gives each preview an isolated density scope and prevents its
controls from changing the documentation shell's global density.

The Filter page's fourth example demonstrates the `MlvSmartFilterBar`
`appearance="query"` presentation: natural-language chips, the built-in Add
filter flow, both explicit and live field-apply modes, the grouped
expression included alongside the compatible flat execution payload, and a
keyed `mlvFilterValueEditor` day-picker value editor for the renewal-date
field. The Data
Table page's twenty-second example demonstrates in-memory durable
presentation capture, a focused renewal-review mutation, application, and
reset through `getPresentationState()` / `applyPresentationState()`. Neither
example owns saved-view names, permissions, dirty state, or persistence; the
composed experience remains at `/showcases/data-operations`.

**The header title slot holds the title and nothing else.** `[mlvPageTitle]` is
a template the header instantiates **twice**, once per type role, so anything
with identity or state declared inside it exists twice: an `id` collides (and
the header warns in dev), a `tabindex` gives `focusTitle()` two candidates one
of which is `inert`, an `ng-template[mlvDialog]` opens two dialogs, and a
control registers itself twice. The four showcases that used to put their
sidebar trigger inline with the `<h1>` (`data-operations`, `data-at-scale`,
`project-workspace`, `publishing-workspace`) now project it into
`[mlvPageContext]`, which is an element region rendered once and is where a
leading nav affordance belongs; `data-operations` additionally moved its two
saved-view dialog templates out of the header entirely. Their
`__title-row` styles are gone with them — `mlv-page-header` lays the context
region out and resets projected headings itself.

The Data Operations showcase deliberately keeps only account fixtures,
URL-backed saved-view state, simulated persistence, and account-specific
rendering/actions in the route. Its responsive navigation is one flat
`MlvSidebar`, account details use one `MlvPageEndPaneContent` instance across
breakpoints, and the single `MlvDataTable` owns Search, Sort, Columns, and its
toolbar; Export is projected through `MlvDataTableToolbarActions`. Query-filter
conversion and evaluation use the public filter utilities. Do not add
route-local responsive overlays, table controls, or generic filter evaluators
back to this showcase. Its Dialog options pass
`viewsSidebarTrigger.restoreFocusResolver` declaratively so a modal that stays
open across either responsive breakpoint direction restores at disposal to the
currently appropriate connected target; route TypeScript owns no focus logic.

The Support Inbox showcase (`/showcases/support-inbox`) is a three-column
helpdesk: a **dark** navigation rail, the conversation list, the thread, and a
toggleable details panel. Its fixtures live in `support-inbox.data.ts` — twelve
`SupportTicket` records, each carrying requester, account, SLA clocks,
environment, linked records, satisfaction, activity, internal notes, and a
written `MlvChatMessageData` thread — plus five `SupportAgentProfile`
teammates and `CURRENT_AGENT`. Keep new fixture fields in that file; the route
component owns only view state and the mutating actions.

- **Mobile first.** The stylesheet has no `max-width` queries: the unwrapped
  rules **are** the sm layout, and `bp.breakpoint-up(md)` / `(lg)` from
  `libs/styles/src/lib/breakpoints.scss` add the wider tiers. Only three tiers
  exist (sm 0 / md 768 / lg 1200), and they are the same tiers behind
  `MlvBreakpointService` and `MlvSidebar.collapseBelow`, so CSS and TypeScript
  flip at the same pixel. Intra-tier fluidity comes from `clamp()`/`minmax()` on
  the grid tracks — never a fourth breakpoint.
- **Panes.** sm shows one pane. A `pane` signal (`'list' | 'thread'`) drives
  `--pane-list` / `--pane-thread` on the host and CSS `display: none` hides the
  other. `display: none` rather than `@if` keeps the `mlv-list[selectable]`
  roving tabindex, stops `mlv-chat` replaying its enter animation, and removes
  the hidden pane from the tab order and the a11y tree without needing `inert`.
  `_showPane()` announces the swap through `LiveAnnouncer` and re-homes focus —
  to the back button going in, to the still-selected row coming back.
- **`collapsed` is derived, not seeded.** `mode="fixed"` at lg expands the
  sidebar _box_, but the projected content still follows `collapsed` — a
  hard-coded `true` renders an icon-only rail inside a 16.5rem column.
  `railCollapsed = computed(() => !isWide())` with a one-way binding fixes that
  and removes the two-writer race with the library's own responsive effect.
- **`closeOnActivation` is deliberately not used** — it closes on _any_ button
  inside the rail, so expanding a nav group or opening the workspace switcher
  would dismiss it. `selectView()` closes the drawer explicitly instead.
- **Details is one `mlv-page-end-pane`** with `collapseBelow="lg"`: a drawer
  below lg, an in-flow column at lg, from a single `ng-template` with one focus
  lifecycle. Sections are ordered decision-first (service level → account →
  internal notes → …) at every tier rather than cut per tier.
- **Dark rail.** The rail is `<mlv-sidebar mlvTheme="dark">`, which scopes the
  theme token block (surface, text, hover, active pill, rail line, and the muted
  tint ramp behind every `mlv-sidebar-item` badge). There is no
  `--mlv-sidebar-background`; the surface is pinned through
  `--mlv-palette-neutral-900`, dropping to `-950` when the whole docs app is
  dark so the seam against the canvas survives. Do not replace this with a
  hard-coded colour set. The theme scope also sits on an inner
  `.support-inbox__rail-surface` wrapper: in offcanvas mode the sidebar body is
  portalled into the CDK overlay container where the host is no longer an
  ancestor, so a top-level `::ng-deep` rule keyed on that wrapper paints the
  drawer panel. The in-flow rule is scoped `:not(.mlv-sidebar--offcanvas)` so
  the 0-width offcanvas host stops painting a stray hairline.
- **Rail groups.** `MlvSidebarGroup.expanded` is a plain writable signal, not an
  input, so the first two groups are opened from an `afterNextRender` over a
  `viewChildren(MlvSidebarGroup)` query rather than a template binding.
- **Chat `selfId`** is the _conversation's assignee_, not the signed-in agent,
  so a teammate's replies still render on the agent side of a shared inbox.
- **Layout.** Every column is a grid item whose track is `minmax(0, 1fr)` with
  `min-inline-size: 0`; without those the header and chat expand to their
  min-content width and overflow the column. At exactly 1200px the list floor
  decides the thread's width, so the lg track set is
  `clamp(16rem, 20vw, 21.5rem) minmax(22rem, 1fr) auto` — a 17rem list floor
  leaves the thread at 344px and misses the 22rem readability floor.
- **QA.** A layout audit harness lives outside the repo (scratchpad
  `support-inbox-layout-audit.js` plus `support-inbox-qa-checklist.md`): pasted
  into the console it returns a pass/fail verdict covering horizontal overflow,
  collapsed panes, in-flow overlap, 44px touch targets and silently clipped
  text. Note that the in-app browser pane resizes the viewport **without**
  firing `resize` or `matchMedia` change events, so tier changes must be
  verified per page load rather than by resizing.
- Selection, unread clearing, rail views, search, the status segmented filter,
  sorting, assignment, status/priority changes, reply sending, and internal
  notes are all genuinely wired. `support-inbox.spec.ts` covers them plus an
  axe pass with and without the details panel.

The Settings & Access showcase (`/showcases/settings-access`) is the
"Access Desk": a **light** settings rail, a form canvas, a sticky
`[mlvPageAside]` change-review column, and a sticky `mlv-page-dock`. Its
fixtures live in `settings-access.data.ts` — `Access*`-prefixed types, twelve
`AccessMember` records, five roles, three invitations, six sessions, two API
keys, three webhooks, a 6×3 notification matrix and a twenty-row sign-in log —
plus the seeded constants that make every failure path deterministic
(`SOLE_OWNER_MEMBER_ID`, `BOUNCED_INVITE_EMAILS`, `CURRENT_SESSION_ID`,
`REVOKE_FAILS_SESSION_ID`, `ROTATION_FAILS_KEY_ID`, `TAKEN_SLUGS`,
`STEP_UP_CODE`). Never `Math.random()`; the summary-strip numbers are all
computed from those fixtures, so changing a count changes the strip.

- **Stage → review → save.** `_draft` is a **single root-level signal** for the
  whole page and `staged()` is a pure `computed()` over a field registry —
  never a second source of truth. Sections and tabs read slices of it, so
  staged changes survive navigation. The dock is the **only** save affordance:
  no `[mlvFormActions]`, no per-fieldset save buttons.
- **Nav groups.** `MlvSidebarGroup.expanded` is a plain writable signal and the
  sidebar _holds it at `false` while the rail is collapsed_. The rail starts
  collapsed until the media query resolves, so the `afterNextRender` idiom that
  works in support-inbox lands too early here, is discarded, and — because the
  group bodies are lazy — the nav renders with **zero rows in the DOM**. Open
  the groups from an `effect` that waits for the rail to actually be expanded,
  once, so a manual collapse still sticks.
- **The shell must own a height.** `mlv-page-shell` is `display: flex;
overflow: hidden` with no height of its own, and `.mlv-page-shell__sidebar`
  (2 classes) outranks `.mlv-sidebar--full-height` (1 class). Left alone the
  rail collapses to ~134px, `.mlv-page__scrollbar` never becomes a scroll
  container, the _document_ scrolls instead, and every `position: sticky`
  resolves against a frozen scrollport — header, dock and aside all scroll
  away. `settings-access.scss` fixes all three at once by giving the shell
  `block-size: calc(100svh - 6.75rem)` (`dvh` at md+).
- **No two-way control bindings.** The single-`_draft` model means every
  control is `[value]`/`[checked]` plus a change handler calling `stage(id, …)`.
  `mlv-select` takes `values` + `[toOption]` so the draft stays string-keyed.
  Validation is `[state]` + `[message]`; `mlv-form-field` is used nowhere.
- **Self-intercepting controls need an echo.** `mlv-switch` writes its own
  `checked` model on click, so refusing the write leaves the native property
  and `aria-checked` lying. `require2faChecked` reads a one-pass echo signal
  cleared in `afterNextRender`, driving the binding `true → false → true`. A
  version signal alone does not work — a computed returning the same boolean
  never reaches `bindingUpdated`.
- **`[stackBelow]` is container-measured, not viewport-measured**, and the
  container width is non-monotonic because the rail leaves the flow at `lg`. It
  is bound to a viewport-watched `(max-width: 1023px)` tier instead of a
  constant.
- Step-up dialogs surface the accepted fixture code as a `hint`; a showcase
  visitor has no authenticator, so without it the confirmation flows dead-end.
- **The roster is one `mlv-data-table`, and it owns every table control.**
  Members & roles → Roster renders `rosterRows()` — a projection of
  `members()` whose `role` is the **staged** role and whose `twoFactorState`
  is the boolean's filterable string form — through six columns: `name`
  (Member), `email`, `role`, `twoFactorState` (Two-factor), `lastActiveAt`
  (Last active) and `actions`. Five of them are `mlvDataTableCell`
  projections: avatar + name button (opens the member drawer), a truncating
  address, the role `mlv-select` with its sole-owner info button or "Unsaved"
  badge, the two-factor `mlv-badge`, the relative last-active label, and the
  `mlvMenuTrigger` row menu. `mlvDataTableNoData` carries the empty state.
  `actions` exists on the row type only because `mlvDataTableCell` types its
  key as `keyof T`; it is pinned right so the row menu survives any horizontal
  scroll.
- **Sort, filter, columns and paging live on the table; search stays in the
  header.** The bespoke roster toolbar is gone — no count badge (the paginator
  reports `1–10 of 12`), no role `mlv-select`, no two-factor `mlv-segmented`,
  and no hand-rolled `visibleMembers()` filter. Role and Two-factor are
  `filterable` columns behind the table's own Filters popup, `showSortMenu`
  adds Sort next to Columns, and the sticky-header `mlv-search-field` keeps
  driving search through `[showSearch]="false"` + `[(searchQuery)]="rosterQuery"`
  so exactly one control and one implementation exist. Filtering runs on the
  **staged** role, as the old filter did, because the row projection carries
  it. `searchable` is read from the _declared_ columns, so search still matches
  the address while the Email column is responsive-hidden.
- **The sole owner's blocked reason is a tooltip, not `[message]`.** The
  68-character sentence used to get a full roster line of its own via a
  `:has(.mlv-message)` rule on the `mlv-list-item` row. A table cell cannot
  take a line of its own, so the roster now keeps `mlv-select`'s
  `[state]="warning"` as the visible signal and hangs the sentence off the
  adjacent info button's `mlvTooltip` (which wires `aria-describedby` on
  hover/focus). Rows stay a uniform 48px. Invitations and sessions are still
  `mlv-list` rows and keep the inline-message rule.
- **Measured widths** (roster table, change-review aside in flow): 1234px at a
  1920px viewport — all six columns, no scroll; 754px at 1440 and 594px at 1280
  — Email (`responsive` ≥ 900) and Last active (≥ 1000) drop out rather than
  cost a scrollbar; 357px at 375 — the table wrapper scrolls, the document
  never does.
- `settings-access.spec.ts` covers the staged spine, the nine flows, the
  blocked and read-only states, the roster table (projected cells, staging
  through the role cell, staged-role filtering, search + the no-data
  template), and runs axe in four states (default section, a tabbed section,
  drawer open, dialog open).

The Website Builder showcase (`/showcases/website-builder`) is a CMS layout
composer: level-1 boxed tabs (All / Homepage / Article / Category / Page), a
read-only breakpoint viewer, a canvas of nested `mlv-tiles` trees, and three
config dialog families. Fixtures live in `website-builder.data.ts` (seed trees
with literal ids, the eleven-block catalog, and every select option set) and
the vocabulary, drop policy and structural maths in
`website-builder.types.ts` — a pure module with no Angular imports, unit-tested
on its own.

- **Every section is its own `mlv-tiles` root tree.** `WbDocument` holds six
  independent trees: `header`, `footer`, and one content section per page type.
  A section is therefore _never_ a tree node — it grows no drag handle, needs
  no `movable` input, and a drag can never cross from the shared header into a
  page's content. The section chrome (icon, title, `Section` badge, enable
  switch, Add container button, empty state) is showcase-owned markup wrapping
  the `<mlv-tiles>`, not a tile.
- **Locked previews are real trees.** On a page-type tab the shared header and
  footer render as `<mlv-tiles [locked]="true">` bound to the same data, not
  hand-rendered summaries. `locked` cascades, so the whole subtree loses its
  handles, close actions, switches and empty prompt, and is excluded from every
  drag session before `accepts` is consulted.
- **One acceptance policy, one export.** `wbAccepts` covers all four depths
  (section→container, container→row, empty row→row _or_ block, populated
  row→homogeneous) and is bound once on each root; nested `mlv-tiles` inherit
  it. It filters the dragged node out of `innerTiles` so re-sorting a row's only
  child is not refused by its own homogeneity rule. Cycle prevention, root
  protection and self-drops stay the library's job.
- **`inactive` is set per node, not cascaded.** The library input deliberately
  does not cascade (opacity would compound to ~0.06 at four levels), so
  `docs-wb-node` derives `!enabled || !ancestorEnabled` itself. A descendant's
  own switch stays operable while an ancestor is off; the `Inherited off`
  marker explains why nothing renders.
- **Grid preview is gated in one place.** `WB_GRID_PREVIEW_ENABLED` plus a
  `MlvResizeObserverService` measurement of the canvas (768px floor) decide
  whether the container's nested `mlv-tiles` becomes a real N-track grid with
  `grid-column: span N` per row. The always-present span meter is the
  accessible source of truth, so switching the gate off degrades to
  full-width rows with no copy or a11y change — the mitigation for SortableJS
  mis-computing drop indices for spanning items.
- **Structural mutation only through the library.** `MlvTile.insertChild()` and
  `MlvTile.remove()` for single-node edits (their writes flow back through the
  root `treeChange`, which is the _only_ place those edits are counted as
  dirty), `insertMlvTileNode` / `updateMlvTileNodeProps` on the root signal when
  one commit must touch several nodes — saving a container clamps every
  overflowing child row in the same write. Ids come from a monotonic counter;
  seed ids are literals.
- **Dialogs hold local drafts.** Three declarative `ng-template[(mlvDialog)]`
  hosts (container / row / block) seeded on open; Cancel discards, Save commits
  once. Per-breakpoint fields live under nested boxed tabs and are keyed by
  breakpoint, never by the active tab. Blocks are breakpoint-agnostic and never
  render those tabs. Validation is `[state]` + `[message]`; `mlv-form-field` is
  used nowhere.
- **Focus is addressed by id.** Header controls are projected into `mlv-tile`
  through `ngTemplateOutlet`, so they land in the tile's view rather than the
  node's — `wbSettingsButtonId()` / `wbAddButtonId()` give stable handles for
  the add/remove/Escape focus moves instead of a view query.
- **Escape-to-top expands the chrome before it focuses.** The level-1 tab strip
  is projected into `mlv-page-header`'s **tabs region, which is deliberately
  not on the snap timeline** — level-1 navigation stays reachable at every
  scroll offset. Expanding first is still what makes the landing right:
  `onEscapeToTop()` calls `MlvPage.snap.expand()` (reached with
  `viewChild(MlvPage)`, since the showcase _hosts_ the page and cannot inject
  the controller, which is not exported anyway), which reveals every collapsed
  region synchronously **and** asks the page to return to the top, so focus
  lands on chrome the reader can see rather than on a tab under a scrolled
  canvas. If the strip is not rendered, focus falls back to
  `MlvPageHeader.focusTitle()` — never a `getElementById`, because the header
  renders `[mlvPageTitle]` **once per type role** and only it knows which copy
  is live; the route's `<h1>` therefore carries no id and no `tabindex` of its
  own. Both landings are visible; focus is never left on `<body>`.
- **Discard confirms like Remove does.** Discard drops every unsaved edit
  across all six trees with no undo, so it routes through the same
  `MlvDialogService.confirm({ tone: 'danger' })` the subtree removal uses — an
  `alertdialog` whose initial focus sits on the safe **Keep editing** choice,
  titled with the pending count (`Discard 3 unsaved changes?`). Cancelling
  leaves the draft byte-identical; `_performDiscard()` holds the restore.
- `website-builder.spec.ts` covers the policy as a pure unit, span clamping,
  row-depth caps, seed integrity, the locked previews, the add and remove
  flows with their focus targets and live-region copy, every dialog's
  conditional fields, the dock including the Discard confirmation (count copy,
  cancel-leaves-changes-intact, confirm-restores), Escape-to-top against a
  collapsed header and its title fallback, and axe on the All tab, a page-type
  tab, the empty states, an emptied section, all three dialogs and the Add
  menu.

The **Data at Scale** showcase (`/showcases/data-at-scale`) is the scaling
evaluation surface for `mlv-data-table`: 100,000–1,000,000 generated rows, a
fake backend in a Web Worker, and three benchmarks measured live in the
visitor's own browser.

- **Backend.** `backend/scale.worker.ts` owns the dataset. `scale-dataset.ts`
  generates rows from a seeded PRNG (`SCALE_SEED`) so a size always produces
  the same data; `scale-engine.ts` runs every sort, filter, search and page
  inside the worker; `scale-protocol.ts` is the shared message contract
  (`init` / `query` / `ready` / `result`, `SCALE_ALL_ROWS`, `isUnpaged`).
  Nothing is committed as a fixture. The worker is constructed through the
  literal `new Worker(new URL('./backend/scale.worker', import.meta.url), { type: 'module' })`
  form the Angular builder's transformer requires — the worker bundle is
  built by a plugin-less esbuild pass, so `@malva-ui/*` path aliases do **not**
  resolve inside it and its imports stay relative. `scale-backend.ts` declares
  the `ScaleBackend` interface plus the `SCALE_BACKEND_FACTORY` token (no
  default and no `provide*` helper — the component injects it
  `{ optional: true }` and falls back to `createScaleBackend()`),
  `scale-worker-backend.ts` builds the worker, and
  `scale-main-thread-backend.ts` is the fallback for a runtime with no `Worker`
  constructor (jsdom, hardened browsers) that the specs inject. The docs app is
  a client-only SPA — no `server`/`ssr`/`prerender` target — so nothing here is
  justified by prerendering.
- **Data source.** `ScaleDataSource` (an `MlvDataSource` subclass) is the only
  bridge: it debounces state onto one in-flight worker query, supersedes stale
  answers by request id, and re-uses the same row object for a given id so
  selection and tree expansion survive a re-query. Mode changes go through
  `switchPageSize()`, which drops the current rows **synchronously** — a paged
  table must never be handed the previous unpaged 100,000-row answer, which is
  what made the virtual → paged switch hang.
- **Failure handling.** A worker can die without answering: killed for
  allocating a million rows, or never loaded at all. `ScaleBackend` therefore
  carries an optional `subscribeError` channel (the worker wires `error` and
  `messageerror`), and `ScaleDataSource` additionally watches every request
  with a timer (`SCALE_REQUEST_TIMEOUT_MS` plus the dialled-in latency). Either
  one clears `loading` and publishes `ScaleDataSource.error`, which the page
  binds to `mlv-data-table`'s `[error]` with `(retry)` wired to a re-query —
  without it a dead worker left a permanent loading overlay.
- **Composition.** Virtual scroll and server-side paging are mutually
  exclusive on `mlv-data-table`, so the page exposes them as a segmented
  control (`effectiveMode()`) rather than pretending they compose. Pinned
  start column (`ref`), optional tree rows (`_mlvChildren` workspaces on about
  a third of the accounts), and saved views through `mlv-view-variant-list` /
  `mlv-view-variant-status` all work in both modes. Above
  `SCALE_MAX_VIRTUAL_ROWS` (≈279,620 = the browser's ~16.7M px scroll-height
  ceiling ÷ `SCALE_ROW_HEIGHT_PX`) the virtual option is disabled and the page
  falls back to paging with an `mlv-alert` explaining why — a taller scroller
  is silently clamped by the browser and renders nothing.
- **Benchmarks** live in `data-at-scale.metrics.ts` as pure functions
  (`measureAfterPaint`, `runScrollBenchmark`, `summarizeFrameTimestamps`) so
  they are unit-testable without a browser. Initial render is
  `postMessage` arrival → the frame that shows the rows; scroll frame rate
  samples `requestAnimationFrame` timestamps over a scripted 2 s scroll;
  filter latency splits the round trip into worker compute, artificial
  latency, transfer, the main-thread row-identity pass (`identifyMs`) and
  render. `transferMs` ends at the arrival of the message and `roundTripMs`
  ends after the identity pass, so no main-thread work falls between two
  published numbers. The scroll benchmark reads the scroller's extent once
  rather than per frame (a per-frame `scrollHeight` read is a forced layout
  inside the interval it publishes), refuses to run under
  `prefers-reduced-motion`, and takes an `AbortSignal` the component aborts on
  destroy. Every readout is machine-dependent and the page says so in its own
  "How these numbers are measured" section — nothing is captured in CI or
  committed.
- **Specs.** `data-at-scale.spec.ts` (render, source wiring, benchmark
  readouts, both mode-switch directions, in-flight supersession, the
  scroll-height fallback, the error row a dead backend produces, the
  size-control disclosure, and the reduced-motion and destroy-mid-run paths of
  the scroll benchmark), `scale-data-source.spec.ts` (query shape,
  supersession, identity, page-size and dataset switches, backend failure and
  the watchdog), `data-at-scale.metrics.spec.ts` (frame maths, the single
  layout read, abort, reduced motion), plus
  `backend/scale-dataset.spec.ts` and `backend/scale-engine.spec.ts`. They run
  against the main-thread backend; the 100k-row behaviour that jsdom cannot
  reproduce was verified by hand in Chrome.

The Project Workspace showcase is the flagship four-region `MlvPageShell`
composition: icon rail (first `mlvPageSidebar`), project navigation sidebar
(second `mlvPageSidebar`, off-canvas below `lg` with a header
`button[mlvSidebarTrigger]`), central `main[mlvPage]`, and a `mlv-page-end-pane`
inspector — each chrome region carries a `data-region` attribute whose DOM
order (`rail`, `project-navigation`, content, `inspector`) is asserted by its
spec. Grouped tasks are a component-owned discriminated row union (group
header rows + an expansion set recomputed into `tableRows()`), deliberately
not data-table `_mlvChildren` tree rows; `ProjectGroupRow` declares the
task-column keys as optional `undefined` members so `mlvDataTableCell` keys
type-check against the union under AOT. Row-menu status changes mutate groups
immutably, recompute the summary `progress()`, and announce through
`MlvNotificationService`.

The Publishing Workspace showcase gives `@malva-ui/editor` + `@malva-ui/editor/ai`
their wide canvas: document navigation sidebar, editor center (42–48rem
measure) with `MlvEditorAiMenu` in `mlvEditorToolbarStart` and
`MlvEditorAiReviewBar` in `mlvEditorStatus`, review/version `mlv-page-end-pane`,
and a `mlv-page-dock` (last-saved, Preview, Publish as the view's one accent
action). A local `DocsPublishingAiGate` directive injects the per-editor
`MLV_EDITOR_AI_CONTEXT` so the route drives review transforms and gates
Publish on `hasPendingSuggestions()`; the streaming provider is network-free,
abortable, and tolerates unknown kinds. Publishing happens only through the
confirmation dialog. Version compare renders sanitized `[innerHTML]` prose in
an `mlv-split-pane` (no second Tiptap instance); uploads use local object URLs
with deterministic progress plus one failure/retry path, and all timers and
blob URLs are cleaned up on destroy.

The Page app-shell example includes accessible `Custom CSS variable` and
`Auto` mode buttons plus an `mlv-color-picker-popup`. Auto removes the demo
custom property and restores the standard theme-aware shell chrome; selecting
a popup color returns to custom mode while preserving the last selection.

The **Form** page (`/form`, Layout group, icon `list-checks`) documents
`@malva-ui/core/form` — the `form[mlvForm]` layout shell, `fieldset[mlvFieldset]`
grids, `[mlvFormHeader]` / `[mlvFormActions]` rows and `[mlvFieldsetSpan]`. Its
five examples cover the stacked form, fieldset grids, live `[mlvDensity]` /
`gap`, the form inside dialog and drawer bodies, and the bare `<fieldset>`
fallback. Its API tab resolves through the default rule
(`{ family: 'core', entry: 'form' }`), so it needs no `API_OVERRIDES` entry.

The **Taskboard** page (`/taskboard`, Data display group, icon `kanban`)
documents the standalone package **`@malva-ui/taskboard`** — never
`@malva-ui/core/taskboard`, which does not exist. Its API tab resolves the
package root through the `API_OVERRIDES` entry
`{ family: 'taskboard', entry: '' }` (the same package-root shape the editor
uses), so `docs:extract-api` reads `libs/taskboard/src/index.ts`. Registering it
also required `family:docs` to be allowed to depend on `family:taskboard` in
`eslint.config.mjs`, and the `kanban` icon in `DocsIconName` / `NAV_ICONS`.

Its eight examples build up in order: (1) a projected board with `dataKey` /
`columnField` and `(moved)`; (2) column groups, swimlanes, WIP limits and the
consumer-owned collapse toggles the board renders but never writes;
(3) `transitions`, `lockedItemIds`, `canDropFn` and `(moveCancelled)`;
(4) the `selection` model with a bulk toolbar; (5) every replaceable slot plus
`(contextMenu)` driving a `[mlvContextMenuTrigger]` panel from
`@malva-ui/core/menu`; (6) a density segmented control bound to `[mlvDensity]`
beside a scoped `dir="rtl"` board; (7) `virtualItemSize` over 500 cards with a
`visibleItems` filter; (8) the imperative surface — `undo()`/`redo()`,
`snapshot()`/`restore()`, `exportJson()`/`exportCsv()`, `print()` — with a
`beforeMove` guard awaiting `MlvDialogService.confirm()`.

Every example imports only published entry points (`@malva-ui/taskboard`,
`@malva-ui/core/<leaf>`, `@malva-ui/cdk/<leaf>`); `pages/taskboard/index.spec.ts`
asserts the route, manifest, navigation, lazy load and that import rule.

The home page and Getting Started guide are intentional custom pages. The home page is a vibrant, reuse-first product landing (see `pages/home/CLAUDE.md` for the full section map): an aurora hero with a rotating headline word and theme-aware codex-generated glass artwork (`public/malva-ui-hero-glass-{light,dark}.webp`; `public/malva-ui-cta-aurora.webp` for the CTA), a dual-direction component marquee, animated stat counters, an interactive bento grid, a light/dark theme-split slider, and a showcase reel fed by the showcase registry's preview assets — with scroll reveals throughout and the below-the-fold scenes code-split via `@defer (on viewport)`. The workspace preview composes `MlvPageShell`, `MlvSidebar`, native `mlv-page-header`/`mlv-page-content` chrome, buttons, cards, badges, and progress; the principles are `MlvCard` surfaces. Getting Started uses semantic guide markup, accessible copy actions, responsive BEM styles, and `DocsTocSourceDirective`; it does not use `DocPageComponent`, numbered examples, or an API child route.

The **Tailwind** guide (`/tailwind`, Overview group, icon `palette`) is another
intentional custom page. It documents `@malva-ui/tailwind` installation,
schematic options, namespaced variables, and live utility classes. Its block
snippets use the shared `HighlightPipe` and `ShikiHighlightService` with the
active Malva theme; inline `<code>` remains unhighlighted. Reference tables use
semantic captions and headings plus responsive, token-driven table styling.

### Editor pages (own sidebar group)

The editor family owns a standalone **Editor** sidebar group (`id: 'editor'`,
icon `scroll-text`, declared in `GROUP_DEFINITIONS` directly after `forms`)
containing two pages: **Editor** (`/editor`) and **AI Kit** (`/editor-ai`,
label override `AI Kit`, icon `sparkles`). The editor page is no longer in the
Forms group.

The `/editor` page provides eleven live examples from the grouped
`@malva-ui/editor` entry point. It covers nullable direct HTML and
Markdown values, reactive/template-driven/Signal Forms, deterministic local
image uploads, readonly/disabled state and events, literal Tiptap extension and
toolbar replacement, tables, view-only zoom, the structured `json` format,
in-place switching between all three formats, and the page measure with block
reordering. Its upload demo never contacts a
backend and tears down every timer and abort listener. The JSON example parses
the model string in the host and renders a structural outline rather than
injecting HTML; the format-switch example counts `editorReady` emissions to
show that switching never constructs a second editor. Route, navigation,
source-import, lazy-component, and API-resolution contracts are asserted by the
editor page spec; API extraction resolves the standalone `editor` package root
(`{ family: 'editor', entry: '' }` → `libs/editor/src/index.ts`).

### Editor AI Kit page

The `/editor-ai` page (title `AI Kit`) hosts the editor's AI toolkit examples,
moved from the editor page (former examples 12/13 → AI Kit examples 1/2). It
shares the editor package's extracted API entry (`{ family: 'editor',
entry: '' }` — same aliasing precedent as the button-group/button-split pages
mapping to the shared button entry), so both pages render the same API tab.
Its own page spec (`pages/editor-ai/index.spec.ts`) asserts registration,
navigation, lazy loading, and a source-import guard requiring both
`@malva-ui/editor` and `@malva-ui/editor/ai` in every example.

The AI assistant example (1) projects `MlvEditorAiMenu` from
`@malva-ui/editor/ai` into the toolbar via `mlvEditorToolbarStart` and binds
`[aiProvider]` to a docs-local mock provider defined in the example's own
`index.ts` (so it shows in the source tab): canned per-kind Markdown streamed
word by word with ~90 ms delays, the custom-prompt instruction echoed back in
bold, and `request.signal` honoured so the toolbar stop button and Escape end
the stream mid-sentence. No network, no API key. The example surfaces the last
`editorError` in a polite live region. All three output modes work, including
`review`, whose collected result lands as reviewable tracked suggestions.

It also demonstrates the host-owned action list: `[actions]` is bound to
`mlvEditorAiDefaultActions(copy)` — the built-ins, labelled from
`MLV_EDITOR_I18N` so they keep following the docs language selector — plus one
extra `Suggest a headline` entry with a host-invented `'docs-headline'` kind and
`output: 'insert-below'`. Because `actions` is a literal replacement, spreading
the factory is the documented way to extend rather than replace. The mock
provider answers unknown kinds through an explicit fallback branch (own-key
lookup, never a prototype hit), which doubles as the reference for "providers
must tolerate kinds they don't know". The example follows the repo's existing
`app.config.ts`/`docs-shell.ts` precedent for the `@malva-ui/i18n` main entry:
a static import with the explanatory comment plus the
`@nx/enforce-module-boundaries` disable, since only the language packs are lazy.

The AI review example (2) dedicates a full demo to the `review` output mode:

- Its `DocsProofreadAiProvider` proofreads `request.context.selection`
  instead of returning canned text (three separated corrections: `Teh` →
  `The`, delete `basically`, insert `expert`), so the review word diff lands
  as one replace, one delete, and one insert suggestion; 60 ms chunk delays,
  `request.signal` honoured.
- `MlvEditorAiReviewBar` is projected into the status region via
  `mlvEditorStatus`; the misspelled draft paragraph plus in-document
  instructions drive the accept/reject flow.
- The save-gating sharp edge is demonstrated live: a `[docsAiReviewGate]`
  attribute directive (`exportAs: 'docsAiReviewGate'`) on the `mlv-editor`
  element injects `MLV_EDITOR_AI_CONTEXT` and the Save-draft button disables
  while `hasPendingSuggestions()` — the MDX shows the host-side pattern as a
  copyable snippet.
- Editor e2e (`libs/editor/e2e/editor.spec.ts`, `editorAiManifest` block
  against `/editor-ai`) drives this example: review-mode run → decorations +
  count visible → accept-all commits the proofread text, reject-all restores
  the exact original.

---

## 6. Shared Components and Utilities

All shared pieces live under `apps/docs/src/app/shared/`.

### `DocPageComponent` (`docs-page`)

**File:** `apps/docs/src/app/shared/doc-page/doc-page.component.ts`

Universal page wrapper. Renders the page title + description, then — **when the page's library has an extracted API entry** (`hasApiEntry(header())`, from `src/generated/api`) — a **link-mode `mlv-segmented`** (`@malva-ui/core/segmented`) with two router links, and one of two mutually-exclusive panels:

- **Examples** — `<a mlvSegmentedItem routerLink>` to the page base `/<name>`, matched `{ exact: true }` (so the base URL does not also mark the API link active); its panel is the existing `@for examples` block (MDX doc + `ExampleContainerComponent`).
- **API** — `<a mlvSegmentedItem routerLink>` to `/<name>/api`; its panel is `<docs-api-viewer [name]="header()">`.

Which panel mounts is URL-driven: `isApiRoute()` (a `computed` over `Router.url`, refreshed on `NavigationEnd`, seeded at construction so a direct `/<name>/api` load is right immediately) checks `Router.isActive('/<name>/api', { paths: 'exact', queryParams: 'ignored', … })`; the segmented control derives its own active link from the same URL. At `/<name>` just the examples mount, at `/<name>/api` just the API viewer. Pages whose library has no API entry (e.g. `animated-presence`) render the examples flat with no switcher.

**Routing (`withApiTab` helper in `app.routes.ts`):** `/<name>/api` is registered as a **componentless child route** of each component page. Because the parent component (`DocPageComponent`) is unchanged across `/<name>` ↔ `/<name>/api`, Angular's default route-reuse **keeps the same instance** — switching Examples ↔ API never tears the page down (no scroll loss, no example re-fetch). The helper wraps existing routes so no `api` route is hand-duplicated; for the two pages that already `loadChildren` (dialog, drawer) the `api` marker is injected into their child set (a route cannot declare both `children` and `loadChildren`).

Inputs: `meta: DocPageMeta`, `examples: number[]`, `header: string`, `type?: string`.

For showcase-capable component pages, `DocPageComponent` resolves the display
`header` through its explicit alias map before querying the registry's canonical
component paths. It passes the resulting contextual showcase route only to the
first numbered `ExampleContainerComponent`; later examples and unregistered
pages receive no route.

### `ExampleContainerComponent` (`docs-example-container`)

**File:** `apps/docs/src/app/shared/example-container/example-container.component.ts`

Four stacked bands, top to bottom. **The preview is never a tab** — it is always
on screen, above everything else; only the source files are tabbed:

| Band                        | What it holds                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `docs-example-controls`     | The per-example switchers — density, direction, theme, preview width. **Deferred** (`@defer (on viewport)`)        |
| `.example-container__stage` | The scoped island (`DocsExampleScopeDirective`) wrapping `.example-container__preview` (live `NgComponentOutlet`)  |
| `mlv-toolbar`               | **Show sources** disclosure → `mlv-toolbar-spacer` → `<docs-open-in-playground>` → the **Open full example** link  |
| `mlv-expand`                | An `mlv-tab-group` with one `mlv-tab` per source file; the open pane is a `.example-container__source` (see below) |

- **Disclosure over tabs, not instead of them.** One `<button class="example-container__sources-toggle">` carries `aria-expanded` and `aria-controls`, and swaps both its chevron (`lucideChevronDown` ↔ `lucideChevronUp`) and its label (**Show sources** ↔ **Hide sources**) with the state — `aria-expanded` on a fixed label would announce "Show sources, expanded". `aria-controls` points at the `mlv-expand` host, whose `id` is a per-instance `docs-example-sources-N`. Inside it, html / typescript / any additional file is an `mlv-tab` — the same `mlvTabDef` / `mlvTabContent` shape as before the redesign, **minus the Preview tab**, which is what the redesign removes.
- **The control bar is deferred, and its placeholder holds the box open.** A docs page builds one container per example — 10 on `/button`, 23 on `/data-table` — and rebuilds all of them on every navigation, so eager bars were 38% of the page's elements (42 `mlv-segmented`s and 100 tooltip directives on `/button`) and the navigation waited for every one. `@defer (on viewport)` moves the off-screen ones off the critical path: measured in Chromium, median of 6 routed navigations, `/button` 107.4ms → 74.7ms and `/data-table` 214.7ms → 147.7ms, with the initial element count falling 1553 → 1147 and 6843 → 5683 (deleting the bars outright measured 63.7ms on `/button`, so the defer recovers most of what is there to recover). `@placeholder` renders `.example-container__controls-placeholder`, a `2.5625rem` box with the same hairline — the bar measures 41.5px, the extra half-pixel being the text-bearing LTR/RTL segment's line box, and the placeholder deliberately undershoots rather than overshoots. **Specs must render the block**: `TestBed` leaves defer blocks in their placeholder state (`DeferBlockBehavior.Manual`) and the real trigger needs an `IntersectionObserver` jsdom does not have, so `example-container.component.spec.ts` has a `renderControls()` helper (`fixture.getDeferBlocks()` → `render(DeferBlockState.Complete)`) used by every switcher spec and by the axe sweep.
- **Four tab stops per example, kept deliberately.** Each `mlv-segmented` is a roving-tabindex radiogroup, so the bar is 4 stops, not 11 — measured against the first `/button` example's own 9 controls plus 2 toolbar stops. Collapsing them into one popup would buy 3 stops per example at the price of an overlay, focus management and a click between the reader and the feature the redesign exists to show; dropping one would remove a per-example scope the page-level bar cannot express. The viewport switcher already sheds itself at `md` and below (`mlvActionBarActions`), so a phone sees 3.
- **The tab group is lazy content** (`<ng-template mlvExpandContent>`), not projected. `mlv-tab-group` decides its overflow split from its own `headerEl.clientWidth`, so a group built inside a collapsed panel measures a zero-width box; deferring construction to the first open also keeps every example on a page from building a tab group nobody asked for. It is additionally guarded on `renderedFiles().length > 0` — an empty group is not nothing, it still paints its separator and header band and its empty tablist is still a tab stop.
- The open tab lives in `activeSource` on the **component**, not in the panel: `mlv-expand` re-instantiates its lazy content on every open, so a signal owned by the template would forget the reader's pick each time they collapsed it.
- Each pane carries its own hover-revealed `<docs-copy-source>`, absolutely positioned against `.example-container__source` — the box that holds that pane's code.
- **Highlighting stays lazy, and is now per open tab.** It runs when the panel opens, again on a tab switch, and again on a page theme change — never for a pane that is not in the DOM. `_activeFile()` mirrors `mlv-tab-group`'s own "fall back to the first tab" rule so the first open starts tokenizing immediately instead of waiting for the group to write `activeTab` back. Shiki output lives in a separate `_highlighted` record rather than inside `resolvedFiles`, so the effect can write a finished file without invalidating its own dependencies, and switching back to a tab already rendered costs nothing. Source imports still resolve up front, because the playground button needs them to decide whether the example is portable.
- When `fullExampleRoute` is non-null it renders a Malva button-style `RouterLink` labeled **Open full example**; when `null`, no expansion control. Complex examples must open through this routed link; never add a browser-native fullscreen control or call the Fullscreen API in the docs application.
- `<docs-open-in-playground>` keeps its place in the toolbar — still the single call site through which all 474 examples get their "Open in StackBlitz" button (see §5b). It carries **no margin of its own**, and neither does the **Open full example** link beside it: `mlv-toolbar` supplies the row's `gap` and `.example-container__toolbar` the band's padding, so a margin on either would push it out of line with the other and grow the band.
- It sets **`ViewEncapsulation.None`**, one of a handful of docs components that do (`docs-toc`, `docs-inspector` and `docs-api-viewer` are the others). Its reason is Shiki: that markup is bound with `[innerHTML]`, so it carries no `_ngcontent` attribute and emulated encapsulation would never reach the `<pre>` / `<code>` it produces.

Inputs: `component: Type<unknown> | null`, `content: any`, `files: ExampleFile[]`, `heading?: string`, `fullExampleRoute: string | null`.

#### The switchers are per-example, never global

`docs-app-bar-preferences` owns the **document** through `MlvThemeService`,
`MlvDensityService` and `MlvRtlService`. An example container must never call
those — flipping one example would flip the page. Each of the three settings is
a `computed` over an override signal: `null` means "follow the page", so an
untouched example keeps tracking the app bar and pins itself only once the
reader picks something in its own bar. `ExampleControlsComponent` injects none
of the three services, and a spec asserts that statically.

`DocsExampleScopeDirective` (`[docsExampleScope]`) writes all three scoped mechanisms on
the stage element:

| Concern   | Mechanism                                                                                |
| --------- | ---------------------------------------------------------------------------------------- |
| Density   | the `mlv--{density}` cascade class **and** a provided `MLV_DENSITY_CONTEXT`              |
| Direction | a `dir` attribute — `MlvRtlService.elementDirection()` resolves the nearest one          |
| Theme     | an `mlvTheme` attribute — `libs/styles/src/lib/theme.scss` keys its token islands off it |

Density needs **both** halves. The class alone loses: every density-aware
component stamps its own `mlv-{block}--{density}` modifier from its density
directive, and `density.scss` treats exactly that modifier as an override
(`[class*='--x'] &:not(…)`), so a `mlv-button--comfortable` resolved from the
_global_ service would beat the ancestor `mlv--tight`. The DI context makes
those directives resolve the scoped value; the cascade class then covers
everything with no density directive of its own.

**Overlays opened from inside an example** are portaled to `<body>` and inherit
none of the stage's DOM, but two of the three still reach them, by different
routes — pinned by a spec in `example-scope.spec.ts`:

- **Direction ✓** — `MlvPopupService` passes `direction: resolveDirection(config.origin)`, and the origin is inside the stage.
- **Density ✓** — a `TemplatePortal` declared inside the stage keeps its declaration injector, so `MLV_DENSITY_CONTEXT` resolves. (Density expressed as plain CSS keyed off an _ancestor_ class does not follow; density-directive components do.)
- **Theme ✗** — nothing writes `mlvTheme` on a pane, so a panel opened from an example flipped to dark on a light page renders light. Pre-existing, and not this component's to fix: it means teaching the overlay owners to carry the trigger's theme, which is a library change. Fixable, deferred: tracked in #240.

#### `CopySourceComponent` (`docs-copy-source`)

The corner copy button on each source tab's pane. It is **not** `mlv-copy-to-clipboard`:
that component makes the projected text itself the control (`role="button"` on
the host, a hover tint across the run of text, masks measured from the content),
so wrapping a highlighted `<pre>` in it would turn the whole code block into one
giant button. This is the opposite shape — a small button beside content it does
not contain, writing through the CDK `Clipboard`.

Hover-only visibility is a **pointer** affordance: the control is a real
`<button>` in the tab order at all times, `:focus-within` on the panel brings it
into view for keyboard users, and `@media (hover: none)` shows it unconditionally
where there is no hover to reveal it with. A refused clipboard write leaves the
button idle rather than claiming a copy that never happened.

### `OpenInPlaygroundComponent` (`docs-open-in-playground`) — the zero-install playground

**Files:** `apps/docs/src/app/shared/playground/open-in-playground.ts`,
`playground-project.ts`, `playground-submit.ts`

Turns the source `ExampleContainerComponent` already resolved for the source tabs
into a self-contained Angular CLI project and POSTs it to StackBlitz. Rendered
from `docs-example-container`, the one call site every example flows through, so
no page under `pages/` is touched.

| Piece                       | Responsibility                                                                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `createPlaygroundProject()` | Pure, Angular-free. Source files + version tables in, a `{ title, description, template, files, openFile }` payload out.                                                 |
| `submitPlaygroundProject()` | Builds a hidden `<form method="post" target="_blank" rel="noopener noreferrer">` of `project[files][<path>]` fields against `https://stackblitz.com/run` and submits it. |
| `OpenInPlaygroundComponent` | The button. Renders **nothing** when the payload builder returns `null`.                                                                                                 |

**Files payload, not a repo URL.** StackBlitz can boot from a GitHub URL, but
that needs a public repository (#22) and could not carry a per-build version
table. The POSTed file set works today and keeps working after the flip. No
`@stackblitz/sdk` dependency: the SDK builds this exact form, and going direct
keeps the tested unit a plain payload object rather than a mocked SDK call.
Swapping the SDK in is a one-file change in `playground-submit.ts`.

**Versions come from the workspace root `package.json`, never a literal.**
`docs:generate-playground-versions` writes `src/generated/playground-versions.ts`
(`PLAYGROUND_VERSIONS` + `PLAYGROUND_PEERS`) using the same placeholder table
`scripts/publish.mjs` resolves from, and `nx.json` → `release.version` already
makes the root manifest the canonical version of every published project. When
`0.2.0` ships, the next docs build emits `0.2.0` with no edit anywhere. The
peer graph is read from each published `libs/*/package.json`, so
`@malva-ui/editor`'s twelve Tiptap peers land in the generated project without a
hand-written companion list.

**The generated project is a real `ng add` install.** The three packages
`ng add @malva-ui/core` adds, the published stylesheet at
`node_modules/@malva-ui/core/styles/malva-ui.css`, and `provideDefaultTheme` /
`provideMlvDensity` in `main.ts`. It bootstraps with
`provideZonelessChangeDetection()` and ships **no `zone.js` and no `polyfills`
entry** — a starter that contradicted the library's zoneless-only stance would
mislead every evaluator who copied it. It carries no `@angular/animations`
either: nothing under `libs/` imports it and it is deprecated in Angular 22.

The example's own files keep their names (`src/example/index.ts` / `.html` /
`.scss`), so `templateUrl: './index.html'` needs no rewriting and what the
evaluator opens is byte-identical to what the docs page showed.

**Twenty-one examples get no button**, for two unrelated reasons.

_Five import docs-local code that is not published:_ `autocomplete/4`,
`checkbox/1`, `combobox/10` reach outside their own directory; `select/8` and
`tile/5` import a sibling file the `docsExample` pipe does not resolve. The check
is derived from the source text, not a list, so an example that becomes
non-portable loses its button on the same commit.

_Sixteen import a package npm has never seen_ — all eight `scheduler/*` and all
eight `taskboard/*`. Being in `nx.json` → `release.projects` means "will be
published at the next release", not "is on npm now": both landed after `v0.1.15`
and neither has shipped, so `npm install @malva-ui/scheduler@0.1.15` 404s. The
networked workflow already skipped its own install for these; the button had no
equivalent guard, so a visitor got a WebContainer that died during install.
`UNPUBLISHED_PACKAGES` in `playground-project.ts` is that guard, and it is
**temporary and pinned twice** so it cannot outlive its reason:
`tools/playground-corpus.spec.ts` fails as soon as the root manifest moves off
`UNPUBLISHED_VERIFIED_AT` (publication can only change at a release, and
`scripts/publish.mjs` already ships `@malva-ui/scheduler`), and
`.github/workflows/playground.yml` fails if `npm view` resolves any name in the
list. Either failure means delete the entry.

`tools/playground-corpus.spec.ts` asserts the blocked set is _exactly_ those
twenty-one, each for the reason its own list exists for, so a twenty-second fails
the suite instead of vanishing quietly.

**The mounted tag is read from code, not from text.** `parseBootstrapSelector`
scans a `maskNonCode()` copy of the example — comment bodies, string bodies and
template-literal bodies blanked, every index preserved — before taking the last
`@Component` above `export default class`. Without that, an example that
_displays_ Angular source (as `getting-started` and `tailwind` already do) or
that leaves a commented-out `selector:` above the live one mounts a tag no
component declares: `ng build` succeeds, `bootstrapApplication` finds no host,
and the page is blank with nothing to read. The corpus sweep re-reads every
example's selector with the real TypeScript parser
(`declaredBootstrapSelector()`, Node-only, never in the bundle) rather than the
builder's own regex, so "the builder agrees with itself" is not what is being
asserted.

**Two checks, and they prove different things.** `tools/playground-corpus.spec.ts`
runs in `docs:test` and sweeps all 474 examples offline: every one builds a
project or is a named exception, every imported package is declared with a
version, every declared `templateUrl` / `styleUrl` exists, and the version table
is a fresh derivation of the root manifest rather than a copy. It proves nothing
about npm. `.github/workflows/playground.yml` does the other half — a real
`npm install` + `ng build` of a generated project against the published packages
— on a schedule, on `workflow_dispatch`, and on pushes that touch the generator.
Its preflight skips (loudly, naming the package) when a version the template
declares is not on npm, which covers both a release window and a package that
has never been published; a second step fails outright if a package in
`UNPUBLISHED_PACKAGES` _has_ since been published. It writes its project with
`--allow-unpublished`, because materialising a project and deciding whether npm
can install it are separate jobs — that is what keeps the `scheduler` leg
running and ready to start proving something the day the package ships.

Every value its `run:` blocks read arrives through `env:`, never a `${{ }}`
interpolation into shell.

### `ExamplePipe` (`docsExample`)

**File:** `apps/docs/src/app/shared/example-pipe.ts`

Dynamically imports raw source files (`index.ts`, `index.html`, `index.scss`) from the example directory via Vite's text loader. Returns a `Promise<string>` map for display.

### `ComponentPipe` (`docsComponent`)

**File:** `apps/docs/src/app/shared/component-pipe.ts`

Dynamically imports `pages/<header>/examples/<n>/index.ts` and returns the `export default` class for the preview outlet.

### `DocsDocumentationPipe` (`docsDocumentation`)

**File:** `apps/docs/src/app/shared/documentation.pipe.ts`

Async pipe that dynamically imports `.mdx` files. The esbuild MDX plugin transforms them at build time — no runtime Markdown parsing. Returns `Promise<MdxEntry | null>` (HTML + frontmatter + ToC).

### `DocsTableOfContentsComponent` (`docs-toc`)

**File:** `apps/docs/src/app/shared/toc/toc.component.ts`

Sticky right sidebar displaying a page-level Table of Contents. Inputs: `entries: TocEntry[]`. Hidden below 1200px viewport width. **Scroll-spy uses an `IntersectionObserver`** over the heading elements (resolved by id from the mounted panel, `rootMargin` shifted for the 70px fixed action bar), rebuilt whenever the active panel republishes. This replaced a broken implementation that compared `el.offsetTop` (offset-parent-relative) against `window.scrollY` (document-absolute) — mismatched coordinate spaces, so the active heading was wrong. A ToC click sets the active slug immediately (before the observer catches up) and smooth-scrolls.

**Headings are addressable, and this component owns both directions.** A click
publishes `#<slug>` with `history.replaceState` — not a router navigation,
which would emit `NavigationEnd` and hand the shell's own handler a reason to
scroll back to the top, and not `pushState`, which would put one history entry
behind every heading a reader visits. A URL that _arrives_ with a fragment is
honoured from the same `effect` that rebuilds the observer, because a publish is
the earliest moment the headings exist (the MDX resolves asynchronously, so
`NavigationEnd` is far too early). The target is resolved by `getElementById`
rather than against `entries`, so an example's own `#example-N` permalink deep
links as well as a ToC slug does; a fragment naming nothing stays unconsumed and
a later publish still honours it, and a fragment already honoured is not
re-applied on a tab switch.

**Every fragment URL is path-absolute.** `apps/docs/src/index.html` declares
`<base href="/">`, and a relative `#slug` — in `replaceState` and in an
`<a href>` alike — resolves against the **document base URL**, not the current
one, so a bare fragment read `/#variants` in the address bar and on a copied
link and landed the reader on the home page. `fragmentHref(slug)` builds
`location.pathname + location.search + '#' + encodeURIComponent(slug)`. It is
public because the ToC's own links bind to it, and `DocsTocSourceDirective`
builds the same shape for every heading permalink.

Neither path does offset arithmetic — `html { scroll-padding-top: 5.5rem }` in
`styles.scss` clears the 72px fixed bar for `scrollIntoView`, browser find, and
focus scrolling alike. A **load-time** landing is followed by a bounded
re-alignment window (1s, or three frames of a still offset, or the reader's
first wheel / touch / key — whichever comes first), because the page is still
growing underneath it: measured on `/button#example-4`, the scroll landed the
wrapper at the correct 88px and Chromium's scroll anchoring then settled on a
descendant, leaving the wrapper's top at 11px, back under the bar.

### `DocsTocSourceDirective` (`[docsTocSource]`)

**File:** `apps/docs/src/app/shared/toc/toc-source.directive.ts`

Applied to the **Examples** panel wrapper. Collects the panel's `.docs-heading` elements in document order, assigns each a **unique** id (preferring an id the markup already carries, suffixing `-2`, `-3`, … on collision so `getElementById` / ToC anchors / `@for track slug` never clash), finishes each heading's permalink, and publishes the entries to `DocsTocService`. Because the examples are `[innerHTML]`-rendered MDX that resolves asynchronously, it scans on first render and re-scans on DOM mutations (debounced to a frame) until the content settles. The exported pure helper `collectTocEntries(host)` does all of that and is unit-tested (`toc-source.directive.spec.ts`); `DOCS_HEADING_CLASS`, `DOCS_HEADING_ANCHOR_CLASS` and `slugify` are exported beside it so the markup authors emit exactly the shape it expects. The **API** panel does not use this directive — `docs-api-viewer` publishes its headings directly from the extracted data.

**The scan is opt-in by class, not by tag.** Selecting `h2, h3, h4` needed a
growing exclusion list — `[contenteditable]`, for the Tiptap document inside
`/editor`'s live `mlv-editor` previews, and `.example-container__preview`, for
`mlv-scheduler`'s `<h2>` range title, which published "31 Aug – 6 Sept 2026"
once per example on `/scheduler` — and every future component that renders a
heading of its own would have needed another. `.docs-heading` inverts it: a
heading is listed because its author said so, which no library component can
accidentally satisfy. Nothing without the class is even given an id, which
matters beyond the ToC — an id written into ProseMirror-managed DOM is reverted
on its next flush, leaving an entry whose anchor no longer resolves. Three
authors emit the class: the MDX renderer (§9a), `DocPageComponent`'s example
title, and the two hand-written guide pages (`getting-started`, `tailwind`).
A guide page that stops emitting it empties its own ToC rather than falling
back to tag matching.

**The directive owns each permalink's `href` and `aria-label`.** Both markup
authors ship `<a class="docs-heading__anchor">` empty and pointing at a
placeholder, because only the scan knows the final answer: the slug is
collision-resolved here, so the author of the second "Basic usage" on a page
cannot know theirs is `-2`, and the `href` has to be path-absolute for the
`<base href="/">` reason above. The anchor's own text — it has none today, its
glyph being a CSS mask — is subtracted from the heading before slugging, so a
visually-hidden label added later cannot leak into the ToC entry or the id.
`DocPageComponent` additionally binds `aria-label` in its own template, so its
permalink is named from first paint and `@angular-eslint`'s `elements-content`
has something to see on an element it reads as an empty `<a>`; the MDX anchor
is named by the directive alone.

### `DocsTocService`

**File:** `apps/docs/src/app/shared/toc/toc.service.ts`

Bridges the currently-mounted doc panel's ToC entries to the app-shell sidebar. Root singleton holding a `signal<TocEntry[]>`. Publishing is **replace, not append** — under the tabbed structure only the active panel is mounted, so each panel owns the whole ToC while active and republishes on tab switch. An `owner` token guards tab-switch races: the outgoing panel's `clear(owner)` is a no-op once a newer panel has published; a no-arg `clear()` force-resets on full page navigation.

### `ApiViewerComponent` (`docs-api-viewer`)

**File:** `apps/docs/src/app/shared/api-viewer/api-viewer.component.ts`

Renders the **API** tab. Input `name` (kebab page name) lazy-loads the library's extracted `ApiEntry` via `apiEntryLoaders[name]?.()` from `src/generated/api` (no API data in the initial bundle; nothing renders if absent). Renders one section per exported `ApiSymbol` — name + kind chip + `selector`/`name` + class description, then **Inputs / Outputs / Properties / Methods** tables and a type block, with **inherited** members (tagged in the extracted data, e.g. from `FormControlBase`) in a labelled subgroup and empty groups omitted. The **Properties** table lists public readable members that are not inputs/outputs — `computed()`/`signal()` state, public getters, plain public fields — extracted alongside methods (structural view/content queries and `_`/`@internal` members are excluded). Each section + Inputs/Outputs/Methods subsection carries a slug id and the component publishes those headings to `DocsTocService` while mounted (feeding the ToC on the API tab). The `ApiEntry`/`ApiSymbol`/`ApiMember`/`ApiMethod` contract lives in `api-viewer/api.types.ts` (produced by `docs:extract-api`, see §9/§9a).

Page-to-library aliases map `button-group`, `button-split`, and `button-toggle` back to the shared `button` public entry point (so all four button pages expose the package API tab), and `editor-ai` back to the same `editor` package root as the editor page.

### `HighlightPipe` (`highlight`)

**File:** `apps/docs/src/app/shared/highlight.pipe.ts`

Shiki-based code highlighting pipe backed by the shared `ShikiHighlightService`.

### `ShikiHighlightService`

**File:** `apps/docs/src/app/shared/shiki-highlight.service.ts`

Root-level, bounded LRU cache for Shiki output, keyed by `theme::lang::code`. It reuses in-flight promises as well as completed HTML across component remounts, so revisiting a source tab after switching between Examples and API does not tokenize the same file again. Failed entries are evicted and remain retryable.

Shiki itself is reached through `DOCS_CODE_HIGHLIGHTER`, a root `InjectionToken<DocsCodeHighlighter>` whose default factory is Shiki's `codeToHtml` — the service never imports it directly. Specs override the token; **do not reintroduce `vi.mock('shiki')`**. Shiki is externalised, so once any spec sharing the worker has pulled the real package through Node's own ESM registry the module mock silently stops applying and the assertions read real Shiki HTML — the file then passed or failed on worker scheduling alone, and failed outright in the single-worker run CI now uses. `doc-page.component.spec.ts` and `example-container.component.spec.ts` already override `ShikiHighlightService` itself, which is the other correct shape.

---

## 7. App Shell

### Root Component (`App` / `docs-root`)

**File:** `apps/docs/src/app/app.ts`

The root component is deliberately minimal and contains only the top-level `<router-outlet>`. The root `/` route renders `HomePageComponent` directly as a full-width landing page. It begins with the same `DocsAppBarComponent` used by documentation and showcase routes.

### Shared App Bar (`DocsAppBarComponent` / `docs-app-bar`)

**Files:** `apps/docs/src/app/shared/docs-app-bar/docs-app-bar.ts`,
`docs-app-bar.html`, `docs-app-bar-preferences.ts`

The app bar owns the one semantic header across the home page, documentation
shell, and showcases. It supplies the skip link, a `[docsAppBarLeading]`
content slot ahead of the brand (the documentation shell projects its
navigation trigger there), Malva brand, Docs/Showcases segmented navigation,
GitHub link, and the display-preferences popup. The
preferences popup also exposes the global LTR/RTL direction selector, which
updates the document direction and CDK directionality for component previews.
`DocsAppBarPreferencesComponent` owns persisted theme mode, global density,
lazy locale switching, rollback feedback, and the native-name flag templates.

The brand home link carries an explicit `aria-label="Malva UI home"`. The logo
`<img>` stays decorative (`alt=""`) and `.docs-app-bar__brand` is `display: none`
below `47.999rem`, so without the label the link would have **no** accessible
name at mobile widths (axe `link-name`). The name is stated on the anchor rather
than derived from the text so it is identical at every viewport, and it starts
with the visible label so WCAG 2.5.3 Label in Name still holds on desktop.

### Documentation Shell (`DocsShellComponent` / `docs-shell`)

**Files:** `apps/docs/src/app/shared/docs-shell/docs-shell.ts`, `docs-shell.html`, `docs-shell.scss`

All non-home routes are nested beneath this shell. It provides the left sidebar
navigation, right ToC sidebar, and a nested `<router-outlet>` below the shared
app bar.

```
<docs-app-bar>
  <button docsAppBarLeading class="docs-shell__mobile-menu">  ← navigation trigger, below md only
<mlv-page-shell class="docs-shell" sizing="content">
  <mlv-sidebar mlvPageSidebar>            ← searchable grouped navigation
    @for (group of navigationGroups())
      @for (item of group.items)
  <div class="docs-shell__main-area">     ← flex wrapper
    <main class="docs-shell__content">
      <router-outlet />
    <docs-toc [entries]="tocEntries()" />  ← right sidebar ToC
```

The shell resets `window.scrollTo` on `NavigationEnd` — **except when the URL
carries a fragment**, which is a URL saying where it wants to land. The reset
runs first (the ToC's scroll waits for the headings to mount), so without the
exception it is the write that wins and a deep link always opens at the top.
Focus management is unaffected either way.

**`sizing="content"` is load-bearing, and pinned by a spec.** The documentation
pages are scrolled by the _document_: `.docs-shell__main-area` declares no
scroller of its own, `docs-toc` is `position: sticky; top: 5.5rem` against the
viewport, and the shell's own `NavigationEnd` handler resets `window.scrollTo`.
The default `sizing="parent"` and `sizing="viewport"` both bound the shell —
viewport to `calc(100svh - inset)` — and make `.mlv-page-shell__content`
`overflow: hidden`, so every page taller than the viewport is clipped with
nothing able to scroll it. A showcase route that wants a bounded shell uses its
own `ShowcaseShellComponent`, not this one.

The shell consumes `docsNavigationGroups`, so navigation is data-driven and
alphabetized within semantic groups. It includes a page filter, uses an icon
rail on larger screens, and switches to an auto-closing off-canvas sidebar on
small screens.

The shell's labelled mobile-navigation trigger (`aria-expanded` follows the
sidebar) is projected into the app bar's `[docsAppBarLeading]` slot, so it is
the **first item of the primary `<nav>`**, ahead of the brand link, at the same
height as the rest of the chrome. The shell still owns its state and toggling;
`docs-app-bar` only offers the slot, which home and showcase routes leave
empty. Documentation content and preference labels remain English.

The docs codebase now demonstrates the grouped public package surface in example imports wherever possible, while the underlying leaf libraries remain the granular Nx implementation units.

### Showcase Shell (`ShowcaseShellComponent` / `docs-showcase-shell`)

**Files:** `apps/docs/src/app/showcases/showcase-shell/`,
`apps/docs/src/app/showcases/showcase-loading/`, and
`apps/docs/src/app/showcases/pages/`

The showcase shell owns no documentation navigation. It composes the same
`DocsAppBarComponent` as home and reference-doc routes with a child
`RouterOutlet`; the catalog and each full-size route supply the single page
`main` landmark. It deliberately does not import or render `DocsShellComponent`,
the documentation sidebar, or the table of contents. During lazy showcase
navigation, the shell retains the shared app bar and renders stable
`MlvSkeleton` loading content with `aria-busy` until the route completes.

`DocsAppBarComponent` remains the only semantic header across all three route
experiences. Its Docs pill is active outside `/showcases`; Showcases is active
for `/showcases` and every descendant.

### Showcase preview assets

`apps/docs/public/showcases/README.md` defines the preview contract. Each
catalog preview is a real route-derived PNG named
`/showcases/<route-slug>.png`, captured at **1600×1000** in the light theme,
after fonts and images decode and animations settle. All seven showcase routes
are captured and every registry `previewAsset` points at its PNG; the
showcase-index spec asserts no card regresses to a `null` asset. Re-capture a
route's PNG whenever its default visual state changes. The home page's
showcase reel reuses the same registry assets.

### App Configuration

**File:** `apps/docs/src/app/app.config.ts`

Providers: `provideBrowserGlobalErrorListeners()`, `provideRouter(appRoutes)`,
`provideAnimationsAsync()`, the comfortable global density default, and the
lazy English i18n pack.

---

## 8. Styles

### `apps/docs/src/styles.scss`

Imports `@malva-ui/styles` theme and animations. Notable global rules:

- Universal `box-sizing: border-box`
- Body: system font stack and 16px base; dark-theme page backgrounds follow the Malva theme token
- Heading scale: `h1` 1.75rem, `h2` 1.25rem, `h3` 1rem
- `.demo-row` — flexbox row with `gap: 12px`
- `.docs-content` — white background, padding, border, shadow
- `padding-top: 70px` on layout side/content to clear the fixed action bar
- `html { scroll-padding-top: 5.5rem }` — clears the 72px fixed bar for
  `scrollIntoView`, native fragment navigation, browser find and focus
  scrolling in one declaration, so no code does offset arithmetic
- `.docs-heading` / `.docs-heading__anchor` — the section heading and its
  permalink. Global rather than component-scoped because MDX headings arrive
  through `[innerHTML]` and so carry no `_ngcontent` attribute. The chain is a
  Lucide `link` `mask-image` data URI coloured by `background-color`, so it
  follows both themes; it is transparent at rest, revealed on heading hover and
  on its own `:focus-visible` (with a Form A focus ring), and unconditionally
  visible under `@media (hover: none)`
- The docs shell imports only the required fourteen 4×3 `flag-icons` SVG assets;
  square assets are disabled to avoid duplicate Angular media output names.

**Every `.docs-shell` selector naming a library part is anchored with `>`.**
`.docs-shell` _is_ an `mlv-page-shell` and `/page` documents that component, so
a descendant selector reaches the shells rendered **inside** the examples on
that page. The sticky-rail rules are viewport-sized, and the examples are 38rem
boxes with `overflow: hidden`: measured on `/page` at 390×844 and at 1440×900,
the example's `__body` took the `100svh` floor, the canvas inside it resolved to
the full 844/900px, and the bottom third of the example was clipped with no
scroller anywhere able to reach it. The three anchored rules are
`.docs-shell > .mlv-page-shell__body` (the floor),
`… > .mlv-page-shell__sidebar` (the sticky rail) and the same sidebar selector
again inside `@media (max-width: 47.999rem)`, which unpins the rail below md.

That third one has to carry the **same** anchor, not merely some anchor: a media
query buys no specificity, so the shorter `.docs-shell .mlv-page-shell__sidebar`
(0,2,0) it was written as would now lose outright to the sticky rule's (0,3,0)
and the rail would stay pinned at every width. Anchoring one rule of an
override pair is worse than anchoring neither.

`.docs-shell__*` names are docs-only and cannot collide, so those rules stay
descendant selectors — including `.docs-shell .docs-shell__main-area`, which is
default-slot content and therefore lives inside `.mlv-page-shell__content`, not
under `__body`. Pinned by `docs-shell.spec.ts` § _sticky rail geometry_, whose
leak check reads the stylesheet with its comments stripped: the reason each
selector is anchored is written directly above it, so a scan of the raw source
would fail on the prose explaining the very shape it bans.

Landing-page layout and visual styling are component-scoped in `pages/home/home.scss`; the global stylesheet no longer needs a `:has(.landing-page)` override because the home route is structurally outside the docs shell.

---

## 9. Build Configuration

**File:** `apps/docs/project.json`

| Target                         | Executor                  | Notes                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------ | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `extract-api`                  | `nx:run-commands`         | Runs `tools/extract-api.ts` (via `jiti`) to regenerate `src/generated/api/**`. `dependsOn` of both `build` and `serve`. Cacheable.                                                                                                                                                                                                                  |
| `generate-playground-versions` | `nx:run-commands`         | Runs `tools/generate-playground-versions.ts` to regenerate `src/generated/playground-versions.ts` from the workspace **root** `package.json`. `dependsOn` of `build`, `serve`, `test` and `typecheck`. Cacheable — its `inputs` are the root manifest, `nx.json` and `libs/*/package.json`, so a release bump invalidates it and nothing else does. |
| `write-playground-project`     | `nx:run-commands`         | Materialises one example's playground project on disk (`--example <page>/examples/<n>`, `--out <dir>`, `--allow-unpublished`). Not cached; used by `.github/workflows/playground.yml`.                                                                                                                                                              |
| `check-doc-api`                | `nx:run-commands`         | Runs `scripts/check-doc-api.mjs` — compares each library's `CLAUDE.md` API tables against the extracted JSON. `dependsOn: ['extract-api']`. Cacheable. See §9c.                                                                                                                                                                                     |
| `build`                        | `@nx/angular:application` | Entry: `src/main.ts`. Plugins: `mdx-transform.ts`. `dependsOn: ['extract-api', 'generate-playground-versions']`. Bundles `styles.scss`. Copies `public/**` and `pages/**/examples/**/*` as static assets.                                                                                                                                           |
| `serve`                        | `@nx/angular:dev-server`  | Reads plugins from build target. `dependsOn: ['extract-api', 'generate-playground-versions']`. Full HMR for MDX changes.                                                                                                                                                                                                                            |
| `test`                         | `@nx/vitest:test`         | Vitest via `vite.config.mts`. `dependsOn: ['extract-api', 'generate-playground-versions']` — see below. Cacheable. Run it as `yarn nx test docs`.                                                                                                                                                                                                   |
| `lint`                         | `@nx/eslint:lint`         |                                                                                                                                                                                                                                                                                                                                                     |
| `serve-static`                 | `@nx/web:file-server`     | Serves `dist/apps/docs/browser` as SPA.                                                                                                                                                                                                                                                                                                             |

**Important:** `pages/**/examples/**/*` are copied as static assets so `ExampleContainerComponent` can fetch source files by URL at runtime.

**`test` must keep `dependsOn: ['extract-api']`.** `src/generated/api` is
git-ignored and produced only by that target, while `doc-page.component.ts` and
`api-viewer.component.ts` import it directly — and `shared/index.ts` re-exports
doc-page, which every `pages/*/index.ts` imports. Without the dependency, 8 of
the 36 spec files fail at module resolution on a fresh clone (verified), which
is a race no `run-many`/`affected` ordering rescues. The target is explicitly
declared rather than left to the `@nx/vitest` plugin because the workspace
names the inferred target `vite:test`, which CI never selects — see
`.claude/projects/best-practices.md`, "Every project owning specs MUST declare
an explicit `test` target".

### Production budgets (rationale)

`build.configurations.production.budgets` are intentionally set to showcase-app ceilings rather than the tight defaults an end-user library app would use:

| Budget              | Warning | Error  | Why                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------- | ------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `initial`           | `2mb`   | `3mb`  | This is a component **showcase** that eagerly pulls in the app shell (layout, sidebar, action bar, Shiki highlighter, MDX runtime) plus every component demoed above the fold on the landing page (the theme-split, bento, and showcase-reel scenes are `@defer`red out of the initial bundle; ~1.87 MB measured after the 2026-08 landing redesign). The old `500kb`/`1mb` limits were tuned for a lean product app and warned on every build. |
| `anyComponentStyle` | `40kb`  | `48kb` | The full landing page dogfoods several product compositions, including a nested-theme application shell, and compiles to ~35.2kb of component CSS. The ceiling leaves modest headroom while retaining a meaningful guardrail for documentation components.                                                                                                                                                                                      |

Styling is authored with `@use`/`@forward` (no `@import`) throughout, including `apps/docs/src/styles.scss`, which pulls the design system in via `@use '.../libs/styles/src/lib/animations'` and `@use '.../libs/styles/src/lib/index'`.

---

## 9a. MDX Build-Time Processing

### esbuild Plugin

**File:** `apps/docs/plugins/mdx-transform.ts`

Custom esbuild plugin registered via `@nx/angular:application`'s `plugins` option. Transforms `.mdx` files at build time:

- Extracts YAML frontmatter (title, description) via `gray-matter`
- Parses Markdown to HTML via `marked`
- Renders every heading as `<h{2,3,4} id="<slug>" class="docs-heading">` with a
  trailing `<a class="docs-heading__anchor">`
- Extracts h2-h4 headings for Table of Contents data
- Returns a JS module: `export default { html, frontmatter, toc }`

**The heading shape is what the ToC scan and the permalink both read.** The
class opts the heading in (`DocsTocSourceDirective`, §6); the anchor ships
**empty** and with a placeholder `href`, because this HTML reaches the DOM
through `[innerHTML]` — Angular's sanitizer drops an inline `<svg>`, so the
chain glyph is a CSS `mask-image` in the global stylesheet, and the directive
writes the real `href` and the `aria-label` through the DOM API. The module's
build-time `toc` export is kept because `MdxEntry.toc` is public to the app,
but **nothing reads it at runtime** — the rendered ToC is scanned from the DOM,
which is what lets two examples share a heading text.

Runs during both `build` and `serve` with full HMR support — no pre-build step needed.

**Editing the plugin itself needs a `serve` restart.** esbuild loads
`mdx-transform.ts` once when the dev server starts, so a change to the renderer
leaves every already-transformed `.mdx` exactly as it was — the page keeps
serving the old HTML with no error and no rebuild. Editing an `.mdx` file HMRs
normally.

### MDX File Format

```markdown
---
title: Example Title
description: Optional description
---

Markdown content here...
```

**The title lives in frontmatter, never in the body.** `DocPageComponent`
renders `frontmatter.title` as the example's `<h2>` with a permalink beside it;
a leading `## Title` in the body renders a second heading that the ToC then
lists twice. All 474 example files were migrated to this shape in 2026-09 (434
promoted from a leading `## `, 4 whose frontmatter and body both carried the
title de-duplicated). A body `##` is still correct for a **section** below the
title — the ToC lists those as well.

`description` remains optional, and is plain text: it is rendered as `{{ }}`,
not through `marked`, so Markdown in it shows as literal characters.

Frontmatter itself remains structurally optional (`gray-matter` returns an
empty `data` for a file without it) — a file with no `title` simply renders no
heading.

### Table of Contents

`DocsTableOfContentsComponent` (`docs-toc`) renders a sticky right sidebar with:

- Aggregated h2-h4 headings from all examples on the page
- Scroll-spy active heading highlighting
- Smooth scroll on click
- Hidden below 1200px viewport width

`DocsTocService` bridges ToC data from `DocPageComponent` (inside router outlet) to the app shell.

---

## 9b. API Extraction Pipeline (build-time)

The **API** reference shown on each component page (Phase E's `docs-api-viewer`) is
generated at build time from the library source code — no runtime extraction ships to
the client, mirroring the MDX transform.

### Files

| File                                     | Role                                                                                                                                                                                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tools/extract-api.ts`                   | CLI entry run by the `docs:extract-api` target. Enumerates pages, writes JSON + the module map. Side-effecting.                                                                                                                            |
| `tools/api-extractor.ts`                 | Pure ts-morph extraction core (barrel resolution, classification, signal/base-class walking). Unit-tested.                                                                                                                                 |
| `tools/extract-api.spec.ts`              | Vitest spec asserting the extracted shape against real libraries.                                                                                                                                                                          |
| `tools/generated-output.ts`              | `syncGeneratedDir()` — writes the output directory in place: unchanged files untouched, changed files renamed into place, stale entries pruned. Unit-tested.                                                                               |
| `tools/generated-output.spec.ts`         | Vitest spec for the writer (untouched mtime/inode, replacement, pruning).                                                                                                                                                                  |
| `tools/playground-manifest.ts`           | Resolves the playground's npm versions and peer graph from the workspace root `package.json`. Pure, unit-tested through the corpus spec.                                                                                                   |
| `tools/generate-playground-versions.ts`  | CLI run by `docs:generate-playground-versions`. Writes `src/generated/playground-versions.ts`. Side-effecting.                                                                                                                             |
| `tools/playground-corpus.ts`             | Reads docs examples off disk in the shape the runtime hands the payload builder. Shared by the sweep and the disk writer.                                                                                                                  |
| `tools/playground-corpus.spec.ts`        | Sweeps all 474 examples through `createPlaygroundProject`; asserts the blocked set is exactly twenty-one, that each mounts the selector the TypeScript parser reads off its default export, and that the version table is freshly derived. |
| `tools/write-playground-project.ts`      | CLI run by `docs:write-playground-project`. Materialises one example's project for the networked CI job. Side-effecting.                                                                                                                   |
| `src/app/shared/api-viewer/api.types.ts` | The `ApiEntry` / `ApiSymbol` / `ApiMember` / `ApiMethod` contract shared with the viewer (Phase E).                                                                                                                                        |
| `src/generated/api/<name>.json`          | **Git-ignored.** One `ApiEntry` per documented library.                                                                                                                                                                                    |
| `src/generated/api/index.ts`             | **Git-ignored, generated.** `apiEntryLoaders` — lazy `() => import('./<name>.json')` map keyed by page.                                                                                                                                    |

### How it works

- **Runner:** `node node_modules/jiti/lib/jiti-cli.mjs apps/docs/tools/extract-api.ts` (jiti runs the
  TS entry; ts-morph parses the library sources itself). Runs in ~1–2s over the whole workspace.
- **Page → library mapping:** each typed `docsPages` manifest entry declares
  its `{ family, entry }` API target. Most core pages use their own path;
  aliases such as `form-field` → `form-utils`, package-root families such as
  `editor` and `editor-ai` → `{ family: 'editor', entry: '' }`, and pages
  without API entries are explicit in the same manifest.
- **What is extracted:** every public export of the barrel, classified as
  component / directive / pipe / service / token / type / interface / class. For classes it reads
  `@Component`/`@Directive` `selector` (or `@Pipe` `name`), the class JSDoc, signal `input()` /
  `input.required()` / `model()` / `output()` members (name, resolved type with generics preserved,
  default, required flag, JSDoc), and public methods. **Coerced booleans**
  (`transform: coerceBooleanProperty`) surface as `boolean`. **Base classes are walked**
  (e.g. `FormControlBase`, `MlvOverlayHostBase`) so inherited inputs/outputs/methods are included and
  tagged `inherited` / `inheritedFrom`. A `model()` yields both an input and a `<name>Change` output.
  `_`-prefixed and `@internal` / `@private` members are excluded.
- **Wiring & freshness:** `docs:extract-api` is a `dependsOn` of `docs:build` and `docs:serve`, so the
  JSON is always regenerated (or cache-restored) before a build/serve. `src/generated/` is git-ignored;
  `resolveJsonModule` is enabled in `tsconfig.app.json` so the generated map compiles.
- **Regenerated in place, never from scratch.** The dev server watches `src/generated/api`, and
  `index.ts` is a static import of the API viewer — if it vanishes for one watcher tick the
  incremental build fails ("Could not resolve ../../../generated/api") and the server stays in that
  failed state until an unrelated source file changes. `syncGeneratedDir()` therefore leaves
  byte-identical files untouched (no mtime bump, no rebuild), writes a changed file to a temporary
  sibling and renames it into place, and prunes stale entries only after every current file exists.
  Running `docs:extract-api` beside a live `docs:serve` is safe.

### Regenerate manually

```bash
NX_PREFER_NODE_STRIP_TYPES=false yarn nx run docs:extract-api
```

---

## 9c. Documentation ↔ declared-API check

`scripts/check-doc-api.mjs` (Nx target `docs:check-doc-api`, `dependsOn:
['extract-api']`) guards the hand-written library references against the API the
extractor reads out of the sources. Those references are what
`scripts/generate-ai-docs.mjs` ships to consumers verbatim, so a stale row there
becomes a documented API that does not exist.

```bash
yarn nx run docs:check-doc-api            # failures only (CI gate)
node scripts/check-doc-api.mjs --strict   # warnings fail too
node scripts/check-doc-api.mjs --json     # machine-readable report
```

- **Mapping** — each `src/generated/api/<page>.json` is resolved to its library
  through the same `API_OVERRIDES`/`{ family: 'core', entry: page }` rule
  `apiFor()` uses in `app.routes.ts`, then to its markdown the way
  `generate-ai-docs.mjs` resolves it (`libs-<family>-<name>.md` →
  `libs-<name>.md` → the lib's own `CLAUDE.md`, following a single-line
  `@path` include). Pages that alias one library (`button-group`,
  `editor-ai`, …) are checked once. Pages with no API target and reference
  documents with no docs page are listed with the reason.
- **Failures** — a documented input/output/model/method absent from the
  declared API, printed as `file:line — Symbol.member: …`.
- **Warnings** — declared members the reference never mentions, plus documented
  headings naming a symbol the barrel does not export.
- **Known extractor blind spots**, handled by the script rather than by editing
  the docs: `hostDirectives`-exposed bindings (`mlvDensity`, the
  `@angular/aria` patterns) are read straight from the library sources;
  interfaces/types/tokens carry no extracted members; and sections headed
  `Protected …` / `Internal …` are skipped, because the extractor deliberately
  drops non-public and `@internal` members.

---

## 10. How to Add a New Page

1. **Create the page directory:** `apps/docs/src/app/pages/<name>/`

2. **Create `index.ts`:**

   ```ts
   @Component({
     imports: [DocPageComponent],
     changeDetection: ChangeDetectionStrategy.OnPush,
     template: `<docs-page [meta]="meta" [examples]="examples" header="<name>" />`,
   })
   export class MyPageComponent {
     examples = new Array(N).fill(0).map((_, i) => i + 1);
     readonly meta: DocPageMeta = { title: '...', description: '...' };
   }
   ```

3. **Create example directories** `examples/1/` … `examples/N/` each with:
   - `index.ts` — `export default class` (required)
   - `index.html`, `index.scss` (optional)
   - `index.mdx` (optional, Markdown shown above the preview)

4. **Register the route and its group/API metadata** in the typed manifest in
   `app.routes.ts`. The sidebar and API extractor update automatically.

5. **Update this file** when the application architecture or conventions change.
