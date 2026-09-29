import { sanitizeMlvEditorCollaborationColor } from './collaboration-palette';
import type {
  MlvEditorCollaborationPeer,
  MlvEditorCollaborationPeerMode,
  MlvEditorCollaborationUser,
} from './collaboration.types';

/** @private Longest display name kept, in code points. */
const NAME_LIMIT = 64;

/** @internal A received name: trimmed, cut to 64 code points, else `null`. */
export function sanitizeMlvEditorCollaborationName(
  name: unknown,
): string | null {
  if (typeof name !== 'string') return null;
  const trimmed = [...name.trim()].slice(0, NAME_LIMIT).join('').trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * @internal The awareness `user` field this client publishes: the schema
 * other Tiptap and y-prosemirror clients read (`user: { id, name, color }`),
 * plus `mode`.
 */
export function mlvEditorCollaborationAwarenessUser(
  user: MlvEditorCollaborationUser | null,
  mode: MlvEditorCollaborationPeerMode,
  anonymous: string,
): {
  id: string | null;
  name: string;
  color: string;
  mode: MlvEditorCollaborationPeerMode;
} {
  const name = sanitizeMlvEditorCollaborationName(user?.name) ?? anonymous;
  const id = typeof user?.id === 'string' ? user.id : null;
  return {
    id,
    name,
    color: sanitizeMlvEditorCollaborationColor(user?.color, id ?? name),
    mode,
  };
}

/**
 * @internal A peer as this client shows it, from its raw awareness state.
 * Every field is validated; anything else in the state is ignored.
 */
export function readMlvEditorCollaborationPeer(
  clientId: number,
  state: unknown,
  anonymous: string,
): MlvEditorCollaborationPeer {
  const raw =
    state !== null && typeof state === 'object'
      ? (state as Record<string, unknown>)['user']
      : null;
  const user =
    raw !== null && typeof raw === 'object'
      ? (raw as Record<string, unknown>)
      : {};
  const id = typeof user['id'] === 'string' ? user['id'] : null;
  const name = sanitizeMlvEditorCollaborationName(user['name']) ?? anonymous;
  return {
    clientId,
    id,
    name,
    color: sanitizeMlvEditorCollaborationColor(user['color'], id ?? name),
    mode: user['mode'] === 'viewing' ? 'viewing' : 'editing',
  };
}

/** @internal Whether two peer lists show the same peers, identities and modes. */
export function sameMlvEditorCollaborationPeers(
  a: readonly MlvEditorCollaborationPeer[],
  b: readonly MlvEditorCollaborationPeer[],
): boolean {
  return (
    a.length === b.length &&
    a.every(
      (peer, index) =>
        peer.clientId === b[index].clientId &&
        peer.id === b[index].id &&
        peer.name === b[index].name &&
        peer.color === b[index].color &&
        peer.mode === b[index].mode,
    )
  );
}
