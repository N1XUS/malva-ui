import { Extension, type Editor } from '@tiptap/core';
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state';
import {
  mlvEditorCollaborationBindingFor,
  type MlvEditorCollaborationBinding,
} from '../editor/editor-collaboration.contract';

/**
 * @internal A document position that follows edits: local ones through
 * ProseMirror mapping, remote ones through a collaboration anchor.
 */
export interface MlvEditorTrackedPosition {
  /** The current position, or `null` once its content was deleted. */
  readonly pos: number | null;

  /** Stops tracking. Idempotent. */
  release(): void;
}

/** @private Mutable state of one tracked position. */
interface TrackedEntry {
  pos: number | null;
  readonly assoc: -1 | 1;
  anchor: unknown;
}

/** @private Tracked positions of each editor. */
const trackedByEditor = new WeakMap<Editor, Set<TrackedEntry>>();

/** @private Key of the tracker plugin. */
const positionTrackerKey = new PluginKey('mlvEditorPositionTracker');

/** @private The entries of `editor`, created on first use. */
const entriesOf = (editor: Editor): Set<TrackedEntry> => {
  let entries = trackedByEditor.get(editor);
  if (!entries) {
    entries = new Set();
    trackedByEditor.set(editor, entries);
  }
  return entries;
};

/** @private Captures the anchor of an entry against the current state. */
const capture = (
  entry: TrackedEntry,
  editor: Editor,
  binding: MlvEditorCollaborationBinding | null,
): void => {
  entry.anchor =
    binding && entry.pos !== null
      ? binding.anchor(editor.state, entry.pos)
      : null;
};

/**
 * @private Moves one entry through a transaction. A change-origin
 * transaction replaces the whole document, so ProseMirror mapping would
 * collapse every position: the entry is resolved from its anchor instead.
 */
const move = (
  entry: TrackedEntry,
  tr: Transaction,
  binding: MlvEditorCollaborationBinding | null,
  editorState: Parameters<MlvEditorCollaborationBinding['resolve']>[0],
): void => {
  if (entry.pos === null) return;
  const root = tr.getMeta('appendedTransaction') as Transaction | undefined;
  if (
    binding &&
    (binding.isChangeOrigin(tr) || (root && binding.isChangeOrigin(root)))
  ) {
    entry.pos =
      entry.anchor === null ? null : binding.resolve(editorState, entry.anchor);
    return;
  }
  const result = tr.mapping.mapResult(entry.pos, entry.assoc);
  entry.pos = result.deleted ? null : result.pos;
};

/**
 * @internal Starts tracking `pos` in `editor`. `assoc` decides which side of
 * an insertion exactly at `pos` it stays on (ProseMirror semantics); remote
 * anchors always associate to the left, the y-tiptap limitation (F-D12).
 *
 * Requires {@link MlvEditorPositionTracker} in the editor; without it the
 * position never moves.
 */
export function trackMlvEditorPosition(
  editor: Editor,
  pos: number,
  assoc: -1 | 1 = 1,
): MlvEditorTrackedPosition {
  const entry: TrackedEntry = { pos, assoc, anchor: null };
  capture(entry, editor, mlvEditorCollaborationBindingFor(editor));
  const entries = entriesOf(editor);
  entries.add(entry);
  return {
    get pos() {
      return entry.pos;
    },
    release: () => {
      entries.delete(entry);
    },
  };
}

/**
 * @internal Keeps {@link trackMlvEditorPosition} positions current. Without
 * a collaboration binding it is pure ProseMirror mapping, identical to mapping
 * the position by hand.
 *
 * Positions move in plugin `apply` (every applied transaction, appended ones
 * included). Anchors are recaptured in the plugin view's `update`, which runs
 * after the collaboration sync plugin's view has pushed the local change to
 * Yjs, because plugin views update in plugin order and the collaboration
 * extension has a higher priority (Appendix B U1).
 *
 * Constraint: moving positions in `apply` is a side effect in a hook
 * ProseMirror treats as pure. A transaction applied but never dispatched
 * (`editor.state.apply(tr)` to preview it) still moves every tracked
 * position, so upload placeholders and a block drag's source then point into
 * the preview's document. No in-repo code previews a transaction; an
 * extension that does must not run alongside tracked positions. Moving the
 * mutation into the view's `update` (`previous` → `updated`), as the block
 * handle does, is the follow-up.
 */
export const MlvEditorPositionTracker = Extension.create({
  name: 'mlvEditorPositionTracker',

  // Above the default 100, so every position has moved before a plugin that
  // reads it in the same transaction (upload placeholders, block drag). At an
  // equal priority that holds only because Tiptap reverses the extension list
  // before its stable sort and `mlv-editor` appends the tracker last; the
  // explicit priority does not depend on array order. Below the collaboration
  // extension's 1000, so the view still recaptures anchors after the sync
  // plugin's view pushed to Yjs (U1).
  priority: 999,

  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: positionTrackerKey,
        state: {
          init: () => null,
          apply: (tr, value, _oldState, newState) => {
            if (!tr.docChanged) return value;
            const entries = trackedByEditor.get(editor);
            if (!entries?.size) return value;
            const binding = mlvEditorCollaborationBindingFor(editor);
            for (const entry of entries) move(entry, tr, binding, newState);
            return value;
          },
        },
        view: () => ({
          update: (view, previous) => {
            if (view.state.doc === previous.doc) return;
            const binding = mlvEditorCollaborationBindingFor(editor);
            const entries = trackedByEditor.get(editor);
            if (!binding || !entries?.size) return;
            for (const entry of entries) capture(entry, editor, binding);
          },
        }),
      }),
    ];
  },
});
