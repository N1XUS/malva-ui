import {
  Extension,
  mergeAttributes,
  ResizableNodeView,
  type Editor,
  type Extensions,
  type NodeViewRendererProps,
} from '@tiptap/core';
import {
  FileHandlePlugin,
  type FileHandlerOptions,
} from '@tiptap/extension-file-handler';
import Image from '@tiptap/extension-image';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import TextAlign from '@tiptap/extension-text-align';
import { Color, FontFamily, FontSize } from '@tiptap/extension-text-style';
import { CharacterCount, Placeholder } from '@tiptap/extensions';
import type { PlaceholderOptions } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state';
import type { NodeView } from '@tiptap/pm/view';
import {
  mlvEditorDefaultImageUrlPolicy,
  type MlvEditorFormat,
  type MlvEditorImageUploadSource,
  type MlvEditorImageUrlPolicy,
} from '../editor.types';
import {
  MlvEditorBlockHandle,
  type MlvEditorBlockHandleOptions,
} from './editor-block-handle';
import { MlvEditorUploadPlaceholder } from './editor-upload-placeholder';
import { MlvEditorCollaborationCharacterLimit } from './editor-collaboration-limit';
import {
  MlvEditorBlockId,
  type MlvEditorBlockIdOptions,
} from './block-id/editor-block-id';
import {
  MlvEditorSubscript,
  MlvEditorSuperscript,
} from './script/editor-script';
import { MlvEditorBlockLineHeight } from './text-style/editor-block-line-height';
import { MlvEditorResetFormatting } from './text-style/editor-reset-formatting';
import { withAbsentStyleAsNull } from './text-style/editor-text-style-parsing';
import {
  MlvEditorHeadingAnchors,
  type MlvEditorHeadingAnchorOptions,
} from './heading-anchors/editor-heading-anchors';
import {
  createMarkdownCompatibleHighlight,
  createMarkdownCompatibleStarterKit,
  createMarkdownCompatibleTableKit,
  createMarkdownCompatibleTextStyle,
} from './editor-markdown-compatibility';

export {
  MlvEditorUploadPlaceholder,
  type MlvEditorInsertUploadPlaceholderOptions,
  type MlvEditorRemoveUploadPlaceholderOptions,
  type MlvEditorUpdateUploadPlaceholderOptions,
  type MlvEditorUploadPlaceholderItem,
  type MlvEditorUploadPlaceholderStorage,
} from './editor-upload-placeholder';

/**
 * Public Malva wrapper around Tiptap's official free file handling extension.
 *
 * The upstream plugin intentionally consumes accepted file-only paste/drop
 * events. This companion plugin inserts a simultaneous `text/plain` payload
 * first, then delegates the file interaction exactly once to the upstream
 * `FileHandlePlugin`. It remains inert for either interaction when the
 * corresponding callback is not configured, so custom presets can safely
 * include it before they opt into file handling.
 */
export const MlvEditorFileHandler = Extension.create<FileHandlerOptions>({
  name: 'fileHandler',

  addOptions() {
    return {
      onPaste: undefined,
      onDrop: undefined,
      allowedMimeTypes: undefined,
      consumePasteEvent: false,
    };
  },

  addProseMirrorPlugins() {
    const onPaste = this.options.onPaste;
    const onDrop = this.options.onDrop;
    let preservedDrop:
      | { readonly position: number; readonly textLength: number }
      | undefined;
    const acceptedFiles = (files: FileList): File[] => {
      const candidates = Array.from(files);
      return this.options.allowedMimeTypes
        ? candidates.filter((file) =>
            this.options.allowedMimeTypes?.includes(file.type),
          )
        : candidates;
    };

    const preservePlainText = new Plugin({
      key: new PluginKey('mlvFileHandlerPlainText'),
      props: {
        handlePaste: (view, event) => {
          const clipboard = event.clipboardData;
          if (
            !onPaste ||
            !clipboard?.files.length ||
            acceptedFiles(clipboard.files).length === 0 ||
            clipboard.getData('text/html').length > 0
          ) {
            return false;
          }
          const plainText = clipboard.getData('text/plain');
          if (!plainText) return false;
          view.dispatch(view.state.tr.insertText(plainText));
          return false;
        },
        handleDrop: (view, event) => {
          const transfer = event.dataTransfer;
          if (
            !onDrop ||
            !transfer?.files.length ||
            transfer.types.includes('application/x-prosemirror-slice') ||
            acceptedFiles(transfer.files).length === 0
          ) {
            return false;
          }
          const plainText = transfer.getData('text/plain');
          if (!plainText) return false;
          const position = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          })?.pos;
          if (position === undefined) return false;
          view.dispatch(view.state.tr.insertText(plainText, position));
          preservedDrop = { position, textLength: plainText.length };
          return false;
        },
      },
    });

    return [
      preservePlainText,
      FileHandlePlugin({
        key: new PluginKey(this.name),
        editor: this.editor,
        allowedMimeTypes: this.options.allowedMimeTypes,
        consumePasteEvent: this.options.consumePasteEvent,
        onPaste,
        onDrop: onDrop
          ? (editor, files, position) => {
              const adjustedPosition =
                preservedDrop?.position === position
                  ? position + preservedDrop.textLength
                  : position;
              preservedDrop = undefined;
              onDrop(editor, files, adjustedPosition);
            }
          : undefined,
      }),
    ];
  },
});

/**
 * Makes the default preset collaboration-safe. `mlv-editor` passes it
 * whenever an `mlvEditorCollaboration` binding is active; a consumer
 * composing its own set passes `isChangeOrigin` from
 * `@tiptap/extension-collaboration`.
 */
export interface MlvEditorPresetCollaborationOptions {
  /** Whether a transaction was applied from the shared document. */
  readonly isChangeOrigin: (tr: Transaction) => boolean;

  /**
   * The image sources a collaborating editor renders (F-D23). A peer's image
   * reaches the shared document without passing the upload coordinator, so
   * an image whose `src` fails this shows in the editing DOM without a
   * source, marked `data-mlv-editor-image-blocked`, and is never fetched.
   * Only the rendered view changes: the shared document, `getHTML()`, the
   * `value` and the clipboard keep the `src`. Called with the node's `src`
   * as stored; `mlv-editor` passes a policy that resolves it against the
   * document's `baseURI` first, then applies `imageUploadOptions.urlPolicy`
   * (default `mlvEditorDefaultImageUrlPolicy`) to the absolute href.
   * Defaults to `mlvEditorDefaultImageUrlPolicy`, which refuses a relative
   * `src`. A policy that throws refuses.
   */
  readonly imageUrlPolicy?: MlvEditorImageUrlPolicy;
}

/** Options used to configure formatting extensions in a Malva editor preset. */
export interface MlvEditorFormattingExtensionOptions {
  /** Node types that accept text alignment. Defaults to headings and paragraphs. */
  readonly textAlignTypes?: readonly string[];
  /**
   * Textblock node types that accept a block line height
   * (`setBlockLineHeight`). Defaults to headings and paragraphs.
   */
  readonly lineHeightTypes?: readonly string[];

  /**
   * Collaboration mode: StarterKit's `undoRedo` is left out, because the
   * collaboration extension supplies a per-user Y undo manager and two undo
   * systems diverge. Unset keeps the output byte-identical.
   */
  readonly collaboration?: MlvEditorPresetCollaborationOptions;
}

/** Options used to configure task-list support. */
export interface MlvEditorListExtensionOptions {
  /** Whether task-list items may be nested. Defaults to false. */
  readonly nestedTaskItems?: boolean;
}

/** Options used to configure table support. */
export interface MlvEditorTableExtensionOptions {
  /** Whether users can resize table columns. Defaults to true. */
  readonly resizable?: boolean;
}

/** A pasted or dropped file event passed from Tiptap to the editor upload coordinator. */
export interface MlvEditorFileHandlerEvent {
  /** Editor that received the file event. */
  readonly editor: Editor;

  /** Files selected by the browser paste or drop event. */
  readonly files: readonly File[];

  /** Origin of the image files. */
  readonly source: Exclude<MlvEditorImageUploadSource, 'button'>;

  /** Document position at which files were dropped, when applicable. */
  readonly position?: number;

  /** HTML clipboard content accompanying pasted files, when available. */
  readonly pasteContent?: string;
}

/**
 * @internal Smallest size a resized image may be dragged to, in CSS pixels.
 *
 * Supplied explicitly rather than left to Tiptap's own defaults, which cannot
 * be reached from here: the Image extension always forwards
 * `min: { width: minWidth, height: minHeight }` to `ResizableNodeView`, and
 * that object literal is truthy even when both members are `undefined`, so the
 * node view spreads them over its `{ width: 8, height: 8 }` defaults and erases
 * them. Every drag then computes `Math.max(undefined, n)` — `NaN` — and
 * `style.width = 'NaNpx'` is rejected by the CSSOM without an error, so the
 * image silently never resizes. The value matches Tiptap's own default.
 */
const MLV_EDITOR_IMAGE_MIN_SIZE = 8;

/** Options used to configure the image and file-handler extensions. */
export interface MlvEditorImageExtensionOptions {
  /** Whether image node resizing is enabled. Defaults to true. */
  readonly resizable?: boolean;

  /**
   * Smallest width, in CSS pixels, a resized image may be dragged to.
   * Defaults to 8. Must be a finite number: an undefined minimum leaves
   * Tiptap's resize arithmetic producing `NaN` and silently disables resizing.
   */
  readonly minWidth?: number;

  /** Smallest height, in CSS pixels, a resized image may be dragged to. Defaults to 8. */
  readonly minHeight?: number;

  /** MIME types forwarded to Tiptap's file handler. */
  readonly allowedMimeTypes?: readonly string[];

  /** Runtime guard applied before Tiptap consumes a matching file event. */
  readonly fileHandlingEnabled?: () => boolean;

  /** Optional runtime MIME decision used for editor-scoped upload options. */
  readonly acceptsMimeType?: (mimeType: string) => boolean;

  /** Callback invoked for pasted and dropped files. */
  readonly onFiles?: (event: MlvEditorFileHandlerEvent) => void;

  /**
   * Collaboration mode: the editing DOM shows an image's `src` only when it
   * passes `imageUrlPolicy` (F-D23); serialization is unchanged. Unset keeps
   * the output byte-identical.
   */
  readonly collaboration?: MlvEditorPresetCollaborationOptions;
}

/** @private Marks an image whose source a collaborating editor withheld. */
const MLV_EDITOR_IMAGE_BLOCKED_ATTRIBUTE = 'data-mlv-editor-image-blocked';

/**
 * @private Whether `node`'s `src` may be shown: absent, or accepted by
 * `policy`. A policy that throws refuses, as on the upload path: this runs
 * while ProseMirror builds the view, where a throw would abort the update
 * and leave the image and every node after it out of the editing DOM.
 */
function imageSourceAllowed(
  node: ProseMirrorNode,
  policy: MlvEditorImageUrlPolicy,
): boolean {
  const src: unknown = node.attrs['src'];
  if (src === null || src === undefined || src === '') return true;
  if (typeof src !== 'string') return false;
  try {
    return policy(src);
  } catch {
    return false;
  }
}

/**
 * @private The image extension of a collaborating editor (F-D23): the
 * editing DOM shows `src` only when it passes `policy`. Serialization is
 * untouched — `renderHTML` also drives `getHTML()`, the HTML `value` and
 * ProseMirror's clipboard, so a source withheld there would be lost on
 * copy, cut, paste, drag and save. The node view polices instead: it wraps
 * Tiptap's resizable view (handing it the node with `src` cleared, at
 * creation and on every update) or, with resizing off, renders a plain
 * `<img>`. Either way a refused source is never assigned to an element, so
 * it is never fetched; the `<img>` is marked `data-mlv-editor-image-blocked`
 * and shown, so its `alt` text reads in place of the picture.
 */
function policedImage(policy: MlvEditorImageUrlPolicy): typeof Image {
  return Image.extend({
    addNodeView() {
      const resizable = this.parent?.() ?? null;
      const htmlAttributes = this.options.HTMLAttributes;
      if (typeof document === 'undefined') return resizable;
      return (props: NodeViewRendererProps): NodeView => {
        const withheld = (node: ProseMirrorNode): ProseMirrorNode =>
          imageSourceAllowed(node, policy)
            ? node
            : node.type.create({ ...node.attrs, src: null }, null, node.marks);
        const mark = (img: HTMLElement, node: ProseMirrorNode): void => {
          img.toggleAttribute(
            MLV_EDITOR_IMAGE_BLOCKED_ATTRIBUTE,
            !imageSourceAllowed(node, policy),
          );
        };

        if (!resizable) {
          const img = document.createElement('img');
          const merged = mergeAttributes(htmlAttributes, props.HTMLAttributes);
          for (const [key, value] of Object.entries(merged)) {
            if (value === null || value === undefined || key === 'src')
              continue;
            img.setAttribute(key, String(value));
          }
          if (imageSourceAllowed(props.node, policy) && merged['src']) {
            img.setAttribute('src', String(merged['src']));
          }
          mark(img, props.node);
          const node = props.node;
          // Any change rebuilds the view, re-running the policy: an `<img>`
          // is cheap, and a rebuild never assigns a refused source.
          return { dom: img, update: (next) => next.sameMarkup(node) };
        }

        const allowed = imageSourceAllowed(props.node, policy);
        const view = resizable({
          ...props,
          node: withheld(props.node),
          HTMLAttributes: allowed
            ? props.HTMLAttributes
            : { ...props.HTMLAttributes, src: null },
        });
        if (!(view instanceof ResizableNodeView)) return view;
        const img = view.element;
        mark(img, props.node);
        if (!allowed) {
          // Tiptap reveals the view on the image's `load` / `error`, which a
          // sourceless `<img>` never fires.
          view.dom.style.visibility = '';
          view.dom.style.pointerEvents = '';
        }
        const update = view.update.bind(view);
        view.update = (node, decorations, innerDecorations) => {
          const kept = update(withheld(node), decorations, innerDecorations);
          if (kept) mark(img, node);
          return kept;
        };
        return view;
      };
    },
  });
}

/** Options used to configure editor utility extensions. */
export interface MlvEditorUtilityExtensionOptions {
  /**
   * Placeholder shown for an empty editor: a string, or a function Tiptap's
   * `Placeholder` calls on every decoration pass (so it can follow a signal).
   * A function's new value shows on the next ProseMirror state update.
   */
  readonly placeholder?: PlaceholderOptions['placeholder'];

  /** Maximum character count, or null for no limit. */
  readonly characterLimit?: number | null;

  /**
   * Collaboration mode: `CharacterCount` counts with no limit and the limit
   * is re-applied to local transactions only, since a remote change cannot be
   * cancelled. Unset keeps the output byte-identical.
   */
  readonly collaboration?: MlvEditorPresetCollaborationOptions;
}

/**
 * Counts words using every Unicode whitespace separator as a boundary.
 *
 * @param text Plain editor text.
 * @returns The deterministic number of non-empty words.
 */
export function countMlvEditorWords(text: string): number {
  const normalized = text.trim();
  return normalized ? normalized.split(/\s+/u).filter(Boolean).length : 0;
}

/**
 * Normalizes a character limit to a positive finite integer.
 *
 * @param limit Candidate limit.
 * @returns The usable limit, or `null` for unlimited content.
 */
export function normalizeMlvEditorCharacterLimit(
  limit: number | null | undefined,
): number | null {
  return typeof limit === 'number' &&
    Number.isFinite(limit) &&
    Number.isInteger(limit) &&
    limit > 0
    ? limit
    : null;
}

/** Options used to configure the beta Markdown extension. */
export interface MlvEditorMarkdownExtensionOptions {
  /** Indentation used by Markdown lists and code blocks. */
  readonly indentation?: {
    /** Use spaces or tabs for indentation. */
    readonly style?: 'space' | 'tab';

    /** Number of indentation characters per nesting level. */
    readonly size?: number;
  };
}

/** Aggregate options accepted by the standard Malva editor extension preset. */
export interface MlvEditorDefaultExtensionOptions
  extends MlvEditorFormattingExtensionOptions,
    MlvEditorListExtensionOptions,
    MlvEditorTableExtensionOptions,
    MlvEditorImageExtensionOptions,
    MlvEditorUtilityExtensionOptions,
    MlvEditorMarkdownExtensionOptions {
  /** Serialization format; Markdown support is added only for `markdown`. */
  readonly format?: MlvEditorFormat;

  /** Host capabilities for the block drag handle. */
  readonly blockHandle?: Partial<MlvEditorBlockHandleOptions>;

  /**
   * Adds {@link MlvEditorBlockId}: `true` with its defaults, an object to
   * configure it. Off by default, so the preset output stays byte-identical.
   */
  readonly blockIds?: boolean | Partial<MlvEditorBlockIdOptions>;

  /**
   * Adds {@link MlvEditorHeadingAnchors}: `true` with its defaults, an
   * object to configure it. Off by default, so the preset output stays
   * byte-identical.
   */
  readonly headingAnchors?: boolean | Partial<MlvEditorHeadingAnchorOptions>;
}

/**
 * Creates the core formatting extensions used by the default Malva preset.
 *
 * @param options Optional text-alignment and line-height configuration.
 * @returns Fresh Tiptap extension instances safe to compose into one editor.
 */
export function mlvEditorFormattingExtensions(
  options: MlvEditorFormattingExtensionOptions = {},
): Extensions {
  return [
    createMarkdownCompatibleStarterKit({
      link: {
        openOnClick: false,
        HTMLAttributes: { target: null, rel: null },
      },
      ...(options.collaboration ? { undoRedo: false as const } : {}),
    }),
    createMarkdownCompatibleTextStyle(),
    withAbsentStyleAsNull(Color.configure({})),
    createMarkdownCompatibleHighlight(),
    TextAlign.configure({
      types: [...(options.textAlignTypes ?? ['heading', 'paragraph'])],
    }),
    withAbsentStyleAsNull(FontFamily.configure({})),
    withAbsentStyleAsNull(FontSize.configure({})),
    MlvEditorBlockLineHeight.configure({
      types: [...(options.lineHeightTypes ?? ['heading', 'paragraph'])],
    }),
    MlvEditorSubscript.configure({}),
    MlvEditorSuperscript.configure({}),
    MlvEditorResetFormatting.configure({}),
  ];
}

/**
 * Creates task-list extensions. Bullet and ordered lists remain supplied by StarterKit.
 *
 * @param options Optional task-item nesting configuration.
 * @returns Fresh task-list extension instances.
 */
export function mlvEditorListExtensions(
  options: MlvEditorListExtensionOptions = {},
): Extensions {
  return [
    TaskList.configure({}),
    TaskItem.configure({ nested: options.nestedTaskItems ?? false }),
  ];
}

/**
 * Creates the free Tiptap table kit.
 *
 * @param options Optional table resize configuration.
 * @returns A fresh configured table-kit extension.
 */
export function mlvEditorTableExtensions(
  options: MlvEditorTableExtensionOptions = {},
): Extensions {
  return [
    createMarkdownCompatibleTableKit({
      table: { resizable: options.resizable ?? true },
    }),
  ];
}

/**
 * Creates the image and paste/drop file-handler extensions.
 *
 * @param options Optional image resize, MIME-type, and file callback configuration.
 * @returns Fresh image and file-handler extension instances.
 */
export function mlvEditorImageExtensions(
  options: MlvEditorImageExtensionOptions = {},
): Extensions {
  const allowedMimeTypes = options.allowedMimeTypes
    ? [...options.allowedMimeTypes]
    : undefined;
  if (allowedMimeTypes) {
    Object.defineProperty(allowedMimeTypes, 'includes', {
      configurable: true,
      value: (mimeType: string): boolean => {
        if (options.fileHandlingEnabled?.() === false) return false;
        const normalizedMimeType = mimeType.trim().toLowerCase();
        const acceptedByPattern = allowedMimeTypes.some((pattern) => {
          const normalizedPattern = pattern.trim().toLowerCase();
          return normalizedPattern.endsWith('/*')
            ? normalizedMimeType.startsWith(normalizedPattern.slice(0, -1))
            : normalizedMimeType === normalizedPattern;
        });
        return (
          acceptedByPattern &&
          (options.acceptsMimeType?.(normalizedMimeType) ?? true)
        );
      },
    });
  }
  const fileHandlerOptions = options.onFiles
    ? {
        allowedMimeTypes,
        consumePasteEvent: false,
        onPaste: (editor: Editor, files: File[], pasteContent?: string) => {
          options.onFiles?.({
            editor,
            files,
            source: 'paste',
            ...(pasteContent === undefined ? {} : { pasteContent }),
          });
        },
        onDrop: (editor: Editor, files: File[], position: number) => {
          options.onFiles?.({ editor, files, source: 'drop', position });
        },
      }
    : { allowedMimeTypes };

  const image = options.collaboration
    ? policedImage(
        options.collaboration.imageUrlPolicy ?? mlvEditorDefaultImageUrlPolicy,
      )
    : Image;
  return [
    image.configure({
      resize: {
        enabled: options.resizable ?? true,
        // Both must be finite; see MLV_EDITOR_IMAGE_MIN_SIZE for why omitting
        // them does not fall back to Tiptap's defaults but breaks resizing.
        minWidth: Number.isFinite(options.minWidth)
          ? (options.minWidth as number)
          : MLV_EDITOR_IMAGE_MIN_SIZE,
        minHeight: Number.isFinite(options.minHeight)
          ? (options.minHeight as number)
          : MLV_EDITOR_IMAGE_MIN_SIZE,
      },
    }),
    MlvEditorFileHandler.configure(fileHandlerOptions),
  ];
}

/**
 * Creates placeholder and character-count utility extensions.
 *
 * @param options Optional placeholder text and character limit.
 * @returns Fresh utility extension instances.
 */
export function mlvEditorUtilityExtensions(
  options: MlvEditorUtilityExtensionOptions = {},
): Extensions {
  return [
    Placeholder.configure({
      placeholder: options.placeholder ?? 'Write something…',
    }),
    CharacterCount.configure({
      limit: options.collaboration
        ? null
        : normalizeMlvEditorCharacterLimit(options.characterLimit),
      wordCounter: countMlvEditorWords,
    }),
    ...(options.collaboration
      ? [
          MlvEditorCollaborationCharacterLimit.configure({
            limit: normalizeMlvEditorCharacterLimit(options.characterLimit),
            isChangeOrigin: options.collaboration.isChangeOrigin,
          }),
        ]
      : []),
  ];
}

/**
 * Creates the block drag-handle extension.
 *
 * Every option is host-supplied. Omitting them yields an inert handle that never
 * mounts, which is what a bare `mlvEditorDefaultExtensions()` call outside the
 * `MlvEditor` shell should produce.
 *
 * @param options Optional host capabilities for mounting, labelling, and announcing.
 * @returns A fresh configured block-handle extension.
 */
export function mlvEditorBlockHandleExtensions(
  options: Partial<MlvEditorBlockHandleOptions> = {},
): Extensions {
  return [MlvEditorBlockHandle.configure({ ...options })];
}

/**
 * Creates the official beta Tiptap Markdown extension.
 *
 * @param options Optional Markdown indentation configuration.
 * @returns A fresh Markdown extension instance.
 */
export function mlvEditorMarkdownExtensions(
  options: MlvEditorMarkdownExtensionOptions = {},
): Extensions {
  return [
    Markdown.configure(
      options.indentation === undefined
        ? {}
        : {
            indentation: {
              ...options.indentation,
            },
          },
    ),
  ];
}

/**
 * @private A transaction filter that also skips change-origin transactions,
 * keeping a consumer's own filter.
 */
function localOnlyFilter(
  collaboration: MlvEditorPresetCollaborationOptions,
  own: ((tr: Transaction) => boolean) | null | undefined,
): (tr: Transaction) => boolean {
  return (tr) => !collaboration.isChangeOrigin(tr) && (own ? own(tr) : true);
}

/**
 * @private Block-ID options for collaboration: remote, seed, first-render and
 * Y-undo transactions never mint or dedupe, and nothing is assigned until
 * `ensureBlockIds()` runs after the first sync (F-D16).
 */
function collaborativeBlockIdOptions(
  options: Partial<MlvEditorBlockIdOptions>,
  collaboration: MlvEditorPresetCollaborationOptions | undefined,
): Partial<MlvEditorBlockIdOptions> {
  if (!collaboration) return options;
  return {
    ...options,
    filterTransaction: localOnlyFilter(
      collaboration,
      options.filterTransaction,
    ),
    assignOnCreate: false,
  };
}

/**
 * @private Heading-anchor options for collaboration: anchors are derived from
 * text, so recomputing them on a remote transaction would make every peer
 * write the same attribute (F-D16).
 */
function collaborativeHeadingAnchorOptions(
  options: Partial<MlvEditorHeadingAnchorOptions>,
  collaboration: MlvEditorPresetCollaborationOptions | undefined,
): Partial<MlvEditorHeadingAnchorOptions> {
  if (!collaboration) return options;
  return {
    ...options,
    filterTransaction: localOnlyFilter(
      collaboration,
      options.filterTransaction,
    ),
  };
}

/**
 * Creates Malva's complete default extension preset.
 *
 * Every call creates new arrays and extension instances. Passing a custom extension
 * list to the editor shell intentionally replaces this preset instead of extending it.
 *
 * @param options Optional preset configuration.
 * @returns A duplicate-free extension set for one new Tiptap editor instance.
 */
export function mlvEditorDefaultExtensions(
  options: MlvEditorDefaultExtensionOptions = {},
): Extensions {
  return [
    ...mlvEditorFormattingExtensions(options),
    ...mlvEditorListExtensions(options),
    ...mlvEditorTableExtensions(options),
    ...mlvEditorImageExtensions(options),
    ...mlvEditorUtilityExtensions(options),
    MlvEditorUploadPlaceholder.configure(),
    ...mlvEditorBlockHandleExtensions(options.blockHandle ?? {}),
    ...(options.blockIds
      ? [
          MlvEditorBlockId.configure(
            collaborativeBlockIdOptions(
              options.blockIds === true ? {} : options.blockIds,
              options.collaboration,
            ),
          ),
        ]
      : []),
    ...(options.headingAnchors
      ? [
          MlvEditorHeadingAnchors.configure(
            collaborativeHeadingAnchorOptions(
              options.headingAnchors === true ? {} : options.headingAnchors,
              options.collaboration,
            ),
          ),
        ]
      : []),
    ...(options.format === 'markdown'
      ? mlvEditorMarkdownExtensions(options)
      : []),
  ];
}
