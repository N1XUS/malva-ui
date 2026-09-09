---
# Library: list

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library, including component, directive, service, styling, testing, or public API changes.

## Overview

The List library (`@malva-ui/core/list`) provides a composable vertical list system with:

- a base `mlv-list` container
- plain or linked `mlv-list-item` rows
- richer row layouts via semantic content slots for media, title, byline, meta, and trailing actions
- collapsible item groups
- keyboard-accessible single and multi-select behavior backed by `@angular/aria`'s listbox pattern (`ngListbox`/`ngOption`)

## Public API

Exported from `libs/core/list/src/index.ts`:

| Export | Kind | Description |
|--------|------|-------------|
| `MlvList` | Component | List container — `mlv-list` |
| `MlvListVariant` | Type alias | `'plain' \| 'inset'` |
| `MlvListAppearance` | Type alias | `'default' \| 'menu'` — context-specific row styling (standalone vs. overlay panel) |
| `MlvListItem` | Component | List row — `mlv-list-item` |
| `MlvListItemAccent` | Type alias | Semantic accent key or raw CSS color for the leading bar |
| `MlvListItemMedia` | Directive | Leading rich-media slot — `[mlvListItemMedia]` |
| `MlvListItemTitle` | Directive | Title slot — `[mlvListItemTitle]` |
| `MlvListItemByline` | Directive | Secondary text slot — `[mlvListItemByline]` |
| `MlvListItemMeta` | Directive | Inline headline meta slot — `[mlvListItemMeta]` |
| `MlvListItemActions` | Directive | Trailing actions slot — `[mlvListItemActions]` |
| `MlvListItemPrefix` | Directive | Legacy leading slot — `[mlvListItemPrefix]` |
| `MlvListItemSuffix` | Directive | Legacy trailing slot — `[mlvListItemSuffix]` |
| `MlvListItemTemplate<T>` | Directive | Custom item template — `[mlvListItemTemplate]` |
| `MlvListItemTemplateContext<T>` | Interface | Template context — `{ $implicit: T }` |
| `MlvListItemLink` | Component | Anchor item wrapper — `a[mlvListItemLink]` |
| `MlvListItemGroup` | Component | Collapsible list section — `mlv-list-item-group` |
| `MlvListSelectable<T>` | Directive | Selectable list — `mlv-list[selectable]` |
| `MlvListItemSelectable` | Directive | Selectable option row — `mlv-list-item[value]` |

---

## Components

### `MlvList`

**File:** `libs/core/list/src/lib/list/list.ts`
**Selector:** `mlv-list`
**Change Detection:** `OnPush`
**Host class:** `mlv-list`

Template: `<ng-content />`

**Provides `MLV_LIST`** (`libs/core/list/src/lib/list/list-token.ts`) — an `InjectionToken<MlvListAccessor>` carrying the list's `variant` **and `listRole`** signals, `useExisting: forwardRef(() => MlvList)`. It is **not** exported from the barrel and carries no compatibility promise. Both members are there for the same reason — they are the list-level decisions that change what a descendant _renders_, not merely how it looks: `MlvListItemGroup` reads `variant` to tell that `inset` pins its content open and render a section label instead of a disclosure toggler (#220), and `listRole` to derive which ARIA roles it may claim (#224). A descendant that only needs to _look_ different uses the cascade instead — `MlvList` stamps `mlv-list--<variant>` and `mlv-list--appearance-menu` on its own host. Inject it `{ optional: true }` — every list child is usable outside a list. Resolution is by element injector, so it is found only by a child written lexically inside `<mlv-list>`, not by one projected in from elsewhere.

#### Inputs

| Name         | Type                | Default     | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------ | ------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `listRole`   | `string`            | `'list'`    | WAI-ARIA role for the host element. Override to `'menu'` when used as a menu container.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `variant`    | `MlvListVariant`    | `'plain'`   | Visual variant. `'plain'` — hairline-separated rows, no per-row card: the container has zero gap and paints a single `border-top` (`--mlv-border-subtle`) between consecutive `mlv-list-item` rows (never on the row itself), each row's own `--mlv-list-item-radius` is `0`, and `--mlv-list-item-bg` is `transparent` at rest — a row gets a fill only on hover, selection, or focus (SL-R5). `'inset'` — iOS Settings-style grouped look: rows sit on a raised surface inside a sunken, rounded card; consecutive rows are joined by inset dividers (not the plain variant's container hairline — `:not(.mlv-list--inset)` scopes it out) and group headers become sticky uppercase section labels.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `appearance` | `MlvListAppearance` | `'default'` | Context-specific row styling, orthogonal to `variant`. `mlv-list` is a shared primitive used both as a standalone content list and as the panel container inside overlays (select/combobox/autocomplete dropdown, `mlv-menu`, popover menus like the tabs overflow / breadcrumb overflow / drawer-sections menu). `'default'` emits no modifier class — the airy SL-R5 standalone look above. `'menu'` adds `.mlv-list--appearance-menu`, which (a) suppresses the `'plain'`-variant hairline separator (`list.css` — `:not(.mlv-list--appearance-menu)` scopes it out) and (b) restores the pre-harmonization compact overlay rhythm on every descendant `mlv-list-item` via an ancestor-selector override in `list-item.scss`: `--mlv-list-item-padding-block: var(--mlv-spacing-2)` (was `--mlv-spacing-3`) and `--mlv-list-item-radius: var(--mlv-radius-m)` (was `0`), so the row has rounded corners for the hover/selection pill instead of being clipped by the container. Every internal overlay consumer (`mlv-dropdown-panel`, `mlv-menu`, tabs overflow popup, breadcrumb overflow popup, `mlv-drawer-sections`) sets this; standalone/docs list examples stay on the `'default'` appearance. |

---

### `MlvListItem`

**File:** `libs/core/list/src/lib/list-item/list-item.ts`
**Template:** `libs/core/list/src/lib/list-item/list-item.html`
**Styles:** `libs/core/list/src/lib/list-item/list-item.scss`
**Selector:** `mlv-list-item`
**Change Detection:** `OnPush`
**Host class:** `mlv-list-item`

Supports two row compositions:

- legacy row layout: prefix + content + suffix
- rich row layout: media + title/byline/meta + trailing actions

The component automatically switches to the rich layout when any of the rich slot directives are projected.

#### Inputs

| Name       | Type                             | Default      | Description                                                                                                                                                                                                                               |
| ---------- | -------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `itemRole` | `string`                         | `'listitem'` | WAI-ARIA role for the host element. Set `'option'` for selectable rows (required so aria pointer selection can resolve the option), `'menuitem'` inside a menu, etc.                                                                      |
| `unread`   | `BooleanInput`                   | `false`      | Marks the row as unread — the title renders semibold and a leading unread dot is injected before the headline. Matches the inbox / notification-center pattern.                                                                           |
| `accent`   | `MlvListItemAccent \| undefined` | `undefined`  | Optional accent color for the leading bar. Accepts semantic keys (`primary`, `positive`, `negative`, `warning`, `info`, `neutral`) or any raw CSS color value. When set, the accent bar is always rendered regardless of selection state. |

#### Host Behavior

- `[class.mlv-list-item--active]` when child `MlvListItemLink` is router-active
- `[class.mlv-list-item--rich]` when rich slots are present
- `[class.mlv-list-item--unread]` when `unread()` is truthy
- `[class.mlv-list-item--has-accent]` when `accent()` is set
- `[style.--mlv-list-item-accent]` resolved from the `accent` input

#### Visual States

The row exposes a consistent state hierarchy styled via component-scoped CSS variables:

- `:hover` — subtle tinted background
- `:focus-visible` — Form A focus ring, `var(--mlv-stroke-width-medium)` `var(--mlv-border-focus)` at `var(--mlv-focus-ring-offset)` (SF-R3), plus `z-index: 1`. That `z-index` is **load-bearing, not decoration**: Form A paints the ring outside the row's border box and rows are flush (`margin: 0`), so without it an adjacent hovered or selected row — later in DOM order, `position: relative`, opaque `--mlv-list-item-bg` — paints over the ring's near edge. It also competes with anything positioned that a consumer sticks beside a row in the same stacking context; `mlv-dropdown-panel`'s sticky `__group-header` is the known case and lifts itself above this value (#109), so a change to this number has to keep that lift clearing it. Both directions are pinned by `dropdown-panel-stacking.spec.ts` in `core-dropdown`.
- `:active` — pressed scale (0.985)
- `--active` / `[aria-selected='true']` / `[aria-current]:not([aria-current='false'])` — `--mlv-background-selected` / `-hover` fill, `--mlv-text-on-selected` label, and revealed leading accent bar. Selection is its own token (SF-R1) — it never resolves the pressed `-active` fill. `aria-current` covers rows that name the state their context is already in (active heading level / list type / alignment in an editor menu, current saved view); presence minus the one negative value, so navigational `page`/`step` rows match too.
- `--unread` — semibold title + leading unread dot
- `--has-accent` — explicit accent bar always rendered

Rendered row content is wrapped in `.mlv-list-item__surface`; the host owns focus/selection state, while pressed `:active` scaling is applied only to that inner surface.

**Content projection (template invariant):** `list-item.html` follows the conditional-projection pattern — every `ng-content` slot (each selector and the wildcard default) appears exactly **once**, wrapped in an `ng-template`, and the rich/legacy layout branches stamp those templates through `ngTemplateOutlet`. Never duplicate a selector (or the bare `<ng-content />`) across the `@if` branches: slot assignment is static, so projected nodes bind to the first matching slot even when that branch never renders, and the content silently vanishes (this is exactly how legacy `[mlvListItemPrefix]` rows inside menus used to lose their icons). ng-content `select` attribute names are camelCase, matching the authored directive attributes.

#### Density

`list-item.scss` carries a density ladder driven by the shared cascade mixins (`@malva-ui/styles` `density.scss`): an ancestor `mlv--{density}` class (from `mlvDensityRoot`, or the class `mlv-popup` stamps on its detached overlay panel) scales the `--mlv-list-item-padding-block` / `--mlv-list-item-padding-inline` vars — tight `--mlv-spacing-1`, compact `--mlv-spacing-1-5`, comfortable `--mlv-spacing-2` (baseline default), spacious `--mlv-spacing-2-5`, airy `--mlv-spacing-3`. Consumers that override row padding must route it through those vars (not a direct `padding:`), or the ladder cannot apply — see the menu-panel row rule in `menu.scss` for the pattern.

---

### `MlvListItemLink`

**File:** `libs/core/list/src/lib/list-item-link/list-item-link.ts`
**Selector:** `a[mlvListItemLink]`
**Change Detection:** `OnPush`
**Host class:** `mlv-list-item__link`

Renders projected link content plus a trailing `LucideChevronRight`. Integrates with `RouterLinkActive`, exposing `isActive()` so the parent row can mirror active state.

---

### `MlvListItemGroup`

**File:** `libs/core/list/src/lib/list-item-group/list-item-group.ts`
**Selector:** `mlv-list-item-group`
**Change Detection:** `OnPush`
**Host class:** `mlv-list-item__group`

#### Inputs

| Name    | Required | Type                       | Default | Description                                                                                                                                                                                                       |
| ------- | -------- | -------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label` | Yes      | `string`                   | —       | Group header label                                                                                                                                                                                                |
| `open`  | No       | `boolean` (`BooleanInput`) | `false` | Whether the group is expanded — a **live** binding, not an initial value: every change re-seeds the state, and a user toggle wins until then. Coerced, so `<mlv-list-item-group open>` and `[open]="x"` both work |

#### Outputs

| Name         | Type      | Description                                                                       |
| ------------ | --------- | --------------------------------------------------------------------------------- |
| `openChange` | `boolean` | New expanded state, on every user toggle or `toggle()` call. Completes `[(open)]` |

#### Methods

| Name       | Returns | Description                                                                                                                                                               |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `toggle()` | `void`  | Flips the expanded state and emits `openChange`. Visually inert wherever no toggler is rendered — `variant="inset"`, or a `listRole` that requires owned children (below) |

`open` + `openChange` is an input/output pair, **not** a `model()` — `model()` accepts no `transform`, and a boolean without `coerceBooleanProperty` made the documented attribute form bind `''` and read falsy (#220). `[(open)]` binds exactly as before; the resolved state is a real `boolean`. Because `open` is now an input, the component keeps its own writable copy (`linkedSignal`) so a user toggle survives a one-way `[open]` binding — `model()`'s semantics, preserved.

**`variant="inset"` pins the group open, and then renders no toggler** — and since #224 so does a `listRole` that requires owned children (not merely any non-`list` one; see the ARIA-structure section below, which is the second half of `_alwaysOpen()`'s disjunction). An inset list is a stack of always-expanded sections, so the group injects the enclosing list through the internal `MLV_LIST` token (`libs/core/list/src/lib/list/list-token.ts`, deliberately **not** exported from the barrel), stamps `mlv-list-item-group--pinned` on its host, and renders `.mlv-list-item-group__label` — inert text — instead of the `<button class="mlv-list-item-group__toggler">`. Before #220 the button was rendered and reported `aria-expanded="false"` over content the stylesheet held permanently open: a WCAG 4.1.2 defect on two shipped docs pages, invisible to visual QA because `open` also read falsy. `open` and `toggle()` still work in the pinned case; they simply have nothing to move.

Resolution is by **injector**, not by DOM descent, and the two can differ — a group merely _projected_ into an inset list from another component resolves no list. That is why the open-state CSS hangs off `--pinned` (stamped from the same DI read the template branches on) rather than off `.mlv-list--inset ...`: such a group keeps its toggler and stays genuinely collapsible instead of reproducing the same contradiction. The purely visual inset rules (section card, sticky label chrome, flattened row radii) still match `.mlv-list--inset` descendants — so a projected group wears the card without the section-label chrome, and the mirror case (declared lexically inside an inset list but rendered elsewhere through `ngTemplateOutlet` or a portal) gets `--pinned` and `__label` with no `.mlv-list--inset` ancestor, leaving the label unstyled. Neither has a consumer in this repository; both are written up in `docs/migrations/2026-09-list-item-group-open-coercion.md`.

**Known characteristics** — accepted, not defects:

- **`__label` keeps the toggler's box but not its text position.** Outside `.mlv-list--inset` the label takes the toggler's `padding`, type ramp and colour, so a section band keeps its **height** when the disclosure disappears. Its text does not land where the toggler's did, deliberately: the toggler is a flex row of a 1rem chevron plus a 0.25rem gap, so its text starts 1.25rem further in (measured, plain variant: toggler text at x=32, `__label` text at x=12). Matching it would indent inert text against an empty gutter, and the two never render side by side — `_alwaysOpen()` reads the enclosing list, so every group in one list renders the same element.
- **`--pinned` carries its own block padding.** The collapsed base rule zeroes the block half so only that half animates, and `--toggled` re-adds it; `--pinned` did not, which was invisible while `--pinned` was reachable only inside an inset list — whose own `.mlv-list--inset … > div { padding: 0 }` supplies the zero on purpose. #224 makes it reachable in a plain list, where the rows then sat flush against the section label (measured, before the fix: `0px 12px 0px 24px` against `--toggled`'s `6px 12px 6px 24px`). `--pinned` now writes the same pair. The inset rendering is unchanged because the two rules tie on specificity (0,2,1) and the inset one comes later — hoisting it above `--pinned` would give every inset section 6px of block padding it never had. `MlvListItemGroup pinned content padding` in `list-item-group.spec.ts` pins all three states through the real compiled sheet (`sass.compile` → `stripCssLayersFromText` → token substitution, because jsdom resolves no `var()` and silently drops a shorthand containing one).
- **The pinned section's accessible name is upper-cased.** `aria-labelledby` points at `__label`, whose inset rule sets `text-transform: uppercase`, and Chrome folds the transform into the computed name (CDP AX tree reports `list "ACCOUNT"` for a label reading `Account`). Some screen-reader configurations spell all-caps words letter by letter. Kept as-is: it is a clear net gain over the region's previous state, which had **no** accessible name at all, and naming from a visually-hidden twin instead would put the section text into the a11y tree twice and diverge the announced name from the visible one. Revisit only with a real AT report.
- **A `variant` flipped at runtime from `plain` to `inset` drops focus.** `@if (_alwaysOpen())` destroys the `<button>`, and focus falls to `<body>`. No consumer binds `variant` dynamically — it is a static presentation choice — so no focus-restoration is wired.
- **Collapsing a group while focus is inside it drops focus to `<body>` (#221).** When `__content` becomes inert with focus in it, the engine runs the spec's unfocusing steps asynchronously — measured in Chrome, focus survives the state change within the same task and is on `<body>` a frame or two later (the exact frame varies per run) — so the next Tab restarts at the top of the document. The common path is safe: the toggler is a _sibling_ of `__content`, not a descendant, so activating it leaves focus outside the region. Only a **programmatic** close (`[open]` flipped from outside, e.g. an accordion-exclusive `[open]="openId() === x"` across several groups) or a control **inside** the region calling `toggle()` reaches it. No focus restoration is wired, deliberately: the toggler is the only candidate target, and moving focus there on a state change the user did not initiate at that element is its own WCAG 3.2.1 / 3.2.2 problem. A consumer who needs it owns the decision in the handler that flips `open`.
- **The "is the content on screen?" predicate is `_contentVisible()` — `_expanded() || _alwaysOpen()`**, not `_expanded()` and not the `--toggled` class. A pinned group renders its content expanded with `_expanded()` false, because the open-state CSS hangs off `--pinned` independently of `--toggled`. (`_alwaysOpen()` was `_pinnedOpen()` until #224, when it stopped meaning "the _variant_ pins it" and started meaning "no toggler is rendered, so nothing can ever close it".) Anything gating the content region must read the pair: `[attr.inert]="!_expanded()"` would make every inset section's **visible** rows inert and drop every control in them (example 8's switches) out of the tab order. `--toggled` fails in the direction that hides the bug — `open` coerces since #220, so an inset group written `<mlv-list-item-group open>` carries `--toggled` _and_ `--pinned`, and a spec written against docs examples 5 and 8 (both bare `open`) would pass while `list.spec.ts`'s `InsetListGroupsHost` (inset, no `open`) breaks. The predicate is a named `computed` carrying this warning in its JSDoc; `list-item-group.spec.ts` covers all four states and `list.spec.ts`'s inset sweep asserts the un-`open`ed pinned shape stays interactive.

Template: `@if (_alwaysOpen())` → section label, `@else` → group header button with chevron, followed by the collapsible projected content. The header's `aria-controls` targets the content region's id, generated via `mlvNextId('mlv-list-group-content')` from `@malva-ui/cdk/utils` (replacing a hand-rolled module counter); in the pinned case the label carries an `mlvNextId('mlv-list-group-label')` id and the content region points `aria-labelledby` at it, so the section keeps the accessible name the removed button used to give it.

#### ARIA structure

<!-- `docs:check-doc-api` does not read the table below as a member table, and
     that depends on two things holding at once. `scripts/check-doc-api.mjs`
     resets `sectionKind` at every heading and only re-arms it from
     `SECTION_KINDS` (inputs / outputs / models / methods), so this heading
     leaves it `null`; the table's first header cell ("enclosing `listRole`")
     is not in `HEADER_KINDS` either, so `flushTable` drops the table for
     having no `kind`. The backstop is `memberName()`, which requires
     `^[A-Za-z_$]` after unwrapping the first backticked span — every first
     cell here starts with `'`, so each row yields `null` even if a `kind` were
     somehow resolved. Reformatting those cells unquoted, or renaming this
     heading to something matching `/^(?:key|public|cva|creation)?\s*methods?\b/`,
     removes one layer each; do both and the gate fires with "documented but
     not declared" on every `listRole` value. Keep the quoting. -->

**Every role is derived from the enclosing list's `listRole` (#224).** A group is projected straight into `<mlv-list>`, whose host claims a container role, and a container role owns every roled or focusable descendant it reaches through roleless wrappers. With no role at all on the group host, the toggler `<button>` was a direct child of `role="list"`, which may own nothing but `listitem` — axe `aria-required-children`, WCAG 1.3.1, and the whole list stopped being exposed as a list. #219 fixed that with a hardcoded `role="listitem"` host and a hardcoded `role="list"` content region, which is right under the default `listRole` and wrong under every other one. Both are now derived:

| enclosing `listRole`                                                                             | host role  | `__content` role | toggler | why                                                                                                             |
| ------------------------------------------------------------------------------------------------ | ---------- | ---------------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `'list'` (default)                                                                               | `listitem` | `list`           | yes     | the group is one row of the outer list; a `listitem` may not contain another, so the rows need their own `list` |
| _(no enclosing list)_                                                                            | — none —   | `list`           | yes     | `listitem`'s ARIA required context is `list`, and there is none: the attribute dangled                          |
| `'menu'`, `'menubar'`, `'listbox'`, `'tree'`                                                     | — none —   | `group`          | **no**  | these four own `group` and own no `listitem`; `group` is the sectioning role they list                          |
| `'feed'`, `'grid'`, `'row'`, `'rowgroup'`, `'suggestion'`, `'table'`, `'tablist'`, `'treegrid'`  | — none —   | — none —         | **no**  | they require owned children and none is a role the group could claim, so it claims none and is transparent      |
| anything else — `'toolbar'`, `'radiogroup'`, `'region'`, `'group'`, an unknown or misspelt value | — none —   | — none —         | **yes** | the container requires no children at all, so the `<button>` is legal and the group stays collapsible           |

Five things that make this table the shape it is, none re-derivable from the diff:

- **The four `group`-owning roles are exhaustive**, read off the WAI-ARIA required-owned-elements table that axe-core 4.12.1 ships as `ariaRoles[<role>].requiredOwned`: `listbox` → `['group', 'option']`, `menu` and `menubar` → `['group', 'menuitemradio', 'menuitem', 'menuitemcheckbox', 'menu', 'separator']`, `tree` → `['group', 'treeitem']`. Every other container role in that table owns a closed set `group` is not in (`list` → `['listitem']`, `tablist` → `['tab']`, `table`/`grid`/`treegrid` → `['rowgroup', 'row']`, `row`, `rowgroup`, `feed`, `suggestion`).
- **`group`, not a nested `menu` / `listbox`.** A nested `role="menu"` is a _submenu_ — a pattern `mlv-menu` already owns, and one that would need a controlling `menuitem` with `aria-haspopup`. `group` is what those containers actually list as their sectioning child, and it is what `mlv-menu-group` and `mlv-dropdown-panel`'s own APG listbox groups already render for the identical job.
- **The toggler disappears under a child-requiring container, and that is why the roles above are on the _content_ region rather than the host.** axe _flattens_ a `role="group"` child when the container requires one (`getOwnedRoles` pushes its children back onto the queue instead of recording it), so a `group` is no shield: a `<button>` inside one is read as a direct owned child of the container, and no container role owns `button`. Only `listitem` under `role="list"` is a role the container stops at. So under those the group is pinned open exactly the way `variant="inset"` pins it — `--pinned`, `__label` instead of `__toggler` — which is also what `mlv-menu-group`, the library's existing menu section, has always done.
- **Row 5 exists because the closed side is the child-requiring one, not its complement.** Exactly thirteen roles carry a `requiredOwned` array in axe-core 4.12.1 — `feed`, `grid`, `list`, `listbox`, `menu`, `menubar`, `row`, `rowgroup`, `suggestion`, `table`, `tablist`, `tree`, `treegrid` (`Object.entries(axe.utils.getStandards().ariaRoles).filter(([, d]) => Array.isArray(d.requiredOwned))`), and `ariaRequiredChildrenEvaluate` returns `true` immediately for every other role, because `requiredOwned(role)` answers `null` when the role declares no array. So `toolbar`, `radiogroup`, `region`, `group` and any unrecognised value keep a working disclosure — measured, a `role="toolbar"` list containing the toggler sweeps clean, and a typo'd `listRole="lst"` raises only `aria-roles` about the invalid name. Reading row 4 as "any `listRole` other than `list`" — an earlier draft's rule, defended as conservative on the grounds that the complement would be an open set — is backwards and lossy: it removed a provably legal control, so `listRole="toolbar"` or a fat-fingered value silently left every section of that list permanently expanded with `toggle()` and `[(open)]` inert and no dev warning. The set is a snapshot of ARIA and can drift; drift is graceful in the safe direction, since a newly child-requiring role missing from it renders a toggler that a sweep catches.
- **`aria-labelledby` is dropped when the content region has no role.** It is a _global_ ARIA attribute, so axe counts a roleless element carrying one as an owned child in its own right — with no role, which no container allows. Naming the transparent wrapper of rows 4/5 would put back the violation row 4 exists to avoid (measured under `tablist`: `aria-required-children` on `mlv-list`, naming `div[aria-labelledby]`). Nothing is lost: a roleless region maps to `generic`, which prohibits naming, so the attribute is inert even where it is not a violation — measured, adding it under `role="toolbar"` is axe-clean and still exposes no name. The label element still renders; it simply names nothing there. The one shape where this is visible on purpose is `variant="inset"` inside such a container: the section is labelled on screen, and the label is wired to no region.

Nothing in the workspace is affected by any of this: every `mlv-list-item-group` in `libs/` and `apps/` sits in a default `role="list"`.

**Rows 3–5 are clean only when `itemRole` is also a role the container owns**, and this change does not close that. `MlvListItem.itemRole` defaults to `'listitem'` whatever container it is in, so `<mlv-list listRole="menu">` around a bare `<mlv-list-item>` still raises `aria-required-children` on `mlv-list` and `aria-required-parent` on `mlv-list-item`. Net against the shipped tree is **zero** — the same composition raised two violations before, on `mlv-list` and on the group host, so the failing node moves rather than disappearing — but it is not "clean". Changing the default is a breaking change to a public input and is tracked separately (#273). `leaves a default itemRole under a non-list container failing, unchanged` in `list-item-group.spec.ts` sweeps that composition with `runAxe` and asserts exactly those two rule ids on exactly those two nodes, so the gap is pinned rather than papered over by a hand-picked harness role.

One residual, shared with `mlv-list` itself and **not** introduced here: a `role="list"` whose children are all `role="none"` fails `aria-required-children` with _"Required ARIA child role not present: listitem"_. A group under the default `listRole` renders a second `role="list"`, so the same consumer error can now be made one level deeper — `<mlv-list-item-group><mlv-list-item itemRole="none">` with no other row. Measured: `<mlv-list><mlv-list-item itemRole="none"></mlv-list>` fails identically with no group present, and a bare `<div role="list"><div role="none">` fails too. The fix is the consumer's: a list of purely presentational rows is not a list. The same shape is why an expanded standalone group holding non-row content (`<p>`) fails — it is a `list` with no `listitem`.

Pinned by `MlvListItemGroup role derivation (#224)` in `list-item-group.spec.ts` — role/toggler assertions plus one full axe sweep per container role, each rooted at the `mlv-list`, since a sweep rooted at the group never evaluates the parent's owned-children rule — and by `MlvList accessibility › collapsible groups inside a role="list"` and `› pinned groups inside an inset role="list"` in `list.spec.ts`. The `toolbar` case asserts that `toggle()` actually moves the rendered state rather than that a button element exists, and its sweep asserts the button is present first: the suppressed shape sweeps clean too, so an unguarded sweep there would pass with the control gone.

**Collapsed content is `inert` (#221).** `.mlv-list-item-group__content` carries `[attr.inert]="_contentVisible() ? null : ''"`. Collapsing is done entirely in CSS — `grid-template-rows: 0fr` on the region plus `overflow: hidden` and `opacity: 0` on the inner wrapper — and **none of those three removes anything from the accessibility tree**: a zero-height clipped box still computes `visibility: visible`, so AT read the collapsed rows out and Tab landed on their links with no focus ring anywhere on screen (WCAG 2.4.3 / 2.4.7 / 1.3.1). `inert` fixes both at once.

Three things a future editor needs, none of which are re-derivable from the diff:

- **The predicate is `_contentVisible()`, never `!_expanded()`** — see the bullet above. This is the actual difficulty of the ticket, and it fails silently in the direction of the shipped docs examples.
- **`inert` needs no timing against the collapse transition, and no reduced-motion path.** It is not a rendering property: per the HTML Standard's _Inert subtrees_ an inert node is untargetable by pointer events, excluded from sequential focus navigation and "should not" be exposed to accessibility APIs, while rendering is untouched. So it flips with the state and the `grid-template-rows` transition runs underneath. `visibility` / `display` / `hidden` would each have needed the `transition: visibility 0s linear <duration>` dance — and `mixins.reduced-motion()` overrides `transition-duration` but **not** `transition-delay`, so that route owed a hand-written reduced-motion reset no other component in the library has. `hidden="until-found"` computes to `content-visibility: hidden`, which would destroy the transition outright. Same immediate-flip shape as `mlv-sidebar-item`, `mlv-sidebar-group` and `mlv-stepper`. **Not** `mlv-expand`, despite appearances: its `expand.html` binding sits inside `@if (opened())`, so its ternary can only ever yield `null` and the attribute is never written — dead code, not precedent ([#263](https://github.com/N1XUS/malva-ui/issues/263)).
- **An axe sweep cannot see this defect, measured — in either direction.** A collapsed group holding a focusable `<a href>` sweeps clean without `inert`; so does a **visible** pinned group wrongly marked `inert`. axe evaluates the tree it is handed and has no rule for "content the author collapsed must leave it". The guard is therefore the explicit four-state attribute contract in `list-item-group.spec.ts`, not a sweep. The four existing sweeps stay and pass unchanged with `inert` present, which is what shows that dropping a `role="list"` region out of the tree raises no `aria-required-children` / `aria-required-parent` / `aria-valid-attr-value` fallout. It also means the collapsed region's `aria-controls` target is inert, which is the disclosure pattern working as intended.

The attribute lands on `__content` rather than an inner wrapper so the region `aria-controls` names is exactly the region `aria-expanded="false"` is a claim about. Written up in `docs/migrations/2026-09-list-item-group-collapsed-inert.md`.

---

## Directives

### Rich Slot Directives

| Directive            | Selector               | Purpose                                                                                                                                                                      |
| -------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MlvListItemMedia`   | `[mlvListItemMedia]`   | Leading avatar/icon/artwork slot                                                                                                                                             |
| `MlvListItemTitle`   | `[mlvListItemTitle]`   | Main headline slot                                                                                                                                                           |
| `MlvListItemByline`  | `[mlvListItemByline]`  | Secondary supporting text below the title (clamped to two lines)                                                                                                             |
| `MlvListItemMeta`    | `[mlvListItemMeta]`    | Inline headline-side metadata                                                                                                                                                |
| `MlvListItemActions` | `[mlvListItemActions]` | Trailing actions area. Supports a `revealOnHover` boolean input that hides actions until the row is hovered, keyboard-focused, or selected (touch devices always show them). |

### Legacy Slot Directives

- `MlvListItemPrefix` — `[mlvListItemPrefix]`
- `MlvListItemSuffix` — `[mlvListItemSuffix]`

### `MlvListSelectable<T>`

**Selector:** `mlv-list[selectable]`
**File:** `libs/core/list/src/lib/list-selectable.ts`

Applies `@angular/aria`'s `Listbox` (`ngListbox`) as a host directive and re-exposes its inputs/output under the public names. (Migrated from `CdkListbox` — Phase 2 Task 2.1.)

#### Inputs

| Name                           | Type                             | Default        | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------ | -------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `multiple`                     | `boolean`                        | `false`        | Maps to aria `multi`.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `value`                        | `T[]`                            | `[]`           | Aria selection model (array even for single-select). Two-way via `valueChange`.                                                                                                                                                                                                                                                                                                                                                                                                 |
| `selectionMode`                | `'follow' \| 'explicit'`         | `'follow'`\*   | Aria default is `follow` (selection follows focus). Pin `"explicit"` to match the previous CdkListbox behaviour (select only on click / Space / Enter).                                                                                                                                                                                                                                                                                                                         |
| `softDisabled`                 | `boolean`                        | `true`\*       | Aria default `true` keeps disabled options focusable-but-inert. Set `false` to skip them during navigation (previous CdkListbox behaviour).                                                                                                                                                                                                                                                                                                                                     |
| `focusMode`                    | `'roving' \| 'activedescendant'` | `'roving'`     | Re-exposes aria `Listbox`'s `focusMode`. `'activedescendant'` keeps DOM focus off the list (on an owning combobox trigger/input) and tracks the active option via `aria-activedescendant`. `mlv-dropdown-panel` re-exposes this so `mlv-combobox` can pin it.                                                                                                                                                                                                                   |
| `orientation`                  | `'vertical' \| 'horizontal'`     | `'vertical'`   | Forwarded to aria.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `wrap`, `disabled`, `readonly` | —                                | aria defaults  | Forwarded to aria.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `listboxId`                    | `string`                         | aria-generated | Re-exposes aria `Listbox`'s own `id` input (aliased `'id: listboxId'` in the `hostDirectives` inputs). aria renders it as `[attr.id]="id()"` on the host, so binding `listboxId` sets the rendered DOM id. Leave unset to keep aria's generated `ng-listbox-*` id. A wrapping `mlv-select` / `mlv-combobox` sets this (via `mlv-dropdown-panel`) so its trigger `aria-controls` resolves to a real element — a native `[id]` binding would be overridden by aria's `[attr.id]`. |

\* **Behavioural note:** these two defaults changed with the aria migration. The shared `mlv-dropdown-panel` (and therefore `mlv-select` / `mlv-combobox`) pins `selectionMode="explicit"` and `[softDisabled]="false"` to preserve the exact previous behaviour. Standalone `mlv-list[selectable]` consumers that relied on the old defaults should set these inputs explicitly. A host directive's exposed inputs cannot be pinned from the wrapper's own `host` metadata, so they are set where the `<mlv-list>` element is used.

#### Output

- `valueChange: EventEmitter<T[]>` — emits the selected values array (aria emits the array directly; there is no longer a `ListboxValueChangeEvent` wrapper).

#### Methods

- `focusFirst()` — moves keyboard focus to the first option via aria `gotoFirst()` (replaces the previous `setTimeout(10)` + `_setActiveOption` hack).

#### Roles (important)

Aria's pointer selection resolves the clicked option via `closest('[role="option"]')`. Because `mlv-list-item` binds `[attr.role]="itemRole()"` (default `listitem`), a selectable list must set `listRole="listbox"` on the `mlv-list` and `itemRole="option"` on each `mlv-list-item` for click selection to work. `mlv-dropdown-panel` sets both automatically.

### `MlvListItemSelectable`

**Selector:** `mlv-list-item[value]`
**Export as:** `mlvListItemSelectable`

Applies `@angular/aria`'s `Option` (`ngOption`) as a host directive, forwarding `value` (required), `disabled`, `label`, and `optionId`. Set `label` to the visible option text so aria's type-ahead works (aria reads the explicit `label`; `mlv-dropdown-panel` sets it from the option label). `optionId` re-exposes aria's `ngOption` `id` (aliased `'id: optionId'`), rendered as the option element's `[attr.id]`; forwarding a deterministic id lets an owning combobox point its input's `aria-activedescendant` at the active option (the activedescendant model). Also set `itemRole="option"` on the `mlv-list-item` (see Roles above).

### `MlvListItemTemplate<T>`

**Selector:** `[mlvListItemTemplate]`

Exposes `templateRef: TemplateRef<MlvListItemTemplateContext<T>>` for custom list item rendering.

---

## Usage Examples

```html
<!-- Basic list -->
<mlv-list>
  <mlv-list-item>Item 1</mlv-list-item>
  <mlv-list-item>Item 2</mlv-list-item>
</mlv-list>

<!-- Rich row -->
<mlv-list>
  <mlv-list-item>
    <mlv-avatar mlvListItemMedia shape="square" size="xl">🪐</mlv-avatar>
    <span mlvListItemTitle>The Odyssey</span>
    <span mlvListItemByline>Explore unknown galaxies.</span>
    <div mlvListItemActions>
      <button mlvButton variant="transparent" size="small">Get</button>
    </div>
  </mlv-list-item>
</mlv-list>

<!-- Inset (iOS Settings style) with accents, unread and reveal-on-hover actions -->
<mlv-list variant="inset">
  <mlv-list-item-group label="Inbox">
    <mlv-list-item unread accent="primary">
      <span mlvListItemTitle>Build release candidate</span>
      <span mlvListItemByline>The new combobox needs a final pass before we ship.</span>
      <div mlvListItemActions revealOnHover>
        <button mlvButton variant="transparent" size="small">Archive</button>
      </div>
    </mlv-list-item>
    <mlv-list-item accent="warning">
      <span mlvListItemTitle>Design review</span>
      <span mlvListItemByline>Thursday, with the rest of the platform team.</span>
    </mlv-list-item>
  </mlv-list-item-group>
</mlv-list>
```

---

## Dependencies

- `@angular/router` — `RouterLinkActive` for active linked rows
- `@angular/cdk/coercion` — boolean coercion
- `@angular/aria/listbox` — `Listbox` / `Option` headless selection patterns (`ngListbox` / `ngOption`) behind `mlv-list[selectable]` / `mlv-list-item[value]`
- `@lucide/angular` — chevron icons
