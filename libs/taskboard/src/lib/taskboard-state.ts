import type {
  MlvTaskboardState,
  MlvTaskboardColumn,
  MlvTaskboardDropTarget,
  MlvTaskboardItemContext,
  MlvTaskboardKey,
  MlvTaskboardMoveRequest,
  MlvTaskboardMoveResult,
  MlvTaskboardSwimlane,
  MlvTaskboardWipState,
} from './taskboard.types';
import {
  mlvTaskboardBucketToken,
  mlvTaskboardKeyToken,
  sameMlvTaskboardKey as sameKey,
} from './taskboard-keys';
import {
  isMlvTaskboardMoveRequestAuthorized,
  requiresMlvTaskboardSessionAuthorization,
} from './taskboard-move-authorization';

/** Shared empty bucket so a lookup miss keeps a stable array identity. */
const EMPTY_BUCKET: readonly never[] = Object.freeze([]);

function validateUnique<T extends { readonly id: MlvTaskboardKey }>(
  values: readonly T[],
  label: string,
): void {
  const known = new Set<string>();
  for (const value of values) {
    const key = mlvTaskboardKeyToken(value.id);
    if (known.has(key))
      throw new Error(`Duplicate taskboard ${label} id: ${String(value.id)}`);
    known.add(key);
  }
}

function itemKey<TItem>(
  board: MlvTaskboardState<TItem>,
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

/** Appends one item to the bucket addressed by `token`, creating it on demand. */
function appendToBucket<TItem>(
  buckets: Map<string, TItem[]>,
  token: string,
  item: TItem,
): void {
  const bucket = buckets.get(token);
  if (bucket) bucket.push(item);
  else buckets.set(token, [item]);
}

/** Increments the canonical card count addressed by `token`. */
function countInto(counts: Map<string, number>, token: string): void {
  counts.set(token, (counts.get(token) ?? 0) + 1);
}

export interface MlvTaskboardIndex<TItem> {
  readonly board: MlvTaskboardState<TItem>;
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
  board: MlvTaskboardState<TItem>,
): MlvTaskboardIndex<TItem> {
  if ((board.swimlanes?.length ?? 0) > 0 && board.swimlaneField === undefined) {
    throw new Error('Taskboard swimlanes require a swimlaneField.');
  }
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
  const bucketCounts = new Map<string, number>();
  const swimlaneCounts = new Map<string, number>();
  for (const item of board.items) {
    const id = itemKey(board, item);
    const key = mlvTaskboardKeyToken(id);
    if (canonicalKeys.has(key))
      throw new Error(`Duplicate taskboard item key: ${String(id)}`);
    canonicalKeys.add(key);
    itemById.set(id, item);
    const columnId = item[board.columnField] as MlvTaskboardKey;
    if (!columnById.has(columnId)) {
      throw new Error(`Unknown taskboard column id: ${String(columnId)}`);
    }
    countInto(bucketCounts, mlvTaskboardBucketToken(columnId));
    if (board.swimlaneField !== undefined) {
      const swimlaneId = item[board.swimlaneField] as MlvTaskboardKey;
      if (!swimlaneById.has(swimlaneId)) {
        throw new Error(`Unknown taskboard swimlane id: ${String(swimlaneId)}`);
      }
      countInto(bucketCounts, mlvTaskboardBucketToken(columnId, swimlaneId));
      countInto(swimlaneCounts, mlvTaskboardKeyToken(swimlaneId));
    }
  }

  const visibleItems = board.visibleItems ?? board.items;
  const visibleKeys = new Set<string>();
  const visibleBuckets = new Map<string, TItem[]>();
  for (const item of visibleItems) {
    const id = itemKey(board, item);
    const key = mlvTaskboardKeyToken(id);
    if (!canonicalKeys.has(key))
      throw new Error(
        `Visible taskboard item key is not canonical: ${String(id)}`,
      );
    if (visibleKeys.has(key))
      throw new Error(`Duplicate visible taskboard item key: ${String(id)}`);
    visibleKeys.add(key);
    const columnId = item[board.columnField] as MlvTaskboardKey;
    appendToBucket(visibleBuckets, mlvTaskboardBucketToken(columnId), item);
    if (board.swimlaneField !== undefined) {
      const swimlaneId = item[board.swimlaneField] as MlvTaskboardKey;
      appendToBucket(
        visibleBuckets,
        mlvTaskboardBucketToken(columnId, swimlaneId),
        item,
      );
    }
  }
  for (const bucket of visibleBuckets.values()) Object.freeze(bucket);

  const wipState = (
    count: number,
    limit: number | undefined,
  ): MlvTaskboardWipState =>
    Object.freeze({
      count,
      limit,
      remaining: limit === undefined ? undefined : limit - count,
    });

  const bucketWipCache = new Map<string, MlvTaskboardWipState>();
  const swimlaneWipCache = new Map<string, MlvTaskboardWipState>();
  const groupWipCache = new Map<string, MlvTaskboardWipState>();

  return {
    board,
    itemById,
    columnById,
    groupById,
    swimlaneById,
    visibleItems,
    itemsFor: (columnId, swimlaneId) =>
      visibleBuckets.get(mlvTaskboardBucketToken(columnId, swimlaneId)) ??
      (EMPTY_BUCKET as readonly TItem[]),
    wipFor: (columnId, swimlaneId) => {
      const token = mlvTaskboardBucketToken(columnId, swimlaneId);
      const cached = bucketWipCache.get(token);
      if (cached) return cached;
      const state = wipState(
        bucketCounts.get(token) ?? 0,
        columnById.get(columnId)?.wipLimit,
      );
      bucketWipCache.set(token, state);
      return state;
    },
    swimlaneWipFor: (swimlaneId) => {
      const token = mlvTaskboardKeyToken(swimlaneId);
      const cached = swimlaneWipCache.get(token);
      if (cached) return cached;
      const state = wipState(
        swimlaneCounts.get(token) ?? 0,
        swimlaneById.get(swimlaneId)?.wipLimit,
      );
      swimlaneWipCache.set(token, state);
      return state;
    },
    groupWipFor: (groupId) => {
      const token = mlvTaskboardKeyToken(groupId);
      const cached = groupWipCache.get(token);
      if (cached) return cached;
      let count = 0;
      for (const column of board.columns) {
        if (!sameKey(column.groupId, groupId)) continue;
        count += bucketCounts.get(mlvTaskboardBucketToken(column.id)) ?? 0;
      }
      const state = wipState(count, groupById.get(groupId)?.wipLimit);
      groupWipCache.set(token, state);
      return state;
    },
  };
}

export function applyMlvTaskboardMove<TItem>(
  board: MlvTaskboardState<TItem>,
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
    board.swimlaneField !== undefined &&
    (request.source.swimlaneId === undefined ||
      request.target.swimlaneId === undefined)
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
  // `target.index` is the moved card's final position among the destination
  // bucket's visible cards *with the moved card removed*, so a same-bucket
  // reorder spans `0..len-1` and a cross-bucket drop spans `0..len`.
  const remainingTargetItems = targetItems.filter(
    (candidate) => !sameKey(itemKey(board, candidate), request.itemId),
  );
  if (request.target.index > remainingTargetItems.length) return null;
  const sourceItems = index.itemsFor(
    request.source.columnId,
    request.source.swimlaneId,
  );
  if (
    sourceItems[request.source.index] === undefined ||
    !sameKey(itemKey(board, sourceItems[request.source.index]), request.itemId)
  )
    return null;
  const card: MlvTaskboardItemContext<TItem> = {
    item,
    id: request.itemId,
    source: request.source,
    selected: board.selectedIds?.has(request.itemId) ?? false,
  };
  const target: MlvTaskboardDropTarget<TItem> = {
    column: targetColumn,
    swimlane: targetLane,
    index: request.target.index,
    // The same remaining list the drag session hands its policies, so a forged
    // request and a session-authorised one describe the target identically.
    items: remainingTargetItems,
    wip: index.wipFor(request.target.columnId, request.target.swimlaneId),
  };
  const sessionAuthorized = isMlvTaskboardMoveRequestAuthorized(request);
  if (requiresMlvTaskboardSessionAuthorization(board) && !sessionAuthorized)
    return null;
  if (
    !sessionAuthorized &&
    board.canDropFn !== undefined &&
    !board.canDropFn(card, target)
  )
    return null;
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
    const anchor = remainingTargetItems[request.target.index];
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
