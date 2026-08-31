import { describe, expect, it, vi } from 'vitest';

import type {
  MlvTileNodeWithChildren,
  MlvTileTreeNode,
  MlvTilesAccepts,
} from './tile-tree.types';
import {
  MlvTileTreeCoordinator,
  type MlvTileContainerRegistration,
  type MlvTileItemRegistration,
} from './tile-tree-coordinator';

interface TestProps {
  readonly title: string;
  readonly type: 'page' | 'row' | 'block';
}

const root: MlvTileNodeWithChildren<TestProps> = {
  id: 'page',
  acceptsChildren: true,
  props: { title: 'Page', type: 'page' },
  children: [
    {
      id: 'row-a',
      acceptsChildren: true,
      props: { title: 'A', type: 'row' },
      children: [
        {
          id: 'hero',
          acceptsChildren: false,
          props: { title: 'Hero', type: 'block' },
        },
      ],
    },
    {
      id: 'row-b',
      acceptsChildren: true,
      props: { title: 'B', type: 'row' },
      children: [],
    },
  ],
};

function createCoordinator(
  initialRoot: MlvTileNodeWithChildren<TestProps> | undefined = root,
  moved = vi.fn(),
): {
  readonly coordinator: MlvTileTreeCoordinator<TestProps>;
  readonly read: () => MlvTileNodeWithChildren<TestProps> | undefined;
  readonly writes: ReturnType<typeof vi.fn>;
} {
  let currentRoot = initialRoot;
  const writes = vi.fn((nextRoot: MlvTileNodeWithChildren<TestProps>) => {
    currentRoot = nextRoot;
  });

  return {
    coordinator: new MlvTileTreeCoordinator({
      isRoot: true,
      readRoot: () => currentRoot,
      setRoot: writes,
      moved,
    }),
    read: () => currentRoot,
    writes,
  };
}

function container(
  id: string,
  depth: number,
  accepts?: MlvTilesAccepts<TestProps>,
  locked = false,
): MlvTileContainerRegistration<TestProps> & {
  readonly states: boolean[];
} {
  const states: boolean[] = [];
  return {
    id,
    depth,
    accepts,
    locked: () => locked,
    canEnter: (allowed) => states.push(allowed),
    states,
  };
}

function item(
  tile: MlvTileTreeNode<TestProps>,
): MlvTileItemRegistration<TestProps> {
  return { id: tile.id, tile: () => tile };
}

function findNode(
  node: MlvTileTreeNode<TestProps>,
  id: string,
): MlvTileTreeNode<TestProps> | undefined {
  if (node.id === id) return node;
  if (!node.acceptsChildren) return undefined;

  for (const child of node.children) {
    const match = findNode(child, id);
    if (match) return match;
  }

  return undefined;
}

describe('MlvTileTreeCoordinator', () => {
  it('rejects a nested tree binding and an unbound root start', () => {
    const nested = new MlvTileTreeCoordinator<TestProps>({
      isRoot: false,
      readRoot: () => root,
      setRoot: vi.fn(),
      moved: vi.fn(),
    });
    const orphan = new MlvTileTreeCoordinator<TestProps>({
      isRoot: true,
      readRoot: () => undefined,
      setRoot: vi.fn(),
      moved: vi.fn(),
    });

    expect(() => nested.bindTree(root)).toThrowError(
      /Nested mlv-tiles must inherit the root tree/,
    );
    expect(() => orphan.start()).toThrowError(
      /Root mlv-tiles requires \[\(tree\)\]/,
    );
  });

  it('registers containers and items idempotently and unregisters once', () => {
    const { coordinator } = createCoordinator();
    const rootContainer = container('page', 0);
    const hero = item(
      root.children[0].acceptsChildren
        ? root.children[0].children[0]
        : root.children[0],
    );

    const removeContainer = coordinator.registerContainer(rootContainer);
    const removeDuplicateContainer =
      coordinator.registerContainer(rootContainer);
    const removeItem = coordinator.registerItem(hero);
    const removeDuplicateItem = coordinator.registerItem(hero);

    expect(coordinator.targets()).toEqual([rootContainer]);
    expect(coordinator.item('hero')).toBe(hero);

    removeDuplicateContainer();
    removeDuplicateContainer();
    removeDuplicateItem();
    removeDuplicateItem();

    expect(coordinator.targets()).toEqual([rootContainer]);
    expect(coordinator.item('hero')).toBe(hero);

    removeContainer();
    removeContainer();
    removeItem();
    removeItem();

    expect(coordinator.targets()).toEqual([]);
    expect(coordinator.item('hero')).toBeUndefined();
  });

  it('orders pointer targets deepest first and preserves peer registration order', () => {
    const { coordinator } = createCoordinator();
    const rootContainer = container('page', 0);
    const firstPeer = container('row-a', 1);
    const deepest = container('nested', 2);
    const secondPeer = container('row-b', 1);

    coordinator.registerContainer(rootContainer);
    coordinator.registerContainer(firstPeer);
    coordinator.registerContainer(deepest);
    coordinator.registerContainer(secondPeer);

    expect(coordinator.targets()).toEqual([
      deepest,
      firstPeer,
      secondPeer,
      rootContainer,
    ]);
  });

  it('keeps one cached drag session and inherits the nearest target policy', () => {
    const inherited = vi.fn(() => true);
    const nearest = vi.fn(() => false);
    const { coordinator } = createCoordinator();
    const page = container('page', 0, inherited);
    const rowA = container('row-a', 1, nearest);
    const rowB = container('row-b', 1);

    coordinator.registerContainer(page);
    coordinator.registerContainer(rowA);
    coordinator.registerContainer(rowB);

    const first = coordinator.startDrag('hero');
    const second = coordinator.startDrag('row-a');

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(coordinator.activeSession()).toBe(second);
    expect(nearest).toHaveBeenCalledTimes(1);
    expect(inherited).toHaveBeenCalledTimes(4);
    expect(rowA.states).toEqual([false, false]);
    expect(rowB.states).toEqual([true, true]);

    coordinator.endDrag();
    expect(coordinator.activeSession()).toBeNull();
    expect(page.states.at(-1)).toBe(false);
    expect(rowA.states.at(-1)).toBe(false);
    expect(rowB.states.at(-1)).toBe(false);
  });

  it('applies cached acceptance to containers registered during a drag', () => {
    const { coordinator } = createCoordinator();
    const page = container('page', 0);
    const draggedTarget = container('row-a', 1);
    const allowedTarget = container('row-b', 1);

    coordinator.registerContainer(page);
    coordinator.startDrag('row-a');
    coordinator.registerContainer(draggedTarget);
    coordinator.registerContainer(allowedTarget);
    coordinator.registerContainer(allowedTarget);

    expect(draggedTarget.states).toEqual([false]);
    expect(allowedTarget.states).toEqual([true]);
  });

  it('replaces the model before emitting a successful move', () => {
    const observations: MlvTileNodeWithChildren<TestProps>[] = [];
    const context: {
      read?: () => MlvTileNodeWithChildren<TestProps> | undefined;
    } = {};
    const moved = vi.fn(() => {
      const current = context.read?.();
      if (current) observations.push(current);
    });
    const harness = createCoordinator(root, moved);
    context.read = harness.read;
    harness.coordinator.registerContainer(container('page', 0, () => true));
    harness.coordinator.registerContainer(container('row-a', 1));
    harness.coordinator.registerContainer(container('row-b', 1));
    harness.coordinator.startDrag('hero');

    const changed = harness.coordinator.move({
      tileId: 'hero',
      sourceContainerId: 'row-a',
      targetContainerId: 'row-b',
      previousIndex: 0,
      currentIndex: 0,
    });

    expect(changed).toBe(true);
    expect(harness.writes).toHaveBeenCalledTimes(1);
    expect(harness.read()).not.toBe(root);
    expect(observations).toEqual([harness.read()]);
    expect(moved).toHaveBeenCalledWith({
      tileId: 'hero',
      sourceContainerId: 'row-a',
      targetContainerId: 'row-b',
      previousIndex: 0,
      currentIndex: 0,
    });
  });

  it('excludes a locked container and its descendants before consulting policy', () => {
    const nestedRoot: MlvTileNodeWithChildren<TestProps> = {
      ...root,
      children: [
        root.children[0],
        {
          ...(root.children[1] as MlvTileNodeWithChildren<TestProps>),
          children: [
            {
              id: 'row-b-inner',
              acceptsChildren: true,
              props: { title: 'B inner', type: 'row' },
              children: [],
            },
          ],
        },
      ],
    };
    const accepts = vi.fn(() => true);
    const { coordinator } = createCoordinator(nestedRoot);
    coordinator.registerContainer(container('page', 0, accepts));
    coordinator.registerContainer(container('row-a', 1));
    coordinator.registerContainer(container('row-b', 1, undefined, true));

    const session = coordinator.startDrag('hero');

    if (!session) throw new Error('Expected a drag session');
    expect(session.allowedTargetIds.has('row-b')).toBe(false);
    expect(session.allowedTargetIds.has('row-b-inner')).toBe(false);
    expect(session.allowedTargetIds.has('page')).toBe(true);
    expect(
      accepts.mock.calls.map(([, target]) => (target as { id: string }).id),
    ).toEqual(['page', 'row-a']);
  });

  it('keeps a locked target closed even when its own policy accepts', () => {
    const { coordinator } = createCoordinator();
    coordinator.registerContainer(container('page', 0));
    coordinator.registerContainer(container('row-a', 1));
    coordinator.registerContainer(container('row-b', 1, () => true, true));

    const session = coordinator.startDrag('hero');

    if (!session) throw new Error('Expected a drag session');
    expect(session.allowedTargetIds.has('row-b')).toBe(false);
  });

  it('inserts a node through the root binding and rejects invalid requests', () => {
    const harness = createCoordinator();
    const added: MlvTileTreeNode<TestProps> = {
      id: 'added',
      acceptsChildren: false,
      props: { title: 'Added', type: 'block' },
    };

    expect(
      harness.coordinator.insert({ targetContainerId: 'row-b', tile: added }),
    ).toBe(true);
    const inserted = harness.read();
    if (!inserted) throw new Error('Expected the root tree');
    expect(
      (inserted.children[1] as MlvTileNodeWithChildren<TestProps>).children.map(
        ({ id }) => id,
      ),
    ).toEqual(['added']);
    expect(harness.writes).toHaveBeenCalledTimes(1);

    expect(
      harness.coordinator.insert({ targetContainerId: 'missing', tile: added }),
    ).toBe(false);
    expect(
      harness.coordinator.insert({
        targetContainerId: 'row-a',
        tile: { ...added, id: 'hero' },
      }),
    ).toBe(false);
    expect(
      harness.coordinator.insert({
        targetContainerId: 'row-a',
        tile: { ...added, id: 'other' },
        index: 5,
      }),
    ).toBe(false);
    expect(harness.writes).toHaveBeenCalledTimes(1);
    expect(harness.read()).toBe(inserted);
  });

  it('rejects an insert into a locked container and its locked descendants', () => {
    const nestedRoot: MlvTileNodeWithChildren<TestProps> = {
      ...root,
      children: [
        root.children[0],
        {
          ...(root.children[1] as MlvTileNodeWithChildren<TestProps>),
          children: [
            {
              id: 'row-b-inner',
              acceptsChildren: true,
              props: { title: 'B inner', type: 'row' },
              children: [],
            },
          ],
        },
      ],
    };
    const harness = createCoordinator(nestedRoot);
    harness.coordinator.registerContainer(container('page', 0));
    harness.coordinator.registerContainer(container('row-a', 1));
    harness.coordinator.registerContainer(
      container('row-b', 1, undefined, true),
    );
    const added: MlvTileTreeNode<TestProps> = {
      id: 'added',
      acceptsChildren: false,
      props: { title: 'Added', type: 'block' },
    };

    expect(
      harness.coordinator.insert({ targetContainerId: 'row-b', tile: added }),
    ).toBe(false);
    // The cascade reaches a container that carries no registration of its own.
    expect(
      harness.coordinator.insert({
        targetContainerId: 'row-b-inner',
        tile: added,
      }),
    ).toBe(false);
    expect(harness.writes).not.toHaveBeenCalled();
    expect(harness.read()).toBe(nestedRoot);

    expect(
      harness.coordinator.insert({ targetContainerId: 'row-a', tile: added }),
    ).toBe(true);
  });

  it('refuses to remove a node held by a locked container', () => {
    const harness = createCoordinator();
    harness.coordinator.registerContainer(container('page', 0));
    harness.coordinator.registerContainer(
      container('row-a', 1, undefined, true),
    );
    harness.coordinator.registerContainer(container('row-b', 1));

    // `hero` lives inside the locked `row-a`; the call originates at the root.
    expect(harness.coordinator.isLocked('hero')).toBe(true);
    expect(harness.coordinator.remove('hero')).toBe(false);
    expect(harness.writes).not.toHaveBeenCalled();
    expect(harness.read()).toBe(root);

    // The locked container node itself is frozen too.
    expect(harness.coordinator.isLocked('row-a')).toBe(true);
    expect(harness.coordinator.remove('row-a')).toBe(false);
    expect(harness.read()).toBe(root);

    // An unlocked sibling stays removable.
    expect(harness.coordinator.isLocked('row-b')).toBe(false);
    expect(harness.coordinator.remove('row-b')).toBe(true);
  });

  it('falls back to the nearest following container when indenting', () => {
    const forwardRoot: MlvTileNodeWithChildren<TestProps> = {
      ...root,
      children: [
        {
          id: 'lead',
          acceptsChildren: false,
          props: { title: 'Lead', type: 'block' },
        },
        ...root.children,
      ],
    };
    const { coordinator } = createCoordinator(forwardRoot);
    coordinator.registerContainer(container('page', 0));
    coordinator.registerContainer(container('row-a', 1));
    coordinator.registerContainer(container('row-b', 1));

    expect(coordinator.moveByKeyboard('lead', 'right')).toEqual({
      tileId: 'lead',
      sourceContainerId: 'page',
      targetContainerId: 'row-a',
      previousIndex: 0,
      currentIndex: 1,
    });
  });

  it('prefers a preceding container over a following one when indenting', () => {
    const surroundedRoot: MlvTileNodeWithChildren<TestProps> = {
      ...root,
      children: [
        root.children[0],
        {
          id: 'middle',
          acceptsChildren: false,
          props: { title: 'Middle', type: 'block' },
        },
        root.children[1],
      ],
    };
    const { coordinator } = createCoordinator(surroundedRoot);
    coordinator.registerContainer(container('page', 0));
    coordinator.registerContainer(container('row-a', 1));
    coordinator.registerContainer(container('row-b', 1));

    expect(
      coordinator.moveByKeyboard('middle', 'right')?.targetContainerId,
    ).toBe('row-a');
  });

  it('removes items and updates their properties through the root binding', () => {
    const removed = createCoordinator();

    expect(removed.coordinator.remove('hero')).toBe(true);
    const removedRoot = removed.read();
    if (!removedRoot) throw new Error('Expected the root tree');
    expect(findNode(removedRoot, 'hero')).toBeUndefined();

    const updated = createCoordinator();
    expect(
      updated.coordinator.updateProps('hero', (props) => ({
        ...props,
        title: 'Updated hero',
      })),
    ).toBe(true);
    const updatedRoot = updated.read();
    if (!updatedRoot) throw new Error('Expected the root tree');
    expect(findNode(updatedRoot, 'hero')?.props.title).toBe('Updated hero');
    expect(findNode(root, 'hero')?.props.title).toBe('Hero');
  });
});
