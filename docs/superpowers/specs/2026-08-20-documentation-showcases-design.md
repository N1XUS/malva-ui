# Malva UI documentation showcases and saved views design

**Date:** 2026-08-20

**Status:** Approved for implementation

**Scope:** Documentation shell, full-size showcases, Page composition, smart filters, data-table presentation state, and saved view variants

## Selected visual direction

The following approved images are the visual source of truth for this work:

- [Showcase index — direction 3](./assets/2026-08-20-showcase-index.png): a quiet, scannable two-column catalog of large application previews.
- [Data Operations — filter direction 2](./assets/2026-08-20-data-operations-view-library.png): a persistent Views sidebar with System, Team, and My views; natural-language filter chips; explicit read-only state; and permission-aware create, clone, and update actions.

The images define hierarchy, density, and composition rather than a new theme. Implementation will use Malva tokens, components, typography, and icons instead of reproducing pixels with one-off styling.

## Goal

Make Malva UI feel premium when its components are combined, without weakening the existing component-reference documentation.

The finished documentation should do three jobs clearly:

1. **Docs** explain individual APIs, states, accessibility, and usage.
2. **Showcases** prove that Malva components compose into convincing products at realistic scale.
3. **Cross-links** connect each primitive to the product context where it is most useful.

Success means a visitor can move from a component contract to a full application example, inspect the same component in realistic density, and understand which Malva primitives create the result.

## Non-goals

- Rebranding Malva UI or replacing its existing token system.
- Turning every numbered docs example into a miniature application.
- Embedding multiple live applications on the showcase index.
- Implementing backend persistence, authorization, or multi-user synchronization for saved views.
- Making the data table own domain-specific view names, scopes, or permissions.
- Using the browser Fullscreen API. Complex examples open as normal routes and never take over Codex or the user's desktop.
- Rewriting healthy primitives solely to make their docs pages look busier.

## Decisions and alternatives

### One Angular app, three route experiences

**Chosen:** keep the homepage, component docs, and showcases in the existing `docs` Angular application. Give docs and showcases separate shells while sharing one app bar.

This preserves lazy loading, the route manifest, theme/locale preferences, and dogfooding of published Malva packages. It also lets component pages link directly to composed examples without crossing application boundaries.

**Rejected:** create a second showcase application. It would duplicate shell state, deployment configuration, global styles, and accessibility infrastructure while making cross-navigation feel like a product switch.

### Dedicated full-size showcase routes

**Chosen:** use `/showcases/...` routes with only the shared app bar and the showcase itself. The showcase index uses captured raster previews linked to those routes.

**Rejected:** continue relying on inline fullscreen previews. The current docs column makes complex components appear miniature, native fullscreen disrupts the desktop app, and embedding several live applications creates excess landmarks, initial JavaScript, and interaction ambiguity.

### Generic saved-view composition

**Chosen:** add a reusable `@malva-ui/core/view-variant` package. It renders and coordinates named variants but remains generic over the state being saved. The host owns persistence and authorization.

**Rejected:** put saved variants inside `MlvSmartFilterBar`. A saved view includes table presentation as well as filters and would make the filter component responsible for persistence, ownership, permissions, and unrelated column state.

**Rejected:** put saved variants inside `MlvDataTable`. This would couple a general table to domain concepts such as System, Team, and My views, and prevent the same variant UI from controlling cards, charts, or other result surfaces.

## Information architecture

### Shared app bar

Extract one `DocsAppBar` from the current docs shell action bar and homepage header. It is used by the homepage, documentation shell, and showcase shell.

The primary navigation contains exactly two pill links:

- **Docs** — active on `/`, `/getting-started`, and all component-reference routes.
- **Showcases** — active on `/showcases` and every descendant route.

The trailing region retains the existing GitHub, theme, locale/preferences, and settings behavior where applicable. Those actions stay visually subordinate to the two primary destinations. On narrow screens, the two labels remain visible; optional trailing actions collapse into the existing preferences menu before primary navigation is reduced.

The app bar is one semantic `header` and one `nav`, has a stable height, and exposes no page-specific content. Each page retains exactly one `main` landmark below it.

### Route tree

```text
/
├── homepage                              Shared app bar + homepage content
├── getting-started                       Docs shell
├── <component-route>                     Docs shell
│   └── api                               Existing componentless API child
└── showcases                             Showcase shell
    ├── index                             App bar + showcase catalog
    ├── project-workspace                 App bar + full application canvas
    ├── support-inbox                     App bar + full application canvas
    ├── publishing-workspace              App bar + full application canvas
    ├── data-operations                   App bar + full application canvas
    └── settings-access                   App bar + full application canvas
```

`ShowcaseShell` contains the shared app bar and a nested router outlet. It intentionally has no docs navigation sidebar or table of contents.

### Showcase registry

The showcase route manifest is the single source of truth for routes, category filtering, cards, metadata, and preview assets.

```ts
type ShowcaseCategory =
  | 'workspaces'
  | 'communication'
  | 'data'
  | 'content'
  | 'settings';

interface ShowcaseDefinition {
  slug: string;
  title: string;
  summary: string;
  category: ShowcaseCategory;
  componentNames: readonly string[];
  previewAsset: string;
  loadComponent: () => Promise<unknown>;
}
```

The category control is Malva `mlv-segmented` with **All**, **Workspaces**, **Communication**, **Data**, **Content**, and **Settings**. The selected value is stored in the `category` query parameter so filtered views are linkable and survive reload. An absent or invalid value resolves to **All**.

The index follows approved direction 3:

- two columns at wide desktop sizes and one column below tablet width;
- large, real screenshots rather than illustrations or skeletal placeholders;
- title, short outcome-oriented description, category, and concise component inventory;
- the whole preview is a link with an explicit accessible name;
- no live application, iframe, autoplay, or nested landmark inside a card;
- image aspect ratio and crop remain consistent so the grid is calm even when screenshots differ internally.

Preview images are recaptured from the implemented route at a fixed viewport after interactions and loading settle. They are versioned assets, not generated mockups left disconnected from the actual implementation.

## Showcase compositions

### Project Workspace

The flagship Page composition proves a shell with two start sidebars, one central canvas, and one end inspector:

1. compact application rail for workspace-level destinations;
2. expanded project navigation sidebar;
3. central `main[mlvPage]` with breadcrumb, page header, summary cards, grouped task table, and timeline;
4. end inspector with preview, owner, status, due date, tags, collaborators, and activity.

Primary interactions: change the active navigation item, switch Summary/Activity/Files, expand task groups, change a task status, collapse the project sidebar, and close/reopen the inspector. The center remains the only main landmark.

### Support Inbox

The reference composition is the supplied FloraStore support desk: channel navigation, conversation list, conversation canvas, composer, and customer details.

Primary interactions: select a conversation, filter the inbox, open the composer menu, send a mock reply, open a message menu, toggle resolved state, and collapse/reopen the customer inspector. Dialog, Drawer, Menu, Tooltip, Toast, and Notification are demonstrated in this realistic shell with placements constrained below the shared app bar.

### Publishing Workspace

This route gives Editor and AI Kit the wide product canvas they need. It combines document navigation, the editor surface, review/version controls, workflow status, collaborators, and a publish action dock.

Primary interactions: edit content, switch formatting controls, open the AI menu, accept/reject a suggestion, inspect a version, change draft status, and open the publish confirmation dialog. File Upload supplies media insertion states.

### Data Operations

This route follows the approved filter direction 2. It combines:

- a Views sidebar with search and System, Team, and My views;
- natural-language filter chips and an Add filter action;
- a read-only/dirty status surface with Reset and Duplicate or Update actions;
- table search, sort, columns, export, pagination, selection, and row details;
- realistic accounts, owners, plan values, health, renewal dates, and activity.

Primary interactions: select a view, search views, add/edit/remove a filter, modify sorting or visible columns, duplicate a locked system view, create a personal view, update an editable view, reset local changes, and open a row inspector.

### Settings & Access

This route supplies the context missing from form controls. It combines a settings navigation sidebar with a tabbed form for profile, notifications, security, and team access.

Primary interactions: edit fields, toggle notification groups, manage tokens and roles, change a Time Picker value, open confirmation Dialog/Drawer flows, validate errors, save successfully, and see Toast/Notification feedback in a shell-aware position.

## Page shell extension

`MlvPageShell` already projects every element matching `[mlvPageSidebar]` into a flex row. The design formalizes this existing compositional behavior instead of adding numbered sidebar selectors.

- Zero, one, or two start-sidebar hosts may carry `[mlvPageSidebar]`.
- One optional end inspector carries `[mlvPageEndSidebar]`.
- DOM order defines start-sidebar order and keyboard reading order.
- Each sidebar owns its own width, collapse state, and responsive mode.
- Shell styles supply separators and prevent doubled borders between adjacent chrome regions.
- The content track remains `min-width: 0` so tables and editors do not force the shell wider than the viewport.
- At breakpoints, the expanded start sidebar and end inspector can independently switch to off-canvas drawers while the icon rail remains fixed.

No `mlvPageSidebar2`, arbitrary column-count input, or domain-specific inspector API is added. Tests and Page documentation will make multiple matching start slots an explicit supported contract.

## Saved view variants

### Package boundary

Create `libs/core/view-variant`, publicly exported as `@malva-ui/core/view-variant`. It is a reusable navigation and action layer for named snapshots of arbitrary state.

The component family contains:

- `MlvViewVariantList` — searchable, grouped variant navigation suitable for a Page sidebar or normal surface;
- `MlvViewVariantStatus` — dirty/read-only explanation and context-sensitive actions;
- public state, scope, capability, and event types;
- optional templates for leading icon, metadata, count, and empty state.

The package does not perform HTTP requests, inspect user roles, or serialize application state by itself.

### Public model

```ts
type MlvViewVariantScope = 'system' | 'team' | 'personal';

interface MlvViewVariantCapabilities {
  clone: boolean;
  update: boolean;
  rename: boolean;
  delete: boolean;
  share: boolean;
}

interface MlvViewVariant<TState> {
  id: string;
  name: string;
  scope: MlvViewVariantScope;
  state: TState;
  capabilities: MlvViewVariantCapabilities;
  locked?: boolean;
  resultCount?: number;
  ownerLabel?: string;
  revision?: string | number;
  updatedAt?: Date | string;
}

interface MlvViewVariantCreateRequest<TState> {
  name: string;
  scope: Exclude<MlvViewVariantScope, 'system'>;
  state: TState;
  sourceId?: string;
}
```

`MlvViewVariantList` is controlled by the host:

- required variants input;
- active variant id model;
- query model for the local list search;
- `groupOrder`, group labels, and optional group icons;
- `canCreate` and `createScopes` inputs;
- `variantSelect`, `createRequest`, `renameRequest`, `deleteRequest`, and `shareRequest` outputs;
- `busyAction` input identifying the pending action and variant;
- `errorMessage` input plus a retry/dismiss output.

`MlvViewVariantStatus` receives the active variant, dirty state, creation capability, and pending action. It emits `resetRequest`, `cloneRequest`, `updateRequest`, and `createRequest`. Keeping these operations on the status surface makes its permission-dependent message and visible actions one coherent contract.

Actions are conditional, not merely disabled decoration:

- **New view** renders only when `canCreate` is true and at least one create scope is available.
- **Duplicate view** renders only when the active variant has `capabilities.clone`.
- **Update view** renders only when it has `capabilities.update` and working state is dirty.
- Rename, delete, and share appear only in the item's overflow menu when their capabilities are true.
- Locked variants display a lock icon with a textual accessible name; the icon never carries the meaning alone.

### Working-state ownership

The host keeps two values:

- `baselineState`: the normalized snapshot from the active variant;
- `workingState`: the current filter and result-surface state.

Dirty state is computed from an application-supplied equality function after normalization. This avoids unstable comparison caused by property order, transient values, or regenerated array instances.

Selecting another view with unsaved changes opens a confirmation dialog with **Discard changes**, **Save as new view** when creation is permitted, and **Cancel**. Selecting the current view is a no-op.

The status surface resolves to one of four explicit modes:

| Variant state | Message | Actions |
| --- | --- | --- |
| Locked and clean | This system view is read-only | Duplicate when allowed |
| Locked and dirty | Duplicate it to save your changes | Reset changes, Duplicate view |
| Editable and dirty | You have unsaved view changes | Reset changes, Update view, Save as new when allowed |
| No active variant | This is an unsaved view | Reset, Save as new when allowed |

Create, clone, and update are request/response operations owned by the host. While pending, only the relevant action is busy; navigation remains available unless switching would discard uncommitted state. Failure keeps working state intact, restores the action, and exposes an inline error plus polite live announcement. Success updates the controlled variants input and baseline before clearing dirty state.

## Smart filter query appearance

`MlvSmartFilterBar` gains an additive `appearance="query"` mode. The current appearance remains the default for backward compatibility, while docs and the Data Operations showcase lead with query mode.

Query mode presents each condition as a readable sentence:

```text
Health is At risk
Renewal within 60 days
Owner is empty
+ Add filter
```

Behavior:

- Clicking a condition opens its field/operator/value editor anchored to that chip.
- Remove is a real button with an accessible label; Backspace removes the focused chip only after it is empty or explicitly selected.
- **Add filter** opens a searchable field menu, excludes fields that cannot repeat, and preserves focus when a condition is added.
- Empty, null, range, relative-date, boolean, single-select, multi-select, and text operators render in human language.
- Long values truncate visually but remain available in an accessible name and tooltip.
- The bar wraps without changing chip height; horizontal scrolling is not required at supported desktop widths.
- An optional grouped expression is summarized as a parenthesized chip, such as `(Region is EU or UK)`, and opens the existing condition editor for the group.
- A clear-all action appears only when at least two removable conditions are active.
- Submit mode retains an explicit Apply action and distinguishes edited conditions from applied conditions. Live mode announces result-count changes politely after debounce.

The existing visible-field checkbox manager is not used in query mode. Discoverability moves into the searchable Add filter menu, and active conditions are always visible on the surface.

### Filter expression contract

Flat `MlvFilterState[]` remains supported. Query mode adds a compatible expression tree for grouped filters:

```ts
type MlvFilterExpression =
  | { kind: 'condition'; condition: MlvFilterState }
  | {
      kind: 'group';
      combinator: 'and' | 'or';
      children: readonly MlvFilterExpression[];
    };
```

The smart filter bar emits the expression. Local tables evaluate it through a shared predicate utility; remote data sources translate it in the host. An adapter converts the existing flat array to a top-level `and` group, preserving current integrations.

## Data-table presentation state

Saved views need table presentation without making the data table aware of view ownership. `MlvDataTable` therefore adds an explicit snapshot API:

```ts
interface MlvDataTablePresentationState {
  sort: MlvSortState | null;
  visibleColumnKeys: readonly string[];
  pinnedStartColumnKeys: readonly string[];
  pinnedEndColumnKeys: readonly string[];
  columnWidths: Readonly<Record<string, number>>;
  perPage: number;
}
```

The component exposes:

- `getPresentationState(): MlvDataTablePresentationState`;
- `applyPresentationState(state: Partial<MlvDataTablePresentationState>): void`;
- `presentationStateChange` after a user commits sort, visibility, pinning, width, or page-size changes.

Applying a state ignores unknown column keys, clamps widths to column constraints, and falls back to current defaults for omitted properties. One coalesced change event follows a user gesture; applying a state programmatically does not echo another event unless explicitly requested. Existing `searchQuery`, `activeFilters`, and `selectedRows` models remain unchanged.

The Data Operations host saves this normalized composite:

```ts
interface AccountsViewState {
  search: string;
  filterExpression: MlvFilterExpression;
  table: MlvDataTablePresentationState;
}
```

Page number, row selection, loading/error status, open overlays, density, and the row inspector are transient and never saved in a view.

## Documentation behavior

### Reference pages stay reference pages

Component pages retain Examples and API tabs, source tabs, density isolation, and the typed route manifest. Their first example should answer “what is this?” immediately. Later examples cover states and forms; one contextual example or showcase link answers “where does it belong?”

Complex examples do not have to live inside the narrow docs canvas. A reference page may show a focused slice and link to the full-size showcase where its surrounding shell is visible.

### Replace native fullscreen

`ExampleContainerComponent` removes its browser-fullscreen action. For examples with a registered full route it renders **Open full example**, a normal router link with an external-canvas icon. It opens in the same tab by default and preserves a `returnTo` query parameter so Back returns to the originating example. Examples without a full route render no expansion control.

The source/preview tabs, copy action, and example title remain. Full-route links are excluded from the docs table of contents.

### Premium composition rules

- Use the existing Malva neutral and semantic tokens; blue is reserved for selected, linked, and primary action states.
- Prefer spacing and separators over a card around every section.
- Use one dominant page surface, optional subordinate panels, and shadows only for overlays or truly floating regions.
- Standard product controls target 36–40 px height; dense table rows target 44–48 px unless a compact mode is explicitly selected.
- Body copy remains at a readable normal size. Metadata can be smaller but must keep contrast and line height.
- Headers establish a clear title/action relationship before tabs, summaries, or filters.
- Real names, dates, values, states, avatars, and errors replace generic “Item 1” content.
- Open-state examples reserve overlay space and keep menus, toasts, notifications, and drawers below the shared app bar.
- Responsive reductions remove secondary columns before shrinking every component.

## Audit resolution matrix

Every audited route receives an explicit treatment. “Context link” means a prominent, named link from the reference page to the relevant full-size route, not an unlabelled promotional card.

| # | Route | Planned response |
| ---: | --- | --- |
| 1 | Accessibility | Retain the reference content; add a testable checklist and links to keyboard/focus demonstrations in every showcase. |
| 2 | Accordion | Lead with a settings/content group example in Settings & Access; retain the isolated variants afterward. |
| 3 | Action Bar | Replace the nearly empty first preview with the shared Malva app bar and link to the showcase shell contract. |
| 4 | Animated Presence | Retain the focused motion demo; add a reduced-motion comparison and connect it to panel transitions in Project Workspace. |
| 5 | Alert | Retain the component matrix; add inline save/error alerts to Settings & Access. |
| 6 | Avatar | Retain coverage; add realistic people, fallback initials, image failure, and presence use in composed pages. |
| 7 | Avatar Group | Add collaborator names/count disclosure and use it in Project and Publishing workspaces. |
| 8 | Badge | Keep semantic variants, measure contrast, and demonstrate status badges in tables and workflow headers. |
| 9 | Bottom Nav | Reframe the leading example in a mobile viewport with safe-area padding and a Settings & Access mobile state. |
| 10 | Chip | Lead with query filters, tags, and removable selections rather than the color matrix; link to Data Operations. |
| 11 | Breadcrumb | Retain the reference example and connect it to Project and Publishing page headers. |
| 12 | Button | Retain comprehensive states; add an action-hierarchy example using one primary, one secondary, and quiet actions. |
| 13 | Button Group | Lead with a real editor/table toolbar group and document when connected borders are appropriate. |
| 14 | Split Button | Make the open menu state the first visual example and use Add account/export actions in Data Operations. |
| 15 | Toggle Button | Add formatting and view-mode groups from Publishing Workspace; retain isolated state coverage. |
| 16 | Input | Replace generic text with profile/account fields in a realistic form and link to Settings & Access. |
| 17 | Number Input | Add quantity, threshold, min/max, and invalid business-value examples within a fieldset. |
| 18 | Empty State | Add clear title, explanation, primary action, optional secondary action, and filtered/no-data variants. |
| 19 | Expand | Retain mechanics; show lazy settings help and collapsible customer details in composed pages. |
| 20 | Form | Make the Settings & Access route the signature composition and retain form-mode/API examples. |
| 21 | Form Field | Keep the strong reference; add error, hint, async validation, and dense sidebar usage at normal scale. |
| 22 | Filter | Lead with query appearance and saved-view integration; retain the classic bar as a compatibility example. |
| 23 | Select | Retain forms coverage; add plan, role, and status selections in composed settings/data flows. |
| 24 | Autocomplete | Move a populated open state above binding variants and show keyboard selection with realistic accounts. |
| 25 | Combobox | Retain coverage; add assignee and collaborator search in Project Workspace. |
| 26 | Copy to Clipboard | Remove raw-looking introductory content and show API key, command, success feedback, and keyboard activation. |
| 27 | Data Table | Link to full-width Data Operations, add view-state capture/apply, and keep feature-specific reference examples. |
| 28 | Search Field | Lead with search plus result count/empty state and use it for Views and conversations. |
| 29 | Segmented | Use it for showcase categories and demonstrate router-link, count, compact, and responsive label behavior. |
| 30 | Tokenizer | Increase the example canvas and use realistic tags/recipients with overflow and validation states. |
| 31 | Checkbox | Raise target/label rhythm where needed, verify contrast, and demonstrate table selection and permissions. |
| 32 | Color Picker | Give the open panel adequate width and show theme/accent selection in Settings & Access. |
| 33 | Radio | Raise target/label rhythm where needed, verify contrast, and show a meaningful account preference group. |
| 34 | Rating | Retain the healthy primitive and add read-only/editable feedback context with clear labels. |
| 35 | Calendar | Refine normal-scale density/contrast and pair it with due-date planning in Project Workspace. |
| 36 | Day Picker | Retain forms coverage and add a due-date field with validation and locale evidence. |
| 37 | Date Range Picker | Make the open dual-calendar state primary and demonstrate reporting range selection in Data Operations. |
| 38 | Density | Demonstrate full composed regions at each density; explain that responsive layout is separate from density. |
| 39 | Dropdown | Replace the abstract panel with a convincing selectable/action panel and an open-state-first example. |
| 40 | Editor | Link immediately to Publishing Workspace and keep focused API examples in a wider reference canvas. |
| 41 | Editor AI | Put the interaction before long prose, link to Publishing Workspace, and lead with an active suggestion flow. |
| 42 | Divider | Retain the primitive and show correct use between toolbar groups and sidebar sections. |
| 43 | Popup | Make an anchored open state primary, document collision behavior, and show it inside a shell. |
| 44 | Link | Retain coverage; add inline, navigation, external, and quiet-link hierarchy in realistic copy. |
| 45 | Dialog | Lead with a complete confirmation/form dialog and use publish/discard flows in composed routes. |
| 46 | Drawer | Add size presets/max content measure, one close model, dense details content, and responsive off-canvas proof. |
| 47 | List | Add grouped rows with icons, metadata, unread/selected states, and use them in Views and conversations. |
| 48 | Scrollbar | Increase the live canvas and demonstrate long navigation/editor panels without tiny typography. |
| 49 | Sidebar | Lead with a complete shell, show rail/expanded/off-canvas states, and link to Project Workspace. |
| 50 | Page | Make Project Workspace the flagship; formalize two start sidebars plus one end inspector. |
| 51 | Skeleton | Pair each skeleton with its loaded result and prevent layout shift in table, card, and inspector examples. |
| 52 | Slider | Review track/target size and add threshold/volume contexts with keyboard value announcements. |
| 53 | Split Pane | Move the demonstration to a full-width canvas and use it in Publishing review/version comparison. |
| 54 | Status Indicator | Increase contextual scale and show account health, presence, workflow, and labelled states. |
| 55 | Chat | Place it inside Support Inbox with conversation navigation, details, composer actions, and resolved state. |
| 56 | Stepper | Replace abstract steps with a complete invite/onboarding flow including validation and completion. |
| 57 | Timeline | Retain the strong example and use it for project milestones and customer activity. |
| 58 | Toolbar | Lead with editor and table toolbars, including grouping, overflow, labels, and responsive collapse. |
| 59 | Tooltip | Retain the healthy open state, verify delay/Escape behavior, and use labels for icon-only shell actions. |
| 60 | Switch | Review target/label rhythm and show dependent notification/settings states with clear save behavior. |
| 61 | Card | Replace generic cards with media, metadata, status, action, selectable, and summary-card hierarchies. |
| 62 | Tabs | Retain keyboard coverage and demonstrate page-header tabs in Project and Settings compositions. |
| 63 | Title | Retain the typography reference and demonstrate editable/title hierarchy in Publishing Workspace. |
| 64 | Loader | Reduce bar dominance, pair loading with stable content geometry, and prefer skeletons for structural loads. |
| 65 | Menu | Keep coherent behavior, improve content hierarchy, and lead with grouped/destructive/nested open states. |
| 66 | Notification | Add shell-safe placement, stronger content/action hierarchy, queue behavior, and live-region verification. |
| 67 | Pagination | Pair it with Data Operations, strengthen disabled contrast, and verify compact behavior at narrow widths. |
| 68 | PIN Input | Increase presentation scale and add verification, paste, error, resend, and completion context. |
| 69 | Progress | Retain variants and use determinate account/project progress with meaningful labels. |
| 70 | Toast | Add shell-safe placement below the app bar, queue/dismiss behavior, and polite announcement verification. |
| 71 | Textarea | Retain form modes and add message/description fields with count, validation, and resize behavior. |
| 72 | Time Picker | Increase drum width/value contrast/separation, refine focus, and demonstrate it in scheduling settings. |
| 73 | Tile | Add rich media, selected, disabled, multi-select, and application-choice states with visible labels. |
| 74 | Tree | Increase typography at normal density and use it for project/content navigation with lazy loading. |
| 75 | File Upload | Lead with preview, progress, validation error, retry, and completed states; use it in Publishing. |
| 76 | Kbd | Reduce matrix density and group shortcuts by context in Editor and Data Operations. |
| 77 | Infinite Scroll | Add visible loading/end/error/retry evidence and use realistic conversation/activity content. |
| 78 | Internationalization | Retain the reference; add RTL and long-label screenshots from at least one composed showcase. |
| 79 | Layout | Replace the abstract example with shared app bar + shell composition and link to all showcases. |
| 80 | Overlay | Retain architecture content; add a collision/scroll strategy lab and shell-safe open states. |
| 81 | Theming | Retain foundations and capture the showcase index plus one workspace in light and dark themes. |
| 82 | Utils | Retain reference material and link each utility to the composed route where its behavior is visible. |

### Clicked/open-state resolutions

| # | Audited state | Planned response |
| ---: | --- | --- |
| 83 | Dialog opened from `Open Dialog` | Keep the healthy focus/hierarchy baseline; replace minimal body content with a complete decision or form flow. |
| 84 | Drawer opened from `Open Drawer` | Constrain measure, remove redundant close affordances, use dense inspector content, and prove narrow/off-canvas sizes. |
| 85 | Menu opened from `Open Menu` | Keep keyboard behavior; improve grouping, icon rhythm, labels, destructive treatment, and submenu context. |
| 86 | Tooltip shown by focusing `Save` | Preserve association/focus behavior; verify Escape, delay, collision, and reduced-motion behavior in shell chrome. |
| 87 | Toast shown from `Show toast` | Anchor to a shell overlay lane below the app bar, support queues, and verify polite announcements. |
| 88 | Notification shown from `Show notification` | Use the same safe lane, strengthen hierarchy/actions, and verify announcement semantics without stealing focus. |
| 89 | Time Picker opened from the first field | Increase drum measure, selected-row contrast, separators, scroll affordance, and keyboard focus visibility. |

## Overlay lane and feedback behavior

Showcase shells expose a top safe-area custom property derived from the shared app bar height. Toast and Notification containers use it for top positions; menus, popups, tooltips, dialogs, and drawers continue to use CDK overlay collision strategies.

- Toasts are brief, non-blocking, and normally polite.
- Notifications may include an icon, title, body, and actions but never move focus automatically.
- Destructive or blocking failures remain inline or in a dialog rather than disappearing in a toast.
- Repeated feedback queues or coalesces by key instead of stacking over navigation.
- All dismiss actions are keyboard reachable and have accessible names.

## Responsive behavior

| Width | Showcase behavior |
| --- | --- |
| 1440 px and above | Full desktop composition; all shell columns visible when the showcase calls for them; two-column index. |
| 1024–1439 px | Secondary inspector collapses first; expanded start sidebar may narrow; central task remains full fidelity. |
| 768–1023 px | Expanded navigation and inspector become independent drawers; icon rail may remain; index is one column. |
| Below 768 px | One primary content column; sidebar/drawer access through labelled controls; tables retain horizontal access or switch to an intentional compact presentation; app-bar pills remain visible. |

Responsive states never simulate density by shrinking typography and hit targets. Each off-canvas region traps focus only while modal, closes on Escape, restores focus to its trigger, and respects reduced motion.

## Accessibility requirements

- One `header`, one primary `nav`, and one `main` landmark per route.
- Skip link targets the current page's main content, including showcase pages.
- Segmented categories expose selection and work with keyboard and router navigation.
- View groups have headings; list items expose selected, locked, count, and menu state without relying on color.
- Unsaved-change confirmation is announced and returns focus correctly.
- Filter chips are individually reachable, editable, and removable; their visual sentence remains a coherent accessible name.
- Tables preserve native table semantics unless experimental grid navigation is deliberately enabled.
- Overlay feedback remains below the app bar visually and in the correct live region semantically.
- All visible text and non-text contrast is measured in light and dark themes; disabled content remains distinguishable.
- Screenshots are decorative when adjacent text already names the showcase; otherwise they receive outcome-oriented alt text.
- Animations honor `prefers-reduced-motion` and never block completion.

## Loading, empty, and error states

Every showcase has deterministic mock data and explicit state controls available in development/tests.

- Route loading preserves the app bar and shows a stable skeleton matching the final major columns.
- Empty results explain whether no data exists or filters removed all matches; filtered empty states include Clear filters.
- Table request failure preserves current filters/views and offers Retry inline.
- View create/clone/update failure preserves working state and names the failed operation.
- Missing or invalid variant ids fall back to a defined default and replace the URL without adding browser history.
- Missing preview assets show text content without a fake image placeholder.
- Screenshot capture waits for fonts, image decode, animations, and pending mock requests before recording.

## Verification strategy

### Contract tests

- Shared app bar appears on homepage, docs, and showcases with exactly Docs and Showcases primary pills and correct active state.
- Showcase registry derives routes and catalog cards without a second hand-maintained list.
- Category query parameter parses, serializes, and rejects invalid values deterministically.
- Multiple `[mlvPageSidebar]` projections preserve DOM order and do not collapse the content track.
- View capability matrices render only allowed create, clone, update, rename, delete, and share actions.
- Dirty-state normalization excludes transient state and handles create/clone/update success and failure.
- Filter expression adapters preserve existing flat filters and evaluate grouped AND/OR expressions correctly.
- Data-table snapshot application ignores unknown columns, clamps widths, and emits no feedback loop.

### Interaction and accessibility tests

- Keyboard traversal, Escape behavior, focus restoration, and announcements for Dialog, Drawer, Menu, Tooltip, Toast, Notification, and Time Picker.
- View switching with clean and dirty working state, including locked and editable variants.
- Filter chip add/edit/remove, searchable field selection, wrapping, submit/live modes, and result announcements.
- Responsive sidebar and inspector drawers at desktop, tablet, and mobile breakpoints.
- Axe checks for every showcase route in its default state plus the seven audited open states.

### Visual regression

- Capture every showcase at 1600×1000 and the primary responsive breakpoint.
- Capture the showcase index in All and one filtered category.
- Capture Data Operations in locked-clean, locked-dirty, editable-dirty, and unsaved states.
- Capture the seven overlay/open states with the shared app bar present.
- Compare implementation screenshots with the two approved references at the same viewport before accepting the first baseline.
- Re-run the complete 82-route screenshot inventory after docs changes to ensure reference pages did not regress.

## Delivery sequence

1. Extract the shared app bar; add ShowcaseShell, route manifest, category index, and real-route preview pipeline; remove native fullscreen behavior.
2. Formalize and test multiple Page start sidebars plus shell overlay safe-area behavior.
3. Add the generic view-variant package, Smart Filter query appearance/expression model, and data-table presentation snapshot API.
4. Build Data Operations first because it exercises the new component APIs and selected filter direction.
5. Build Project Workspace, Support Inbox, Publishing Workspace, and Settings & Access using existing Malva components.
6. Apply the audit matrix to all 82 reference pages and the seven open states; add contextual links and targeted component refinements.
7. Capture real showcase previews, run interaction/accessibility/visual tests, and update project documentation and the monorepo index for the new library.

Each phase is independently testable. The full-page compositions come only after their shared shell or component API is stable, and the showcase index switches from approved concept images to implementation screenshots before release.

## Resolved product decisions

- Showcase direction: approved direction 3.
- Filter and saved-view direction: approved direction 2.
- Application structure: one docs app with separate Docs and Showcase shells.
- Primary app-bar destinations: exactly Docs and Showcases.
- Showcase categorization: Malva segmented control backed by a query parameter.
- Complex example expansion: normal routed page, never native fullscreen.
- Saved views: generic host-controlled component family, not a data-table or filter persistence feature.
- Permission behavior: create, clone, and update render conditionally from explicit capabilities.
- Initial full-size showcases: Project Workspace, Support Inbox, Publishing Workspace, Data Operations, and Settings & Access.
- Page geometry: repeated start-sidebar slots in DOM order plus one optional end inspector.
- Index media: screenshots captured from implemented routes rather than live embedded applications.
