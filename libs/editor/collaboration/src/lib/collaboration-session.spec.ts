import type { MlvEditorError } from '@malva-ui/editor';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import { Observable } from 'rxjs';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';
import { MlvEditorCollaborationSession } from './collaboration-session';
import {
  MlvEditorCollaborationTransport,
  type MlvEditorCollaborationTransportEvent,
} from './collaboration-transport';
import {
  MemoryCollaborationHub,
  type MemoryTransport,
} from './testing/memory-relay';

/** Outer type and, for sync frames, the sync message type. */
const kind = (frame: Uint8Array): string => {
  const decoder = decoding.createDecoder(frame);
  const outer = decoding.readVarUint(decoder);
  if (outer === 0)
    return ['step1', 'step2', 'update'][decoding.readVarUint(decoder)];
  return outer === 1 ? 'awareness' : outer === 3 ? 'query' : `type${outer}`;
};

/** The awareness states an awareness frame carries, by client id. */
const awarenessStates = (frame: Uint8Array): Map<number, unknown> => {
  const decoder = decoding.createDecoder(frame);
  decoding.readVarUint(decoder);
  const update = decoding.createDecoder(decoding.readVarUint8Array(decoder));
  const states = new Map<number, unknown>();
  const count = decoding.readVarUint(update);
  for (let index = 0; index < count; index++) {
    const clientId = decoding.readVarUint(update);
    decoding.readVarUint(update);
    states.set(clientId, JSON.parse(decoding.readVarString(update)));
  }
  return states;
};

describe('MlvEditorCollaborationSession', () => {
  const sessions: MlvEditorCollaborationSession[] = [];
  const hubs: MemoryCollaborationHub[] = [];

  function create(
    transport: MemoryTransport,
    options: { document?: Y.Doc; syncTimeout?: number } = {},
  ): { session: MlvEditorCollaborationSession; errors: MlvEditorError[] } {
    const errors: MlvEditorError[] = [];
    const session = new MlvEditorCollaborationSession({
      transport,
      documentId: 'doc-1',
      document: options.document ?? null,
      syncTimeout: () => options.syncTimeout ?? 10_000,
      onError: (error) => errors.push(error),
    });
    sessions.push(session);
    return { session, errors };
  }

  function hub(
    topology: 'relay' | 'server',
    autoConnect = true,
  ): MemoryCollaborationHub {
    const created = new MemoryCollaborationHub(topology, { autoConnect });
    hubs.push(created);
    return created;
  }

  const text = (session: MlvEditorCollaborationSession): string =>
    session.doc.getText('t').toString();

  afterEach(() => {
    sessions.splice(0).forEach((session) => session.destroy());
    hubs.splice(0).forEach((created) => created.destroy());
    vi.restoreAllMocks();
  });

  it('handshakes with step 1, awareness and a query on connected, and syncs on step 2', () => {
    const server = hub('server');
    const endpoint = server.endpoint();
    const { session } = create(endpoint);
    session.start();
    expect(endpoint.documentId).toBe('doc-1');
    expect(endpoint.clientId).toBe(session.doc.clientID);
    expect(endpoint.sent.map(kind)).toEqual(['step1', 'awareness', 'query']);
    expect(session.status()).toBe('syncing');
    server.flush();
    expect(session.status()).toBe('synced');
    expect(session.synced()).toBe(true);
    expect(session.hasSynced()).toBe(true);
    // The server's step 1 was answered with our step 2.
    expect(endpoint.sent.map(kind)).toContain('step2');
  });

  it('pushes its full state as step 2 to a relay, and converges two clients', () => {
    const relay = hub('relay');
    const a = create(relay.endpoint());
    const b = create(relay.endpoint());
    a.session.doc.getText('t').insert(0, 'from a');
    a.session.start();
    expect((relay.endpoints[0] as MemoryTransport).sent.map(kind)).toEqual([
      'step1',
      'awareness',
      'query',
      'step2',
    ]);
    b.session.start();
    relay.flush();
    expect(text(b.session)).toBe('from a');
    expect(a.session.status()).toBe('synced');
    expect(b.session.status()).toBe('synced');
  });

  it('never syncs a relay client that is alone (no peer answers step 1)', () => {
    const relay = hub('relay');
    const { session } = create(relay.endpoint());
    session.start();
    relay.flush();
    expect(session.status()).toBe('syncing');
    expect(session.hasSynced()).toBe(false);
  });

  it('sends local updates while connected and never echoes applied ones', () => {
    const relay = hub('relay');
    const a = create(relay.endpoint());
    const b = create(relay.endpoint());
    a.session.start();
    b.session.start();
    relay.flush();
    const [endpointA, endpointB] = relay.endpoints;
    const sentByB = endpointB.sent.length;
    a.session.doc.getText('t').insert(0, 'hello');
    expect(endpointA.sent.map(kind).at(-1)).toBe('update');
    relay.flush();
    expect(text(b.session)).toBe('hello');
    expect(endpointB.sent.length).toBe(sentByB);
  });

  it('queues nothing while disconnected and merges offline edits on reconnect', () => {
    const server = hub('server');
    const a = create(server.endpoint());
    const b = create(server.endpoint());
    a.session.start();
    b.session.start();
    server.flush();
    const [endpointA] = server.endpoints;
    endpointA.goOffline();
    expect(a.session.status()).toBe('offline');
    expect(a.session.synced()).toBe(false);
    const sent = endpointA.sent.length;
    a.session.doc.getText('t').insert(0, 'offline a ');
    b.session.doc.getText('t').insert(0, 'online b ');
    server.flush();
    expect(endpointA.sent.length).toBe(sent);
    expect(a.session.hasUnsyncedChanges()).toBe(true);
    endpointA.goOnline();
    server.flush();
    expect(a.session.status()).toBe('synced');
    expect(a.session.hasUnsyncedChanges()).toBe(false);
    expect(text(a.session)).toBe(text(b.session));
    expect(text(a.session)).toContain('offline a');
    expect(text(a.session)).toContain('online b');
    expect(Y.encodeStateVector(a.session.doc)).toEqual(
      Y.encodeStateVector(b.session.doc),
    );
  });

  it('publishes peers through awareness and drops them on disconnect', () => {
    const server = hub('server');
    const a = create(server.endpoint());
    const b = create(server.endpoint());
    b.session.awareness.setLocalStateField('user', { name: 'Grace' });
    a.session.start();
    b.session.start();
    server.flush();
    expect(a.session.awareness.getStates().get(b.session.doc.clientID)).toEqual(
      { user: { name: 'Grace' } },
    );
    const revision = a.session.awarenessRevision();
    server.endpoints[0].goOffline();
    expect(a.session.awareness.getStates().has(b.session.doc.clientID)).toBe(
      false,
    );
    expect(a.session.awarenessRevision()).toBeGreaterThan(revision);
  });

  it('tears down in order: awareness null frame, outbound complete, unsubscribe, timer, owned doc', () => {
    const server = hub('server');
    const a = create(server.endpoint());
    const b = create(server.endpoint());
    a.session.awareness.setLocalStateField('user', { name: 'Ada' });
    a.session.start();
    b.session.start();
    server.flush();
    expect(b.session.awareness.getStates().has(a.session.doc.clientID)).toBe(
      true,
    );
    const endpointA = server.endpoints[0];
    const clearInterval = vi.spyOn(globalThis, 'clearInterval');
    const interval = (
      a.session.awareness as unknown as { _checkInterval: unknown }
    )._checkInterval;
    a.session.destroy();
    const last = endpointA.sent.at(-1) as Uint8Array;
    expect(kind(last)).toBe('awareness');
    expect(awarenessStates(last).get(a.session.doc.clientID)).toBeNull();
    expect(endpointA.outboundCompleted).toBe(true);
    expect(endpointA.unsubscribeCount).toBe(1);
    expect(clearInterval).toHaveBeenCalledWith(interval);
    expect(a.session.doc.isDestroyed).toBe(true);
    server.flush();
    // The peer drops the caret at once, not after the 30 s timeout.
    expect(b.session.awareness.getStates().has(a.session.doc.clientID)).toBe(
      false,
    );
    a.session.destroy();
    expect(endpointA.unsubscribeCount).toBe(1);
  });

  it('never destroys a host-owned document', () => {
    const document = new Y.Doc();
    const { session } = create(hub('server').endpoint(), { document });
    session.start();
    session.destroy();
    expect(session.ownsDoc).toBe(false);
    expect(document.isDestroyed).toBe(false);
    document.destroy();
  });

  it('fails read-only on a transport error, with one unrecoverable error', () => {
    const server = hub('server');
    const { session, errors } = create(server.endpoint());
    session.start();
    server.flush();
    server.endpoints[0].error(new Error('socket gone'));
    expect(session.status()).toBe('failed');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      code: 'collaboration',
      recoverable: false,
    });
    server.endpoints[0].inject(new Uint8Array([0, 2, 0]));
    expect(session.status()).toBe('failed');
  });

  it('unsubscribes when it fails on a frame the transport delivers during subscribe', () => {
    // A transport replaying a buffered frame synchronously, whose content the
    // schema guard rejects (D-F9): the session ends before `subscribe` returns.
    const remote = new Y.Doc();
    remote.getText('t').insert(0, 'buffered');
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, 0);
    syncProtocol.writeSyncStep2(encoder, remote);
    const frame = encoding.toUint8Array(encoder);
    let teardowns = 0;
    const transport = new (class extends MlvEditorCollaborationTransport {
      connect(): Observable<MlvEditorCollaborationTransportEvent> {
        return new Observable((subscriber) => {
          subscriber.next({ type: 'connection', state: 'connected' });
          subscriber.next({ type: 'message', data: frame });
          return () => teardowns++;
        });
      }
    })();
    const errors: MlvEditorError[] = [];
    const session = new MlvEditorCollaborationSession({
      transport,
      documentId: 'doc-1',
      document: null,
      syncTimeout: () => 10_000,
      onError: (error) => errors.push(error),
    });
    sessions.push(session);
    session.doc.on('beforeObserverCalls', () =>
      session.fail(new Error('schema mismatch')),
    );
    session.start();
    expect(session.status()).toBe('failed');
    expect(errors.map((error) => [error.code, error.recoverable])).toEqual([
      ['collaboration', false],
    ]);
    expect(teardowns).toBe(1);
    remote.destroy();
  });

  it('closes on transport completion, with one unrecoverable error', () => {
    const server = hub('server');
    const { session, errors } = create(server.endpoint());
    session.start();
    server.endpoints[0].complete();
    expect(session.status()).toBe('closed');
    expect(errors.map((error) => [error.code, error.recoverable])).toEqual([
      ['collaboration', false],
    ]);
  });

  it('goes offline when the first sync times out, and syncs later', async () => {
    const server = hub('server', false);
    const { session, errors } = create(server.endpoint(), { syncTimeout: 20 });
    session.start();
    expect(session.status()).toBe('connecting');
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(session.status()).toBe('offline');
    expect(session.timedOut()).toBe(true);
    expect(errors.map((error) => [error.code, error.recoverable])).toEqual([
      ['collaboration', true],
    ]);
    server.endpoints[0].goOnline();
    server.flush();
    expect(session.status()).toBe('synced');
    expect(session.hasSynced()).toBe(true);
  });

  it('drops a malformed frame with a recoverable error and keeps going', () => {
    const server = hub('server');
    const { session, errors } = create(server.endpoint());
    session.start();
    server.endpoints[0].inject(new Uint8Array([1, 200]));
    expect(errors.map((error) => [error.code, error.recoverable])).toEqual([
      ['collaboration', true],
    ]);
    server.flush();
    expect(session.status()).toBe('synced');
  });

  it('answers query-awareness with every known state', () => {
    const server = hub('server');
    const { session } = create(server.endpoint());
    session.start();
    server.flush();
    const endpoint = server.endpoints[0];
    const before = endpoint.sent.length;
    endpoint.inject(new Uint8Array([3]));
    expect(endpoint.sent.slice(before).map(kind)).toEqual(['awareness']);
    expect(
      awarenessStates(endpoint.sent.at(-1) as Uint8Array).has(
        session.doc.clientID,
      ),
    ).toBe(true);
  });
});
