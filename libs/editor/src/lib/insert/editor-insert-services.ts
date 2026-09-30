import type { ChainedCommands, Editor } from '@tiptap/core';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { NodeSelection, Selection, TextSelection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import {
  mlvEditorInsertSourcePos,
  mlvEditorIsEmptyParagraph,
} from '../extensions/editor-block-inserter';
import type {
  MlvEditorInsertContext,
  MlvEditorInsertTarget,
} from './editor-insert.types';

/**
 * @internal What the default insert items need from the editor beyond
 * Tiptap: the AI prompt and the image-upload dialog. Registered per editor by
 * the command menu (#516, U7), so the items stay plain objects a consumer can
 * spread, filter and reorder without an injection context.
 */
export interface MlvEditorInsertServices {
  /** Whether an AI provider is configured (`hasProvider`). */
  readonly aiAvailable: () => boolean;
  /** Whether an AI transform may start now (`canStart`). */
  readonly aiCanStart: () => boolean;
  /** Opens the AI prompt with output `'insert-below'`, anchored to `target`. */
  readonly askAi: (target: MlvEditorInsertTarget) => void;
  /** Whether the image-upload entry point belongs in the menu. */
  readonly imageUploadAvailable: () => boolean;
  /** Whether an upload may start now. */
  readonly imageUploadEnabled: () => boolean;
  /**
   * Opens the editor-scoped image-upload dialog. `position` is read when the
   * user submits, so nothing is inserted before an upload starts.
   */
  readonly openImageUpload: (position: () => number | null) => void;
}

/** @internal Services by editor instance; see {@link MlvEditorInsertServices}. */
const SERVICES = new WeakMap<Editor, MlvEditorInsertServices>();

/**
 * @internal Registers the command menu's services for `editor`. Returns the
 * release, which leaves a later registration for the same editor in place.
 */
export function registerMlvEditorInsertServices(
  editor: Editor,
  services: MlvEditorInsertServices,
): () => void {
  SERVICES.set(editor, services);
  return () => {
    if (SERVICES.get(editor) === services) SERVICES.delete(editor);
  };
}

/** @internal The services registered for `editor`, if a command menu is rendered. */
export function mlvEditorInsertServices(
  editor: Editor,
): MlvEditorInsertServices | undefined {
  return SERVICES.get(editor);
}

/**
 * @internal The insert target the selection speaks for (U7): the top-level
 * block holding the head, or a top-level `NodeSelection`'s node. `null` for
 * an empty document.
 */
export function mlvEditorResolveInsertTarget(
  state: Pick<EditorState, 'doc' | 'selection'>,
): MlvEditorInsertTarget | null {
  const pos = mlvEditorInsertSourcePos(state);
  const node = pos === null ? null : state.doc.nodeAt(pos);
  if (pos === null || !node) return null;
  return { pos, node, empty: mlvEditorIsEmptyParagraph(node) };
}

/**
 * @internal Where a block inserted for the selection's target lands without
 * creating a paragraph first (#516, the image item): inside an empty
 * paragraph source, which Tiptap's `insertContentAt` then replaces, else
 * right after the source. `null` for an empty document.
 */
export function mlvEditorInsertPosition(
  state: Pick<EditorState, 'doc' | 'selection'>,
): number | null {
  const target = mlvEditorResolveInsertTarget(state);
  if (!target) return null;
  return target.empty ? target.pos + 1 : target.pos + target.node.nodeSize;
}

/**
 * @internal The chain's first step: resolves the target from the chain's own
 * transaction and leaves the caret in an empty paragraph — the source when it
 * is one, else a new paragraph inserted after it — with stored marks cleared.
 * Fails (and so fails the chain) with no target, or with no paragraph type to
 * insert.
 */
function mlvEditorPrepareInsert(
  tr: Transaction,
  dispatch: ((tr: Transaction) => void) | undefined,
): boolean {
  const target = mlvEditorResolveInsertTarget(tr);
  if (!target) return false;
  const paragraph = tr.doc.type.schema.nodes['paragraph'];
  if (!target.empty && !paragraph) return false;
  if (!dispatch) return true;
  let caret = target.pos + 1;
  if (!target.empty && paragraph) {
    const after = target.pos + target.node.nodeSize;
    tr.insert(after, paragraph.create());
    caret = after + 1;
  }
  tr.setSelection(TextSelection.create(tr.doc, caret));
  tr.setStoredMarks([]);
  return true;
}

/**
 * @internal U7 step 2: before the command menu opens for the block at `pos`,
 * leaves the selection inside it, so the target resolved when an item runs
 * is that block and the selection bubble stays hidden. A caret (or top-level
 * `NodeSelection`) already in the block is kept and nothing is dispatched —
 * the chord and the bubble's button always open from one. Otherwise one
 * selection-only transaction: the end of the block's last textblock, or a
 * `NodeSelection` for an atom block; no scroll, no history entry.
 */
export function mlvEditorCollapseIntoInsertSource(
  view: EditorView,
  pos: number,
): void {
  const { state } = view;
  const node = state.doc.nodeAt(pos);
  if (!node || mlvEditorInsertSourcePos(state) === null) return;
  const current = state.selection;
  if (
    mlvEditorInsertSourcePos(state) === pos &&
    (current.empty ||
      (current instanceof NodeSelection && current.$from.depth === 0))
  ) {
    return;
  }
  const end = pos + node.nodeSize;
  const found = node.isAtom
    ? null
    : Selection.findFrom(state.doc.resolve(end), -1, true);
  const selection =
    found && found.from > pos && found.to < end
      ? TextSelection.create(state.doc, found.to)
      : NodeSelection.isSelectable(node)
        ? NodeSelection.create(state.doc, pos)
        : null;
  if (!selection) return;
  view.dispatch(
    state.tr.setSelection(selection).setMeta('addToHistory', false),
  );
}

/**
 * @internal Builds an item's context at run time (never when the menu
 * opens): the target is read from the current selection, and `chain()`
 * re-resolves it from the chain's transaction, so no position is held.
 * `null` for an empty document.
 */
export function createMlvEditorInsertContext(
  editor: Editor,
): MlvEditorInsertContext | null {
  const target = mlvEditorResolveInsertTarget(editor.state);
  if (!target) return null;
  return {
    editor,
    target,
    chain: (): ChainedCommands =>
      editor
        .chain()
        .focus()
        .command(({ tr, dispatch }) => mlvEditorPrepareInsert(tr, dispatch)),
  };
}
