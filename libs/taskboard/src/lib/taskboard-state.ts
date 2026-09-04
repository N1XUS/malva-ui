import type {
  MlvTaskboard,
  MlvTaskboardColumn,
  MlvTaskboardKey,
  MlvTaskboardMoveRequest,
  MlvTaskboardMoveResult,
  MlvTaskboardSwimlane,
  MlvTaskboardWipState,
} from './taskboard.types';

export type {
  MlvTaskboard,
  MlvTaskboardColumn,
  MlvTaskboardColumnGroup,
  MlvTaskboardField,
  MlvTaskboardKey,
  MlvTaskboardLocation,
  MlvTaskboardMoveRequest,
  MlvTaskboardMoveResult,
  MlvTaskboardSwimlane,
  MlvTaskboardWipState,
} from './taskboard.types';

const keyOf = (key: MlvTaskboardKey | undefined): string =>
  key === undefined ? 'undefined' : `${typeof key}:${String(key)}`;
const sameKey = (
  left: MlvTaskboardKey | undefined,
  right: MlvTaskboardKey | undefined,
): boolean => keyOf(left) === keyOf(right);

function validateUnique<T extends { readonly id: MlvTaskboardKey }>(
  values: readonly T[],
  label: string,
): void {
  const known = new Set<string>();
  for (const value of values) {
    const key = keyOf(value.id);
    if (known.has(key))
      throw new Error(`Duplicate taskboard ${label} id: ${String(value.id)}`);
    known.add(key);
  }
}

function itemKey<TItem>(
  board: MlvTaskboard<TItem>,
  item: TItem,
): MlvTaskboardKey {
  const key = item[board.dataKey];
  if (typeof key !== 'string' && typeof key !== 'number') {
    throw new Error(
      `Taskboard item key must be a string or number: ${String(key)}`,
    );
  }
  return key;
}

export interface MlvTaskboardIndex<TItem> {
  readonly board: MlvTaskboard<TItem>;
  readonly itemById: ReadonlyMap<MlvTaskboardKey, TItem>;
  readonly columnById: ReadonlyMap<MlvTaskboardKey, MlvTaskboardColumn>;
  readonly groupById: ReadonlyMap<
    MlvTaskboardKey,
    { readonly id: MlvTaskboardKey; readonly wipLimit?: number }
  >;
  readonly swimlaneById: ReadonlyMap<MlvTaskboardKey, MlvTaskboardSwimlane>;
  readonly visibleItems: readonly TItem[];
  itemsFor(
    columnId: MlvTaskboardKey,
    swimlaneId?: MlvTaskboardKey,
  ): readonly TItem[];
  wipFor(
    columnId: MlvTaskboardKey,
    swimlaneId?: MlvTaskboardKey,
  ): MlvTaskboardWipState;
  swimlaneWipFor(swimlaneId: MlvTaskboardKey): MlvTaskboardWipState;
  groupWipFor(groupId: MlvTaskboardKey): MlvTaskboardWipState;
}

export function createMlvTaskboardIndex<TItem>(
  board: MlvTaskboard<TItem>,
): MlvTaskboardIndex<TItem> {
  validateUnique(board.columns, 'column');
  validateUnique(board.columnGroups ?? [], 'column group');
  validateUnique(board.swimlanes ?? [], 'swimlane');
  for (const value of [
    ...board.columns,
    ...(board.columnGroups ?? []),
    ...(board.swimlanes ?? []),
  ]) {
    if (
      value.wipLimit !== undefined &&
      (!Number.isFinite(value.wipLimit) || value.wipLimit < 0)
    ) {
      throw new Error(
        `Taskboard WIP limit must be a non-negative finite number: ${String(value.id)}`,
      );
    }
  }

  const columnById = new Map(
    board.columns.map((column) => [column.id, column]),
  );
  const groupById = new Map(
    (board.columnGroups ?? []).map((group) => [group.id, group]),
  );
  const swimlaneById = new Map(
    (board.swimlanes ?? []).map((swimlane) => [swimlane.id, swimlane]),
  );
  for (const column of board.columns) {
    if (column.groupId !== undefined && !groupById.has(column.groupId)) {
      throw new Error(
        `Unknown taskboard column group id: ${String(column.groupId)}`,
      );
    }
  }

  const itemById = new Map<MlvTaskboardKey, TItem>();
  const canonicalKeys = new Set<string>();
  for (const item of board.items) {
    const id = itemKey(board, item);
    const key = keyOf(id);
    if (canonicalKeys.has(key))
      throw new Error(`Duplicate taskboard item key: ${String(id)}`);
    canonicalKeys.add(key);
    itemById.set(id, item);
  }

  const visibleItems = board.visibleItems ?? board.items;
  const visibleKeys = new Set<string>();
  for (const item of visibleItems) {
    const id = itemKey(board, item);
    const key = keyOf(id);
    if (!canonicalKeys.has(key))
      throw new Error(
        `Visible taskboard item key is not canonical: ${String(id)}`,
      );
    if (visibleKeys.has(key))
      throw new Error(`Duplicate visible taskboard item key: ${String(id)}`);
    visibleKeys.add(key);
  }

  const matches = (
    item: TItem,
    columnId: MlvTaskboardKey,
    swimlaneId?: MlvTaskboardKey,
  ): boolean =>
    sameKey(item[board.columnField] as MlvTaskboardKey, columnId) &&
    (swimlaneId === undefined ||
      (board.swimlaneField !== undefined &&
        sameKey(item[board.swimlaneField] as MlvTaskboardKey, swimlaneId)));
  const wip = (
    items: readonly TItem[],
    limit: number | undefined,
  ): MlvTaskboardWipState => ({
    count: items.length,
    limit,
    remaining: limit === undefined ? undefined : limit - items.length,
  });

  return {
    board,
    itemById,
    columnById,
    groupById,
    swimlaneById,
    visibleItems,
    itemsFor: (columnId, swimlaneId) =>
      visibleItems.filter((item) => matches(item, columnId, swimlaneId)),
    wipFor: (columnId, swimlaneId) => {
      return wip(
        board.items.filter((item) => matches(item, columnId, swimlaneId)),
        columnById.get(columnId)?.wipLimit,
      );
    },
    swimlaneWipFor: (swimlaneId) =>
      wip(
        board.items.filter(
          (item) =>
            board.swimlaneField !== undefined &&
            sameKey(item[board.swimlaneField] as MlvTaskboardKey, swimlaneId),
        ),
        swimlaneById.get(swimlaneId)?.wipLimit,
      ),
    groupWipFor: (groupId) => {
      const groupColumns = board.columns
        .filter((column) => sameKey(column.groupId, groupId))
        .map((column) => column.id);
      return wip(
        board.items.filter((item) =>
          groupColumns.some((columnId) =>
            sameKey(item[board.columnField] as MlvTaskboardKey, columnId),
          ),
        ),
        groupById.get(groupId)?.wipLimit,
      );
    },
  };
}

export function applyMlvTaskboardMove<TItem>(
  board: MlvTaskboard<TItem>,
  request: MlvTaskboardMoveRequest<TItem> | undefined,
): MlvTaskboardMoveResult<TItem> | null {
  if (
    !request ||
    request.board !== board ||
    !Number.isInteger(request.target.index) ||
    request.target.index < 0
  )
    return null;
  const index = createMlvTaskboardIndex(board);
  const item = index.itemById.get(request.itemId);
  const sourceColumn = index.columnById.get(request.source.columnId);
  const targetColumn = index.columnById.get(request.target.columnId);
  const sourceLane =
    request.source.swimlaneId === undefined
      ? undefined
      : index.swimlaneById.get(request.source.swimlaneId);
  const targetLane =
    request.target.swimlaneId === undefined
      ? undefined
      : index.swimlaneById.get(request.target.swimlaneId);
  if (
    !item ||
    !sourceColumn ||
    !targetColumn ||
    (request.source.swimlaneId !== undefined && !sourceLane) ||
    (request.target.swimlaneId !== undefined && !targetLane)
  )
    return null;
  if (
    !sameKey(
      item[board.columnField] as MlvTaskboardKey,
      request.source.columnId,
    ) ||
    (board.swimlaneField &&
      !sameKey(
        item[board.swimlaneField] as MlvTaskboardKey,
        request.source.swimlaneId,
      ))
  )
    return null;
  if (
    board.lockedItemIds?.some((id) => sameKey(id, request.itemId)) ||
    sourceColumn.locked ||
    targetColumn.locked ||
    sourceLane?.locked ||
    targetLane?.locked
  )
    return null;
  if (
    board.transitions !== undefined &&
    !board.transitions.some(
      (transition) =>
        sameKey(transition.from, sourceColumn.id) &&
        sameKey(transition.to, targetColumn.id),
    )
  )
    return null;

  const sourceInTargetColumn = sameKey(sourceColumn.id, targetColumn.id);
  const columnWip = index.wipFor(targetColumn.id);
  const targetGroup =
    targetColumn.groupId === undefined
      ? undefined
      : index.groupById.get(targetColumn.groupId);
  const sourceInTargetGroup =
    targetGroup !== undefined && sameKey(sourceColumn.groupId, targetGroup.id);
  const groupWip =
    targetGroup === undefined ? undefined : index.groupWipFor(targetGroup.id);
  const laneWip =
    targetLane === undefined ? undefined : index.swimlaneWipFor(targetLane.id);
  if (
    (columnWip.limit !== undefined &&
      columnWip.count + (sourceInTargetColumn ? 0 : 1) > columnWip.limit) ||
    (groupWip?.limit !== undefined &&
      groupWip.count + (sourceInTargetGroup ? 0 : 1) > groupWip.limit) ||
    (laneWip?.limit !== undefined &&
      laneWip.count + (sameKey(sourceLane?.id, targetLane?.id) ? 0 : 1) >
        laneWip.limit)
  )
    return null;

  const targetItems = index.itemsFor(
    request.target.columnId,
    request.target.swimlaneId,
  );
  if (request.target.index > targetItems.length) return null;
  const currentPosition = board.items.findIndex((candidate) =>
    sameKey(itemKey(board, candidate), request.itemId),
  );
  if (currentPosition < 0) return null;
  const remaining = board.items.filter(
    (_candidate, position) => position !== currentPosition,
  );
  let insertionIndex: number;
  if (request.anchorId !== undefined) {
    const anchorIndex = remaining.findIndex((candidate) =>
      sameKey(itemKey(board, candidate), request.anchorId),
    );
    const anchor = index.itemById.get(request.anchorId);
    if (
      anchorIndex < 0 ||
      !anchor ||
      !sameKey(
        anchor[board.columnField] as MlvTaskboardKey,
        request.target.columnId,
      )
    )
      return null;
    insertionIndex = anchorIndex + 1;
  } else {
    const anchor = targetItems[request.target.index];
    insertionIndex =
      anchor === undefined
        ? remaining.length
        : remaining.findIndex((candidate) =>
            sameKey(itemKey(board, candidate), itemKey(board, anchor)),
          );
    if (insertionIndex < 0) return null;
  }
  const moved = {
    ...item,
    [board.columnField]: request.target.columnId,
    ...(board.swimlaneField === undefined
      ? {}
      : { [board.swimlaneField]: request.target.swimlaneId }),
  } as TItem;
  const items = [
    ...remaining.slice(0, insertionIndex),
    moved,
    ...remaining.slice(insertionIndex),
  ];
  return { items, item: moved, source: request.source, target: request.target };
}
