import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import { Observable, type Subscriber, type Subscription } from 'rxjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';
import {
  MLV_EDITOR_COLLABORATION_FRAME_AWARENESS,
  MLV_EDITOR_COLLABORATION_FRAME_QUERY_AWARENESS,
  MLV_EDITOR_COLLABORATION_FRAME_SYNC,
} from '../collaboration-frame';
import {
  MlvEditorCollaborationTransport,
  type MlvEditorCollaborationTransportContext,
  type MlvEditorCollaborationTransportEvent,
} from '../collaboration-transport';

/*
 * Spec-only harness, never exported: an in-memory relay (fan-out, no state)
 * or an in-memory Yjs server peer answering like y-websocket. Frames are
 * queued and delivered on a microtask (or after `latency` ms); `pause()` holds
 * them for `deliverNext()` / `flush()`, so interleavings are deterministic.
 */

/** Harness topology. */
export type MemoryTopology = 'relay' | 'server';

/** @private One frame in flight. */
interface Envelope {
  readonly from: MemoryTransport | null;
  readonly to: MemoryTransport;
  readonly data: Uint8Array;
}

/** An in-memory collaboration hub. */
export class MemoryCollaborationHub {
  /** Every endpoint created, in order. */
  readonly endpoints: MemoryTransport[] = [];
  /** The server peer's document (`server` topology only). */
  readonly serverDoc: Y.Doc | null;
  /** @private The server peer's awareness (`server` topology only). */
  private readonly _serverAwareness: awarenessProtocol.Awareness | null;
  /** @private Frames not delivered yet. */
  private readonly _queue: Envelope[] = [];
  /** @private Whether automatic delivery is held. */
  private _paused = false;
  /** @private Whether a drain is scheduled. */
  private _scheduled = false;

  constructor(
    readonly topology: MemoryTopology,
    private readonly _options: {
      readonly latency?: number;
      readonly autoConnect?: boolean;
    } = {},
  ) {
    this.serverDoc = topology === 'server' ? new Y.Doc() : null;
    this._serverAwareness = this.serverDoc
      ? new awarenessProtocol.Awareness(this.serverDoc)
      : null;
    this._serverAwareness?.setLocalState(null);
    this.serverDoc?.on('update', (update: Uint8Array, origin: unknown) => {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MLV_EDITOR_COLLABORATION_FRAME_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      this._broadcast(
        encoding.toUint8Array(encoder),
        origin instanceof MemoryTransport ? origin : null,
      );
    });
  }

  /** Whether an endpoint goes `connected` as soon as it is subscribed. */
  get autoConnect(): boolean {
    return this._options.autoConnect ?? true;
  }

  /** Creates a transport endpoint. */
  endpoint(): MemoryTransport {
    const endpoint = new MemoryTransport(this);
    this.endpoints.push(endpoint);
    return endpoint;
  }

  /** Holds automatic delivery. */
  pause(): void {
    this._paused = true;
  }

  /** Resumes automatic delivery. */
  resume(): void {
    this._paused = false;
    this._schedule();
  }

  /** Frames waiting to be delivered. */
  get pending(): number {
    return this._queue.length;
  }

  /** Delivers the oldest queued frame; `false` when none was queued. */
  deliverNext(): boolean {
    const envelope = this._queue.shift();
    if (!envelope) return false;
    this._deliver(envelope);
    return true;
  }

  /** Delivers every queued frame, including ones queued meanwhile. */
  flush(): void {
    let guard = 0;
    while (this.deliverNext()) {
      if (++guard > 100_000) throw new Error('memory relay did not settle');
    }
  }

  /**
   * Delivers every queued frame in a pseudo-random order drawn from `seed`
   * (a 32-bit LCG), including frames queued meanwhile. Deterministic per seed.
   */
  flushShuffled(seed: number): void {
    let state = seed >>> 0 || 1;
    let guard = 0;
    while (this._queue.length > 0) {
      if (++guard > 100_000) throw new Error('memory relay did not settle');
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      const [envelope] = this._queue.splice(state % this._queue.length, 1);
      this._deliver(envelope);
    }
  }

  /** Destroys the server peer. */
  destroy(): void {
    this._serverAwareness?.destroy();
    this.serverDoc?.destroy();
  }

  /** @internal Routes a frame an endpoint sent. */
  _route(from: MemoryTransport, data: Uint8Array): void {
    if (this.topology === 'relay') {
      for (const to of this.endpoints)
        if (to !== from) this._enqueue({ from, to, data });
    } else {
      this._serverReceive(from, data);
    }
  }

  /** @internal Called when an endpoint's link comes up. */
  _linked(endpoint: MemoryTransport): void {
    if (!this.serverDoc || !this._serverAwareness) return;
    const step1 = encoding.createEncoder();
    encoding.writeVarUint(step1, MLV_EDITOR_COLLABORATION_FRAME_SYNC);
    syncProtocol.writeSyncStep1(step1, this.serverDoc);
    this._enqueue({
      from: null,
      to: endpoint,
      data: encoding.toUint8Array(step1),
    });
    this._sendAwarenessTo(endpoint);
  }

  /** @internal Called when an endpoint's link goes down. */
  _unlinked(endpoint: MemoryTransport): void {
    if (!this._serverAwareness || endpoint.clientId === null) return;
    // A state at clock 0 is never applied by y-protocols, so the server may not know it.
    if (!this._serverAwareness.getStates().has(endpoint.clientId)) return;
    awarenessProtocol.removeAwarenessStates(
      this._serverAwareness,
      [endpoint.clientId],
      endpoint,
    );
    this._broadcastAwareness([endpoint.clientId], endpoint);
  }

  /** @private The server peer handling one inbound frame (y-websocket semantics). */
  private _serverReceive(from: MemoryTransport, data: Uint8Array): void {
    const doc = this.serverDoc as Y.Doc;
    const awareness = this._serverAwareness as awarenessProtocol.Awareness;
    const decoder = decoding.createDecoder(data);
    switch (decoding.readVarUint(decoder)) {
      case MLV_EDITOR_COLLABORATION_FRAME_SYNC: {
        const reply = encoding.createEncoder();
        encoding.writeVarUint(reply, MLV_EDITOR_COLLABORATION_FRAME_SYNC);
        syncProtocol.readSyncMessage(decoder, reply, doc, from);
        if (encoding.length(reply) > 1) {
          this._enqueue({
            from: null,
            to: from,
            data: encoding.toUint8Array(reply),
          });
        }
        break;
      }
      case MLV_EDITOR_COLLABORATION_FRAME_AWARENESS: {
        const update = decoding.readVarUint8Array(decoder);
        awarenessProtocol.applyAwarenessUpdate(awareness, update, from);
        const frame = encoding.createEncoder();
        encoding.writeVarUint(frame, MLV_EDITOR_COLLABORATION_FRAME_AWARENESS);
        encoding.writeVarUint8Array(frame, update);
        this._broadcast(encoding.toUint8Array(frame), from);
        break;
      }
      case MLV_EDITOR_COLLABORATION_FRAME_QUERY_AWARENESS:
        this._sendAwarenessTo(from);
        break;
    }
  }

  /** @private Sends every known awareness state to one endpoint. */
  private _sendAwarenessTo(endpoint: MemoryTransport): void {
    const awareness = this._serverAwareness as awarenessProtocol.Awareness;
    const clients = [...awareness.getStates().keys()];
    if (clients.length === 0) return;
    const frame = encoding.createEncoder();
    encoding.writeVarUint(frame, MLV_EDITOR_COLLABORATION_FRAME_AWARENESS);
    encoding.writeVarUint8Array(
      frame,
      awarenessProtocol.encodeAwarenessUpdate(awareness, clients),
    );
    this._enqueue({
      from: null,
      to: endpoint,
      data: encoding.toUint8Array(frame),
    });
  }

  /** @private Broadcasts the server's view of some awareness clients. */
  private _broadcastAwareness(
    clients: number[],
    except: MemoryTransport,
  ): void {
    const awareness = this._serverAwareness as awarenessProtocol.Awareness;
    const frame = encoding.createEncoder();
    encoding.writeVarUint(frame, MLV_EDITOR_COLLABORATION_FRAME_AWARENESS);
    encoding.writeVarUint8Array(
      frame,
      awarenessProtocol.encodeAwarenessUpdate(awareness, clients),
    );
    this._broadcast(encoding.toUint8Array(frame), except);
  }

  /** @private Sends a server frame to every endpoint but `except`. */
  private _broadcast(data: Uint8Array, except: MemoryTransport | null): void {
    for (const to of this.endpoints)
      if (to !== except) this._enqueue({ from: null, to, data });
  }

  /** @private Queues a frame and schedules delivery. */
  private _enqueue(envelope: Envelope): void {
    this._queue.push(envelope);
    this._schedule();
  }

  /** @private Schedules a drain unless paused or already scheduled. */
  private _schedule(): void {
    if (this._paused || this._scheduled || this._queue.length === 0) return;
    this._scheduled = true;
    const drain = (): void => {
      this._scheduled = false;
      if (!this._paused) this.flush();
    };
    const latency = this._options.latency ?? 0;
    if (latency > 0) setTimeout(drain, latency);
    else queueMicrotask(drain);
  }

  /** @private Hands a frame to its target, when the target is still linked. */
  private _deliver(envelope: Envelope): void {
    envelope.to._receive(envelope.data);
  }
}

/** One in-memory endpoint; a real `MlvEditorCollaborationTransport`. */
export class MemoryTransport extends MlvEditorCollaborationTransport {
  override readonly relay: boolean;
  /** Every frame the library pushed to `outbound`, in order. */
  readonly sent: Uint8Array[] = [];
  /** Every frame delivered to the library, in order. */
  readonly received: Uint8Array[] = [];
  /** How many times `connect()` was subscribed. */
  subscribeCount = 0;
  /** How many times the subscription ended from the library's side. */
  unsubscribeCount = 0;
  /** Whether `outbound` completed. */
  outboundCompleted = false;
  /** The client id from the last `connect()`. */
  clientId: number | null = null;
  /** The document id from the last `connect()`. */
  documentId: string | null = null;
  /** Drops the next `n` outbound frames that match. */
  dropOutbound: {
    count: number;
    match?: (frame: Uint8Array) => boolean;
  } | null = null;
  /** @private The live subscriber. */
  private _subscriber: Subscriber<MlvEditorCollaborationTransportEvent> | null =
    null;
  /** @private Whether the link is up. */
  private _linked = false;

  constructor(private readonly _hub: MemoryCollaborationHub) {
    super();
    this.relay = _hub.topology === 'relay';
  }

  /** Whether the link is up. */
  get linked(): boolean {
    return this._linked;
  }

  connect(
    context: MlvEditorCollaborationTransportContext,
  ): Observable<MlvEditorCollaborationTransportEvent> {
    return new Observable<MlvEditorCollaborationTransportEvent>(
      (subscriber) => {
        this.subscribeCount++;
        this.clientId = context.clientId;
        this.documentId = context.documentId;
        this._subscriber = subscriber;
        const outbound: Subscription = context.outbound.subscribe({
          next: (frame) => {
            this.sent.push(frame);
            const drop = this.dropOutbound;
            if (drop && drop.count > 0 && (!drop.match || drop.match(frame))) {
              drop.count--;
              return;
            }
            if (this._linked) this._hub._route(this, frame);
          },
          complete: () => (this.outboundCompleted = true),
        });
        subscriber.next({ type: 'connection', state: 'connecting' });
        if (this._hub.autoConnect) this.goOnline();
        return () => {
          this.unsubscribeCount++;
          outbound.unsubscribe();
          this._linked = false;
          this._subscriber = null;
        };
      },
    );
  }

  /** Brings the link up and reports `connected`. */
  goOnline(): void {
    if (!this._subscriber || this._linked) return;
    this._linked = true;
    this._subscriber.next({ type: 'connection', state: 'connected' });
    this._hub._linked(this);
  }

  /** Takes the link down and reports `disconnected`. */
  goOffline(): void {
    if (!this._subscriber || !this._linked) return;
    this._linked = false;
    this._subscriber.next({ type: 'connection', state: 'disconnected' });
    this._hub._unlinked(this);
  }

  /** Ends the session for good (the host completed). */
  complete(): void {
    this._linked = false;
    this._subscriber?.complete();
  }

  /** Fails the session (the host errored). */
  error(cause: unknown): void {
    this._linked = false;
    this._subscriber?.error(cause);
  }

  /** Emits a raw inbound frame, bypassing the hub. */
  inject(data: Uint8Array): void {
    this._subscriber?.next({ type: 'message', data });
  }

  /** @internal Delivers a frame from the hub, when linked. */
  _receive(data: Uint8Array): void {
    if (!this._linked || !this._subscriber) return;
    this.received.push(data);
    this._subscriber.next({ type: 'message', data });
  }
}
