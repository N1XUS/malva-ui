import { signal } from '@angular/core';
import type { MlvEditorCollaborationAttachContext } from '@malva-ui/editor';
import {
  createDocument,
  type Editor,
  Extension,
  type JSONContent,
} from '@tiptap/core';
import type {} from '@tiptap/markdown';
import {
  type EditorState,
  Plugin,
  PluginKey,
  type Transaction,
} from '@tiptap/pm/state';
import {
  absolutePositionToRelativePosition,
  relativePositionToAbsolutePosition,
  ySyncPluginKey,
  yUndoPluginKey,
} from '@tiptap/y-tiptap';
import * as Y from 'yjs';
import { isMlvEditorCollaborationAnchorLost } from './collaboration-anchor';
import {
  checkMlvEditorCollaborationFragment,
  MlvEditorCollaborationSchemaGuard,
} from './collaboration-schema-guard';
import {
  MLV_EDITOR_COLLABORATION_META,
  MLV_EDITOR_COLLABORATION_SEEDED,
} from './collaboration-meta';
import { createMlvEditorCollaborationSeed } from './collaboration-seed';
import {
  MLV_EDITOR_COLLABORATION_SEED_ORIGIN,
  type MlvEditorCollaborationSession,
} from './collaboration-session';

/** @private The document an empty seed produces. */
const EMPTY_DOCUMENT: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

/** @private Undo-stack events that change what Undo / Redo can do. */
const UNDO_EVENTS = [
  'stack-item-added',
  'stack-item-popped',
  'stack-cleared',
] as const;

/** @private The y-tiptap sync plugin state this binder reads. */
interface SyncState {
  readonly type: Y.XmlFragment;
  readonly doc: Y.Doc;
  readonly binding: SyncBinding | null;
}

/** @private The part of y-tiptap's `ProsemirrorBinding` this binder uses. */
interface SyncBinding {
  readonly mapping: Map<Y.AbstractType<unknown>, unknown>;
  /** lib0 mutex: runs `run`, or `otherwise` while held. Every render and push goes through it. */
  mux: (run: () => void, otherwise?: () => void) => void;
  /** Unobserves the fragment. Idempotent. */
  destroy(): void;
}

/** @private The undo manager y-tiptap keeps in its undo plugin state. */
type UndoManager = Y.UndoManager;

/**
 * @internal The editor half of a collaboration binding: seeding (F-D6), the
 * N1 passes after the first sync (F-D16), anchors (F-D12), undo-stack events
 * (F-D10) and the content-check failure (F-D22). Browser only.
 */
export class MlvEditorCollaborationDocumentBinder {
  /** The document carried `mlv-editor.seeded` when the session was created. */
  readonly seededAtStart = signal(false);

  /** Increments on every undo-stack change. */
  readonly undoRevision = signal(0);

  /** @private The session whose document this binds. */
  private _session: MlvEditorCollaborationSession | null = null;
  /** @private The fragment name. */
  private _field = '';
  /** @private The initial content, read at the first sync. */
  private _initialContent: () => string | null = () => null;
  /** @private The attached context. */
  private _context: MlvEditorCollaborationAttachContext | null = null;
  /** @private The undo manager listened to. */
  private _undoManager: UndoManager | null = null;
  /** @private Set once the first sync was handled. */
  private _firstSyncHandled = false;

  /** @private Bumps the undo revision. */
  private readonly _onUndoStack = (): void =>
    this.undoRevision.update((value) => value + 1);

  /** @private Reacts to the content check disabling the shared document. */
  private _onContentError: ((event: { error: Error }) => void) | null = null;

  /** @private Validates remote transactions against the schema (D-F9), while attached. */
  private _guard: MlvEditorCollaborationSchemaGuard | null = null;

  /** @private A schema mismatch the pre-bind check found in a host document (D-F9). */
  private _rejectedBeforeBind: { readonly error: unknown } | null = null;

  /**
   * Returns the extension that checks the whole shared fragment before
   * y-tiptap renders it (D-F9), for a host document that already holds
   * content. Its plugin view runs before y-tiptap's (priority 1001 over
   * `Collaboration`'s 1000), so on a mismatch the binding renders nothing and
   * `attach()` fails the session instead of starting it.
   */
  schemaGuard(): Extension {
    return Extension.create({
      name: 'mlvEditorCollaborationSchemaGuard',
      priority: 1001,
      addProseMirrorPlugins: () => [
        new Plugin({
          key: new PluginKey('mlvEditorCollaborationSchemaGuard'),
          view: (view) => {
            const sync = syncState(view.state);
            if (sync?.binding) {
              try {
                checkMlvEditorCollaborationFragment(
                  sync.type,
                  view.state.schema,
                );
              } catch (error) {
                muteBinding(sync.binding);
                this._rejectedBeforeBind = { error };
              }
            }
            return {};
          },
        }),
      ],
    });
  }

  /** Records the session, before the editor exists. */
  prepare(
    session: MlvEditorCollaborationSession,
    field: string,
    initialContent: () => string | null,
  ): void {
    this._session = session;
    this._field = field;
    this._initialContent = initialContent;
    this.seededAtStart.set(
      session.doc
        .getMap(MLV_EDITOR_COLLABORATION_META)
        .get(MLV_EDITOR_COLLABORATION_SEEDED) === true,
    );
  }

  /**
   * Starts listening to the created editor. Returns `false` when the shared
   * document failed the pre-bind schema check: the binding is cut, `fail` was
   * called, and the session must not start.
   */
  attach(
    context: MlvEditorCollaborationAttachContext,
    fail: (cause: unknown) => void,
  ): boolean {
    this._context = context;
    const editor = context.editor;
    const undoManager = (
      yUndoPluginKey.getState(editor.state) as
        | { undoManager?: UndoManager }
        | undefined
    )?.undoManager;
    if (undoManager) {
      this._undoManager = undoManager;
      for (const event of UNDO_EVENTS) undoManager.on(event, this._onUndoStack);
    }
    const rejected = this._rejectedBeforeBind;
    if (rejected) {
      this._cut();
      fail(rejected.error);
      return false;
    }
    const reject = (error: unknown): void => {
      this._cut();
      fail(error);
    };
    this._onContentError = ({ error }) => {
      // Only the collaboration content check disables the shared document.
      if (collaborationDisabled(editor)) reject(error);
    };
    editor.on('contentError', this._onContentError);
    const sync = syncState(editor.state);
    if (sync)
      this._guard = new MlvEditorCollaborationSchemaGuard(
        sync.type,
        editor.schema,
        reject,
      );
    return true;
  }

  /** Stops listening. Idempotent. */
  detach(): void {
    this._guard?.dispose();
    this._guard = null;
    if (this._onContentError)
      this._context?.editor.off('contentError', this._onContentError);
    this._onContentError = null;
    for (const event of UNDO_EVENTS)
      this._undoManager?.off(event, this._onUndoStack);
    this._undoManager = null;
    this._context = null;
  }

  /** After every sync: the first one seeds an empty document and runs the N1 passes. */
  onSynced(): void {
    const session = this._session;
    const context = this._context;
    if (
      this._firstSyncHandled ||
      !session ||
      !context ||
      context.editor.isDestroyed
    )
      return;
    this._firstSyncHandled = true;
    const fragment = session.doc.getXmlFragment(this._field);
    const meta = session.doc.getMap(MLV_EDITOR_COLLABORATION_META);
    if (
      fragment.length === 0 &&
      meta.get(MLV_EDITOR_COLLABORATION_SEEDED) !== true
    ) {
      try {
        const update = createMlvEditorCollaborationSeed(
          this._seedContent(context),
          {
            schema: context.editor.schema,
            field: this._field,
          },
        );
        Y.applyUpdate(
          session.doc,
          update,
          MLV_EDITOR_COLLABORATION_SEED_ORIGIN,
        );
      } catch (cause) {
        context.reportError({
          code: 'collaboration',
          message: 'The initial collaboration content could not be seeded.',
          recoverable: true,
          cause,
        });
      }
    }
    runCommand(context.editor, 'ensureBlockIds');
    runCommand(context.editor, 'ensureHeadingAnchors');
  }

  /** Whether a change-origin transaction is a local Y undo or redo. */
  isUndoRedo(tr: Transaction): boolean {
    const meta = tr.getMeta(ySyncPluginKey) as
      | { isUndoRedoOperation?: unknown }
      | undefined;
    return meta?.isUndoRedoOperation === true;
  }

  /** A Yjs relative position for `pos`, or `null` without a mapping. */
  anchor(state: EditorState, pos: number): unknown {
    const sync = syncState(state);
    if (!sync?.binding || pos < 0 || pos > state.doc.content.size) return null;
    try {
      return absolutePositionToRelativePosition(
        pos,
        sync.type,
        sync.binding.mapping as never,
      );
    } catch {
      return null;
    }
  }

  /**
   * The position of an anchor in `state`, or `null` when its content is gone.
   * Yjs decides loss first (D-F8); y-tiptap only computes the number.
   */
  resolve(state: EditorState, anchor: unknown): number | null {
    const sync = syncState(state);
    if (!(anchor instanceof Y.RelativePosition) || !sync?.binding) return null;
    try {
      if (isMlvEditorCollaborationAnchorLost(sync.doc, anchor)) return null;
      const pos = relativePositionToAbsolutePosition(
        sync.doc,
        sync.type,
        anchor,
        sync.binding.mapping as never,
      );
      return pos !== null && pos >= 0 && pos <= state.doc.content.size
        ? pos
        : null;
    } catch {
      return null;
    }
  }

  /** Ends the current undo capture group. */
  stopCapturing(): void {
    this._undoManager?.stopCapturing();
  }

  /**
   * @private Cuts the editor off the shared document for good (D-F9, F-D22):
   * y-tiptap stops observing it, renders nothing more and pushes nothing
   * more — its view update would otherwise write the stale editor document
   * back, deleting what the editor did not render — and the undo stacks are
   * dropped so a Y undo cannot write either. The shared document is not
   * modified.
   */
  private _cut(): void {
    this._guard?.dispose();
    this._guard = null;
    const context = this._context;
    const binding =
      context && !context.editor.isDestroyed
        ? syncState(context.editor.state)?.binding
        : null;
    if (binding) {
      muteBinding(binding);
      binding.destroy();
    }
    this._undoManager?.clear();
  }

  /** @private The initial content as PM JSON, parsed in the editor's format. */
  private _seedContent(
    context: MlvEditorCollaborationAttachContext,
  ): JSONContent {
    const text = this._initialContent();
    if (text === null || text.trim() === '') return EMPTY_DOCUMENT;
    switch (context.format) {
      case 'json':
        return JSON.parse(text) as JSONContent;
      case 'markdown': {
        const markdown = context.editor.markdown;
        if (!markdown)
          throw new Error('Markdown is not available in this editor.');
        return markdown.parse(text);
      }
      default:
        return createDocument(text, context.editor.schema, undefined, {
          errorOnInvalidContent: true,
        }).toJSON() as JSONContent;
    }
  }
}

/** @private The y-tiptap sync plugin state, when the plugin is installed. */
const syncState = (state: EditorState): SyncState | null =>
  (ySyncPluginKey.getState(state) as SyncState | undefined) ?? null;

/**
 * @private Holds y-tiptap's mutex for good: every render (`_typeChanged`,
 * `_forceRerender`) and every push from the editor (the plugin view update)
 * runs through `binding.mux`, which now always takes the busy branch.
 */
const muteBinding = (binding: SyncBinding): void => {
  binding.mux = (_run, otherwise) => otherwise?.();
};

/** @private Whether Tiptap's collaboration content check disabled the shared document. */
const collaborationDisabled = (editor: Editor): boolean =>
  (editor.storage as unknown as { collaboration?: { isDisabled?: unknown } })
    .collaboration?.isDisabled === true;

/** @private Runs a command by name when an installed extension provides it. */
const runCommand = (editor: Editor, name: string): void => {
  const command = (editor.commands as unknown as Record<string, unknown>)[name];
  if (typeof command === 'function') (command as () => boolean)();
};
