import type { Observable } from 'rxjs';
import {
  MLV_EDITOR_COLLABORATION_FRAME_AWARENESS,
  MLV_EDITOR_COLLABORATION_FRAME_QUERY_AWARENESS,
  MLV_EDITOR_COLLABORATION_FRAME_SYNC,
} from './collaboration-frame';

/** A link state the host transport reports (y-websocket's vocabulary). */
export type MlvEditorCollaborationConnectionState =
  | 'connecting'
  | 'connected'
  | 'disconnected';

/**
 * What a transport emits: link state changes, and every inbound frame in
 * arrival order.
 */
export type MlvEditorCollaborationTransportEvent =
  | {
      readonly type: 'connection';
      readonly state: MlvEditorCollaborationConnectionState;
    }
  | { readonly type: 'message'; readonly data: Uint8Array };

/** What the library hands a transport when it connects. */
export interface MlvEditorCollaborationTransportContext {
  /** The document key, from `collaborationDocumentId`. */
  readonly documentId: string;

  /** The local Yjs client id, for routing and logging. */
  readonly clientId: number;

  /**
   * Frames to send, in order. Hot: emits only while the transport last
   * reported `connected`, and completes at teardown. Frames produced while
   * not connected are dropped; the next handshake re-derives them.
   * Subscribe before emitting `connected`: the handshake is sent
   * synchronously when `connected` arrives, and a transport that reports it
   * first (a `BroadcastChannel`, an in-page relay) loses it and never syncs.
   */
  readonly outbound: Observable<Uint8Array>;
}

/**
 * The host-implemented transport of a collaborative editor. The library
 * encodes and decodes every frame (y-websocket's wire protocol); the host
 * only moves bytes, and owns authentication, reconnection and backoff.
 */
export abstract class MlvEditorCollaborationTransport {
  /**
   * `true` when the far end is a relay without Yjs state (a BroadcastChannel,
   * a pub/sub fan-out): the client then pushes its full state on every
   * `connected`, since no server will ask for it.
   */
  readonly relay: boolean = false;

  /**
   * Starts the session; unsubscribing ends it (the host's signal to close).
   * Emit `connection` events as the link changes and each inbound frame as a
   * `message`; send every value of `context.outbound`. Model transient drops
   * as `disconnected`: an error is terminal (`failed`, read-only), and
   * completion ends the session for good (`closed`).
   */
  abstract connect(
    context: MlvEditorCollaborationTransportContext,
  ): Observable<MlvEditorCollaborationTransportEvent>;
}

/**
 * The kind of a frame, read from its outer type, so a host can prioritise or
 * drop awareness frames under backpressure. Never drop a `sync` frame without
 * reconnecting: the resync after reconnect is what repairs the gap.
 */
export function mlvEditorCollaborationFrameType(
  frame: Uint8Array,
): 'sync' | 'awareness' | 'query-awareness' | 'unknown' {
  // The outer type is a varUint; every defined type fits its first byte.
  switch (frame.length > 0 ? frame[0] : -1) {
    case MLV_EDITOR_COLLABORATION_FRAME_SYNC:
      return 'sync';
    case MLV_EDITOR_COLLABORATION_FRAME_AWARENESS:
      return 'awareness';
    case MLV_EDITOR_COLLABORATION_FRAME_QUERY_AWARENESS:
      return 'query-awareness';
    default:
      return 'unknown';
  }
}

/** @private Native base64 methods (ES2026), where the runtime has them. */
interface NativeBase64 {
  toBase64?: (this: Uint8Array) => string;
}

/** @private Chunk size for the `btoa` fallback, below any argument-count limit. */
const BASE64_CHUNK = 0x8000;

/**
 * Encodes a frame as base64 for text transports (SSE, JSON). Uses the native
 * `Uint8Array.prototype.toBase64` where present, else chunked `btoa`.
 */
export function encodeMlvEditorCollaborationFrame(frame: Uint8Array): string {
  const native = (frame as Uint8Array & NativeBase64).toBase64;
  if (typeof native === 'function') return native.call(frame);
  let binary = '';
  for (let start = 0; start < frame.length; start += BASE64_CHUNK) {
    binary += String.fromCharCode(
      ...frame.subarray(start, start + BASE64_CHUNK),
    );
  }
  return btoa(binary);
}

/**
 * Decodes a base64 frame from a text transport. Uses the native
 * `Uint8Array.fromBase64` where present, else `atob`. Throws on input that is
 * not base64; the session drops such a frame.
 */
export function decodeMlvEditorCollaborationFrame(text: string): Uint8Array {
  const native = (
    Uint8Array as unknown as { fromBase64?: (text: string) => Uint8Array }
  ).fromBase64;
  if (typeof native === 'function') return native(text);
  const binary = atob(text);
  const frame = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    frame[index] = binary.charCodeAt(index);
  }
  return frame;
}
