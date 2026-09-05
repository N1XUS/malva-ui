import type {
  MlvTaskboardState,
  MlvTaskboardCsvField,
  MlvTaskboardKey,
  MlvTaskboardSerialized,
  MlvTaskboardSnapshot,
} from './taskboard.types';

const sameKey = (left: MlvTaskboardKey, right: MlvTaskboardKey): boolean =>
  typeof left === typeof right && left === right;

export function serializeMlvTaskboard<TItem>(
  board: MlvTaskboardState<TItem>,
  snapshot: MlvTaskboardSnapshot,
): MlvTaskboardSerialized<TItem> {
  return {
    items: [...board.items],
    columns: [...board.columns],
    ...(board.columnGroups === undefined
      ? {}
      : { columnGroups: [...board.columnGroups] }),
    ...(board.swimlanes === undefined
      ? {}
      : { swimlanes: [...board.swimlanes] }),
    snapshot: {
      columnIds: [...snapshot.columnIds],
      collapsedColumnIds: [...snapshot.collapsedColumnIds],
      collapsedSwimlaneIds: [...snapshot.collapsedSwimlaneIds],
      selectedIds: [...snapshot.selectedIds],
      ...(snapshot.focusedId === undefined
        ? {}
        : { focusedId: snapshot.focusedId }),
      cellScrollPositions: { ...snapshot.cellScrollPositions },
    },
    dataKey: board.dataKey,
    columnField: board.columnField,
    ...(board.swimlaneField === undefined
      ? {}
      : { swimlaneField: board.swimlaneField }),
    ...(board.transitions === undefined
      ? {}
      : { transitions: [...board.transitions] }),
    ...(board.lockedItemIds === undefined
      ? {}
      : { lockedItemIds: [...board.lockedItemIds] }),
  };
}

export function exportMlvTaskboardCsv<TItem>(
  board: MlvTaskboardState<TItem>,
  columnId: MlvTaskboardKey,
  fields: readonly MlvTaskboardCsvField<TItem>[],
): string {
  const escape = (value: unknown): string => {
    const text = value == null ? '' : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const rows = board.items
    .filter((item) =>
      sameKey(item[board.columnField] as MlvTaskboardKey, columnId),
    )
    .map((item) => fields.map(({ field }) => escape(item[field])).join(','));

  return [fields.map(({ heading }) => escape(heading)).join(','), ...rows].join(
    '\n',
  );
}
