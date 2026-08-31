import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

/** A rendered, temporary image-upload placeholder tracked by its stable identifier. */
export interface MlvEditorUploadPlaceholderItem {
  /** Identifier that associates this placeholder with one upload operation. */
  readonly id: string;

  /** Current document position of the placeholder decoration. */
  readonly position: number;

  /** Upload progress percentage from 0 through 100. */
  readonly progress: number;
}

/** Options accepted when a temporary upload placeholder is inserted. */
export interface MlvEditorInsertUploadPlaceholderOptions {
  /** Unique caller-owned identifier for the upload operation. */
  readonly id: string;

  /** Optional document position; the current selection is used when omitted. */
  readonly position?: number;

  /** Initial upload progress percentage. Defaults to zero. */
  readonly progress?: number;
}

/** Options accepted when an existing upload placeholder is updated. */
export interface MlvEditorUpdateUploadPlaceholderOptions {
  /** Identifier of the placeholder to update. */
  readonly id: string;

  /** New upload progress percentage, clamped to the inclusive 0–100 range. */
  readonly progress: number;
}

/** Options accepted when a temporary upload placeholder is removed. */
export interface MlvEditorRemoveUploadPlaceholderOptions {
  /** Identifier of the placeholder to remove. */
  readonly id: string;
}

/** Image attributes inserted while atomically removing an upload placeholder. */
export interface MlvEditorReplaceUploadPlaceholderOptions {
  /** Identifier of the placeholder to replace. */
  readonly id: string;

  /** Validated image attributes used to create the final schema node. */
  readonly attributes: {
    /** Trimmed image URL. */
    readonly src: string;

    /** Optional alternative text. */
    readonly alt?: string;

    /** Optional image title. */
    readonly title?: string;

    /** Optional finite positive rendered width. */
    readonly width?: number;

    /** Optional finite positive rendered height. */
    readonly height?: number;
  };
}

/** Read-only upload-placeholder state exposed through Tiptap extension storage. */
export interface MlvEditorUploadPlaceholderStorage {
  /** Current temporary placeholders; decorations, never serializable document nodes. */
  readonly placeholders: readonly MlvEditorUploadPlaceholderItem[];
}

interface MlvEditorUploadPlaceholderMetadata {
  readonly type: 'insert' | 'update' | 'remove';
  readonly id: string;
  readonly position?: number;
  readonly progress?: number;
}

interface MlvEditorUploadPlaceholderDecorationSpec {
  readonly id: string;
  readonly progress: number;
  readonly side?: number;
}

interface MlvEditorMutableUploadPlaceholderStorage {
  placeholders: readonly MlvEditorUploadPlaceholderItem[];
}

const MLV_EDITOR_UPLOAD_PLACEHOLDER_KEY = new PluginKey<DecorationSet>(
  'mlvEditorUploadPlaceholder',
);

const findPlaceholderDecorations = (decorations: DecorationSet, id: string) =>
  decorations.find(
    undefined,
    undefined,
    (spec: MlvEditorUploadPlaceholderDecorationSpec) => spec.id === id,
  );

const clampProgress = (progress: number | undefined) =>
  Number.isFinite(progress) ? Math.max(0, Math.min(100, progress ?? 0)) : 0;

const renderPlaceholder = (progress: number) => () => {
  const element = document.createElement('span');
  element.className = 'mlv-editor__upload-placeholder';
  element.dataset['progress'] = String(progress);
  element.setAttribute('aria-hidden', 'true');
  return element;
};

const createPlaceholderDecoration = (
  position: number,
  id: string,
  progress: number,
) =>
  Decoration.widget(position, renderPlaceholder(progress), {
    id,
    progress,
    side: -1,
  } satisfies MlvEditorUploadPlaceholderDecorationSpec);

const synchronizeStorage = (
  storage: MlvEditorMutableUploadPlaceholderStorage,
  decorations: DecorationSet,
) => {
  storage.placeholders = decorations.find().map(({ from, spec }) => ({
    id: (spec as MlvEditorUploadPlaceholderDecorationSpec).id,
    position: from,
    progress: (spec as MlvEditorUploadPlaceholderDecorationSpec).progress,
  }));
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mlvEditorUploadPlaceholder: {
      /** Inserts an upload decoration without changing persisted editor content. */
      insertUploadPlaceholder: (
        options: MlvEditorInsertUploadPlaceholderOptions,
      ) => ReturnType;

      /** Updates the progress decoration for one pending image upload. */
      updateUploadPlaceholder: (
        options: MlvEditorUpdateUploadPlaceholderOptions,
      ) => ReturnType;

      /** Removes the decoration for one completed, failed, or cancelled image upload. */
      removeUploadPlaceholder: (
        options: MlvEditorRemoveUploadPlaceholderOptions,
      ) => ReturnType;

      /** Atomically inserts an image at the mapped placeholder and removes it. */
      replaceUploadPlaceholder: (
        options: MlvEditorReplaceUploadPlaceholderOptions,
      ) => ReturnType;
    };
  }
}

/**
 * Tiptap extension that renders image-upload progress outside the document model.
 *
 * Its widget decorations are intentionally excluded from HTML and Markdown output,
 * so a pending upload can never become persisted editor content.
 */
export const MlvEditorUploadPlaceholder = Extension.create<
  Record<string, never>,
  MlvEditorUploadPlaceholderStorage
>({
  name: 'mlvEditorUploadPlaceholder',

  addStorage() {
    return { placeholders: [] };
  },

  addCommands() {
    return {
      insertUploadPlaceholder:
        (options) =>
        ({ tr, dispatch }) => {
          const position = options.position ?? tr.selection.from;
          const existing = MLV_EDITOR_UPLOAD_PLACEHOLDER_KEY.getState(
            this.editor.state,
          );

          if (
            !existing ||
            position < 0 ||
            position > tr.doc.content.size ||
            findPlaceholderDecorations(existing, options.id).length > 0
          ) {
            return false;
          }

          dispatch?.(
            tr.setMeta(MLV_EDITOR_UPLOAD_PLACEHOLDER_KEY, {
              type: 'insert',
              id: options.id,
              position,
              progress: clampProgress(options.progress),
            } satisfies MlvEditorUploadPlaceholderMetadata),
          );
          return true;
        },
      updateUploadPlaceholder:
        (options) =>
        ({ tr, dispatch }) => {
          const existing = MLV_EDITOR_UPLOAD_PLACEHOLDER_KEY.getState(
            this.editor.state,
          );

          if (
            !existing ||
            findPlaceholderDecorations(existing, options.id).length === 0
          ) {
            return false;
          }

          dispatch?.(
            tr.setMeta(MLV_EDITOR_UPLOAD_PLACEHOLDER_KEY, {
              type: 'update',
              id: options.id,
              progress: clampProgress(options.progress),
            } satisfies MlvEditorUploadPlaceholderMetadata),
          );
          return true;
        },
      removeUploadPlaceholder:
        (options) =>
        ({ tr, dispatch }) => {
          const existing = MLV_EDITOR_UPLOAD_PLACEHOLDER_KEY.getState(
            this.editor.state,
          );

          if (
            !existing ||
            findPlaceholderDecorations(existing, options.id).length === 0
          ) {
            return false;
          }

          dispatch?.(
            tr.setMeta(MLV_EDITOR_UPLOAD_PLACEHOLDER_KEY, {
              type: 'remove',
              id: options.id,
            } satisfies MlvEditorUploadPlaceholderMetadata),
          );
          return true;
        },
      replaceUploadPlaceholder:
        (options) =>
        ({ tr, commands }) => {
          const existing = MLV_EDITOR_UPLOAD_PLACEHOLDER_KEY.getState(
            this.editor.state,
          );
          const matches = existing
            ? findPlaceholderDecorations(existing, options.id)
            : [];
          const imageType = tr.doc.type.schema.nodes['image'];

          if (matches.length !== 1 || !imageType) return false;

          const position = matches[0]?.from;
          if (
            position === undefined ||
            position < 0 ||
            position > tr.doc.content.size
          ) {
            return false;
          }

          try {
            const inserted = commands.insertContentAt(
              position,
              {
                type: imageType.name,
                attrs: options.attributes,
              },
              {
                errorOnInvalidContent: true,
                updateSelection: false,
              },
            );
            if (!inserted) return false;

            tr.setMeta(MLV_EDITOR_UPLOAD_PLACEHOLDER_KEY, {
              type: 'remove',
              id: options.id,
            } satisfies MlvEditorUploadPlaceholderMetadata);
            return true;
          } catch {
            return false;
          }
        },
    };
  },

  addProseMirrorPlugins() {
    const storage = this.storage as MlvEditorMutableUploadPlaceholderStorage;

    return [
      new Plugin<DecorationSet>({
        key: MLV_EDITOR_UPLOAD_PLACEHOLDER_KEY,
        state: {
          init: (_) => {
            const decorations = DecorationSet.empty;
            synchronizeStorage(storage, decorations);
            return decorations;
          },
          apply: (transaction, decorations) => {
            const metadata = transaction.getMeta(
              MLV_EDITOR_UPLOAD_PLACEHOLDER_KEY,
            ) as MlvEditorUploadPlaceholderMetadata | undefined;
            let next = decorations.map(transaction.mapping, transaction.doc);

            if (
              metadata?.type === 'insert' &&
              metadata.position !== undefined
            ) {
              next = next.add(transaction.doc, [
                createPlaceholderDecoration(
                  metadata.position,
                  metadata.id,
                  clampProgress(metadata.progress),
                ),
              ]);
            }

            if (metadata?.type === 'update') {
              const matches = findPlaceholderDecorations(next, metadata.id);
              const replacements = matches.map((decoration) =>
                createPlaceholderDecoration(
                  decoration.from,
                  metadata.id,
                  clampProgress(metadata.progress),
                ),
              );
              next = next.remove(matches).add(transaction.doc, replacements);
            }

            if (metadata?.type === 'remove') {
              next = next.remove(findPlaceholderDecorations(next, metadata.id));
            }

            synchronizeStorage(storage, next);
            return next;
          },
        },
        props: {
          decorations: (state) =>
            MLV_EDITOR_UPLOAD_PLACEHOLDER_KEY.getState(state),
        },
      }),
    ];
  },
});
