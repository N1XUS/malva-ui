import type { Signal } from '@angular/core';
import type { Editor } from '@tiptap/core';
import type {} from '@tiptap/markdown';
import type { Transaction } from '@tiptap/pm/state';

/**
 * Supported external serialization formats for editor content.
 *
 * `'html'` and `'markdown'` carry text markup. `'json'` carries the Tiptap
 * document itself as `JSON.stringify(editor.getJSON())`, so custom block nodes
 * round-trip their typed attributes instead of being flattened into HTML
 * attributes. The model type stays `string | null` in every format; a JSON
 * host parses that string at its own boundary.
 */
export type MlvEditorFormat = 'html' | 'markdown' | 'json';

/**
 * Width of the centred editor content column.
 *
 * `'default'` is a comfortable reading measure, `'wide'` suits dense or tabular
 * documents, and `'full'` lets the column fill its host. A horizontal gutter is
 * reserved at every value, so block affordances never overlap text.
 */
export type MlvEditorContentWidth = 'default' | 'wide' | 'full';

/**
 * Where `mlv-editor` places its toolbar relative to the content viewport.
 *
 * The DOM order follows the value, so the Tab order always matches the visual
 * order: `'top'` renders toolbar → content and `'bottom'` renders content →
 * toolbar. Both are block-axis positions and do not change in RTL.
 */
export type MlvEditorToolbarPosition = 'top' | 'bottom';

/**
 * How `mlv-editor` draws its toolbar.
 *
 * `'bar'` is the docked full-width row with a hairline toward the content.
 * `'floating'` is a selection bubble: an overlay hugging its controls, shown
 * only while focus is in the editor, the selection is non-empty (Alt+F10
 * summons it at the caret) and the editor is neither disabled nor `readonly`.
 * It prefers above the selection and flips below at the window's or a capped
 * viewport's edge. `toolbarPosition` and `toolbarSticky` do not apply to it.
 */
export type MlvEditorToolbarAppearance = 'bar' | 'floating';

/** Origin of an image file supplied to the editor. */
export type MlvEditorImageUploadSource = 'button' | 'paste' | 'drop';

/** Decides whether an uploaded image URL is safe to insert into the editor. */
export type MlvEditorImageUrlPolicy = (url: string) => boolean;

/**
 * Default image URL policy used by the editor upload coordinator.
 *
 * Only absolute HTTP(S) URLs with a hostname and without credentials are
 * accepted. Leading and trailing whitespace is ignored, while whitespace or
 * control characters inside the URL are rejected.
 *
 * @param url Candidate image URL returned by an uploader.
 * @returns Whether the URL is safe to insert.
 */
export function mlvEditorDefaultImageUrlPolicy(url: string): boolean {
  if (typeof url !== 'string') return false;
  const trimmedUrl = url.trim();
  const hasControlCharacter = [...trimmedUrl].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 0x20 || codePoint === 0x7f;
  });
  if (!trimmedUrl || /\s/u.test(trimmedUrl) || hasControlCharacter) {
    return false;
  }

  try {
    const parsedUrl = new URL(trimmedUrl);
    return (
      (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') &&
      parsedUrl.hostname.length > 0 &&
      parsedUrl.username.length === 0 &&
      parsedUrl.password.length === 0
    );
  } catch {
    return false;
  }
}

/** Details emitted when the Tiptap selection changes. */
export interface MlvEditorSelectionChange {
  /** Editor that produced the selection transaction. */
  readonly editor: Editor;

  /** Tiptap transaction containing the updated selection. */
  readonly transaction: Transaction;
}

/** Details emitted for every Tiptap transaction. */
export interface MlvEditorTransactionEvent {
  /** Editor that produced the transaction. */
  readonly editor: Editor;

  /** Tiptap transaction emitted by the editor. */
  readonly transaction: Transaction;
}

/** Details emitted when the editor receives or loses focus. */
export interface MlvEditorFocusEvent {
  /** Editor associated with the native focus event. */
  readonly editor: Editor;

  /** Native browser focus event. */
  readonly event: FocusEvent;
}

/** Context supplied to an image uploader for one upload operation. */
export interface MlvEditorImageUploadContext {
  /** Origin of the image file. */
  readonly source: MlvEditorImageUploadSource;

  /** Signal that is aborted when the upload should stop. */
  readonly signal: AbortSignal;

  /** Reports upload progress as a percentage from 0 through 100. */
  readonly reportProgress: (percentage: number) => void;
}

/** Image metadata returned by an image uploader after a successful upload. */
export interface MlvEditorImageUploadResult {
  /** URL used in the inserted image node. */
  readonly src: string;

  /**
   * Optional alternative text for the image.
   *
   * Returned by an uploader, it is a **fallback**: alternative text the
   * author supplied — typed in the upload dialog, or the empty alt of an
   * image marked decorative — wins, because the author states what the image
   * means and a file name rarely describes it (WCAG 1.1.1). Pasted and
   * dropped images carry no author alt, so this value applies to them.
   */
  readonly alt?: string;

  /**
   * Optional image title. Returned by an uploader, it is a fallback: a
   * non-empty title the author typed in the upload dialog wins. An image the
   * author marked decorative gets no title at all — an `alt=""` image with a
   * title is exposed as an unnamed image described by it (WCAG H67). An
   * uploader's own `alt: ''` is inserted as returned, title included — return
   * no `title` for an image you mean to be decorative (WCAG H67).
   */
  readonly title?: string;

  /** Optional rendered image width. */
  readonly width?: number;

  /** Optional rendered image height. */
  readonly height?: number;
}

/** Adapter used to transfer image files selected, pasted, or dropped in the editor. */
export interface MlvEditorImageUploader {
  /**
   * Uploads an image file and returns the metadata used to insert it.
   *
   * @param file Image file to upload.
   * @param context Source, cancellation, and progress facilities for this upload.
   * @returns Metadata for the successfully uploaded image.
   */
  upload(
    file: File,
    context: MlvEditorImageUploadContext,
  ): Promise<MlvEditorImageUploadResult>;
}

/** Constraints applied before images are sent to an uploader. */
export interface MlvEditorImageUploadOptions {
  /** MIME types or patterns accepted by the editor. */
  readonly accept: readonly string[];

  /** Largest allowed file size in bytes. */
  readonly maxSize: number;

  /** Maximum number of files accepted in one upload action. */
  readonly maxFiles: number;

  /** Optional host policy replacing the default uploaded-image URL decision. */
  readonly urlPolicy?: MlvEditorImageUrlPolicy;
}

/** One upload retained by the editor while it is active or retryable. */
export interface MlvEditorPendingUpload {
  /** Stable identifier shared with the non-serializable placeholder. */
  readonly id: string;

  /** Image file supplied by the host interaction. */
  readonly file: File;

  /** Interaction that supplied the file. */
  readonly source: MlvEditorImageUploadSource;

  /** Current finite upload progress from zero through one hundred. */
  readonly progress: number;

  /** Whether the upload is active or retained after a recoverable failure. */
  readonly status: 'uploading' | 'failed';

  /** Recoverable failure retained while the upload can be retried or removed. */
  readonly error?: MlvEditorError;
}

/**
 * Editor-owned image-upload capability forwarded to standalone toolbars.
 *
 * The capability is intentionally one shared reference so toolbar controls
 * never create a second uploader, request registry, or placeholder owner. Its
 * private brand makes this a library-owned capability rather than a structural
 * protocol for consumers to implement.
 */
export abstract class MlvEditorImageUploadControl {
  /** @private Nominal brand preventing structural implementations. */
  private readonly _mlvEditorImageUploadControlBrand = true;

  protected constructor() {
    void this._mlvEditorImageUploadControlBrand;
  }

  /** Whether this editor can currently begin image uploads. */
  abstract readonly available: Signal<boolean>;

  /** Whether either the input or injected adapter resolves for this editor. */
  abstract readonly adapterAvailable: Signal<boolean>;

  /** Current editor-scoped validation options. */
  abstract readonly options: Signal<MlvEditorImageUploadOptions>;

  /** Active and retryable uploads owned by this editor. */
  abstract readonly pending: Signal<readonly MlvEditorPendingUpload[]>;

  /**
   * Starts validated uploads in the owning editor.
   *
   * `metadata.alt` and `metadata.title` are the author's and win over the
   * uploader's result. Omit `alt` when the author supplied none — `''` marks
   * the image decorative, keeps it empty and drops every title, the
   * author's and the uploader's; otherwise an empty `title` lets the
   * uploader's apply.
   */
  abstract start(
    files: readonly File[],
    source: MlvEditorImageUploadSource,
    metadata?: {
      readonly position?: number;
      readonly alt?: string;
      readonly title?: string;
    },
  ): readonly string[];

  /** Cancels one active request. */
  abstract cancel(id: string): void;

  /** Retries one recoverable request. */
  abstract retry(id: string): void;

  /** Removes one recoverable failure. */
  abstract remove(id: string): void;
}

/** Details emitted after a successful image upload. */
export interface MlvEditorImageUploadSuccess {
  /** Image file that was uploaded. */
  readonly file: File;

  /** Origin of the image file. */
  readonly source: MlvEditorImageUploadSource;

  /**
   * Metadata inserted into the document: the uploader's validated result
   * with the author's alt and title applied over the uploader's.
   */
  readonly result: MlvEditorImageUploadResult;
}

/** Details emitted when an image upload fails. */
export interface MlvEditorImageUploadFailure {
  /** Image file whose upload failed. */
  readonly file: File;

  /** Origin of the image file. */
  readonly source: MlvEditorImageUploadSource;

  /** Recoverable error describing the failed upload. */
  readonly error: MlvEditorError;
}

/** Details emitted when an image upload is cancelled. */
export interface MlvEditorImageUploadCancelled {
  /** Image file whose upload was cancelled. */
  readonly file: File;

  /** Origin of the image file. */
  readonly source: MlvEditorImageUploadSource;
}

/**
 * Categories of recoverable errors emitted by the editor.
 *
 * `'ai-transport'` reports an AI provider that threw or whose stream failed;
 * `'ai-result'` reports AI output that could not be used. Both restore the
 * document to its pre-request checkpoint; cancellation is silent and never
 * emits an error.
 */
export type MlvEditorErrorCode =
  | 'configuration'
  | 'parse'
  | 'serialize'
  | 'unsupported-command'
  | 'upload-validation'
  | 'upload-transport'
  | 'upload-result'
  | 'ai-transport'
  | 'ai-result';

/** Structured error emitted instead of throwing through Angular change detection. */
export interface MlvEditorError {
  /** Stable category that callers can use for error handling. */
  readonly code: MlvEditorErrorCode;

  /** Human-readable description of the failure. */
  readonly message: string;

  /** Whether the editor can continue operating after the failure. */
  readonly recoverable: boolean;

  /** Original failure when one is available. */
  readonly cause?: unknown;
}
