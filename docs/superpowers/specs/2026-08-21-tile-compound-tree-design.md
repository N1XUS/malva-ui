# Tile Compound Tree Design

## Status

Approved design. It replaces the docs-only recursive builder architecture from
`2026-08-20-tile-site-builder-example-design.md`.

This specification preserves the approved Tile visual polish and generic tree
semantics, but moves drag coordination, acceptance, immutable mutation, and
nested target handling into the published `@malva-ui/core/tile` package.

## Problem

The first site-builder example implemented recursion, CDK registration,
acceptance sessions, target precedence, and immutable tree mutation inside the
docs application. That makes the example large and asks consumers to recreate
library-level behavior. Iterating on grid sorting also exposed a mismatch
between synthetic drop tests and real pointer behavior: sibling reordering,
returning a container to its original position, preview geometry, and nested
layout stability could fail while component tests stayed green.

Consumers should compose only two public elements:

- `mlv-tiles`: a container and drop surface;
- `mlv-tile`: a typed item with projected header, content, actions, and an
  optional nested `mlv-tiles`.

The library must own the difficult behavior.

## Goals

- Publish a generic compound Tile tree API from `@malva-ui/core/tile`.
- Replace Tile's five-value `[size]` API with the shared `mlvDensity` system.
- Make density scale Tile typography together with spacing, radius, and
  controls.
- Keep exactly one writable root tree through `[(tree)]`.
- Let nested `mlv-tiles` discover their enclosing `mlv-tile` and root
  coordinator automatically.
- Handle same-level and cross-level moves with immutable structural sharing.
- Keep `acceptsChildren` as the structural discriminant.
- Keep consumer restrictions user-defined through `[accepts]`.
- Reject self and descendant cycles before consumer policy runs.
- Evaluate policy once per structurally valid target at drag start, then use
  `Set` membership during pointer movement.
- Make pointer sorting, preview geometry, placeholder layout, and target
  precedence work in the actual browser for nested list and grid layouts.
- Preserve content projection and application-owned action controls.
- Reduce the site-builder example to data, a typed predicate, recursive markup,
  and projected content—no custom CDK registry or mutation engine.

## Non-goals

- A monolithic model-driven page-builder component.
- Persistence, undo/redo, history, selection, copy/paste, or virtualization.
- Library-owned application discriminators such as `kind` or `blockType`.
- Library-owned editing forms or publication semantics.
- Automatically inferring arbitrary user properties such as `title` or
  `enabled`.
- DOM-only reordering that can diverge from Angular state.

## Approaches Considered

### Compound components with a root tree model — selected

`mlv-tiles` and `mlv-tile` form the public composition surface. The root
container owns `[(tree)]`; nested containers inherit its coordinator. This
keeps markup flexible while centralizing drag and mutation correctness.

### Event-only compound components — rejected

An event-only API would still force every consumer to implement cross-tree
lookup, cycle prevention, immutable moves, and source/target reconciliation.
That is the complexity this feature is intended to remove.

### One monolithic builder — rejected

A single `mlv-tile-builder` would hide the desired markup, make projected
application content awkward, and conflict with the requested `mlv-tiles` /
`mlv-tile` hierarchy.

## Public Data Model

The package exports generic types without a default for the boolean generic:

```ts
export interface MlvTileNode<
  TProps,
  TAcceptsChildren extends boolean,
> {
  readonly id: string;
  readonly acceptsChildren: TAcceptsChildren;
  readonly props: TProps;
}

export interface MlvTileNodeWithChildren<TProps>
  extends MlvTileNode<TProps, true> {
  readonly children: readonly MlvTileTreeNode<TProps>[];
}

export interface MlvTileNodeLeaf<TProps>
  extends MlvTileNode<TProps, false> {
  readonly children?: never;
}

export type MlvTileTreeNode<TProps> =
  | MlvTileNodeWithChildren<TProps>
  | MlvTileNodeLeaf<TProps>;
```

The bound root is `MlvTileNodeWithChildren<TProps>`. It represents the fixed
tree root and is never draggable. Its direct children are rendered by the root
`mlv-tiles`.

Application properties remain entirely consumer-owned:

```ts
interface PageBuilderProps {
  readonly title: string;
  readonly summary: string;
  readonly enabled: boolean;
  readonly blockType: 'page' | 'row' | 'hero' | 'text' | 'image' | 'cta';
}
```

`blockType` is not part of the generic Tile API.

## `MlvTiles` Container

`MlvTiles<TProps>` uses selector `mlv-tiles` and is a standalone OnPush
component with `ViewEncapsulation.None`.

### Root model

The root instance binds the only writable model:

```html
<mlv-tiles [(tree)]="page" [accepts]="canAccept">
  ...
</mlv-tiles>
```

The `tree` model has type `MlvTileNodeWithChildren<TProps> | undefined` at the
component boundary because the same component is also used for nested
containers. Runtime rules are strict:

- an `mlv-tiles` without an ancestor coordinator must receive `[(tree)]`;
- an `mlv-tiles` with an ancestor coordinator must not bind a second tree;
- development mode reports a clear error for either invalid configuration.

The root model is the single source of truth. Every successful move, remove,
or property update creates a new root reference and emits `treeChange` through
Angular's model binding.

### Nested containers

A nested `mlv-tiles` injects the enclosing `MlvTile` and root coordinator. It
derives its target ID and current children from that tile:

```html
<mlv-tile [tile]="tile">
  @if (tile.acceptsChildren) {
    <mlv-tiles>
      ...
    </mlv-tiles>
  }
</mlv-tile>
```

No nested `[(tree)]`, registry, target ID, connection list, or mutation handler
is consumer-authored.

### Acceptance policy

Every container exposes an optional typed input:

```ts
export type MlvTilesAccepts<TProps> = (
  draggedTile: MlvTileTreeNode<TProps>,
  targetTile: MlvTileNodeWithChildren<TProps>,
  innerTiles: readonly MlvTileTreeNode<TProps>[],
) => boolean;
```

The root policy is inherited. A nested container may provide a closer
`[accepts]` override; the nearest defined policy wins. The direct children
passed to the predicate are the exact readonly children of the target in the
current root snapshot.

Internal structural checks always run first:

- source, target, and IDs must exist and be unique;
- leaves cannot be targets;
- a tile cannot enter itself;
- a tile cannot enter any descendant;
- the fixed root cannot be dragged.

Consumer policy cannot override these checks.

### Outputs

`[(tree)]` is the state-changing contract. An optional typed `(moved)` output
reports an already-applied move for analytics or side effects; consumers do
not need it to keep state correct.

```ts
export interface MlvTileMovedEvent {
  readonly tileId: string;
  readonly sourceContainerId: string;
  readonly targetContainerId: string;
  readonly previousIndex: number;
  readonly currentIndex: number;
}
```

## `MlvTile` Item

`MlvTile<TProps>` remains selector `mlv-tile` and becomes the registered item
surface when used inside `mlv-tiles`.

```html
<mlv-tile #tileRef [tile]="tile" draggable>
  <ng-template mlvTileHeader>...</ng-template>
  <ng-template mlvTileActions>...</ng-template>
  ...default projected content...
</mlv-tile>
```

The optional typed `[tile]` input is required only when participating in an
`mlv-tiles` tree. Existing standalone Tile usage remains compatible.

The item registers itself with the nearest container and receives drag state
from the root coordinator. The built-in handle remains the only drag start
surface.

### Density replaces size

The public `size` input and `MlvTileSize` type are removed. Tile participates
in the existing Malva density system through `MlvDensityDirective` and the
nearest inherited density context:

```html
<mlv-tile mlvDensity="compact">...</mlv-tile>
```

Supported density values are the complete public `MlvDensity` scale: `tight`,
`compact`, `comfortable`, `spacious`, and `airy`. `comfortable` is the default
inherited behavior. A density change must update the complete visual rhythm:

- outer and internal padding;
- header, body, and control gaps;
- corner radius and minimum control height;
- drag, action, and close target geometry;
- title, metadata, and body font sizes and line heights.

Typography uses existing Malva typography tokens selected by density; Tile
must not scale text with transforms or introduce raw pixel sizes. Nested
`mlv-tiles` and projected controls inherit density unless they declare a closer
`mlvDensity` override.

### Consumer-owned actions

The library does not infer application fields. `MlvTile` exposes imperative,
typed operations backed by the root coordinator:

```ts
remove(): void;
setProps(props: TProps): void;
updateProps(updater: (props: TProps) => TProps): void;
```

These operations immutably update `[(tree)]`. They allow projected controls to
remain concise without importing tree helpers.

The site-builder example must not use `closable`. It projects Edit and
`mlv-switch` through `mlvTileActions`, then projects a circular Trash icon
button through `mlvTileTrailingActions` and calls the tile item's `remove()`.
The switch uses the public `mlvDensity="compact"` directive. No
example-scoped `::ng-deep` switch styling is allowed.

The shared header control order is:

```text
MlvTileActions → CdkDragHandle → MlvTileTrailingActions → MlvButtonClose
```

The example has no `MlvButtonClose`, so its visible order is:

```text
Edit → Switch → CdkDragHandle → Trash
```

Both action slots, the handle, and optional close control remain inside one
`.mlv-tile__controls` flex container with labelled, keyboard-operable native
controls. The separate trailing slot makes the requested handle-before-trash
order structural rather than dependent on consumer CSS ordering.

## Content Projection

The compound API preserves these slots:

- `[mlvTileHeader]`: primary title/content header template;
- `[mlvTileActions]`: application actions placed before the drag handle;
- `[mlvTileTrailingActions]`: application actions placed after the drag handle;
- default projection: tile body and optional nested `mlv-tiles`.

No library-owned view adapter is required. Consumers render their typed props
directly, so Angular autocomplete follows the `[tile]` input and narrowed
`acceptsChildren` discriminant.

Templates must capture the current node before narrowing:

```html
@let current = tile;
@if (current.acceptsChildren) {
  <mlv-tiles>...</mlv-tiles>
}
```

## Drag Architecture and Performance

The root coordinator owns all nested drag state.

At drag start it builds one session from the current immutable root:

- ID-to-node index;
- ID-to-parent/index metadata;
- descendant IDs for the dragged node;
- rendered container registrations and measured rectangles;
- a `Set<string>` of allowed target IDs.

Acceptance policy runs once for each structurally valid target. Pointer entry
uses only ID and `Set` lookup.

At drop, the coordinator resolves source and target from stable IDs rather
than trusting transient DOM order. It validates the event against the session
snapshot, applies one immutable move with structural sharing, publishes the
new root, and clears the session.

The implementation may use Angular CDK list, horizontal, or mixed sorting
internally, but the public API does not expose CDK directives. The selected
strategy must be proven in the real browser. Synthetic `dropped.emit` tests
alone are insufficient.

## Layout and Motion

`mlv-tiles` owns the drop-surface layout and exposes a small public layout
input rather than requiring consumer CDK/CSS wiring:

```ts
type MlvTilesLayout = 'list' | 'grid';
```

`list` is the default. `grid` uses responsive full-size tracks and degrades to
one column based on each container's own inline size. It must not halve widths
recursively. Short grid siblings align to the start and never stretch to the
tallest branch.

The site-builder example uses `layout="grid"` only where full-size blocks fit.
Nested containers naturally collapse to one column before titles, metadata,
or controls become cramped.

Required drag behavior:

- starting a drag does not reflow or collapse the resting layout;
- the placeholder retains the source footprint;
- the preview retains measured width/height, Tile styling, and a clear
  floating shadow;
- a dragged tile can return to its original index;
- two siblings in one grid row can reorder in both directions;
- nested targets take precedence over overlapping ancestors;
- sibling sorting and drop settle use transform/opacity transitions;
- no animated height, margin, padding, or box shadow;
- reduced motion removes nonessential movement but retains state and preview.

Resting styling keeps a visible complete border, no left state rail, no hover
background change, and a hover-only handle on fine pointers with touch and
keyboard availability.

## Example Shape

The documentation example owns only:

- `PageBuilderProps` and the sample immutable root signal;
- `MlvTilesAccepts<PageBuilderProps>`;
- recursive Angular markup using `mlv-tiles`, `mlv-tile`, and projection slots;
- application-specific edit and enable controls.

The former Tile “Sizes” example becomes a “Density” example demonstrating all
five density levels with visibly different typography and geometry.

It must not contain:

- CDK drop-list imports or connection registries;
- drag-session/index code;
- immutable move/remove utilities;
- custom preview classes;
- private Switch selectors;
- a second tree binding on nested containers.

The sample restriction remains: a row/container cannot enter a target whose
direct children include leaf blocks. Leaves remain allowed in that target.

## Accessibility

- The drag handle is a pointer drag affordance and is not an extra tab stop.
- Edit, switch, and trash controls use native interactive elements and clear
  accessible names containing the tile title.
- Restricted targets show visible `Restricted` text in addition to outline
  color.
- Actions never initiate drag.
- Focus remains stable across property updates and removal follows normal DOM
  focus recovery.
- Touch and narrow layouts keep all actions available.

## Compatibility and Migration

- Existing standalone `mlv-tile` tones, outputs, header/action slots, closable
  behavior, and CDK handle integration remain source compatible.
- The `[size]` input and `MlvTileSize` export are intentionally removed. All
  workspace consumers and examples migrate to `mlvDensity` in the same change;
  no deprecated compatibility alias remains.
- Migration guidance maps former `xs`, `s`, `m`, `l`, and `xl` intent to
  `tight`, `compact`, `comfortable`, `spacious`, and `airy` respectively,
  while noting that density now changes typography as well as geometry.
- The docs-only builder components, registry, session, and mutation helpers are
  removed after their behavior is covered by library tests.
- Public exports and Tile project documentation are updated together.
- The docs example imports only from `@malva-ui/core/tile` plus controls/icons.

## Verification

### Automated

- Public type tests for discriminant narrowing and generic autocomplete.
- Root-vs-nested tree ownership and invalid configuration errors.
- Nearest acceptance-policy inheritance and three-parameter arguments.
- Policy-once-per-target and pointer-time `Set` lookup.
- Same-container reorder forward/backward.
- Cross-container leaf move.
- Container move into an empty row and return to origin.
- Self/descendant/root rejection before consumer policy.
- Immutable structural sharing and unchanged previous snapshots.
- Duplicate/missing ID and stale-session no-op behavior.
- Item remove and property update through the coordinator.
- DOM order and accessibility for projected actions, handle, and optional close.
- Absence of the old `size` input/export/classes across public API and docs.
- Density inheritance/override tests covering padding, gaps, control geometry,
  title font size, body font size, and line height across all five densities.
- Grid/list layout classes, reduced-motion styles, preview/placeholder classes,
  and no private Switch selectors.

### Real browser

At `http://localhost:4200/tile`, verify with pointer input:

1. drag start preserves layout and produces a correctly sized elevated preview;
2. two siblings in the same row reorder in both directions;
3. a container can return to its original position;
4. `Launch campaign` can enter `Media row`;
5. a row cannot enter a row already containing leaves;
6. self and descendant targets never activate;
7. valid/invalid outlines and `Restricted` text are visible;
8. edit, density-controlled switch, and trash do not initiate drag;
9. root and nested grids never create narrow recursive micro-cards or stretched
   empty panels;
10. narrow/touch and reduced-motion modes remain usable.

Final screenshots must compare resting, dragging, and restricted states against
the supplied references at the same viewport.
