import {
  callOrReturn,
  Extension,
  getExtensionField,
  type Mark,
  type Node,
  type NodeConfig,
} from '@tiptap/core';
import type { Schema } from '@tiptap/pm/model';
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state';
import { Mapping } from '@tiptap/pm/transform';
import { MLV_EDITOR_CREATE_NORMALIZATION_META } from '../editor-create-normalization';
import {
  applyBlockIds,
  changedRanges,
  planBlockIds,
} from './editor-block-id-assign';

/**
 * Options of {@link MlvEditorBlockId}.
 */
export interface MlvEditorBlockIdOptions {
  /**
   * Node types that carry a `blockId`. `'blocks'` (the default) means every
   * block node type of the schema except the top node and the table
   * internals (`tableRow`, `tableCell`, `tableHeader`); inline nodes are
   * never included. Resolved when the schema is built.
   */
  types: readonly string[] | 'blocks';

  /**
   * Mints a new ID. The default is 10 characters of `[0-9a-z]` from
   * `crypto.getRandomValues`. A generated ID already in the document is
   * retried, so a collision never produces a duplicate.
   */
  generateId: () => string;

  /**
   * Return `false` to leave a transaction alone: no ID is assigned or
   * deduplicated for its changes (a remote collaboration step, a change
   * before the first sync). Applied to a root transaction and to every
   * transaction another plugin appends to it, so an appended follow-up of a
   * skipped change is skipped too. The gaps are filled by the next local
   * edit that reaches them, or by `ensureBlockIds()`. `null` allows all.
   */
  filterTransaction: ((tr: Transaction) => boolean) | null;

  /**
   * `true` (the default) assigns the initial document once the editor is
   * created and assigns every change from the start. `false` assigns
   * nothing — neither the initial document nor later changes — until
   * `ensureBlockIds()` runs once (a collaborative editor after its first
   * sync).
   */
  assignOnCreate: boolean;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mlvEditorBlockId: {
      /**
       * Assigns every missing block ID and deduplicates the whole document in
       * one transaction that is not added to the undo history, then keeps
       * assigning later changes (it arms an editor created with
       * `assignOnCreate: false`). Always succeeds.
       */
      ensureBlockIds: () => ReturnType;
    };
  }
}

/** @private Types `'blocks'` never includes (the spec's table internals). */
const EXCLUDED_BLOCK_TYPES: ReadonlySet<string> = new Set([
  'doc',
  'text',
  'tableRow',
  'tableCell',
  'tableHeader',
]);

/** @private Table roles that mark an internal row or cell node. */
const TABLE_INTERNAL_ROLES: ReadonlySet<unknown> = new Set([
  'row',
  'cell',
  'header_cell',
]);

/** @private Alphabet of the default generator. */
const ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/**
 * @private Default generator: 10 characters of `[0-9a-z]`. Bytes of 252 and
 * above are discarded so every character is equally likely.
 */
const generateBlockId = (): string => {
  const bytes = new Uint8Array(16);
  let id = '';
  while (id.length < 10) {
    globalThis.crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte < 252 && id.length < 10) id += ID_ALPHABET[byte % 36];
    }
  }
  return id;
};

/**
 * @private Resolves `'blocks'` against the extensions that build the schema.
 * The attribute has to exist when the schema is created, so this cannot wait
 * for `onCreate`.
 */
const resolveTypes = (
  types: readonly string[] | 'blocks',
  extensions: readonly (Node | Mark)[],
): string[] => {
  if (types !== 'blocks') return [...types];
  return extensions
    .filter((extension): extension is Node => extension.type === 'node')
    .filter((extension) => {
      if (EXCLUDED_BLOCK_TYPES.has(extension.name)) return false;
      const context = {
        name: extension.name,
        options: extension.options,
        storage: extension.storage,
      };
      const field = (name: keyof NodeConfig): unknown =>
        callOrReturn(getExtensionField(extension, name, context));
      return (
        !field('topNode') &&
        !field('inline') &&
        !TABLE_INTERNAL_ROLES.has(field('tableRole' as keyof NodeConfig))
      );
    })
    .map((extension) => extension.name);
};

/** @private Node type names that carry the attribute in a built schema. */
const typesInSchema = (schema: Schema): Set<string> =>
  new Set(
    Object.values(schema.nodes)
      .filter((type) => type.spec.attrs && 'blockId' in type.spec.attrs)
      .map((type) => type.name),
  );

/** @private Plugin state: whether changes are assigned yet. */
interface BlockIdPluginState {
  readonly armed: boolean;
}

/** @private Meta the plugin reads: `arm` switches assignment on. */
interface BlockIdMeta {
  readonly arm?: boolean;
}

/** @private Key of the assignment plugin. */
const blockIdPluginKey = new PluginKey<BlockIdPluginState>('mlvEditorBlockId');

/**
 * Stable per-block IDs, opt-in (`blockIds` on `MlvEditor`, or this extension
 * in a consumer array). The ID is persisted as `data-block-id` in HTML and
 * `attrs.blockId` in JSON; Markdown carries none and reassigns on load.
 *
 * IDs are written in `appendTransaction` through `setNodeAttribute` only, so
 * they join the root transaction's undo event, leave every step map empty
 * (an open AI review keeps its suggestions) and keep the stored marks.
 * Duplicates are resolved by dedupe: a pasted copy of an existing block gets
 * a new ID, a cut-and-pasted block keeps its own, and a split leaves the ID
 * with the half that holds the block's first content.
 */
export const MlvEditorBlockId = Extension.create<MlvEditorBlockIdOptions>({
  name: 'blockId',

  addOptions() {
    return {
      types: 'blocks',
      generateId: generateBlockId,
      filterTransaction: null,
      assignOnCreate: true,
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: resolveTypes(this.options.types, this.extensions),
        attributes: {
          blockId: {
            default: null,
            keepOnSplit: false,
            parseHTML: (element: HTMLElement) =>
              element.getAttribute('data-block-id') || null,
            renderHTML: (attributes: Record<string, unknown>) =>
              typeof attributes['blockId'] === 'string' &&
              attributes['blockId'] !== ''
                ? { 'data-block-id': attributes['blockId'] }
                : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      ensureBlockIds:
        () =>
        ({ tr, dispatch }) => {
          if (!dispatch) return true;
          applyBlockIds(
            tr,
            planBlockIds({
              doc: tr.doc,
              types: typesInSchema(tr.doc.type.schema),
              ranges: null,
              generateId: this.options.generateId,
            }),
          );
          tr.setMeta(blockIdPluginKey, { arm: true } satisfies BlockIdMeta);
          tr.setMeta('addToHistory', false);
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const types = typesInSchema(this.editor.schema);
    const { filterTransaction, generateId, assignOnCreate } = this.options;
    // Only this plugin's own writes are skipped. A transaction another plugin
    // appends to one of them (StarterKit's trailing paragraph after the create
    // pass) can add blocks, so it is judged like any other.
    const relevant = (tr: Transaction): boolean => {
      if (!tr.docChanged || tr.getMeta(blockIdPluginKey) !== undefined) {
        return false;
      }
      const root = tr.getMeta('appendedTransaction') as Transaction | undefined;
      if (!filterTransaction) return true;
      return filterTransaction(tr) && (!root || filterTransaction(root));
    };
    return [
      new Plugin<BlockIdPluginState>({
        key: blockIdPluginKey,
        state: {
          init: () => ({ armed: assignOnCreate }),
          apply: (tr, value) =>
            !value.armed &&
            (tr.getMeta(blockIdPluginKey) as BlockIdMeta | undefined)?.arm
              ? { armed: true }
              : value,
        },
        appendTransaction: (trs, _oldState, newState) => {
          if (!blockIdPluginKey.getState(newState)?.armed) return null;
          if (!trs.some(relevant)) return null;
          const plan = planBlockIds({
            doc: newState.doc,
            types,
            ranges: changedRanges(trs, relevant),
            before: trs[0].before,
            mapping: () => {
              const mapping = new Mapping();
              for (const tr of trs) mapping.appendMapping(tr.mapping);
              return mapping;
            },
            generateId,
          });
          if (plan.length === 0) return null;
          const tr = applyBlockIds(newState.tr, plan);
          return tr.setMeta(blockIdPluginKey, {} satisfies BlockIdMeta);
        },
      }),
    ];
  },

  onCreate() {
    if (!this.options.assignOnCreate) return;
    const { state, view } = this.editor;
    const plan = planBlockIds({
      doc: state.doc,
      types: typesInSchema(state.schema),
      ranges: null,
      generateId: this.options.generateId,
    });
    if (plan.length === 0) return;
    const tr = applyBlockIds(state.tr, plan)
      .setMeta(blockIdPluginKey, {} satisfies BlockIdMeta)
      .setMeta('addToHistory', false)
      .setMeta(MLV_EDITOR_CREATE_NORMALIZATION_META, true);
    view.dispatch(tr);
  },
});
