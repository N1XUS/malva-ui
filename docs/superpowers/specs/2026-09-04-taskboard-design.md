# Taskboard Design

## Goal

Ship a standalone, publishable `@malva-ui/taskboard` package that provides a typed, template-projected Kanban board with columns, optional swimlanes, controlled drag-and-drop, validation, selection, history, virtual rendering, and accessible keyboard operation.

The package is inspired by the capability set named in issue #52. It is an original Malva UI implementation; it does not copy the referenced paid product's source or design.

## Decisions

- The public package is `@malva-ui/taskboard`, implemented in `libs/taskboard`. It is not a `@malva-ui/core` secondary entry point.
- SortableJS remains a package-private pointer/touch drag adapter. The established `mlv-tiles` interaction model is reused: Angular owns state, SortableJS is never allowed to commit a DOM reorder, and a rejected move restores the source DOM without a transient model update.
- The board is controlled and immutable. It emits complete action requests and, when bound with models, replacement arrays/sets. Consumers keep ownership of card data, filtering, editing UIs, authorization, and persistence.
- Drag validation is synchronous while a drag is active. An optional asynchronous confirmation hook is only evaluated after a requested drop and before any state update, so it cannot create a half-completed move.
- The first release supports the whole issue scope in one library, with pure state helpers separated from Angular rendering. A second public drag-drop CDK package is not introduced: tiles already show that a private SortableJS adapter has the required pointer and touch behavior, and a general CDK primitive would be speculative before a second consumer exists.

## Package and Dependencies

`libs/taskboard` is a publishable Angular library with its own `package.json`, ng-packagr configuration, explicit Nx `test`, `lint`, `typecheck`, and `build` targets, zoneless test setup, public API type-check fixture, README, and `CLAUDE.md`.

It peers on Angular and `@angular/cdk`, and declares its use of `sortablejs` in the package publication metadata. It consumes only narrow Malva dependencies: `@malva-ui/cdk/density`, `@malva-ui/cdk/utils` for RTL and IDs, `@malva-ui/i18n` for announcements, and existing public controls where a default affordance is needed. SortableJS remains invisible to consumers.

The root `AGENTS.md`, root `CLAUDE.md`, the relevant `.claude/projects/*.md` index, root package workspace configuration, docs routes, API generation inputs, and i18n locale records are updated with the new library.

## Data Model and Controlled State

Cards are generic records. The board does not require a title, status, assignee, or Malva-specific domain object.

```ts
type MlvTaskboardKey = string | number;
type MlvTaskboardField<TItem> = Extract<keyof TItem, string>;

interface MlvTaskboardColumn {
  readonly id: MlvTaskboardKey;
  readonly label: string;
  readonly groupId?: MlvTaskboardKey;
  readonly locked?: boolean;
  readonly collapsible?: boolean;
  readonly wipLimit?: number;
}

interface MlvTaskboardColumnGroup {
  readonly id: MlvTaskboardKey;
  readonly label: string;
  readonly wipLimit?: number;
}

interface MlvTaskboardSwimlane {
  readonly id: MlvTaskboardKey;
  readonly label: string;
  readonly wipLimit?: number;
  readonly locked?: boolean;
}
```

`MlvTaskboard<TItem>` accepts `items`, `columns`, optional `columnGroups`, optional `swimlanes`, and optional `visibleItems`. `items` is the canonical set used for WIP and all emitted immutable updates. `visibleItems`, when supplied, is a keyed subset of `items` that the board renders; this is the filter/sort integration point. Its source order is respected. Missing or duplicate keys are rejected in development with a descriptive warning and do not enter the drag session.

The required `dataKey` and `columnField` identify consumer properties. Optional `swimlaneField` enables lanes. Moving a card creates an immutable card replacement with the target field values and returns a new `items` array while retaining identities for every untouched card. For a filtered view, target placement is anchored to the nearest visible card key rather than an absolute visible index, preserving hidden cards in the canonical array. Consumers with an independent server-side ordering field receive the move request and may persist their own ordering instead.

The board exposes model inputs for `items`, `columns`, `selection`, `collapsedColumnIds`, and `collapsedSwimlaneIds`. It also exposes a `snapshot` getter and `restore(snapshot)` method. Snapshot state contains the card placement (`items`) alongside column order, collapsed IDs, selected IDs, logical focus, and per-cell scroll offsets, so a capture / move / `restore()` round trip puts the cards back and the whole restore is one undoable command. Card *content* stays application-owned — the snapshot holds a frozen copy of the `items` array the application already had and hands it straight back. `restore()` also accepts the UI-only `MlvTaskboardUiSnapshot` projection, which leaves the cards untouched.

## Drop, Transition, WIP, and Permission Contract

```ts
interface MlvTaskboardItemContext<TItem> {
  readonly item: TItem;
  readonly id: MlvTaskboardKey;
  readonly source: MlvTaskboardLocation;
  readonly selected: boolean;
}

interface MlvTaskboardDropTarget<TItem> {
  readonly column: MlvTaskboardColumn;
  readonly swimlane: MlvTaskboardSwimlane | undefined;
  readonly index: number;
  readonly items: readonly TItem[];
  readonly wip: MlvTaskboardWipState;
}

type MlvTaskboardCanDropFn<TItem> = (
  card: MlvTaskboardItemContext<TItem>,
  target: MlvTaskboardDropTarget<TItem>,
) => boolean;
```

`canDropFn` is the requested permission extension. It receives the current card plus its source metadata and the exact destination container, its insertion index, rendered items, and WIP state. It returns `true` only when the card may enter that container. It runs once per target at drag-session creation and is re-evaluated only if input identities change, so pointer movement reads a cached `ReadonlySet` rather than repeatedly running consumer authorization code.

The move engine permits a destination only when every synchronous rule passes:

1. The source card, source column, destination column, and destination lane are not locked.
2. A declared transition permits source-column to destination-column travel; no transition declaration means all columns may transition.
3. Destination column, destination swimlane, and destination group WIP limits remain satisfied after removing the source card where applicable.
4. `canDropFn` returns `true` when supplied.

An optional `beforeMove` hook receives the same card/target plus the full move request and returns `boolean | Promise<boolean>`. It is for confirm dialogs or asynchronous policy checks. The visual drag ends in a pending state, the DOM returns to Angular's current arrangement, and no output/model mutation occurs until the hook resolves `true`. A `false`, rejection, Escape, or stale drag token emits `moveCancelled` and leaves data untouched. An optional `canDragFn`, `canReorderColumnFn`, and `canAddCardFn` supply explicit consumer authorization for the corresponding user actions; selection remains available to read-only viewers by default.

Column drags use a separate SortableJS group. Locked columns cannot start or accept a reorder. Reordering across phases updates the column's `groupId` immutably; an ungrouped column has no group WIP contribution. This lets a consumer represent phases without a second, mismatched order model.

## Rendering and Projection API

The root supplies semantic board geometry, default controls, focus handling, drop indicators, and screen-reader live regions. Every content-bearing visual is replaceable through structural templates. Definitions use `TemplateRef` directives with `ngTemplateContextGuard` and exported context interfaces, so strict Angular templates infer card, column, lane, WIP, action, and drop information without casts.

```html
<mlv-taskboard
  [(items)]="tasks"
  [columns]="columns"
  dataKey="id"
  columnField="status"
  [canDropFn]="canDrop"
  (cardActivated)="openTask($event)"
>
  <ng-template mlvTaskboardItemDef let-card let-column="column" let-lane="swimlane">
    <article>{{ card.title }}</article>
  </ng-template>

  <ng-template mlvTaskboardColumnHeaderDef let-column let-wip="wip">
    {{ column.label }} ({{ wip.count }})
  </ng-template>
</mlv-taskboard>
```

The full definition set is `mlvTaskboardHeaderDef`, `mlvTaskboardColumnGroupDef`, `mlvTaskboardColumnHeaderDef`, `mlvTaskboardColumnContentDef`, `mlvTaskboardSwimlaneDef`, `mlvTaskboardItemDef`, `mlvTaskboardCardAddDef`, `mlvTaskboardDragPreviewDef`, `mlvTaskboardEmptyStateDef`, and `mlvTaskboardDropIndicatorDef`. A definition is optional; the root supplies an accessible default shell or default empty/add control. Custom templates receive only stable public context interfaces, never private component instances.

`cardActivated` and `contextMenu` emit the card, location, selected IDs, and native event. The component owns no task editor or bespoke context menu. The add slot receives a `requestAdd()` callback that emits `addRequested` with the intended column/lane; applications provide the inline input, dialog, drawer, or `mlv-menu` integration.

## Selection, Focus, and Keyboard Interaction

Cards use a roving-tabindex grid pattern. Pointer click replaces selection, Ctrl/Cmd-click toggles, and Shift-click selects the inclusive range in current rendered board order. Selection is a stable-ID model, so filtering may temporarily hide selected cards without erasing them. `selectionChange` and all action payloads surface the selected IDs for application bulk actions.

Arrow keys move logical focus between cards and cells; horizontal mapping goes through `MlvRtlService.normalizeArrowKey()`. Space toggles a keyboard grab. While grabbed, arrows select an eligible destination slot, Space commits the same validation/async flow as pointer drag, and Escape cancels. Enter emits `cardActivated`. Announcements name the card, proposed column/lane, position, and rejection reason without relying on deprecated ARIA drag attributes.

The board uses semantic `grid`, `rowgroup`, `row`, and `gridcell` relationships only where the rendered structure warrants them. Native buttons retain button semantics. It carries visible focus indicators, never makes a projected control an unintended drag handle, and maintains touch support through SortableJS's delayed fallback gesture. Right-click is additive, not the only route to an action.

## Density, RTL, Motion, and Virtual Rendering

The root and all default sub-surfaces participate in `MlvDensityDirective` and CSS density variables. Each density changes the column width, padding, header geometry, row gap, card spacing, and default control targets together. CSS uses BEM blocks, logical inline properties, real `--mlv-*` tokens, `@layer mlv.components`, and a reduced-motion path. The drag preview direction, column reordering, keyboard directions, and inline visual indicators mirror correctly in RTL.

Each card cell can enable fixed-size virtual rendering by supplying a positive `virtualItemSize`; otherwise it renders normally. The implementation uses the Angular CDK viewport inside the column/lane cell while the internal Sortable adapter registers its content wrapper. Item identity and a logical item window offset translate Sortable indices into full-cell indices. Keyboard focus requests and drag targets outside the rendered range scroll into view before committing. During print, virtual viewports render their complete visible collection, `@media print` removes scroll clipping and controls, and `print()` is browser-only and safely no-ops during SSR.

Per-cell scroll offsets are restored after a filter, collapse, or input update. A hidden logical focus target is retained and restored when it becomes visible; if the current user action requires immediate focus, the nearest visible card or containing cell receives it.

## History, Editing, Export, and Public Methods

All board-originated immutable changes are commands: card moves, column reorders, collapse toggles, and explicit `updateItem`, `removeItems`, or `insertItem` method calls. `undo()` and `redo()` replay the stored replacement state, emit the same controlled model outputs, and return `false` at the ends of history. External changes to `items` or `columns` clear redo history but preserve selection/focus/scroll by ID; applications that want an externally edited card in undo history call `updateItem` instead of replacing it themselves.

`exportJson()` returns a serializable object containing canonical items, columns, groups, lanes, and the UI snapshot — the embedded snapshot is the UI-only projection (`MlvTaskboardUiSnapshot`), because the cards are already the `items` field and are never listed twice. `exportCsv(columnId, fields)` returns CSV for the canonical items in one column; callers choose typed field descriptors and headings so the board does not guess how to serialize nested data. `print()` and print CSS produce the print-ready current board view without downloading files or making network calls.

## Testing and Documentation

Tests are written before implementation for every state rule and UI behavior. Pure tests cover indexing, immutable move placement with hidden items, WIP at column/lane/group levels, transition and permission rejection, async cancellation, command history, snapshots, CSV escaping, and duplicate/missing keys. Component tests cover each structural context guard, default/template rendering, Sortable callbacks, touch configuration, selection variants, keyboard grab/drop/cancel, focus restoration, RTL arrows, density classes, virtual index translation, SSR safety, and AXE checks.

The docs app receives a taskboard page with examples for a basic projected board, swimlanes/WIP, `canDropFn` permissions and transitions, selection/bulk events, custom slots/context menus, density/RTL, virtual columns, snapshots/history, and export/print. The standalone library README and `CLAUDE.md` document every input, output, definition context, public method, SSR rule, and virtual-scroll constraint. I18n tokens include all user-facing labels and announcements in every supported locale.

## Acceptance Criteria

- Consumers import only `@malva-ui/taskboard`; no drag engine or app-specific data schema leaks into their code.
- Generic card templates compile without casts through `mlvTaskboardItemDef` and the other guarded structural definitions.
- Pointer, touch, and keyboard drops obey transitions, locks, WIP limits, and `canDropFn`; rejected/async-cancelled moves do not change controlled data.
- Columns, groups, lanes, selection, context-menu events, app-owned activation/add flows, undo/redo, snapshots, export, print, density, RTL, and virtual rendering all have documented public contracts and automated coverage.
- The new package, docs, package metadata, project indexes, i18n, test target, lint, typecheck, build, accessibility, and SSR gates are green.
