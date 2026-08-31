# Tile Compound Tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish `mlv-tiles` / `mlv-tile` as a typed compound tree API with one immutable root model, reliable nested drag-and-drop, density-driven Tile typography/geometry, and a minimal projected-content site-builder example.

**Architecture:** A root `MlvTiles<TProps>` owns `[(tree)]` and a private coordinator; nested `mlv-tiles` inherit that coordinator through their enclosing `MlvTile<TProps>`. Pure tree/session modules provide validated immutable updates and cached acceptance, while Angular CDK host directives remain private implementation details. The docs example supplies only typed data, `[accepts]`, recursive compound markup, and projected application controls.

**Tech Stack:** Angular 22 standalone components and signals, Angular CDK drag-drop, Vitest through Nx, SCSS/BEM with Malva tokens and density mixins, Lucide Angular icons, in-app browser pointer QA.

**Spec:** `docs/superpowers/specs/2026-08-21-tile-compound-tree-design.md`

## Global Constraints

- Public composition is only `mlv-tiles`, `mlv-tile`, and Tile projection directives; do not add a monolithic `mlv-tile-builder`.
- Exactly one root `mlv-tiles` owns `[(tree)]`; nested containers inherit the root coordinator and must reject a second tree binding in development mode.
- `acceptsChildren` is the structural discriminant; no default is allowed on the boolean generic.
- `MlvTileNodeWithChildren<TProps>` extends `MlvTileNode<TProps, true>`; application `blockType` remains consumer-owned.
- `[accepts]` receives the dragged node, target container node, and the target's exact direct readonly children.
- Self, descendant, leaf-target, missing-ID, duplicate-ID, and fixed-root moves are rejected internally before consumer policy.
- Acceptance runs once per structurally valid target at drag start; pointer movement performs `Set` lookup only.
- Successful moves/removals/property updates replace the root with immutable structural sharing; previous snapshots remain unchanged.
- Remove the public `[size]` input, `MlvTileSize` export, and size modifier classes. Tile supports the complete `MlvDensity` scale: `tight`, `compact`, `comfortable`, `spacious`, and `airy`.
- Density changes Tile padding, gap, radius, control geometry, title/body font size, and line height. Use existing Malva tokens/mixins; no raw pixel typography.
- The example does not use `closable`; it projects Edit and compact-density Switch before the handle and a circular Trash button after the handle.
- The controls DOM order is `MlvTileActions → CdkDragHandle → MlvTileTrailingActions → MlvButtonClose` inside one flex container.
- No left state rail, hover background change, decorative gradient, private Switch selector, custom consumer preview class, persistent `will-change`, or layout-property animation.
- Drag start must preserve layout; placeholder and preview retain source geometry; preview remains elevated; sorting/drop transitions use transform/opacity and honor reduced motion.
- Real pointer acceptance is mandatory. Synthetic `dropped.emit` coverage cannot close DnD tasks by itself.
- Work directly on `main` as requested. Preserve unrelated dirty files and stage only task-owned paths.

## File Map

| Path | Responsibility |
| --- | --- |
| `libs/core/tile/src/lib/tile-tree.types.ts` | Public generic node, policy, layout, and event contracts. |
| `libs/core/tile/src/lib/tile-tree-state.ts` | Pure validation, lookup, immutable move/remove/property update. |
| `libs/core/tile/src/lib/tile-drag-session.ts` | Per-drag index, descendants, target policy evaluation, allowed-ID set. |
| `libs/core/tile/src/lib/tile-tree-coordinator.ts` | Root model bridge and rendered item/container registration. |
| `libs/core/tile/src/lib/tiles/tiles.ts` | Public `mlv-tiles` root/nested container and private CDK drop-list integration. |
| `libs/core/tile/src/lib/tiles/tiles.html` | Drop-surface projection and visible empty/restricted feedback. |
| `libs/core/tile/src/lib/tiles/tiles.scss` | List/grid layout, target states, placeholder/sorting motion. |
| `libs/core/tile/src/lib/tile/tile.ts` | Existing Tile plus density, typed item registration, private CDK drag, root-backed methods. |
| `libs/core/tile/src/lib/tile/tile.html` | Header slots and structural controls order. |
| `libs/core/tile/src/lib/tile/tile.scss` | Density typography/geometry and stable preview/handle treatment. |
| `libs/core/tile/src/lib/tile-trailing-actions.ts` | Structural slot after the built-in drag handle. |
| `apps/docs/src/app/pages/tile/examples/5/tile-tree-node.*` | Small recursive presentation-only example using public compound primitives. |
| `apps/docs/src/app/pages/tile/examples/5/index.*` | Sample root data, typed policy, example framing/documentation. |

---

### Task 1: Replace Tile size with density and add the trailing action slot

**Files:**

- Create: `libs/core/tile/src/lib/tile-trailing-actions.ts`
- Modify: `libs/core/tile/src/lib/tile/tile.ts`
- Modify: `libs/core/tile/src/lib/tile/tile.html`
- Modify: `libs/core/tile/src/lib/tile/tile.scss`
- Modify: `libs/core/tile/src/lib/tile/tile.spec.ts`
- Modify: `libs/core/tile/src/index.ts`

**Interfaces:**

- Consumes: `MlvDensityDirective`, `MLV_DENSITY_ELEMENT`, `provideMlvDensityContext`, and all five density SCSS mixins from `@malva-ui/cdk/density` / `libs/styles/src/lib/density.scss`.
- Produces: density-aware `MlvTile`, `MlvTileTrailingActions`, structural control order, and removal of `MlvTileSize` / `[size]`.

- [ ] **Step 1: Write failing density and slot tests**

Add a host covering all five explicit values and a host containing both action slots:

```ts
@Component({
  imports: [
    MlvTile,
    MlvTileHeader,
    MlvTileActions,
    MlvTileTrailingActions,
  ],
  template: `
    <mlv-tile mlvDensity="tight">
      <ng-template mlvTileHeader>Title</ng-template>
      <ng-template mlvTileActions><button>Edit</button></ng-template>
      <ng-template mlvTileTrailingActions><button>Remove</button></ng-template>
      Body
    </mlv-tile>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TileDensityTestHost {}
```

Assert:

```ts
expect(tile.classList).toContain('mlv-tile--tight');
expect(tile.className).not.toContain('mlv-tile--size-');
expect(controls.map((child) => child.className)).toEqual([
  'mlv-tile__actions',
  'mlv-tile__drag-handle cdk-drag-handle',
  'mlv-tile__trailing-actions',
]);
```

Add a compile-time assertion that `MlvTileSize` is no longer imported from the public barrel after implementation.

- [ ] **Step 2: Run the focused test and verify red**

Run:

```bash
yarn nx run core-tile:vite:test --skipNxCache -- --run src/lib/tile/tile.spec.ts
```

Expected: FAIL because `MlvTileTrailingActions` and density integration do not exist and size classes remain.

- [ ] **Step 3: Implement the structural directive and density host directive**

Create:

```ts
import { Directive } from '@angular/core';
import { MlvStructural } from '@malva-ui/cdk';

@Directive({ selector: '[mlvTileTrailingActions]' })
export class MlvTileTrailingActions extends MlvStructural {}
```

Update `MlvTile`:

```ts
providers: [
  { provide: MLV_DENSITY_ELEMENT, useValue: 'tile' },
  provideMlvDensityContext(MlvDensityDirective),
],
hostDirectives: [
  { directive: MlvDensityDirective, inputs: ['mlvDensity'] },
],
```

Remove `MlvTileSize`, the `size` input, and `mlv-tile--size-*` host binding. Add `contentChild(MlvTileTrailingActions)` and render it after the handle but before the optional close button.

- [ ] **Step 4: Replace size maps with five density token sets**

Use `@use '../../../../../styles/src/lib/density' as density;` and set Tile variables for comfortable defaults plus explicit mixins. The values must be token-based and typography must change:

```scss
--mlv-tile-title-size: var(--mlv-typography-ui-m-size);
--mlv-tile-title-line-height: var(--mlv-typography-ui-m-line-height);
--mlv-tile-body-size: var(--mlv-typography-body-m-size);
--mlv-tile-body-line-height: var(--mlv-typography-body-m-line-height);

@include density.density-tight {
  --mlv-tile-title-size: var(--mlv-font-size-xs);
  --mlv-tile-title-line-height: var(--mlv-line-height-tight);
  --mlv-tile-body-size: var(--mlv-font-size-xs);
  --mlv-tile-body-line-height: var(--mlv-line-height-tight);
}

@include density.density-compact {
  --mlv-tile-title-size: var(--mlv-typography-ui-s-size);
  --mlv-tile-title-line-height: var(--mlv-typography-ui-s-line-height);
  --mlv-tile-body-size: var(--mlv-typography-body-s-size);
  --mlv-tile-body-line-height: var(--mlv-typography-body-s-line-height);
}

@include density.density-spacious {
  --mlv-tile-title-size: var(--mlv-typography-ui-l-size);
  --mlv-tile-title-line-height: var(--mlv-typography-ui-l-line-height);
  --mlv-tile-body-size: var(--mlv-typography-body-l-size);
  --mlv-tile-body-line-height: var(--mlv-typography-body-l-line-height);
}

@include density.density-airy {
  --mlv-tile-title-size: var(--mlv-font-size-xl);
  --mlv-tile-title-line-height: var(--mlv-line-height-normal);
  --mlv-tile-body-size: var(--mlv-font-size-l);
  --mlv-tile-body-line-height: var(--mlv-line-height-relaxed);
}
```

Apply title variables to `__title` and body variables to `__body`. Density must also set padding, radius, gaps, and compact/expanded control geometry without dropping accessible touch target rules.

- [ ] **Step 5: Run focused verification**

Run:

```bash
yarn nx run-many -t vite:test typecheck lint -p core-tile --skipNxCache
```

Expected: Tile tests, strict typecheck, and lint pass; public barrel no longer exports `MlvTileSize`.

- [ ] **Step 6: Commit**

```bash
git add libs/core/tile/src/lib/tile-trailing-actions.ts libs/core/tile/src/lib/tile/tile.ts libs/core/tile/src/lib/tile/tile.html libs/core/tile/src/lib/tile/tile.scss libs/core/tile/src/lib/tile/tile.spec.ts libs/core/tile/src/index.ts
git commit -m "feat(tile): adopt density and trailing actions"
```

---

### Task 2: Add public tree contracts and pure immutable state engine

**Files:**

- Create: `libs/core/tile/src/lib/tile-tree.types.ts`
- Create: `libs/core/tile/src/lib/tile-tree-state.ts`
- Create: `libs/core/tile/src/lib/tile-tree-state.spec.ts`
- Create: `libs/core/tile/src/lib/tile-drag-session.ts`
- Create: `libs/core/tile/src/lib/tile-drag-session.spec.ts`
- Modify: `libs/core/tile/src/index.ts`

**Interfaces:**

- Produces: `MlvTileNode<TProps, TAcceptsChildren>`, `MlvTileNodeWithChildren<TProps>`, `MlvTileNodeLeaf<TProps>`, `MlvTileTreeNode<TProps>`, `MlvTilesAccepts<TProps>`, `MlvTilesLayout`, `MlvTileMovedEvent`, `MlvTileMoveRequest`, and pure session/mutation functions.
- Consumed by: Tasks 3–6.

- [ ] **Step 1: Write failing public-type and mutation tests**

Define a test-only props interface and explicit root:

```ts
interface TestProps {
  readonly title: string;
  readonly type: 'page' | 'row' | 'block';
}

const root: MlvTileNodeWithChildren<TestProps> = {
  id: 'page',
  acceptsChildren: true,
  props: { title: 'Page', type: 'page' },
  children: [
    {
      id: 'row-a',
      acceptsChildren: true,
      props: { title: 'A', type: 'row' },
      children: [
        {
          id: 'hero',
          acceptsChildren: false,
          props: { title: 'Hero', type: 'block' },
        },
      ],
    },
    {
      id: 'row-b',
      acceptsChildren: true,
      props: { title: 'B', type: 'row' },
      children: [],
    },
  ],
};
```

Cover same-container forward/backward order, `hero` cross-level movement, row return to origin, root/self/descendant rejection, duplicate IDs, stale source indices, immutable previous snapshots, unaffected subtree identity, remove, and property replacement.

- [ ] **Step 2: Run the state test and verify red**

Run:

```bash
yarn nx run core-tile:vite:test --skipNxCache -- --run src/lib/tile-tree-state.spec.ts
```

Expected: FAIL because public tree contracts and state functions do not exist.

- [ ] **Step 3: Define exact public contracts**

Implement the interfaces from the spec verbatim, including no default on the boolean generic:

```ts
export interface MlvTileNode<TProps, TAcceptsChildren extends boolean> {
  readonly id: string;
  readonly acceptsChildren: TAcceptsChildren;
  readonly props: TProps;
}

export interface MlvTileNodeWithChildren<TProps>
  extends MlvTileNode<TProps, true> {
  readonly children: readonly MlvTileTreeNode<TProps>[];
}
```

Define requests by stable IDs:

```ts
export interface MlvTileMoveRequest {
  readonly tileId: string;
  readonly sourceContainerId: string;
  readonly targetContainerId: string;
  readonly previousIndex: number;
  readonly currentIndex: number;
}
```

- [ ] **Step 4: Implement one-pass validation and immutable operations**

Export internal/package functions with exact signatures:

```ts
export function moveMlvTileNode<TProps>(
  root: MlvTileNodeWithChildren<TProps>,
  request: MlvTileMoveRequest,
): MlvTileNodeWithChildren<TProps>;

export function removeMlvTileNode<TProps>(
  root: MlvTileNodeWithChildren<TProps>,
  tileId: string,
): MlvTileNodeWithChildren<TProps>;

export function updateMlvTileNodeProps<TProps>(
  root: MlvTileNodeWithChildren<TProps>,
  tileId: string,
  update: (props: TProps) => TProps,
): MlvTileNodeWithChildren<TProps>;
```

Invalid requests return the original root reference. Rebuild only ancestors on affected source/target paths.

- [ ] **Step 5: Write failing drag-session tests**

Assert policy calls once per eligible target and no policy calls from lookup:

```ts
const session = createMlvTileDragSession(root, 'hero', accepts);
expect(accepts).toHaveBeenCalledTimes(3);
expect(session.allowedTargetIds.has('row-b')).toBe(true);
expect(canEnterMlvTileTarget(session, 'row-b')).toBe(true);
expect(canEnterMlvTileTarget(session, 'row-b')).toBe(true);
expect(accepts).toHaveBeenCalledTimes(3);
```

Also prove direct-child object identity is passed, self/descendant candidates never call policy, and duplicate/missing IDs invalidate the session.

- [ ] **Step 6: Implement the cached session**

```ts
export interface MlvTileDragSession<TProps> {
  readonly root: MlvTileNodeWithChildren<TProps>;
  readonly draggedTile: MlvTileTreeNode<TProps>;
  readonly allowedTargetIds: ReadonlySet<string>;
  readonly nodeById: ReadonlyMap<string, MlvTileTreeNode<TProps>>;
  readonly parentById: ReadonlyMap<string, string>;
}
```

Build all maps/descendants in one traversal. `canEnterMlvTileTarget` performs only `allowedTargetIds.has(targetId)`.

- [ ] **Step 7: Run and commit**

Run:

```bash
yarn nx run core-tile:vite:test --skipNxCache -- --run src/lib/tile-tree-state.spec.ts src/lib/tile-drag-session.spec.ts
yarn nx run-many -t typecheck lint -p core-tile --skipNxCache
```

Commit:

```bash
git add libs/core/tile/src/lib/tile-tree.types.ts libs/core/tile/src/lib/tile-tree-state.ts libs/core/tile/src/lib/tile-tree-state.spec.ts libs/core/tile/src/lib/tile-drag-session.ts libs/core/tile/src/lib/tile-drag-session.spec.ts libs/core/tile/src/index.ts
git commit -m "feat(tile): add immutable tree engine"
```

---

### Task 3: Build the root coordinator and compound registration contract

**Files:**

- Create: `libs/core/tile/src/lib/tile-tree-coordinator.ts`
- Create: `libs/core/tile/src/lib/tile-tree-coordinator.spec.ts`
- Create: `libs/core/tile/src/lib/tiles/tiles.ts`
- Create: `libs/core/tile/src/lib/tiles/tiles.html`
- Create: `libs/core/tile/src/lib/tiles/tiles.scss`
- Modify: `libs/core/tile/src/index.ts`

**Interfaces:**

- Consumes: Task 2 tree/session/mutation functions.
- Produces: `MlvTiles<TProps>`, private `MlvTileTreeCoordinator<TProps>`, root/nested ownership rules, typed container registration, root-backed remove/update/move.

- [ ] **Step 1: Write failing coordinator tests**

Use fake rendered registrations with stable IDs and depths. Assert:

```ts
expect(() => nested.bindTree(root)).toThrowError(
  /Nested mlv-tiles must inherit the root tree/,
);
expect(() => orphan.start()).toThrowError(
  /Root mlv-tiles requires \[\(tree\)\]/,
);
```

Test registration/unregistration idempotency, deepest-first targets, one active drag session, policy inheritance/nearest override, successful model replacement, `(moved)` after state update, removal, and property updates.

- [ ] **Step 2: Run the focused test and verify red**

```bash
yarn nx run core-tile:vite:test --skipNxCache -- --run src/lib/tile-tree-coordinator.spec.ts
```

Expected: FAIL because coordinator/container types do not exist.

- [ ] **Step 3: Implement the coordinator without Angular DOM coupling**

Use registration records instead of importing docs code:

```ts
interface MlvTileContainerRegistration<TProps> {
  readonly id: string;
  readonly depth: number;
  readonly accepts: MlvTilesAccepts<TProps> | undefined;
  readonly canEnter: (allowed: boolean) => void;
}

interface MlvTileItemRegistration<TProps> {
  readonly id: string;
  readonly tile: () => MlvTileTreeNode<TProps>;
}
```

The coordinator takes callbacks to read/set the root, so it remains unit-testable. It sorts targets by depth only for pointer candidate precedence; stable registration order breaks peer ties.

- [ ] **Step 4: Implement root/nested `MlvTiles` ownership**

`MlvTiles<TProps>` injects parent `MlvTiles` and enclosing `MlvTile` optionally. A root constructs and binds a coordinator; a nested instance reuses `parentTiles.coordinator` and derives its target ID from the enclosing item.

The template is deliberately minimal:

```html
<ng-content />
@if (dropState() === 'invalid') {
  <span class="mlv-tiles__restriction">Restricted</span>
}
@if (isEmpty()) {
  <span class="mlv-tiles__empty">Drop tiles here</span>
}
```

Add `layout = input<MlvTilesLayout>('list')`, `accepts`, `moved`, and the optional root `tree` model. Do not add CDK behavior yet.

- [ ] **Step 5: Test Angular root/nested inference**

Create a strict generic host with root `[(tree)]`, a nested container without a second binding, and an explicitly typed predicate. Assert both containers resolve the same coordinator, target IDs are `page` and the enclosing row ID, and a nested `[(tree)]` reports the development error.

- [ ] **Step 6: Run and commit**

```bash
yarn nx run core-tile:vite:test --skipNxCache -- --run src/lib/tile-tree-coordinator.spec.ts src/lib/tiles/tiles.spec.ts
yarn nx run-many -t typecheck lint -p core-tile --skipNxCache
```

```bash
git add libs/core/tile/src/lib/tile-tree-coordinator.ts libs/core/tile/src/lib/tile-tree-coordinator.spec.ts libs/core/tile/src/lib/tiles libs/core/tile/src/index.ts
git commit -m "feat(tile): add compound tree coordinator"
```

---

### Task 4: Integrate private CDK drag-drop and prove list-mode pointer behavior

**Files:**

- Modify: `libs/core/tile/src/lib/tiles/tiles.ts`
- Modify: `libs/core/tile/src/lib/tiles/tiles.scss`
- Modify: `libs/core/tile/src/lib/tiles/tiles.spec.ts`
- Modify: `libs/core/tile/src/lib/tile/tile.ts`
- Modify: `libs/core/tile/src/lib/tile/tile.html`
- Modify: `libs/core/tile/src/lib/tile/tile.scss`
- Modify: `libs/core/tile/src/lib/tile/tile.spec.ts`

**Interfaces:**

- Consumes: Task 3 coordinator and Task 2 sessions.
- Produces: internally configured `CdkDropList`/`CdkDrag`, typed `[tile]`, `remove`, `setProps`, `updateProps`, list-mode same/cross-level DnD, stable placeholder/preview.

- [ ] **Step 1: Write failing compound DOM tests**

Create a real projected host with root/nested `mlv-tiles` and `mlv-tile` elements. Assert every item has an injected `CdkDrag`, every container an injected `CdkDropList`, CDK `data` is the typed node, and consumers import no CDK directives.

Test exact request normalization for same-container forward/backward and cross-level moves. Do not call public app handlers because the coordinator must update `[(tree)]` itself.

- [ ] **Step 2: Run the focused tests and verify red**

```bash
yarn nx run core-tile:vite:test --skipNxCache -- --run src/lib/tiles/tiles.spec.ts src/lib/tile/tile.spec.ts
```

Expected: FAIL because the compound components do not yet host CDK directives.

- [ ] **Step 3: Add private host directives and lifecycle wiring**

Use `CdkDropList` as a host directive of `MlvTiles` and `CdkDrag` as a host directive of `MlvTile`; inject their instances and configure plain CDK properties internally:

```ts
hostDirectives: [CdkDropList]
```

```ts
hostDirectives: [
  CdkDrag,
  { directive: MlvDensityDirective, inputs: ['mlvDensity'] },
]
```

`MlvTile` registers only when `[tile]` is present inside `mlv-tiles`; otherwise its injected drag remains disabled so standalone Tiles stay compatible. Assign `drag.data`, `drag.disabled`, container data, orientation, connections, and enter predicate from component/coordinator state. Subscribe to started/ended/dropped once and clean up with `DestroyRef`.

- [ ] **Step 4: Add root-backed item methods**

```ts
remove(): void {
  this._container?.remove(this.tile()?.id);
}

setProps(props: TProps): void {
  this._container?.updateProps(this.tile()?.id, () => props);
}

updateProps(update: (props: TProps) => TProps): void {
  this._container?.updateProps(this.tile()?.id, update);
}
```

Guard missing tree context as no-ops for standalone Tiles; development mode warns only when a tree operation is requested without a registered item.

- [ ] **Step 5: Stabilize list preview and placeholder geometry**

At drag start, capture the source root rect and expose CSS variables for width/height. Apply them to `.cdk-drag-preview` and `.cdk-drag-placeholder`; keep preview overflow visible and shadowed. Do not animate geometry. Clear variables after drag end.

- [ ] **Step 6: Perform mandatory real pointer list QA before commit**

Using only the configured in-app browser at `http://localhost:4200/tile`, reproduce and record:

1. reorder two same-level siblings forward and backward;
2. drag a container to a different valid parent and return it to its original index;
3. move `Launch campaign` into `Media row`;
4. reject an occupied row target;
5. inspect preview and placeholder bounding rectangles before/during drag;
6. confirm drag start does not change sibling/container rectangles.

If any pointer result differs from unit tests, stop and apply `superpowers:systematic-debugging`; do not commit a synthetic-only success.

- [ ] **Step 7: Run and commit**

```bash
yarn nx run-many -t vite:test typecheck lint -p core-tile --skipNxCache
```

```bash
git add libs/core/tile/src/lib/tiles libs/core/tile/src/lib/tile
git commit -m "feat(tile): internalize nested drag and drop"
```

---

### Task 5: Add grid layout without recursive squeeze or pointer regressions

**Files:**

- Modify: `libs/core/tile/src/lib/tiles/tiles.ts`
- Modify: `libs/core/tile/src/lib/tiles/tiles.scss`
- Modify: `libs/core/tile/src/lib/tiles/tiles.spec.ts`
- Modify: `libs/core/tile/src/lib/tile/tile.scss`

**Interfaces:**

- Consumes: working list-mode DnD from Task 4.
- Produces: public `layout="grid"`, container-local responsive tracks, valid/invalid outline feedback, reduced motion, and browser-proven two-dimensional sorting.

- [ ] **Step 1: Add failing grid contract tests**

Assert `layout="grid"` sets `mlv-tiles--grid`, configures the selected internal CDK strategy, preserves stable ID normalization, and keeps nested containers registered before ancestors for overlapping targets.

Add same-row forward/backward request tests using two sibling rectangles and a no-op return-to-original-index case.

- [ ] **Step 2: Reproduce the known broken state before implementation**

In the in-app browser, capture evidence for the current broken docs grid: initial/source/placeholder/preview/sibling rectangles, active container IDs, emitted indices, and DOM child order. The report must explain why the previous `mixed` + recursively small CSS grid failed; do not guess.

- [ ] **Step 3: Implement grid as a container-owned layout**

Use a container query and full-size minimum track:

```scss
.mlv-tiles {
  container-type: inline-size;

  &--grid {
    display: grid;
    grid-template-columns: repeat(
      auto-fit,
      minmax(min(100%, var(--mlv-tiles-min-column, 20rem)), 1fr)
    );
    align-items: start;
  }
}
```

Do not set child `height: 100%` or stretch short branches. Nested containers fall to one column before a tile becomes narrower than the full-size minimum.

Select CDK `mixed` orientation only if Phase 1 evidence proves it stable with the component host structure. If not, keep CDK list orientation and implement a coordinator sort predicate/index resolver based on measured cell centers. Whichever strategy is selected must keep stable ID-based model normalization.

- [ ] **Step 4: Add state and motion styles**

Valid/invalid states color the complete dashed outline; invalid state includes visible `Restricted` text. Empty targets remain generously sized. Sorting uses only transform/opacity. Reduced motion sets transition durations to `var(--mlv-duration-instant)` without hiding preview or feedback.

- [ ] **Step 5: Perform mandatory real pointer grid QA**

At the same viewport as the supplied references, verify:

- two siblings in one grid row reorder both ways;
- a container returns to its original cell;
- drag start preserves all resting rectangles;
- preview matches source width/height and is not clipped;
- nested target wins over ancestor;
- short top-level sibling does not stretch to the tall branch;
- nested containers use one column when two full-size tiles do not fit.

Capture resting, drag-start, and reordered screenshots for the task report.

- [ ] **Step 6: Run and commit**

```bash
yarn nx run-many -t vite:test typecheck lint -p core-tile --skipNxCache
```

```bash
git add libs/core/tile/src/lib/tiles/tiles.ts libs/core/tile/src/lib/tiles/tiles.scss libs/core/tile/src/lib/tiles/tiles.spec.ts libs/core/tile/src/lib/tile/tile.scss
git commit -m "feat(tile): add stable grid sorting"
```

---

### Task 6: Replace the docs-only builder with the public compound API

**Files:**

- Create: `apps/docs/src/app/pages/tile/examples/5/tile-tree-node.ts`
- Create: `apps/docs/src/app/pages/tile/examples/5/tile-tree-node.html`
- Create: `apps/docs/src/app/pages/tile/examples/5/tile-tree-node.scss`
- Modify: `apps/docs/src/app/pages/tile/examples/5/index.ts`
- Modify: `apps/docs/src/app/pages/tile/examples/5/index.html`
- Modify: `apps/docs/src/app/pages/tile/examples/5/index.scss`
- Modify: `apps/docs/src/app/pages/tile/examples/5/index.mdx`
- Modify: `apps/docs/src/app/pages/tile/examples/5/tile-builder.spec.ts` (rename to `tile-tree.spec.ts`)
- Delete: `apps/docs/src/app/pages/tile/examples/5/builder.types.ts`
- Delete: `apps/docs/src/app/pages/tile/examples/5/builder-tree.ts`
- Delete: `apps/docs/src/app/pages/tile/examples/5/builder-tree.spec.ts`
- Delete: `apps/docs/src/app/pages/tile/examples/5/tile-builder.ts`
- Delete: `apps/docs/src/app/pages/tile/examples/5/tile-builder.html`
- Delete: `apps/docs/src/app/pages/tile/examples/5/tile-builder.scss`
- Delete: `apps/docs/src/app/pages/tile/examples/5/tile-builder-branch.ts`
- Delete: `apps/docs/src/app/pages/tile/examples/5/tile-builder-branch.html`
- Delete: `apps/docs/src/app/pages/tile/examples/5/tile-builder-branch.scss`
- Delete: `apps/docs/src/app/pages/tile/examples/5/tile-builder-node.ts`
- Delete: `apps/docs/src/app/pages/tile/examples/5/tile-builder-node.html`
- Delete: `apps/docs/src/app/pages/tile/examples/5/tile-builder-node.scss`
- Delete: `apps/docs/src/app/pages/tile/examples/5/tile-builder-drop-list-registry.ts`

**Interfaces:**

- Consumes: public exports from Tasks 1–5.
- Produces: minimal realistic example with root `[(tree)]`, inherited nested containers, typed policy, projected actions, no docs-owned DnD/mutation engine.

- [ ] **Step 1: Write failing consumer-surface tests**

Test the real example and assert:

```ts
expect(rootTiles.tree()).toBe(component.page());
expect(nestedTiles.every((tiles) => tiles.tree() === undefined)).toBe(true);
expect(fixture.debugElement.queryAll(By.directive(CdkDropList))).toHaveLength(0);
```

The last assertion applies to docs component imports/ownership: verify docs source imports no `@angular/cdk/drag-drop`; CDK directives may exist internally in rendered library components.

Assert the example's typed policy rejects a row for `header-row`, accepts it for `empty-row`, and accepts the `hero` leaf for `media-row`.

- [ ] **Step 2: Run the focused test and verify red**

```bash
yarn nx run docs:vite:test --skipNxCache -- --run src/app/pages/tile/examples/5/tile-tree.spec.ts
```

Expected: FAIL because the compound example and renamed spec do not exist.

- [ ] **Step 3: Reduce the example host to data and policy**

Keep the approved `PageBuilderProps` and root data. Remove all docs-owned move/remove/update helpers. Define only:

```ts
readonly page = signal<MlvTileNodeWithChildren<PageBuilderProps>>(PAGE);

readonly canAccept: MlvTilesAccepts<PageBuilderProps> = (
  draggedTile,
  _targetTile,
  innerTiles,
) =>
  !draggedTile.acceptsChildren ||
  !innerTiles.some((innerTile) => !innerTile.acceptsChildren);
```

- [ ] **Step 4: Implement the small recursive presentation component**

The component imports only `MlvTiles`, `MlvTile`, slot directives, density, controls, input, and Lucide icons. Its structure is:

```html
@let current = tile();
<mlv-tile #tileRef [tile]="current" mlvDensity="comfortable">
  <ng-template mlvTileHeader>
    <strong>{{ current.props.title }}</strong>
    <span>{{ current.props.blockType }} · {{ current.props.summary }}</span>
  </ng-template>

  <ng-template mlvTileActions>
    <button mlvButton shape="circle" variant="transparent" [attr.aria-label]="'Edit ' + current.props.title">
      <svg lucidePencil />
    </button>
    <mlv-switch
      mlvDensity="compact"
      [checked]="current.props.enabled"
      [ariaLabel]="'Publish ' + current.props.title"
      (checkedChange)="tileRef.setProps({ ...current.props, enabled: $event })"
    />
  </ng-template>

  <ng-template mlvTileTrailingActions>
    <button mlvButton shape="circle" variant="transparent" [attr.aria-label]="'Remove ' + current.props.title" (click)="tileRef.remove()">
      <svg lucideTrash2 />
    </button>
  </ng-template>

  @if (current.acceptsChildren) {
    <mlv-tiles layout="grid">
      @for (child of current.children; track child.id) {
        <docs-tile-tree-node [tile]="child" />
      }
    </mlv-tiles>
  }
</mlv-tile>
```

If Angular template parsing rejects object spread, route only that property replacement through a two-line typed component method calling `tileRef.setProps`; do not reintroduce tree traversal utilities.

- [ ] **Step 5: Bind the root and document the contract**

```html
<mlv-tiles [(tree)]="page" [accepts]="canAccept" layout="grid">
  @for (tile of page().children; track tile.id) {
    <docs-tile-tree-node [tile]="tile" />
  }
</mlv-tiles>
```

MDX documents one root model, inherited nested containers, user-owned props/policy, library-owned immutable DnD, and projected actions. It must not mention a docs-only registry, helper, or builder component.

- [ ] **Step 6: Perform real example interaction QA**

Using the in-app browser, repeat every DnD scenario from Tasks 4–5 on the final recursive example. Also verify Edit, Switch, and circular Trash do not initiate drag; the example renders no close/X button; Switch has effective compact density.

- [ ] **Step 7: Run and commit**

```bash
yarn nx run docs:vite:test --skipNxCache -- --run src/app/pages/tile/examples/5/tile-tree.spec.ts
yarn nx run-many -t typecheck lint -p docs --skipNxCache
```

Stage only the example-5 replacement paths, including deletions:

```bash
git add -A apps/docs/src/app/pages/tile/examples/5
git commit -m "docs(tile): use compound tree primitives"
```

---

### Task 7: Migrate docs, close contracts, and run final verification

**Files:**

- Modify: `.claude/projects/libs-tile.md`
- Modify: `.claude/projects/page-tile.md`
- Modify: `CLAUDE.md`
- Modify: `apps/docs/src/app/pages/tile/examples/1/index.html`
- Modify: `apps/docs/src/app/pages/tile/examples/1/index.mdx`
- Modify: `apps/docs/src/app/pages/tile/examples/2/index.mdx`
- Modify: `apps/docs/src/app/pages/tile/examples/2/index.ts`
- Modify: `apps/docs/src/app/pages/tile/examples/3/index.mdx`
- Modify: `apps/docs/src/app/pages/tile/examples/3/index.ts`
- Modify: `apps/docs/src/app/pages/tile/examples/4/index.html`
- Modify: `apps/docs/src/app/pages/tile/examples/4/index.mdx`
- Modify: `apps/docs/src/app/pages/tile/examples/4/index.scss`
- Modify: `apps/docs/src/app/pages/tile/examples/4/index.ts`
- Modify: `apps/docs/src/app/pages/tile/index.ts`
- Verify: all Task 1–6 files and `http://localhost:4200/tile`

**Interfaces:**

- Consumes: complete public API and migrated example.
- Produces: synchronized documentation, no stale size/rail/custom-preview wording, full Nx and browser evidence.

- [ ] **Step 1: Convert the former Sizes example to Density**

Rename its user-facing title/copy to Density and render all five values through `mlvDensity` rather than `[size]`. The examples must visibly demonstrate typography as well as geometry.

Run:

```bash
rg -n "MlvTileSize|\[size\]|size-(xs|s|m|l|xl)|semantic rail|left-border|custom preview" libs/core/tile apps/docs/src/app/pages/tile .claude/projects/libs-tile.md .claude/projects/page-tile.md CLAUDE.md
```

Expected: no stale Tile size API, left-rail claim, or consumer preview instruction after documentation edits.

- [ ] **Step 2: Synchronize public API documentation**

Document:

- `MlvTiles`, `MlvTileNode*`, `MlvTilesAccepts`, `MlvTilesLayout`, and `MlvTileMovedEvent`;
- one root `[(tree)]` and inherited nested containers;
- `MlvTileActions → CdkDragHandle → MlvTileTrailingActions → MlvButtonClose`;
- `remove`, `setProps`, and `updateProps`;
- complete density behavior and intentional removal of size;
- internal cycle safety, cached policy evaluation, immutable updates, and pointer-verified grid/list DnD;
- example 5 as docs consumption of public primitives, not package-external builder logic.

- [ ] **Step 3: Format only owned Tile paths**

Use Prettier with an explicit file list. Do not run workspace-wide formatting. Then run:

```bash
git diff --check
```

Expected: no whitespace errors. Leave unrelated homepage/package/yarn/artifact changes unstaged.

- [ ] **Step 4: Run the complete Nx suite**

```bash
yarn nx run-many -t vite:test typecheck lint -p core-tile docs --skipNxCache
yarn nx run docs:check-doc-api --skipNxCache
yarn nx run docs:build --configuration=production --skipNxCache
```

Expected: all commands exit 0. Record existing warnings exactly and accept no new Tile warning/error.

- [ ] **Step 5: Run final browser acceptance**

Using the configured in-app browser only, verify at the original viewport:

1. list and grid sibling reorder forward/backward;
2. container move away and return to original index;
3. `Launch campaign` → `Media row`;
4. row rejection for leaf-containing target;
5. self/descendant rejection;
6. stable layout on drag start;
7. correctly sized shadowed preview and footprint-preserving placeholder;
8. full-border valid/invalid states plus `Restricted` text;
9. hover-only fine-pointer handle with no hover background;
10. Edit, compact Switch, and circular Trash are usable and never drag;
11. no close/X in example 5;
12. density changes title/body typography and geometry across all five values;
13. narrow/touch and reduced-motion behavior.

Capture resting, dragging, restricted, and density screenshots. Compare reference and final states together at identical dimensions before accepting the result.

- [ ] **Step 6: Commit documentation and approved earlier Tile copy polish**

```bash
git add .claude/projects/libs-tile.md .claude/projects/page-tile.md CLAUDE.md apps/docs/src/app/pages/tile/examples/1 apps/docs/src/app/pages/tile/examples/2 apps/docs/src/app/pages/tile/examples/3 apps/docs/src/app/pages/tile/examples/4 apps/docs/src/app/pages/tile/index.ts
git commit -m "docs(tile): document compound tree and density"
```

- [ ] **Step 7: Inspect scope and request final review**

```bash
git status --short
git diff --check HEAD
```

Generate a whole-implementation review package from commit `510a627a` through final HEAD. Give the reviewer this spec, plan, all verification output, live screenshots, and the carried warning history. Resolve every Critical/Important correctness, accessibility, typing, performance, DnD, and scope finding; rerun the complete verification suite after fixes.
