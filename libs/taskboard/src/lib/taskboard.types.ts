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
  /**
   * The moved card's final position among {@link items} — the target bucket's
   * visible cards **with the moved card removed**. Either way it spans
   * `0..items.length`, minus the slot the card already occupies: a same-bucket
   * move can still land last, but its own current slot is not a move.
   */
  readonly index: number;
  /**
   * The target bucket's visible cards **with the moved card removed**, so it is
   * exactly the list {@link index} counts: the card lands before `items[index]`,
   * and `index === items.length` appends after the last one.
   */
  readonly items: readonly TItem[];
  readonly wip: MlvTaskboardWipState;
}

/**
 * Why a drag session refused one enumerated slot. The gates are evaluated in
 * this order and the first failing one is recorded, so a slot refused by two
 * of them reports the earlier:
 *
 * - `locked` — the card, its column or lane, or the target column or lane is
 *   locked.
 * - `transition` — the board's `transitions` forbid that column change.
 * - `wip` — a column, group, or lane work-in-progress limit is reached.
 * - `policy` — the application's `canDropFn` refused the target.
 *
 * The slot the card already occupies is not refused and records no reason:
 * the session simply does not enumerate it.
 */
export type MlvTaskboardDenialReason =
  | 'locked'
  | 'transition'
  | 'wip'
  | 'policy';

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

export interface MlvTaskboardMoveRequest<TItem> {
  readonly board: MlvTaskboardState<TItem>;
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

/**
 * Application guard consulted once per committed pointer drop, before the
 * board writes any replacement item collection. Returning `false` — or a
 * promise resolving to `false` — cancels the move and leaves the controlled
 * `items` collection referentially unchanged.
 */
export type MlvTaskboardBeforeMove<TItem> = (
  request: MlvTaskboardMoveRequest<TItem>,
) => boolean | Promise<boolean>;

/**
 * Why a started move never produced a replacement item collection.
 *
 * - `invalid-drop` — the released slot was never a permitted target.
 * - `cancelled` — the pointer drag was abandoned (Escape).
 * - `before-move-rejected` — `beforeMove` answered `false`.
 * - `before-move-error` — `beforeMove` threw or rejected.
 * - `stale` — the controlled board changed while `beforeMove` was pending.
 */
export type MlvTaskboardMoveCancelReason =
  | 'invalid-drop'
  | 'cancelled'
  | 'before-move-rejected'
  | 'before-move-error'
  | 'stale';

/**
 * Application policy consulted for every candidate column order a pointer
 * drag hovers. Returning `false` rejects that order; the board leaves its
 * controlled `columns` collection referentially unchanged.
 *
 * @param column - The column being dragged.
 * @param fromIndex - Its index in the current column collection.
 * @param toIndex - The index it would occupy if the pointer were released.
 * @param columns - The current, unmodified column collection.
 */
export type MlvTaskboardCanReorderColumnFn = (
  column: MlvTaskboardColumn,
  fromIndex: number,
  toIndex: number,
  columns: readonly MlvTaskboardColumn[],
) => boolean;

/**
 * How the board names one card when it announces something about it — a grab,
 * a drop, a refusal, a cancellation. Without one the board falls back to the
 * card's `dataKey` value as text, which on a uuid- or numeric-keyed board is
 * read out to the user verbatim.
 *
 * @param item - The card being announced.
 * @returns The plain-text name to speak. It is not escaped or truncated.
 */
export type MlvTaskboardCardLabelFn<TItem> = (item: TItem) => string;

/** Payload emitted when a started move ends without changing the board. */
export interface MlvTaskboardMoveCancelledEvent<TItem> {
  readonly reason: MlvTaskboardMoveCancelReason;
  readonly request?: MlvTaskboardMoveRequest<TItem>;
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
  readonly before: MlvTaskboardState<TItem>;
  readonly after: MlvTaskboardState<TItem>;
}

export interface MlvTaskboardHistory<TItem> {
  current(): MlvTaskboardState<TItem>;
  push(command: MlvTaskboardCommand<TItem>): MlvTaskboardHistory<TItem>;
  undo(): MlvTaskboardState<TItem> | null;
  redo(): MlvTaskboardState<TItem> | null;
  replace(board: MlvTaskboardState<TItem>): MlvTaskboardState<TItem>;
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
