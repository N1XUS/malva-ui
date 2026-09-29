import type { JSONContent } from '@tiptap/core';
import type { Schema } from '@tiptap/pm/model';
import { prosemirrorJSONToYXmlFragment } from '@tiptap/y-tiptap';
import * as Y from 'yjs';
import { mlvEditorCanonicalJson, mlvEditorFnv1a32 } from './collaboration-hash';
import {
  MLV_EDITOR_COLLABORATION_DEFAULT_FIELD,
  MLV_EDITOR_COLLABORATION_META,
  MLV_EDITOR_COLLABORATION_SEEDED,
} from './collaboration-meta';

/** Options of {@link createMlvEditorCollaborationSeed}. */
export interface MlvEditorCollaborationSeedOptions {
  /**
   * The editor schema, e.g. `getSchema(mlvEditorDefaultExtensions({ format }))`
   * on a server, or `editor.schema` on a client. Must match the clients'.
   */
  readonly schema: Schema;

  /** The shared fragment name; matches `collaborationField`. Default `'default'`. */
  readonly field?: string;
}

/** @private Alphabet and length of N1's block IDs (`editor-block-id.ts`). */
const ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/** @private Length of a block ID. */
const ID_LENGTH = 10;

/** @private A 10-character `[0-9a-z]` ID derived from `hash` and `salt`. */
const deterministicId = (hash: number, salt: string): string => {
  let id = '';
  let round = 0;
  while (id.length < ID_LENGTH) {
    let value = mlvEditorFnv1a32(`${hash}:${salt}:${round++}`);
    for (let digit = 0; digit < 6 && id.length < ID_LENGTH; digit++) {
      id += ID_ALPHABET[value % 36];
      value = Math.floor(value / 36);
    }
  }
  return id;
};

/** @private Whether a node type carries N1's `blockId` attribute. */
const hasBlockId = (schema: Schema, type: string | undefined): boolean => {
  const attrs = type ? schema.nodes[type]?.spec.attrs : undefined;
  return (
    attrs !== undefined &&
    Object.prototype.hasOwnProperty.call(attrs, 'blockId')
  );
};

/**
 * @private A copy of `content` where every block that can carry a `blockId`
 * and has none gets a deterministic one: from the content hash plus the
 * block's document-order index, re-salted on the rare clash with an ID
 * already in the content. Two clients seeding the same content produce the
 * same IDs, so the seed stays byte-identical.
 */
const withDeterministicBlockIds = (
  content: JSONContent,
  schema: Schema,
  hash: number,
): JSONContent => {
  const used = new Set<string>();
  const collect = (node: JSONContent): void => {
    const id: unknown = node.attrs?.['blockId'];
    if (typeof id === 'string' && id !== '') used.add(id);
    node.content?.forEach(collect);
  };
  collect(content);

  let index = 0;
  const assign = (node: JSONContent): JSONContent => {
    const children = node.content?.map(assign);
    const next: JSONContent = children
      ? { ...node, content: children }
      : { ...node };
    if (!hasBlockId(schema, node.type)) return next;
    const current: unknown = node.attrs?.['blockId'];
    const position = index++;
    if (typeof current === 'string' && current !== '') return next;
    let salt = 0;
    let id = deterministicId(hash, `${position}`);
    while (used.has(id)) id = deterministicId(hash, `${position}:${++salt}`);
    used.add(id);
    return { ...next, attrs: { ...node.attrs, blockId: id } };
  };
  return assign(content);
};

/**
 * Builds the deterministic seed update of a collaborative document: the same
 * bytes on every server and client for the same content, schema and field.
 * Apply it with `Y.applyUpdate(doc, seed)` before admitting clients; a client
 * falls back to the same function when it joins an empty, unseeded document.
 *
 * - The update's client id is a hash of `field` and the canonical content, so
 *   two concurrent seeds of the same content land once, and two different
 *   seeds both land (visible duplication, never divergence).
 * - Blocks that can carry N1 block IDs and have none get deterministic IDs.
 * - The update also sets the `mlv-editor.seeded` flag.
 *
 * Throws a `RangeError` when `content` does not fit `schema`. Runs without a
 * DOM, so a Node server can call it.
 */
export function createMlvEditorCollaborationSeed(
  content: JSONContent,
  options: MlvEditorCollaborationSeedOptions,
): Uint8Array {
  const field = options.field ?? MLV_EDITOR_COLLABORATION_DEFAULT_FIELD;
  const hash = mlvEditorFnv1a32(`${field}\0${mlvEditorCanonicalJson(content)}`);
  const json = withDeterministicBlockIds(content, options.schema, hash);
  // Validates before anything is written, so a bad seed writes nothing.
  options.schema.nodeFromJSON(json).check();

  const scratch = new Y.Doc();
  scratch.clientID = hash === 0 ? 1 : hash;
  try {
    scratch.transact(() => {
      prosemirrorJSONToYXmlFragment(
        options.schema,
        json,
        scratch.getXmlFragment(field),
      );
      scratch
        .getMap(MLV_EDITOR_COLLABORATION_META)
        .set(MLV_EDITOR_COLLABORATION_SEEDED, true);
    });
    return Y.encodeStateAsUpdate(scratch);
  } finally {
    scratch.destroy();
  }
}
