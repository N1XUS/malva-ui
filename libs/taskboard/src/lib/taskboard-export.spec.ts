import type { MlvTaskboardState } from './taskboard.types';
import {
  exportMlvTaskboardCsv,
  serializeMlvTaskboard,
} from './taskboard-export';

interface Ticket {
  readonly id: string;
  readonly status: string;
  readonly title: string;
}

const board: MlvTaskboardState<Ticket> = {
  items: [
    { id: 'a', status: 'todo', title: 'Fix, "drag"\nstate' },
    { id: 'b', status: 'done', title: 'Outside requested column' },
  ],
  columns: [
    { id: 'todo', label: 'Todo' },
    { id: 'done', label: 'Done' },
  ],
  dataKey: 'id',
  columnField: 'status',
  canDropFn: () => true,
};

describe('serializeMlvTaskboard', () => {
  it('includes canonical data and configuration but omits callback functions', () => {
    const serialized = serializeMlvTaskboard(board, {
      columnIds: ['todo', 'done'],
      collapsedColumnIds: ['done'],
      collapsedSwimlaneIds: [],
      selectedIds: ['a'],
      focusedId: 'a',
      cellScrollPositions: { todo: 12 },
    });

    expect(serialized).toEqual({
      items: board.items,
      columns: board.columns,
      snapshot: {
        columnIds: ['todo', 'done'],
        collapsedColumnIds: ['done'],
        collapsedSwimlaneIds: [],
        selectedIds: ['a'],
        focusedId: 'a',
        cellScrollPositions: { todo: 12 },
      },
      dataKey: 'id',
      columnField: 'status',
    });
    expect(JSON.stringify(serialized)).not.toContain('canDropFn');
  });
});

describe('exportMlvTaskboardCsv', () => {
  it('quotes commas, quotes, and newlines while exporting one column only', () => {
    expect(
      exportMlvTaskboardCsv(board, 'todo', [
        { field: 'title', heading: 'Title' },
      ]),
    ).toBe('Title\n"Fix, ""drag""\nstate"');
  });

  it('does not include cards outside the requested canonical column', () => {
    expect(
      exportMlvTaskboardCsv(board, 'done', [
        { field: 'id', heading: 'Identifier' },
        { field: 'title', heading: 'Title' },
      ]),
    ).toBe('Identifier,Title\nb,Outside requested column');
  });
});
