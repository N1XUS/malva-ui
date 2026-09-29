import { signal } from '@angular/core';
import type { MlvEditorError } from '@malva-ui/editor';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import { Subject, type Subscription } from 'rxjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';
import {
  MLV_EDITOR_COLLABORATION_FRAME_AUTH,
  MLV_EDITOR_COLLABORATION_FRAME_AWARENESS,
  MLV_EDITOR_COLLABORATION_FRAME_QUERY_AWARENESS,
  MLV_EDITOR_COLLABORATION_FRAME_SYNC,
} from './collaboration-frame';
import type {
  MlvEditorCollaborationTransport,
  MlvEditorCollaborationTransportEvent,
} from './collaboration-transport';
import type { MlvEditorCollaborationStatus } from './collaboration.types';

/** @internal Yjs origin of every update applied from the wire; never echoed. */
export const MLV_EDITOR_COLLABORATION_SESSION_ORIGIN = Symbol(
  'mlv-editor-collaboration-session',
);

/** @internal Yjs origin of a client-fallback seed; not a tracked undo origin. */
export const MLV_EDITOR_COLLABORATION_SEED_ORIGIN = Symbol(
  'mlv-editor-collaboration-seed',
);

/** @internal What a session needs from its owner. */
export interface MlvEditorCollaborationSessionOptions {
  readonly transport: MlvEditorCollaborationTransport;
  readonly documentId: string;
  /** A host-owned document, never destroyed by the session; `null` creates one. */
  readonly document: Y.Doc | null;
  /** Read when the first-sync wait starts. */
  readonly syncTimeout: () => number;
  readonly onError: (error: MlvEditorError) => void;
  /** Called after every inbound sync step 2. */
  readonly onSynced?: () => void;
  /** Called once, when the first sync did not arrive in time. */
  readonly onTimeout?: () => void;
}

/** @private Statuses a session never leaves. */
const TERMINAL: ReadonlySet<MlvEditorCollaborationStatus> = new Set([
  'failed',
  'closed',
]);

/**
 * @internal The protocol engine of one collaborating editor (F-D4 / F-D5):
 * owns the `Awareness`, optionally the `Y.Doc`, the transport subscription,
 * the handshake, echo suppression and the first-sync timeout. Browser only.
 */
export class MlvEditorCollaborationSession {
  /** The shared document. */
  readonly doc: Y.Doc;
  /** Whether the session created, and so destroys, `doc`. */
  readonly ownsDoc: boolean;
  /** Presence state of every client, the local one included. */
  readonly awareness: awarenessProtocol.Awareness;
  /** Session state. */
  readonly status = signal<MlvEditorCollaborationStatus>('idle');
  /** A step 2 arrived on the current connection. */
  readonly synced = signal(false);
  /** At least one sync ever. */
  readonly hasSynced = signal(false);
  /** The first sync did not arrive within the timeout. */
  readonly timedOut = signal(false);
  /** Local changes made while they could not be sent, until the next handshake completes. */
  readonly hasUnsyncedChanges = signal(false);
  /** Increments on every awareness `change` (not on renewals). */
  readonly awarenessRevision = signal(0);

  /** @private Frames to send; the transport's `outbound`. */
  private readonly _outbound = new Subject<Uint8Array>();
  /** @private The last connection state the transport reported was `connected`. */
  private _connected = false;
  /** @private The transport subscription, while subscribed. */
  private _subscription: Subscription | null = null;
  /** @private The pending first-sync timeout. */
  private _timer: ReturnType<typeof setTimeout> | null = null;
  /** @private Set once by `destroy()`. */
  private _destroyed = false;

  /** @private Sends every non-session document update, or records it as unsynced. */
  private readonly _onDocUpdate = (
    update: Uint8Array,
    origin: unknown,
  ): void => {
    if (origin === MLV_EDITOR_COLLABORATION_SESSION_ORIGIN) return;
    if (!this._connected) {
      this.hasUnsyncedChanges.set(true);
      return;
    }
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MLV_EDITOR_COLLABORATION_FRAME_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    this._send(encoding.toUint8Array(encoder));
  };

  /** @private Sends local awareness changes (edits and the 15 s renewal). */
  private readonly _onAwarenessUpdate = (
    changes: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ): void => {
    if (origin !== 'local') return;
    this._sendAwareness([
      ...changes.added,
      ...changes.updated,
      ...changes.removed,
    ]);
  };

  /** @private Tracks presence changes for the peers signal. */
  private readonly _onAwarenessChange = (): void => {
    this.awarenessRevision.update((revision) => revision + 1);
  };

  constructor(private readonly _options: MlvEditorCollaborationSessionOptions) {
    this.ownsDoc = _options.document === null;
    this.doc = _options.document ?? new Y.Doc();
    this.awareness = new awarenessProtocol.Awareness(this.doc);
    this.doc.on('update', this._onDocUpdate);
    this.awareness.on('update', this._onAwarenessUpdate);
    this.awareness.on('change', this._onAwarenessChange);
  }

  /** Subscribes to the transport and starts the first-sync wait. */
  start(): void {
    if (this._destroyed || this._subscription || TERMINAL.has(this.status()))
      return;
    this.status.set('connecting');
    this._startTimeout();
    try {
      const subscription = this._options.transport
        .connect({
          documentId: this._options.documentId,
          clientId: this.doc.clientID,
          outbound: this._outbound.asObservable(),
        })
        .subscribe({
          next: (event) => this._onEvent(event),
          error: (cause: unknown) =>
            this._terminate(
              'failed',
              'The collaboration transport failed.',
              cause,
            ),
          complete: () =>
            this._terminate('closed', 'The collaboration session was closed.'),
        });
      // A session that ended during `subscribe` (a transport that errored or
      // completed synchronously, a frame that failed the schema check) could
      // not unsubscribe yet: do it now.
      if (TERMINAL.has(this.status())) subscription.unsubscribe();
      else this._subscription = subscription;
    } catch (cause) {
      this._terminate('failed', 'The collaboration transport failed.', cause);
    }
  }

  /** Ends the session read-only after the shared document failed the schema check. */
  fail(cause: unknown): void {
    this._terminate(
      'failed',
      'The shared document does not match this editor.',
      cause,
    );
  }

  /** Tears the session down in the F-D3 order. Idempotent. */
  destroy(): void {
    if (this._destroyed) return;
    this._clearTimeout();
    // Peers drop the caret now instead of after the 30 s awareness timeout;
    // sent before the session counts as destroyed, which stops all sending.
    if (this.awareness.getLocalState() !== null)
      this.awareness.setLocalState(null);
    this._destroyed = true;
    this._connected = false;
    this._outbound.complete();
    this._subscription?.unsubscribe();
    this._subscription = null;
    this.awareness.off('update', this._onAwarenessUpdate);
    this.awareness.off('change', this._onAwarenessChange);
    this.awareness.destroy();
    this.doc.off('update', this._onDocUpdate);
    if (this.ownsDoc) this.doc.destroy();
  }

  /** @private Dispatches one transport event. */
  private _onEvent(event: MlvEditorCollaborationTransportEvent): void {
    if (this._destroyed || TERMINAL.has(this.status())) return;
    if (event.type === 'message') {
      this._receive(event.data);
      return;
    }
    switch (event.state) {
      case 'connected':
        this._connected = true;
        this.synced.set(false);
        this.status.set('syncing');
        this._handshake();
        break;
      case 'disconnected': {
        this._connected = false;
        this.synced.set(false);
        const remote = [...this.awareness.getStates().keys()].filter(
          (clientId) => clientId !== this.doc.clientID,
        );
        awarenessProtocol.removeAwarenessStates(
          this.awareness,
          remote,
          MLV_EDITOR_COLLABORATION_SESSION_ORIGIN,
        );
        this.status.set('offline');
        break;
      }
      case 'connecting':
        this._connected = false;
        this.status.set('connecting');
        break;
    }
  }

  /** @private The F-D4 handshake, sent on every `connected`. */
  private _handshake(): void {
    const step1 = encoding.createEncoder();
    encoding.writeVarUint(step1, MLV_EDITOR_COLLABORATION_FRAME_SYNC);
    syncProtocol.writeSyncStep1(step1, this.doc);
    this._send(encoding.toUint8Array(step1));
    if (this.awareness.getLocalState() !== null)
      this._sendAwareness([this.doc.clientID]);
    const query = encoding.createEncoder();
    encoding.writeVarUint(
      query,
      MLV_EDITOR_COLLABORATION_FRAME_QUERY_AWARENESS,
    );
    this._send(encoding.toUint8Array(query));
    if (this._options.transport.relay) {
      // A relay has no state and never asks: push ours in full.
      const step2 = encoding.createEncoder();
      encoding.writeVarUint(step2, MLV_EDITOR_COLLABORATION_FRAME_SYNC);
      syncProtocol.writeSyncStep2(step2, this.doc);
      this._send(encoding.toUint8Array(step2));
    }
  }

  /** @private Decodes and applies one inbound frame; a malformed one is dropped. */
  private _receive(data: Uint8Array): void {
    let synced = false;
    try {
      const decoder = decoding.createDecoder(data);
      switch (decoding.readVarUint(decoder)) {
        case MLV_EDITOR_COLLABORATION_FRAME_SYNC: {
          const reply = encoding.createEncoder();
          encoding.writeVarUint(reply, MLV_EDITOR_COLLABORATION_FRAME_SYNC);
          const type = syncProtocol.readSyncMessage(
            decoder,
            reply,
            this.doc,
            MLV_EDITOR_COLLABORATION_SESSION_ORIGIN,
          );
          if (encoding.length(reply) > 1)
            this._send(encoding.toUint8Array(reply));
          synced = type === syncProtocol.messageYjsSyncStep2;
          break;
        }
        case MLV_EDITOR_COLLABORATION_FRAME_AWARENESS:
          awarenessProtocol.applyAwarenessUpdate(
            this.awareness,
            decoding.readVarUint8Array(decoder),
            MLV_EDITOR_COLLABORATION_SESSION_ORIGIN,
          );
          break;
        case MLV_EDITOR_COLLABORATION_FRAME_QUERY_AWARENESS:
          this._sendAwareness([...this.awareness.getStates().keys()]);
          break;
        case MLV_EDITOR_COLLABORATION_FRAME_AUTH:
        default:
          break;
      }
    } catch (cause) {
      this._options.onError({
        code: 'collaboration',
        message: 'A malformed collaboration frame was dropped.',
        recoverable: true,
        cause,
      });
      return;
    }
    if (synced) this._markSynced();
  }

  /** @private Records a completed sync on the current connection. */
  private _markSynced(): void {
    if (!this._connected) return;
    this._clearTimeout();
    this.synced.set(true);
    this.hasSynced.set(true);
    this.hasUnsyncedChanges.set(false);
    this.status.set('synced');
    this._options.onSynced?.();
  }

  /** @private Sends an awareness update for `clientIds`. */
  private _sendAwareness(clientIds: readonly number[]): void {
    if (!this._connected || clientIds.length === 0) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MLV_EDITOR_COLLABORATION_FRAME_AWARENESS);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(this.awareness, [...clientIds]),
    );
    this._send(encoding.toUint8Array(encoder));
  }

  /** @private Pushes a frame to `outbound`, only while connected (no queue). */
  private _send(frame: Uint8Array): void {
    if (this._connected && !this._destroyed) this._outbound.next(frame);
  }

  /** @private Starts the first-sync wait, unless a sync already happened. */
  private _startTimeout(): void {
    if (this.hasSynced()) return;
    this._timer = setTimeout(
      () => {
        this._timer = null;
        if (this.hasSynced() || this._destroyed) return;
        this.timedOut.set(true);
        if (!TERMINAL.has(this.status())) this.status.set('offline');
        this._options.onError({
          code: 'collaboration',
          message: 'The shared document did not sync in time.',
          recoverable: true,
        });
        this._options.onTimeout?.();
      },
      Math.max(0, this._options.syncTimeout()),
    );
  }

  /** @private Cancels the first-sync wait. */
  private _clearTimeout(): void {
    if (this._timer !== null) clearTimeout(this._timer);
    this._timer = null;
  }

  /** @private Ends the transport for good: `failed` or `closed`, read-only. */
  private _terminate(
    status: 'failed' | 'closed',
    message: string,
    cause?: unknown,
  ): void {
    if (this._destroyed || TERMINAL.has(this.status())) return;
    this._connected = false;
    this.synced.set(false);
    this._clearTimeout();
    this.status.set(status);
    const subscription = this._subscription;
    this._subscription = null;
    subscription?.unsubscribe();
    this._options.onError({
      code: 'collaboration',
      message,
      recoverable: false,
      cause,
    });
  }
}
