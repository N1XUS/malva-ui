import {
  createMlvTaskboardDragSession,
  type MlvTaskboard,
  type MlvTaskboardCanDropFn,
} from './taskboard-drag-session';
import { applyMlvTaskboardMove } from './taskboard-state';

interface Ticket {
  readonly id: string;
  readonly status: string;
  readonly assignee: string;
}

const makeBoard = (
  overrides: Partial<MlvTaskboard<Ticket>> = {},
): MlvTaskboard<Ticket> => ({
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
    const board = makeBoard();

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
        wip: { count: 1, limit: undefined, remaining: undefined },
      }),
    );
  });
});
