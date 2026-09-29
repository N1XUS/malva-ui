import {
  computed,
  DestroyRef,
  Directive,
  effect,
  forwardRef,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import {
  MLV_EDITOR_COLLABORATION,
  type MlvEditorCollaborationAttachContext,
  type MlvEditorCollaborationBinding,
} from '@malva-ui/editor';
import type { Extensions } from '@tiptap/core';
import { Collaboration, isChangeOrigin } from '@tiptap/extension-collaboration';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import type { Doc } from 'yjs';
import { createMlvEditorCollaborationCarets } from './collaboration-carets';
import { MlvEditorCollaborationDocumentBinder } from './collaboration-document';
import {
  injectMlvEditorCollaborationMessages,
  type MlvEditorCollaborationMessageKey,
} from './collaboration-messages';
import {
  mlvEditorCollaborationAwarenessUser,
  readMlvEditorCollaborationPeer,
  sameMlvEditorCollaborationPeers,
} from './collaboration-peers';
import { MLV_EDITOR_COLLABORATION_DEFAULT_FIELD } from './collaboration-meta';
import { MlvEditorCollaborationSession } from './collaboration-session';
import type { MlvEditorCollaborationTransport } from './collaboration-transport';
import type {
  MlvEditorCollaborationPeer,
  MlvEditorCollaborationStatus,
  MlvEditorCollaborationUser,
} from './collaboration.types';

/** @private Shared empty peer list. */
const NO_PEERS: readonly MlvEditorCollaborationPeer[] = [];

/** @private The inputs read once, when the session is created. */
interface CreationInputs {
  readonly transport: MlvEditorCollaborationTransport;
  readonly documentId: string;
  readonly document: Doc | null;
  readonly field: string;
}

/**
 * Real-time collaboration for one `mlv-editor`: binds its document to a
 * shared Yjs document synced through a host transport, and exposes the
 * session state and the peers present. The transport, document id, document
 * and field are read once, when the editor is created; re-create the editor
 * (`@for … track documentId`) to switch documents. Browser only: on the
 * server the directive creates nothing.
 */
@Directive({
  selector: 'mlv-editor[mlvEditorCollaboration]',
  exportAs: 'mlvEditorCollaboration',
  providers: [
    {
      provide: MLV_EDITOR_COLLABORATION,
      useExisting: forwardRef(() => MlvEditorCollaboration),
    },
  ],
})
export class MlvEditorCollaboration implements MlvEditorCollaborationBinding {
  /** The host transport. Read once, when the editor is created. */
  readonly mlvEditorCollaboration =
    input.required<MlvEditorCollaborationTransport>();

  /** The document key passed to the transport. Read once. */
  readonly collaborationDocumentId = input.required<string>();

  /** The local identity shown to peers. Live. Defaults to an anonymous name. */
  readonly collaborationUser = input<MlvEditorCollaborationUser | null>(null);

  /**
   * Seed content in the editor's `format`, applied only when the first sync
   * finds the shared document empty and never seeded. Prefer seeding on the
   * server with `createMlvEditorCollaborationSeed`.
   */
  readonly collaborationInitialContent = input<string | null>(null);

  /**
   * A host-owned `Y.Doc` (e.g. bound to `y-indexeddb`). Exclusive to this
   * editor and never destroyed by the library. Read once.
   */
  readonly collaborationDocument = input<Doc | null>(null);

  /** The shared fragment name. Read once. */
  readonly collaborationField = input<string>(
    MLV_EDITOR_COLLABORATION_DEFAULT_FIELD,
  );

  /**
   * Milliseconds to wait for the first sync before going `offline` and
   * emitting `editorReady` (still read-only unless the document was seeded).
   */
  readonly collaborationSyncTimeout = input<number>(10_000);

  /** Emits on every status change. */
  readonly collaborationStatusChange = output<MlvEditorCollaborationStatus>();

  /** Emits when the peer set, or a peer's identity or mode, changes. */
  readonly collaborationPeersChange =
    output<readonly MlvEditorCollaborationPeer[]>();

  /** @private The session, from `extensions()` until `detach()`. */
  private readonly _session = signal<MlvEditorCollaborationSession | null>(
    null,
  );

  /** @private The attached editor context, from `attach()` until `detach()`. */
  private readonly _context =
    signal<MlvEditorCollaborationAttachContext | null>(null);

  /** @private The document binder: seeding, N1 passes, anchors, undo. */
  private readonly _binder = new MlvEditorCollaborationDocumentBinder();

  /** @private Collaboration copy: the active `MLV_EDITOR_I18N` pack, else English. */
  private readonly _messages = injectMlvEditorCollaborationMessages();

  /** @private The creation inputs, to report a later change once. */
  private _creation: CreationInputs | null = null;

  /** @private Set once a read-once input change was reported. */
  private _configurationReported = false;

  /** @private Set once by `detach()`. */
  private _detached = false;

  /** Session state; `idle` on the server and before the editor attached. */
  readonly status = computed<MlvEditorCollaborationStatus>(
    () => this._session()?.status() ?? 'idle',
  );

  /** Remote peers, excluding this client, in client-id order. */
  readonly peers = computed<readonly MlvEditorCollaborationPeer[]>(
    () => {
      const session = this._session();
      if (!session) return NO_PEERS;
      session.awarenessRevision();
      const anonymous = this._messages.templates().collaborationAnonymous;
      const peers: MlvEditorCollaborationPeer[] = [];
      session.awareness.getStates().forEach((state, clientId) => {
        if (clientId !== session.doc.clientID) {
          peers.push(
            readMlvEditorCollaborationPeer(clientId, state, anonymous),
          );
        }
      });
      return peers.sort((a, b) => a.clientId - b.clientId);
    },
    { equal: sameMlvEditorCollaborationPeers },
  );

  /** This client's presence as peers see it, or `null` while it publishes none. */
  readonly self = computed<MlvEditorCollaborationPeer | null>(
    () => {
      const session = this._session();
      if (!session) return null;
      session.awarenessRevision();
      const state = session.awareness.getLocalState();
      return state === null
        ? null
        : readMlvEditorCollaborationPeer(
            session.doc.clientID,
            state,
            this._messages.templates().collaborationAnonymous,
          );
    },
    {
      equal: (a, b) =>
        a === null || b === null
          ? a === b
          : sameMlvEditorCollaborationPeers([a], [b]),
    },
  );

  /** A sync step 2 arrived on the current connection. */
  readonly synced = computed(() => this._session()?.synced() ?? false);

  /** At least one sync ever; opens the write gate. */
  readonly hasSynced = computed(() => this._session()?.hasSynced() ?? false);

  /** Local edits made while they could not be sent, until the next handshake completes. */
  readonly hasUnsyncedChanges = computed(
    () => this._session()?.hasUnsyncedChanges() ?? false,
  );

  /** The `Y.Doc` in use, for snapshots and persistence. `null` on the server. */
  readonly document = computed<Doc | null>(() => this._session()?.doc ?? null);

  /**
   * @internal Whether the session lets the user edit: synced once, or the
   * document already carried the seed flag, and not failed or closed.
   */
  readonly writable = computed(() => {
    const session = this._session();
    if (!session) return false;
    const status = session.status();
    if (status === 'failed' || status === 'closed') return false;
    return session.hasSynced() || this._binder.seededAtStart();
  });

  /** @internal `true` once: at the first sync, the sync timeout, or a terminal status. */
  readonly ready = computed(() => {
    const session = this._session();
    if (!session) return false;
    const status = session.status();
    return (
      session.hasSynced() ||
      session.timedOut() ||
      status === 'failed' ||
      status === 'closed'
    );
  });

  /** @internal Increments on every undo-stack change. */
  readonly undoRevision = this._binder.undoRevision;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.detach());

    // Presence: publish the user and the mode the write gate implies.
    effect(() => {
      const session = this._session();
      const context = this._context();
      if (!session || !context) return;
      const mode = context.editable() ? 'editing' : 'viewing';
      const user = mlvEditorCollaborationAwarenessUser(
        this.collaborationUser(),
        mode,
        this._messages.templates().collaborationAnonymous,
      );
      untracked(() => {
        if (!this._detached) session.awareness.setLocalStateField('user', user);
      });
    });

    // Read-once inputs: a later change is reported once and otherwise ignored.
    effect(() => {
      const current: CreationInputs = {
        transport: this.mlvEditorCollaboration(),
        documentId: this.collaborationDocumentId(),
        document: this.collaborationDocument(),
        field: this.collaborationField(),
      };
      const context = this._context();
      const creation = this._creation;
      if (!context || !creation || this._configurationReported) return;
      if (
        current.transport !== creation.transport ||
        current.documentId !== creation.documentId ||
        current.document !== creation.document ||
        current.field !== creation.field
      ) {
        this._configurationReported = true;
        untracked(() =>
          context.reportError({
            code: 'configuration',
            message:
              'Collaboration transport, document id, document and field are read once; re-create the editor to change them.',
            recoverable: true,
          }),
        );
      }
    });

    this._emitChanges();
    this._announceStatus();
  }

  /** @internal Creates the session and returns the extensions that bind the editor to it. */
  extensions(): Extensions {
    if (this._detached) return [];
    let session = untracked(this._session);
    if (!session) {
      const creation: CreationInputs = untracked(() => ({
        transport: this.mlvEditorCollaboration(),
        documentId: this.collaborationDocumentId(),
        document: this.collaborationDocument(),
        field: this.collaborationField(),
      }));
      this._creation = creation;
      session = new MlvEditorCollaborationSession({
        transport: creation.transport,
        documentId: creation.documentId,
        document: creation.document,
        syncTimeout: () => untracked(this.collaborationSyncTimeout),
        onError: (error) => untracked(this._context)?.reportError(error),
        onSynced: () => this._binder.onSynced(),
      });
      this._binder.prepare(session, creation.field, () =>
        untracked(this.collaborationInitialContent),
      );
      this._session.set(session);
    }
    return [
      this._binder.schemaGuard(),
      Collaboration.configure({
        document: session.doc,
        field: this._creation?.field,
      }),
      createMlvEditorCollaborationCarets({
        awareness: session.awareness,
        anonymous: () =>
          untracked(this._messages.templates).collaborationAnonymous,
      }),
    ];
  }

  /** @internal Whether a transaction was applied from the shared document. */
  isChangeOrigin(tr: Transaction): boolean {
    return isChangeOrigin(tr);
  }

  /** @internal Whether a change-origin transaction is a local Y undo or redo. */
  isUndoRedo(tr: Transaction): boolean {
    return this._binder.isUndoRedo(tr);
  }

  /** @internal A Yjs relative position for `pos`, or `null` without a mapping. */
  anchor(state: EditorState, pos: number): unknown {
    return this._binder.anchor(state, pos);
  }

  /** @internal The position of an anchor in `state`, or `null` when lost. */
  resolve(state: EditorState, anchor: unknown): number | null {
    return this._binder.resolve(state, anchor);
  }

  /** @internal Ends the current undo capture group. */
  stopCapturing(): void {
    this._binder.stopCapturing();
  }

  /** @internal Starts the session against the created editor. */
  attach(context: MlvEditorCollaborationAttachContext): void {
    const session = untracked(this._session);
    if (this._detached || !session || untracked(this._context)) return;
    this._context.set(context);
    // A host document that fails the schema check never starts (D-F9).
    if (!this._binder.attach(context, (cause) => session.fail(cause))) return;
    // Publish presence before the handshake, so the first frames carry it.
    session.awareness.setLocalStateField(
      'user',
      mlvEditorCollaborationAwarenessUser(
        untracked(this.collaborationUser),
        untracked(context.editable) ? 'editing' : 'viewing',
        untracked(this._messages.templates).collaborationAnonymous,
      ),
    );
    session.start();
  }

  /** @internal Ends the session (F-D3 teardown order). Idempotent. */
  detach(): void {
    if (this._detached) return;
    this._detached = true;
    this._binder.detach();
    untracked(this._session)?.destroy();
    this._context.set(null);
  }

  /**
   * @private Announces connection changes politely through the editor's live
   * announcer (F-D19, WCAG 4.1.3): a synced session going offline, coming back,
   * failing or closing, and the first sync timing out. The initial connect and
   * peer joins and leaves are not announced.
   */
  private _announceStatus(): void {
    let previous: MlvEditorCollaborationStatus = 'idle';
    let timeoutAnnounced = false;
    let owesBackOnline = false;
    effect(() => {
      const status = this.status();
      const timedOut = this._session()?.timedOut() ?? false;
      const context = this._context();
      untracked(() => {
        const last = previous;
        previous = status;
        if (!context || this._detached) return;
        const say = (key: MlvEditorCollaborationMessageKey) =>
          context.announce(this._messages.format(key));
        if (timedOut && !timeoutAnnounced && status !== 'synced') {
          timeoutAnnounced = true;
          owesBackOnline = true;
          say('collaborationSyncTimeout');
          return;
        }
        if (status === last) return;
        if (status === 'failed') say('collaborationFailed');
        else if (status === 'closed') say('collaborationClosed');
        else if (status === 'offline' && last === 'synced') {
          owesBackOnline = true;
          say('collaborationOffline');
        } else if (status === 'synced' && owesBackOnline) {
          owesBackOnline = false;
          say('collaborationBackOnline');
        }
      });
    });
  }

  /** @private Emits the status and peer outputs on change. */
  private _emitChanges(): void {
    let status: MlvEditorCollaborationStatus = 'idle';
    effect(() => {
      const next = this.status();
      if (next === status) return;
      status = next;
      untracked(() => this.collaborationStatusChange.emit(next));
    });
    let peers = NO_PEERS;
    effect(() => {
      const next = this.peers();
      if (next === peers) return;
      peers = next;
      untracked(() => this.collaborationPeersChange.emit(next));
    });
  }
}
