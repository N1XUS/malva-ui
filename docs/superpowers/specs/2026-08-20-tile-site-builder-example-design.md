# Tile site-builder example design

**Date:** 2026-08-20

**Status:** Design approved; written spec awaiting review

**Scope:** Tile action slot, recursive Angular CDK drag-and-drop example, user-defined drop restrictions, and nested-builder performance

## Goal

Extend the Tile documentation with a realistic site-block builder that proves the component works in a demanding composition rather than another flat card list. The example contains a fixed page root, draggable rows, draggable content blocks, rows nested inside rows, cross-level movement, and tile-header actions for rename, remove, and publication state.

The builder remains an example, not a new state-management product. `MlvTile` gains only the generally useful action slot. Tree types, movement utilities, and the recursive renderer stay with the documentation example so the Tile package remains a compact surface component.

Success means that a consumer can read the example and understand how to:

1. model containers and leaves without library-owned domain types;
2. use a strongly typed `[accepts]` predicate for application-specific restrictions;
3. move nodes between arbitrary nesting levels without allowing cycles;
4. place multiple interactive controls in a tile header without making the entire tile draggable; and
5. retain smooth motion and responsive pointer performance as the visible tree grows.

## Non-goals

- Adding `kind: 'row' | 'block'` or a fixed block-type union to Malva UI.
- Adding a public `MlvTileBuilder`, page-builder service, persistence layer, undo stack, keyboard drag-and-drop system, or schema editor.
- Making `MlvTile` inspect children, own CDK drop lists, or decide whether a drop is valid.
- Virtualizing nested drop lists. The initial target is dozens to low hundreds of visible nodes; virtualization would interfere with CDK geometry and make the example much harder to follow.
- Treating a disabled content block as non-editable. In this example the switch controls publication state; disabled blocks remain movable, editable, and removable.

## Selected approach

Keep a nested public tree and build a short-lived internal index for each drag session.

This preserves the data shape developers naturally use for a page builder and keeps the example readable. A normalized entity store would make isolated updates cheaper but would bury the Tile lesson under IDs, selectors, and denormalization. A naïve recursive implementation is also rejected because it would repeatedly traverse the tree and call user code while the pointer moves.

The hybrid performs one linear setup pass when a drag begins, constant-time target checks while it moves, and an immutable structural-sharing update when it drops.

## Tile action slot

Add a public `MlvTileActions` structural directive with selector `[mlvTileActions]`, following the existing `MlvTileHeader` pattern. `MlvTile` queries the optional template and renders it in a `.mlv-tile__actions` container after the title and before the built-in close action.

The header is rendered when any of `headerRef`, `actionsRef`, `closable`, or `draggable` is present. The action container is a compact horizontal flex row and takes the remaining inline margin so the title stays flexible. It does not acquire a hover background, and action visibility is not tied to hover; icon buttons and the publication switch must remain discoverable by keyboard and touch users.

The slot is intentionally untyped. Actions are authored where the tile's local node variable is already in scope, so an artificial template context would add inference machinery without improving consumer autocomplete.

Example shape:

```html
<mlv-tile draggable>
  <ng-template mlvTileHeader>{{ node.props.title }}</ng-template>

  <ng-template mlvTileActions>
    <!-- Consumer-owned edit, publication switch, and remove controls. -->
  </ng-template>

  {{ node.props.summary }}
</mlv-tile>
```

Because CDK drag starts only from the built-in handle, activating a switch or action button cannot accidentally begin a drag.

## Generic builder model

The example defines generic structural types. Malva does not prescribe the contents of `TProps`.

```ts
export interface BuilderTile<
  TProps,
  TAcceptsChildren extends boolean,
> {
  readonly id: string;
  readonly acceptsChildren: TAcceptsChildren;
  readonly props: TProps;
}

export interface BuilderTileWithChildren<TProps>
  extends BuilderTile<TProps, true> {
  readonly children: readonly BuilderNode<TProps>[];
}

export interface BuilderTileLeaf<TProps>
  extends BuilderTile<TProps, false> {
  readonly children?: never;
}

export type BuilderNode<TProps> =
  | BuilderTileWithChildren<TProps>
  | BuilderTileLeaf<TProps>;
```

`acceptsChildren` is the discriminant. A true node must have children; a false node cannot acquire them. The boolean generic has no default, preventing the imprecise `BuilderTile<MyProps>` spelling. Consumers use `BuilderNode<TProps>` when either branch is valid.

The example's `PageBuilderProps` demonstrates that applications may define fields such as title, summary, enabled state, and their own block discriminator. Those fields are sample data only and never leak into the generic builder types.

The fixed page root is itself a `BuilderTileWithChildren<PageBuilderProps>`. It supplies a real target tile to the acceptance predicate while remaining visually represented as the builder canvas rather than as a draggable content tile.

## Acceptance contract

The recursive builder exposes an `[accepts]` input with this function type:

```ts
export type BuilderTileAccepts<TProps> = (
  draggedTile: BuilderNode<TProps>,
  targetTile: BuilderTileWithChildren<TProps>,
  innerTiles: readonly BuilderNode<TProps>[],
) => boolean;
```

`innerTiles` is exactly `targetTile.children`: direct children, passed by readonly reference without copying. A consumer that needs a recursive property can traverse from those nodes or maintain that property in its own `props`; the hot path does not flatten descendants.

The user predicate owns business restrictions. The example demonstrates the requested policy: a row cannot enter a row that already contains leaf blocks. It can be expressed structurally without a library-owned `kind`:

```ts
readonly canAccept: BuilderTileAccepts<PageBuilderProps> = (
  draggedTile,
  _targetTile,
  innerTiles,
) =>
  !draggedTile.acceptsChildren ||
  !innerTiles.some((innerTile) => !innerTile.acceptsChildren);
```

The builder always applies structural safety before calling the predicate:

- leaves are never drop containers;
- a node cannot enter itself; and
- a node cannot enter one of its descendants.

Those are integrity rules, not user policy, so `[accepts]` cannot override them. A false predicate leaves the model unchanged and prevents CDK from entering the target.

## Angular typing and autocomplete

The consuming component anchors `TProps` on its root signal and on the predicate alias:

```ts
readonly page = signal<BuilderTileWithChildren<PageBuilderProps>>(
  createInitialPage(),
);

readonly canAccept: BuilderTileAccepts<PageBuilderProps> = (
  draggedTile,
  targetTile,
  innerTiles,
) => true;
```

The template binds a named function rather than an inline lambda:

```html
<docs-tile-builder [root]="page()" [accepts]="canAccept" />
```

With `strictTemplates` enabled, Angular infers `TProps` from `[root]` and checks `[accepts]` against the same type. TypeScript supplies parameter autocomplete inside the annotated predicate. Consumers who create an inline object tree should use an explicit signal type or `satisfies`; otherwise TypeScript may widen literal `true` and `false` values to `boolean` before Angular sees them.

Recursive templates capture an input signal once before narrowing:

```html
@let current = tile();

@if (current.acceptsChildren) {
  @for (child of current.children; track child.id) {
    <!-- current is BuilderTileWithChildren<TProps> here. -->
  }
}
```

This avoids repeated signal calls defeating control-flow narrowing and follows the workspace rule that templates invoke signals explicitly.

## Component and data flow

The numbered Tile example contains three focused units:

1. **Example host:** owns the `page` signal, sample `PageBuilderProps`, the `canAccept` policy, rename state, and handlers for drop, edit, remove, and publication toggles.
2. **Recursive branch component:** renders one level, creates CDK drop containers for true nodes, renders leaf tiles, and emits normalized requests rather than mutating the tree.
3. **Pure tree utilities:** index, validate, move, update, and remove nodes using IDs and immutable structural sharing.

All descendant branch components are inside one `CdkDropListGroup`, allowing CDK to discover dynamically rendered nested lists without recreating a connected-list array on every change-detection pass. Each drag carries its node through `cdkDragData`; each drop list carries its container ID through `cdkDropListData`. No DOM lookup determines application state.

On a successful drop, the recursive component emits source container ID, target container ID, source index, and target index. The host applies one `page.update(...)`. Same-container sorting and cross-container movement share the same pure move utility.

Rename is an inline editing state controlled by the host. Remove recursively deletes the selected non-root node. The switch immutably toggles `props.enabled`; a disabled content block receives a clear status treatment but stays rearrangeable because publication state is distinct from editor permissions.

## Drag-session performance

At drag start, the builder walks the current tree once and creates a session containing:

- node-by-ID and parent-by-ID indexes;
- each container's direct `children` reference;
- the dragged node's descendant IDs; and
- an allowed-target `Set`.

The allowed-target set is calculated once. Structural cycle checks run first, then the supplied `accepts` function runs once for every remaining container. The result is frozen until the drag ends. If external permissions or content state changes during a drag, the next drag session observes the new values.

CDK's enter predicate performs only an allowed-target set lookup. Pointer movement does not traverse the tree, allocate child arrays, execute consumer code, or update Angular signals. Sibling movement remains CDK-owned CSS transforms.

The model changes only on `cdkDropListDropped`. The move utility clones the source and destination arrays and only the ancestor nodes on their paths. Untouched subtree references stay stable, allowing `OnPush` branch components and `@for (...; track node.id)` to preserve their DOM and skip unnecessary work.

The recursive components use signal inputs and `ChangeDetectionStrategy.OnPush`. Predicate callbacks and CDK handlers are stable class members, not template-created closures. The approved action slot has no template-context wrapper to allocate.

## Visual and motion treatment

The builder uses the existing Malva tokens and the polished Tile states. It does not introduce rainbow nesting colors, one-sided status rails, hover background changes, or decorative gradients.

- The fixed root is a quiet canvas with a clear outline and section label.
- Container tiles use spacing and a subtle inset child surface to communicate hierarchy.
- Leaf tiles stay compact so nested rows remain scannable.
- The larger grip remains hidden until tile hover or focus on fine-pointer devices and visible on touch devices.
- A valid candidate gets a complete accent outline. An invalid candidate gets a complete danger outline and a small “Restricted” label in its child surface while the drag is active, so color is not the only signal.
- The moving preview uses the Tile package's elevated shadow.
- Sorting and drop settling use the default transform transition already supplied by Tile.
- New motion uses only transform and opacity, and respects the existing reduced-motion token path.

Action buttons use Lucide icons from the installed icon system, accessible labels, and the standard Malva button treatment. The switch has a visible or accessible publication label. The pointer drag handle remains `aria-hidden` and outside the tab order; keyboard focus follows DOM order through interactive title content, edit, publication switch, remove, and body controls.

## Error and edge handling

- Missing and duplicate IDs make `buildDragSession` return `null`; update helpers receiving an unresolved ID return the original root without corrupting the tree.
- Dropping at the original position returns the original root reference.
- An invalid target, self-drop, or descendant-drop returns the original root reference.
- Removing or renaming the fixed root is not offered by the UI and is rejected by the utility boundary.
- If the dragged node disappears before drop, the drag session is discarded.
- Empty containers remain measurable drop targets and display a restrained “Drop blocks or rows here” hint.
- Action clicks stop only their own button behavior as needed; they do not rely on stopping every header event because drag initiation is handle-scoped.

## Testing and verification

Tile library tests cover:

- rendering `[mlvTileActions]` only when supplied;
- header ordering: handle, title, actions, built-in close action;
- action controls remain interactive inside a draggable tile; and
- the existing handle, disabled-handle, header, and close behavior remains green.

Pure utility tests cover:

- same-container reorder;
- cross-level movement in both directions;
- moving a nested row into another nested row;
- structural sharing of untouched branches;
- no-op identity preservation;
- self and descendant cycle rejection;
- duplicate or missing ID handling;
- recursive removal, rename, and publication toggle; and
- the example policy rejecting a row when the target has direct leaf children.

Component tests cover generic input compatibility, stable `track node.id`, one acceptance evaluation per structurally valid candidate per drag session, the enter predicate performing no new indexing or consumer-predicate calls after session creation, empty-container drops, and normalized drop emission.

Final verification runs the Tile and docs test, typecheck, and lint targets through Nx; the docs API consistency check; and a production docs build. Browser QA at `/tile` exercises allowed and rejected cross-level drops, nested sorting, preview shadow, settle transitions, edit, remove, publication switch, hover-only grip visibility, touch fallback, focus treatment, reduced motion, and narrow layout behavior.
