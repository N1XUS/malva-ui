/**
 * Represents a file that has been selected or uploaded.
 */
export interface MlvUploadedFile {
  /** Unique identifier for the file entry. */
  id: string;
  /** The native File object. */
  file: File;
  /** Display name derived from the file. */
  name: string;
  /** File size in bytes. */
  size: number;
  /**
   * URL of the image preview.
   *
   * `mlv-file-upload` creates a `blob:` object URL for every picked or dropped
   * `image/*` file and revokes it, after the next render, once no mounted
   * upload's value references it — `removeFile`, a single-file replace, or an
   * external write such as a form `reset()`. Destroying an upload whose value
   * still holds the entry does not revoke it, so an upload re-mounted with that
   * value keeps its preview.
   *
   * Ownership follows the URL string: a URL the component created stays
   * component-owned wherever it is copied — into a new entry object, another
   * upload's value, your own state — and is revoked once no mounted upload's
   * value references it. For a preview that must outlive the entry, create
   * your own with `URL.createObjectURL(entry.file)`.
   *
   * A URL you supply (an edit-mode seed: `https://…`, `data:` or a `blob:`
   * you created) is yours — the component never revokes it, so revoke it
   * yourself when you drop it.
   */
  previewUrl?: string;
  /** Current upload state. */
  state: 'pending' | 'uploading' | 'success' | 'error';
  /** Upload progress from 0–100 (used when state is `'uploading'`). */
  progress?: number;
  /** Validation error set when the file fails accept/size/count checks. */
  error?: MlvFileValidationError;
}

/**
 * Describes a file validation failure.
 */
export interface MlvFileValidationError {
  /** Machine-readable reason code. */
  code: 'size' | 'type' | 'count';
  /** Human-readable error message. */
  message: string;
}

/** Overall state of the drop-zone. */
export type MlvFileUploadState = 'idle' | 'dragging' | 'disabled';

/**
 * How the drop zone presents the current selection.
 *
 * - `'list'` — the default. The zone always shows the prompt and browse
 *   button, and selected files are listed below it.
 * - `'cover'` — a single selected image fills the zone, with a floating
 *   replace/remove toolbar. Falls back to `'list'` whenever the cover
 *   preconditions are not met (see `MlvFileUpload.previewMode`).
 */
export type MlvFileUploadPreviewMode = 'list' | 'cover';
