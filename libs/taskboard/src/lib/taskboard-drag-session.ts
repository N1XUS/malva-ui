import {
  createMlvTaskboardIndex,
  type MlvTaskboardIndex,
} from './taskboard-state';
import type {
  MlvTaskboard,
  MlvTaskboardCanDropFn,
  MlvTaskboardDropTarget,
  MlvTaskboardItemContext,
  MlvTaskboardKey,
  MlvTaskboardLocation,
  MlvTaskboardMoveRequest,
} from './taskboard.types';

export type { MlvTaskboard, MlvTaskboardCanDropFn } from './taskboard.types';

const targetKey = (location: MlvTaskboardLocation): string =>
  `${typeof location.columnId}:${String(location.columnId)}|${location.swimlaneId === undefined ? '' : `${typeof location.swimlaneId}:${String(location.swimlaneId)}`}|${location.index}`;
const sameKey = (
  left: MlvTaskboardKey | undefined,
  right: MlvTaskboardKey | undefined,
): boolean => typeof left === typeof right && left === right;

export interface MlvTaskboardDragSession<TItem> {
  readonly card: MlvTaskboardItemContext<TItem>;
  readonly allowedLocationKeys: ReadonlySet<string>;
  canEnter(location: MlvTaskboardLocation): boolean;
  requestFor(
    columnId: MlvTaskboardKey,
    swimlaneId: MlvTaskboardKey | undefined,
    index: number,
  ): MlvTaskboardMoveRequest<TItem> | undefined;
}

function permittedByWip<TItem>(
  index: MlvTaskboardIndex<TItem>,
  card: MlvTaskboardItemContext<TItem>,
  target: MlvTaskboardDropTarget<TItem>,
): boolean {
  const sourceColumn = card.source.columnId;
  const targetColumn = target.column.id;
  const columnWip = index.wipFor(targetColumn);
  const group =
    target.column.groupId === undefined
      ? undefined
      : index.groupById.get(target.column.groupId);
  const groupWip =
    group === undefined ? undefined : index.groupWipFor(group.id);
  const laneWip =
    target.swimlane === undefined
      ? undefined
      : index.swimlaneWipFor(target.swimlane.id);
  const sourceInTargetColumn = sameKey(sourceColumn, targetColumn);
  const sourceInTargetGroup =
    target.column.groupId !== undefined &&
    sameKey(index.columnById.get(sourceColumn)?.groupId, target.column.groupId);
  return (
    (columnWip.limit === undefined ||
      columnWip.count + (sourceInTargetColumn ? 0 : 1) <= columnWip.limit) &&
    (groupWip?.limit === undefined ||
      groupWip.count + (sourceInTargetGroup ? 0 : 1) <= groupWip.limit) &&
    (laneWip?.limit === undefined ||
      laneWip.count +
        (sameKey(card.source.swimlaneId, target.swimlane?.id) ? 0 : 1) <=
        laneWip.limit)
  );
}

export function createMlvTaskboardDragSession<TItem>(
  board: MlvTaskboard<TItem>,
  itemId: MlvTaskboardKey,
  canDropFn?: MlvTaskboardCanDropFn<TItem>,
): MlvTaskboardDragSession<TItem> {
  const index = createMlvTaskboardIndex(board);
  const item = index.itemById.get(itemId);
  if (!item) throw new Error(`Unknown taskboard item key: ${String(itemId)}`);
  const sourceColumnId = item[board.columnField] as MlvTaskboardKey;
  const sourceLaneId =
    board.swimlaneField === undefined
      ? undefined
      : (item[board.swimlaneField] as MlvTaskboardKey);
  const sourceItems = index.itemsFor(sourceColumnId, sourceLaneId);
  const source: MlvTaskboardLocation = {
    columnId: sourceColumnId,
    swimlaneId: sourceLaneId,
    index: sourceItems.findIndex((candidate) =>
      sameKey(candidate[board.dataKey] as MlvTaskboardKey, itemId),
    ),
  };
  const card: MlvTaskboardItemContext<TItem> = {
    item,
    id: itemId,
    source,
    selected: board.selectedIds?.has(itemId) ?? false,
  };
  const allowedLocationKeys = new Set<string>();
  const requests = new Map<string, MlvTaskboardMoveRequest<TItem>>();
  const lanes = board.swimlanes?.length ? board.swimlanes : [undefined];
  const activeCanDropFn = canDropFn ?? board.canDropFn;

  for (const column of board.columns)
    for (const lane of lanes) {
      const renderedItems = index.itemsFor(column.id, lane?.id);
      for (
        let targetIndex = 0;
        targetIndex <= renderedItems.length;
        targetIndex++
      ) {
        if (
          sameKey(column.id, source.columnId) &&
          sameKey(lane?.id, source.swimlaneId) &&
          targetIndex === source.index
        )
          continue;
        const target: MlvTaskboardDropTarget<TItem> = {
          column,
          swimlane: lane,
          index: targetIndex,
          items: renderedItems,
          wip: index.wipFor(column.id, lane?.id),
        };
        const sourceColumn = index.columnById.get(source.columnId);
        const transitionAllowed =
          board.transitions === undefined ||
          board.transitions.some(
            (transition) =>
              sameKey(transition.from, source.columnId) &&
              sameKey(transition.to, column.id),
          );
        const sourceLane =
          source.swimlaneId === undefined
            ? undefined
            : index.swimlaneById.get(source.swimlaneId);
        const unlocked = !(
          board.lockedItemIds?.some((id) => sameKey(id, itemId)) ||
          sourceColumn?.locked ||
          column.locked ||
          sourceLane?.locked ||
          lane?.locked
        );
        const policyAllowed =
          unlocked && transitionAllowed && permittedByWip(index, card, target);
        const callbackAllowed = activeCanDropFn?.(card, target) ?? true;
        const allowed = policyAllowed && callbackAllowed;
        if (!allowed) continue;
        const location: MlvTaskboardLocation = {
          columnId: column.id,
          swimlaneId: lane?.id,
          index: targetIndex,
        };
        const key = targetKey(location);
        allowedLocationKeys.add(key);
        requests.set(key, {
          board,
          itemId,
          source,
          target: location,
          canDropFn: activeCanDropFn,
        });
      }
    }
  return {
    card,
    allowedLocationKeys,
    canEnter: (location) => allowedLocationKeys.has(targetKey(location)),
    requestFor: (columnId, swimlaneId, targetIndex) =>
      requests.get(targetKey({ columnId, swimlaneId, index: targetIndex })),
  };
}
