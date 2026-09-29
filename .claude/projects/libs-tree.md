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
- Lazy loading via async `loadChildren` callback with spinner (`mlv-loader`); a rejected load recovers (collapses, `loadError`, next expand retries)
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
| `MlvTreeLoadError<T>`      | Interface      | `loadError` payload: `{ node, error }` — the node whose `loadChildren()` failed and the reason, as given     |
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

| Output            | Type                    | Description                                                                                                                                                                    |
| ----------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `selectionChange` | `Set<string \| number>` | Emits selected node IDs on change                                                                                                                                              |
| `nodeActivate`    | `MlvTreeNode<T>`        | Emits when a node is activated (click or Enter)                                                                                                                                |
| `nodeToggle`      | `{ node, expanded }`    | Emits when a node is expanded or collapsed — by the user, or by the tree after a failed lazy load. Not emitted for `expandNode` / `collapseNode` / `expandAll` / `collapseAll` |
| `loadError`       | `MlvTreeLoadError<T>`   | Emits when a node's `loadChildren()` rejects or throws, after the tree has cleared the spinner and collapsed the node (see _Lazy-load failure_)                                |

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
  loadChildren?: () => Promise<MlvTreeNode<T>[]>; // Async lazy loader; a rejection emits loadError
  disabled?: boolean;
  icon?: string; // Optional Lucide icon name shown in the default template
  expanded?: boolean; // Initial expanded state
}
```

## Lazy-load failure (#353)

A `loadChildren()` that rejects — or throws synchronously — no longer strands the node. Before, `_loadLazy` chained `.then()` with no rejection path: the id stayed in the loading set for the page's life, so the spinner never went, the chevron never came back, the retry guard (`!_loadingIds().has(id)`) refused every later expand, and the rejection surfaced as an unhandled promise rejection. Now, on failure:

1. The id leaves the loading set: spinner gone, chevron back, `--loading` off.
2. The node **collapses** if it is still expanded, so an expanded row never sits over an empty group and one expand retries. `nodeToggle` emits `{ node, expanded: false }` for that collapse, keeping a consumer's expansion mirror in step. A node the user collapsed during the load stays collapsed and gets no extra `nodeToggle`.
3. `loadError` emits `{ node, error }`, the error exactly as rejected or thrown.
4. Nothing is cached, so the next expand calls `loadChildren()` again.

Mechanics worth keeping:

- `loadChildren()` runs synchronously on expand, inside a `try`, called as a method of the node (`node.loadChildren()`, never read into a local first), so a class-model or object-literal loader keeps `this`. Its promise goes through `Promise.resolve()`. That returns a native promise unchanged, so the success path keeps its microtask timing. A synchronous throw becomes `Promise.reject(error)` instead of escaping into the aria `expandedChange` handler. Both outcomes settle in a later microtask, after the expand's own `nodeToggle`.
- The collapse takes two steps (`_onExpandedChange` now receives the aria item):
  1. **Write the model.** If the item is expanded, inside the tree's host element and its node is still in `nodes` (`_findNode`), its `TreeItem.expanded` model is set to `false`. That routes back into `_onExpandedChange`: the id is dropped and `nodeToggle` emitted. Dropping the id from `_expandedIds` alone fails when the load settles before change detection has run since the expand (a sync throw, an already-rejected promise). The `[expanded]` binding then still holds its last value, `false`, so the drop pushes nothing and the item stays open.
  2. **Drop the id.** If the id is still expanded after step 1, it is dropped directly and `nodeToggle` is emitted there. This covers an item that was destroyed (its node left `nodes`, or was re-added or moved as a new row), one under a collapsed ancestor's closed `mlv-expand`, and a write that reached no listener. Change detection has run in each of these cases, so the binding carries the drop. When step 1 collapsed the node, the id is already gone and step 2 emits nothing, so `nodeToggle` fires once.
- Why step 1 needs both checks:
  - "Inside the host" alone does not prove the item is alive. A leave animation (`animate.leave` in a consumer node template) keeps a destroyed row's element attached until it ends, and writing a destroyed item's model reaches no listener and warns NG0953. That is why the node must also still be in the data.
  - "In the data" alone misses a node re-added as a new row, whose old item is detached. That is why the host check stays.
- **Residual:** a node moved to another parent (or re-added elsewhere in the tree) while its old row's leave animation is still running passes both checks through the old item. Step 1 then writes to a destroyed item and Angular logs one NG0953 warning. It is logged in production too; dev mode only adds the message text. Step 2 still collapses the node's new row. A re-add in the same position does not reach this, because Angular drops the leaving row at once.
- Once the tree is destroyed nothing is emitted (a destroyed `OutputRef` warns NG0953).
- **No built-in error text or announcement.** The tree cannot know the right wording or whether the consumer already shows a toast; tell the user from `loadError` (docs example 4 uses a `role="status"` line). The loading spinner is still `aria-hidden`; its label resolves through `MLV_TREE_I18N.loadingChildren` (#371).
- Pinned by `tree-lazy-load-error.spec.ts` (11 specs). The leave-animation window (a removed node, and a node moved to another parent) is reproduced by re-attaching the old row by hand, because TestBed runs no animations. A class-model and an object-literal loader that read `this` pin the method call. `host.events` pins the order: `nodeToggle` (the collapse) comes before `loadError`.
- Each ablation turns specs red:

  | Ablation                                   | Specs that go red |
  | ------------------------------------------ | ----------------- |
  | Model write                                | 1                 |
  | Host check                                 | 1                 |
  | `_findNode` gate                           | 1                 |
  | Independent `if` → `else if`               | 1                 |
  | Destroyed guard                            | 1                 |
  | `try`/`catch`                              | 1                 |
  | Loader read into a local (drops `this`)    | 2                 |
  | Fallback `nodeToggle`                      | 4                 |
  | Swapping `loadError` ahead of the collapse | 5                 |

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
- `@malva-ui/i18n` — `MLV_TREE_I18N` (optional inject) + `MlvI18nResolverService` for the row control names
- `@malva-ui/styles` — all `--mlv-*` CSS custom properties

## Accessibility

- All ARIA is now emitted by `@angular/aria`. Each `[ngTreeItem]` row (`role="treeitem"`) exposes `aria-level` (1-based depth), `aria-setsize` (sibling count at that level), `aria-posinset` (1-based position among siblings), `aria-expanded`, `aria-selected` (or `aria-current` in `nav` mode), and `aria-disabled`. The `.mlv-tree__root` container carries `role="tree"`, `aria-multiselectable`, `aria-orientation`, `aria-disabled` and `aria-activedescendant`.
- **Single tab stop:** aria manages the roving tabindex on the rows — only the active row has `tabindex="0"`; the `.mlv-tree__root` container holds `tabindex="-1"`. In multi-select mode the per-row `mlv-checkbox` is rendered with `[tabbable]="false"` (and `pointer-events: none`) so it neither adds a second tab stop nor intercepts the row click — it is a presentational reflection of `aria-selected`; **Space**/click toggles selection via aria.
- **Enter/Space** select (single) or toggle (multi) the focused row via aria. `nodeActivate` is emitted on row click/Enter/Space in `none` mode and on user single-selection.
- Disabled rows stay focusable-but-inert (`softDisabled=true`) so arrow navigation still lands on them, matching the historical behavior.
- **Localized control names (#371):** the chevron toggle (`expandNode` / `collapseNode`), the multi-select checkbox (`selectNode`) and the lazy-load spinner (`loadingChildren`) resolve through `MLV_TREE_I18N` (new `MlvTreeI18n` slice, every key optional, `{label}` = the node label). English fallbacks in `tree-subtree.ts`'s `OPTIONAL_MESSAGE_FALLBACKS` are byte-identical to the old literals ("Expand {label}", "Collapse {label}", "Select {label}", "Loading children"). All 14 packs translate them; a live language switch re-resolves (`tree-i18n.spec.ts`). The toggle is `tabindex="-1"` inside a `treeitem`, so its name is read only when a pointer or AT reaches it directly.
- **Rows read the pack at render (#371).** With `provideMlvI18n(lazyLoader)` the tree needs the pack loaded before it renders — true in an app (the loader is an app initializer bootstrap awaits), not in a TestBed that renders without awaiting `ApplicationInitStatus.donePromise` (`no language pack loaded`). The three tree specs that used the lazy loader now use `provideMlvI18nTesting()`, and the static `@malva-ui/i18n` import in `tree-subtree.ts` retires their dynamic-import workaround (a static and a dynamic import of one project fail `@nx/enforce-module-boundaries`).
- **Axe:** first sweeps in #371 (`tree-i18n.spec.ts`: multi-select collapsed, then expanded with a loading spinner). `core-tree` moves to the `owes` shape in `ROLLOUT_PENDING` — single selection, `nav`, a disabled node, a custom template, connectors and a scoped RTL are still unswept.

## Notes

- Multi-select renders a `mlv-checkbox` per node, non-tabbable (`[tabbable]="false"`) and `pointer-events: none` (presentational). No circular dependency — `@malva-ui/core/checkbox` does not import the tree library.
- The chevron toggle flips the aria `TreeItem.expanded` model (`_onToggle` → `item.expanded.set(...)`, `stopPropagation` so the aria tree does not also select the row). Expansion state is mirrored in the component's `_expandedIds` set (bound to each item's `[expanded]`) so it drives both `mlv-expand` and the programmatic `expandNode`/`collapseNode`/`expandAll`/`collapseAll` API; `(expandedChange)` from aria syncs the set, triggers lazy loading, and emits `nodeToggle`.
- Toggle icon is swapped based on state: `LucideChevronRight` when collapsed, `LucideChevronDown` when expanded (no CSS rotation).
- Expand/collapse uses tree-scoped keyframes (`mlv-tree--enter` / `mlv-tree--leave`) that omit the `translateY` shift used by default `mlv-expand`. `[preserveContent]="true"` on each `ngTreeItem` keeps aria's `DeferredContent` from unmounting the group so `mlv-expand` can animate the collapse.
- Connector lines are rendered as CSS pseudo-elements scoped to nested `.mlv-tree__group` (vertical) and its descendant `.mlv-tree__item` (horizontal); root items sit outside any group and render without connectors. Offset via `--mlv-tree-connector-offset` set per group from `depth`.
- Lazy-loaded children are cached — subsequent expands do not re-trigger the async callback. A failed load caches nothing, so the next expand retries (see _Lazy-load failure_).
- Indentation is applied via `[style.padding-inline-start]="depth() * indentSize() + 'rem'"` on `.mlv-tree__item`, where `depth` is threaded through the recursive `MlvTreeSubtree` (avoids reading aria's `item.level()`, which is only available after the item's `ngOnInit`).
- **Selection membership is O(1):** `_isSelected(id)` (called once per row for the `--selected` class and again per row for the multi-select checkbox `[checked]`) reads a `computed` `Set` derived from `_value` (`_selectedIdSet`) instead of scanning the `_value` array — mirrors the `_expandedIds`/`_loadingIds` Set pattern.
- **Custom-template context is identity-stable:** `MlvTreeSubtree._nodeContext(node)` (bound to `[ngTemplateOutletContext]` for `[mlvTreeNodeDef]`) returns a `WeakMap`-cached `{ $implicit: MlvFlatTreeNode }` wrapper keyed by node identity; a fresh `MlvFlatTreeNode` is built only when a derived field (`depth`/`isExpanded`/`hasChildren`/`isLoading`) actually changes. Unchanged rows keep the same context reference across change detection, so the custom node template (and any OnPush children inside it) is not re-stamped/re-checked against a freshly allocated object each pass. Field changes still produce a new object so consumers see updates.
