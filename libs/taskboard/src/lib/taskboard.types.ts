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

export interface MlvTaskboard<TItem> {
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
