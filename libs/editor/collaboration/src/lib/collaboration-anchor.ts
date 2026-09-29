import * as Y from 'yjs';

/**
 * @internal Whether the content a Yjs anchor stands for is gone (D-F8), so the
 * position must resolve to `null` instead of the place the content used to be.
 * Parity with the local path, where `mapResult(pos, -1).deleted` means the
 * token on the left of the position was removed:
 *
 * - (a) a left-associated anchor names the token on its left; it is lost when
 *   that token was deleted (after following Yjs undo re-insertions, as
 *   `createAbsolutePositionFromRelativePosition` does);
 * - (b) it is lost when the type it sits in, or any ancestor, was deleted.
 *
 * y-tiptap's `relativePositionToAbsolutePosition` returns `null` only for an
 * undecodable anchor: for deleted content it returns the old place.
 *
 * An anchor y-tiptap creates between two blocks names the block on its right
 * (`assoc` 0), so (a) does not apply to it: a deleted right-hand block leaves
 * the position where local mapping leaves it too.
 */
export function isMlvEditorCollaborationAnchorLost(
  doc: Y.Doc,
  anchor: Y.RelativePosition,
): boolean {
  if (anchor.item !== null && anchor.assoc < 0) {
    const token = followRedone(doc.store, anchor.item);
    if (token === null || token.deleted) return true;
  }
  const decoded = Y.createAbsolutePositionFromRelativePosition(anchor, doc);
  if (decoded === null) return true;
  for (let item = decoded.type._item; item !== null; item = parentItem(item)) {
    if (item.deleted) return true;
  }
  return false;
}

/** @private The item of the type that contains `item`, `null` at the root. */
const parentItem = (item: Y.Item): Y.Item | null =>
  (item.parent as Y.AbstractType<unknown> | null)?._item ?? null;

/**
 * @private The item holding `id`, after following undo re-insertions (Yjs'
 * private `followRedone`). `null` when the id is unknown or garbage-collected.
 */
function followRedone(store: Y.Doc['store'], id: Y.ID): Y.Item | null {
  if (Y.getState(store, id.client) <= id.clock) return null;
  let next: Y.ID | null = id;
  let diff = 0;
  let struct: Y.Item | Y.GC;
  do {
    if (diff > 0) next = Y.createID(next.client, next.clock + diff);
    struct = Y.getItem(store, next) as Y.Item | Y.GC;
    diff = next.clock - struct.id.clock;
    next = struct instanceof Y.Item ? struct.redone : null;
  } while (next !== null);
  return struct instanceof Y.Item ? struct : null;
}
