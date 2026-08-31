# Tile Site-Builder Example Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a polished Tile action slot and a realistic, type-safe recursive site-builder example with nested drag-and-drop, user-defined acceptance rules, header actions, and cached drag-session validation.

**Architecture:** Keep `MlvTile` responsible only for visual structure and a new untyped action template slot. The docs example owns generic builder types, immutable tree utilities, a short-lived drag-session index, and three focused OnPush components: coordinator, recursive branch, and draggable node surface. The public example state remains a nested tree; unchanged subtrees retain object identity after mutations.

**Tech Stack:** Angular 22 signal APIs and strict templates, TypeScript 6, Angular CDK drag-drop, Vitest through Nx, Malva Tile/Button/Input/Switch/Badge primitives, Lucide Angular icons, token-only BEM SCSS.

**Spec:** `docs/superpowers/specs/2026-08-20-tile-site-builder-example-design.md`

## Global Constraints

- Work directly on `main`, as requested; preserve unrelated dirty files and stage only task-owned paths.
- Do not add a public `MlvTileBuilder`, builder service, persistence, undo, virtualization, or library-owned `kind`/block-type union.
- `MlvTile` gains only `[mlvTileActions]`; builder types and behavior stay in Tile docs example 5.
- `acceptsChildren` is the structural discriminant, and `BuilderTileWithChildren<TProps>` extends `BuilderTile<TProps, true>`.
- `[accepts]` receives the dragged node, target container, and the target's direct readonly children.
- Self and descendant drops are always rejected before calling consumer policy.
- Evaluate acceptance once per structurally valid target when a drag begins; pointer movement performs set lookup only.
- Mutate the tree only on a successful drop or explicit action, using immutable structural sharing.
- All created/modified Angular components use signal inputs/outputs and `ChangeDetectionStrategy.OnPush`; library components also keep `ViewEncapsulation.None`.
- All SCSS follows BEM and uses existing `--mlv-*` tokens; no raw colors, decorative gradients, left state rails, or hover background changes.
- Drag/sort motion uses transform and opacity, keeps the elevated Tile preview, uses default sort transitions, and honors reduced motion.
- Native buttons remain keyboard operable and labelled; publication state uses `MlvSwitch`; rename uses `MlvInput`; icons come from Lucide.

---

## File map

### Tile library

- Create `libs/core/tile/src/lib/tile-actions.ts` — `[mlvTileActions]` structural slot directive.
- Modify `libs/core/tile/src/lib/tile/tile.ts` — query and import the action slot.
- Modify `libs/core/tile/src/lib/tile/tile.html` — render actions after title and before close.
- Modify `libs/core/tile/src/lib/tile/tile.scss` — action layout plus the already approved surface/drag polish.
- Modify `libs/core/tile/src/lib/tile/tile.spec.ts` — action-slot structure and interaction coverage alongside existing drag-handle tests.
- Modify `libs/core/tile/src/index.ts` — export `MlvTileActions`.

### Documentation example 5

- Create `apps/docs/src/app/pages/tile/examples/5/builder.types.ts` — generic tree, display adapter, drag session, and action request types.
- Create `apps/docs/src/app/pages/tile/examples/5/builder-tree.ts` — pure indexing, acceptance, move, remove, and props-update utilities.
- Create `apps/docs/src/app/pages/tile/examples/5/builder-tree.spec.ts` — pure utility and performance-invariant tests.
- Create `apps/docs/src/app/pages/tile/examples/5/tile-builder.ts` — generic drag-session coordinator and public `[root]`, `[accepts]`, `[view]` API.
- Create `apps/docs/src/app/pages/tile/examples/5/tile-builder.html` — CDK drop-list group and root branch.
- Create `apps/docs/src/app/pages/tile/examples/5/tile-builder.scss` — fixed canvas shell.
- Create `apps/docs/src/app/pages/tile/examples/5/tile-builder-branch.ts` — recursive container renderer and normalized drop output.
- Create `apps/docs/src/app/pages/tile/examples/5/tile-builder-branch.html` — tracked child loop, nested drop lists, and restricted/empty states.
- Create `apps/docs/src/app/pages/tile/examples/5/tile-builder-branch.scss` — nested hierarchy and valid/invalid target states.
- Create `apps/docs/src/app/pages/tile/examples/5/tile-builder-node.ts` — draggable `MlvTile`, action controls, and inline rename state.
- Create `apps/docs/src/app/pages/tile/examples/5/tile-builder-node.html` — header/actions/body composition and child projection.
- Create `apps/docs/src/app/pages/tile/examples/5/tile-builder-node.scss` — compact node metadata and inline-editor layout.
- Create `apps/docs/src/app/pages/tile/examples/5/tile-builder.spec.ts` — generic binding, session caching, drop normalization, and action integration tests.
- Create `apps/docs/src/app/pages/tile/examples/5/index.ts` — example-specific props, sample page tree, display adapter, policy, and state handlers.
- Create `apps/docs/src/app/pages/tile/examples/5/index.html` — example heading, policy explanation, and builder binding.
- Create `apps/docs/src/app/pages/tile/examples/5/index.scss` — responsive example framing.
- Create `apps/docs/src/app/pages/tile/examples/5/index.mdx` — consumer-facing explanation of types and restrictions.
- Modify `apps/docs/src/app/pages/tile/index.ts` — register example 5.

### Contracts and docs

- Modify `.claude/projects/libs-tile.md` — add `MlvTileActions`, action ordering, and styles.
- Modify `.claude/projects/page-tile.md` — document the complex builder example and updated example count.
- Modify `CLAUDE.md` — update the Tile index description.

---

### Task 1: Add the Tile action slot and consolidate drag polish

**Files:**

- Create: `libs/core/tile/src/lib/tile-actions.ts`
- Modify: `libs/core/tile/src/lib/tile/tile.ts`
- Modify: `libs/core/tile/src/lib/tile/tile.html`
- Modify: `libs/core/tile/src/lib/tile/tile.scss`
- Modify: `libs/core/tile/src/lib/tile/tile.spec.ts`
- Modify: `libs/core/tile/src/index.ts`

**Interfaces:**

- Consumes: existing `MlvStructural`, `MlvTileHeader`, `CdkDragHandle`, and `MlvButtonClose`.
- Produces: exported `MlvTileActions`; protected `actionsRef`; `.mlv-tile__actions` rendered between title and close.

- [ ] **Step 1: Write failing action-slot tests**

Add a host that projects header and action templates and records clicks:

```ts
@Component({
  imports: [MlvTile, MlvTileHeader, MlvTileActions],
  template: `
    <mlv-tile draggable closable>
      <ng-template mlvTileHeader>Hero section</ng-template>
      <ng-template mlvTileActions>
        <button type="button" (click)="actionClicks.update((n) => n + 1)">
          Edit
        </button>
      </ng-template>
      Published content
    </mlv-tile>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TileActionsTestHost {
  readonly actionClicks = signal(0);
}
```

Assert the header child class order and button behavior:

```ts
it('renders projected actions between the title and close action', async () => {
  const host = TestBed.createComponent(TileActionsTestHost);
  await host.whenStable();

  const classes = Array.from(
    host.nativeElement.querySelector('.mlv-tile__header').children,
    (child: Element) => child.className,
  );

  expect(classes).toEqual([
    'mlv-tile__drag-handle cdk-drag-handle',
    'mlv-tile__title',
    'mlv-tile__actions',
    'mlv-button-close mlv-tile__close',
  ]);

  host.nativeElement.querySelector('.mlv-tile__actions button').click();
  expect(host.componentInstance.actionClicks()).toBe(1);
});
```

- [ ] **Step 2: Run the Tile tests and verify red**

Run: `yarn nx test core-tile --skipNxCache`

Expected: FAIL because `MlvTileActions` and `.mlv-tile__actions` do not exist.

- [ ] **Step 3: Implement the structural slot**

Create the directive:

```ts
import { Directive } from '@angular/core';
import { MlvStructural } from '@malva-ui/cdk';

/** Marks a template as the action area rendered in a tile header. */
@Directive({ selector: '[mlvTileActions]' })
export class MlvTileActions extends MlvStructural {}
```

In `MlvTile`, add `MlvTileActions` to `imports` and query it:

```ts
/** @protected Consumer-owned actions projected via `[mlvTileActions]`. */
protected readonly actionsRef = contentChild(MlvTileActions);
```

Render the header when `actionsRef()` exists and insert:

```html
@if (actionsRef(); as actionsTpl) {
<div class="mlv-tile__actions">
  <ng-container [ngTemplateOutlet]="actionsTpl.templateRef" />
</div>
}
```

Add the export:

```ts
export * from './lib/tile-actions';
```

- [ ] **Step 4: Add action layout without changing hover background**

Extend the existing Tile BEM block:

```scss
&__actions {
  display: flex;
  align-items: center;
  gap: var(--mlv-spacing-1);
  flex-shrink: 0;
  margin-inline-start: auto;
}

&__actions + &__close {
  margin-inline-start: 0;
}
```

Keep the already approved complete border, hover-only large handle, preview shadow, placeholder, and default sibling transition unchanged.

- [ ] **Step 5: Run Tile tests, typecheck, and lint**

Run: `yarn nx run-many -t test typecheck lint -p core-tile --skipNxCache`

Expected: all `core-tile` targets pass.

- [ ] **Step 6: Commit the Tile unit**

```bash
git add libs/core/tile/src/lib/tile-actions.ts libs/core/tile/src/lib/tile/tile.ts libs/core/tile/src/lib/tile/tile.html libs/core/tile/src/lib/tile/tile.scss libs/core/tile/src/lib/tile/tile.spec.ts libs/core/tile/src/index.ts
git commit -m "feat(tile): add header actions and polish drag states"
```

---

### Task 2: Define the generic tree and cached drag session

**Files:**

- Create: `apps/docs/src/app/pages/tile/examples/5/builder.types.ts`
- Create: `apps/docs/src/app/pages/tile/examples/5/builder-tree.ts`
- Create: `apps/docs/src/app/pages/tile/examples/5/builder-tree.spec.ts`

**Interfaces:**

- Produces: `BuilderTile`, `BuilderTileWithChildren`, `BuilderTileLeaf`, `BuilderNode`, `BuilderTileAccepts`, `BuilderTileView`, `BuilderDragSession`, `createBuilderDragSession`, and `canEnterBuilderTarget`.
- Consumers: Tasks 3–5 import these exact names.

- [ ] **Step 1: Write the generic type declarations**

Create `builder.types.ts` with the approved discriminated union and view adapter:

```ts
export interface BuilderTile<TProps, TAcceptsChildren extends boolean> {
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

export type BuilderTileAccepts<TProps> = (
  draggedTile: BuilderNode<TProps>,
  targetTile: BuilderTileWithChildren<TProps>,
  innerTiles: readonly BuilderNode<TProps>[],
) => boolean;

export interface BuilderTileView<TProps> {
  readonly title: (tile: BuilderNode<TProps>) => string;
  readonly summary: (tile: BuilderNode<TProps>) => string;
  readonly typeLabel: (tile: BuilderNode<TProps>) => string;
  readonly enabled: (tile: BuilderNode<TProps>) => boolean;
}

export interface BuilderDragSession<TProps> {
  readonly draggedTile: BuilderNode<TProps>;
  readonly nodeById: ReadonlyMap<string, BuilderNode<TProps>>;
  readonly parentById: ReadonlyMap<string, string | null>;
  readonly allowedTargetIds: ReadonlySet<string>;
}
```

- [ ] **Step 2: Write failing session tests**

Cover these concrete cases in `builder-tree.spec.ts`:

```ts
it('evaluates policy once per structurally valid target', () => {
  const accepts = vi.fn(() => true);
  const session = createBuilderDragSession(page, 'nested-row', accepts);

  expect(session).not.toBeNull();
  expect(accepts.mock.calls.every(([, target, children]) =>
    target.children === children,
  )).toBe(true);
  expect(accepts).not.toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ id: 'nested-row' }),
    expect.anything(),
  );
});

it('rejects self and descendant containers before consumer policy', () => {
  const accepts = vi.fn(() => true);
  const session = createBuilderDragSession(page, 'parent-row', accepts);

  expect(canEnterBuilderTarget(session, 'parent-row')).toBe(false);
  expect(canEnterBuilderTarget(session, 'nested-row')).toBe(false);
});

it('performs only set lookups after session creation', () => {
  const accepts = vi.fn(() => true);
  const session = createBuilderDragSession(page, 'text-block', accepts);
  const callsAfterStart = accepts.mock.calls.length;

  canEnterBuilderTarget(session, 'parent-row');
  canEnterBuilderTarget(session, 'parent-row');

  expect(accepts).toHaveBeenCalledTimes(callsAfterStart);
});

it('returns null for missing or duplicate IDs', () => {
  expect(createBuilderDragSession(page, 'missing', () => true)).toBeNull();
  expect(createBuilderDragSession(pageWithDuplicateId, 'text-block', () => true))
    .toBeNull();
});
```

- [ ] **Step 3: Run docs tests and verify red**

Run: `yarn nx test docs --skipNxCache`

Expected: FAIL because the session utilities are not implemented.

- [ ] **Step 4: Implement the one-pass session builder**

Implement an internal recursive walk that inserts each node once, rejects duplicate IDs, records the parent, and records every true node as a candidate container. After resolving the dragged node, collect its descendant IDs and evaluate policy only for candidates outside that set:

```ts
export function createBuilderDragSession<TProps>(
  root: BuilderTileWithChildren<TProps>,
  draggedTileId: string,
  accepts: BuilderTileAccepts<TProps>,
): BuilderDragSession<TProps> | null {
  const nodeById = new Map<string, BuilderNode<TProps>>();
  const parentById = new Map<string, string | null>();
  const containers: BuilderTileWithChildren<TProps>[] = [];

  if (!indexNode(root, null, nodeById, parentById, containers)) return null;

  const draggedTile = nodeById.get(draggedTileId);
  if (!draggedTile) return null;

  const excludedTargetIds = collectDescendantIds(draggedTile);
  excludedTargetIds.add(draggedTile.id);

  const allowedTargetIds = new Set<string>();
  for (const target of containers) {
    if (
      !excludedTargetIds.has(target.id) &&
      accepts(draggedTile, target, target.children)
    ) {
      allowedTargetIds.add(target.id);
    }
  }

  return { draggedTile, nodeById, parentById, allowedTargetIds };
}

export function canEnterBuilderTarget<TProps>(
  session: BuilderDragSession<TProps> | null,
  targetTileId: string,
): boolean {
  return session?.allowedTargetIds.has(targetTileId) ?? false;
}
```

Keep `indexNode` and `collectDescendantIds` private to this file.

- [ ] **Step 5: Run docs tests and typecheck**

Run: `yarn nx run-many -t test typecheck -p docs --skipNxCache`

Expected: session tests and docs typecheck pass.

- [ ] **Step 6: Commit the type/session unit**

```bash
git add apps/docs/src/app/pages/tile/examples/5/builder.types.ts apps/docs/src/app/pages/tile/examples/5/builder-tree.ts apps/docs/src/app/pages/tile/examples/5/builder-tree.spec.ts
git commit -m "feat(docs): model typed tile builder drag sessions"
```

---

### Task 3: Add immutable tree mutations

**Files:**

- Modify: `apps/docs/src/app/pages/tile/examples/5/builder.types.ts`
- Modify: `apps/docs/src/app/pages/tile/examples/5/builder-tree.ts`
- Modify: `apps/docs/src/app/pages/tile/examples/5/builder-tree.spec.ts`

**Interfaces:**

- Consumes: `BuilderNode<TProps>` and `BuilderTileWithChildren<TProps>` from Task 2.
- Produces: `BuilderMoveRequest`, `moveBuilderNode`, `removeBuilderNode`, and `updateBuilderTileProps` for Tasks 4–5.

- [ ] **Step 1: Add exact mutation request types**

```ts
export interface BuilderMoveRequest {
  readonly draggedTileId: string;
  readonly sourceContainerId: string;
  readonly targetContainerId: string;
  readonly previousIndex: number;
  readonly currentIndex: number;
}

export interface BuilderRenameRequest {
  readonly tileId: string;
  readonly title: string;
}

export interface BuilderEnabledChange {
  readonly tileId: string;
  readonly enabled: boolean;
}
```

- [ ] **Step 2: Write failing mutation tests**

Add local test helpers with these exact signatures, implemented as straightforward recursive reads that never mutate their input:

```ts
function findNode<TProps>(
  root: BuilderNode<TProps>,
  tileId: string,
): BuilderNode<TProps> | undefined;

function findContainer<TProps>(
  root: BuilderNode<TProps>,
  tileId: string,
): BuilderTileWithChildren<TProps> | undefined;

function findChildren<TProps>(
  root: BuilderTileWithChildren<TProps>,
  containerId: string,
): readonly BuilderNode<TProps>[];
```

Then add tests with explicit identity assertions:

```ts
it('reorders within one container and preserves unrelated branches', () => {
  const untouched = page.children[1];
  const result = moveBuilderNode(page, {
    draggedTileId: 'hero',
    sourceContainerId: 'header-row',
    targetContainerId: 'header-row',
    previousIndex: 0,
    currentIndex: 1,
  });

  expect(findChildren(result, 'header-row').map((node) => node.id)).toEqual([
    'intro',
    'hero',
  ]);
  expect(result.children[1]).toBe(untouched);
});

it('moves a nested row across containers', () => {
  const result = moveBuilderNode(page, nestedRowMove);
  expect(findChildren(result, 'source-row')).not.toContainEqual(
    expect.objectContaining({ id: 'nested-row' }),
  );
  expect(findChildren(result, 'empty-row')[0].id).toBe('nested-row');
});

it('returns the original root for no-op, missing, and cyclic moves', () => {
  expect(moveBuilderNode(page, samePosition)).toBe(page);
  expect(moveBuilderNode(page, missingTarget)).toBe(page);
  expect(moveBuilderNode(page, descendantTarget)).toBe(page);
});

it('removes and updates nested nodes without changing other branches', () => {
  const removed = removeBuilderNode(page, 'image-block');
  const renamed = updateBuilderTileProps(removed, 'hero', (props) => ({
    ...props,
    title: 'Launch hero',
  }));

  expect(findNode(renamed, 'image-block')).toBeUndefined();
  expect(findNode(renamed, 'hero')?.props.title).toBe('Launch hero');
});

it('does not remove or rename the fixed root', () => {
  expect(removeBuilderNode(page, page.id)).toBe(page);
  expect(
    updateBuilderTileProps(page, page.id, (props) => ({
      ...props,
      title: 'Changed root',
    })),
  ).toBe(page);
});
```

- [ ] **Step 3: Run docs tests and verify red**

Run: `yarn nx test docs --skipNxCache`

Expected: FAIL because mutation functions are missing.

- [ ] **Step 4: Implement same-container and cross-container moves**

Use a single recursive `updateContainerChildren` helper that returns the original node when no descendant changes. Same-container moves copy one children array. Cross-container moves validate IDs and ancestry first, remove from the source path, then insert into the target path:

```ts
export function moveBuilderNode<TProps>(
  root: BuilderTileWithChildren<TProps>,
  request: BuilderMoveRequest,
): BuilderTileWithChildren<TProps> {
  if (
    request.sourceContainerId === request.targetContainerId &&
    request.previousIndex === request.currentIndex
  ) {
    return root;
  }

  const index = createBuilderIndex(root);
  if (!index) return root;
  const dragged = index.nodeById.get(request.draggedTileId);
  const source = index.containerById.get(request.sourceContainerId);
  const target = index.containerById.get(request.targetContainerId);
  if (!dragged || !source || !target || isSameOrDescendant(dragged, target)) {
    return root;
  }

  if (source.id === target.id) {
    return updateContainerChildren(root, source.id, (children) =>
      moveReadonlyItem(children, request.previousIndex, request.currentIndex),
    );
  }

  const withoutDragged = updateContainerChildren(root, source.id, (children) =>
    children.filter((node) => node.id !== dragged.id),
  );
  return updateContainerChildren(withoutDragged, target.id, (children) =>
    insertReadonlyItem(children, request.currentIndex, dragged),
  );
}
```

Implement these private helpers in the same file:

```ts
interface MutableBuilderIndex<TProps> {
  readonly nodeById: Map<string, BuilderNode<TProps>>;
  readonly containerById: Map<string, BuilderTileWithChildren<TProps>>;
}

function createBuilderIndex<TProps>(
  root: BuilderTileWithChildren<TProps>,
): MutableBuilderIndex<TProps> | null;

function isSameOrDescendant<TProps>(
  dragged: BuilderNode<TProps>,
  target: BuilderTileWithChildren<TProps>,
): boolean;

function updateContainerChildren<TProps>(
  root: BuilderTileWithChildren<TProps>,
  containerId: string,
  update: (
    children: readonly BuilderNode<TProps>[],
  ) => readonly BuilderNode<TProps>[],
): BuilderTileWithChildren<TProps>;

function moveReadonlyItem<T>(
  items: readonly T[],
  previousIndex: number,
  currentIndex: number,
): readonly T[];

function insertReadonlyItem<T>(
  items: readonly T[],
  index: number,
  item: T,
): readonly T[];
```

`createBuilderIndex` rejects duplicates. Before any update, verify that the source index actually contains `draggedTileId`; return the original root when it does not. `moveReadonlyItem` rejects out-of-range source/target indexes. `insertReadonlyItem` clamps insertion to `0..items.length`. The maps stay private and are never returned from the module.

- [ ] **Step 5: Implement remove and props update**

```ts
export function removeBuilderNode<TProps>(
  root: BuilderTileWithChildren<TProps>,
  tileId: string,
): BuilderTileWithChildren<TProps> {
  if (tileId === root.id) return root;
  return removeFromContainer(root, tileId) ?? root;
}

export function updateBuilderTileProps<TProps>(
  root: BuilderTileWithChildren<TProps>,
  tileId: string,
  update: (props: TProps) => TProps,
): BuilderTileWithChildren<TProps> {
  if (tileId === root.id) return root;
  return updateNodeById(root, tileId, (node) => {
    const nextProps = update(node.props);
    return nextProps === node.props ? node : { ...node, props: nextProps };
  });
}
```

Implement `removeFromContainer<TProps>(root, tileId)` and `updateNodeById<TProps>(root, tileId, update)` as private recursive helpers returning `BuilderTileWithChildren<TProps>` and preserving existing references when the target is absent or `update` returns the same node.

- [ ] **Step 6: Run docs tests, typecheck, and lint**

Run: `yarn nx run-many -t test typecheck lint -p docs --skipNxCache`

Expected: all docs targets pass.

- [ ] **Step 7: Commit immutable mutations**

```bash
git add apps/docs/src/app/pages/tile/examples/5/builder.types.ts apps/docs/src/app/pages/tile/examples/5/builder-tree.ts apps/docs/src/app/pages/tile/examples/5/builder-tree.spec.ts
git commit -m "feat(docs): add immutable tile builder mutations"
```

---

### Task 4: Build the generic recursive drag renderer

**Files:**

- Create: `apps/docs/src/app/pages/tile/examples/5/tile-builder.ts`
- Create: `apps/docs/src/app/pages/tile/examples/5/tile-builder.html`
- Create: `apps/docs/src/app/pages/tile/examples/5/tile-builder.scss`
- Create: `apps/docs/src/app/pages/tile/examples/5/tile-builder-branch.ts`
- Create: `apps/docs/src/app/pages/tile/examples/5/tile-builder-branch.html`
- Create: `apps/docs/src/app/pages/tile/examples/5/tile-builder-branch.scss`
- Create: `apps/docs/src/app/pages/tile/examples/5/tile-builder-node.ts`
- Create: `apps/docs/src/app/pages/tile/examples/5/tile-builder-node.html`
- Create: `apps/docs/src/app/pages/tile/examples/5/tile-builder-node.scss`
- Create: `apps/docs/src/app/pages/tile/examples/5/tile-builder.spec.ts`

**Interfaces:**

- Consumes: all Task 2 session types/functions and Task 3 request types.
- Produces: `TileBuilderComponent<TProps>` with required `root`, `accepts`, and `view` inputs; `moveRequested`, `renameRequested`, `removeRequested`, and `enabledChange` outputs.

- [ ] **Step 1: Write a strict-template generic host test**

Define consumer props and bind all generic inputs through Angular:

```ts
interface TestProps {
  title: string;
  summary: string;
  enabled: boolean;
  blockType: 'page' | 'row' | 'text';
}

@Component({
  imports: [TileBuilderComponent],
  template: `
    <app-tile-builder
      [root]="root()"
      [accepts]="accepts"
      [view]="view"
      (moveRequested)="moves.push($event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TypedBuilderHost {
  readonly root = signal<BuilderTileWithChildren<TestProps>>(testPage);
  readonly accepts: BuilderTileAccepts<TestProps> = () => true;
  readonly view: BuilderTileView<TestProps> = {
    title: ({ props }) => props.title,
    summary: ({ props }) => props.summary,
    typeLabel: ({ props }) => props.blockType,
    enabled: ({ props }) => props.enabled,
  };
  readonly moves: BuilderMoveRequest[] = [];
}
```

Assert it compiles and renders the typed title/summary. This is the regression test for Angular autocomplete-compatible input unification.

- [ ] **Step 2: Write failing drag-session and normalization tests**

Create the component and assert:

```ts
it('builds acceptance once at drag start and clears it at drag end', () => {
  const accepts = vi.fn(() => true);
  fixture.componentRef.setInput('accepts', accepts);
  fixture.detectChanges();

  component.startDrag(testPage.children[0]);
  const calls = accepts.mock.calls.length;

  expect(component.canEnterTarget('empty-row')).toBe(true);
  expect(component.canEnterTarget('empty-row')).toBe(true);
  expect(accepts).toHaveBeenCalledTimes(calls);

  component.endDrag();
  expect(component.canEnterTarget('empty-row')).toBe(false);
});

it('normalizes CDK drop data into a builder move request', () => {
  const emitted = vi.fn();
  component.moveRequested.subscribe(emitted);

  component.requestDrop(cdkDropEvent({
    draggedTileId: 'text-block',
    sourceContainerId: 'source-row',
    targetContainerId: 'empty-row',
    previousIndex: 0,
    currentIndex: 0,
  }));

  expect(emitted).toHaveBeenCalledWith({
    draggedTileId: 'text-block',
    sourceContainerId: 'source-row',
    targetContainerId: 'empty-row',
    previousIndex: 0,
    currentIndex: 0,
  });
});
```

Add a local `cdkDropEvent(request)` helper that returns a typed `CdkDragDrop<BuilderTileWithChildren<TestProps>>` stub: `item.data` contains `{ id: request.draggedTileId }`, `previousContainer.data.id` contains `sourceContainerId`, `container.data.id` contains `targetContainerId`, and the two index fields are copied verbatim. No DOM geometry fields participate in normalization.

Expose `startDrag`, `endDrag`, `canEnterTarget`, and `requestDrop` as documented public example methods so tests do not cast through private state.

- [ ] **Step 3: Run docs tests and verify red**

Run: `yarn nx test docs --skipNxCache`

Expected: FAIL because the builder components do not exist.

- [ ] **Step 4: Implement the coordinator**

Use required signal inputs, stable callbacks, and a private session signal:

```ts
@Component({
  selector: 'app-tile-builder',
  imports: [CdkDropListGroup, TileBuilderBranchComponent],
  templateUrl: './tile-builder.html',
  styleUrl: './tile-builder.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'docs-tile-builder' },
})
export class TileBuilderComponent<TProps> {
  readonly root = input.required<BuilderTileWithChildren<TProps>>();
  readonly accepts = input.required<BuilderTileAccepts<TProps>>();
  readonly view = input.required<BuilderTileView<TProps>>();

  readonly moveRequested = output<BuilderMoveRequest>();
  readonly renameRequested = output<BuilderRenameRequest>();
  readonly removeRequested = output<string>();
  readonly enabledChange = output<BuilderEnabledChange>();

  protected readonly session = signal<BuilderDragSession<TProps> | null>(null);

  readonly enterPredicate = (_drag: CdkDrag, drop: CdkDropList) =>
    this.canEnterTarget((drop.data as BuilderTileWithChildren<TProps>).id);

  startDrag(tile: BuilderNode<TProps>): void {
    this.session.set(
      createBuilderDragSession(this.root(), tile.id, this.accepts()),
    );
  }

  endDrag(): void {
    this.session.set(null);
  }

  canEnterTarget(targetTileId: string): boolean {
    return canEnterBuilderTarget(this.session(), targetTileId);
  }

  requestDrop(
    event: CdkDragDrop<BuilderTileWithChildren<TProps>>,
  ): void {
    const draggedTile = event.item.data as BuilderNode<TProps>;
    const source = event.previousContainer.data;
    const target = event.container.data;

    this.moveRequested.emit({
      draggedTileId: draggedTile.id,
      sourceContainerId: source.id,
      targetContainerId: target.id,
      previousIndex: event.previousIndex,
      currentIndex: event.currentIndex,
    });
    this.endDrag();
  }
}
```

The template places the root branch inside one `cdkDropListGroup` and forwards all four action outputs.

- [ ] **Step 5: Implement the recursive branch**

The branch receives one true container, renders its direct list with `cdkDropListData="container()"`, tracks children by ID, and recurses only after capturing and narrowing the signal value:

```html
@let current = container();

<div
  cdkDropList
  class="docs-tile-builder-branch__drop-list"
  [cdkDropListData]="current"
  [cdkDropListEnterPredicate]="enterPredicate()"
  [class.docs-tile-builder-branch__drop-list--valid]="dropState() === 'valid'"
  [class.docs-tile-builder-branch__drop-list--invalid]="dropState() === 'invalid'"
  (cdkDropListDropped)="dropRequested.emit($event)"
>
  @for (node of current.children; track node.id) {
  <app-tile-builder-node
    [node]="node"
    [view]="view()"
    (dragStarted)="dragStarted.emit($event)"
    (dragEnded)="dragEnded.emit()"
    (renameRequested)="renameRequested.emit($event)"
    (removeRequested)="removeRequested.emit($event)"
    (enabledChange)="enabledChange.emit($event)"
  >
    @if (node.acceptsChildren) {
    <app-tile-builder-branch
      [container]="node"
      [view]="view()"
      [session]="session()"
      [enterPredicate]="enterPredicate()"
      (dragStarted)="dragStarted.emit($event)"
      (dragEnded)="dragEnded.emit()"
      (dropRequested)="dropRequested.emit($event)"
      (renameRequested)="renameRequested.emit($event)"
      (removeRequested)="removeRequested.emit($event)"
      (enabledChange)="enabledChange.emit($event)"
    />
    }
  </app-tile-builder-node>
  } @empty {
  <p class="docs-tile-builder-branch__empty">Drop blocks or rows here</p>
  }

  @if (dropState() === 'invalid') {
  <span class="docs-tile-builder-branch__restriction">Restricted</span>
  }
</div>
```

`dropState()` returns `'idle' | 'valid' | 'invalid'` from the cached session and current container ID. It does not call consumer policy.

Implement it as a computed signal so templates do not recalculate policy:

```ts
protected readonly dropState = computed<'idle' | 'valid' | 'invalid'>(() => {
  const session = this.session();
  if (!session) return 'idle';
  return session.allowedTargetIds.has(this.container().id) ? 'valid' : 'invalid';
});
```

- [ ] **Step 6: Implement the draggable node and action slot usage**

Apply `cdkDrag` directly to `mlv-tile` so the package preview selectors match. Use the built-in handle and new action slot:

```html
@let current = node();
@let display = view();

<mlv-tile
  cdkDrag
  [cdkDragData]="current"
  draggable
  size="s"
  (cdkDragStarted)="dragStarted.emit(current)"
  (cdkDragEnded)="dragEnded.emit()"
>
  <ng-template mlvTileHeader>
    <strong>{{ display.title(current) }}</strong>
  </ng-template>

  <ng-template mlvTileActions>
    <button
      mlvButton
      type="button"
      variant="transparent"
      shape="square"
      mlvDensity="tight"
      [attr.aria-label]="'Rename ' + display.title(current)"
      (click)="beginRename(current)"
    >
      <svg lucidePencil mlvButtonIcon />
    </button>
    <mlv-switch
      [checked]="display.enabled(current)"
      [ariaLabel]="'Publish ' + display.title(current)"
      (checkedChange)="enabledChange.emit({ tileId: current.id, enabled: $event })"
    />
    <button
      mlvButton
      type="button"
      variant="transparent"
      shape="square"
      mlvDensity="tight"
      [attr.aria-label]="'Remove ' + display.title(current)"
      (click)="removeRequested.emit(current.id)"
    >
      <svg lucideTrash2 mlvButtonIcon />
    </button>
  </ng-template>

  <span class="docs-tile-builder-node__type">{{ display.typeLabel(current) }}</span>
  <p>{{ display.summary(current) }}</p>

  @if (editing()) {
  <div class="docs-tile-builder-node__rename">
    <mlv-input
      ariaLabel="New tile name"
      [value]="draftTitle()"
      (valueChange)="draftTitle.set($event)"
      (keydown.enter)="saveRename(current.id)"
      (keydown.escape)="cancelRename()"
    />
    <button mlvButton type="button" (click)="saveRename(current.id)">Save</button>
    <button mlvButton type="button" variant="transparent" (click)="cancelRename()">
      Cancel
    </button>
  </div>
  }

  <ng-content />
</mlv-tile>
```

Trim the draft and suppress rename emission for an empty or unchanged title. Keep the pointer handle `aria-hidden`; edit, switch, remove, Save, and Cancel remain in the natural tab order.

- [ ] **Step 7: Add minimal token-only component styles**

Create BEM blocks for the canvas, branch, and node. Include only geometry needed for tests and usable rendering: flex column lists, token gaps, minimum empty target height, responsive inline size, action wrapping, and inline rename layout. Defer visual drag-state refinement to Task 6.

- [ ] **Step 8: Run docs tests, typecheck, and lint**

Run: `yarn nx run-many -t test typecheck lint -p docs --skipNxCache`

Expected: generic host compiles, component tests pass, and lint reports no selector or accessibility violations.

- [ ] **Step 9: Commit the recursive renderer**

```bash
git add apps/docs/src/app/pages/tile/examples/5/tile-builder.ts apps/docs/src/app/pages/tile/examples/5/tile-builder.html apps/docs/src/app/pages/tile/examples/5/tile-builder.scss apps/docs/src/app/pages/tile/examples/5/tile-builder-branch.ts apps/docs/src/app/pages/tile/examples/5/tile-builder-branch.html apps/docs/src/app/pages/tile/examples/5/tile-builder-branch.scss apps/docs/src/app/pages/tile/examples/5/tile-builder-node.ts apps/docs/src/app/pages/tile/examples/5/tile-builder-node.html apps/docs/src/app/pages/tile/examples/5/tile-builder-node.scss apps/docs/src/app/pages/tile/examples/5/tile-builder.spec.ts
git commit -m "feat(docs): render recursive tile builder"
```

---

### Task 5: Compose the realistic site-builder example

**Files:**

- Create: `apps/docs/src/app/pages/tile/examples/5/index.ts`
- Create: `apps/docs/src/app/pages/tile/examples/5/index.html`
- Create: `apps/docs/src/app/pages/tile/examples/5/index.scss`
- Create: `apps/docs/src/app/pages/tile/examples/5/index.mdx`
- Modify: `apps/docs/src/app/pages/tile/examples/5/tile-builder.spec.ts`
- Modify: `apps/docs/src/app/pages/tile/index.ts`

**Interfaces:**

- Consumes: `TileBuilderComponent`, `BuilderTileWithChildren`, `BuilderTileAccepts`, `BuilderTileView`, and all three mutation functions.
- Produces: docs example 5 with user-owned `PageBuilderProps`, policy, state, and working actions.

- [ ] **Step 1: Write failing host interaction tests**

Test the real default example component:

```ts
it('renames, disables, and removes nested content through builder outputs', () => {
  const component = fixture.componentInstance;

  component.rename({ tileId: 'hero', title: 'Summer campaign' });
  expect(findNode(component.page(), 'hero')?.props.title).toBe('Summer campaign');

  component.setEnabled({ tileId: 'hero', enabled: false });
  expect(findNode(component.page(), 'hero')?.props.enabled).toBe(false);

  component.remove('image-block');
  expect(findNode(component.page(), 'image-block')).toBeUndefined();
});

it('prevents rows entering containers that already have leaf blocks', () => {
  const component = fixture.componentInstance;
  const row = findContainer(component.page(), 'feature-row')!;
  const blockedTarget = findContainer(component.page(), 'header-row')!;
  const openTarget = findContainer(component.page(), 'empty-row')!;

  expect(component.canAccept(row, blockedTarget, blockedTarget.children)).toBe(false);
  expect(component.canAccept(row, openTarget, openTarget.children)).toBe(true);
});
```

- [ ] **Step 2: Run docs tests and verify red**

Run: `yarn nx test docs --skipNxCache`

Expected: FAIL because example 5 host and sample data are absent.

- [ ] **Step 3: Define user-owned props and realistic nested data**

Use a sample-only discriminator; do not add it to generic types:

```ts
type PageBlockType = 'page' | 'row' | 'hero' | 'text' | 'image' | 'cta';

interface PageBuilderProps {
  readonly title: string;
  readonly summary: string;
  readonly enabled: boolean;
  readonly blockType: PageBlockType;
}
```

Create a fixed `page` root with:

- `header-row` containing `hero` and `intro-text` leaves;
- `content-stack` containing `feature-row` and `empty-row` containers;
- `feature-row` containing a nested `media-row`;
- `media-row` containing `image-block` and `cta-block` leaves.

This provides a row with direct blocks that rejects incoming rows, an empty valid row, and rows nested two levels deep.

- [ ] **Step 4: Implement typed view and acceptance policy**

```ts
readonly view: BuilderTileView<PageBuilderProps> = {
  title: ({ props }) => props.title,
  summary: ({ props }) => props.summary,
  typeLabel: ({ props }) => props.blockType,
  enabled: ({ props }) => props.enabled,
};

readonly canAccept: BuilderTileAccepts<PageBuilderProps> = (
  draggedTile,
  _targetTile,
  innerTiles,
) =>
  !draggedTile.acceptsChildren ||
  !innerTiles.some((innerTile) => !innerTile.acceptsChildren);
```

The explicit annotations are required documentation: they demonstrate TypeScript parameter autocomplete and prevent boolean literal widening.

- [ ] **Step 5: Connect immutable action handlers**

```ts
move(request: BuilderMoveRequest): void {
  this.page.update((page) => moveBuilderNode(page, request));
}

rename(request: BuilderRenameRequest): void {
  this.page.update((page) =>
    updateBuilderTileProps(page, request.tileId, (props) => ({
      ...props,
      title: request.title,
    })),
  );
}

setEnabled(change: BuilderEnabledChange): void {
  this.page.update((page) =>
    updateBuilderTileProps(page, change.tileId, (props) => ({
      ...props,
      enabled: change.enabled,
    })),
  );
}

remove(tileId: string): void {
  this.page.update((page) => removeBuilderNode(page, tileId));
}
```

- [ ] **Step 6: Bind the complete example and document the policy**

```html
<section class="docs-tile-site-builder-example" aria-labelledby="site-builder-title">
  <div class="docs-tile-site-builder-example__intro">
    <div>
      <h3 id="site-builder-title">Homepage structure</h3>
      <p>Rows can nest, while rows containing blocks accept blocks only.</p>
    </div>
    <span class="docs-tile-site-builder-example__count">Live page structure</span>
  </div>

  <app-tile-builder
    [root]="page()"
    [accepts]="canAccept"
    [view]="view"
    (moveRequested)="move($event)"
    (renameRequested)="rename($event)"
    (removeRequested)="remove($event)"
    (enabledChange)="setEnabled($event)"
  />
</section>
```

The MDX explains that `blockType` is example-owned, shows the three-parameter predicate, and states that cycle prevention is internal and cannot be overridden.

- [ ] **Step 7: Register example 5**

Change the page count to:

```ts
exampleArray = new Array(5).fill(0).map((_, index) => index + 1);
```

- [ ] **Step 8: Run docs tests, typecheck, and lint**

Run: `yarn nx run-many -t test typecheck lint -p docs --skipNxCache`

Expected: the real example actions and policy tests pass; strict template checking accepts the generic bindings.

- [ ] **Step 9: Commit the composed example**

```bash
git add apps/docs/src/app/pages/tile/examples/5/index.ts apps/docs/src/app/pages/tile/examples/5/index.html apps/docs/src/app/pages/tile/examples/5/index.scss apps/docs/src/app/pages/tile/examples/5/index.mdx apps/docs/src/app/pages/tile/examples/5/tile-builder.spec.ts apps/docs/src/app/pages/tile/index.ts
git commit -m "docs(tile): add nested site builder example"
```

---

### Task 6: Polish hierarchy, restriction feedback, and motion

**Files:**

- Modify: `apps/docs/src/app/pages/tile/examples/5/tile-builder.scss`
- Modify: `apps/docs/src/app/pages/tile/examples/5/tile-builder-branch.scss`
- Modify: `apps/docs/src/app/pages/tile/examples/5/tile-builder-node.scss`
- Modify: `apps/docs/src/app/pages/tile/examples/5/index.scss`
- Modify: `apps/docs/src/app/pages/tile/examples/5/tile-builder.spec.ts`

**Interfaces:**

- Consumes: `dropState()` and BEM state classes from Task 4.
- Produces: full-outline valid/invalid feedback, visible restricted label, responsive nested layout, and transform/opacity-only movement.

- [ ] **Step 1: Add failing DOM-state tests**

After starting a row drag, assert a blocked row and empty row expose different non-color states:

```ts
expect(blockedDropList.classList).toContain(
  'docs-tile-builder-branch__drop-list--invalid',
);
expect(blockedDropList.textContent).toContain('Restricted');
expect(openDropList.classList).toContain(
  'docs-tile-builder-branch__drop-list--valid',
);
```

Assert the restricted label is absent outside an active drag session.

- [ ] **Step 2: Run docs tests and verify red**

Run: `yarn nx test docs --skipNxCache`

Expected: FAIL until session state is reflected in branch classes and text.

- [ ] **Step 3: Add quiet hierarchical styling**

Use these token-driven rules as the baseline:

```scss
$block: docs-tile-builder-branch;

.#{$block} {
  display: block;

  &__drop-list {
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: var(--mlv-height-s);
    gap: var(--mlv-spacing-2);
    padding: var(--mlv-padding-s);
    border: var(--mlv-stroke-width) dashed transparent;
    border-radius: var(--mlv-radius-l);
    transition:
      border-color var(--mlv-duration-normal) var(--mlv-ease-out),
      opacity var(--mlv-duration-normal) var(--mlv-ease-out);

    &--valid {
      border-color: var(--mlv-border-focus);
    }

    &--invalid {
      border-color: var(--mlv-border-error);
    }
  }

  &__restriction {
    align-self: flex-start;
    color: var(--mlv-text-error);
    font-size: var(--mlv-typography-body-xs-size);
  }
}
```

Use background only for the static inset child surface, never as a hover effect. Keep all target feedback on the complete outline.

- [ ] **Step 4: Preserve performant drag motion**

Ensure example styles do not override the Tile package's `.cdk-drag-preview`, `.cdk-drag-placeholder`, `.cdk-drag-animating`, or default sibling transform transition. Do not add persistent `will-change` declarations, and do not animate height, padding, margin, or box shadow while sorting.

Add an example-scoped media query that makes only its border/opacity transitions instant while leaving the preview visible:

```scss
@media (prefers-reduced-motion: reduce) {
  .docs-tile-builder-branch__drop-list {
    transition-duration: var(--mlv-duration-instant);
  }
}
```

- [ ] **Step 5: Add responsive behavior**

At narrow inline sizes, allow action controls and the rename row to wrap, reduce nested inline indentation through a component-scoped custom property, and keep every empty drop list at least `--mlv-height-s` tall. Do not hide actions on touch or keyboard focus.

- [ ] **Step 6: Run docs tests, typecheck, lint, and production build**

Run: `yarn nx run-many -t test typecheck lint -p docs --skipNxCache`

Run: `yarn nx run docs:build --configuration=production --skipNxCache`

Expected: all checks pass; component styles remain below the existing 40 KB warning budget.

- [ ] **Step 7: Commit visual polish**

```bash
git add apps/docs/src/app/pages/tile/examples/5/tile-builder.scss apps/docs/src/app/pages/tile/examples/5/tile-builder-branch.scss apps/docs/src/app/pages/tile/examples/5/tile-builder-node.scss apps/docs/src/app/pages/tile/examples/5/index.scss apps/docs/src/app/pages/tile/examples/5/tile-builder.spec.ts
git commit -m "style(tile): polish nested builder drag feedback"
```

---

### Task 7: Update contracts and perform final verification

**Files:**

- Modify: `.claude/projects/libs-tile.md`
- Modify: `.claude/projects/page-tile.md`
- Modify: `CLAUDE.md`
- Verify: every file listed in the file map

**Interfaces:**

- Consumes: completed Tile API and docs example.
- Produces: synchronized project documentation and final evidence for delivery.

- [ ] **Step 1: Update Tile API documentation**

Add `MlvTileActions` to the public API table and directive section. Update the template summary to state this exact order:

```text
CdkDragHandle → MlvTileHeader → MlvTileActions → MlvButtonClose
```

Add `.mlv-tile__actions` to the BEM reference and include a usage example with two icon buttons and a switch.

- [ ] **Step 2: Update page and monorepo indexes**

Document example 5 as a nested site builder with cross-level CDK movement, immutable state, user `[accepts]`, structural cycle safety, and edit/remove/publication actions. Keep the top-level Tile description focused on its surface/action/drag capabilities rather than presenting the docs-only builder as package API.

- [ ] **Step 3: Format only task-owned files**

Run `yarn prettier --write` with the explicit Tile library, Tile example 1–5, Tile page, and Tile documentation paths. Do not run a workspace-wide formatter because unrelated files are dirty.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 4: Run the complete Nx verification suite**

Run: `yarn nx run-many -t test typecheck lint -p core-tile docs --skipNxCache`

Run: `yarn nx run docs:check-doc-api --skipNxCache`

Run: `yarn nx run docs:build --configuration=production --skipNxCache`

Expected: every command exits 0. Existing toolchain deprecation warnings may remain, but no new warning or error is accepted.

- [ ] **Step 5: Perform live browser QA at the requested route**

Open `http://localhost:4200/tile` in the configured in-app browser at the same desktop viewport used for the original audit. Verify:

1. resting tiles have a visible complete border and no left state rail;
2. the larger handle appears on hover/focus but causes no background change;
3. the preview lifts with a clear shadow and follows the pointer smoothly;
4. sibling sorting and final placement transition instead of snapping;
5. a row enters the empty row and can return to its original parent;
6. a row cannot enter `header-row`, which already contains leaf blocks;
7. a container cannot enter itself or a descendant;
8. Rename saves on Enter, cancels on Escape, and keeps focus controls usable;
9. publication switch and Remove work without initiating drag;
10. restricted state includes visible text, not color alone;
11. touch/narrow layout retains the handle and usable actions; and
12. reduced-motion preference removes nonessential movement without hiding state.

Capture final resting, dragging, and restricted-target screenshots for comparison with the original audit, then remove temporary audit artifacts before handoff unless they are intentionally added as documentation assets.

- [ ] **Step 6: Inspect the final diff without touching unrelated work**

Run: `git status --short`

Run: `git diff --stat HEAD`

Run: `git diff --check HEAD`

Confirm every changed Tile path is explained by this plan. Leave concurrent homepage, package, lockfile, install-state, and other user-owned changes unstaged.

- [ ] **Step 7: Commit documentation updates**

```bash
git add .claude/projects/libs-tile.md .claude/projects/page-tile.md CLAUDE.md
git commit -m "docs(tile): document actions and site builder"
```

- [ ] **Step 8: Request code review**

Give the reviewer the spec, this plan, the commit range starting before Task 1, and the verification output. Require findings ordered by severity and exact file/line references. Resolve all correctness, accessibility, typing, performance, and scope findings, rerun the complete verification suite, and only then report completion.
