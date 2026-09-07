import type { MlvTaskboardState } from './taskboard.types';
import {
  createMlvTaskboardHistory,
  createMlvTaskboardSnapshot,
  type MlvTaskboardCommand,
} from './taskboard-history';

interface Ticket {
  readonly id: string;
  readonly status: string;
}

const initial: MlvTaskboardState<Ticket> = {
  items: [
    { id: 'a', status: 'todo' },
    { id: 'b', status: 'todo' },
  ],
  columns: [{ id: 'todo', label: 'Todo' }],
  dataKey: 'id',
  columnField: 'status',
};

const moved: MlvTaskboardState<Ticket> = {
  ...initial,
  items: [initial.items[1], initial.items[0]],
};

const moveCommand: MlvTaskboardCommand<Ticket> = {
  before: initial,
  after: moved,
};

describe('createMlvTaskboardHistory', () => {
  it('undoes a move and then restores it with redo using immutable snapshots', () => {
    const history = createMlvTaskboardHistory(initial);

    const afterMove = history.push(moveCommand).current();

    expect(afterMove.items.map((item) => item.id)).toEqual(['b', 'a']);
    expect(history.undo()?.items.map((item) => item.id)).toEqual(['a', 'b']);
    expect(history.redo()?.items.map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('clears redo when a new command is pushed after undo', () => {
    const history = createMlvTaskboardHistory(initial);
    const replacement: MlvTaskboardState<Ticket> = {
      ...initial,
      items: [initial.items[0]],
    };

    history.push(moveCommand);
    history.undo();
    history.push({ before: initial, after: replacement });

    expect(history.current().items.map((item) => item.id)).toEqual(['a']);
    expect(history.redo()).toBeNull();
  });

  it('resets history for an external replacement without changing its stable item IDs', () => {
    const history = createMlvTaskboardHistory(initial);
    const external: MlvTaskboardState<Ticket> = {
      ...initial,
      items: [
        { id: 'external-a', status: 'todo' },
        { id: 'external-b', status: 'todo' },
      ],
    };

    history.push(moveCommand);
    history.replace(external);

    expect(history.current().items.map((item) => item.id)).toEqual([
      'external-a',
      'external-b',
    ]);
    expect(history.undo()).toBeNull();
    expect(history.redo()).toBeNull();
  });

  it('returns null at undo and redo boundaries', () => {
    const history = createMlvTaskboardHistory(initial);

    expect(history.undo()).toBeNull();
    history.push(moveCommand);
    expect(history.redo()).toBeNull();
    history.undo();
    expect(history.undo()).toBeNull();
  });
});

describe('createMlvTaskboardSnapshot', () => {
  it('copies serializable state without retaining caller-owned collections', () => {
    const columnIds = ['todo'];
    const items = [{ id: 'a' }];
    const snapshot = createMlvTaskboardSnapshot({
      items,
      columnIds,
      collapsedColumnIds: ['done'],
      collapsedSwimlaneIds: ['sam'],
      selectedIds: ['a'],
      focusedId: 'a',
      cellScrollPositions: { 'todo:sam': 120 },
    });
    columnIds.push('done');
    items.push({ id: 'b' });

    expect(snapshot).toEqual({
      // The card array is copied, so a later push by the caller never edits
      // the placement a restore is meant to put back.
      items: [{ id: 'a' }],
      columnIds: ['todo'],
      collapsedColumnIds: ['done'],
      collapsedSwimlaneIds: ['sam'],
      selectedIds: ['a'],
      focusedId: 'a',
      cellScrollPositions: { 'todo:sam': 120 },
    });
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });
});
