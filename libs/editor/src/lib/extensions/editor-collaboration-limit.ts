import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state';

/** @internal Options of {@link MlvEditorCollaborationCharacterLimit}. */
export interface MlvEditorCollaborationCharacterLimitOptions {
  /** Maximum character count; `null` or `0` means unlimited. */
  limit: number | null;

  /** Whether a transaction came from the shared document (never filtered). */
  isChangeOrigin: (tr: Transaction) => boolean;
}

/** @private Storage of Tiptap's `CharacterCount`, read for the counting rule. */
interface CharacterCountStorage {
  characters: (options?: { node?: ProseMirrorNode }) => number;
}

/**
 * @internal `CharacterCount`'s limit, applied to local transactions only.
 *
 * A collaborating editor configures `CharacterCount` with `limit: null` (so
 * counting and `MlvEditorStatus` keep working) and adds this extension. It
 * re-applies the upstream policy — block growth past the limit, trim a paste
 * to fit, allow shrinking while over — but never to a change-origin
 * transaction: a remote Yjs change cannot be cancelled without leaving
 * ProseMirror and Yjs permanently apart. Remote overflow is therefore
 * accepted, and local growth is blocked until the document is back under the
 * limit, the upstream "already exceeded" rule.
 */
export const MlvEditorCollaborationCharacterLimit =
  Extension.create<MlvEditorCollaborationCharacterLimitOptions>({
    name: 'mlvEditorCollaborationCharacterLimit',

    addOptions() {
      return { limit: null, isChangeOrigin: () => false };
    },

    addProseMirrorPlugins() {
      const { limit, isChangeOrigin } = this.options;
      const editor = this.editor;
      const characters = (node: ProseMirrorNode): number => {
        const storage = (editor.storage as unknown as Record<string, unknown>)[
          'characterCount'
        ] as CharacterCountStorage | undefined;
        return storage
          ? storage.characters({ node })
          : node.textBetween(0, node.content.size, undefined, ' ').length;
      };
      return [
        new Plugin({
          key: new PluginKey('mlvEditorCollaborationCharacterLimit'),
          filterTransaction: (transaction, state) => {
            if (!transaction.docChanged || !limit) return true;
            if (isChangeOrigin(transaction)) return true;
            const root = transaction.getMeta('appendedTransaction') as
              | Transaction
              | undefined;
            if (root && isChangeOrigin(root)) return true;
            const oldSize = characters(state.doc);
            const newSize = characters(transaction.doc);
            if (newSize <= limit) return true;
            if (oldSize > limit && newSize <= oldSize) return true;
            if (oldSize > limit) return false;
            if (!transaction.getMeta('paste')) return false;
            const pos = transaction.selection.$head.pos;
            transaction.deleteRange(pos - (newSize - limit), pos);
            return characters(transaction.doc) <= limit;
          },
        }),
      ];
    },
  });
