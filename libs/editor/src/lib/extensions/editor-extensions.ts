import { Extension, type Editor, type Extensions } from '@tiptap/core';
import {
  FileHandlePlugin,
  type FileHandlerOptions,
} from '@tiptap/extension-file-handler';
import Image from '@tiptap/extension-image';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import TextAlign from '@tiptap/extension-text-align';
import { Color } from '@tiptap/extension-text-style';
import { CharacterCount, Placeholder } from '@tiptap/extensions';
import type { PlaceholderOptions } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type {
  MlvEditorFormat,
  MlvEditorImageUploadSource,
} from '../editor.types';
import {
  MlvEditorBlockHandle,
  type MlvEditorBlockHandleOptions,
} from './editor-block-handle';
import { MlvEditorUploadPlaceholder } from './editor-upload-placeholder';
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

/** Options used to configure formatting extensions in a Malva editor preset. */
export interface MlvEditorFormattingExtensionOptions {
  /** Node types that accept text alignment. Defaults to headings and paragraphs. */
  readonly textAlignTypes?: readonly string[];
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
}

/**
 * Creates the core formatting extensions used by the default Malva preset.
 *
 * @param options Optional text-alignment configuration.
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
    }),
    createMarkdownCompatibleTextStyle(),
    Color.configure({}),
    createMarkdownCompatibleHighlight(),
    TextAlign.configure({
      types: [...(options.textAlignTypes ?? ['heading', 'paragraph'])],
    }),
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

  return [
    Image.configure({
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
      limit: normalizeMlvEditorCharacterLimit(options.characterLimit),
      wordCounter: countMlvEditorWords,
    }),
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
    ...(options.format === 'markdown'
      ? mlvEditorMarkdownExtensions(options)
      : []),
  ];
}
