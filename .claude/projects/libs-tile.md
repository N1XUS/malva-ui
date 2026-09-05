---
# Library: tile

> **Keep this file up to date.** Whenever this library's components, directives, services, or public API change, update this document.

## Overview

The Tile library (`@malva-ui/core/tile`) provides a compact outlined surface for standalone status and summary content plus a compound, immutable tree for nested drag-and-drop layouts. Tiles use the shared five-level density system, support complete-outline semantic tones and a standard close action, and expose header/action slots. `MlvTiles` owns SortableJS-powered list or grid sorting, nested drop targets, acceptance feedback, drag geometry, and immutable tree updates without requiring consumers to import a drag-and-drop engine.

The former `size` input and letter-scale sizing type were intentionally removed. Use `mlvDensity="tight|compact|comfortable|spacious|airy"` or inherit density from an application scope instead.

## Public API

Exported from `libs/core/tile/src/index.ts`:

| Export | Kind | Description |
| --- | --- | --- |
| `MlvTile<TProps>` | Component | Standalone or tree-bound outlined content surface — `mlv-tile` |
| `MlvTiles<TProps>` | Component | Root/nested immutable tree container and list/grid drop target — `mlv-tiles` |
| `MlvTileHeader` | Directive | Header template slot — `[mlvTileHeader]` |
| `MlvTileActions` | Directive | Leading controls slot — `[mlvTileActions]` |
| `MlvTileTrailingActions` | Directive | Trailing controls slot — `[mlvTileTrailingActions]` |
| `MlvTilesEmpty` | Directive | Empty-target prompt slot — `[mlvTilesEmpty]` |
| `MlvTileTone` | Type | `MlvTone | 'default'` |
| `MlvTileNode<TProps, TAcceptsChildren>` | Interface | Common immutable node shape: `id`, structural discriminant, and consumer props |
| `MlvTileNodeLeaf<TProps>` | Interface | Leaf node with `acceptsChildren: false` and no `children` |
| `MlvTileNodeWithChildren<TProps>` | Interface | Container node with `acceptsChildren: true` and readonly `children` |
| `MlvTileTreeNode<TProps>` | Type | Discriminated union of leaf and container nodes |
| `MlvTilesAccepts<TProps>` | Type | Acceptance policy for a dragged node, target container, and its direct children |
| `MlvTilesLayout` | Type | `'list' | 'grid'` |
| `MlvTilesDropState` | Type | `'idle' | 'valid' | 'invalid'` cached target feedback |
| `MlvTileMovedEvent` | Interface | Stable-ID move result with source/target IDs and previous/current indices |
| `MlvTileMoveRequest` | Interface | Stable-ID request consumed by the immutable move helper |
| `MlvTileInsertRequest<TProps>` | Interface | Target container, node, and optional index consumed by the immutable insert helper |
| `MlvTileDragSession<TProps>` | Interface | Indexed, cached acceptance snapshot for one drag |
| `isMlvTileContainer` | Function | Type guard narrowing a node to `MlvTileNodeWithChildren` |
| `insertMlvTileNode` | Function | Immutably inserts a node into a container, rejecting reused IDs and out-of-range indices |
| `moveMlvTileNode` | Function | Immutably moves a valid node while preserving unaffected references |
| `removeMlvTileNode` | Function | Immutably removes a non-root node |
| `updateMlvTileNodeProps` | Function | Immutably replaces one node's props |
| `createMlvTileDragSession` | Function | Indexes a valid tree and evaluates target policies once at drag start |
| `canEnterMlvTileTarget` | Function | Reads target permission from a cached drag session |

---

## Components

### `MlvTile`

**File:** `libs/core/tile/src/lib/tile/tile.ts`

**Selector:** `mlv-tile` | **Change Detection:** `OnPush` | **Encapsulation:** `None`

#### Inputs

| Name           | Type                                   | Default                     | Description                                                                                                                        |
| -------------- | -------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `mlvDensity`   | `MlvDensity`                           | inherited / `'comfortable'` | Overrides shared density for this tile; all five levels change title/body typography, padding, radius, gaps, and control geometry  |
| `tone`         | `MlvTileTone`                          | `'default'`                 | Colors the complete outline with `default`, `info`, `success`, `warning`, or `danger`                                              |
| `tile`         | `MlvTileTreeNode<TProps> \| undefined` | `undefined`                 | Registers this immutable tree node with the enclosing `mlv-tiles`, enables its built-in handle, and marks its direct Sortable item |
| `ariaLabel`    | `string \| undefined`                  | localized `'tile'`          | Human-readable tile name interpolated into the compound drag handle and keyboard move announcements                                |
| `closable`     | `BooleanInput`                         | `false`                     | Adds the standard close action and emits `closed`; the consumer still owns standalone collection state                             |
| `draggable`    | `BooleanInput`                         | `false`                     | Displays an aria-hidden visual grip on a standalone tile; compound consumers use `[tile]` for an operable handle                   |
| `dragDisabled` | `BooleanInput`                         | `false`                     | Disables the handle and tree-bound Sortable item without reducing the tile content's contrast                                      |
| `locked`       | `BooleanInput`                         | `false`                     | Freezes this tile and everything nested inside it; inherited from an enclosing locked container                                    |
| `inactive`     | `BooleanInput`                         | `false`                     | De-emphasises the projected body while leaving header controls at full contrast; does not cascade                                  |

There is deliberately no `size` input. Density is the single sizing API and keeps tile typography, geometry, controls, and application-level density inheritance synchronized.

#### Outputs

| Name     | Type   | Description                                       |
| -------- | ------ | ------------------------------------------------- |
| `closed` | `void` | Emits when the standard close action is activated |

`closed` intentionally has no `opened` model: a tile is persistent consumer-owned content, not an overlay toggle.

#### Methods

| Name          | Signature                                                             | Description                                                                          |
| ------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `insertChild` | `insertChild(tile: MlvTileTreeNode<TProps>, index?: number): boolean` | Inserts a node into this tile's container node through the root-owned immutable tree |
| `remove`      | `remove(): void`                                                      | Removes this registered item through the root-owned immutable tree                   |
| `setProps`    | `setProps(props: TProps): void`                                       | Replaces this registered item's complete props object                                |
| `updateProps` | `updateProps(update: (props: TProps) => TProps): void`                | Derives replacement props from the current immutable props object                    |

These methods are safe no-ops outside a live `[tile]` registration inside `mlv-tiles`; development builds warn when a consumer requests unavailable tree work. `setProps` and `updateProps` never mutate the current tree or props object. `insertChild` additionally requires this tile's node to be a container (`acceptsChildren: true`) and warns in development otherwise; it rejects rather than clamps a non-integer, negative, or out-of-range `index`, and rejects any ID already present anywhere in the tree.

While the tile is `locked`, every **structural** mutation is withdrawn: `remove()` is a no-op and `insertChild()` returns `false`, both warning in development. `setProps` and `updateProps` keep working — `locked` freezes the shape of the tree, not the data in it.

#### Template and control order

`.mlv-tile__header` renders in this stable order:

1. the built-in drag handle, when present — the header's **first** element, ahead of the title
2. the optional header template, in `.mlv-tile__title`
3. `.mlv-tile__controls`, containing:
   1. `MlvTileActions`
   2. `MlvTileTrailingActions`
   3. `MlvButtonClose` when `closable` and not `locked`

The handle leads the header as a fixed-width indent rather than sitting mid-cluster inside `.mlv-tile__controls`, so its reserved space (and the idle low-opacity resting state below) reads as an intentional gutter instead of a hole between actions and close. `.mlv-tile__controls` keeps consumer actions ahead of trailing actions, with destructive dismissal at the far edge. The body always renders through `.mlv-tile__body`.

Only a tree-bound `[tile]` inside `mlv-tiles` renders the drag grip as a focusable button. It exposes localized Alt+Arrow instructions, uses `ariaLabel` rather than the stable model ID as its human name, restores focus after a keyboard move, and announces accepted or rejected operations through the root list's polite live region. A standalone `draggable` tile preserves the historical visual affordance without exposing a no-op control to assistive technology.

### `MlvTiles`

**File:** `libs/core/tile/src/lib/tiles/tiles.ts`

**Selector:** `mlv-tiles` | **Change Detection:** `OnPush` | **Encapsulation:** `None`

#### Inputs

| Name         | Type                                           | Default                | Description                                                                                     |
| ------------ | ---------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------- |
| `tree`       | `MlvTileNodeWithChildren<TProps> \| undefined` | `undefined`            | Root-only model input; bind once with `[(tree)]`                                                |
| `layout`     | `MlvTilesLayout`                               | `'list'`               | Uses vertical list sorting or responsive two-dimensional grid sorting                           |
| `accepts`    | `MlvTilesAccepts<TProps> \| undefined`         | inherited / accept all | Overrides the closest ancestor policy for this container subtree                                |
| `locked`     | `BooleanInput`                                 | `false`                | Freezes this container and its whole subtree; cascades to nested `mlv-tiles` and `mlv-tile`     |
| `emptyLabel` | `string \| undefined`                          | localized prompt       | Replaces the localized empty-target prompt; a projected `[mlvTilesEmpty]` template wins over it |

#### Outputs

| Name         | Type                                           | Description                                                             |
| ------------ | ---------------------------------------------- | ----------------------------------------------------------------------- |
| `treeChange` | `MlvTileNodeWithChildren<TProps> \| undefined` | Model output emitted when the root tree reference changes               |
| `moved`      | `MlvTileMovedEvent`                            | Emits after a successful move with stable IDs and source/target indices |

#### Properties

| Name        | Type                                | Description                                                |
| ----------- | ----------------------------------- | ---------------------------------------------------------- |
| `dropState` | `WritableSignal<MlvTilesDropState>` | Cached visual acceptance state for this target             |
| `targetId`  | `Signal<string \| undefined>`       | Root ID or enclosing tile ID represented by this container |
| `isEmpty`   | `Signal<boolean>`                   | Whether the target currently has no direct children        |

#### Methods

| Name     | Signature                                                        | Description                                                                   |
| -------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `insert` | `insert(tile: MlvTileTreeNode<TProps>, index?: number): boolean` | Inserts a node into this container through the root-owned immutable tree      |
| `remove` | `remove(tileId: string): boolean`                                | Removes a registered item from this compound tree through the root-owned tree |

Both return `true` only when the root tree reference was actually replaced, and both are withdrawn while the target is `locked` — returning `false` and warning in development. `insert` is refused when **this** container is locked; `remove` is refused when the node being removed is itself a locked container **or** sits inside one, resolved against the same locked set the drag session uses, so an unlocked root cannot reach into a locked subtree by ID. `insert` targets this container's own node (`targetId()`), so a nested container's "Add" button needs a template reference and no ID plumbing. It appends when `index` is omitted and **rejects** — never clamps — a non-integer, negative, or out-of-range index, matching `moveMlvTileNode`. It also rejects an ID that already exists anywhere in the tree, including any ID inside the inserted subtree, and any subtree carrying internal duplicates. There is deliberately no `inserted` output: `treeChange` is the canonical structural signal and fully describes an insert.

Bind one root container with `[(tree)]`. A nested `mlv-tiles` must sit inside an `mlv-tile [tile]` and must not bind a second tree; it inherits the root coordinator and derives its target from the enclosing node. A missing root binding, a nested binding, or a nested container outside a tree-bound tile fails early with a descriptive error.

#### Drag policy and immutable behavior

- At drag start, the root tree is indexed by stable ID and each effective `accepts` policy is evaluated once. Pointer movement reads the cached `allowedTargetIds`; it does not repeatedly call consumer policy.
- Duplicate IDs invalidate the session. The fixed root, the dragged node itself, and every descendant target are excluded, preventing cycles even when consumer policy would allow them.
- Moves validate source identity and indices. Invalid/no-op requests return the original root object and emit nothing.
- Successful moves, removals, and prop updates replace only affected ancestors and preserve references for unaffected subtrees.
- Nested policies inherit from the closest registered ancestor unless a container provides its own `accepts` callback.
- Consumers bind the root tree, pass each node through `[tile]`, and optionally set `[dragDisabled]`; `MlvTiles` privately groups the rendered SortableJS containers and owns the built-in handle interaction.
- List mode sorts vertically. Grid mode uses two-dimensional pointer sorting and responsive full-width tracks without squeezing recursive content.
- Every container publishes its nesting depth as the `--mlv-tiles-depth` host style variable (root `0`). The list gap and the empty-target `min-block-size` taper with it so four levels stay legible; the gap floors at `--mlv-spacing-1` and the empty target never drops below `--mlv-height-l`. A consumer opts out of both by pinning `--mlv-tiles-depth: 0`.
- Valid and invalid targets use a full-border state. Invalid targets also reveal the localized `restrictedTarget` marker. `.mlv-tiles__restriction` is absolutely positioned inside the relatively positioned container, so it is out of flow entirely: it never changes the container footprint — at rest or during a drag — and never intercepts the pointer.
- `locked` is evaluated **before** `accepts`. A locked container and every container beneath it are added to the drag session's excluded set, so a consumer policy returning `true` can never re-open a frozen target. `locked` cascades through DI, so each descendant marks itself and the lock survives the nested-engine boundary that `dragDisabled` cannot cross. The coordinator additionally derives the locked container set from the tree itself, so the cascade also covers containers with no rendered `mlv-tiles` of their own.
- A locked subtree withdraws the **complete** set of structural operations — pointer, keyboard, and programmatic alike. Nothing below can be reordered, and nothing can be added to or taken out of it:

  | Withdrawn while locked                      | Effect                                                                                        |
  | ------------------------------------------- | --------------------------------------------------------------------------------------------- |
  | Drag handle                                 | not rendered; every tree-bound item is marked drag-disabled for the sorting engine            |
  | Standard close action                       | not rendered (`closable` is ignored)                                                          |
  | Drop target                                 | excluded from every drag session before `accepts` runs                                        |
  | Empty-target prompt                         | withheld, so a read-only region never invites a drop                                          |
  | `MlvTile.remove()`                          | no-op, warns in development                                                                   |
  | `MlvTile.insertChild()`                     | returns `false`, warns in development                                                         |
  | `MlvTiles.insert()`                         | returns `false`, warns in development                                                         |
  | `MlvTiles.remove(tileId)`                   | returns `false` for a locked node or any node inside a locked container, warns in development |
  | `MlvTileTreeCoordinator.insert` / `.remove` | reject silently — the structural backstop a consumer cannot bypass                            |

  **Not** withdrawn: `setProps` and `updateProps`. `locked` freezes the shape of the tree, not the data in it, so a read-only region can still re-render with fresh content.

- `dragDisabled` and `locked` are complementary: `dragDisabled` stops one node being picked up, does not cascade, leaves the node usable as a drop target, and still renders a disabled handle. `locked` freezes a whole subtree, excludes it from every session, and renders no handle at all.
- A locked tile gets no `aria-disabled`: its region stays reachable, readable, and interactive. The handle's `aria-describedby` and `aria-keyshortcuts` disappear with the handle itself.
- The drag handle draws the design-system focus ring — Form B/inset per SF-R3 (`outline: var(--mlv-stroke-width-medium) solid var(--mlv-border-focus)`, `outline-offset: calc(var(--mlv-focus-ring-offset) * -1)`) on `:focus-visible`, so it matches the `mlvButton` controls that share its `.mlv-tile__header` row instead of falling back to the UA default. `.mlv-tile` clips to its padding box (`overflow: hidden`); Form A (a positive offset) would let the ring reach up to `0.3125rem` past the handle in the high-contrast theme (stroke doubles, offset does not), past the tightest applied padding of `--mlv-padding-xs` (`0.25rem` block). The inset form caps the protrusion at `stroke-width-medium − focus-ring-offset` — `0.0625rem` at most, in high-contrast only — comfortably inside that padding. `tile.spec.ts` asserts both the rule and that headroom.
- The pointer-following fallback clone is inert, hidden from assistive technology, and stripped of duplicate IDs. Its elevated treatment preserves the direct wrapper geometry while the in-flow ghost preserves the source footprint.
- The clone's elevated box-shadow cannot transition — SortableJS applies `fallbackClass` to it before the clone is ever appended to the DOM, so it always has its final style from first paint. `.mlv-tile` instead elevates on `.mlv-tiles__sortable-chosen` (the still-connected source tile SortableJS marks the instant it is picked up), reusing the `box-shadow` transition the block already declares, so the pick-up reads as an animated lift.
- Sortable's `fallbackTolerance` is `0` (the library default): dragging is already gated to `.mlv-tile__drag-handle`, which has no competing click action, so no movement threshold is needed to disambiguate a click from a drag.
- SortableJS animates sibling transforms for 200 ms with the shared easing token. Reduced-motion preference disables engine animation and visual transitions.
- On drop, the engine restores the consumer-owned wrapper before the coordinator applies one stable-ID immutable move, so Angular remains authoritative for recursive view reconciliation.
- Keyboard indent (`Alt+ArrowRight`) looks for the nearest **preceding** eligible sibling container first, then falls back to the nearest **following** one, so a first-position tile can still be indented. It announces through the same `movedInto` live-region message.
- `resolveItemRoot` walks up to the _direct_ child of the list host. Keep each projected node a direct child of `mlv-tiles`: wrapping all children in one shared element collapses every item to the same root and silently breaks sorting. Drive columns with `layout="grid"` and `--mlv-tiles-min-column` instead.
- **Never leave a persisting CSS animation on `transform` on an item root.** A CSS animation outranks an inline declaration, and `animation-fill-mode: both`/`forwards` keeps the final keyframe value applied after the animation ends. Because the engine writes the drag offset as an inline `transform` and reads it back through `getComputedStyle` to accumulate the next delta, a pinned `transform` makes every read return identity: the dragged item advances by only the per-move delta and never follows the pointer, while the drop still lands correctly. The same pin disables the 200 ms sibling reorder animation. Use `fill-mode: backwards` for entrance/stagger animations, or animate `opacity` alone. The pointer-following fallback clone is protected automatically — it is given an inline `animation: none` at drag start — but consumer-owned item roots are not.

---

## Directives

### `MlvTileHeader`

**File:** `libs/core/tile/src/lib/tile-header.ts`

**Selector:** `[mlvTileHeader]`

Marks an `<ng-template>` as the tile title/header content.

### `MlvTileActions`

**File:** `libs/core/tile/src/lib/tile-actions.ts`

**Selector:** `[mlvTileActions]`

Marks an `<ng-template>` as the leading action area rendered before the handle.

### `MlvTileTrailingActions`

**File:** `libs/core/tile/src/lib/tile-trailing-actions.ts`

**Selector:** `[mlvTileTrailingActions]`

Marks an `<ng-template>` as the trailing action area rendered after the handle and before the standard close action.

### `MlvTilesEmpty`

**File:** `libs/core/tile/src/lib/tiles-empty.ts`

**Selector:** `[mlvTilesEmpty]`

Marks an `<ng-template>` as the empty-target prompt of the enclosing `mlv-tiles`. This is where editors put their "Add …" affordance, which a plain string input cannot hold. Precedence: projected `[mlvTilesEmpty]` template → `MlvTiles.emptyLabel` → the localized `emptyTarget` message. Nothing renders inside a locked container.

There is deliberately no override for the `Restricted` marker: it is fixed engine feedback with one meaning, and translation is the correct lever.

All four directives extend `MlvStructural`. The three tile slots expose their template through the parent `MlvTile` query; `MlvTilesEmpty` through the parent `MlvTiles` query.

---

## Tree contracts

`acceptsChildren` is the structural discriminant. Consumer-specific fields belong only in `props`; the Tile package does not require application concepts such as `kind` or `blockType`.

```ts
interface PageTileProps {
  title: string;
  kind: 'section' | 'row' | 'copy';
  enabled: boolean;
}

const page: MlvTileNodeWithChildren<PageTileProps> = {
  id: 'page',
  acceptsChildren: true,
  props: { title: 'Campaign', kind: 'section', enabled: true },
  children: [],
};
```

`MlvTilesAccepts<TProps>` receives `(draggedTile, targetTile, innerTiles)` and returns a boolean. Use the typed props to express application rules while leaving cycle prevention, root protection, indexing, and connection management to the library.

`MlvTileMovedEvent` contains `tileId`, `sourceContainerId`, `targetContainerId`, `previousIndex`, and `currentIndex`.

`MlvTileInsertRequest<TProps>` contains `targetContainerId`, the `tile` node to insert, and an optional `index`.

`isMlvTileContainer(node)` narrows `MlvTileTreeNode<TProps>` to `MlvTileNodeWithChildren<TProps>` so recursive consumers stop re-writing `node.acceptsChildren ? …` inline.

All four immutable helpers (`insertMlvTileNode`, `moveMlvTileNode`, `removeMlvTileNode`, `updateMlvTileNodeProps`) share the same contract: they never mutate their input, never throw, return the **same root reference** on every rejection, and rebuild only the affected ancestor chain so unaffected subtrees keep their object identity. `insertMlvTileNode` rejects a tree that already contains duplicate IDs, an unknown target container, a reused ID anywhere in the inserted subtree, a subtree with internal duplicate IDs, and any non-integer, negative, or out-of-range index. ID minting stays application policy — the library only rejects collisions.

---

## Usage examples

### Standalone density and tone

```html
<mlv-tile mlvDensity="spacious" tone="warning" closable (closed)="dismiss()">
  <ng-template mlvTileHeader>Review required</ng-template>
  <p>Typography and geometry follow the spacious density.</p>
</mlv-tile>
```

### Compound tree root and recursive child

```html
<mlv-tiles [(tree)]="page" [accepts]="canAccept" layout="grid" (moved)="onMoved($event)">
  @for (node of page().children; track node.id) {
  <app-page-tile [node]="node" />
  }
</mlv-tiles>
```

```html
<mlv-tile #tileRef [tile]="node()">
  <ng-template mlvTileHeader>{{ node().props.title }}</ng-template>
  <ng-template mlvTileActions>
    <button mlvButton (click)="edit()">Edit</button>
  </ng-template>
  <ng-template mlvTileTrailingActions>
    <button mlvButton shape="circle" aria-label="Remove" (click)="tileRef.remove()">
      <svg lucideTrash2 aria-hidden="true" />
    </button>
  </ng-template>

  @if (node().acceptsChildren) {
  <mlv-tiles layout="grid">
    @for (child of node().children; track child.id) {
    <app-page-tile [node]="child" />
    }
  </mlv-tiles>
  }
</mlv-tile>
```

### Locked subtree with a consumer-owned empty prompt

```html
<mlv-tiles [(tree)]="page" [accepts]="canAccept">
  <mlv-tile [tile]="header()" locked>
    <ng-template mlvTileHeader>Header</ng-template>
    <mlv-tiles>
      <!-- Read-only: no handle, no close action, no drop target. -->
    </mlv-tiles>
  </mlv-tile>

  <mlv-tile #bodyRef [tile]="body()">
    <ng-template mlvTileHeader>Body</ng-template>
    <mlv-tiles emptyLabel="No blocks yet">
      <ng-template mlvTilesEmpty>
        <button mlvButton (click)="bodyRef.insertChild(newBlock())">Add block</button>
      </ng-template>
      @for (child of body().children; track child.id) {
      <app-page-tile [node]="child" />
      }
    </mlv-tiles>
  </mlv-tile>
</mlv-tiles>
```

The documentation's compound-tree example is intentionally only a consumer of these public primitives. It owns sample props, typed acceptance rules, and recursive presentation; it does not ship a package-external session engine, registry, sorting algorithm, or drag-clone implementation.

---

## BEM class reference

| Class                                          | Description                                                                                                                             |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `.mlv-tile`                                    | Tile root                                                                                                                               |
| `.mlv-tile--tone-info/success/warning/danger`  | Complete semantic outline                                                                                                               |
| `.mlv-tile--draggable`                         | Tile with an active built-in handle                                                                                                     |
| `.mlv-tile--drag-disabled`                     | Disabled-handle state                                                                                                                   |
| `.mlv-tile--locked`                            | Structurally frozen tile: quieter outline and title, no handle or close                                                                 |
| `.mlv-tile--inactive`                          | Body-only de-emphasis; non-cascading, no ARIA state                                                                                     |
| `.mlv-tile--leaving`                           | Consumer-applied leave state used by dismissing lists                                                                                   |
| `.mlv-tile__header`                            | Handle, title, and controls row                                                                                                         |
| `.mlv-tile__title`                             | Flexible projected header content                                                                                                       |
| `.mlv-tile__controls`                          | Ordered action/close group, after the title                                                                                             |
| `.mlv-tile__actions`                           | Leading actions                                                                                                                         |
| `.mlv-tile__drag-handle`                       | Built-in SortableJS handle — the header's first element, ahead of the title                                                             |
| `.mlv-tile__trailing-actions`                  | Trailing actions                                                                                                                        |
| `.mlv-tile__close`                             | Standard close action                                                                                                                   |
| `.mlv-tile__body`                              | Projected body                                                                                                                          |
| `.mlv-tiles`                                   | Compound container/drop target                                                                                                          |
| `.mlv-tiles--layout-list` / `.mlv-tiles--grid` | Layout modes                                                                                                                            |
| `.mlv-tiles--valid` / `.mlv-tiles--invalid`    | Full-border acceptance feedback                                                                                                         |
| `.mlv-tiles--locked`                           | Frozen container: drops the valid/invalid drag outline                                                                                  |
| `.mlv-tiles__restriction`                      | Out-of-flow invalid-target marker overlay                                                                                               |
| `.mlv-tiles__empty`                            | Empty-target prompt wrapper; the only element placed `grid-column: 1 / -1`, so it also wraps a projected `[mlvTilesEmpty]` slot         |
| `.mlv-tiles__empty--projected`                 | Empty wrapper holding a projected slot; drops the built-in padding, colour, size, and centering so the consumer owns its own typography |
| `.mlv-tiles__item-root`                        | Direct consumer wrapper managed during sorting                                                                                          |
| `.mlv-tiles__sortable-ghost`                   | In-flow source-footprint marker                                                                                                         |
| `.mlv-tiles__sortable-fallback`                | Sanitized pointer-following clone                                                                                                       |

Density modifiers (`.mlv-tile--tight`, `--compact`, `--comfortable`, `--spacious`, `--airy`) are applied by `MlvDensityDirective`; consumers set `mlvDensity` rather than classes.

### Public CSS variables

| Variable                 | Owner       | Default             | Description                                                                                                                                      |
| ------------------------ | ----------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--mlv-tiles-min-column` | `mlv-tiles` | `20rem`             | Minimum grid track width in `layout="grid"`; set it per breakpoint to control column count                                                       |
| `--mlv-tiles-depth`      | `mlv-tiles` | written by the host | Nesting depth (root `0`), published as a host style binding. Drives the depth-tapered list gap and empty-target height; pin it to `0` to opt out |

---

## Direction (RTL)

- **Scoped, not per-document.** The tile tree's keyboard handler passes its own host to `MlvRtlService.normalizeArrowKey(event, host)`, so a `mlv-tiles` grid inside a `[dir="rtl"]` subtree mirrors its horizontal stepping and its expand / collapse arrows while the document stays LTR — and an LTR island under an RTL document does not.
- Vertical arrows, `Home` / `End` and activation keys never mirror.
- Regressions in `tile.spec.ts`.

## Dependencies

| Package                 | Role                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `@angular/core`         | Signals, component/directive APIs, DI, lifecycle                                     |
| `@angular/common`       | `NgTemplateOutlet`                                                                   |
| `@angular/cdk/coercion` | Boolean coercion                                                                     |
| `@malva-ui/cdk/density` | Five-level density host directive and context                                        |
| `@malva-ui/cdk/utils`   | `MlvStructural` and semantic tone contract                                           |
| `@malva-ui/core/button` | `MlvButtonClose`                                                                     |
| `@malva-ui/i18n`        | Close action, handle label, keyboard announcements, empty and restricted target text |
| `@lucide/angular`       | Grip icon                                                                            |
| `sortablejs`            | Private nested list/grid sorting engine                                              |

Consumers of compound Tile drag-and-drop import only `@malva-ui/core/tile`; SortableJS remains an implementation detail.

---

## File structure

```text
libs/core/tile/src/
  index.ts
  lib/
    tile/
      tile.ts
      tile.html
      tile.scss
    tiles/
      tiles.ts
      tiles.html
      tiles.scss
    tile-actions.ts
    tile-drag-session.ts
    tile-header.ts
    tile-item-context.ts
    tile-locked-context.ts
    tile-trailing-actions.ts
    tile-tree-coordinator.ts
    tile-tree-state.ts
    tile-tree.types.ts
    tiles-empty.ts
```
