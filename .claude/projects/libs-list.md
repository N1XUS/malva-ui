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

| Name    | Required | Type     | Description        |
| ------- | -------- | -------- | ------------------ |
| `label` | Yes      | `string` | Group header label |

#### Model

| Name   | Type           | Default |
| ------ | -------------- | ------- |
| `open` | `BooleanInput` | `false` |

Template: group header button with chevron icon and collapsible projected content. The header's `aria-controls` targets the content region's id, generated via `mlvNextId('mlv-list-group-content')` from `@malva-ui/cdk/utils` (replacing a hand-rolled module counter).

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
**Export as:** `uiListItemSelectable`

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
