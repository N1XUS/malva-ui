---
name: libs-tree
description: Documentation for the @malva-ui/core/tree library — hierarchical data tree component
type: project
---

# Library: tree

> **Keep this file up to date.** Always update this file and keep it aligned with the current implementation whenever you make any change to this library.

## Overview

The Tree library (`@malva-ui/core/tree`) provides a hierarchical data tree component for displaying nested data.

Built on the **`@angular/aria` headless `Tree`/`TreeItem`/`TreeItemGroup`** directives (applied internally — consumers never see `ng*` selectors). aria owns roles, `aria-level`/`setsize`/`posinset`, roving `tabindex`, keyboard navigation (arrows/Home/End), **text typeahead**, and selection; the component keeps the data-driven `nodes` API, the `mlv-expand` animation, lazy loading, custom templates and multi-select checkboxes.

**Features:**

- Expand/collapse nodes with smooth animated height transition (tree-tuned `mlv-expand` keyframes without translateY)
- Single-select and multi-select mode using `mlv-checkbox` (no native input)
- Lazy loading via async `loadChildren` callback with spinner (`mlv-loader`)
- Full keyboard navigation + text typeahead, owned by `@angular/aria`
- Optional file-explorer style connector lines (opt-in via `showConnectors`)
- Optional navigation-tree mode (`nav` + `currentType`) exposing `aria-current` for sidebar-style trees
- Built-in icon slot on each node (`MlvTreeNode.icon`) rendered as a Lucide dynamic icon in the default template
- Custom node templates via `[mlvTreeNodeDef]` structural directive
- Generic typed `MlvTreeNode<T>` interface
- Data-driven `nodes`, rendered internally by a recursive component tree

## `@angular/aria` architecture

- **Recursion is expressed as nested COMPONENTS** (`MlvTreeSubtree` renders one level of `[ngTreeItem]` rows and, for branches, a `<div role="group"><ng-template ngTreeItemGroup>` wrapping a child `MlvTreeSubtree`). A self-referential `ngTemplateOutlet` (the shape in aria's own docs) throws `createEmbeddedViewImpl is not a function` when rendered through aria's `DeferredContent` in this toolchain — recursive components avoid it.
- **aria's `Tree` is applied to an inner `.mlv-tree__root` element, NOT as a `hostDirective`.** aria's config inputs (`multi`, `selectionMode`, `softDisabled`) are derived internally from `selectMode`, and a component **cannot** set its own host-directive inputs from its `host` metadata (silently ignored — verified). Binding them on an in-template `[ngTree]` element works. Consequence: `role="tree"`, `aria-multiselectable`/`orientation`/`disabled`/`activedescendant`, the roving tabindex and all keyboard/pointer listeners live on `.mlv-tree__root`, not on the `<mlv-tree>` host.
- **`mlv-expand` animation preserved** by setting `[preserveContent]="true"` on each `ngTreeItem`: aria's `DeferredContent` then renders the group on first expand and never unmounts it, so `mlv-expand`'s own `[opened]` owns the enter/leave animation.
- **Config pins:** `selectionMode="explicit"` (aria default is `follow`/select-on-focus), `softDisabled=true` (disabled rows stay focusable-but-inert, matching the historical arrow-lands-on-disabled behavior), `wrap=false` (clamp at ends).
- **Selection bridge:** aria's `Tree.value` model is a `V[]` array of node ids (single-select holds ≤1). The component mirrors it in `_value` and emits `selectionChange` as a `Set`. `selectMode:'none'` sets every item `selectable=false`.

## Public API

Exported from `libs/core/tree/src/index.ts`:

| Export                     | Kind           | Description                                                                                                  |
| -------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------ |
| `MlvTree`                  | Component      | Root tree component — `mlv-tree`                                                                             |
| `MlvTreeNodeDef`           | Directive      | `[mlvTreeNodeDef]` — custom node template directive                                                          |
| `MlvTreeNode<T>`           | Interface      | Generic tree node: `{ id, label, data, children?, loadChildren?, disabled?, icon?, expanded? }`              |
| `MlvFlatTreeNode<T>`       | Interface      | Internal flat-list node for template context: `{ node, depth, isExpanded, hasChildren, isLoading, key }`     |
| `MlvTreeNodeDefContext<T>` | Interface      | Template context for `[mlvTreeNodeDef]`                                                                      |
| `MlvTreeSelectMode`        | Type           | `'none' \| 'single' \| 'multi'`                                                                              |
| `MlvTreeCurrentType`       | Type           | `aria-current` value for nav mode: `'page' \| 'step' \| 'location' \| 'date' \| 'time' \| 'true' \| 'false'` |
| `MLV_TREE`                 | InjectionToken | Parent-tree accessor token for internal subtree communication                                                |
| `MlvTreeAccessor`          | Interface      | Accessor contract exposed to `MlvTreeSubtree`                                                                |

The recursive `MlvTreeSubtree` is an implementation detail and is not
part of the package barrel.

## Component: `MlvTree` (`mlv-tree`)

### Inputs

| Input            | Type                 | Default  | Description                                                                                        |
| ---------------- | -------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| `nodes`          | `MlvTreeNode<T>[]`   | `[]`     | Root-level tree nodes                                                                              |
| `selectMode`     | `MlvTreeSelectMode`  | `'none'` | Selection behavior                                                                                 |
| `indentSize`     | `number`             | `1.5`    | Indentation per depth level in rem                                                                 |
| `showConnectors` | `boolean` (coerced)  | `false`  | When true, renders L-shaped connector lines between parent and child nodes (file-explorer pattern) |
| `nav`            | `boolean` (coerced)  | `false`  | Navigation-tree mode — selected rows expose `aria-current` instead of `aria-selected`              |
| `currentType`    | `MlvTreeCurrentType` | `'page'` | The `aria-current` value emitted for the active row when `nav` is enabled                          |

### Outputs

| Output            | Type                    | Description                                     |
| ----------------- | ----------------------- | ----------------------------------------------- |
| `selectionChange` | `Set<string \| number>` | Emits selected node IDs on change               |
| `nodeActivate`    | `MlvTreeNode<T>`        | Emits when a node is activated (click or Enter) |
| `nodeToggle`      | `{ node, expanded }`    | Emits when a node is expanded or collapsed      |

### Keyboard Navigation

Owned by `@angular/aria` (listeners on `.mlv-tree__root`):

| Key            | Action                                                                           |
| -------------- | -------------------------------------------------------------------------------- |
| `ArrowRight`   | Expand focused node (if collapsed); move to first child (if expanded)            |
| `ArrowLeft`    | Collapse focused node (if expanded); move to parent (if collapsed)               |
| `ArrowDown`    | Move focus to next visible node                                                  |
| `ArrowUp`      | Move focus to previous visible node                                              |
| `Home`         | Move focus to first node                                                         |
| `End`          | Move focus to last visible node                                                  |
| `Enter`        | Select (single) / toggle (multi) the focused node; `nodeActivate` in `none` mode |
| `Space`        | Select (single) / toggle (multi) the focused node                                |
| _type a label_ | **Typeahead** — jump to the next node whose `label` matches the typed text       |

**RTL:** `ArrowRight` / `ArrowLeft` swap — `ArrowLeft` expands, `ArrowRight` collapses — following the tree's nearest `[dir]`, not only the document's. aria's `Tree` injects the CDK `Directionality` for this; before #339 it read the root, document-level instance, so a tree inside a `dir="rtl"` subtree indented and mirrored its chevrons while expanding on `ArrowRight`. `MlvTree` now has `viewProviders: [provideMlvScopedDirectionality()]` (`@malva-ui/cdk/utils`, `@internal`) — `viewProviders` because `ngTree` is in the view, so consumer node templates keep their own. Pinned by `tree-scoped-direction.spec.ts` (scoped RTL, LTR island). List of record: `.claude/rules/rtl.md` § _Sanctioned `Directionality` providers_.

> **Behavior changes from the pre-aria tree:** (1) `Enter` now **selects/toggles** the focused row (previously it expanded/collapsed branch nodes — use `ArrowRight`/`ArrowLeft` or the chevron for that). (2) In multi mode, clicking a row now **toggles** its selection (the checkbox is presentational and reflects state). (3) Text typeahead is new. (4) The single-select "click the selected row again to deselect" affordance is preserved by a component-level interceptor (aria's `selectOne` alone never deselects).

## Directive: `MlvTreeNodeDef` (`[mlvTreeNodeDef]`)

Custom template for node content. Applied to an `<ng-template>`:

```html
<mlv-tree [nodes]="data">
  <ng-template mlvTreeNodeDef let-flatNode>
    <svg lucideFile [size]="14" />
    {{ flatNode.node.label }}
    <span class="size">{{ flatNode.node.data.size }}</span>
  </ng-template>
</mlv-tree>
```

Template context: `MlvFlatTreeNode<T>` — access via `let-flatNode`.

## Interface: `MlvTreeNode<T>`

```typescript
interface MlvTreeNode<T = unknown> {
  id: string | number;
  label: string;
  data: T; // Arbitrary node data payload
  children?: MlvTreeNode<T>[]; // Static children
  loadChildren?: () => Promise<MlvTreeNode<T>[]>; // Async lazy loader
  disabled?: boolean;
  icon?: string; // Optional Lucide icon name shown in the default template
  expanded?: boolean; // Initial expanded state
}
```

## SCSS / BEM

Block: `mlv-tree`

| Class                          | Description                                                                                                                               |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `.mlv-tree`                    | Host element (plain wrapper)                                                                                                              |
| `.mlv-tree--connectors`        | Host modifier enabling file-explorer connector lines                                                                                      |
| `.mlv-tree__root`              | The aria `[ngTree]` container (`role="tree"`); `display: contents`                                                                        |
| `.mlv-tree__subtree`           | Recursive `mlv-tree-subtree` host; `display: contents` (transparent)                                                                      |
| `.mlv-tree__group`             | The `<div role="group">` wrapping a node's children                                                                                       |
| `.mlv-tree__item`              | A single tree node row (`[ngTreeItem]`, `role="treeitem"`)                                                                                |
| `.mlv-tree__item__content`     | The row box inside the item (the item also wraps its child group). Legacy nested BEM name, kept for compatibility — do not copy the shape |
| `.mlv-tree__content`           | Inner content wrapper (icon + label or custom template)                                                                                   |
| `.mlv-tree__icon`              | Default-template icon rendered from `MlvTreeNode.icon`                                                                                    |
| `.mlv-tree__toggle`            | Expand/collapse chevron button                                                                                                            |
| `.mlv-tree__checkbox`          | `mlv-checkbox` in multi-select mode                                                                                                       |
| `.mlv-tree__label`             | Node label text                                                                                                                           |
| `.mlv-tree__spinner`           | Spinner wrapper during lazy load                                                                                                          |
| `.mlv-tree__item--expanded`    | Node is expanded                                                                                                                          |
| `.mlv-tree__item--selected`    | Node is selected                                                                                                                          |
| `.mlv-tree__item--disabled`    | Node is disabled                                                                                                                          |
| `.mlv-tree__item--leaf`        | Node has no children (toggle hidden)                                                                                                      |
| `.mlv-tree__item--loading`     | Node is loading children                                                                                                                  |
| `.mlv-tree__toggle--expanded`  | Toggle shows chevron-down icon                                                                                                            |
| `.mlv-tree__toggle--invisible` | Toggle is hidden (leaf node)                                                                                                              |

### Row states (2026-09, #302 / #304)

- **State lives on the treeitem, paint on its row box.** `MlvTreeSubtree` stamps `--selected` / `--disabled` on `.mlv-tree__item`, which also wraps the row's nested `.mlv-tree__group`. Every state rule is `.mlv-tree__item--<state> > .mlv-tree__item__content` — child combinator, so a state never fills the indent gutter or a descendant row.
- **Selected** — the selected-state pair (SF-R1): `--mlv-background-selected` / `-selected-hover` + `--mlv-text-on-selected`, icon `--mlv-text-on-selected` — label 5.48 / 4.94 light, 7.68 / 6.78 dark, 7.28 / 5.89 HC (rest / hover). The chevron's hover fill is `-selected-hover` there (as on a plain row, where both are `neutral-1-hover`), so it never paints a grey chip on the tint. Was `--mlv-text-action` on `--mlv-background-accent-2` (2.40:1 light), on a selector nothing matched.
  - Caveat: `--mlv-text-on-selected` is `mlv-link`'s resting colour, so a custom `[mlvTreeNodeDef]` template that renders a link hits, on a selected row, the same colour collision that made `mlv-data-table` keep its own ink (WCAG 1.4.1). The default row renders no link, so the tree keeps the ink.
- **Disabled** — beats selected (as on `mlvButton`). SF-R4 transparent-surface treatment: `--mlv-text-disabled` ink, `cursor: not-allowed`, no hover fill, no fill at rest; icon and chevron inherit the ink, the chevron drops its own hover fill and pointer cursor (`_onToggle` ignores a disabled node). No `opacity` multiply and no `pointer-events: none` — the latter would hide the cursor and let the chevron's click reach the aria tree.
- **Hover** — `--mlv-background-neutral-1-hover` on rows neither selected nor disabled. The three row fills exclude one another, so exactly one can match a row in any state.
- Before #304 both `.mlv-tree__item__content--selected` / `--disabled` rules matched **no element** (dead since the root commit): selected rows showed no fill, disabled rows kept full ink, the pointer cursor and the hover fill. The old icon rule was a descendant match, so a selected parent recoloured every icon beneath it; it is now scoped to the row's own content.
- Pinned twice: `tree-row-states.spec.ts` renders a selected, a disabled, a selected-and-disabled and two child rows and asserts which rows each rule's selector matches (a colour check alone passes on a dead rule); `libs/styles/src/lib/tone-contrast.spec.mjs` scores the colours and throws on a renamed selector — keep its selector strings in step.

## Dependencies

- `@angular/aria` — headless `Tree`, `TreeItem`, `TreeItemGroup` directives (roles, keyboard, selection, typeahead, expansion)
- `@malva-ui/core/loader` — spinner for lazy-loading state (`mlv-loader`)
- `@malva-ui/core/expand` — animated height transition wrapper for children
- `@malva-ui/core/checkbox` — `mlv-checkbox` used in multi-select mode (presentational)
- `@lucide/angular` — `LucideChevronRight`, `LucideChevronDown`, `LucideDynamicIcon` for icons
- `@angular/cdk/coercion` — `coerceBooleanProperty` for boolean inputs
- `@malva-ui/cdk/utils` — `provideMlvScopedDirectionality` (`@internal`), so aria's RTL key swap follows a scoped `[dir]`
- `@malva-ui/styles` — all `--mlv-*` CSS custom properties

## Accessibility

- All ARIA is now emitted by `@angular/aria`. Each `[ngTreeItem]` row (`role="treeitem"`) exposes `aria-level` (1-based depth), `aria-setsize` (sibling count at that level), `aria-posinset` (1-based position among siblings), `aria-expanded`, `aria-selected` (or `aria-current` in `nav` mode), and `aria-disabled`. The `.mlv-tree__root` container carries `role="tree"`, `aria-multiselectable`, `aria-orientation`, `aria-disabled` and `aria-activedescendant`.
- **Single tab stop:** aria manages the roving tabindex on the rows — only the active row has `tabindex="0"`; the `.mlv-tree__root` container holds `tabindex="-1"`. In multi-select mode the per-row `mlv-checkbox` is rendered with `[tabbable]="false"` (and `pointer-events: none`) so it neither adds a second tab stop nor intercepts the row click — it is a presentational reflection of `aria-selected`; **Space**/click toggles selection via aria.
- **Enter/Space** select (single) or toggle (multi) the focused row via aria. `nodeActivate` is emitted on row click/Enter/Space in `none` mode and on user single-selection.
- Disabled rows stay focusable-but-inert (`softDisabled=true`) so arrow navigation still lands on them, matching the historical behavior.

## Notes

- Multi-select renders a `mlv-checkbox` per node, non-tabbable (`[tabbable]="false"`) and `pointer-events: none` (presentational). No circular dependency — `@malva-ui/core/checkbox` does not import the tree library.
- The chevron toggle flips the aria `TreeItem.expanded` model (`_onToggle` → `item.expanded.set(...)`, `stopPropagation` so the aria tree does not also select the row). Expansion state is mirrored in the component's `_expandedIds` set (bound to each item's `[expanded]`) so it drives both `mlv-expand` and the programmatic `expandNode`/`collapseNode`/`expandAll`/`collapseAll` API; `(expandedChange)` from aria syncs the set, triggers lazy loading, and emits `nodeToggle`.
- Toggle icon is swapped based on state: `LucideChevronRight` when collapsed, `LucideChevronDown` when expanded (no CSS rotation).
- Expand/collapse uses tree-scoped keyframes (`mlv-tree--enter` / `mlv-tree--leave`) that omit the `translateY` shift used by default `mlv-expand`. `[preserveContent]="true"` on each `ngTreeItem` keeps aria's `DeferredContent` from unmounting the group so `mlv-expand` can animate the collapse.
- Connector lines are rendered as CSS pseudo-elements scoped to nested `.mlv-tree__group` (vertical) and its descendant `.mlv-tree__item` (horizontal); root items sit outside any group and render without connectors. Offset via `--mlv-tree-connector-offset` set per group from `depth`.
- Lazy-loaded children are cached — subsequent expands do not re-trigger the async callback.
- Indentation is applied via `[style.padding-inline-start]="depth() * indentSize() + 'rem'"` on `.mlv-tree__item`, where `depth` is threaded through the recursive `MlvTreeSubtree` (avoids reading aria's `item.level()`, which is only available after the item's `ngOnInit`).
- **Selection membership is O(1):** `_isSelected(id)` (called once per row for the `--selected` class and again per row for the multi-select checkbox `[checked]`) reads a `computed` `Set` derived from `_value` (`_selectedIdSet`) instead of scanning the `_value` array — mirrors the `_expandedIds`/`_loadingIds` Set pattern.
- **Custom-template context is identity-stable:** `MlvTreeSubtree._nodeContext(node)` (bound to `[ngTemplateOutletContext]` for `[mlvTreeNodeDef]`) returns a `WeakMap`-cached `{ $implicit: MlvFlatTreeNode }` wrapper keyed by node identity; a fresh `MlvFlatTreeNode` is built only when a derived field (`depth`/`isExpanded`/`hasChildren`/`isLoading`) actually changes. Unchanged rows keep the same context reference across change detection, so the custom node template (and any OnPush children inside it) is not re-stamped/re-checked against a freshly allocated object each pass. Field changes still produce a new object so consumers see updates.
