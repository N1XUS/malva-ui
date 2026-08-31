import {
  canEnterMlvTileTarget,
  createMlvTileDragSession,
  type MlvTileDragSession,
} from './tile-drag-session';
import {
  insertMlvTileNode,
  moveMlvTileNode,
  removeMlvTileNode,
  updateMlvTileNodeProps,
} from './tile-tree-state';
import type {
  MlvTileInsertRequest,
  MlvTileMovedEvent,
  MlvTileMoveRequest,
  MlvTileNodeWithChildren,
  MlvTileTreeNode,
  MlvTilesAccepts,
} from './tile-tree.types';

export interface MlvTileContainerRegistration<TProps> {
  readonly id: string;
  readonly depth: number;
  readonly accepts: MlvTilesAccepts<TProps> | undefined;
  readonly locked: () => boolean;
  readonly canEnter: (allowed: boolean) => void;
}

/** @internal Cached per-drag container policy and structural lock snapshot. */
interface MlvTileContainerPolicyIndex<TProps> {
  readonly policyByContainerId: ReadonlyMap<string, MlvTilesAccepts<TProps>>;
  readonly lockedContainerIds: ReadonlySet<string>;
}

export interface MlvTileItemRegistration<TProps> {
  readonly id: string;
  readonly tile: () => MlvTileTreeNode<TProps>;
}

interface MlvTileTreeCoordinatorOptions<TProps> {
  readonly isRoot: boolean;
  readonly readRoot: () => MlvTileNodeWithChildren<TProps> | undefined;
  readonly setRoot: (root: MlvTileNodeWithChildren<TProps>) => void;
  readonly moved: (event: MlvTileMovedEvent) => void;
}

interface RegistrationEntry {
  readonly order: number;
  references: number;
}

const acceptEveryTile = (): true => true;

/** @internal Keyboard directions used by the compound Tile components. */
export type MlvTileKeyboardMoveDirection = 'up' | 'down' | 'left' | 'right';

function createKeyboardMoveRequest<TProps>(
  session: MlvTileDragSession<TProps> | null,
  direction: MlvTileKeyboardMoveDirection,
): MlvTileMoveRequest | null {
  if (!session) return null;

  const tileId = session.draggedTile.id;
  const sourceContainerId = session.parentById.get(tileId);
  if (sourceContainerId === undefined) return null;

  const source = session.nodeById.get(sourceContainerId);
  if (!source?.acceptsChildren) return null;

  const previousIndex = source.children.findIndex(({ id }) => id === tileId);
  if (previousIndex < 0) return null;

  if (direction === 'up' || direction === 'down') {
    const currentIndex = previousIndex + (direction === 'up' ? -1 : 1);
    if (
      currentIndex < 0 ||
      currentIndex >= source.children.length ||
      !session.allowedTargetIds.has(sourceContainerId)
    ) {
      return null;
    }

    return {
      tileId,
      sourceContainerId,
      targetContainerId: sourceContainerId,
      previousIndex,
      currentIndex,
    };
  }

  if (direction === 'left') {
    const targetContainerId = session.parentById.get(sourceContainerId);
    if (targetContainerId === undefined) return null;

    const target = session.nodeById.get(targetContainerId);
    if (
      !target?.acceptsChildren ||
      !session.allowedTargetIds.has(targetContainerId)
    ) {
      return null;
    }

    const sourceIndex = target.children.findIndex(
      ({ id }) => id === sourceContainerId,
    );
    if (sourceIndex < 0) return null;

    return {
      tileId,
      sourceContainerId,
      targetContainerId,
      previousIndex,
      currentIndex: sourceIndex + 1,
    };
  }

  // Prefer the nearest preceding eligible sibling container, then fall back to
  // the nearest following one so the first tile in a list can still indent.
  for (let index = previousIndex - 1; index >= 0; index -= 1) {
    const request = createIndentRequest(
      session,
      source.children[index],
      tileId,
      sourceContainerId,
      previousIndex,
    );
    if (request) return request;
  }

  for (
    let index = previousIndex + 1;
    index < source.children.length;
    index += 1
  ) {
    const request = createIndentRequest(
      session,
      source.children[index],
      tileId,
      sourceContainerId,
      previousIndex,
    );
    if (request) return request;
  }

  return null;
}

function createIndentRequest<TProps>(
  session: MlvTileDragSession<TProps>,
  target: MlvTileTreeNode<TProps>,
  tileId: string,
  sourceContainerId: string,
  previousIndex: number,
): MlvTileMoveRequest | null {
  if (!target.acceptsChildren || !session.allowedTargetIds.has(target.id)) {
    return null;
  }

  return {
    tileId,
    sourceContainerId,
    targetContainerId: target.id,
    previousIndex,
    currentIndex: target.children.length,
  };
}

function findParentContainerId<TProps>(
  root: MlvTileNodeWithChildren<TProps>,
  tileId: string,
): string | undefined {
  const visit = (
    container: MlvTileNodeWithChildren<TProps>,
  ): string | undefined => {
    for (const child of container.children) {
      if (child.id === tileId) return container.id;
      if (!child.acceptsChildren) continue;

      const match = visit(child);
      if (match !== undefined) return match;
    }

    return undefined;
  };

  return visit(root);
}

export class MlvTileTreeCoordinator<TProps> {
  private readonly _containers = new Map<
    MlvTileContainerRegistration<TProps>,
    RegistrationEntry
  >();
  private readonly _items = new Map<
    MlvTileItemRegistration<TProps>,
    RegistrationEntry
  >();
  private _activeSession: MlvTileDragSession<TProps> | null = null;
  private _registrationOrder = 0;

  constructor(
    private readonly _options: MlvTileTreeCoordinatorOptions<TProps>,
  ) {}

  bindTree(root: MlvTileNodeWithChildren<TProps>): void {
    if (!this._options.isRoot) {
      throw new Error('Nested mlv-tiles must inherit the root tree.');
    }

    this._options.setRoot(root);
  }

  start(): MlvTileNodeWithChildren<TProps> {
    const root = this._options.readRoot();
    if (!root && this._options.isRoot) {
      throw new Error('Root mlv-tiles requires [(tree)].');
    }
    if (!root) {
      throw new Error('Nested mlv-tiles must inherit the root tree.');
    }

    return root;
  }

  registerContainer(
    registration: MlvTileContainerRegistration<TProps>,
  ): () => void {
    const isNewRegistration = !this._containers.has(registration);
    this._retain(this._containers, registration);
    if (isNewRegistration && this._activeSession) {
      registration.canEnter(
        canEnterMlvTileTarget(this._activeSession, registration.id),
      );
    }
    let registered = true;

    return () => {
      if (!registered) return;
      registered = false;
      this._release(this._containers, registration);
    };
  }

  registerItem(registration: MlvTileItemRegistration<TProps>): () => void {
    this._retain(this._items, registration);
    let registered = true;

    return () => {
      if (!registered) return;
      registered = false;
      this._release(this._items, registration);
    };
  }

  targets(): readonly MlvTileContainerRegistration<TProps>[] {
    return [...this._containers.entries()]
      .sort(
        ([firstRegistration, firstEntry], [secondRegistration, secondEntry]) =>
          secondRegistration.depth - firstRegistration.depth ||
          firstEntry.order - secondEntry.order,
      )
      .map(([registration]) => registration);
  }

  item(id: string): MlvTileItemRegistration<TProps> | undefined {
    return [...this._items.keys()].find(
      (registration) => registration.id === id,
    );
  }

  activeSession(): MlvTileDragSession<TProps> | null {
    return this._activeSession;
  }

  startDrag(tileId: string): MlvTileDragSession<TProps> | null {
    const root = this.start();
    const { policyByContainerId, lockedContainerIds } =
      this._createPolicyIndex(root);
    const session = createMlvTileDragSession(
      root,
      tileId,
      (_draggedTile, targetTile, innerTiles) =>
        (policyByContainerId.get(targetTile.id) ?? acceptEveryTile)(
          _draggedTile,
          targetTile,
          innerTiles,
        ),
      lockedContainerIds,
    );

    this._activeSession = session;
    for (const target of this._containers.keys()) {
      target.canEnter(canEnterMlvTileTarget(session, target.id));
    }

    return session;
  }

  endDrag(): void {
    this._activeSession = null;
    for (const target of this._containers.keys()) target.canEnter(false);
  }

  moveByKeyboard(
    tileId: string,
    direction: MlvTileKeyboardMoveDirection,
  ): MlvTileMoveRequest | null {
    const session = this.startDrag(tileId);
    try {
      const request = createKeyboardMoveRequest(session, direction);
      return request && this.move(request) ? request : null;
    } finally {
      this.endDrag();
    }
  }

  move(request: MlvTileMoveRequest): boolean {
    const root = this.start();
    if (
      this._activeSession &&
      (this._activeSession.draggedTile.id !== request.tileId ||
        !canEnterMlvTileTarget(this._activeSession, request.targetContainerId))
    ) {
      return false;
    }

    const nextRoot = moveMlvTileNode(root, request);
    if (nextRoot === root) return false;

    this._options.setRoot(nextRoot);
    this._options.moved(request);
    return true;
  }

  insert(request: MlvTileInsertRequest<TProps>): boolean {
    const root = this.start();
    if (
      this._createPolicyIndex(root).lockedContainerIds.has(
        request.targetContainerId,
      )
    ) {
      return false;
    }

    const nextRoot = insertMlvTileNode(root, request);
    if (nextRoot === root) return false;

    this._options.setRoot(nextRoot);
    return true;
  }

  remove(tileId: string): boolean {
    const root = this.start();
    if (this._isLockedNode(root, tileId)) return false;

    const nextRoot = removeMlvTileNode(root, tileId);
    if (nextRoot === root) return false;

    this._options.setRoot(nextRoot);
    return true;
  }

  /**
   * @internal Whether a node is structurally frozen: it is itself a locked
   * container, or it sits directly inside one. Reads the same locked set the
   * drag session uses, so an unlocked container cannot reach into a locked
   * subtree by ID.
   */
  isLocked(tileId: string): boolean {
    let root: MlvTileNodeWithChildren<TProps>;
    try {
      root = this.start();
    } catch {
      return false;
    }

    return this._isLockedNode(root, tileId);
  }

  updateProps(tileId: string, update: (props: TProps) => TProps): boolean {
    const root = this.start();
    const nextRoot = updateMlvTileNodeProps(root, tileId, update);
    if (nextRoot === root) return false;

    this._options.setRoot(nextRoot);
    return true;
  }

  /** @private Resolves the structural lock for one node against the cached set. */
  private _isLockedNode(
    root: MlvTileNodeWithChildren<TProps>,
    tileId: string,
  ): boolean {
    const { lockedContainerIds } = this._createPolicyIndex(root);
    if (lockedContainerIds.has(tileId)) return true;

    const parentContainerId = findParentContainerId(root, tileId);
    return (
      parentContainerId !== undefined &&
      lockedContainerIds.has(parentContainerId)
    );
  }

  private _createPolicyIndex(
    root: MlvTileNodeWithChildren<TProps>,
  ): MlvTileContainerPolicyIndex<TProps> {
    const registrationById = new Map<
      string,
      MlvTileContainerRegistration<TProps>
    >();
    for (const registration of this._containers.keys()) {
      if (!registrationById.has(registration.id)) {
        registrationById.set(registration.id, registration);
      }
    }

    const policyByContainerId = new Map<string, MlvTilesAccepts<TProps>>();
    const lockedContainerIds = new Set<string>();
    const index = (
      node: MlvTileTreeNode<TProps>,
      inherited: MlvTilesAccepts<TProps>,
      inheritedLocked: boolean,
    ): void => {
      if (!node.acceptsChildren) return;

      const registration = registrationById.get(node.id);
      const policy = registration?.accepts ?? inherited;
      const locked = inheritedLocked || registration?.locked() === true;
      policyByContainerId.set(node.id, policy);
      if (locked) lockedContainerIds.add(node.id);
      for (const child of node.children) index(child, policy, locked);
    };

    index(root, acceptEveryTile, false);
    return { policyByContainerId, lockedContainerIds };
  }

  private _retain<TRegistration>(
    registrations: Map<TRegistration, RegistrationEntry>,
    registration: TRegistration,
  ): void {
    const current = registrations.get(registration);
    if (current) {
      current.references += 1;
      return;
    }

    registrations.set(registration, {
      order: this._registrationOrder,
      references: 1,
    });
    this._registrationOrder += 1;
  }

  private _release<TRegistration>(
    registrations: Map<TRegistration, RegistrationEntry>,
    registration: TRegistration,
  ): void {
    const current = registrations.get(registration);
    if (!current) return;

    current.references -= 1;
    if (current.references === 0) registrations.delete(registration);
  }
}
