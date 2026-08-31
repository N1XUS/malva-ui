import type {
  MlvTileNodeWithChildren,
  MlvTileTreeNode,
  MlvTilesAccepts,
} from './tile-tree.types';

export interface MlvTileDragSession<TProps> {
  readonly root: MlvTileNodeWithChildren<TProps>;
  readonly draggedTile: MlvTileTreeNode<TProps>;
  readonly allowedTargetIds: ReadonlySet<string>;
  readonly nodeById: ReadonlyMap<string, MlvTileTreeNode<TProps>>;
  readonly parentById: ReadonlyMap<string, string>;
}

const NO_LOCKED_TARGET_IDS: ReadonlySet<string> = new Set<string>();

export function createMlvTileDragSession<TProps>(
  root: MlvTileNodeWithChildren<TProps>,
  draggedTileId: string,
  accepts: MlvTilesAccepts<TProps>,
  lockedTargetIds: ReadonlySet<string> = NO_LOCKED_TARGET_IDS,
): MlvTileDragSession<TProps> | null {
  const nodeById = new Map<string, MlvTileTreeNode<TProps>>();
  const parentById = new Map<string, string>();
  const containers: MlvTileNodeWithChildren<TProps>[] = [];
  const excludedTargetIds = new Set<string>();

  const indexNode = (
    node: MlvTileTreeNode<TProps>,
    parentId: string | undefined,
    isDraggedOrDescendant: boolean,
  ): boolean => {
    if (nodeById.has(node.id)) return false;

    const isExcluded = isDraggedOrDescendant || node.id === draggedTileId;
    nodeById.set(node.id, node);
    if (parentId !== undefined) parentById.set(node.id, parentId);
    if (isExcluded) excludedTargetIds.add(node.id);
    if (!node.acceptsChildren) return true;

    containers.push(node);
    return node.children.every((child) =>
      indexNode(child, node.id, isExcluded),
    );
  };

  if (!indexNode(root, undefined, false)) return null;

  const draggedTile = nodeById.get(draggedTileId);
  if (!draggedTile || draggedTile === root) return null;

  // Locked targets are excluded structurally, before any policy runs, so an
  // `accepts` callback returning `true` can never re-open a frozen subtree.
  for (const lockedTargetId of lockedTargetIds) {
    excludedTargetIds.add(lockedTargetId);
  }

  const allowedTargetIds = new Set<string>();
  for (const target of containers) {
    if (
      !excludedTargetIds.has(target.id) &&
      accepts(draggedTile, target, target.children)
    ) {
      allowedTargetIds.add(target.id);
    }
  }

  return {
    root,
    draggedTile,
    allowedTargetIds,
    nodeById,
    parentById,
  };
}

export function canEnterMlvTileTarget<TProps>(
  session: MlvTileDragSession<TProps> | null,
  targetTileId: string,
): boolean {
  return session?.allowedTargetIds.has(targetTileId) ?? false;
}
