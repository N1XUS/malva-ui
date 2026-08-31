import { describe, expect, it, vi } from 'vitest';

import type {
  MlvTileNodeWithChildren,
  MlvTilesAccepts,
} from './tile-tree.types';
import {
  canEnterMlvTileTarget,
  createMlvTileDragSession,
} from './tile-drag-session';

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

describe('Mlv Tile drag sessions', () => {
  it('caches policy results once for every structurally eligible target', () => {
    const accepts = vi.fn(() => true);
    const session = createMlvTileDragSession(root, 'hero', accepts);

    if (!session) throw new Error('Expected a drag session');

    expect(accepts).toHaveBeenCalledTimes(3);
    expect(session.allowedTargetIds.has('row-b')).toBe(true);
    expect(canEnterMlvTileTarget(session, 'row-b')).toBe(true);
    expect(canEnterMlvTileTarget(session, 'row-b')).toBe(true);
    expect(accepts).toHaveBeenCalledTimes(3);
  });

  it('passes the target and its exact direct children to the policy', () => {
    const accepts = vi.fn(() => true);
    const session = createMlvTileDragSession(root, 'hero', accepts);

    if (!session) throw new Error('Expected a drag session');

    expect(
      accepts.mock.calls.every(
        ([, target, innerTiles]) => target.children === innerTiles,
      ),
    ).toBe(true);
  });

  it('rejects self and descendant targets before evaluating policy', () => {
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
    const accepts = vi.fn(() => true);
    const session = createMlvTileDragSession(nestedRoot, 'row-a', accepts);

    if (!session) throw new Error('Expected a drag session');

    expect(canEnterMlvTileTarget(session, 'row-a')).toBe(false);
    expect(canEnterMlvTileTarget(session, 'nested-row')).toBe(false);
    expect(accepts).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 'row-a' }),
      expect.anything(),
    );
    expect(accepts).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 'nested-row' }),
      expect.anything(),
    );
  });

  it('invalidates missing, duplicate, and fixed-root drag sessions', () => {
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
    const accepts: MlvTilesAccepts<TestProps> = () => true;

    expect(createMlvTileDragSession(root, 'missing', accepts)).toBeNull();
    expect(createMlvTileDragSession(duplicateRoot, 'hero', accepts)).toBeNull();
    expect(createMlvTileDragSession(root, 'page', accepts)).toBeNull();
    expect(canEnterMlvTileTarget(null, 'row-b')).toBe(false);
  });

  it('excludes locked targets before the acceptance policy runs', () => {
    const accepts = vi.fn(() => true);
    const session = createMlvTileDragSession(
      root,
      'hero',
      accepts,
      new Set(['row-b']),
    );

    if (!session) throw new Error('Expected a drag session');

    expect(session.allowedTargetIds.has('row-b')).toBe(false);
    expect(session.allowedTargetIds.has('page')).toBe(true);
    expect(canEnterMlvTileTarget(session, 'row-b')).toBe(false);
    expect(accepts).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 'row-b' }),
      expect.anything(),
    );
  });

  it('records an empty string container ID as a parent', () => {
    const emptyIdRoot: MlvTileNodeWithChildren<TestProps> = {
      ...root,
      id: '',
    };
    const session = createMlvTileDragSession(emptyIdRoot, 'hero', () => true);

    if (!session) throw new Error('Expected a drag session');

    expect(session.parentById.get('row-a')).toBe('');
  });
});
