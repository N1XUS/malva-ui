import { InjectionToken, type Signal } from '@angular/core';
import type { Editor, Extensions } from '@tiptap/core';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import type { MlvEditorError, MlvEditorFormat } from '../editor.types';

/**
 * @internal What `mlv-editor` hands a collaboration binding once the Tiptap
 * editor exists. Not a consumer extension point.
 */
export interface MlvEditorCollaborationAttachContext {
  /** The editor the binding's extensions were installed into. */
  readonly editor: Editor;
  /** The editor's `format` when it was created; seeds are parsed in it. */
  readonly format: MlvEditorFormat;
  /**
   * Whether the document accepts local edits right now: `!disabled`,
   * `!readonly` and the binding's own write gate. Drives the presence `mode`.
   */
  readonly editable: Signal<boolean>;
  /** Emits through the editor's `editorError` output. */
  readonly reportError: (error: MlvEditorError) => void;
  /** Announces a message politely through the editor's live announcer. */
  readonly announce: (message: string) => void;
}

/**
 * @internal The contract between `mlv-editor` and the collaboration binding
 * that `@malva-ui/editor/collaboration` provides. It exists only so the sibling
 * entry of the same package, at the same version, can reach the editor; it is
 * outside semver (VERSIONING §2, members tagged `@internal`).
 *
 * The primary entry never imports Yjs: every Yjs value crosses this boundary
 * as `unknown` (an anchor) or behind a method.
 */
export interface MlvEditorCollaborationBinding {
  /**
   * The Tiptap extensions that bind the document to the shared state. Called
   * once, in the browser, before the editor is constructed; this is where the
   * session is created.
   */
  extensions(): Extensions;

  /** Whether a transaction was applied from the shared state (remote, seed, first render, Y undo). */
  isChangeOrigin(tr: Transaction): boolean;

  /** Whether a change-origin transaction is a local Y undo or redo. */
  isUndoRedo(tr: Transaction): boolean;

  /**
   * An opaque anchor for `pos` that survives remote edits, or `null` when the
   * binding has no mapping yet. Valid only while the shared state matches
   * `state` (after the sync plugin's view update).
   */
  anchor(state: EditorState, pos: number): unknown;

  /** The position an anchor resolves to in `state`, or `null` when its content is gone. */
  resolve(state: EditorState, anchor: unknown): number | null;

  /** Ends the current undo capture group, so the next local change is its own step. */
  stopCapturing(): void;

  /** Whether the session lets the user edit: synced once (or seeded offline) and not failed or closed. */
  readonly writable: Signal<boolean>;

  /** Turns `true` once, at the first sync or when the sync timeout passes. */
  readonly ready: Signal<boolean>;

  /** Increments on every undo-stack change, including ones with no transaction. */
  readonly undoRevision: Signal<number>;

  /** Starts the session against a created editor. */
  attach(context: MlvEditorCollaborationAttachContext): void;

  /** Ends the session. Idempotent; safe before `attach`. */
  detach(): void;
}

/**
 * @internal The collaboration binding of one editor, provided by the
 * `mlvEditorCollaboration` directive on the same element. `mlv-editor`
 * injects it with `{ optional: true, self: true }`.
 */
export const MLV_EDITOR_COLLABORATION =
  new InjectionToken<MlvEditorCollaborationBinding>('MLV_EDITOR_COLLABORATION');

/** @private Binding of each collaborating editor, for plugins that only see the editor. */
const bindings = new WeakMap<Editor, MlvEditorCollaborationBinding>();

/**
 * @internal Records the binding of a created editor. Not exported from the
 * package barrel.
 */
export function registerMlvEditorCollaborationBinding(
  editor: Editor,
  binding: MlvEditorCollaborationBinding,
): void {
  bindings.set(editor, binding);
}

/** @internal Forgets the binding of an editor that is being destroyed. */
export function unregisterMlvEditorCollaborationBinding(editor: Editor): void {
  bindings.delete(editor);
}

/** @internal The binding of `editor`, or `null` when it does not collaborate. */
export function mlvEditorCollaborationBindingFor(
  editor: Editor,
): MlvEditorCollaborationBinding | null {
  return bindings.get(editor) ?? null;
}

/**
 * @internal Whether `tr` came from the shared document: change-origin itself,
 * or appended to a change-origin transaction (a plugin's `appendTransaction`
 * answering a remote edit). `false` without a binding.
 */
export function mlvEditorIsChangeOrigin(
  editor: Editor,
  tr: Transaction,
): boolean {
  const binding = bindings.get(editor);
  if (!binding) return false;
  const root = tr.getMeta('appendedTransaction') as Transaction | undefined;
  return (
    binding.isChangeOrigin(tr) ||
    (root !== undefined && binding.isChangeOrigin(root))
  );
}

/**
 * @internal Whether `tr` is a peer's edit: change-origin (see
 * {@link mlvEditorIsChangeOrigin}) and not this client's own Y undo or redo.
 */
export function mlvEditorIsRemoteEdit(
  editor: Editor,
  tr: Transaction,
): boolean {
  if (!mlvEditorIsChangeOrigin(editor, tr)) return false;
  const binding = bindings.get(editor) as MlvEditorCollaborationBinding;
  const root =
    (tr.getMeta('appendedTransaction') as Transaction | undefined) ?? tr;
  return !binding.isUndoRedo(tr) && !binding.isUndoRedo(root);
}

/**
 * @internal The F1 AI guard (F-D15): whether AI transforms are refused for
 * `editor` because it collaborates. The current engine streams interim
 * chunks into the document, which the shared document would push to every
 * peer and then revert, and its whole-document restore would erase peers'
 * edits. Every AI entry point asks this one predicate.
 *
 * Reads the binding registry, not a signal: a binding is registered in the
 * same synchronous step that publishes the editor and never changes for that
 * editor's lifetime, so a `computed` that reads the editor signal first
 * stays correct.
 */
export function mlvEditorCollaborationBlocksAi(
  editor: Editor | null | undefined,
): boolean {
  return !!editor && bindings.has(editor);
}

/**
 * @internal Whether Tiptap's collaboration content check has disabled the
 * shared document because a remote document failed the schema check. Read
 * from the collaboration extension's storage, so the primary stays Yjs-free.
 */
export function mlvEditorCollaborationDisabled(editor: Editor): boolean {
  const storage = (editor.storage as unknown as Record<string, unknown>)[
    'collaboration'
  ] as { isDisabled?: unknown } | undefined;
  return storage?.isDisabled === true;
}

/**
 * @internal English fallback for `collaborationMoveCancelled`, which the block
 * handle (editor core) announces when a peer's edit cancels a local block move.
 * A blank pack value falls back to it too. Pinned equal to the English pack by
 * `collaboration-messages.spec.ts`; not exported from any barrel.
 */
export const MLV_EDITOR_COLLABORATION_MOVE_CANCELLED_FALLBACK =
  'Block move cancelled: someone else changed the document.';
