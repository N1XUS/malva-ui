import type {
  MlvTileInsertRequest,
  MlvTileMoveRequest,
  MlvTileNodeWithChildren,
  MlvTileTreeNode,
} from './tile-tree.types';

interface MlvTileTreeIndex<TProps> {
  readonly nodeById: ReadonlyMap<string, MlvTileTreeNode<TProps>>;
  readonly containerById: ReadonlyMap<string, MlvTileNodeWithChildren<TProps>>;
  readonly parentById: ReadonlyMap<string, string>;
}

export function moveMlvTileNode<TProps>(
  root: MlvTileNodeWithChildren<TProps>,
  request: MlvTileMoveRequest,
): MlvTileNodeWithChildren<TProps> {
  if (
    request.sourceContainerId === request.targetContainerId &&
    request.previousIndex === request.currentIndex
  ) {
    return root;
  }

  const index = createMlvTileTreeIndex(root);
  if (!index || request.tileId === root.id) return root;

  const tile = index.nodeById.get(request.tileId);
  const source = index.containerById.get(request.sourceContainerId);
  const target = index.containerById.get(request.targetContainerId);
  if (
    !tile ||
    !source ||
    !target ||
    source.children[request.previousIndex] !== tile ||
    isSameOrDescendant(index.parentById, tile.id, target.id) ||
    !hasValidTargetIndex(source, target, request.currentIndex)
  ) {
    return root;
  }

  const changedChildrenById = new Map<
    string,
    readonly MlvTileTreeNode<TProps>[]
  >();
  if (source.id === target.id) {
    changedChildrenById.set(
      source.id,
      moveInContainer(
        source.children,
        request.previousIndex,
        request.currentIndex,
      ),
    );
  } else {
    changedChildrenById.set(
      source.id,
      removeFromContainer(source.children, request.previousIndex),
    );
    changedChildrenById.set(
      target.id,
      insertIntoContainer(target.children, request.currentIndex, tile),
    );
  }

  return rebuildAffectedTree(
    root,
    changedChildrenById,
    collectAffectedContainerIds(index.parentById, source.id, target.id),
  );
}

export function insertMlvTileNode<TProps>(
  root: MlvTileNodeWithChildren<TProps>,
  request: MlvTileInsertRequest<TProps>,
): MlvTileNodeWithChildren<TProps> {
  const index = createMlvTileTreeIndex(root);
  if (!index) return root;

  const target = index.containerById.get(request.targetContainerId);
  if (!target) return root;

  const targetIndex = request.index ?? target.children.length;
  if (
    !Number.isInteger(targetIndex) ||
    targetIndex < 0 ||
    targetIndex > target.children.length ||
    !hasUnusedSubtreeIds(request.tile, index.nodeById)
  ) {
    return root;
  }

  return rebuildAffectedTree(
    root,
    new Map([
      [
        target.id,
        insertIntoContainer(target.children, targetIndex, request.tile),
      ],
    ]),
    collectAffectedContainerIds(index.parentById, target.id),
  );
}

export function removeMlvTileNode<TProps>(
  root: MlvTileNodeWithChildren<TProps>,
  tileId: string,
): MlvTileNodeWithChildren<TProps> {
  if (tileId === root.id) return root;

  const index = createMlvTileTreeIndex(root);
  const tile = index?.nodeById.get(tileId);
  if (!index || !tile) return root;

  const parentId = index.parentById.get(tile.id);
  const parent =
    parentId !== undefined ? index.containerById.get(parentId) : undefined;
  if (!parent) return root;

  const tileIndex = parent.children.indexOf(tile);
  if (tileIndex < 0) return root;

  return rebuildAffectedTree(
    root,
    new Map([[parent.id, removeFromContainer(parent.children, tileIndex)]]),
    collectAffectedContainerIds(index.parentById, parent.id),
  );
}

export function updateMlvTileNodeProps<TProps>(
  root: MlvTileNodeWithChildren<TProps>,
  tileId: string,
  update: (props: TProps) => TProps,
): MlvTileNodeWithChildren<TProps> {
  if (tileId === root.id) return root;

  const index = createMlvTileTreeIndex(root);
  const tile = index?.nodeById.get(tileId);
  if (!index || !tile) return root;

  const nextProps = update(tile.props);
  if (nextProps === tile.props) return root;

  const parentId = index.parentById.get(tile.id);
  const parent =
    parentId !== undefined ? index.containerById.get(parentId) : undefined;
  if (!parent) return root;

  const tileIndex = parent.children.indexOf(tile);
  if (tileIndex < 0) return root;

  const children = [...parent.children];
  children[tileIndex] = {
    ...tile,
    props: nextProps,
  } as MlvTileTreeNode<TProps>;

  return rebuildAffectedTree(
    root,
    new Map([[parent.id, children]]),
    collectAffectedContainerIds(index.parentById, parent.id),
  );
}

function createMlvTileTreeIndex<TProps>(
  root: MlvTileNodeWithChildren<TProps>,
): MlvTileTreeIndex<TProps> | null {
  const nodeById = new Map<string, MlvTileTreeNode<TProps>>();
  const containerById = new Map<string, MlvTileNodeWithChildren<TProps>>();
  const parentById = new Map<string, string>();

  const indexNode = (
    node: MlvTileTreeNode<TProps>,
    parentId: string | undefined,
  ): boolean => {
    if (nodeById.has(node.id)) return false;

    nodeById.set(node.id, node);
    if (parentId !== undefined) parentById.set(node.id, parentId);
    if (!node.acceptsChildren) return true;

    containerById.set(node.id, node);
    return node.children.every((child) => indexNode(child, node.id));
  };

  return indexNode(root, undefined)
    ? { nodeById, containerById, parentById }
    : null;
}

function hasUnusedSubtreeIds<TProps>(
  node: MlvTileTreeNode<TProps>,
  existingNodeById: ReadonlyMap<string, MlvTileTreeNode<TProps>>,
): boolean {
  const insertedIds = new Set<string>();
  const visit = (current: MlvTileTreeNode<TProps>): boolean => {
    if (existingNodeById.has(current.id) || insertedIds.has(current.id)) {
      return false;
    }

    insertedIds.add(current.id);
    return current.acceptsChildren ? current.children.every(visit) : true;
  };

  return visit(node);
}

function hasValidTargetIndex<TProps>(
  source: MlvTileNodeWithChildren<TProps>,
  target: MlvTileNodeWithChildren<TProps>,
  currentIndex: number,
): boolean {
  const maximumIndex =
    source.id === target.id
      ? target.children.length - 1
      : target.children.length;

  return (
    Number.isInteger(currentIndex) &&
    currentIndex >= 0 &&
    currentIndex <= maximumIndex
  );
}

function isSameOrDescendant(
  parentById: ReadonlyMap<string, string>,
  tileId: string,
  targetId: string,
): boolean {
  let currentId: string | undefined = targetId;
  while (currentId !== undefined) {
    if (currentId === tileId) return true;
    currentId = parentById.get(currentId);
  }

  return false;
}

function moveInContainer<T>(
  items: readonly T[],
  previousIndex: number,
  currentIndex: number,
): readonly T[] {
  const result = [...items];
  const [item] = result.splice(previousIndex, 1);
  result.splice(currentIndex, 0, item);
  return result;
}

function removeFromContainer<T>(
  items: readonly T[],
  index: number,
): readonly T[] {
  return [...items.slice(0, index), ...items.slice(index + 1)];
}

function insertIntoContainer<T>(
  items: readonly T[],
  index: number,
  item: T,
): readonly T[] {
  return [...items.slice(0, index), item, ...items.slice(index)];
}

function collectAffectedContainerIds(
  parentById: ReadonlyMap<string, string>,
  ...containerIds: readonly string[]
): ReadonlySet<string> {
  const affectedIds = new Set<string>();

  for (const containerId of containerIds) {
    let currentId: string | undefined = containerId;
    while (currentId !== undefined) {
      affectedIds.add(currentId);
      currentId = parentById.get(currentId);
    }
  }

  return affectedIds;
}

function rebuildAffectedTree<TProps>(
  node: MlvTileNodeWithChildren<TProps>,
  changedChildrenById: ReadonlyMap<string, readonly MlvTileTreeNode<TProps>[]>,
  affectedContainerIds: ReadonlySet<string>,
): MlvTileNodeWithChildren<TProps> {
  if (!affectedContainerIds.has(node.id)) return node;

  const originalChildren = changedChildrenById.get(node.id) ?? node.children;
  let children: readonly MlvTileTreeNode<TProps>[] = originalChildren;

  for (
    let childIndex = 0;
    childIndex < originalChildren.length;
    childIndex += 1
  ) {
    const child = originalChildren[childIndex];
    if (!child.acceptsChildren || !affectedContainerIds.has(child.id)) continue;

    const rebuiltChild = rebuildAffectedTree(
      child,
      changedChildrenById,
      affectedContainerIds,
    );
    if (rebuiltChild === child) continue;

    if (children === originalChildren) children = [...originalChildren];
    (children as MlvTileTreeNode<TProps>[])[childIndex] = rebuiltChild;
  }

  return children === node.children ? node : { ...node, children };
}
