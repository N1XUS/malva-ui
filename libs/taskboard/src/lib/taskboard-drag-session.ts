import {
  createMlvTaskboardIndex,
  type MlvTaskboardIndex,
} from './taskboard-state';
import {
  authorizeMlvTaskboardMoveRequest,
  beginMlvTaskboardDragAuthorization,
} from './taskboard-move-authorization';
import {
  mlvTaskboardKeyToken,
  sameMlvTaskboardKey as sameKey,
} from './taskboard-keys';
import type {
  MlvTaskboardState,
  MlvTaskboardCanDropFn,
  MlvTaskboardDenialReason,
  MlvTaskboardDropTarget,
  MlvTaskboardItemContext,
  MlvTaskboardKey,
  MlvTaskboardLocation,
  MlvTaskboardMoveRequest,
} from './taskboard.types';

const targetKey = (location: MlvTaskboardLocation): string =>
  `${mlvTaskboardKeyToken(location.columnId)}|${mlvTaskboardKeyToken(location.swimlaneId)}|${location.index}`;

export interface MlvTaskboardDragSession<TItem> {
  readonly card: MlvTaskboardItemContext<TItem>;
  readonly allowedLocationKeys: ReadonlySet<string>;
  /**
   * Why each refused slot refused the card, keyed by the same location token
   * {@link allowedLocationKeys} uses. A slot is in exactly one of the two: the
   * session records the first gate that failed while it enumerated the board,
   * so nothing has to re-derive a policy answer the session already reached.
   * The slot the card already occupies appears in neither.
   */
  readonly denials: ReadonlyMap<string, MlvTaskboardDenialReason>;
  canEnter(location: MlvTaskboardLocation): boolean;
  requestFor(
    columnId: MlvTaskboardKey,
    swimlaneId: MlvTaskboardKey | undefined,
    index: number,
  ): MlvTaskboardMoveRequest<TItem> | undefined;
  /**
   * The recorded reason one slot refused the card, or `undefined` when the
   * slot is allowed, is the one the card already fills, or is not a slot this
   * board offers at all.
   */
  denialFor(
    columnId: MlvTaskboardKey,
    swimlaneId: MlvTaskboardKey | undefined,
    index: number,
  ): MlvTaskboardDenialReason | undefined;
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
  board: MlvTaskboardState<TItem>,
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
  const denials = new Map<string, MlvTaskboardDenialReason>();
  const lanes = board.swimlanes?.length ? board.swimlanes : [undefined];
  const activeCanDropFn = canDropFn ?? board.canDropFn;
  beginMlvTaskboardDragAuthorization(board, activeCanDropFn !== undefined);

  for (const column of board.columns)
    for (const lane of lanes) {
      const renderedItems = index.itemsFor(column.id, lane?.id);
      const isSourceBucket =
        sameKey(column.id, source.columnId) &&
        sameKey(lane?.id, source.swimlaneId);
      // A target index counts the destination bucket's rendered cards with the
      // dragged card removed, and `MlvTaskboardDropTarget.items` is that same
      // remaining list — so the source bucket offers one slot fewer and every
      // policy sees the cards the index it is handed actually counts.
      const remainingItems = isSourceBucket
        ? renderedItems.filter(
            (candidate) =>
              !sameKey(candidate[board.dataKey] as MlvTaskboardKey, itemId),
          )
        : renderedItems;
      for (
        let targetIndex = 0;
        targetIndex <= remainingItems.length;
        targetIndex++
      ) {
        if (isSourceBucket && targetIndex === source.index) continue;
        const target: MlvTaskboardDropTarget<TItem> = {
          column,
          swimlane: lane,
          index: targetIndex,
          items: remainingItems,
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
        const wipAllowed = permittedByWip(index, card, target);
        // The callback is consulted for every enumerated slot, whatever the
        // board's own gates answered, so a policy that counts its calls sees
        // the same board it always has.
        const callbackAllowed = activeCanDropFn?.(card, target) ?? true;
        const location: MlvTaskboardLocation = {
          columnId: column.id,
          swimlaneId: lane?.id,
          index: targetIndex,
        };
        const key = targetKey(location);
        // One pass records both answers: the reason a refused slot refused is
        // the first gate that failed here, so no consumer re-derives it from
        // the board and disagrees with the session it is describing.
        const denial: MlvTaskboardDenialReason | undefined = !unlocked
          ? 'locked'
          : !transitionAllowed
            ? 'transition'
            : !wipAllowed
              ? 'wip'
              : !callbackAllowed
                ? 'policy'
                : undefined;
        if (denial !== undefined) {
          denials.set(key, denial);
          continue;
        }
        allowedLocationKeys.add(key);
        const request: MlvTaskboardMoveRequest<TItem> = Object.freeze({
          board,
          itemId,
          source: Object.freeze({ ...source }),
          target: Object.freeze({ ...location }),
        });
        authorizeMlvTaskboardMoveRequest(request);
        requests.set(key, request);
      }
    }
  return {
    card,
    allowedLocationKeys,
    denials,
    canEnter: (location) => allowedLocationKeys.has(targetKey(location)),
    requestFor: (columnId, swimlaneId, targetIndex) =>
      requests.get(targetKey({ columnId, swimlaneId, index: targetIndex })),
    denialFor: (columnId, swimlaneId, targetIndex) =>
      denials.get(targetKey({ columnId, swimlaneId, index: targetIndex })),
  };
}
