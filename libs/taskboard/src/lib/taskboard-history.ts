import type {
  MlvTaskboardState,
  MlvTaskboardCommand,
  MlvTaskboardHistory,
  MlvTaskboardSnapshot,
} from './taskboard.types';

const DEFAULT_HISTORY_LIMIT = 100;

export function createMlvTaskboardSnapshot(
  snapshot: MlvTaskboardSnapshot,
): MlvTaskboardSnapshot {
  return Object.freeze({
    columnIds: Object.freeze([...snapshot.columnIds]),
    collapsedColumnIds: Object.freeze([...snapshot.collapsedColumnIds]),
    collapsedSwimlaneIds: Object.freeze([...snapshot.collapsedSwimlaneIds]),
    selectedIds: Object.freeze([...snapshot.selectedIds]),
    ...(snapshot.focusedId === undefined
      ? {}
      : { focusedId: snapshot.focusedId }),
    cellScrollPositions: Object.freeze({ ...snapshot.cellScrollPositions }),
  });
}

export function createMlvTaskboardHistory<TItem>(
  initial: MlvTaskboardState<TItem>,
  limit = DEFAULT_HISTORY_LIMIT,
): MlvTaskboardHistory<TItem> {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error('Taskboard history limit must be a positive integer.');
  }

  let current = initial;
  let undoStack: readonly MlvTaskboardCommand<TItem>[] = [];
  let redoStack: readonly MlvTaskboardCommand<TItem>[] = [];

  const history: MlvTaskboardHistory<TItem> = {
    current: () => current,
    push: (command) => {
      if (command.before !== current) {
        throw new Error(
          'Taskboard history command does not match current board.',
        );
      }
      const immutableCommand = Object.freeze({
        before: command.before,
        after: command.after,
      });
      undoStack = Object.freeze([...undoStack, immutableCommand].slice(-limit));
      redoStack = Object.freeze([]);
      current = command.after;
      return history;
    },
    undo: () => {
      const command = undoStack[undoStack.length - 1];
      if (!command) return null;
      undoStack = Object.freeze(undoStack.slice(0, -1));
      redoStack = Object.freeze([...redoStack, command]);
      current = command.before;
      return current;
    },
    redo: () => {
      const command = redoStack[redoStack.length - 1];
      if (!command) return null;
      redoStack = Object.freeze(redoStack.slice(0, -1));
      undoStack = Object.freeze([...undoStack, command].slice(-limit));
      current = command.after;
      return current;
    },
    replace: (board) => {
      current = board;
      undoStack = Object.freeze([]);
      redoStack = Object.freeze([]);
      return current;
    },
  };

  return Object.freeze(history);
}
