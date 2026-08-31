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
  /** Object URL for image preview — revoked when the file is removed. */
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
