import { describe, expect, it } from 'vitest';

import type { MlvTileNodeWithChildren, MlvTileTreeNode } from '../index';
import {
  insertMlvTileNode,
  moveMlvTileNode,
  removeMlvTileNode,
  updateMlvTileNodeProps,
} from './tile-tree-state';

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

const rootWithTwoBlocks: MlvTileNodeWithChildren<TestProps> = {
  ...root,
  children: [
    {
      ...root.children[0],
      children: [
        ...root.children[0].children,
        {
          id: 'intro',
          acceptsChildren: false,
          props: { title: 'Intro', type: 'block' },
        },
      ],
    },
    root.children[1],
  ],
};

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

function findContainer(
  tree: MlvTileNodeWithChildren<TestProps>,
  id: string,
): MlvTileNodeWithChildren<TestProps> | undefined {
  const node = findNode(tree, id);
  return node?.acceptsChildren ? node : undefined;
}

describe('Mlv Tile tree state', () => {
  it('moves a tile forward within its container', () => {
    const result = moveMlvTileNode(rootWithTwoBlocks, {
      tileId: 'hero',
      sourceContainerId: 'row-a',
      targetContainerId: 'row-a',
      previousIndex: 0,
      currentIndex: 1,
    });

    expect(
      findContainer(result, 'row-a')?.children.map((tile) => tile.id),
    ).toEqual(['intro', 'hero']);
  });

  it('moves a tile backward within its container', () => {
    const result = moveMlvTileNode(rootWithTwoBlocks, {
      tileId: 'intro',
      sourceContainerId: 'row-a',
      targetContainerId: 'row-a',
      previousIndex: 1,
      currentIndex: 0,
    });

    expect(
      findContainer(result, 'row-a')?.children.map((tile) => tile.id),
    ).toEqual(['intro', 'hero']);
  });

  it('moves a leaf across tree levels and can return a row to its origin', () => {
    const heroMoved = moveMlvTileNode(root, {
      tileId: 'hero',
      sourceContainerId: 'row-a',
      targetContainerId: 'page',
      previousIndex: 0,
      currentIndex: 1,
    });
    const rowMoved = moveMlvTileNode(root, {
      tileId: 'row-b',
      sourceContainerId: 'page',
      targetContainerId: 'row-a',
      previousIndex: 1,
      currentIndex: 1,
    });
    const rowReturned = moveMlvTileNode(rowMoved, {
      tileId: 'row-b',
      sourceContainerId: 'row-a',
      targetContainerId: 'page',
      previousIndex: 1,
      currentIndex: 1,
    });

    expect(heroMoved.children.map((tile) => tile.id)).toEqual([
      'row-a',
      'hero',
      'row-b',
    ]);
    expect(findContainer(heroMoved, 'row-a')?.children).toEqual([]);
    expect(
      findContainer(rowMoved, 'row-a')?.children.map((tile) => tile.id),
    ).toEqual(['hero', 'row-b']);
    expect(rowReturned.children.map((tile) => tile.id)).toEqual([
      'row-a',
      'row-b',
    ]);
  });

  it('preserves the original root for fixed-root, self, and descendant moves', () => {
    const nestedRoot: MlvTileNodeWithChildren<TestProps> = {
      ...root,
      children: [
        {
          ...root.children[0],
          children: [
            {
              id: 'nested-row',
              acceptsChildren: true,
              props: { title: 'Nested', type: 'row' },
              children: root.children[0].children,
            },
          ],
        },
        root.children[1],
      ],
    };

    expect(
      moveMlvTileNode(root, {
        tileId: 'page',
        sourceContainerId: 'page',
        targetContainerId: 'row-a',
        previousIndex: 0,
        currentIndex: 0,
      }),
    ).toBe(root);
    expect(
      moveMlvTileNode(root, {
        tileId: 'row-a',
        sourceContainerId: 'page',
        targetContainerId: 'row-a',
        previousIndex: 0,
        currentIndex: 0,
      }),
    ).toBe(root);
    expect(
      moveMlvTileNode(nestedRoot, {
        tileId: 'row-a',
        sourceContainerId: 'page',
        targetContainerId: 'nested-row',
        previousIndex: 0,
        currentIndex: 0,
      }),
    ).toBe(nestedRoot);
  });

  it('preserves the original root for duplicate IDs and stale source indices', () => {
    const duplicateRoot: MlvTileNodeWithChildren<TestProps> = {
      ...root,
      children: [
        ...root.children,
        {
          id: 'hero',
          acceptsChildren: false,
          props: { title: 'Duplicate', type: 'block' },
        },
      ],
    };

    expect(
      moveMlvTileNode(duplicateRoot, {
        tileId: 'hero',
        sourceContainerId: 'row-a',
        targetContainerId: 'row-b',
        previousIndex: 0,
        currentIndex: 0,
      }),
    ).toBe(duplicateRoot);
    expect(
      moveMlvTileNode(root, {
        tileId: 'hero',
        sourceContainerId: 'row-a',
        targetContainerId: 'row-b',
        previousIndex: 1,
        currentIndex: 0,
      }),
    ).toBe(root);
  });

  it('keeps prior snapshots immutable and retains unaffected subtree identity', () => {
    const rowB = rootWithTwoBlocks.children[1];
    const originalChildren = findContainer(
      rootWithTwoBlocks,
      'row-a',
    )?.children;
    const result = moveMlvTileNode(rootWithTwoBlocks, {
      tileId: 'hero',
      sourceContainerId: 'row-a',
      targetContainerId: 'row-a',
      previousIndex: 0,
      currentIndex: 1,
    });

    expect(findContainer(rootWithTwoBlocks, 'row-a')?.children).toBe(
      originalChildren,
    );
    expect(
      findContainer(rootWithTwoBlocks, 'row-a')?.children.map(
        (tile) => tile.id,
      ),
    ).toEqual(['hero', 'intro']);
    expect(result.children[1]).toBe(rowB);
    expect(findContainer(result, 'row-a')).not.toBe(
      findContainer(rootWithTwoBlocks, 'row-a'),
    );
  });

  it('removes a nested tile without cloning unaffected branches', () => {
    const result = removeMlvTileNode(root, 'hero');

    expect(findNode(result, 'hero')).toBeUndefined();
    expect(result.children[1]).toBe(root.children[1]);
    expect(removeMlvTileNode(root, 'page')).toBe(root);
    expect(removeMlvTileNode(root, 'missing')).toBe(root);
  });

  it('replaces a nested tile property immutably', () => {
    const result = updateMlvTileNodeProps(root, 'hero', (props) => ({
      ...props,
      title: 'Updated hero',
    }));

    expect(findNode(result, 'hero')?.props.title).toBe('Updated hero');
    expect(findNode(root, 'hero')?.props.title).toBe('Hero');
    expect(result.children[1]).toBe(root.children[1]);
    expect(updateMlvTileNodeProps(root, 'page', (props) => props)).toBe(root);
  });

  it('appends an inserted node and keeps unaffected subtree references', () => {
    const added: MlvTileTreeNode<TestProps> = {
      id: 'added',
      acceptsChildren: false,
      props: { title: 'Added', type: 'block' },
    };
    const rowA = findContainer(rootWithTwoBlocks, 'row-a');
    const result = insertMlvTileNode(rootWithTwoBlocks, {
      targetContainerId: 'row-b',
      tile: added,
    });

    expect(
      findContainer(result, 'row-b')?.children.map(({ id }) => id),
    ).toEqual(['added']);
    expect(findContainer(result, 'row-b')?.children[0]).toBe(added);
    expect(findContainer(result, 'row-a')).toBe(rowA);
    expect(result).not.toBe(rootWithTwoBlocks);
    expect(findContainer(rootWithTwoBlocks, 'row-b')?.children).toEqual([]);
  });

  it('inserts at a valid index without mutating the input root', () => {
    const added: MlvTileTreeNode<TestProps> = {
      id: 'added',
      acceptsChildren: false,
      props: { title: 'Added', type: 'block' },
    };
    const originalChildren = findContainer(
      rootWithTwoBlocks,
      'row-a',
    )?.children;
    const result = insertMlvTileNode(rootWithTwoBlocks, {
      targetContainerId: 'row-a',
      tile: added,
      index: 1,
    });

    expect(
      findContainer(result, 'row-a')?.children.map(({ id }) => id),
    ).toEqual(['hero', 'added', 'intro']);
    expect(findContainer(rootWithTwoBlocks, 'row-a')?.children).toBe(
      originalChildren,
    );
    expect(
      findContainer(rootWithTwoBlocks, 'row-a')?.children.map(({ id }) => id),
    ).toEqual(['hero', 'intro']);
  });

  it('inserts a container subtree and accepts the boundary index', () => {
    const branch: MlvTileTreeNode<TestProps> = {
      id: 'branch',
      acceptsChildren: true,
      props: { title: 'Branch', type: 'row' },
      children: [
        {
          id: 'branch-leaf',
          acceptsChildren: false,
          props: { title: 'Branch leaf', type: 'block' },
        },
      ],
    };
    const result = insertMlvTileNode(rootWithTwoBlocks, {
      targetContainerId: 'row-a',
      tile: branch,
      index: 2,
    });

    expect(
      findContainer(result, 'row-a')?.children.map(({ id }) => id),
    ).toEqual(['hero', 'intro', 'branch']);
    expect(findNode(result, 'branch-leaf')).toBeDefined();
    expect(findNode(rootWithTwoBlocks, 'branch')).toBeUndefined();
  });

  it('rejects an invalid index rather than clamping it', () => {
    const added: MlvTileTreeNode<TestProps> = {
      id: 'added',
      acceptsChildren: false,
      props: { title: 'Added', type: 'block' },
    };

    expect(
      insertMlvTileNode(root, {
        targetContainerId: 'row-a',
        tile: added,
        index: -1,
      }),
    ).toBe(root);
    expect(
      insertMlvTileNode(root, {
        targetContainerId: 'row-a',
        tile: added,
        index: 2,
      }),
    ).toBe(root);
    expect(
      insertMlvTileNode(root, {
        targetContainerId: 'row-a',
        tile: added,
        index: 0.5,
      }),
    ).toBe(root);
    expect(
      insertMlvTileNode(root, {
        targetContainerId: 'row-a',
        tile: added,
        index: Number.NaN,
      }),
    ).toBe(root);
  });

  it('rejects an unknown target, a reused ID, and duplicate trees', () => {
    const added: MlvTileTreeNode<TestProps> = {
      id: 'added',
      acceptsChildren: false,
      props: { title: 'Added', type: 'block' },
    };
    const duplicateRoot: MlvTileNodeWithChildren<TestProps> = {
      ...root,
      children: [
        ...root.children,
        {
          id: 'row-b',
          acceptsChildren: false,
          props: { title: 'Duplicate', type: 'block' },
        },
      ],
    };

    expect(
      insertMlvTileNode(root, { targetContainerId: 'missing', tile: added }),
    ).toBe(root);
    // `hero` is a leaf, so it is not a container target.
    expect(
      insertMlvTileNode(root, { targetContainerId: 'hero', tile: added }),
    ).toBe(root);
    expect(
      insertMlvTileNode(root, {
        targetContainerId: 'row-b',
        tile: { ...added, id: 'hero' },
      }),
    ).toBe(root);
    expect(
      insertMlvTileNode(root, {
        targetContainerId: 'row-b',
        tile: { ...added, id: 'page' },
      }),
    ).toBe(root);
    expect(
      insertMlvTileNode(duplicateRoot, {
        targetContainerId: 'row-a',
        tile: added,
      }),
    ).toBe(duplicateRoot);
  });

  it('rejects a subtree that collides with the tree or with itself', () => {
    const collidingBranch: MlvTileTreeNode<TestProps> = {
      id: 'branch',
      acceptsChildren: true,
      props: { title: 'Branch', type: 'row' },
      children: [
        {
          id: 'hero',
          acceptsChildren: false,
          props: { title: 'Cloned hero', type: 'block' },
        },
      ],
    };
    const internallyDuplicateBranch: MlvTileTreeNode<TestProps> = {
      id: 'branch',
      acceptsChildren: true,
      props: { title: 'Branch', type: 'row' },
      children: [
        {
          id: 'twin',
          acceptsChildren: false,
          props: { title: 'First twin', type: 'block' },
        },
        {
          id: 'twin',
          acceptsChildren: false,
          props: { title: 'Second twin', type: 'block' },
        },
      ],
    };

    expect(
      insertMlvTileNode(root, {
        targetContainerId: 'row-b',
        tile: collidingBranch,
      }),
    ).toBe(root);
    expect(
      insertMlvTileNode(root, {
        targetContainerId: 'row-b',
        tile: internallyDuplicateBranch,
      }),
    ).toBe(root);
  });

  it('rebuilds mutations of a direct child beneath an empty-ID container', () => {
    const emptyIdRoot: MlvTileNodeWithChildren<TestProps> = {
      ...root,
      id: '',
    };
    const removed = removeMlvTileNode(emptyIdRoot, 'row-a');
    const updated = updateMlvTileNodeProps(emptyIdRoot, 'row-a', (props) => ({
      ...props,
      title: 'Updated row',
    }));

    expect(findNode(removed, 'row-a')).toBeUndefined();
    expect(findNode(updated, 'row-a')?.props.title).toBe('Updated row');
  });
});
