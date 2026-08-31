export interface MlvTileNode<TProps, TAcceptsChildren extends boolean> {
  readonly id: string;
  readonly acceptsChildren: TAcceptsChildren;
  readonly props: TProps;
}

export interface MlvTileNodeWithChildren<TProps>
  extends MlvTileNode<TProps, true> {
  readonly children: readonly MlvTileTreeNode<TProps>[];
}

export interface MlvTileNodeLeaf<TProps> extends MlvTileNode<TProps, false> {
  readonly children?: never;
}

export type MlvTileTreeNode<TProps> =
  | MlvTileNodeWithChildren<TProps>
  | MlvTileNodeLeaf<TProps>;

export type MlvTilesAccepts<TProps> = (
  draggedTile: MlvTileTreeNode<TProps>,
  targetTile: MlvTileNodeWithChildren<TProps>,
  innerTiles: readonly MlvTileTreeNode<TProps>[],
) => boolean;

export type MlvTilesLayout = 'list' | 'grid';

export interface MlvTileMovedEvent {
  readonly tileId: string;
  readonly sourceContainerId: string;
  readonly targetContainerId: string;
  readonly previousIndex: number;
  readonly currentIndex: number;
}

export interface MlvTileMoveRequest {
  readonly tileId: string;
  readonly sourceContainerId: string;
  readonly targetContainerId: string;
  readonly previousIndex: number;
  readonly currentIndex: number;
}

/** Request consumed by the immutable insert helper and the compound insert APIs. */
export interface MlvTileInsertRequest<TProps> {
  /** Container that receives the node. */
  readonly targetContainerId: string;
  /** Node to insert. Neither it nor any node in its subtree may reuse an existing ID. */
  readonly tile: MlvTileTreeNode<TProps>;
  /** Position among the target's direct children. Omitted appends. */
  readonly index?: number;
}

/**
 * Narrows a tree node to its container form.
 *
 * @param node - Any node of a Tile tree.
 * @returns `true` when the node accepts children, narrowing it to `MlvTileNodeWithChildren`.
 */
export function isMlvTileContainer<TProps>(
  node: MlvTileTreeNode<TProps>,
): node is MlvTileNodeWithChildren<TProps> {
  return node.acceptsChildren;
}
