/**
 * State of a collaboration session.
 *
 * - `idle`: server render, or before the editor attached;
 * - `connecting`: subscribed to the transport, not connected yet;
 * - `syncing`: connected, waiting for the first sync step 2;
 * - `synced`: the document is in sync on the current connection;
 * - `offline`: disconnected, or the first sync timed out;
 * - `closed`: the transport completed (the host ended the session);
 * - `failed`: the transport errored or the shared document failed the schema
 *   check.
 */
export type MlvEditorCollaborationStatus =
  | 'idle'
  | 'connecting'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'closed'
  | 'failed';

/** Whether a peer can edit or only view the document. */
export type MlvEditorCollaborationPeerMode = 'editing' | 'viewing';

/** The local identity shown to peers. */
export interface MlvEditorCollaborationUser {
  /** Stable user id; the default colour derives from it (else from `name`). */
  readonly id?: string;

  /** Display name; trimmed and cut to 64 code points on the receiving side. */
  readonly name: string;

  /** `#rrggbb`; anything else falls back to the palette colour. */
  readonly color?: string;
}

/** A participant in the shared document, as the awareness state describes it. */
export interface MlvEditorCollaborationPeer {
  /** The peer's Yjs client id. */
  readonly clientId: number;

  /** The peer's user id, when it published one. */
  readonly id: string | null;

  /** Sanitised display name. */
  readonly name: string;

  /** Validated `#rrggbb` colour. */
  readonly color: string;

  /** `viewing` while the peer's editor is readonly, disabled, unsynced or failed. */
  readonly mode: MlvEditorCollaborationPeerMode;
}
