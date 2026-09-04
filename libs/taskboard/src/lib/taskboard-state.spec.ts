import {
  applyMlvTaskboardMove,
  createMlvTaskboardIndex,
  type MlvTaskboard,
  type MlvTaskboardMoveRequest,
} from './taskboard-state';
import { createMlvTaskboardDragSession } from './taskboard-drag-session';

interface Ticket {
  readonly id: string;
  readonly status: string;
  readonly assignee: string;
}

const board: MlvTaskboard<Ticket> = {
  items: [
    { id: 'a', status: 'todo', assignee: 'sam' },
    { id: 'b', status: 'done', assignee: 'sam' },
    { id: 'c', status: 'done', assignee: 'alex' },
  ],
  columns: [
    { id: 'todo', label: 'Todo' },
    { id: 'done', label: 'Done', wipLimit: 1 },
  ],
  swimlanes: [
    { id: 'sam', label: 'Sam' },
    { id: 'alex', label: 'Alex' },
  ],
  dataKey: 'id',
  columnField: 'status',
  swimlaneField: 'assignee',
};

describe('createMlvTaskboardIndex', () => {
  it('indexes canonical and visible items by their unique keys', () => {
    const index = createMlvTaskboardIndex(board);

    expect(index.itemById.get('a')).toBe(board.items[0]);
    expect(index.itemsFor('done', 'sam')).toEqual([board.items[1]]);
    expect(index.wipFor('done', 'sam')).toEqual({
      count: 1,
      limit: 1,
      remaining: 0,
    });
  });

  it('rejects duplicate canonical card keys', () => {
    expect(() =>
      createMlvTaskboardIndex({
        ...board,
        items: [...board.items, { id: 'a', status: 'todo', assignee: 'sam' }],
      }),
    ).toThrow('Duplicate taskboard item key: a');
  });

  it('rejects a visible item that is not canonical', () => {
    expect(() =>
      createMlvTaskboardIndex({
        ...board,
        visibleItems: [{ id: 'missing', status: 'todo', assignee: 'sam' }],
      }),
    ).toThrow('Visible taskboard item key is not canonical: missing');
  });

  it('rejects canonical cards placed in unknown columns or swimlanes', () => {
    expect(() =>
      createMlvTaskboardIndex({
        ...board,
        items: [{ id: 'invalid-column', status: 'missing', assignee: 'sam' }],
      }),
    ).toThrow('Unknown taskboard column id: missing');
    expect(() =>
      createMlvTaskboardIndex({
        ...board,
        items: [{ id: 'invalid-lane', status: 'todo', assignee: 'missing' }],
      }),
    ).toThrow('Unknown taskboard swimlane id: missing');
  });
});

describe('applyMlvTaskboardMove', () => {
  it('updates only the moved card and anchors a filtered drop beside its visible target', () => {
    const filteredBoard: MlvTaskboard<Ticket> = {
      ...board,
      columns: [
        { id: 'todo', label: 'Todo' },
        { id: 'done', label: 'Done' },
      ],
      items: [
        { id: 'hidden', status: 'todo', assignee: 'sam' },
        { id: 'c', status: 'done', assignee: 'alex' },
        { id: 'b', status: 'done', assignee: 'sam' },
        { id: 'a', status: 'todo', assignee: 'sam' },
      ],
      visibleItems: [
        { id: 'a', status: 'todo', assignee: 'sam' },
        { id: 'c', status: 'done', assignee: 'alex' },
        { id: 'b', status: 'done', assignee: 'sam' },
      ],
    };
    const moveAAfterC: MlvTaskboardMoveRequest<Ticket> = {
      board: filteredBoard,
      itemId: 'a',
      source: { columnId: 'todo', swimlaneId: 'sam', index: 0 },
      target: { columnId: 'done', swimlaneId: 'sam', index: 1 },
      anchorId: 'c',
    };

    const next = applyMlvTaskboardMove(filteredBoard, moveAAfterC);

    expect(next).not.toBeNull();
    expect(next?.items.map((item) => item.id)).toEqual([
      'hidden',
      'c',
      'a',
      'b',
    ]);
    expect(next?.items.find((item) => item.id === 'a')).toEqual({
      id: 'a',
      status: 'done',
      assignee: 'sam',
    });
    expect(next?.items.find((item) => item.id === 'b')).toBe(
      filteredBoard.items[2],
    );
  });

  it('returns null rather than clamping an invalid target index', () => {
    const invalidRequest: MlvTaskboardMoveRequest<Ticket> = {
      board,
      itemId: 'a',
      source: { columnId: 'todo', swimlaneId: 'sam', index: 0 },
      target: { columnId: 'done', swimlaneId: 'sam', index: 9 },
    };

    expect(applyMlvTaskboardMove(board, invalidRequest)).toBeNull();
    expect(board.items.map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns null when a direct request would violate destination WIP policy', () => {
    const request: MlvTaskboardMoveRequest<Ticket> = {
      board,
      itemId: 'a',
      source: { columnId: 'todo', swimlaneId: 'sam', index: 0 },
      target: { columnId: 'done', swimlaneId: 'sam', index: 1 },
    };

    expect(applyMlvTaskboardMove(board, request)).toBeNull();
    expect(board.items[0]).toEqual({
      id: 'a',
      status: 'todo',
      assignee: 'sam',
    });
  });

  it('enforces the board canDrop policy for direct requests', () => {
    const policyBoard: MlvTaskboard<Ticket> = {
      ...board,
      columns: [
        { id: 'todo', label: 'Todo' },
        { id: 'done', label: 'Done' },
      ],
      canDropFn: () => false,
    };
    const request: MlvTaskboardMoveRequest<Ticket> = {
      board: policyBoard,
      itemId: 'a',
      source: { columnId: 'todo', swimlaneId: 'sam', index: 0 },
      target: { columnId: 'done', swimlaneId: 'sam', index: 1 },
    };

    expect(applyMlvTaskboardMove(policyBoard, request)).toBeNull();
  });

  it('rejects a forged request after a denying session policy has been established', () => {
    const policy = vi.fn(() => false);
    createMlvTaskboardDragSession(board, 'a', policy);
    const forged: MlvTaskboardMoveRequest<Ticket> = {
      board,
      itemId: 'a',
      source: { columnId: 'todo', swimlaneId: 'sam', index: 0 },
      target: { columnId: 'todo', swimlaneId: 'sam', index: 1 },
    };

    expect(applyMlvTaskboardMove(board, forged)).toBeNull();
  });

  it('rejects a request that omits a configured destination lane', () => {
    const request: MlvTaskboardMoveRequest<Ticket> = {
      board,
      itemId: 'a',
      source: { columnId: 'todo', swimlaneId: 'sam', index: 0 },
      target: { columnId: 'todo', index: 0 },
    };

    expect(applyMlvTaskboardMove(board, request)).toBeNull();
  });

  it('rejects a request with stale source index metadata', () => {
    const request: MlvTaskboardMoveRequest<Ticket> = {
      board,
      itemId: 'a',
      source: { columnId: 'todo', swimlaneId: 'sam', index: 1 },
      target: { columnId: 'todo', swimlaneId: 'sam', index: 1 },
    };

    expect(applyMlvTaskboardMove(board, request)).toBeNull();
  });
});
