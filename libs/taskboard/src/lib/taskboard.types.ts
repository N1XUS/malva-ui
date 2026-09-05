export type MlvTaskboardKey = string | number;
export type MlvTaskboardField<TItem> = Extract<keyof TItem, string>;

export interface MlvTaskboardColumn {
  readonly id: MlvTaskboardKey;
  readonly label: string;
  readonly groupId?: MlvTaskboardKey;
  readonly locked?: boolean;
  readonly collapsible?: boolean;
  readonly wipLimit?: number;
}

export interface MlvTaskboardColumnGroup {
  readonly id: MlvTaskboardKey;
  readonly label: string;
  readonly wipLimit?: number;
}

export interface MlvTaskboardSwimlane {
  readonly id: MlvTaskboardKey;
  readonly label: string;
  readonly wipLimit?: number;
  readonly locked?: boolean;
}

export interface MlvTaskboardLocation {
  readonly columnId: MlvTaskboardKey;
  readonly swimlaneId?: MlvTaskboardKey;
  readonly index: number;
}

export interface MlvTaskboardWipState {
  readonly count: number;
  readonly limit: number | undefined;
  readonly remaining: number | undefined;
}

export interface MlvTaskboardItemContext<TItem> {
  readonly item: TItem;
  readonly id: MlvTaskboardKey;
  readonly source: MlvTaskboardLocation;
  readonly selected: boolean;
}

export interface MlvTaskboardDropTarget<TItem> {
  readonly column: MlvTaskboardColumn;
  readonly swimlane: MlvTaskboardSwimlane | undefined;
  readonly index: number;
  readonly items: readonly TItem[];
  readonly wip: MlvTaskboardWipState;
}

export type MlvTaskboardCanDropFn<TItem> = (
  card: MlvTaskboardItemContext<TItem>,
  target: MlvTaskboardDropTarget<TItem>,
) => boolean;

export interface MlvTaskboardTransition {
  readonly from: MlvTaskboardKey;
  readonly to: MlvTaskboardKey;
}

/**
 * Immutable controlled board snapshot. Do not mutate a board in place after
 * passing it to a drag session or move request; represent application updates
 * with a new board snapshot and item identities. Requests for an older
 * snapshot are stale and must not be reused with the replacement board.
 */
export interface MlvTaskboardState<TItem> {
  readonly items: readonly TItem[];
  readonly columns: readonly MlvTaskboardColumn[];
  readonly columnGroups?: readonly MlvTaskboardColumnGroup[];
  readonly swimlanes?: readonly MlvTaskboardSwimlane[];
  readonly visibleItems?: readonly TItem[];
  readonly dataKey: MlvTaskboardField<TItem>;
  readonly columnField: MlvTaskboardField<TItem>;
  readonly swimlaneField?: MlvTaskboardField<TItem>;
  readonly transitions?: readonly MlvTaskboardTransition[];
  readonly lockedItemIds?: readonly MlvTaskboardKey[];
  readonly selectedIds?: ReadonlySet<MlvTaskboardKey>;
  readonly canDropFn?: MlvTaskboardCanDropFn<TItem>;
}

/** @internal Backward-compatible local name for pure taskboard helpers. */
export type MlvTaskboard<TItem> = MlvTaskboardState<TItem>;

export interface MlvTaskboardMoveRequest<TItem> {
  readonly board: MlvTaskboard<TItem>;
  readonly itemId: MlvTaskboardKey;
  readonly source: MlvTaskboardLocation;
  readonly target: MlvTaskboardLocation;
  readonly anchorId?: MlvTaskboardKey;
}

export interface MlvTaskboardMoveResult<TItem> {
  readonly items: readonly TItem[];
  readonly item: TItem;
  readonly source: MlvTaskboardLocation;
  readonly target: MlvTaskboardLocation;
}

/** Serializable UI state that applications can restore without card data. */
export interface MlvTaskboardSnapshot {
  readonly columnIds: readonly MlvTaskboardKey[];
  readonly collapsedColumnIds: readonly MlvTaskboardKey[];
  readonly collapsedSwimlaneIds: readonly MlvTaskboardKey[];
  readonly selectedIds: readonly MlvTaskboardKey[];
  readonly focusedId?: MlvTaskboardKey;
  readonly cellScrollPositions: Readonly<Record<string, number>>;
}

/** An immutable board replacement that may be replayed by taskboard history. */
export interface MlvTaskboardCommand<TItem> {
  readonly before: MlvTaskboard<TItem>;
  readonly after: MlvTaskboard<TItem>;
}

export interface MlvTaskboardHistory<TItem> {
  current(): MlvTaskboard<TItem>;
  push(command: MlvTaskboardCommand<TItem>): MlvTaskboardHistory<TItem>;
  undo(): MlvTaskboard<TItem> | null;
  redo(): MlvTaskboard<TItem> | null;
  replace(board: MlvTaskboard<TItem>): MlvTaskboard<TItem>;
}

export interface MlvTaskboardCsvField<TItem> {
  readonly field: MlvTaskboardField<TItem>;
  readonly heading: string;
}

export interface MlvTaskboardSerialized<TItem> {
  readonly items: readonly TItem[];
  readonly columns: readonly MlvTaskboardColumn[];
  readonly columnGroups?: readonly MlvTaskboardColumnGroup[];
  readonly swimlanes?: readonly MlvTaskboardSwimlane[];
  readonly snapshot: MlvTaskboardSnapshot;
  readonly dataKey: MlvTaskboardField<TItem>;
  readonly columnField: MlvTaskboardField<TItem>;
  readonly swimlaneField?: MlvTaskboardField<TItem>;
  readonly transitions?: readonly MlvTaskboardTransition[];
  readonly lockedItemIds?: readonly MlvTaskboardKey[];
}
