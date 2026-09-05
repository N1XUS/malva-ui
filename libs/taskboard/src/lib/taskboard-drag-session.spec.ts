import { createMlvTaskboardDragSession } from './taskboard-drag-session';
import type {
  MlvTaskboardCanDropFn,
  MlvTaskboardState,
} from './taskboard.types';
import { applyMlvTaskboardMove } from './taskboard-state';

interface Ticket {
  readonly id: string;
  readonly status: string;
  readonly assignee: string;
}

const makeBoard = (
  overrides: Partial<MlvTaskboardState<Ticket>> = {},
): MlvTaskboardState<Ticket> => ({
  items: [
    { id: 'a', status: 'todo', assignee: 'sam' },
    { id: 'b', status: 'done', assignee: 'sam' },
    { id: 'c', status: 'done', assignee: 'alex' },
  ],
  columns: [
    { id: 'todo', label: 'Todo' },
    { id: 'done', label: 'Done' },
  ],
  swimlanes: [
    { id: 'sam', label: 'Sam' },
    { id: 'alex', label: 'Alex' },
  ],
  dataKey: 'id',
  columnField: 'status',
  swimlaneField: 'assignee',
  ...overrides,
});

describe('createMlvTaskboardDragSession', () => {
  it('rejects a target that exceeds its column WIP limit without replacing any card', () => {
    const board = makeBoard({
      columns: [
        { id: 'todo', label: 'Todo' },
        { id: 'done', label: 'Done', wipLimit: 1 },
      ],
    });
    const session = createMlvTaskboardDragSession(board, 'a');

    expect(
      session.canEnter({ columnId: 'done', swimlaneId: 'sam', index: 1 }),
    ).toBe(false);
    expect(
      applyMlvTaskboardMove(board, session.requestFor('done', 'sam', 1)),
    ).toBeNull();
    expect(board.items.map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });

  it.each([
    ['transition', makeBoard({ transitions: [{ from: 'todo', to: 'todo' }] })],
    [
      'source lock',
      makeBoard({
        columns: [
          { id: 'todo', label: 'Todo', locked: true },
          { id: 'done', label: 'Done' },
        ],
      }),
    ],
    [
      'destination lock',
      makeBoard({
        columns: [
          { id: 'todo', label: 'Todo' },
          { id: 'done', label: 'Done', locked: true },
        ],
      }),
    ],
    [
      'lane lock',
      makeBoard({
        swimlanes: [
          { id: 'sam', label: 'Sam' },
          { id: 'alex', label: 'Alex', locked: true },
        ],
      }),
    ],
    [
      'lane WIP',
      makeBoard({
        swimlanes: [
          { id: 'sam', label: 'Sam' },
          { id: 'alex', label: 'Alex', wipLimit: 1 },
        ],
      }),
    ],
    [
      'group WIP',
      makeBoard({
        columnGroups: [{ id: 'complete', label: 'Complete', wipLimit: 1 }],
        columns: [
          { id: 'todo', label: 'Todo' },
          { id: 'done', label: 'Done', groupId: 'complete' },
        ],
      }),
    ],
  ])('rejects entry when %s forbids it', (_reason, board) => {
    const session = createMlvTaskboardDragSession(board, 'a');
    expect(
      session.canEnter({ columnId: 'done', swimlaneId: 'alex', index: 1 }),
    ).toBe(false);
  });

  it('evaluates canDrop once per target with source context and rendered target state', () => {
    const canDrop: MlvTaskboardCanDropFn<Ticket> = vi.fn(() => false);
    const board = makeBoard({
      columns: [
        { id: 'todo', label: 'Todo' },
        { id: 'done', label: 'Done', wipLimit: 1 },
      ],
    });

    const session = createMlvTaskboardDragSession(board, 'a', canDrop);

    expect(
      session.canEnter({ columnId: 'done', swimlaneId: 'sam', index: 1 }),
    ).toBe(false);
    expect(canDrop).toHaveBeenCalledTimes(6);
    expect(canDrop).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'a',
        source: { columnId: 'todo', swimlaneId: 'sam', index: 0 },
      }),
      expect.objectContaining({
        column: board.columns[1],
        swimlane: board.swimlanes?.[0],
        index: 1,
        items: [board.items[1]],
        wip: { count: 1, limit: 1, remaining: 0 },
      }),
    );
  });

  it('does not re-run an allowed session policy when applying its request', () => {
    const canDrop: MlvTaskboardCanDropFn<Ticket> = vi.fn(() => true);
    const board = makeBoard();
    const session = createMlvTaskboardDragSession(board, 'a', canDrop);
    const request = session.requestFor('done', 'sam', 1);

    expect(request).toBeDefined();
    expect(applyMlvTaskboardMove(board, request)).not.toBeNull();
    expect(canDrop).toHaveBeenCalledTimes(6);
  });

  it('keeps an authorized request bound to the callback-validated target', () => {
    const canDrop: MlvTaskboardCanDropFn<Ticket> = (_card, target) =>
      target.column.id === 'done';
    const board = makeBoard();
    const session = createMlvTaskboardDragSession(board, 'a', canDrop);
    const request = session.requestFor('done', 'sam', 1);

    expect(request).toBeDefined();
    expect(() => {
      (request as { target: { columnId: string } }).target.columnId = 'todo';
    }).toThrow(TypeError);
    expect(applyMlvTaskboardMove(board, request)?.target.columnId).toBe('done');
  });
});
